"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import {
  attendances,
  auditLogs,
  employees,
  employeeLocations,
  locations,
  procedureCatalog,
  procedureFeeRates,
  requests,
  workLogItems,
} from "@/db/schema";
import { wajibMasuk, type PenggunaSesi } from "@/lib/auth/session";
import { MAKS_UKURAN_FOTO, olahFotoAbsensi, terlihatSepertiGambar } from "@/lib/foto";
import { langkahPersetujuan } from "@/features/approval/service";
import { alamatDariKoordinat, evaluasiGeofence, type HasilGeofence } from "@/lib/geo";
import { kunciFotoAbsensi, storage } from "@/lib/storage";
import { tanggalWIB } from "@/lib/waktu";
import { bacaPengaturan } from "@/features/settings/service";
import {
  absensiAktif,
  nilaiClockIn,
  nilaiClockOut,
  nilaiClockOutTanpaShift,
  shiftBerlaku,
} from "./service";

export type HasilAbsen = { ok: boolean; pesan: string; kode?: string };

/*
 * Absen di luar area tidak membuat pengajuan yang harus disetujui.
 *
 * Kehadiran adalah peristiwa yang sudah terjadi dan buktinya sudah lengkap —
 * foto berstempel waktu server, koordinat, jarak, dan alasan yang diketik
 * karyawan. Meminta persetujuan atasnya hanya menunda pekerjaan dua orang
 * tanpa mengubah apa pun. Yang berjalan lewat persetujuan tetap hal yang
 * memang perlu diputuskan sebelum berlaku: cuti, izin, lembur, dan koreksi
 * absen. Penyimpangan lokasi tetap ditandai di rekap agar bisa ditinjau.
 */

const skemaPosisi = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  akurasi: z.coerce.number().min(0).max(100_000).nullable().catch(null),
  alasan: z.string().trim().max(500).optional(),
  deviceFingerprint: z.string().trim().max(128).optional(),
  mockLocation: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

const skemaTindakan = z.array(
  z.object({
    procedureId: z.string().uuid(),
    jumlah: z.coerce.number().int().min(1).max(50),
    kodePasien: z.string().trim().max(40).optional(),
    catatan: z.string().trim().max(300).optional(),
  }),
);

async function infoPermintaan() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent"),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

/**
 * Mengambil dan memvalidasi berkas foto.
 * Content-type dari klien tidak dipercaya — isi berkas diperiksa langsung.
 */
async function bacaFoto(formData: FormData): Promise<Buffer | string> {
  const berkas = formData.get("foto");
  if (!(berkas instanceof File) || berkas.size === 0) {
    return "Foto absensi wajib diambil.";
  }
  if (berkas.size > MAKS_UKURAN_FOTO) {
    return "Ukuran foto terlalu besar.";
  }
  const buf = Buffer.from(await berkas.arrayBuffer());
  if (!terlihatSepertiGambar(buf)) {
    return "Berkas yang dikirim bukan gambar yang sah.";
  }
  return buf;
}

/** Memuat lokasi kerja karyawan beserta kebijakan geofence-nya. */
async function muatLokasi(pengguna: PenggunaSesi) {
  const db = await getDb();
  if (!pengguna.locationId) return null;
  const [lokasi] = await db
    .select()
    .from(locations)
    .where(eq(locations.id, pengguna.locationId))
    .limit(1);
  return lokasi ?? null;
}

/**
 * Seluruh cabang tempat karyawan ini boleh absen: penempatan utamanya
 * ditambah cabang lain yang ditugaskan kepadanya.
 */
async function muatSemuaLokasi(pengguna: PenggunaSesi) {
  const db = await getDb();

  const tambahan = await db
    .select({ lokasi: locations })
    .from(employeeLocations)
    .innerJoin(locations, eq(locations.id, employeeLocations.locationId))
    .where(eq(employeeLocations.employeeId, pengguna.employeeId));

  const utama = await muatLokasi(pengguna);
  const semua = utama ? [utama] : [];

  for (const { lokasi } of tambahan) {
    if (!semua.some((l) => l.id === lokasi.id)) semua.push(lokasi);
  }
  return semua;
}

