import "server-only";

import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  isNotNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  departments,
  employeeLocations,
  employees,
  locations,
  positions,
  shifts,
  users,
  type Role,
  type UserStatus,
} from "@/db/schema";

/** Penyaring daftar karyawan pada halaman admin. */
export type FilterKaryawan = {
  cari?: string;
  departmentId?: string;
  status?: UserStatus | "SEMUA";
};

export type BarisKaryawan = {
  employeeId: string;
  userId: string;
  nama: string;
  username: string;
  nik: string | null;
  noHp: string | null;
  role: Role;
  status: UserStatus;
  aktif: boolean;
  jabatan: string | null;
  departemen: string | null;
  lokasi: string | null;
  shift: string | null;
  tanggalMasuk: string | null;
  /** Ikut pencatatan kehadiran; false untuk akun pengelola sistem. */
  wajibAbsen: boolean;
  /** Cabang tambahan tempat ia juga boleh absen, selain lokasi utamanya. */
  lokasiTambahanIds: string[];
};

export async function daftarKaryawan(filter: FilterKaryawan = {}) {
  const db = await getDb();

  const syarat: SQL[] = [];
  if (filter.cari) {
    const pola = `%${filter.cari}%`;
    const cocok = or(
      ilike(employees.nama, pola),
      ilike(users.username, pola),
      ilike(users.nik, pola),
    );
    if (cocok) syarat.push(cocok);
  }
  if (filter.departmentId) syarat.push(eq(employees.departmentId, filter.departmentId));
  if (filter.status && filter.status !== "SEMUA") {
    syarat.push(eq(users.status, filter.status));
  }

  const baris = await db
    .select({
      employeeId: employees.id,
      userId: users.id,
      nama: employees.nama,
      username: users.username,
      nik: users.nik,
      noHp: employees.noHp,
      role: users.role,
      status: users.status,
      aktif: employees.aktif,
      wajibAbsen: employees.wajibAbsen,
      jabatan: positions.nama,
      departemen: departments.nama,
      lokasi: locations.nama,
      shift: shifts.nama,
      tanggalMasuk: employees.tanggalMasuk,
    })
    .from(employees)
    .innerJoin(users, eq(users.id, employees.userId))
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .leftJoin(locations, eq(locations.id, employees.locationId))
    .leftJoin(shifts, eq(shifts.id, employees.shiftId))
    .where(syarat.length ? and(...syarat) : undefined)
    .orderBy(asc(employees.nama))
    .limit(300);

  // Cabang tambahan diambil sekali untuk seluruh baris, bukan per karyawan,
  // supaya daftar sepanjang apa pun tetap dua kueri.
  const idKaryawan = baris.map((b) => b.employeeId);
  const tambahan = idKaryawan.length
    ? await db
        .select({
          employeeId: employeeLocations.employeeId,
          locationId: employeeLocations.locationId,
        })
        .from(employeeLocations)
        .where(inArray(employeeLocations.employeeId, idKaryawan))
    : [];

  const petaLokasi = new Map<string, string[]>();
  for (const t of tambahan) {
    const daftar = petaLokasi.get(t.employeeId) ?? [];
    daftar.push(t.locationId);
    petaLokasi.set(t.employeeId, daftar);
  }

  return baris.map((sisa): BarisKaryawan => ({
    ...sisa,
    lokasiTambahanIds: petaLokasi.get(sisa.employeeId) ?? [],
  }));
}

/** Jumlah karyawan per status untuk tab penyaring. */
export async function hitungStatusKaryawan() {
  const db = await getDb();
  const baris = await db
    .select({ status: users.status, jumlah: count() })
    .from(users)
    .innerJoin(employees, eq(employees.userId, users.id))
    .groupBy(users.status);

  const hitung: Record<string, number> = {
    SEMUA: 0,
    ACTIVE: 0,
    PENDING_APPROVAL: 0,
    INVITED: 0,
    SUSPENDED: 0,
    REJECTED: 0,
  };
  for (const b of baris) {
    hitung[b.status] = Number(b.jumlah);
    hitung.SEMUA += Number(b.jumlah);
  }
  return hitung;
}

