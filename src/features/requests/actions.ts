"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";

import { getDb } from "@/db/client";
import { attendances, auditLogs, leaveBalances, leaveTypes, requests } from "@/db/schema";
import { wajibMasuk, type PenggunaSesi } from "@/lib/auth/session";
import { MAKS_UKURAN_FOTO, terlihatSepertiGambar } from "@/lib/foto";
import { langkahPersetujuan } from "@/features/approval/service";
import { shiftBerlaku } from "@/features/attendance/service";
import { tanggalTerkunci } from "@/features/reports/kunci";
import { bacaPengaturan } from "@/features/settings/service";
import { storage } from "@/lib/storage";
import { jamKeMenit, rentangTanggal, selisihHari, tanggalWIB } from "@/lib/waktu";

export type HasilPengajuan = { ok: boolean; pesan: string };

async function catat(
  pengguna: PenggunaSesi,
  aksi: string,
  entitasId: string,
  after: Record<string, unknown>,
) {
  const db = await getDb();
  const h = await headers();
  await db.insert(auditLogs).values({
    actorId: pengguna.userId,
    aksi,
    entitas: "requests",
    entitasId,
    after,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  });
}

function segarkan() {
  revalidatePath("/pengajuan");
  revalidatePath("/admin/persetujuan");
  revalidatePath("/admin");
}

/**
 * Menyimpan lampiran pengajuan (mis. surat dokter).
 *
 * Berkasnya di-encode ulang jadi JPEG, bukan disimpan apa adanya. Sebelumnya
 * PNG dan WebP ikut diterima lalu ditulis mentah dengan label `image/jpeg` —
 * dan karena aplikasi mengirim `X-Content-Type-Options: nosniff`, peramban
 * menolak menebak jenis sebenarnya dan lampirannya tampil sebagai gambar
 * rusak. Sekalian metadata bawaan kamera, termasuk koordinat tempat foto
 * diambil, tidak ikut tersimpan.
 */
