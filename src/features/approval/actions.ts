"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import {
  attendances,
  auditLogs,
  leaveBalances,
  notifications,
  requestApprovals,
  requests,
  type RequestType,
} from "@/db/schema";
import {
  nilaiClockIn,
  nilaiClockOut,
  nilaiClockOutTanpaShift,
  shiftBerlaku,
} from "@/features/attendance/service";
import { tanggalTerkunci } from "@/features/reports/kunci";
import { tanggalTerdampak } from "@/features/requests/ringkasan";
import { PERAN_PENYETUJU, wajibPeran, type PenggunaSesi } from "@/lib/auth/session";
import { rentangTanggal, tanggalWIB, waktuWIB } from "@/lib/waktu";
import { ambilPengajuan, bolehMemutuskan, LABEL_TIPE } from "./service";

export type HasilKeputusan = { ok: boolean; pesan: string; jumlah?: number };

const skema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  catatan: z.string().trim().max(500).optional(),
});

async function infoPermintaan() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent"),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

type Pengajuan = Awaited<ReturnType<typeof ambilPengajuan>>[number];

/* ==========================================================================
 * Efek lanjutan
 * ========================================================================== */

/**
 * Menerapkan akibat dari pengajuan yang disetujui.
 *
 * Dipisah per tipe supaya setiap akibat terlihat jelas dan bisa diuji
 * sendiri-sendiri. Semua perubahan bertumpu pada payload yang dibuat sistem,
 * bukan pada angka yang dikirim dari peramban penyetuju.
 */
