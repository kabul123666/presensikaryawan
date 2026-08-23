import "server-only";

import { and, desc, eq, gte, isNull, lte, ne, sql, notInArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  attendances,
  departments,
  employees,
  positions,
  requests,
  users,
} from "@/db/schema";
import { PERAN_TANPA_ABSEN } from "@/lib/auth/session";
import { geserTanggal, tanggalWIB } from "@/lib/waktu";

/** Angka-angka utama untuk kartu ringkasan dashboard. */
export async function ringkasanHariIni(tanggal = tanggalWIB()) {
  const db = await getDb();

  const [karyawan] = await db
    .select({ total: sql<number>`count(*)` })
    .from(employees)
    .innerJoin(users, eq(users.id, employees.userId))
    .where(
      and(
        eq(employees.aktif, true),
        eq(employees.wajibAbsen, true),
        eq(users.status, "ACTIVE"),
        notInArray(users.role, PERAN_TANPA_ABSEN),
      ),
    );

  const [absen] = await db
    .select({
      hadir: sql<number>`count(*) filter (where ${attendances.clockInAt} is not null)`,
      terlambat: sql<number>`count(*) filter (where ${attendances.menitTerlambat} > 0)`,
      cuti: sql<number>`count(*) filter (where ${attendances.status} = 'ON_LEAVE')`,
      belumPulang: sql<number>`count(*) filter (where ${attendances.clockInAt} is not null and ${attendances.clockOutAt} is null)`,
      ditandai: sql<number>`count(*) filter (where jsonb_array_length(${attendances.flags}) > 0)`,
    })
    .from(attendances)
    .where(eq(attendances.tanggal, tanggal));

  const [menunggu] = await db
    .select({ total: sql<number>`count(*)` })
    .from(requests)
    .where(eq(requests.status, "PENDING"));

  const [pendaftaran] = await db
    .select({ total: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.status, "PENDING_APPROVAL"));

  const totalKaryawan = Number(karyawan?.total ?? 0);
  const hadir = Number(absen?.hadir ?? 0);

  return {
    totalKaryawan,
    hadir,
    terlambat: Number(absen?.terlambat ?? 0),
    cuti: Number(absen?.cuti ?? 0),
    belumPulang: Number(absen?.belumPulang ?? 0),
    ditandai: Number(absen?.ditandai ?? 0),
    belumAbsen: Math.max(0, totalKaryawan - hadir - Number(absen?.cuti ?? 0)),
    menungguPersetujuan: Number(menunggu?.total ?? 0),
    pendaftaranBaru: Number(pendaftaran?.total ?? 0),
  };
}

/** Aliran absensi hari ini untuk panel monitoring. */
export async function absensiHariIni(tanggal = tanggalWIB(), batas = 25) {
  const db = await getDb();
  return db
    .select({
      id: attendances.id,
      nama: employees.nama,
      jabatan: positions.nama,
      departemen: departments.nama,
      status: attendances.status,
      clockInAt: attendances.clockInAt,
      clockOutAt: attendances.clockOutAt,
      menitTerlambat: attendances.menitTerlambat,
      diLuarArea: attendances.clockInOutsideArea,
      jarakM: attendances.clockInDistanceM,
      flags: attendances.flags,
      foto: attendances.clockInPhoto,
    })
    .from(attendances)
    .innerJoin(employees, eq(employees.id, attendances.employeeId))
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .where(eq(attendances.tanggal, tanggal))
    .orderBy(desc(attendances.clockInAt))
    .limit(batas);
}

/** Karyawan aktif yang belum melakukan clock in hari ini. */
export async function belumAbsen(tanggal = tanggalWIB()) {
  const db = await getDb();
  const sudah = db
    .select({ id: attendances.employeeId })
    .from(attendances)
    .where(eq(attendances.tanggal, tanggal));

  return db
    .select({
      id: employees.id,
      nama: employees.nama,
      jabatan: positions.nama,
      noHp: employees.noHp,
    })
    .from(employees)
    .innerJoin(users, eq(users.id, employees.userId))
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .where(
      and(
        eq(employees.aktif, true),
        eq(employees.wajibAbsen, true),
        eq(users.status, "ACTIVE"),
        // Pemilik dan pengelola sistem bukan staf terjadwal; menagih kehadiran
        // mereka hanya membuat daftar "belum absen" tidak pernah kosong.
        notInArray(users.role, PERAN_TANPA_ABSEN),
        sql`${employees.id} not in ${sudah}`,
      ),
    )
    .limit(20);
}