async function simpanLampiran(
  berkas: FormDataEntryValue | null,
  employeeId: string,
): Promise<string | null> {
  if (!(berkas instanceof File) || berkas.size === 0) return null;
  if (berkas.size > MAKS_UKURAN_FOTO) throw new Error("Ukuran lampiran terlalu besar.");

  const buf = Buffer.from(await berkas.arrayBuffer());
  if (!terlihatSepertiGambar(buf)) {
    throw new Error(
      "Lampiran harus berupa foto JPG, PNG, atau WebP. Foto HEIC dari iPhone perlu diubah dulu lewat menu bagikan.",
    );
  }

  let jadi: Buffer;
  try {
    jadi = await sharp(buf)
      .rotate()
      .resize(1280, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new Error(
      "Foto lampiran tidak bisa dibaca. Coba potret ulang atau pilih berkas lain.",
    );
  }

  const kunci = `lampiran/${employeeId}/${Date.now()}.jpg`;
  await storage().put(kunci, jadi, "image/jpeg");
  return kunci;
}

/* ==========================================================================
 * Cuti & izin
 * ========================================================================== */

const skemaCuti = z.object({
  leaveTypeId: z.string().uuid("Pilih jenis cuti"),
  mulai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal mulai tidak valid"),
  akhir: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal selesai tidak valid"),
  alasan: z.string().trim().min(5, "Alasan minimal 5 karakter").max(500),
  /** Formulir yang dipakai — inilah yang menentukan saldo ikut terpotong. */
  jenisPengajuan: z.enum(["cuti", "izin"]).default("cuti"),
});

/**
 * Mengajukan cuti atau izin.
 *
 * Hari cuti yang diajukan langsung ditahan di kolom `pending` supaya karyawan
 * tidak bisa mengajukan dua kali melebihi saldo sambil menunggu keputusan.
 *
 * Izin dan sakit tidak begitu: keduanya tidak memotong cuti tahunan dan tidak
 * menuntut kuota sama sekali. Orang yang demam tidak seharusnya kehilangan
 * hak cutinya, dan menahan izin sampai kuotanya cukup hanya membuat orang
 * berangkat kerja dalam keadaan sakit. Yang membedakannya adalah formulir yang
 * dipakai, bukan tebakan dari sifat jenis cutinya — dahulu jenis yang
 * mensyaratkan lampiran otomatis dianggap izin, sehingga cuti tahunan yang
 * mensyaratkan formulir ikut tercatat sebagai izin.
 */
export async function aksiAjukanCuti(
  _prev: HasilPengajuan | null,
  formData: FormData,
): Promise<HasilPengajuan> {
  const pengguna = await wajibMasuk();
  const parsed = skemaCuti.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  const d = parsed.data;
  const izin = d.jenisPengajuan === "izin";
  const tipe = izin ? "PERMIT" : "LEAVE";

  if (selisihHari(d.mulai, d.akhir) < 0) {
    return { ok: false, pesan: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
  }

  const jumlahHari = selisihHari(d.mulai, d.akhir) + 1;
  if (jumlahHari > 90) return { ok: false, pesan: "Pengajuan maksimal 90 hari." };

  const db = await getDb();
  const [jenis] = await db
    .select()
    .from(leaveTypes)
    .where(eq(leaveTypes.id, d.leaveTypeId))
    .limit(1);
  if (!jenis) return { ok: false, pesan: "Jenis cuti tidak ditemukan." };

  let lampiran: string | null = null;
  try {
    lampiran = await simpanLampiran(formData.get("lampiran"), pengguna.employeeId);
  } catch (err) {
    return { ok: false, pesan: err instanceof Error ? err.message : "Lampiran gagal." };
  }

  if (jenis.butuhLampiran && !lampiran && jumlahHari > 1) {
    return {
      ok: false,
      pesan: `${jenis.nama} lebih dari satu hari wajib melampirkan bukti.`,
    };
  }

  const tahun = Number(d.mulai.slice(0, 4));
  const potongKuota = !izin && jenis.kuotaDefault > 0;

  // Saldo diperiksa di server memakai angka dari database, bukan angka yang
  // ditampilkan di layar karyawan.
  if (potongKuota) {
    const [saldo] = await db
      .select()
      .from(leaveBalances)
      .where(
        and(
          eq(leaveBalances.employeeId, pengguna.employeeId),
          eq(leaveBalances.leaveTypeId, jenis.id),
          eq(leaveBalances.tahun, tahun),
        ),
      )
      .limit(1);

    /*
     * Baris saldo baru dibuatkan untuk karyawan yang didaftarkan setelah
     * jenis cutinya ada. Yang lebih dulu masuk tidak punya baris sama sekali,
     * dan dahulu sisanya dianggap nol — layar menjanjikan dua belas hari,
     * lalu pengajuannya ditolak "sisa 0 hari". Selama barisnya belum ada,
     * kuotanya diambil dari jenis cutinya, sama seperti yang ditampilkan.
     */
    const kuota = saldo?.kuota ?? jenis.kuotaDefault;
    const sisa =
      kuota +
      (saldo?.carryOverMasuk ?? 0) -
      (saldo?.terpakai ?? 0) -
      (saldo?.pending ?? 0);

    if (jumlahHari > sisa) {
      return {
        ok: false,
        pesan: `Sisa ${jenis.nama} Anda ${sisa} hari, tidak cukup untuk ${jumlahHari} hari.`,
      };
    }
  }

  const [pengajuan] = await db
    .insert(requests)
    .values({
      employeeId: pengguna.employeeId,
      tipe,
      status: "PENDING",
      totalStep: await langkahPersetujuan(tipe, {
        departmentId: pengguna.departmentId,
        locationId: pengguna.locationId,
      }),
      alasan: d.alasan,
      lampiran,
      payload: {
        leaveTypeId: jenis.id,
        namaJenis: jenis.nama,
        mulai: d.mulai,
        akhir: d.akhir,
        jumlahHari,
      },
    })
    .returning();

  // Tahan hari yang diajukan. Barisnya sekalian dibuat bila belum ada, supaya
  // penahanan ini tidak menguap tanpa jejak seperti sebelumnya.
  if (potongKuota) {
    await db
      .insert(leaveBalances)
      .values({
        employeeId: pengguna.employeeId,
        leaveTypeId: jenis.id,
        tahun,
        kuota: jenis.kuotaDefault,
        pending: jumlahHari,
      })
      .onConflictDoUpdate({
        target: [
          leaveBalances.employeeId,
          leaveBalances.leaveTypeId,
          leaveBalances.tahun,
        ],
        set: { pending: sql`${leaveBalances.pending} + ${jumlahHari}` },
      });
  }

  await catat(pengguna, izin ? "AJUKAN_IZIN" : "AJUKAN_CUTI", pengajuan.id, {
    jenis: jenis.nama,
    mulai: d.mulai,
    jumlahHari,
  });
  segarkan();

  return {
    ok: true,
    pesan: `Pengajuan ${jenis.nama} ${jumlahHari} hari terkirim dan menunggu persetujuan.`,
  };
}

/* ==========================================================================
 * Lembur
 * ========================================================================== */

const skemaLembur = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  jamMulai: z.string().regex(/^\d{2}:\d{2}$/, "Jam mulai tidak valid"),
  jamSelesai: z.string().regex(/^\d{2}:\d{2}$/, "Jam selesai tidak valid"),
  alasan: z.string().trim().min(5, "Alasan minimal 5 karakter").max(500),
});