async function terapkanPersetujuan(pengajuan: Pengajuan) {
  const db = await getDb();
  const p = pengajuan.payload as Record<string, unknown>;

  switch (pengajuan.tipe) {
    case "LEAVE":
    case "PERMIT": {
      const leaveTypeId = typeof p.leaveTypeId === "string" ? p.leaveTypeId : null;
      const mulai = typeof p.mulai === "string" ? p.mulai : null;
      const akhir = typeof p.akhir === "string" ? p.akhir : mulai;
      const jumlahHari = Number(p.jumlahHari ?? 0);
      if (!leaveTypeId || !mulai || !akhir) break;

      const tahun = Number(mulai.slice(0, 4));

      // Hanya cuti yang memotong saldo. Izin dan sakit tidak pernah menahan
      // hari apa pun saat diajukan, jadi tidak ada yang perlu dipindahkan ke
      // kolom terpakai — cuti tahunannya tetap utuh.
      if (pengajuan.tipe === "LEAVE") {
        await db
          .update(leaveBalances)
          .set({
            terpakai: sql`${leaveBalances.terpakai} + ${jumlahHari}`,
            pending: sql`greatest(0, ${leaveBalances.pending} - ${jumlahHari})`,
          })
          .where(
            and(
              eq(leaveBalances.employeeId, pengajuan.employeeId),
              eq(leaveBalances.leaveTypeId, leaveTypeId),
              eq(leaveBalances.tahun, tahun),
            ),
          );
      }

      /*
       * Tandai hari-hari tersebut agar tidak terhitung alpa.
       *
       * Cuti dan izin dibedakan statusnya. Keduanya sama-sama ketidakhadiran
       * yang sah, tetapi hanya cuti yang memotong hak tahunan — menghitungnya
       * di satu kolom membuat rekap terbaca seolah orang yang tiga hari sakit
       * sudah memakai tiga hari cutinya.
       */
      const statusHari = pengajuan.tipe === "PERMIT" ? "ON_PERMIT" : "ON_LEAVE";
      const label = pengajuan.tipe === "PERMIT" ? "Izin/sakit" : "Cuti";

      for (const tanggal of rentangTanggal(mulai, akhir)) {
        await db
          .insert(attendances)
          .values({
            employeeId: pengajuan.employeeId,
            tanggal,
            status: statusHari,
            catatanKerja: `${label} disetujui (${pengajuan.id.slice(0, 8)})`,
          })
          .onConflictDoUpdate({
            target: [attendances.employeeId, attendances.tanggal],
            set: { status: statusHari, updatedAt: new Date() },
          });
      }
      break;
    }

    case "BACKDATE": {
      const attendanceId = typeof p.attendanceId === "string" ? p.attendanceId : null;
      const tanggal = typeof p.tanggal === "string" ? p.tanggal : null;
      const jamMasuk = typeof p.jamMasuk === "string" ? p.jamMasuk : null;
      const jamPulang = typeof p.jamPulang === "string" ? p.jamPulang : null;
      if (!tanggal) break;

      /*
       * Jam yang dikoreksi wajib dinilai ulang.
       *
       * Sebelumnya hanya kolom jamnya yang ditimpa, sedangkan durasi kerja,
       * keterlambatan, dan statusnya dibiarkan memakai angka lama. Koreksi
       * yang disetujui karena karyawan lupa clock out karena itu tersimpan
       * dengan jam masuk dan jam pulang lengkap tetapi jam kerja nol — dan
       * nol itulah yang terbawa ke rekap penggajian.
       *
       * Menit lembur sengaja tidak ikut dihitung ulang: lembur punya jalur
       * persetujuannya sendiri, dan koreksi jam tidak boleh diam-diam
       * menambah upah lembur yang tidak pernah diputuskan siapa pun.
       */
      const [lama] = attendanceId
        ? await db
            .select()
            .from(attendances)
            .where(eq(attendances.id, attendanceId))
            .limit(1)
        : await db
            .select()
            .from(attendances)
            .where(
              and(
                eq(attendances.employeeId, pengajuan.employeeId),
                eq(attendances.tanggal, tanggal),
              ),
            )
            .limit(1);

      const masuk = jamMasuk ? waktuWIB(tanggal, jamMasuk) : (lama?.clockInAt ?? null);
      let pulang = jamPulang ? waktuWIB(tanggal, jamPulang) : (lama?.clockOutAt ?? null);

      const { shift } = await shiftBerlaku(pengajuan.employeeId, tanggal);

      // Shift malam: jam pulang yang lebih awal dari jam masuk jatuh di
      // tanggal berikutnya, bukan mundur ke pagi hari yang sama.
      if (masuk && pulang && pulang <= masuk && shift?.lintasHari) {
        pulang = new Date(pulang.getTime() + 86_400_000);
      }

      const hasilMasuk = masuk && shift ? nilaiClockIn(shift, masuk) : null;
      const statusMasuk = hasilMasuk?.status ?? "ON_TIME";
      const hasilPulang =
        masuk && pulang
          ? shift
            ? nilaiClockOut(shift, masuk, pulang, statusMasuk)
            : nilaiClockOutTanpaShift(masuk, pulang)
          : null;

      const nilai = {
        ...(masuk ? { clockInAt: masuk } : {}),
        ...(pulang ? { clockOutAt: pulang } : {}),
        shiftId: shift?.id ?? lama?.shiftId ?? null,
        status: hasilPulang?.pulangCepat ? ("EARLY_LEAVE" as const) : statusMasuk,
        menitTerlambat: hasilMasuk?.menitTerlambat ?? 0,
        durasiKerjaMenit: hasilPulang?.durasiKerjaMenit ?? 0,
        hasilKoreksi: true,
        updatedAt: new Date(),
      };

      if (lama) {
        await db.update(attendances).set(nilai).where(eq(attendances.id, lama.id));
      } else {
        await db
          .insert(attendances)
          .values({ employeeId: pengajuan.employeeId, tanggal, ...nilai })
          .onConflictDoUpdate({
            target: [attendances.employeeId, attendances.tanggal],
            set: nilai,
          });
      }
      break;
    }

    case "OUTSIDE_AREA": {
      const attendanceId = typeof p.attendanceId === "string" ? p.attendanceId : null;
      if (!attendanceId) break;
      // Absennya sah: penanda anomali dicabut, tetapi jarak dan fotonya
      // tetap tersimpan sebagai bukti.
      await db
        .update(attendances)
        .set({
          flags: sql`coalesce((select jsonb_agg(x) from jsonb_array_elements(${attendances.flags}) x where x::text not like '%DILUAR_AREA%'), '[]'::jsonb)`,
          updatedAt: new Date(),
        })
        .where(eq(attendances.id, attendanceId));
      break;
    }

    case "DEVICE_CHANGE":
      // Ikatan perangkat sudah dicabut dari aplikasi; jenis pengajuan ini
      // tidak bisa dibuat lagi. Cabangnya disisakan supaya baris lama yang
      // sudah telanjur ada tetap bisa diputuskan tanpa efek apa pun.
      break;

    case "OVERTIME":
      // Menit lembur sudah tercatat saat clock out; persetujuan hanya
      // mengesahkannya untuk keperluan payroll.
      break;
  }
}

