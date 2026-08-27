import "server-only";

import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  attendances,
  employees,
  holidays,
  shiftSchedules,
  shifts,
  workLogItems,
  type AttendanceStatus,
  type Shift,
} from "@/db/schema";
import {
  batasBulan,
  hariPekanWIB,
  jamKeMenit,
  menitHariWIB,
  selisihHari,
  tanggalWIB,
} from "@/lib/waktu";

/**
 * Aturan main absensi. Semua angka (toleransi, ambang lembur, hari kerja)
 * dibaca dari baris shift — tidak ada satu pun yang ditulis di kode.
 */

export type ShiftBerlaku = {
  shift: Shift | null;
  /** Karyawan memang tidak dijadwalkan bekerja hari itu. */
  libur: boolean;
  alasanLibur: string | null;
  /**
   * Nama hari libur nasional bila tanggal itu libur, terlepas dari ada
   * tidaknya shift. Dipakai untuk menandai absensi karyawan tanpa shift —
   * mereka tetap boleh absen, tetapi rekapnya perlu menunjukkan bahwa hari
   * itu hari libur.
   */
  liburNasional: string | null;
};

/**
 * Menentukan shift yang berlaku untuk seorang karyawan pada tanggal tertentu.
 * Urutan prioritas: roster per tanggal → shift default karyawan.
 */
export async function shiftBerlaku(
  employeeId: string,
  tanggal: string,
): Promise<ShiftBerlaku> {
  const db = await getDb();

  const [liburNasional] = await db
    .select({ nama: holidays.nama })
    .from(holidays)
    .where(eq(holidays.tanggal, tanggal))
    .limit(1);

  const [roster] = await db
    .select({ shiftId: shiftSchedules.shiftId, libur: shiftSchedules.libur })
    .from(shiftSchedules)
    .where(
      and(eq(shiftSchedules.employeeId, employeeId), eq(shiftSchedules.tanggal, tanggal)),
    )
    .limit(1);

  const namaLiburNasional = liburNasional?.nama ?? null;

  if (roster?.libur) {
    return {
      shift: null,
      libur: true,
      alasanLibur: "Libur terjadwal",
      liburNasional: namaLiburNasional,
    };
  }

  const shiftId =
    roster?.shiftId ??
    (
      await db
        .select({ shiftId: employees.shiftId })
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1)
    )[0]?.shiftId;

  // Tanpa shift, hari itu tidak pernah dianggap libur: karyawan yang jadwalnya
  // belum ditetapkan justru yang paling sering datang di luar pola hari kerja.
  // Penandaan hari liburnya tetap ikut, agar rekap admin tidak kehilangan
  // konteks.
  if (!shiftId) {
    return {
      shift: null,
      libur: false,
      alasanLibur: null,
      liburNasional: namaLiburNasional,
    };
  }

  const [shift] = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
  if (!shift) {
    return {
      shift: null,
      libur: false,
      alasanLibur: null,
      liburNasional: namaLiburNasional,
    };
  }

  if (liburNasional) {
    return {
      shift,
      libur: true,
      alasanLibur: liburNasional.nama,
      liburNasional: namaLiburNasional,
    };
  }

  const dow = hariPekanWIB(new Date(`${tanggal}T05:00:00Z`));
  if (!shift.hariKerja.includes(dow)) {
    return {
      shift,
      libur: true,
      alasanLibur: "Bukan hari kerja shift ini",
      liburNasional: namaLiburNasional,
    };
  }

  return { shift, libur: false, alasanLibur: null, liburNasional: namaLiburNasional };
}

/** Hasil penilaian saat clock in. */
export function nilaiClockIn(shift: Shift, waktu: Date) {
  const menitSekarang = menitHariWIB(waktu);
  const menitMasuk = jamKeMenit(shift.jamMasuk);

  // Untuk shift lintas hari, absen setelah tengah malam dihitung sebagai
  // kelanjutan hari sebelumnya sehingga tidak terbaca terlambat 20 jam.
  const geser =
    shift.lintasHari && menitSekarang < jamKeMenit(shift.jamPulang) ? 1440 : 0;
  const selisih = menitSekarang + geser - menitMasuk;

  const terlambat = Math.max(0, selisih - shift.toleransiMenit);
  const status: AttendanceStatus = terlambat > 0 ? "LATE" : "ON_TIME";

  return {
    status,
    menitTerlambat: terlambat > 0 ? selisih : 0,
    terlaluDini: selisih < -shift.batasClockinDiniMenit,
    menitTerlaluDini: Math.max(0, -selisih - shift.batasClockinDiniMenit),
  };
}

