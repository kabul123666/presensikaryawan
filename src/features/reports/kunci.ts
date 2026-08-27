import "server-only";

import { and, desc, eq, gte, lte } from "drizzle-orm";

import { getDb } from "@/db/client";
import { periodLocks, users } from "@/db/schema";
import { rekapPeriode, type BarisRekap, type FilterRekap } from "./service";

/**
 * Kunci periode rekap.
 *
 * Rekap dihitung ulang setiap kali dibuka, termasuk alpanya. Selama periodenya
 * masih berjalan itu justru yang benar — koreksi absen yang disetujui hari ini
 * langsung terlihat. Tetapi begitu angkanya dipakai membayar orang, sifat itu
 * berbalik jadi bahaya: menambah hari libur atau mengubah shift bulan lalu
 * diam-diam menggeser rekap yang sudah dicetak dan ditandatangani.
 *
 * Mengunci periode membekukan hasilnya. Sejak saat itu rekap periode tersebut
 * dibaca dari salinan, bukan dihitung ulang, dan absensi di dalam rentangnya
 * tidak bisa lagi diubah lewat koreksi maupun persetujuan.
 */

export type KunciPeriode = {
  id: string;
  mulai: string;
  akhir: string;
  dikunciAt: Date;
  olehNama: string | null;
  catatan: string | null;
};

/** Kunci untuk sebuah rentang persis, bila ada. */
export async function kunciPeriode(
  mulai: string,
  akhir: string,
): Promise<KunciPeriode | null> {
  const db = await getDb();
  const [baris] = await db
    .select({
      id: periodLocks.id,
      mulai: periodLocks.mulai,
      akhir: periodLocks.akhir,
      dikunciAt: periodLocks.dikunciAt,
      olehNama: users.username,
      catatan: periodLocks.catatan,
    })
    .from(periodLocks)
    .leftJoin(users, eq(users.id, periodLocks.dikunciOleh))
    .where(and(eq(periodLocks.mulai, mulai), eq(periodLocks.akhir, akhir)))
    .limit(1);

  return baris ?? null;
}

/** Salinan rekap yang dibekukan saat periode dikunci. */
export async function rekapTerkunci(mulai: string, akhir: string) {
  const db = await getDb();
  const [baris] = await db
    .select({ rekap: periodLocks.rekap })
    .from(periodLocks)
    .where(and(eq(periodLocks.mulai, mulai), eq(periodLocks.akhir, akhir)))
    .limit(1);

  return (baris?.rekap ?? null) as BarisRekap[] | null;
}

/**
 * Apakah sebuah tanggal jatuh di dalam periode yang sudah dikunci.
 *
 * Dipakai sebagai penjaga sebelum menulis ulang absensi lama — baik lewat
 * pengajuan koreksi maupun lewat persetujuan cuti yang menandai hari-hari
 * lampau. Pemeriksaannya di server, bukan sekadar menyembunyikan tombol.
 */
export async function tanggalTerkunci(tanggal: string): Promise<KunciPeriode | null> {
  const db = await getDb();
  const [baris] = await db
    .select({
      id: periodLocks.id,
      mulai: periodLocks.mulai,
      akhir: periodLocks.akhir,
      dikunciAt: periodLocks.dikunciAt,
      olehNama: users.username,
      catatan: periodLocks.catatan,
    })
    .from(periodLocks)
    .leftJoin(users, eq(users.id, periodLocks.dikunciOleh))
    .where(and(lte(periodLocks.mulai, tanggal), gte(periodLocks.akhir, tanggal)))
    .orderBy(desc(periodLocks.dikunciAt))
    .limit(1);

  return baris ?? null;
}

/** Daftar periode terkunci, terbaru lebih dulu. */
export async function daftarKunci(batas = 24) {
  const db = await getDb();
  return db
    .select({
      id: periodLocks.id,
      mulai: periodLocks.mulai,
      akhir: periodLocks.akhir,
      dikunciAt: periodLocks.dikunciAt,
      olehNama: users.username,
      catatan: periodLocks.catatan,
    })
    .from(periodLocks)
    .leftJoin(users, eq(users.id, periodLocks.dikunciOleh))
    .orderBy(desc(periodLocks.mulai))
    .limit(batas);
}

/**
 * Rekap sebuah periode, memakai salinan beku bila periodenya sudah dikunci.
 *
 * Satu pintu untuk layar, halaman rincian, dan berkas unduhan. Kalau masing-
 * masing memutuskan sendiri kapan memakai salinan, periode yang sama bisa
 * tampil dengan dua angka berbeda tergantung lewat mana orang membukanya.
 *
 * Salinannya selalu berisi seluruh karyawan; penyaring departemen diterapkan
 * di sini supaya angka yang dibekukan tidak pernah bergantung pada siapa yang
 * kebetulan menekan tombol kunci.
 */
export async function rekapPeriodeAtauKunci(filter: FilterRekap) {
  const beku = await rekapTerkunci(filter.mulai, filter.akhir);
  if (!beku) return { baris: await rekapPeriode(filter), terkunci: false };

  // Salinan yang dibekukan sebelum kolom izin ada tidak memuatnya sama sekali;
  // dibaca sebagai nol supaya rekap lama tetap terbuka tanpa angka kosong.
  const baris = beku
    .filter(
      (b) =>
        (!filter.departmentId || b.departmentId === filter.departmentId) &&
        (!filter.employeeId || b.employeeId === filter.employeeId),
    )
    .map((b) => ({ ...b, izin: b.izin ?? 0 }));

  return { baris, terkunci: true };
}