/** Menerapkan akibat dari pengajuan yang ditolak. */
async function terapkanPenolakan(pengajuan: Pengajuan) {
  const db = await getDb();
  const p = pengajuan.payload as Record<string, unknown>;

  switch (pengajuan.tipe) {
    case "LEAVE":
    case "PERMIT": {
      const leaveTypeId = typeof p.leaveTypeId === "string" ? p.leaveTypeId : null;
      const mulai = typeof p.mulai === "string" ? p.mulai : null;
      const jumlahHari = Number(p.jumlahHari ?? 0);
      if (!leaveTypeId || !mulai) break;
      // Izin dan sakit tidak pernah menahan saldo, jadi tidak ada yang kembali.
      if (pengajuan.tipe !== "LEAVE") break;

      // Hari yang ditahan dikembalikan ke saldo.
      await db
        .update(leaveBalances)
        .set({ pending: sql`greatest(0, ${leaveBalances.pending} - ${jumlahHari})` })
        .where(
          and(
            eq(leaveBalances.employeeId, pengajuan.employeeId),
            eq(leaveBalances.leaveTypeId, leaveTypeId),
            eq(leaveBalances.tahun, Number(mulai.slice(0, 4))),
          ),
        );
      break;
    }

    case "OUTSIDE_AREA": {
      const attendanceId = typeof p.attendanceId === "string" ? p.attendanceId : null;
      if (!attendanceId) break;
      // Absen di luar area yang ditolak berarti hari itu dianggap alpa.
      await db
        .update(attendances)
        .set({ status: "ABSENT", updatedAt: new Date() })
        .where(eq(attendances.id, attendanceId));
      break;
    }

    case "OVERTIME": {
      const attendanceId = typeof p.attendanceId === "string" ? p.attendanceId : null;
      if (!attendanceId) break;
      // Lembur yang ditolak tidak boleh ikut terhitung di rekap.
      await db
        .update(attendances)
        .set({ menitLembur: 0, updatedAt: new Date() })
        .where(eq(attendances.id, attendanceId));
      break;
    }

    default:
      break;
  }
}

/* ==========================================================================
 * Aksi
 * ========================================================================== */