/** Pilihan untuk dropdown pada formulir karyawan. */
export async function opsiFormulir() {
  const db = await getDb();
  const [daftarDept, daftarJab, daftarLok, daftarShift] = await Promise.all([
    db
      .select({ id: departments.id, nama: departments.nama })
      .from(departments)
      .where(eq(departments.aktif, true))
      .orderBy(asc(departments.nama)),
    db
      .select({
        id: positions.id,
        nama: positions.nama,
        departmentId: positions.departmentId,
        isiFormTindakan: positions.isiFormTindakan,
      })
      .from(positions)
      .where(eq(positions.aktif, true))
      .orderBy(asc(positions.nama)),
    db
      .select({ id: locations.id, nama: locations.nama })
      .from(locations)
      .where(eq(locations.aktif, true))
      .orderBy(asc(locations.nama)),
    db
      .select({
        id: shifts.id,
        nama: shifts.nama,
        jamMasuk: shifts.jamMasuk,
        jamPulang: shifts.jamPulang,
      })
      .from(shifts)
      .where(eq(shifts.aktif, true))
      .orderBy(asc(shifts.nama)),
  ]);

  return {
    departemen: daftarDept,
    jabatan: daftarJab,
    lokasi: daftarLok,
    shift: daftarShift,
  };
}

/** Statistik ringkas untuk kepala halaman. */
export async function ringkasanKaryawan() {
  const db = await getDb();
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      aktif: sql<number>`count(*) filter (where ${users.status} = 'ACTIVE')`,
      menunggu: sql<number>`count(*) filter (where ${users.status} = 'PENDING_APPROVAL')`,
      nonaktif: sql<number>`count(*) filter (where ${users.status} = 'SUSPENDED')`,
    })
    .from(users)
    .innerJoin(employees, eq(employees.userId, users.id))
    .where(ne(users.status, "REJECTED"));

  return {
    total: Number(row?.total ?? 0),
    aktif: Number(row?.aktif ?? 0),
    menunggu: Number(row?.menunggu ?? 0),
    nonaktif: Number(row?.nonaktif ?? 0),
  };
}

/**
 * Cabang tempat seorang karyawan bertugas: penempatan utamanya ditambah
 * penugasan lintas cabang.
 *
 * Antarmuka sebelumnya hanya menyebut penempatan utama, sehingga seorang
 * manajer yang membawahi tiga cabang tampil seolah hanya milik satu — padahal
 * mesin absensinya sudah lama mengizinkan ia absen di cabang mana pun
 * (lihat `muatSemuaLokasi` di features/attendance/actions.ts).
 */
export async function cabangKaryawan(employeeId: string) {
  const db = await getDb();

  const [milik, [total]] = await Promise.all([
    db
      .select({ id: locations.id, nama: locations.nama })
      .from(locations)
      .leftJoin(
        employeeLocations,
        and(
          eq(employeeLocations.locationId, locations.id),
          eq(employeeLocations.employeeId, employeeId),
        ),
      )
      .leftJoin(
        employees,
        and(eq(employees.id, employeeId), eq(employees.locationId, locations.id)),
      )
      .where(or(isNotNull(employeeLocations.employeeId), isNotNull(employees.id)))
      .orderBy(asc(locations.nama)),
    db.select({ jumlah: count() }).from(locations).where(eq(locations.aktif, true)),
  ]);

  const nama = milik.map((m) => m.nama);

  return {
    nama,
    /** Benar bila karyawan ini mencakup seluruh cabang yang aktif. */
    semuaCabang: nama.length > 1 && nama.length >= Number(total?.jumlah ?? 0),
  };
}

/**
 * Label cabang untuk kepala halaman.
 *
 * Menyebut tiga nama cabang di bawah nama orang membuat barisnya terpotong di
 * ponsel, jadi yang ditampilkan jumlahnya — nama lengkapnya ada di Profil.
 */
export function labelCabang(cabang: { nama: string[]; semuaCabang: boolean }) {
  if (cabang.nama.length === 0) return null;
  if (cabang.nama.length === 1) return cabang.nama[0];
  return cabang.semuaCabang ? "Seluruh cabang" : `${cabang.nama.length} cabang`;
}
