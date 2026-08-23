import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  notInArray,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  attendances,
  departments,
  employees,
  holidays,
  positions,
  shiftSchedules,
  shifts,
  users,
  workLogItems,
} from "@/db/schema";
import { bacaPengaturan } from "@/features/settings/service";
import { PERAN_TANPA_ABSEN } from "@/lib/auth/session";
import {
  geserTanggal,
  hariPekanWIB,
  periodeRekap,
  rentangTanggal,
  selisihHari,
  tanggalWIB,
} from "@/lib/waktu";

/**
 * Periode dibawa sebagai rentang tanggal, bukan pasangan tahun-bulan.
 *
 * Siklus potong gaji klinik tidak selalu jatuh tanggal satu, jadi periode
 * "Agustus" bisa saja berjalan 26 Juli sampai 25 Agustus. Rentangnya disusun
 * pemanggil lewat `periodeRekap`, dan berkas ini tidak perlu tahu tanggal
 * berapa siklusnya dimulai.
 */
export type FilterRekap = {
  mulai: string;
  akhir: string;
  departmentId?: string;
  employeeId?: string;
  /** Batas cabang milik pemilik klinik; kosong berarti seluruh jaringan. */
  locationIds?: string[];
};

export type BarisRekap = {
  employeeId: string;
  nama: string;
  nik: string | null;
  jabatan: string | null;
  departemen: string | null;
  departmentId: string | null;
  hadir: number;
  tepatWaktu: number;
  terlambat: number;
  menitTerlambat: number;
  pulangCepat: number;
  lembur: number;
  menitLembur: number;
  cuti: number;
  alpa: number;
  belumLengkap: number;
  menitKerja: number;
  totalFee: number;
};

function syaratPeriode(filter: FilterRekap) {
  const { mulai, akhir } = filter;
  const syarat: SQL[] = [
    gte(attendances.tanggal, mulai),
    lte(attendances.tanggal, akhir),
  ];
  if (filter.departmentId) syarat.push(eq(employees.departmentId, filter.departmentId));
  if (filter.employeeId) syarat.push(eq(attendances.employeeId, filter.employeeId));
  if (filter.locationIds?.length) {
    syarat.push(inArray(employees.locationId, filter.locationIds));
  }
  return { syarat, mulai, akhir };
}

/**
 * Rentang tanggal periode rekap menurut kebijakan siklus yang berlaku.
 *
 * Dipakai layar rekap, halaman rincian, dan berkas unduhan — ketiganya harus
 * memotong periode di tanggal yang sama, kalau tidak angka di layar dan di
 * berkas bisa berbeda tanpa ada yang menyadarinya.
 */
export async function rentangPeriode(tahun: number, bulan: number) {
  const kebijakan = await bacaPengaturan("kebijakan_absensi");
  return periodeRekap(tahun, bulan, kebijakan.hariMulaiPeriode);
}

/**
 * Rekap kehadiran per karyawan untuk satu periode.
 *
 * Seluruh agregasi dikerjakan database, bukan di JavaScript — supaya rekap
 * ratusan karyawan tetap satu kueri dan angkanya konsisten dengan detailnya.
 */