/**
 * Memilih cabang yang dipakai menilai absensi kali ini.
 *
 * Karyawan lintas cabang bisa berdiri di dekat cabang mana pun, jadi yang
 * dipakai adalah cabang yang benar-benar melingkupinya. Bila tak satu pun
 * melingkupi, dipilih yang terdekat supaya pesan galat dan jaraknya menunjuk
 * tempat yang paling masuk akal, bukan cabang pertama yang kebetulan terdaftar.
 */
async function pilihLokasi(
  pengguna: PenggunaSesi,
  posisi: { lat: number; lng: number; akurasi: number | null },
) {
  const semua = await muatSemuaLokasi(pengguna);
  if (semua.length === 0) return null;

  let terbaik: { lokasi: (typeof semua)[number]; geo: HasilGeofence } | null = null;

  for (const lokasi of semua) {
    const geo = evaluasiGeofence({
      lat: posisi.lat,
      lng: posisi.lng,
      akurasiM: posisi.akurasi,
      lokasi,
    });

    if (!terbaik) {
      terbaik = { lokasi, geo };
      continue;
    }

    const lebihBaik =
      (!geo.diLuarArea && terbaik.geo.diLuarArea) ||
      (geo.diLuarArea === terbaik.geo.diLuarArea &&
        geo.jarakEfektifM < terbaik.geo.jarakEfektifM);

    if (lebihBaik) terbaik = { lokasi, geo };
  }

  return terbaik;
}

/* ========================================================================== */

