"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import {
  auditLogs,
  departments,
  holidays,
  locations,
  positions,
  procedureCatalog,
  procedureFeeRates,
  shifts,
} from "@/db/schema";
import { PERAN_ADMIN, wajibPeran } from "@/lib/auth/session";

export type HasilMaster = { ok: boolean; pesan: string };

async function catat(
  actorId: string,
  aksi: string,
  entitas: string,
  entitasId: string,
  after?: Record<string, unknown>,
  before?: Record<string, unknown>,
) {
  const db = await getDb();
  const h = await headers();
  await db.insert(auditLogs).values({
    actorId,
    aksi,
    entitas,
    entitasId,
    before: before ?? null,
    after: after ?? null,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  });
}

function segarkan() {
  revalidatePath("/admin/shift");
  revalidatePath("/admin/lokasi");
  revalidatePath("/admin/organisasi");
  revalidatePath("/admin/tindakan");
  revalidatePath("/admin");
}

/* ==========================================================================
 * Shift
 * ========================================================================== */

const skemaShift = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  nama: z.string().trim().min(2, "Nama shift wajib diisi"),
  jamMasuk: z.string().regex(/^\d{2}:\d{2}$/, "Format jam masuk harus HH:MM"),
  jamPulang: z.string().regex(/^\d{2}:\d{2}$/, "Format jam pulang harus HH:MM"),
  lintasHari: z.coerce.boolean().optional(),
  toleransiMenit: z.coerce.number().int().min(0).max(240),
  ambangLemburMenit: z.coerce.number().int().min(0).max(480),
  batasClockinDiniMenit: z.coerce.number().int().min(0).max(480),
  hariKerja: z.string(),
  warna: z.string().trim().max(16).optional(),
});

/**
 * Menyimpan shift. Tidak ada shift bawaan di kode — seluruh jamnya berasal
 * dari isian admin (PRD §6.2.2).
 */
export async function aksiSimpanShift(
  _prev: HasilMaster | null,
  formData: FormData,
): Promise<HasilMaster> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const mentah = Object.fromEntries(formData);
  const parsed = skemaShift.safeParse({
    ...mentah,
    lintasHari: mentah.lintasHari === "on" || mentah.lintasHari === "true",
  });
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  const d = parsed.data;
  const hariKerja = d.hariKerja
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isInteger(x) && x >= 0 && x <= 6);

  if (hariKerja.length === 0) {
    return { ok: false, pesan: "Pilih minimal satu hari kerja." };
  }

  // Shift yang jam pulangnya lebih awal dari jam masuk pasti melewati tengah
  // malam — tandai otomatis supaya admin tidak perlu ingat mencentangnya.
  const lintasHari = d.lintasHari || d.jamPulang <= d.jamMasuk;

  const db = await getDb();
  const nilai = {
    nama: d.nama,
    jamMasuk: d.jamMasuk,
    jamPulang: d.jamPulang,
    lintasHari,
    toleransiMenit: d.toleransiMenit,
    ambangLemburMenit: d.ambangLemburMenit,
    batasClockinDiniMenit: d.batasClockinDiniMenit,
    hariKerja,
    warna: d.warna || "#14a07c",
  };

  if (d.id) {
    await db.update(shifts).set(nilai).where(eq(shifts.id, d.id));
    await catat(pengguna.userId, "UBAH_SHIFT", "shifts", d.id, nilai);
  } else {
    const [baru] = await db.insert(shifts).values(nilai).returning();
    await catat(pengguna.userId, "TAMBAH_SHIFT", "shifts", baru.id, nilai);
  }

  segarkan();
  return { ok: true, pesan: `Shift ${d.nama} disimpan.` };
}

export async function aksiUbahAktifShift(id: string, aktif: boolean) {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const db = await getDb();
  await db.update(shifts).set({ aktif }).where(eq(shifts.id, id));
  await catat(pengguna.userId, "UBAH_SHIFT", "shifts", id, { aktif });
  segarkan();
  return { ok: true, pesan: aktif ? "Shift diaktifkan." : "Shift dinonaktifkan." };
}

/* ==========================================================================
 * Lokasi & geofence
 * ========================================================================== */

const skemaLokasi = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  nama: z.string().trim().min(2, "Nama lokasi wajib diisi"),
  alamat: z.string().trim().max(300).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().int().min(20).max(5000),
  outsidePolicy: z.enum(["BLOCK", "REQUIRE_REASON", "FLAG_ONLY"]),
  gpsAccuracyToleranceM: z.coerce.number().int().min(0).max(300),
});