export async function rekapPeriode(filter: FilterRekap): Promise<BarisRekap[]> {
  const db = await getDb();
  const { syarat } = syaratPeriode(filter);

  const baris = await db
    .select({
      employeeId: employees.id,
      nama: employees.nama,
      nik: users.nik,
      jabatan: positions.nama,
      departemen: departments.nama,
      departmentId: employees.departmentId,
      hadir: sql<number>`count(*) filter (where ${attendances.clockInAt} is not null)`,
      tepatWaktu: sql<number>`count(*) filter (where ${attendances.status} = 'ON_TIME')`,
      terlambat: sql<number>`count(*) filter (where ${attendances.menitTerlambat} > 0)`,
      menitTerlambat: sql<number>`coalesce(sum(${attendances.menitTerlambat}), 0)`,
      pulangCepat: sql<number>`count(*) filter (where ${attendances.status} = 'EARLY_LEAVE')`,
      lembur: sql<number>`count(*) filter (where ${attendances.menitLembur} > 0)`,
      menitLembur: sql<number>`coalesce(sum(${attendances.menitLembur}), 0)`,
      cuti: sql<number>`count(*) filter (where ${attendances.status} = 'ON_LEAVE')`,
      alpa: sql<number>`count(*) filter (where ${attendances.status} = 'ABSENT')`,
      belumLengkap: sql<number>`count(*) filter (where ${attendances.clockInAt} is not null and ${attendances.clockOutAt} is null)`,
      menitKerja: sql<number>`coalesce(sum(${attendances.durasiKerjaMenit}), 0)`,
    })
    .from(attendances)
    .innerJoin(employees, eq(employees.id, attendances.employeeId))
    .innerJoin(users, eq(users.id, employees.userId))
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .where(and(...syarat))
    .groupBy(
      employees.id,
      employees.nama,
      users.nik,
      positions.nama,
      departments.nama,
      employees.departmentId,
    )
    .orderBy(asc(employees.nama));

  // Fee dihitung terpisah supaya jumlah baris absensi tidak terganda oleh
  // banyaknya tindakan pada satu hari.
  const fee = await db
    .select({
      employeeId: attendances.employeeId,
      total: sql<number>`coalesce(sum(${workLogItems.feeSnapshot} * ${workLogItems.jumlah}), 0)`,
    })
    .from(workLogItems)
    .innerJoin(attendances, eq(attendances.id, workLogItems.attendanceId))
    .innerJoin(employees, eq(employees.id, attendances.employeeId))
    .where(and(...syarat))
    .groupBy(attendances.employeeId);

  const petaFee = new Map(fee.map((f) => [f.employeeId, Number(f.total)]));

  // Alpa tidak pernah tersimpan sebagai baris absensi, jadi dihitung di sini.
  const petaAlpa = await hitungAlpa(filter);

  const hasil: BarisRekap[] = baris.map((b) => ({
    employeeId: b.employeeId,
    nama: b.nama,
    nik: b.nik,
    jabatan: b.jabatan,
    departemen: b.departemen,
    departmentId: b.departmentId,
    hadir: Number(b.hadir),
    tepatWaktu: Number(b.tepatWaktu),
    terlambat: Number(b.terlambat),
    menitTerlambat: Number(b.menitTerlambat),
    pulangCepat: Number(b.pulangCepat),
    lembur: Number(b.lembur),
    menitLembur: Number(b.menitLembur),
    cuti: Number(b.cuti),
    alpa: Number(b.alpa) + (petaAlpa[b.employeeId] ?? 0),
    belumLengkap: Number(b.belumLengkap),
    menitKerja: Number(b.menitKerja),
    totalFee: petaFee.get(b.employeeId) ?? 0,
  }));

  // Karyawan yang sebulan penuh tidak pernah absen tidak punya baris absensi
  // sama sekali, sehingga tidak ikut terbawa kueri di atas. Mereka justru yang
  // paling perlu terlihat di rekap — jadi ditambahkan di sini dengan alpanya.
  const sudahAda = new Set(hasil.map((h) => h.employeeId));
  const tertinggal = Object.keys(petaAlpa).filter((id) => !sudahAda.has(id));

  if (tertinggal.length > 0) {
    const tambahan = await db
      .select({
        employeeId: employees.id,
        nama: employees.nama,
        nik: users.nik,
        jabatan: positions.nama,
        departemen: departments.nama,
        departmentId: employees.departmentId,
      })
      .from(employees)
      .innerJoin(users, eq(users.id, employees.userId))
      .leftJoin(positions, eq(positions.id, employees.positionId))
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .where(inArray(employees.id, tertinggal));

    for (const t of tambahan) {
      hasil.push({
        ...t,
        hadir: 0,
        tepatWaktu: 0,
        terlambat: 0,
        menitTerlambat: 0,
        pulangCepat: 0,
        lembur: 0,
        menitLembur: 0,
        cuti: 0,
        alpa: petaAlpa[t.employeeId] ?? 0,
        belumLengkap: 0,
        menitKerja: 0,
        totalFee: 0,
      });
    }

    hasil.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  }

  return hasil;
}