export async function aksiAjukanLembur(
  _prev: HasilPengajuan | null,
  formData: FormData,
): Promise<HasilPengajuan> {
  const pengguna = await wajibMasuk();
  const parsed = skemaLembur.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  const d = parsed.data;
  const [jm, mm] = d.jamMulai.split(":").map(Number);
  const [js, ms] = d.jamSelesai.split(":").map(Number);
  let menit = js * 60 + ms - (jm * 60 + mm);
  if (menit <= 0) menit += 1440; // lembur yang melewati tengah malam

  if (menit > 12 * 60) {
    return { ok: false, pesan: "Durasi lembur tidak wajar (lebih dari 12 jam)." };
  }
  if (selisihHari(d.tanggal, tanggalWIB()) < 0) {
    return {
      ok: false,
      pesan: "Lembur untuk tanggal yang belum terjadi belum bisa diajukan.",
    };
  }

  const db = await getDb();
  const [absen] = await db
    .select({ id: attendances.id })
    .from(attendances)
    .where(
      and(
        eq(attendances.employeeId, pengguna.employeeId),
        eq(attendances.tanggal, d.tanggal),
      ),
    )
    .limit(1);

  const [pengajuan] = await db
    .insert(requests)
    .values({
      employeeId: pengguna.employeeId,
      tipe: "OVERTIME",
      status: "PENDING",
      totalStep: await langkahPersetujuan("OVERTIME", {
        departmentId: pengguna.departmentId,
        locationId: pengguna.locationId,
      }),
      alasan: d.alasan,
      payload: {
        attendanceId: absen?.id ?? null,
        tanggal: d.tanggal,
        jamMulai: d.jamMulai,
        jamSelesai: d.jamSelesai,
        menitLembur: menit,
      },
    })
    .returning();

  await catat(pengguna, "AJUKAN_LEMBUR", pengajuan.id, {
    tanggal: d.tanggal,
    menitLembur: menit,
  });
  segarkan();

  return {
    ok: true,
    pesan: `Pengajuan lembur ${Math.floor(menit / 60)} jam ${menit % 60} menit terkirim.`,
  };
}

/* ==========================================================================
 * Koreksi absen
 * ========================================================================== */

const skemaKoreksi = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  jamMasuk: z.string().regex(/^\d{2}:\d{2}$/, "Jam masuk tidak valid"),
  jamPulang: z.string().regex(/^\d{2}:\d{2}$/, "Jam pulang tidak valid"),
  alasan: z.string().trim().min(10, "Jelaskan alasannya minimal 10 karakter").max(500),
});