/** Menyimpan lokasi kerja beserta kebijakan geofence-nya (PRD §6.2.1). */
export async function aksiSimpanLokasi(
  _prev: HasilMaster | null,
  formData: FormData,
): Promise<HasilMaster> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const parsed = skemaLokasi.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  const d = parsed.data;
  const db = await getDb();
  const nilai = {
    nama: d.nama,
    alamat: d.alamat || null,
    lat: d.lat,
    lng: d.lng,
    radiusM: d.radiusM,
    outsidePolicy: d.outsidePolicy,
    gpsAccuracyToleranceM: d.gpsAccuracyToleranceM,
  };

  if (d.id) {
    const [sebelum] = await db
      .select()
      .from(locations)
      .where(eq(locations.id, d.id))
      .limit(1);
    await db.update(locations).set(nilai).where(eq(locations.id, d.id));
    await catat(pengguna.userId, "UBAH_LOKASI", "locations", d.id, nilai, {
      radiusM: sebelum?.radiusM,
      outsidePolicy: sebelum?.outsidePolicy,
    });
  } else {
    const [baru] = await db.insert(locations).values(nilai).returning();
    await catat(pengguna.userId, "TAMBAH_LOKASI", "locations", baru.id, nilai);
  }

  segarkan();
  return { ok: true, pesan: `Lokasi ${d.nama} disimpan.` };
}

/* ==========================================================================
 * Departemen & jabatan
 * ========================================================================== */

const skemaDepartemen = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  nama: z.string().trim().min(2, "Nama departemen wajib diisi"),
  keterangan: z.string().trim().max(300).optional(),
});

export async function aksiSimpanDepartemen(
  _prev: HasilMaster | null,
  formData: FormData,
): Promise<HasilMaster> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const parsed = skemaDepartemen.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  const d = parsed.data;
  const db = await getDb();
  const nilai = { nama: d.nama, keterangan: d.keterangan || null };

  try {
    if (d.id) {
      await db.update(departments).set(nilai).where(eq(departments.id, d.id));
      await catat(pengguna.userId, "UBAH_DEPARTEMEN", "departments", d.id, nilai);
    } else {
      const [baru] = await db.insert(departments).values(nilai).returning();
      await catat(pengguna.userId, "TAMBAH_DEPARTEMEN", "departments", baru.id, nilai);
    }
  } catch {
    return { ok: false, pesan: "Nama departemen sudah dipakai." };
  }

  segarkan();
  return { ok: true, pesan: `Departemen ${d.nama} disimpan.` };
}

const skemaJabatan = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  nama: z.string().trim().min(2, "Nama jabatan wajib diisi"),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  isiFormTindakan: z.coerce.boolean().optional(),
  kuotaCutiOverride: z.coerce.number().int().min(0).max(365).optional(),
});

/**
 * Menyimpan jabatan, termasuk sakelar pencatatan tindakan.
 * Sakelar inilah yang menentukan siapa yang melihat form tindakan saat clock
 * out — bukan daftar jabatan yang ditulis di kode (PRD §6.3).
 */
export async function aksiSimpanJabatan(
  _prev: HasilMaster | null,
  formData: FormData,
): Promise<HasilMaster> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const mentah = Object.fromEntries(formData);
  const parsed = skemaJabatan.safeParse({
    ...mentah,
    isiFormTindakan: mentah.isiFormTindakan === "on" || mentah.isiFormTindakan === "true",
    kuotaCutiOverride: mentah.kuotaCutiOverride || undefined,
  });
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  const d = parsed.data;
  const db = await getDb();
  const nilai = {
    nama: d.nama,
    departmentId: d.departmentId || null,
    isiFormTindakan: d.isiFormTindakan ?? false,
    kuotaCutiOverride: d.kuotaCutiOverride ?? null,
  };

  if (d.id) {
    await db.update(positions).set(nilai).where(eq(positions.id, d.id));
    await catat(pengguna.userId, "UBAH_JABATAN", "positions", d.id, nilai);
  } else {
    const [baru] = await db.insert(positions).values(nilai).returning();
    await catat(pengguna.userId, "TAMBAH_JABATAN", "positions", baru.id, nilai);
  }

  segarkan();
  return { ok: true, pesan: `Jabatan ${d.nama} disimpan.` };
}

/** Menyalakan/mematikan pencatatan tindakan untuk sebuah jabatan. */
export async function aksiAlihkanFormTindakan(id: string, nyala: boolean) {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const db = await getDb();
  await db.update(positions).set({ isiFormTindakan: nyala }).where(eq(positions.id, id));
  await catat(pengguna.userId, "UBAH_JABATAN", "positions", id, {
    isiFormTindakan: nyala,
  });
  segarkan();
  return {
    ok: true,
    pesan: nyala
      ? "Jabatan ini sekarang mencatat tindakan saat clock out."
      : "Pencatatan tindakan dimatikan untuk jabatan ini.",
  };
}