export async function aksiClockIn(
  _prev: HasilAbsen | null,
  formData: FormData,
): Promise<HasilAbsen> {
  const pengguna = await wajibMasuk();
  const db = await getDb();

  const parsed = skemaPosisi.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      pesan: "Data lokasi tidak lengkap. Aktifkan GPS lalu coba lagi.",
    };
  }
  const posisi = parsed.data;

  const foto = await bacaFoto(formData);
  if (typeof foto === "string") return { ok: false, pesan: foto };

  // Waktu selalu diambil dari server. Jam di ponsel tidak pernah dipercaya.
  const sekarang = new Date();
  const tanggal = tanggalWIB(sekarang);

  const aktif = await absensiAktif(pengguna.employeeId);
  if (aktif && !aktif.clockOutAt) {
    return {
      ok: false,
      pesan: "Anda masih dalam sesi kerja yang belum di-clock out.",
      kode: "SUDAH_MASUK",
    };
  }
  if (aktif && aktif.tanggal === tanggal && aktif.clockInAt) {
    return { ok: false, pesan: "Anda sudah absen masuk hari ini.", kode: "SUDAH_MASUK" };
  }

  const { shift, libur, alasanLibur, liburNasional } = await shiftBerlaku(
    pengguna.employeeId,
    tanggal,
  );
  const { izinkanAbsenTanpaShift } = await bacaPengaturan("kebijakan_absensi");
  if (!shift && !izinkanAbsenTanpaShift) {
    return {
      ok: false,
      pesan: "Shift Anda belum diatur. Hubungi HRD untuk penetapan jadwal kerja.",
    };
  }
  if (libur && !posisi.alasan) {
    return {
      ok: false,
      pesan: `Hari ini ${alasanLibur ?? "bukan hari kerja Anda"}. Isi alasan bila tetap perlu absen.`,
      kode: "BUTUH_ALASAN",
    };
  }

  const terpilih = await pilihLokasi(pengguna, posisi);
  if (!terpilih) {
    return { ok: false, pesan: "Lokasi kerja Anda belum diatur. Hubungi HRD." };
  }
  const { lokasi, geo } = terpilih;

  if (!geo.diizinkan) return { ok: false, pesan: geo.pesan, kode: "DILUAR_AREA" };
  if (geo.butuhAlasan && !posisi.alasan) {
    return { ok: false, pesan: geo.pesan, kode: "BUTUH_ALASAN" };
  }

  // Tanpa shift tidak ada jam masuk untuk dibandingkan, jadi kehadiran dicatat
  // apa adanya: hadir, tanpa hitungan terlambat dan tanpa batas absen dini.
  const nilai = shift
    ? nilaiClockIn(shift, sekarang)
    : { status: "ON_TIME" as const, menitTerlambat: 0, terlaluDini: false };

  if (shift && nilai.terlaluDini) {
    return {
      ok: false,
      pesan: `Absen masuk baru dibuka ${shift.batasClockinDiniMenit} menit sebelum jam ${shift.jamMasuk.slice(0, 5)}.`,
    };
  }

  // Penanda anomali untuk ditinjau admin, tidak memblokir absen.
  const flags: string[] = [];
  if (posisi.mockLocation) flags.push("MOCK_GPS");
  if (geo.diLuarArea) flags.push("DILUAR_AREA");
  if (libur) flags.push("HARI_LIBUR");
  if (!shift) {
    flags.push("TANPA_SHIFT");
    // Tanpa shift hari libur tidak memblokir absen, tetapi tetap ditandai
    // supaya rekap admin tahu kehadiran itu jatuh di tanggal merah.
    if (liburNasional && !flags.includes("HARI_LIBUR")) flags.push("HARI_LIBUR");
  }

  const [karyawan] = await db
    .select({ deviceFingerprint: employees.deviceFingerprint })
    .from(employees)
    .where(eq(employees.id, pengguna.employeeId))
    .limit(1);

  if (posisi.deviceFingerprint) {
    if (!karyawan?.deviceFingerprint) {
      // Perangkat pertama langsung diikat ke akun.
      await db
        .update(employees)
        .set({ deviceFingerprint: posisi.deviceFingerprint })
        .where(eq(employees.id, pengguna.employeeId));
    } else if (karyawan.deviceFingerprint !== posisi.deviceFingerprint) {
      flags.push("DEVICE_BARU");
    }
  }

  const alamat = await alamatDariKoordinat(posisi.lat, posisi.lng);
  const fotoJadi = await olahFotoAbsensi(foto, {
    waktu: sekarang,
    alamat,
    lat: posisi.lat,
    lng: posisi.lng,
    akurasiM: posisi.akurasi,
    diLuarArea: geo.diLuarArea,
    jarakM: geo.jarakM,
    namaLokasi: lokasi.nama,
    namaKaryawan: pengguna.nama,
  });

  const kunci = kunciFotoAbsensi(pengguna.employeeId, tanggal, "masuk");
  await storage().put(kunci, fotoJadi, "image/jpeg");

  const [baris] = await db
    .insert(attendances)
    .values({
      employeeId: pengguna.employeeId,
      tanggal,
      shiftId: shift?.id ?? null,
      status: nilai.status,
      clockInAt: sekarang,
      clockInPhoto: kunci,
      clockInLat: posisi.lat,
      clockInLng: posisi.lng,
      clockInAccuracy: posisi.akurasi,
      clockInAddress: alamat,
      clockInDistanceM: geo.jarakM,
      clockInOutsideArea: geo.diLuarArea,
      clockInReason: posisi.alasan ?? null,
      menitTerlambat: nilai.menitTerlambat,
      deviceFingerprint: posisi.deviceFingerprint ?? null,
      flags,
    })
    .returning();

  const info = await infoPermintaan();
  await db.insert(auditLogs).values({
    actorId: pengguna.userId,
    aksi: "CLOCK_IN",
    entitas: "attendances",
    entitasId: baris.id,
    after: { tanggal, status: nilai.status, jarakM: geo.jarakM, flags },
    ip: info.ip,
    userAgent: info.userAgent,
  });

  revalidatePath("/");
  revalidatePath("/riwayat");

  const pesan =
    nilai.status === "LATE"
      ? `Absen masuk tercatat. Anda terlambat ${nilai.menitTerlambat} menit.`
      : "Absen masuk tercatat. Selamat bekerja!";

  return { ok: true, pesan };
}