/** Detail harian seorang karyawan pada satu periode (drill-down). */
export async function detailHarian(filter: FilterRekap & { employeeId: string }) {
  const db = await getDb();
  const { syarat } = syaratPeriode(filter);

  return db
    .select({
      id: attendances.id,
      tanggal: attendances.tanggal,
      status: attendances.status,
      shift: shifts.nama,
      clockInAt: attendances.clockInAt,
      clockOutAt: attendances.clockOutAt,
      clockInPhoto: attendances.clockInPhoto,
      clockOutPhoto: attendances.clockOutPhoto,
      clockInAddress: attendances.clockInAddress,
      clockInDistanceM: attendances.clockInDistanceM,
      clockInOutsideArea: attendances.clockInOutsideArea,
      menitTerlambat: attendances.menitTerlambat,
      menitLembur: attendances.menitLembur,
      durasiKerjaMenit: attendances.durasiKerjaMenit,
      catatanKerja: attendances.catatanKerja,
      flags: attendances.flags,
      hasilKoreksi: attendances.hasilKoreksi,
    })
    .from(attendances)
    .innerJoin(employees, eq(employees.id, attendances.employeeId))
    .leftJoin(shifts, eq(shifts.id, attendances.shiftId))
    .where(and(...syarat))
    .orderBy(desc(attendances.tanggal));
}

/**
 * Rincian tindakan ber-fee sepanjang periode.
 *
 * Angka fee di rekap hanya satu jumlah per orang; tanpa rinciannya, bagian
 * keuangan tidak punya cara memeriksa dari mana jumlah itu datang selain
 * membuka layar satu per satu. Nominalnya diambil dari `feeSnapshot` — tarif
 * yang berlaku saat tindakan dicatat — bukan dari tarif master hari ini.
 */
export async function rincianFeePeriode(filter: FilterRekap) {
  const db = await getDb();
  const { syarat } = syaratPeriode(filter);

  return db
    .select({
      tanggal: attendances.tanggal,
      employeeId: employees.id,
      nama: employees.nama,
      nik: users.nik,
      tindakan: workLogItems.namaTindakan,
      kodePasien: workLogItems.kodePasien,
      jumlah: workLogItems.jumlah,
      fee: workLogItems.feeSnapshot,
      status: workLogItems.status,
    })
    .from(workLogItems)
    .innerJoin(attendances, eq(attendances.id, workLogItems.attendanceId))
    .innerJoin(employees, eq(employees.id, attendances.employeeId))
    .innerJoin(users, eq(users.id, employees.userId))
    .where(and(...syarat))
    .orderBy(asc(employees.nama), asc(attendances.tanggal));
}

/** Total keseluruhan untuk baris ringkasan di bawah tabel. */
export function totalRekap(baris: BarisRekap[]) {
  return baris.reduce(
    (t, b) => ({
      hadir: t.hadir + b.hadir,
      terlambat: t.terlambat + b.terlambat,
      menitTerlambat: t.menitTerlambat + b.menitTerlambat,
      menitLembur: t.menitLembur + b.menitLembur,
      cuti: t.cuti + b.cuti,
      alpa: t.alpa + b.alpa,
      menitKerja: t.menitKerja + b.menitKerja,
      totalFee: t.totalFee + b.totalFee,
    }),
    {
      hadir: 0,
      terlambat: 0,
      menitTerlambat: 0,
      menitLembur: 0,
      cuti: 0,
      alpa: 0,
      menitKerja: 0,
      totalFee: 0,
    },
  );
}

/** Daftar karyawan untuk penyaring. */
export async function opsiPenyaring() {
  const db = await getDb();
  const [dept, kary] = await Promise.all([
    db
      .select({ id: departments.id, nama: departments.nama })
      .from(departments)
      .where(eq(departments.aktif, true))
      .orderBy(asc(departments.nama)),
    db
      .select({ id: employees.id, nama: employees.nama })
      .from(employees)
      .where(and(eq(employees.aktif, true), eq(employees.wajibAbsen, true)))
      .orderBy(asc(employees.nama)),
  ]);
  return { departemen: dept, karyawan: kary };
}

/**
 * Menghitung alpa: hari kerja terjadwal yang lewat tanpa absensi sama sekali.
 *
 * Dihitung saat rekap dibuka, bukan lewat tugas terjadwal tengah malam.
 * Dengan begitu angkanya tetap benar walaupun server sempat mati, dan koreksi
 * absen yang disetujui belakangan langsung mengurangi alpa tanpa perlu
 * menjalankan ulang apa pun.
 */