async function putuskan(
  pengguna: PenggunaSesi,
  ids: string[],
  setuju: boolean,
  catatan: string | undefined,
): Promise<HasilKeputusan> {
  const db = await getDb();
  const daftar = await ambilPengajuan(ids);
  const info = await infoPermintaan();

  let berhasil = 0;
  let ditolakWewenang = 0;
  let ditolakTerkunci = 0;
  let ditolakSendiri = 0;

  for (const pengajuan of daftar) {
    if (pengajuan.status !== "PENDING") continue;

    // Wewenang diperiksa ulang di server untuk setiap baris — tombol yang
    // tersembunyi di antarmuka tidak pernah dijadikan pengaman.
    const boleh = await bolehMemutuskan(pengguna, {
      tipe: pengajuan.tipe as RequestType,
      currentStep: pengajuan.currentStep,
      departmentId: pengajuan.departmentId,
      locationId: pengajuan.locationId,
    });
    if (!boleh) {
      ditolakWewenang++;
      continue;
    }

    /*
     * Tidak boleh menyetujui pengajuan sendiri.
     *
     * Kepala unit yang menjadi penyetuju juga mengajukan cuti untuk dirinya
     * sendiri, dan tanpa penjagaan ini ia bisa meloloskannya seorang diri.
     * Menolak pengajuan sendiri tetap diizinkan — akibatnya sama saja dengan
     * membatalkan, dan itu memang haknya.
     *
     * Super admin dikecualikan dengan alasan yang sama seperti di
     * `bolehMemutuskan`: dia pemilik sistem dan harus bisa membuka kebuntuan
     * ketika tidak ada orang lain yang berwenang memutuskan.
     */
    if (
      setuju &&
      pengajuan.userId === pengguna.userId &&
      pengguna.role !== "SUPER_ADMIN"
    ) {
      ditolakSendiri++;
      continue;
    }

    /*
     * Persetujuan yang menulis ulang absensi lama ditahan bila periodenya
     * sudah dikunci. Penolakan tidak ditahan — menolak tidak mengubah baris
     * absensi mana pun, dan pengajuan yang menggantung selamanya justru
     * meninggalkan pekerjaan yang tak bisa ditutup siapa pun.
     */
    if (setuju) {
      const tanggal = tanggalTerdampak(
        pengajuan.tipe as RequestType,
        pengajuan.payload as Record<string, unknown>,
      );
      let terkunci = false;
      for (const t of tanggal) {
        if (await tanggalTerkunci(t)) {
          terkunci = true;
          break;
        }
      }
      if (terkunci) {
        ditolakTerkunci++;
        continue;
      }
    }

    await db.insert(requestApprovals).values({
      requestId: pengajuan.id,
      step: pengajuan.currentStep,
      approverId: pengguna.userId,
      keputusan: setuju ? "APPROVED" : "REJECTED",
      catatan: catatan ?? null,
      actedAt: new Date(),
    });

    const langkahTerakhir = pengajuan.currentStep >= pengajuan.totalStep;

    if (!setuju) {
      await db
        .update(requests)
        .set({ status: "REJECTED", selesaiAt: new Date() })
        .where(eq(requests.id, pengajuan.id));
      await terapkanPenolakan(pengajuan);
    } else if (langkahTerakhir) {
      await db
        .update(requests)
        .set({ status: "APPROVED", selesaiAt: new Date() })
        .where(eq(requests.id, pengajuan.id));
      await terapkanPersetujuan(pengajuan);
    } else {
      // Masih ada langkah berikutnya: pengajuan tetap menunggu.
      await db
        .update(requests)
        .set({ currentStep: pengajuan.currentStep + 1 })
        .where(eq(requests.id, pengajuan.id));
    }

    const label = LABEL_TIPE[pengajuan.tipe as RequestType];
    await db.insert(notifications).values({
      userId: pengajuan.userId,
      tipe: "PENGAJUAN",
      judul: setuju
        ? langkahTerakhir
          ? `${label} Anda disetujui`
          : `${label} Anda lolos ke tahap berikutnya`
        : `${label} Anda ditolak`,
      isi: catatan ?? null,
      link: "/pengajuan",
    });

    await db.insert(auditLogs).values({
      actorId: pengguna.userId,
      aksi: setuju ? "SETUJUI_PENGAJUAN" : "TOLAK_PENGAJUAN",
      entitas: "requests",
      entitasId: pengajuan.id,
      before: { status: "PENDING", step: pengajuan.currentStep },
      after: {
        status: setuju ? (langkahTerakhir ? "APPROVED" : "PENDING") : "REJECTED",
        catatan: catatan ?? null,
      },
      ip: info.ip,
      userAgent: info.userAgent,
    });

    berhasil++;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/persetujuan");
  revalidatePath("/pengajuan");

  if (berhasil === 0) {
    return {
      ok: false,
      pesan:
        ditolakSendiri > 0
          ? "Pengajuan sendiri tidak bisa Anda setujui — mintakan ke penyetuju lain."
          : ditolakTerkunci > 0
            ? "Tanggalnya berada di periode rekap yang sudah dikunci, jadi absensinya tidak bisa diubah lagi."
            : ditolakWewenang > 0
              ? "Anda tidak berwenang memutuskan pengajuan ini."
              : "Tidak ada pengajuan yang bisa diproses.",
    };
  }

  const tambahan = [
    ditolakWewenang > 0
      ? ` ${ditolakWewenang} dilewati karena di luar wewenang Anda.`
      : "",
    ditolakTerkunci > 0
      ? ` ${ditolakTerkunci} dilewati karena periodenya sudah dikunci.`
      : "",
    ditolakSendiri > 0
      ? ` ${ditolakSendiri} dilewati karena pengajuan Anda sendiri.`
      : "",
  ].join("");

  return {
    ok: true,
    jumlah: berhasil,
    pesan: `${berhasil} pengajuan ${setuju ? "disetujui" : "ditolak"}.${tambahan}`,
  };
}

export async function aksiSetujui(
  ids: string[],
  catatan?: string,
): Promise<HasilKeputusan> {
  const pengguna = await wajibPeran(...PERAN_PENYETUJU);
  const parsed = skema.safeParse({ ids, catatan });
  if (!parsed.success) return { ok: false, pesan: "Data pengajuan tidak valid." };
  return putuskan(pengguna, parsed.data.ids, true, parsed.data.catatan);
}

export async function aksiTolak(ids: string[], catatan: string): Promise<HasilKeputusan> {
  const pengguna = await wajibPeran(...PERAN_PENYETUJU);
  const parsed = skema.safeParse({ ids, catatan });
  if (!parsed.success) return { ok: false, pesan: "Data pengajuan tidak valid." };

  // Penolakan wajib beralasan supaya karyawan tahu apa yang harus diperbaiki.
  if (!parsed.data.catatan || parsed.data.catatan.length < 5) {
    return { ok: false, pesan: "Alasan penolakan wajib diisi, minimal 5 karakter." };
  }
  return putuskan(pengguna, parsed.data.ids, false, parsed.data.catatan);
}

/** Statistik ringkas untuk kepala halaman persetujuan. */
export async function ringkasanAntrean() {
  const db = await getDb();
  const hariIni = tanggalWIB();
  const [row] = await db
    .select({
      menunggu: sql<number>`count(*) filter (where ${requests.status} = 'PENDING')`,
      hariIni: sql<number>`count(*) filter (where ${requests.status} = 'PENDING' and ${requests.createdAt}::date = ${hariIni}::date)`,
    })
    .from(requests);
  return {
    menunggu: Number(row?.menunggu ?? 0),
    hariIni: Number(row?.hariIni ?? 0),
  };
}
