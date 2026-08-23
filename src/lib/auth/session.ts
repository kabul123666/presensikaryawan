import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, count, eq, gt } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  employeeLocations,
  employees,
  locations,
  positions,
  sessions,
  shifts,
  users,
  type Role,
} from "@/db/schema";

export const COOKIE_SESI = "alia_sesi";

/*
 * Umur sesi dibedakan menurut wewenang.
 *
 * Karyawan membuka aplikasi tiap hari untuk absen, jadi tujuh hari membuatnya
 * jarang diminta masuk ulang. Akun yang bisa melihat data seluruh karyawan
 * ditahan sehari saja: risiko terbesar di klinik bukan pembobolan dari luar,
 * melainkan sesi admin yang tertinggal terbuka di perangkat bersama lalu
 * dipakai orang berikutnya yang memegangnya.
 */
const UMUR_SESI_HARI = 7;
const UMUR_SESI_ADMIN_HARI = 1;

/**
 * Sesi disimpan sebagai token acak di cookie httpOnly, sedangkan database
 * hanya menyimpan hash-nya. Dengan begitu, bocornya isi tabel sesi tidak
 * langsung berarti akun bisa dibajak — dan sesi bisa dicabut kapan saja
 * (hal yang tidak bisa dilakukan JWT tanpa daftar cabut terpisah).
 */
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function buatSesi(
  userId: string,
  info: { userAgent?: string | null; ip?: string | null } = {},
) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");

  const [akun] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const umur =
    akun && PERAN_PENYETUJU.includes(akun.role) ? UMUR_SESI_ADMIN_HARI : UMUR_SESI_HARI;

  const kedaluwarsa = new Date(Date.now() + umur * 86_400_000);

  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    userAgent: info.userAgent ?? null,
    ip: info.ip ?? null,
    expiresAt: kedaluwarsa,
  });

  const jar = await cookies();
  jar.set(COOKIE_SESI, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: kedaluwarsa,
  });
}

/**
 * Mencabut seluruh sesi milik seorang pengguna.
 *
 * Dipakai saat password diganti dan saat pengguna sengaja mengeluarkan diri
 * dari semua perangkat. Tanpa ini, orang yang sempat tahu password lama tetap
 * bisa memakai sesinya sampai kedaluwarsa — mengganti password tidak ada
 * gunanya kalau sesi lamanya dibiarkan hidup.
 */
export async function cabutSemuaSesi(userId: string) {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function hapusSesi() {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESI)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.delete(COOKIE_SESI);
}

export type PenggunaSesi = {
  userId: string;
  username: string;
  nik: string | null;
  role: Role;
  employeeId: string;
  nama: string;
  fotoProfil: string | null;
  departmentId: string | null;
  positionId: string | null;
  namaJabatan: string | null;
  /** Menentukan apakah form tindakan muncul saat clock out (PRD §6.3). */
  isiFormTindakan: boolean;
  shiftId: string | null;
  namaShift: string | null;
  jamMasuk: string | null;
  jamPulang: string | null;
  locationId: string | null;
  namaLokasi: string | null;
};

/** Mengambil pengguna dari cookie sesi. Mengembalikan null bila tidak masuk. */
export async function ambilPengguna(): Promise<PenggunaSesi | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESI)?.value;
  if (!token) return null;

  const db = await getDb();
  const baris = await db
    .select({
      userId: users.id,
      username: users.username,
      nik: users.nik,
      role: users.role,
      status: users.status,
      employeeId: employees.id,
      nama: employees.nama,
      fotoProfil: employees.fotoProfil,
      departmentId: employees.departmentId,
      positionId: employees.positionId,
      namaJabatan: positions.nama,
      isiFormTindakan: positions.isiFormTindakan,
      shiftId: employees.shiftId,
      namaShift: shifts.nama,
      jamMasuk: shifts.jamMasuk,
      jamPulang: shifts.jamPulang,
      locationId: employees.locationId,
      namaLokasi: locations.nama,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(employees, eq(employees.userId, users.id))
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .leftJoin(shifts, eq(shifts.id, employees.shiftId))
    .leftJoin(locations, eq(locations.id, employees.locationId))
    .where(
      and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())),
    )
    .limit(1);

  const p = baris[0];
  if (!p || p.status !== "ACTIVE") return null;

  return {
    userId: p.userId,
    username: p.username,
    nik: p.nik,
    role: p.role,
    employeeId: p.employeeId,
    nama: p.nama,
    fotoProfil: p.fotoProfil,
    departmentId: p.departmentId,
    positionId: p.positionId,
    namaJabatan: p.namaJabatan,
    isiFormTindakan: p.isiFormTindakan ?? false,
    shiftId: p.shiftId,
    namaShift: p.namaShift,
    jamMasuk: p.jamMasuk,
    jamPulang: p.jamPulang,
    locationId: p.locationId,
    namaLokasi: p.namaLokasi,
  };
}

