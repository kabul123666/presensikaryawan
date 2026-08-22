import "server-only";

import { and, asc, desc, eq, ilike, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  approvalRuleActors,
  approvalRules,
  auditLogs,
  departments,
  employees,
  holidays,
  leaveBalances,
  leaveEncashments,
  leaveTypes,
  locations,
  settings,
  users,
  yearEndClosings,
} from "@/db/schema";

/* ==========================================================================
 * Pengaturan key-value
 * ========================================================================== */

export type ProfilPerusahaan = {
  nama: string;
  alamat: string;
  telepon: string;
  email: string;
};

export type KebijakanAbsensi = {
  batasBackdateHari: number;
  /**
   * Tanggal mulai periode rekap, 1–28.
   *
   * Satu berarti periode mengikuti bulan kalender. Dua puluh enam berarti
   * periode "Agustus" berjalan 26 Juli sampai 25 Agustus — siklus potong gaji
   * klinik jarang jatuh persis di tanggal satu.
   */
  hariMulaiPeriode: number;
  wajibCatatanKerja: boolean;
  minKarakterCatatan: number;
  retensiFotoBulan: number;
  /**
   * Mengizinkan clock in/out oleh karyawan yang tidak punya shift pada hari
   * itu — baik karena shift default belum ditetapkan maupun karena tanggal
   * tersebut kosong di roster. Sebagian staf memang hanya datang bila ada
   * pasien, sehingga jadwalnya tidak bisa ditentukan di muka.
   */
  izinkanAbsenTanpaShift: boolean;
};

export type KebijakanCuti = {
  tarifPencairanPerHari: number;
  sumberTarif: "TETAP" | "GAJI_POKOK";
  pembagiGajiPokok: number;
};

/**
 * Nilai bawaan tiap blok pengaturan. Tipenya ditulis eksplisit supaya
 * pembacanya menerima tipe union yang sebenarnya (mis. sumberTarif bisa
 * "TETAP" maupun "GAJI_POKOK"), bukan hanya nilai yang kebetulan ditulis
 * di sini.
 */
const BAWAAN: {
  profil_perusahaan: ProfilPerusahaan;
  kebijakan_absensi: KebijakanAbsensi;
  kebijakan_cuti: KebijakanCuti;
} = {
  profil_perusahaan: {
    nama: "",
    alamat: "",
    telepon: "",
    email: "",
  },
  kebijakan_absensi: {
    batasBackdateHari: 7,
    hariMulaiPeriode: 1,
    wajibCatatanKerja: true,
    minKarakterCatatan: 10,
    retensiFotoBulan: 24,
    izinkanAbsenTanpaShift: true,
  },
  kebijakan_cuti: {
    tarifPencairanPerHari: 150_000,
    sumberTarif: "TETAP",
    pembagiGajiPokok: 21,
  },
};

/**
 * Membaca sebuah pengaturan. Bila belum pernah disimpan, nilai bawaan
 * dikembalikan — sehingga aplikasi tetap berjalan pada instalasi baru
 * tanpa perlu seed lengkap.
 */
export async function bacaPengaturan<K extends keyof typeof BAWAAN>(
  kunci: K,
): Promise<(typeof BAWAAN)[K]> {
  const db = await getDb();
  const [baris] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, kunci))
    .limit(1);

  if (!baris) return BAWAAN[kunci];
  return { ...BAWAAN[kunci], ...(baris.value as object) } as (typeof BAWAAN)[K];
}

export async function semuaPengaturan() {
  const [profil, absensi, cuti] = await Promise.all([
    bacaPengaturan("profil_perusahaan"),
    bacaPengaturan("kebijakan_absensi"),
    bacaPengaturan("kebijakan_cuti"),
  ]);
  return { profil, absensi, cuti };
}

/* ==========================================================================
 * Jenis cuti & hari libur
 * ========================================================================== */

export async function daftarJenisCuti() {
  const db = await getDb();
  return db.select().from(leaveTypes).orderBy(asc(leaveTypes.nama));
}

export async function daftarHariLibur(tahun: number) {
  const db = await getDb();
  const semua = await db.select().from(holidays).orderBy(asc(holidays.tanggal));
  return semua.filter((h) => h.tanggal.startsWith(String(tahun)));
}

/* ==========================================================================
 * Aturan persetujuan
 * ========================================================================== */

export async function daftarAturanPersetujuan() {
  const db = await getDb();

  const aturan = await db
    .select({
      id: approvalRules.id,
      tipePengajuan: approvalRules.tipePengajuan,
      scope: approvalRules.scope,
      scopeId: approvalRules.scopeId,
      totalStep: approvalRules.totalStep,
      mode: approvalRules.mode,
      aktif: approvalRules.aktif,
    })
    .from(approvalRules)
    .orderBy(asc(approvalRules.tipePengajuan));

  const pelaku = await db
    .select({
      id: approvalRuleActors.id,
      ruleId: approvalRuleActors.ruleId,
      step: approvalRuleActors.step,
      approverUserId: approvalRuleActors.approverUserId,
      approverRole: approvalRuleActors.approverRole,
      nama: employees.nama,
    })
    .from(approvalRuleActors)
    .leftJoin(employees, eq(employees.userId, approvalRuleActors.approverUserId));

  const [dept, lok] = await Promise.all([
    db.select({ id: departments.id, nama: departments.nama }).from(departments),
    db.select({ id: locations.id, nama: locations.nama }).from(locations),
  ]);

  const namaScope = new Map<string, string>([
    ...dept.map((d) => [d.id, d.nama] as const),
    ...lok.map((l) => [l.id, l.nama] as const),
  ]);

  return aturan.map((a) => ({
    ...a,
    namaScope: a.scopeId ? (namaScope.get(a.scopeId) ?? "—") : null,
    pelaku: pelaku.filter((p) => p.ruleId === a.id),
  }));
}