/** Tren kehadiran 14 hari terakhir untuk grafik batang. */
export async function trenKehadiran(hari = 14) {
  const db = await getDb();
  const hariIni = tanggalWIB();
  const mulai = geserTanggal(hariIni, -(hari - 1));

  const baris = await db
    .select({
      tanggal: attendances.tanggal,
      hadir: sql<number>`count(*) filter (where ${attendances.clockInAt} is not null)`,
      terlambat: sql<number>`count(*) filter (where ${attendances.menitTerlambat} > 0)`,
    })
    .from(attendances)
    .where(and(gte(attendances.tanggal, mulai), lte(attendances.tanggal, hariIni)))
    .groupBy(attendances.tanggal)
    .orderBy(attendances.tanggal);

  const peta = new Map(baris.map((b) => [b.tanggal, b]));
  return Array.from({ length: hari }, (_, i) => {
    const tgl = geserTanggal(mulai, i);
    const d = peta.get(tgl);
    return {
      tanggal: tgl,
      hadir: Number(d?.hadir ?? 0),
      terlambat: Number(d?.terlambat ?? 0),
    };
  });
}

/** Antrean pengajuan yang menunggu keputusan. */
export async function antreanPersetujuan(batas = 10) {
  const db = await getDb();
  return db
    .select({
      id: requests.id,
      tipe: requests.tipe,
      status: requests.status,
      alasan: requests.alasan,
      createdAt: requests.createdAt,
      payload: requests.payload,
      nama: employees.nama,
      jabatan: positions.nama,
    })
    .from(requests)
    .innerJoin(employees, eq(employees.id, requests.employeeId))
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .where(eq(requests.status, "PENDING"))
    .orderBy(desc(requests.createdAt))
    .limit(batas);
}

/** Karyawan yang mendaftar sendiri dan menunggu verifikasi admin. */
export async function antreanPendaftaran() {
  const db = await getDb();
  return db
    .select({
      userId: users.id,
      employeeId: employees.id,
      nama: employees.nama,
      username: users.username,
      nik: users.nik,
      noHp: employees.noHp,
      jabatan: positions.nama,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(employees, eq(employees.userId, users.id))
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .where(eq(users.status, "PENDING_APPROVAL"))
    .orderBy(desc(users.createdAt));
}

/** Daftar karyawan untuk halaman manajemen. */
export async function daftarKaryawan() {
  const db = await getDb();
  return db
    .select({
      id: employees.id,
      userId: users.id,
      nama: employees.nama,
      username: users.username,
      nik: users.nik,
      role: users.role,
      status: users.status,
      aktif: employees.aktif,
      noHp: employees.noHp,
      jabatan: positions.nama,
      departemen: departments.nama,
      tanggalMasuk: employees.tanggalMasuk,
    })
    .from(employees)
    .innerJoin(users, eq(users.id, employees.userId))
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .where(ne(users.status, "REJECTED"))
    .orderBy(employees.nama);
}

/** Absensi yang perlu ditinjau: ditandai anomali atau belum di-clock out. */
export async function perluDitinjau(batas = 10) {
  const db = await getDb();
  return db
    .select({
      id: attendances.id,
      nama: employees.nama,
      tanggal: attendances.tanggal,
      flags: attendances.flags,
      jarakM: attendances.clockInDistanceM,
      alasan: attendances.clockInReason,
      clockOutAt: attendances.clockOutAt,
    })
    .from(attendances)
    .innerJoin(employees, eq(employees.id, attendances.employeeId))
    .where(
      sql`jsonb_array_length(${attendances.flags}) > 0 or (${attendances.clockInAt} is not null and ${attendances.clockOutAt} is null and ${attendances.tanggal} < ${tanggalWIB()})`,
    )
    .orderBy(desc(attendances.tanggal))
    .limit(batas);
}

/** Absensi terbuka lintas hari (dipakai untuk penanda "belum clock out"). */
export async function absensiBelumPulang() {
  const db = await getDb();
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(attendances)
    .where(and(isNull(attendances.clockOutAt), lte(attendances.tanggal, tanggalWIB())));
  return Number(row?.total ?? 0);
}