export async function hitungAlpa(filter: FilterRekap): Promise<Record<string, number>> {
  const db = await getDb();
  const { mulai, akhir } = filter;

  // Alpa hanya dihitung sampai kemarin — hari ini belum tentu selesai.
  const kemarin = geserTanggal(tanggalWIB(), -1);
  const batasAkhir = akhir <= kemarin ? akhir : kemarin;
  if (selisihHari(mulai, batasAkhir) < 0) return {};

  const syaratKaryawan = [
    eq(employees.aktif, true),
    eq(users.status, "ACTIVE"),
    eq(employees.wajibAbsen, true),
  ];
  if (filter.departmentId) {
    syaratKaryawan.push(eq(employees.departmentId, filter.departmentId));
  }
  if (filter.employeeId) syaratKaryawan.push(eq(employees.id, filter.employeeId));
  if (filter.locationIds?.length) {
    syaratKaryawan.push(inArray(employees.locationId, filter.locationIds));
  }

  // Pemilik dan pengelola sistem tidak pernah dihitung alpa — mereka bukan
  // staf terjadwal, dan menagih kehadiran mereka hanya membuat rekap salah.
  syaratKaryawan.push(notInArray(users.role, PERAN_TANPA_ABSEN));

  const [daftarKaryawan, liburNasional, roster, sudahAbsen] = await Promise.all([
    db
      .select({
        id: employees.id,
        tanggalMasuk: employees.tanggalMasuk,
        hariKerja: shifts.hariKerja,
      })
      .from(employees)
      .innerJoin(users, eq(users.id, employees.userId))
      .leftJoin(shifts, eq(shifts.id, employees.shiftId))
      .where(and(...syaratKaryawan)),

    db
      .select({ tanggal: holidays.tanggal })
      .from(holidays)
      .where(and(gte(holidays.tanggal, mulai), lte(holidays.tanggal, batasAkhir))),

    db
      .select({
        employeeId: shiftSchedules.employeeId,
        tanggal: shiftSchedules.tanggal,
        shiftId: shiftSchedules.shiftId,
        libur: shiftSchedules.libur,
      })
      .from(shiftSchedules)
      .where(
        and(gte(shiftSchedules.tanggal, mulai), lte(shiftSchedules.tanggal, batasAkhir)),
      ),

    db
      .select({ employeeId: attendances.employeeId, tanggal: attendances.tanggal })
      .from(attendances)
      .where(and(gte(attendances.tanggal, mulai), lte(attendances.tanggal, batasAkhir))),
  ]);

  const setLibur = new Set(liburNasional.map((h) => h.tanggal));
  const setAbsen = new Set(sudahAbsen.map((a) => `${a.employeeId}|${a.tanggal}`));
  const petaRoster = new Map(
    roster.map((r) => [`${r.employeeId}|${r.tanggal}`, r] as const),
  );

  const hasil: Record<string, number> = {};

  for (const k of daftarKaryawan) {
    let alpa = 0;

    for (const tanggal of rentangTanggal(mulai, batasAkhir)) {
      // Belum bekerja di tanggal itu — bukan alpa.
      if (k.tanggalMasuk && tanggal < k.tanggalMasuk) continue;
      if (setLibur.has(tanggal)) continue;
      if (setAbsen.has(`${k.id}|${tanggal}`)) continue;

      const jadwal = petaRoster.get(`${k.id}|${tanggal}`);
      if (jadwal) {
        // Roster menang atas shift default.
        if (jadwal.libur || !jadwal.shiftId) continue;
      } else {
        // Tanpa roster: ikut hari kerja shift default. Tanpa shift sama
        // sekali, karyawan tidak punya jadwal sehingga tidak bisa alpa.
        if (!k.hariKerja) continue;
        const dow = hariPekanWIB(new Date(`${tanggal}T05:00:00Z`));
        if (!k.hariKerja.includes(dow)) continue;
      }

      alpa++;
    }

    if (alpa > 0) hasil[k.id] = alpa;
  }

  return hasil;
}