/* ========================================================================== */

export async function aksiClockOut(
  _prev: HasilAbsen | null,
  formData: FormData,
): Promise<HasilAbsen> {
  const pengguna = await wajibMasuk();
  const db = await getDb();

  const parsed = skemaPosisi.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      pesan: "Data lokasi tidak lengkap. Aktifkan GPS lalu coba lagi.",
    };
  }
  const posisi = parsed.data;

  const catatanKerja = String(formData.get("catatanKerja") ?? "").trim();
  if (catatanKerja.length < 10) {
    return {
      ok: false,
      pesan: "Catatan pekerjaan hari ini wajib diisi, minimal 10 karakter.",
      kode: "BUTUH_CATATAN",
    };
  }

  const foto = await bacaFoto(formData);
  if (typeof foto === "string") return { ok: false, pesan: foto };

  const aktif = await absensiAktif(pengguna.employeeId);
  if (!aktif?.clockInAt) {
    return { ok: false, pesan: "Anda belum absen masuk.", kode: "BELUM_MASUK" };
  }
  if (aktif.clockOutAt) {
    return { ok: false, pesan: "Anda sudah absen pulang.", kode: "SUDAH_PULANG" };
  }

  // Absen pulang tidak pernah diblokir karena shift: yang sudah terlanjur
  // absen masuk harus selalu bisa menutup sesinya, apa pun keadaan jadwalnya.
  const { shift } = await shiftBerlaku(pengguna.employeeId, aktif.tanggal);

  const terpilih = await pilihLokasi(pengguna, posisi);
  if (!terpilih) {
    return { ok: false, pesan: "Lokasi kerja belum diatur. Hubungi HRD." };
  }
  const { lokasi, geo } = terpilih;

  if (!geo.diizinkan) return { ok: false, pesan: geo.pesan, kode: "DILUAR_AREA" };
  if (geo.butuhAlasan && !posisi.alasan) {
    return { ok: false, pesan: geo.pesan, kode: "BUTUH_ALASAN" };
  }

  // --- Tindakan: nominal fee SELALU diambil dari master data di server.
  // Angka yang dikirim klien tidak pernah dipakai.
  let daftarTindakan: z.infer<typeof skemaTindakan> = [];
  const mentahTindakan = formData.get("tindakan");
  if (typeof mentahTindakan === "string" && mentahTindakan.trim()) {
    try {
      const hasil = skemaTindakan.safeParse(JSON.parse(mentahTindakan));
      if (!hasil.success) return { ok: false, pesan: "Data tindakan tidak valid." };
      daftarTindakan = hasil.data;
    } catch {
      return { ok: false, pesan: "Data tindakan tidak terbaca." };
    }
  }
  if (daftarTindakan.length > 0 && !pengguna.isiFormTindakan) {
    return {
      ok: false,
      pesan: "Jabatan Anda tidak mencatat tindakan ber-fee.",
    };
  }

  const sekarang = new Date();
  const nilai = shift
    ? nilaiClockOut(shift, aktif.clockInAt, sekarang, aktif.status)
    : nilaiClockOutTanpaShift(aktif.clockInAt, sekarang);

  const alamat = await alamatDariKoordinat(posisi.lat, posisi.lng);
  const fotoJadi = await olahFotoAbsensi(foto, {
    waktu: sekarang,
    alamat,
    lat: posisi.lat,
    lng: posisi.lng,
    akurasiM: posisi.akurasi,
    diLuarArea: geo.diLuarArea,
    jarakM: geo.jarakM,
    namaLokasi: lokasi.nama,
    namaKaryawan: pengguna.nama,
  });

  const kunci = kunciFotoAbsensi(pengguna.employeeId, aktif.tanggal, "pulang");
  await storage().put(kunci, fotoJadi, "image/jpeg");

  const flags = [...aktif.flags];
  if (geo.diLuarArea && !flags.includes("DILUAR_AREA_PULANG")) {
    flags.push("DILUAR_AREA_PULANG");
  }

  await db
    .update(attendances)
    .set({
      status: nilai.status,
      clockOutAt: sekarang,
      clockOutPhoto: kunci,
      clockOutLat: posisi.lat,
      clockOutLng: posisi.lng,
      clockOutAccuracy: posisi.akurasi,
      clockOutAddress: alamat,
      clockOutDistanceM: geo.jarakM,
      clockOutOutsideArea: geo.diLuarArea,
      clockOutReason: posisi.alasan ?? null,
      menitLembur: nilai.menitLembur,
      durasiKerjaMenit: nilai.durasiKerjaMenit,
      catatanKerja,
      flags,
      updatedAt: sekarang,
    })
    .where(eq(attendances.id, aktif.id));

  let totalFee = 0;
  if (daftarTindakan.length > 0) {
    for (const item of daftarTindakan) {
      const [tindakan] = await db
        .select()
        .from(procedureCatalog)
        .where(
          and(
            eq(procedureCatalog.id, item.procedureId),
            eq(procedureCatalog.aktif, true),
          ),
        )
        .limit(1);
      if (!tindakan) continue;

      // Tarif khusus jabatan bila ada, kalau tidak pakai tarif default.
      let fee = tindakan.feeDefault;
      if (pengguna.positionId) {
        const [khusus] = await db
          .select({ fee: procedureFeeRates.fee })
          .from(procedureFeeRates)
          .where(
            and(
              eq(procedureFeeRates.procedureId, tindakan.id),
              eq(procedureFeeRates.positionId, pengguna.positionId),
            ),
          )
          .limit(1);
        if (khusus) fee = khusus.fee;
      }

      totalFee += fee * item.jumlah;
      await db.insert(workLogItems).values({
        attendanceId: aktif.id,
        procedureId: tindakan.id,
        namaTindakan: tindakan.nama,
        jumlah: item.jumlah,
        kodePasien: item.kodePasien || null,
        feeSnapshot: fee,
        catatan: item.catatan || null,
        status: "SUBMITTED",
      });
    }
  }

  // Lembur melewati ambang otomatis menjadi pengajuan agar ada persetujuan.
  if (nilai.menitLembur > 0) {
    await db.insert(requests).values({
      employeeId: pengguna.employeeId,
      tipe: "OVERTIME",
      status: "PENDING",
      totalStep: await langkahPersetujuan("OVERTIME", {
        departmentId: pengguna.departmentId,
        locationId: pengguna.locationId,
      }),
      alasan: catatanKerja.slice(0, 300),
      payload: {
        attendanceId: aktif.id,
        tanggal: aktif.tanggal,
        menitLembur: nilai.menitLembur,
      },
    });
  }

  const info = await infoPermintaan();
  await db.insert(auditLogs).values({
    actorId: pengguna.userId,
    aksi: "CLOCK_OUT",
    entitas: "attendances",
    entitasId: aktif.id,
    after: {
      status: nilai.status,
      menitLembur: nilai.menitLembur,
      jumlahTindakan: daftarTindakan.length,
    },
    ip: info.ip,
    userAgent: info.userAgent,
  });

  revalidatePath("/");
  revalidatePath("/riwayat");

  const bagianPesan = ["Absen pulang tercatat."];
  if (nilai.menitLembur > 0) {
    bagianPesan.push(`Lembur ${nilai.menitLembur} menit diajukan untuk persetujuan.`);
  }
  if (totalFee > 0) {
    bagianPesan.push(
      `${daftarTindakan.length} tindakan tercatat dengan estimasi fee Rp${totalFee.toLocaleString("id-ID")}.`,
    );
  }

  return { ok: true, pesan: bagianPesan.join(" ") };
}