/**
 * Penilaian clock out untuk karyawan yang hari itu tidak punya shift.
 *
 * Tanpa jam pulang tidak ada yang bisa disebut "pulang cepat" atau "lembur" —
 * keduanya hanya bermakna relatif terhadap jadwal. Yang tersisa dan tetap
 * benar adalah lama ia berada di tempat kerja, jadi itu saja yang dicatat.
 * Istirahat pun tidak dipotong karena durasinya ditentukan per shift.
 */
export function nilaiClockOutTanpaShift(clockInAt: Date, waktu: Date) {
  const durasiKerjaMenit = Math.max(
    0,
    Math.round((waktu.getTime() - clockInAt.getTime()) / 60000),
  );

  return {
    status: "ON_TIME" as AttendanceStatus,
    menitLembur: 0,
    durasiKerjaMenit,
    pulangCepat: false,
  };
}

/** Hasil penilaian saat clock out. */
export function nilaiClockOut(
  shift: Shift,
  clockInAt: Date,
  waktu: Date,
  statusMasuk: AttendanceStatus,
) {
  const menitSekarang = menitHariWIB(waktu);
  const menitMasuk = jamKeMenit(shift.jamMasuk);
  const menitPulang = jamKeMenit(shift.jamPulang);

  /*
   * Shift malam berakhir di tanggal berikutnya, jadi jam pulangnya digeser
   * satu hari penuh dan jam sekarang ikut digeser bila sudah lewat tengah
   * malam. Tanpa itu, pulang jam 06.10 dari shift 22.00–06.00 terbaca pulang
   * cepat lima jam, sementara pulang jam 22.30 di malam yang sama terbaca
   * lembur enam belas jam.
   */
  const akhirShift = shift.lintasHari ? menitPulang + 1440 : menitPulang;
  const sekarangRelatif =
    shift.lintasHari && menitSekarang < menitMasuk ? menitSekarang + 1440 : menitSekarang;
  const selisih = sekarangRelatif - akhirShift;

  const durasiKotor = Math.round((waktu.getTime() - clockInAt.getTime()) / 60000);
  const durasiKerjaMenit = Math.max(0, durasiKotor - shift.istirahatMenit);

  const menitLembur = selisih > shift.ambangLemburMenit ? selisih : 0;
  const pulangCepat = selisih < -1;

  let status: AttendanceStatus = statusMasuk;
  if (menitLembur > 0) status = "OVERTIME";
  else if (pulangCepat) status = "EARLY_LEAVE";

  return { status, menitLembur, durasiKerjaMenit, pulangCepat };
}

/**
 * Apakah sebuah sesi yang belum ditutup masih boleh dianggap berjalan hari ini.
 *
 * Hanya shift malam yang jam pulangnya memang jatuh di tanggal berikutnya.
 * Batasnya jam pulang shift itu ditambah ambang lemburnya — keduanya angka
 * milik shift, bukan angka yang ditulis di sini.
 */
async function sesiMalamMasihBerjalan(
  baris: { tanggal: string; shiftId: string | null },
  sekarang: Date,
): Promise<boolean> {
  if (!baris.shiftId) return false;
  if (selisihHari(baris.tanggal, tanggalWIB(sekarang)) !== 1) return false;

  const db = await getDb();
  const [shift] = await db
    .select()
    .from(shifts)
    .where(eq(shifts.id, baris.shiftId))
    .limit(1);
  if (!shift?.lintasHari) return false;

  return menitHariWIB(sekarang) <= jamKeMenit(shift.jamPulang) + shift.ambangLemburMenit;
}