/**
 * Wajib sudah masuk. Dipanggil di setiap halaman & server action terproteksi.
 * Pengecekan dilakukan di server, tidak pernah mengandalkan UI menyembunyikan
 * tombol (PRD §9).
 */
export async function wajibMasuk(): Promise<PenggunaSesi> {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/masuk");
  return pengguna;
}

/** Wajib memiliki salah satu peran yang diizinkan. */
export async function wajibPeran(...peran: Role[]): Promise<PenggunaSesi> {
  const pengguna = await wajibMasuk();
  if (!peran.includes(pengguna.role)) redirect("/tidak-berwenang");
  return pengguna;
}

export const PERAN_ADMIN: Role[] = ["SUPER_ADMIN", "ADMIN"];
export const PERAN_PENYETUJU: Role[] = ["SUPER_ADMIN", "ADMIN", "OWNER", "MANAGER"];

/** Peran yang tidak pernah dituntut absen: mereka bukan staf terjadwal. */
export const PERAN_TANPA_ABSEN: Role[] = ["SUPER_ADMIN", "ADMIN", "OWNER"];

export function bolehKelolaSemua(role: Role) {
  return PERAN_ADMIN.includes(role);
}

/**
 * Sejauh mana seorang penyetuju boleh melihat data kepegawaian.
 *
 * Admin dan Super Admin melihat seluruh jaringan. Kepala unit hanya melihat
 * departemennya sendiri (PRD §2: "lihat rekap timnya saja") — tabel
 * `departments` belum menyimpan siapa kepalanya, jadi yang dipakai adalah
 * departemen tempat ia terdaftar.
 *
 * Pemilik dibatasi per cabang, bukan per departemen: pemilik satu klinik hanya
 * boleh melihat kliniknya. Cabang haknya diambil dari penempatannya ditambah
 * penugasan lintas cabang — mekanisme yang sudah dipakai untuk menentukan di
 * mana seseorang boleh absen — sehingga pemilik seluruh jaringan cukup
 * ditugaskan ke semua cabang tanpa tabel baru.
 *
 * Nilainya dipakai menyempitkan kueri, bukan menyembunyikan tombol:
 * pembatasannya harus tetap berlaku walau alamatnya diketik langsung.
 */
export type LingkupData = {
  semua: boolean;
  /** Terisi untuk kepala unit. */
  departmentId: string | null;
  /** Terisi untuk pemilik; kosong berarti tidak dibatasi cabang. */
  locationIds: string[] | null;
};

export async function lingkupData(pengguna: PenggunaSesi): Promise<LingkupData> {
  if (PERAN_ADMIN.includes(pengguna.role)) {
    return { semua: true, departmentId: null, locationIds: null };
  }

  if (pengguna.role === "OWNER") {
    const db = await getDb();
    const tambahan = await db
      .select({ locationId: employeeLocations.locationId })
      .from(employeeLocations)
      .where(eq(employeeLocations.employeeId, pengguna.employeeId));

    const cabang = [
      ...new Set(
        [pengguna.locationId, ...tambahan.map((t) => t.locationId)].filter(
          (x): x is string => Boolean(x),
        ),
      ),
    ];

    // Pemilik yang menguasai seluruh cabang aktif tidak perlu disaring sama
    // sekali — menyaring dengan daftar lengkap hanya memperlambat kueri.
    const [jumlah] = await db
      .select({ n: count() })
      .from(locations)
      .where(eq(locations.aktif, true));

    if (cabang.length > 0 && cabang.length >= Number(jumlah?.n ?? 0)) {
      return { semua: true, departmentId: null, locationIds: null };
    }

    return { semua: false, departmentId: null, locationIds: cabang };
  }

  return { semua: false, departmentId: pengguna.departmentId, locationIds: null };
}