export async function aksiAjukanKoreksi(
  _prev: HasilPengajuan | null,
  formData: FormData,
): Promise<HasilPengajuan> {
  const pengguna = await wajibMasuk();
  const parsed = skemaKoreksi.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  const d = parsed.data;
  const mundur = selisihHari(d.tanggal, tanggalWIB());

  if (mundur < 0) {
    return { ok: false, pesan: "Tidak bisa mengoreksi tanggal yang belum terjadi." };
  }

  // Jam pulang yang lebih awal dari jam masuk hanya masuk akal untuk shift
  // malam. Tanpa penjagaan ini, jam yang tertukar tetap lolos sampai disetujui
  // lalu tersimpan sebagai hari kerja nol menit.
  const { shift } = await shiftBerlaku(pengguna.employeeId, d.tanggal);
  if (!shift?.lintasHari && jamKeMenit(d.jamPulang) <= jamKeMenit(d.jamMasuk)) {
    return { ok: false, pesan: "Jam pulang harus lebih akhir daripada jam masuk." };
  }

  // Batas mundur dibaca dari pengaturan, bukan ditanam di kode.
  const kebijakan = await bacaPengaturan("kebijakan_absensi");
  if (mundur > kebijakan.batasBackdateHari) {
    return {
      ok: false,
      pesan: `Koreksi hanya bisa diajukan maksimal ${kebijakan.batasBackdateHari} hari ke belakang.`,
    };
  }

  // Ditolak sejak awal, bukan saat disetujui: karyawan berhak tahu sekarang
  // bahwa tanggal itu memang sudah tidak bisa dikoreksi lagi.
  const kunci = await tanggalTerkunci(d.tanggal);
  if (kunci) {
    return {
      ok: false,
      pesan:
        "Rekap periode tanggal tersebut sudah dikunci dan tidak bisa dikoreksi lagi.",
    };
  }

  const db = await getDb();
  const [absen] = await db
    .select({ id: attendances.id })
    .from(attendances)
    .where(
      and(
        eq(attendances.employeeId, pengguna.employeeId),
        eq(attendances.tanggal, d.tanggal),
      ),
    )
    .limit(1);

  const [pengajuan] = await db
    .insert(requests)
    .values({
      employeeId: pengguna.employeeId,
      tipe: "BACKDATE",
      status: "PENDING",
      totalStep: await langkahPersetujuan("BACKDATE", {
        departmentId: pengguna.departmentId,
        locationId: pengguna.locationId,
      }),
      alasan: d.alasan,
      payload: {
        attendanceId: absen?.id ?? null,
        tanggal: d.tanggal,
        jamMasuk: d.jamMasuk,
        jamPulang: d.jamPulang,
      },
    })
    .returning();

  await catat(pengguna, "AJUKAN_KOREKSI", pengajuan.id, { tanggal: d.tanggal });
  segarkan();

  return {
    ok: true,
    pesan: "Pengajuan koreksi absen terkirim dan menunggu persetujuan.",
  };
}

/* ==========================================================================
 * Pembatalan oleh pengaju
 * ========================================================================== */

/** Membatalkan pengajuan sendiri selama belum diputuskan. */
export async function aksiBatalkanPengajuan(id: string): Promise<HasilPengajuan> {
  const pengguna = await wajibMasuk();
  const db = await getDb();

  const [pengajuan] = await db
    .select()
    .from(requests)
    .where(eq(requests.id, id))
    .limit(1);

  if (!pengajuan) return { ok: false, pesan: "Pengajuan tidak ditemukan." };
  // Kepemilikan diperiksa di server; id saja tidak cukup jadi izin.
  if (pengajuan.employeeId !== pengguna.employeeId) {
    return { ok: false, pesan: "Anda hanya bisa membatalkan pengajuan sendiri." };
  }
  if (pengajuan.status !== "PENDING") {
    return { ok: false, pesan: "Pengajuan yang sudah diputuskan tidak bisa dibatalkan." };
  }

  await db
    .update(requests)
    .set({ status: "CANCELLED", selesaiAt: new Date() })
    .where(eq(requests.id, id));

  // Kembalikan hari yang tadinya ditahan. Hanya cuti yang pernah menahan
  // saldo; izin dan sakit tidak menyentuhnya sama sekali.
  const p = pengajuan.payload as Record<string, unknown>;
  if (
    pengajuan.tipe === "LEAVE" &&
    typeof p.leaveTypeId === "string" &&
    typeof p.mulai === "string"
  ) {
    await db
      .update(leaveBalances)
      .set({
        pending: sql`greatest(0, ${leaveBalances.pending} - ${Number(p.jumlahHari ?? 0)})`,
      })
      .where(
        and(
          eq(leaveBalances.employeeId, pengguna.employeeId),
          eq(leaveBalances.leaveTypeId, p.leaveTypeId),
          eq(leaveBalances.tahun, Number(p.mulai.slice(0, 4))),
        ),
      );
  }

  await catat(pengguna, "BATALKAN_PENGAJUAN", id, { tipe: pengajuan.tipe });
  segarkan();
  return { ok: true, pesan: "Pengajuan dibatalkan." };
}

/** Rentang tanggal cuti untuk pratinjau jumlah hari di formulir. */
export async function hitungHariCuti(mulai: string, akhir: string) {
  return rentangTanggal(mulai, akhir).length;
}
