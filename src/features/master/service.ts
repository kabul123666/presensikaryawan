import "server-only";

import { asc, count, eq, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  departments,
  employees,
  holidays,
  locations,
  positions,
  procedureCatalog,
  procedureFeeRates,
  shifts,
} from "@/db/schema";

/** Shift beserta jumlah karyawan yang memakainya. */
export async function daftarShift() {
  const db = await getDb();
  return db
    .select({
      id: shifts.id,
      nama: shifts.nama,
      jamMasuk: shifts.jamMasuk,
      jamPulang: shifts.jamPulang,
      lintasHari: shifts.lintasHari,
      toleransiMenit: shifts.toleransiMenit,
      ambangLemburMenit: shifts.ambangLemburMenit,
      hariKerja: shifts.hariKerja,
      batasClockinDiniMenit: shifts.batasClockinDiniMenit,
      warna: shifts.warna,
      aktif: shifts.aktif,
      jumlahKaryawan: sql<number>`(select count(*) from ${employees} where ${employees.shiftId} = ${shifts.id})`,
    })
    .from(shifts)
    .orderBy(asc(shifts.jamMasuk));
}

/** Lokasi kerja beserta kebijakan geofence-nya. */
export async function daftarLokasi() {
  const db = await getDb();
  return db
    .select({
      id: locations.id,
      nama: locations.nama,
      alamat: locations.alamat,
      lat: locations.lat,
      lng: locations.lng,
      radiusM: locations.radiusM,
      outsidePolicy: locations.outsidePolicy,
      gpsAccuracyToleranceM: locations.gpsAccuracyToleranceM,
      aktif: locations.aktif,
      jumlahKaryawan: sql<number>`(select count(*) from ${employees} where ${employees.locationId} = ${locations.id})`,
    })
    .from(locations)
    .orderBy(asc(locations.nama));
}

/** Departemen beserta jumlah karyawannya. */
export async function daftarDepartemen() {
  const db = await getDb();
  return db
    .select({
      id: departments.id,
      nama: departments.nama,
      keterangan: departments.keterangan,
      aktif: departments.aktif,
      jumlahKaryawan: sql<number>`(select count(*) from ${employees} where ${employees.departmentId} = ${departments.id})`,
    })
    .from(departments)
    .orderBy(asc(departments.nama));
}

/** Jabatan beserta sakelar pencatatan tindakan. */
export async function daftarJabatan() {
  const db = await getDb();
  return db
    .select({
      id: positions.id,
      nama: positions.nama,
      departmentId: positions.departmentId,
      departemen: departments.nama,
      isiFormTindakan: positions.isiFormTindakan,
      kuotaCutiOverride: positions.kuotaCutiOverride,
      aktif: positions.aktif,
      jumlahKaryawan: sql<number>`(select count(*) from ${employees} where ${employees.positionId} = ${positions.id})`,
    })
    .from(positions)
    .leftJoin(departments, eq(departments.id, positions.departmentId))
    .orderBy(asc(positions.nama));
}

/** Katalog tindakan beserta jumlah tarif khusus per jabatan. */
export async function daftarTindakan() {
  const db = await getDb();
  return db
    .select({
      id: procedureCatalog.id,
      nama: procedureCatalog.nama,
      kategori: procedureCatalog.kategori,
      feeDefault: procedureCatalog.feeDefault,
      keterangan: procedureCatalog.keterangan,
      aktif: procedureCatalog.aktif,
      jumlahTarifKhusus: sql<number>`(select count(*) from ${procedureFeeRates} where ${procedureFeeRates.procedureId} = ${procedureCatalog.id})`,
    })
    .from(procedureCatalog)
    .orderBy(asc(procedureCatalog.kategori), asc(procedureCatalog.nama));
}

/** Tarif khusus per jabatan untuk sebuah tindakan. */
export async function tarifKhusus(procedureId: string) {
  const db = await getDb();
  return db
    .select({
      id: procedureFeeRates.id,
      positionId: procedureFeeRates.positionId,
      jabatan: positions.nama,
      fee: procedureFeeRates.fee,
    })
    .from(procedureFeeRates)
    .innerJoin(positions, eq(positions.id, procedureFeeRates.positionId))
    .where(eq(procedureFeeRates.procedureId, procedureId));
}

/** Kalender hari libur. */
export async function daftarHariLibur(tahun: number) {
  const db = await getDb();
  const semua = await db.select().from(holidays).orderBy(asc(holidays.tanggal));
  return semua.filter((h) => h.tanggal.startsWith(String(tahun)));
}

/** Statistik ringkas untuk kepala halaman master data. */
export async function ringkasanMaster() {
  const db = await getDb();
  const [[s], [l], [d], [j], [t]] = await Promise.all([
    db.select({ n: count() }).from(shifts).where(eq(shifts.aktif, true)),
    db.select({ n: count() }).from(locations).where(eq(locations.aktif, true)),
    db.select({ n: count() }).from(departments).where(eq(departments.aktif, true)),
    db.select({ n: count() }).from(positions).where(eq(positions.aktif, true)),
    db
      .select({ n: count() })
      .from(procedureCatalog)
      .where(eq(procedureCatalog.aktif, true)),
  ]);

  return {
    shift: Number(s?.n ?? 0),
    lokasi: Number(l?.n ?? 0),
    departemen: Number(d?.n ?? 0),
    jabatan: Number(j?.n ?? 0),
    tindakan: Number(t?.n ?? 0),
  };
}

/** Seluruh tarif khusus, dikelompokkan per tindakan lalu per jabatan. */
export async function semuaTarifKhusus() {
  const db = await getDb();
  const baris = await db
    .select({
      procedureId: procedureFeeRates.procedureId,
      positionId: procedureFeeRates.positionId,
      fee: procedureFeeRates.fee,
    })
    .from(procedureFeeRates);

  const peta: Record<string, Record<string, number>> = {};
  for (const b of baris) {
    peta[b.procedureId] ??= {};
    peta[b.procedureId][b.positionId] = b.fee;
  }
  return peta;
}