/* ==========================================================================
 * Katalog tindakan
 * ========================================================================== */

const skemaTindakan = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  nama: z.string().trim().min(2, "Nama tindakan wajib diisi"),
  kategori: z.enum(["BESAR", "SEDANG", "RINGAN", "NON_FEE"]),
  feeDefault: z.coerce.number().int().min(0).max(100_000_000),
  keterangan: z.string().trim().max(300).optional(),
});

export async function aksiSimpanTindakan(
  _prev: HasilMaster | null,
  formData: FormData,
): Promise<HasilMaster> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const parsed = skemaTindakan.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  const d = parsed.data;
  const db = await getDb();
  const nilai = {
    nama: d.nama,
    kategori: d.kategori,
    feeDefault: d.feeDefault,
    keterangan: d.keterangan || null,
  };

  if (d.id) {
    const [sebelum] = await db
      .select()
      .from(procedureCatalog)
      .where(eq(procedureCatalog.id, d.id))
      .limit(1);
    await db.update(procedureCatalog).set(nilai).where(eq(procedureCatalog.id, d.id));
    await catat(pengguna.userId, "UBAH_TINDAKAN", "procedure_catalog", d.id, nilai, {
      feeDefault: sebelum?.feeDefault,
    });
  } else {
    const [baru] = await db.insert(procedureCatalog).values(nilai).returning();
    await catat(pengguna.userId, "TAMBAH_TINDAKAN", "procedure_catalog", baru.id, nilai);
  }

  segarkan();
  return {
    ok: true,
    // Tarif baru tidak mengubah catatan lama karena nominalnya dibekukan
    // saat tindakan dicatat.
    pesan: `Tindakan ${d.nama} disimpan. Tarif baru hanya berlaku untuk pencatatan berikutnya.`,
  };
}

export async function aksiUbahAktifTindakan(id: string, aktif: boolean) {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const db = await getDb();
  await db.update(procedureCatalog).set({ aktif }).where(eq(procedureCatalog.id, id));
  await catat(pengguna.userId, "UBAH_TINDAKAN", "procedure_catalog", id, { aktif });
  segarkan();
  return { ok: true, pesan: aktif ? "Tindakan diaktifkan." : "Tindakan dinonaktifkan." };
}

/** Menetapkan tarif khusus sebuah tindakan untuk jabatan tertentu. */
export async function aksiSimpanTarifKhusus(
  procedureId: string,
  positionId: string,
  fee: number,
): Promise<HasilMaster> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  if (!Number.isInteger(fee) || fee < 0) {
    return { ok: false, pesan: "Nominal tarif tidak valid." };
  }

  const db = await getDb();
  await db
    .insert(procedureFeeRates)
    .values({ procedureId, positionId, fee })
    .onConflictDoUpdate({
      target: [procedureFeeRates.procedureId, procedureFeeRates.positionId],
      set: { fee },
    });

  await catat(pengguna.userId, "UBAH_TARIF_KHUSUS", "procedure_fee_rates", procedureId, {
    positionId,
    fee,
  });
  segarkan();
  return { ok: true, pesan: "Tarif khusus disimpan." };
}

/* ==========================================================================
 * Hari libur
 * ========================================================================== */

const skemaLibur = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  nama: z.string().trim().min(2, "Nama hari libur wajib diisi"),
});

export async function aksiTambahHariLibur(
  _prev: HasilMaster | null,
  formData: FormData,
): Promise<HasilMaster> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const parsed = skemaLibur.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  const db = await getDb();
  try {
    await db.insert(holidays).values({ ...parsed.data, nasional: true });
  } catch {
    return { ok: false, pesan: "Tanggal tersebut sudah terdaftar sebagai hari libur." };
  }

  await catat(pengguna.userId, "TAMBAH_HARI_LIBUR", "holidays", parsed.data.tanggal, {
    nama: parsed.data.nama,
  });
  revalidatePath("/admin/pengaturan");
  return { ok: true, pesan: `${parsed.data.nama} ditambahkan.` };
}

export async function aksiHapusHariLibur(id: string): Promise<HasilMaster> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const db = await getDb();
  await db.delete(holidays).where(eq(holidays.id, id));
  await catat(pengguna.userId, "HAPUS_HARI_LIBUR", "holidays", id);
  revalidatePath("/admin/pengaturan");
  return { ok: true, pesan: "Hari libur dihapus." };
}