/**
 * Baris absensi yang sedang berjalan untuk seorang karyawan.
 *
 * Sesi yang lupa ditutup tidak ikut terbawa ke hari berikutnya. Sebelumnya
 * baris terbuka mana pun dianggap sesi berjalan, jadi orang yang kemarin lupa
 * clock out membuka aplikasi pagi ini dan masih disodori tombol pulang —
 * kehadirannya hari ini tidak bisa dicatat sama sekali, dan begitu ia menekan
 * tombol itu jam kerjanya jadi hitungan dua hari.
 *
 * Yang tersisa terbuka tetap dibiarkan apa adanya, tidak ditutup diam-diam:
 * jamnya tidak diketahui siapa pun, dan menebaknya berarti mengarang jam kerja
 * yang ikut terbawa ke penggajian. Barisnya sudah masuk antrean Tinjau Anomali
 * admin, dan karyawannya bisa membetulkan lewat Presensi Backdate.
 *
 * Perkecualiannya hanya shift malam, yang jam pulangnya di tanggal berikutnya
 * memang bagian dari sesi yang sama.
 */
export async function absensiAktif(employeeId: string) {
  const db = await getDb();
  const sekarang = new Date();
  const hariIni = tanggalWIB(sekarang);

  const [terbuka] = await db
    .select()
    .from(attendances)
    .where(and(eq(attendances.employeeId, employeeId), isNull(attendances.clockOutAt)))
    .orderBy(desc(attendances.tanggal))
    .limit(1);

  if (terbuka) {
    if (terbuka.tanggal === hariIni) return terbuka;
    if (await sesiMalamMasihBerjalan(terbuka, sekarang)) return terbuka;
  }

  const [hari] = await db
    .select()
    .from(attendances)
    .where(and(eq(attendances.employeeId, employeeId), eq(attendances.tanggal, hariIni)))
    .limit(1);

  return hari ?? null;
}

/** Ringkasan angka untuk kartu di beranda karyawan. */
export async function ringkasanBulan(employeeId: string, tahun: number, bulan: number) {
  const db = await getDb();
  const { mulai, akhir } = batasBulan(tahun, bulan);

  const [agregat] = await db
    .select({
      hadir: sql<number>`count(*) filter (where ${attendances.clockInAt} is not null)`,
      terlambat: sql<number>`count(*) filter (where ${attendances.menitTerlambat} > 0)`,
      totalMenitTerlambat: sql<number>`coalesce(sum(${attendances.menitTerlambat}), 0)`,
      totalMenitLembur: sql<number>`coalesce(sum(${attendances.menitLembur}), 0)`,
      totalMenitKerja: sql<number>`coalesce(sum(${attendances.durasiKerjaMenit}), 0)`,
    })
    .from(attendances)
    .where(
      and(
        eq(attendances.employeeId, employeeId),
        gte(attendances.tanggal, mulai),
        lte(attendances.tanggal, akhir),
      ),
    );

  const [fee] = await db
    .select({
      jumlahTindakan: sql<number>`coalesce(sum(${workLogItems.jumlah}), 0)`,
      totalFee: sql<number>`coalesce(sum(${workLogItems.feeSnapshot} * ${workLogItems.jumlah}), 0)`,
      terverifikasi: sql<number>`coalesce(sum(case when ${workLogItems.status} = 'VERIFIED' then ${workLogItems.feeSnapshot} * ${workLogItems.jumlah} else 0 end), 0)`,
    })
    .from(workLogItems)
    .innerJoin(attendances, eq(attendances.id, workLogItems.attendanceId))
    .where(
      and(
        eq(attendances.employeeId, employeeId),
        gte(attendances.tanggal, mulai),
        lte(attendances.tanggal, akhir),
      ),
    );

  return {
    hadir: Number(agregat?.hadir ?? 0),
    terlambat: Number(agregat?.terlambat ?? 0),
    totalMenitTerlambat: Number(agregat?.totalMenitTerlambat ?? 0),
    totalMenitLembur: Number(agregat?.totalMenitLembur ?? 0),
    totalMenitKerja: Number(agregat?.totalMenitKerja ?? 0),
    jumlahTindakan: Number(fee?.jumlahTindakan ?? 0),
    totalFee: Number(fee?.totalFee ?? 0),
    feeTerverifikasi: Number(fee?.terverifikasi ?? 0),
  };
}

/** Riwayat absensi satu bulan untuk kalender & daftar. */
export async function riwayatBulan(employeeId: string, tahun: number, bulan: number) {
  const db = await getDb();
  const { mulai, akhir } = batasBulan(tahun, bulan);

  return db
    .select()
    .from(attendances)
    .where(
      and(
        eq(attendances.employeeId, employeeId),
        gte(attendances.tanggal, mulai),
        lte(attendances.tanggal, akhir),
      ),
    )
    .orderBy(desc(attendances.tanggal));
}
