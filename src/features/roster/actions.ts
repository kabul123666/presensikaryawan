"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import { auditLogs, shiftSchedules } from "@/db/schema";
import { nilaiUlangAbsensiTanpaShift } from "@/features/attendance/nilai-ulang";
import { PERAN_ADMIN, wajibPeran } from "@/lib/auth/session";
import { batasBulan, geserTanggal, selisihHari } from "@/lib/waktu";

export type HasilRoster = { ok: boolean; pesan: string };

const skemaSel = z.object({
  employeeId: z.string().uuid(),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  /** Kosong = hapus jadwal khusus, kembali ke shift default karyawan. */
  shiftId: z.string().uuid().nullable(),
  libur: z.boolean(),
});

async function catat(
  actorId: string,
  aksi: string,
  entitasId: string,
  after: Record<string, unknown>,
) {
  const db = await getDb();
  const h = await headers();
  await db.insert(auditLogs).values({
    actorId,
    aksi,
    entitas: "shift_schedules",
    entitasId,
    after,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  });
}

/** Jadwal berubah berarti penilaian absensi bisa ikut berubah. */
function segarkanAbsensi() {
  revalidatePath("/admin/jadwal");
  revalidatePath("/admin/absensi", "layout");
  revalidatePath("/riwayat");
}

/**
 * Menetapkan satu sel roster.
 *
 * Menghapus baris (bukan menyimpan null) ketika admin mengosongkan sel, agar
 * tanggal itu kembali memakai shift default karyawan alih-alih tercatat
 * sebagai "tanpa shift".
 */
export async function aksiSetJadwal(
  employeeId: string,
  tanggal: string,
  shiftId: string | null,
  libur: boolean,
): Promise<HasilRoster> {
  // Perubahan per sel tidak dicatat ke audit log: satu penyusunan roster bisa
  // ratusan klik dan akan menenggelamkan catatan yang benar-benar penting.
  // Aksi massal (isi sebaris, salin bulan) tetap dicatat.
  await wajibPeran(...PERAN_ADMIN);
  const parsed = skemaSel.safeParse({ employeeId, tanggal, shiftId, libur });
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  const db = await getDb();
  const d = parsed.data;

  if (!d.libur && !d.shiftId) {
    await db
      .delete(shiftSchedules)
      .where(
        and(
          eq(shiftSchedules.employeeId, d.employeeId),
          eq(shiftSchedules.tanggal, d.tanggal),
        ),
      );
  } else {
    await db
      .insert(shiftSchedules)
      .values({
        employeeId: d.employeeId,
        tanggal: d.tanggal,
        shiftId: d.libur ? null : d.shiftId,
        libur: d.libur,
      })
      .onConflictDoUpdate({
        target: [shiftSchedules.employeeId, shiftSchedules.tanggal],
        set: { shiftId: d.libur ? null : d.shiftId, libur: d.libur },
      });
  }

  // Absen yang terlanjur tercatat tanpa shift pada tanggal ini ikut dinilai.
  await nilaiUlangAbsensiTanpaShift({
    employeeId: d.employeeId,
    mulai: d.tanggal,
    akhir: d.tanggal,
  });

  segarkanAbsensi();
  return { ok: true, pesan: "Jadwal disimpan." };
}

/** Mengisi satu baris penuh dengan shift yang sama (kecuali yang sudah libur). */
export async function aksiIsiSebaris(
  employeeId: string,
  tahun: number,
  bulan: number,
  shiftId: string,
): Promise<HasilRoster> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const db = await getDb();
  const { mulai, akhir } = batasBulan(tahun, bulan);

  const jumlahHari = selisihHari(mulai, akhir) + 1;
  for (let i = 0; i < jumlahHari; i++) {
    const tanggal = geserTanggal(mulai, i);
    await db
      .insert(shiftSchedules)
      .values({ employeeId, tanggal, shiftId, libur: false })
      .onConflictDoUpdate({
        target: [shiftSchedules.employeeId, shiftSchedules.tanggal],
        set: { shiftId, libur: false },
      });
  }

  await catat(pengguna.userId, "ISI_ROSTER_SEBARIS", employeeId, {
    tahun,
    bulan,
    shiftId,
  });
  await nilaiUlangAbsensiTanpaShift({ employeeId, mulai, akhir });
  segarkanAbsensi();
  return { ok: true, pesan: `Satu bulan penuh diisi untuk karyawan ini.` };
}