/** Kandidat penyetuju: admin, super admin, dan kepala unit. */
export async function kandidatPenyetuju() {
  const db = await getDb();
  return db
    .select({
      userId: users.id,
      nama: employees.nama,
      role: users.role,
    })
    .from(users)
    .innerJoin(employees, eq(employees.userId, users.id))
    .where(
      and(
        eq(users.status, "ACTIVE"),
        sql`${users.role} in ('SUPER_ADMIN', 'ADMIN', 'MANAGER')`,
      ),
    )
    .orderBy(asc(employees.nama));
}

/* ==========================================================================
 * Tutup tahun cuti
 * ========================================================================== */

export type BarisSisaCuti = {
  employeeId: string;
  nama: string;
  jabatanGaji: number | null;
  kuota: number;
  carryOverMasuk: number;
  terpakai: number;
  pending: number;
  sisa: number;
};

/** Sisa cuti tahunan seluruh karyawan untuk proses tutup tahun. */
export async function sisaCutiTahunan(tahun: number): Promise<BarisSisaCuti[]> {
  const db = await getDb();

  const [jenis] = await db
    .select()
    .from(leaveTypes)
    .where(eq(leaveTypes.nama, "Cuti Tahunan"))
    .limit(1);
  if (!jenis) return [];

  const baris = await db
    .select({
      employeeId: leaveBalances.employeeId,
      nama: employees.nama,
      gajiPokok: employees.gajiPokok,
      kuota: leaveBalances.kuota,
      carryOverMasuk: leaveBalances.carryOverMasuk,
      terpakai: leaveBalances.terpakai,
      pending: leaveBalances.pending,
    })
    .from(leaveBalances)
    .innerJoin(employees, eq(employees.id, leaveBalances.employeeId))
    .where(and(eq(leaveBalances.tahun, tahun), eq(leaveBalances.leaveTypeId, jenis.id)))
    .orderBy(asc(employees.nama));

  return baris.map((b) => ({
    employeeId: b.employeeId,
    nama: b.nama,
    jabatanGaji: b.gajiPokok,
    kuota: b.kuota,
    carryOverMasuk: b.carryOverMasuk,
    terpakai: b.terpakai,
    pending: b.pending,
    sisa: Math.max(0, b.kuota + b.carryOverMasuk - b.terpakai - b.pending),
  }));
}

/** Apakah tutup tahun untuk suatu tahun sudah pernah dijalankan. */
export async function statusTutupTahun(tahun: number) {
  const db = await getDb();
  const [baris] = await db
    .select()
    .from(yearEndClosings)
    .where(eq(yearEndClosings.tahun, tahun))
    .limit(1);
  return baris ?? null;
}

/** Riwayat pencairan cuti. */
export async function daftarPencairan(tahun: number) {
  const db = await getDb();
  return db
    .select({
      id: leaveEncashments.id,
      nama: employees.nama,
      jumlahHari: leaveEncashments.jumlahHari,
      tarifPerHari: leaveEncashments.tarifPerHari,
      totalNominal: leaveEncashments.totalNominal,
      status: leaveEncashments.status,
    })
    .from(leaveEncashments)
    .innerJoin(employees, eq(employees.id, leaveEncashments.employeeId))
    .where(eq(leaveEncashments.tahun, tahun))
    .orderBy(desc(leaveEncashments.totalNominal));
}

/* ==========================================================================
 * Audit log
 * ========================================================================== */

export async function daftarAuditLog(filter: { cari?: string; aksi?: string } = {}) {
  const db = await getDb();

  const syarat: SQL[] = [];
  if (filter.aksi) syarat.push(eq(auditLogs.aksi, filter.aksi));
  if (filter.cari) {
    const pola = `%${filter.cari}%`;
    const cocok = ilike(auditLogs.entitas, pola);
    if (cocok) syarat.push(cocok);
  }

  return db
    .select({
      id: auditLogs.id,
      aksi: auditLogs.aksi,
      entitas: auditLogs.entitas,
      entitasId: auditLogs.entitasId,
      before: auditLogs.before,
      after: auditLogs.after,
      ip: auditLogs.ip,
      createdAt: auditLogs.createdAt,
      pelaku: employees.nama,
      usernamePelaku: users.username,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .leftJoin(employees, eq(employees.userId, users.id))
    .where(syarat.length ? and(...syarat) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);
}

/** Daftar jenis aksi yang pernah tercatat, untuk penyaring. */
export async function jenisAksiAudit() {
  const db = await getDb();
  const baris = await db
    .selectDistinct({ aksi: auditLogs.aksi })
    .from(auditLogs)
    .orderBy(asc(auditLogs.aksi));
  return baris.map((b) => b.aksi);
}