/** Mengosongkan seluruh jadwal khusus seorang karyawan pada bulan berjalan. */
export async function aksiKosongkanSebaris(
  employeeId: string,
  tahun: number,
  bulan: number,
): Promise<HasilRoster> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const db = await getDb();
  const { mulai, akhir } = batasBulan(tahun, bulan);

  await db
    .delete(shiftSchedules)
    .where(
      and(
        eq(shiftSchedules.employeeId, employeeId),
        gte(shiftSchedules.tanggal, mulai),
        lte(shiftSchedules.tanggal, akhir),
      ),
    );

  await catat(pengguna.userId, "KOSONGKAN_ROSTER", employeeId, { tahun, bulan });
  // Tanpa jadwal khusus, shift default karyawan yang berlaku.
  await nilaiUlangAbsensiTanpaShift({ employeeId, mulai, akhir });
  segarkanAbsensi();
  return { ok: true, pesan: "Jadwal bulan ini dikosongkan." };
}

/**
 * Menyalin roster bulan sebelumnya.
 *
 * Disalin per posisi hari dalam pekan, bukan per tanggal — supaya pola
 * "Senin pagi, Selasa siang" tetap jatuh di hari yang sama meski jumlah hari
 * tiap bulan berbeda.
 */
export async function aksiSalinBulanLalu(
  tahun: number,
  bulan: number,
): Promise<HasilRoster> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const db = await getDb();

  const bulanLalu = bulan === 1 ? 12 : bulan - 1;
  const tahunLalu = bulan === 1 ? tahun - 1 : tahun;

  const sumber = batasBulan(tahunLalu, bulanLalu);
  const tujuan = batasBulan(tahun, bulan);

  const lama = await db
    .select()
    .from(shiftSchedules)
    .where(
      and(
        gte(shiftSchedules.tanggal, sumber.mulai),
        lte(shiftSchedules.tanggal, sumber.akhir),
      ),
    );

  if (lama.length === 0) {
    return { ok: false, pesan: "Bulan sebelumnya belum punya jadwal untuk disalin." };
  }

  const hariTujuan = selisihHari(tujuan.mulai, tujuan.akhir) + 1;
  let tersalin = 0;

  for (const baris of lama) {
    const selisih = selisihHari(sumber.mulai, baris.tanggal);
    if (selisih >= hariTujuan) continue; // bulan tujuan lebih pendek

    const tanggalBaru = geserTanggal(tujuan.mulai, selisih);
    await db
      .insert(shiftSchedules)
      .values({
        employeeId: baris.employeeId,
        tanggal: tanggalBaru,
        shiftId: baris.shiftId,
        libur: baris.libur,
      })
      .onConflictDoUpdate({
        target: [shiftSchedules.employeeId, shiftSchedules.tanggal],
        set: { shiftId: baris.shiftId, libur: baris.libur },
      });
    tersalin++;
  }

  await catat(pengguna.userId, "SALIN_ROSTER", `${tahun}-${bulan}`, {
    dari: `${tahunLalu}-${bulanLalu}`,
    tersalin,
  });
  await nilaiUlangAbsensiTanpaShift({ mulai: tujuan.mulai, akhir: tujuan.akhir });
  segarkanAbsensi();
  return { ok: true, pesan: `${tersalin} jadwal disalin dari bulan sebelumnya.` };
}
