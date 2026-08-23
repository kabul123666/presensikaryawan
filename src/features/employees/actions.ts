"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import {
  auditLogs,
  employeeLocations,
  employees,
  leaveBalances,
  leaveTypes,
  notifications,
  sessions,
  users,
} from "@/db/schema";
import { hashPassword, periksaKekuatanPassword } from "@/lib/auth/password";
import { PERAN_ADMIN, wajibPeran, buatSesi, cabutSemuaSesi } from "@/lib/auth/session";
import { tanggalWIB } from "@/lib/waktu";

export type HasilKaryawan = {
  ok: boolean;
  pesan: string;
  /** Password sementara, hanya dikembalikan tepat setelah dibuat/direset. */
  passwordSementara?: string;
};

async function infoPermintaan() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent"),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

function segarkan() {
  revalidatePath("/admin/karyawan");
  revalidatePath("/admin");
}

/**
 * Password sementara yang mudah dibacakan lewat telepon: tanpa karakter yang
 * mirip (0/O, 1/l) supaya tidak salah ketik saat disampaikan ke karyawan.
 */
function buatPasswordSementara() {
  const huruf = "abcdefghjkmnpqrstuvwxyz";
  const besar = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const angka = "23456789";
  const semua = huruf + besar + angka;
  const acak = randomBytes(10);
  let hasil = besar[acak[0] % besar.length] + huruf[acak[1] % huruf.length];
  for (let i = 2; i < 9; i++) hasil += semua[acak[i] % semua.length];
  return hasil + angka[acak[9] % angka.length];
}

/** Siapkan saldo cuti tahun berjalan untuk karyawan baru. */
async function siapkanSaldoCuti(employeeId: string) {
  const db = await getDb();
  const tahun = Number(tanggalWIB().slice(0, 4));
  const jenis = await db.select().from(leaveTypes).where(eq(leaveTypes.aktif, true));

  const baris = jenis
    .filter((j) => j.kuotaDefault > 0)
    .map((j) => ({
      employeeId,
      leaveTypeId: j.id,
      tahun,
      kuota: j.kuotaDefault,
    }));

  if (baris.length) await db.insert(leaveBalances).values(baris).onConflictDoNothing();
}

/**
 * Menyimpan daftar cabang tambahan seorang karyawan.
 *
 * Lokasi utama sengaja dibuang dari daftar ini supaya tidak tersimpan dua kali
 * — ia sudah tercatat di kolom employees.locationId.
 */
async function simpanLokasiTambahan(
  employeeId: string,
  dipilih: string[] | undefined,
  lokasiUtama: string | null,
) {
  const db = await getDb();
  await db.delete(employeeLocations).where(eq(employeeLocations.employeeId, employeeId));

  const bersih = [...new Set(dipilih ?? [])].filter((id) => id && id !== lokasiUtama);
  if (bersih.length === 0) return;

  await db
    .insert(employeeLocations)
    .values(bersih.map((locationId) => ({ employeeId, locationId })))
    .onConflictDoNothing();
}

/* ========================================================================== */

const skemaTambah = z.object({
  nama: z.string().trim().min(3, "Nama minimal 3 karakter"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._]{3,40}$/, "Username 3–40 karakter: huruf kecil, angka, . dan _"),
  nik: z.string().trim().max(40).optional(),
  noHp: z.string().trim().max(32).optional(),
  role: z.enum(["ADMIN", "MANAGER", "KARYAWAN"]),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  positionId: z.string().uuid().optional().or(z.literal("")),
  locationId: z.string().uuid().optional().or(z.literal("")),
  shiftId: z.string().uuid().optional().or(z.literal("")),
  tipeKaryawan: z.string().trim().max(40).default("TETAP"),
  tanggalMasuk: z.string().trim().optional().or(z.literal("")),
  gajiPokok: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  wajibAbsen: z.coerce.boolean().optional(),
  /** Cabang tambahan tempat ia juga boleh absen (selain lokasi utama). */
  lokasiTambahan: z.array(z.string().uuid()).optional(),
});

/**
 * Mendaftarkan karyawan baru dari sisi admin (PRD §6.1 jalur A).
 * Akun langsung aktif dengan password sementara yang wajib diganti karyawan.
 */
export async function aksiTambahKaryawan(
  _prev: HasilKaryawan | null,
  formData: FormData,
): Promise<HasilKaryawan> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const mentah = Object.fromEntries(formData);
  const parsed = skemaTambah.safeParse({
    ...mentah,
    wajibAbsen: mentah.wajibAbsen === "on" || mentah.wajibAbsen === "true",
    lokasiTambahan: formData.getAll("lokasiTambahan").filter(Boolean),
  });
  if (!parsed.success) {
    return { ok: false, pesan: parsed.error.issues[0].message };
  }
  const d = parsed.data;
  const db = await getDb();

  const [bentrok] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, d.username))
    .limit(1);
  if (bentrok) return { ok: false, pesan: "Username sudah dipakai. Pilih yang lain." };

  const password = buatPasswordSementara();

  const [akun] = await db
    .insert(users)
    .values({
      username: d.username,
      nik: d.nik ? d.nik.toUpperCase() : null,
      passwordHash: await hashPassword(password),
      role: d.role,
      status: "ACTIVE",
    })
    .returning();

  const [karyawan] = await db
    .insert(employees)
    .values({
      userId: akun.id,
      nama: d.nama,
      noHp: d.noHp || null,
      departmentId: d.departmentId || null,
      positionId: d.positionId || null,
      locationId: d.locationId || null,
      shiftId: d.shiftId || null,
      tipeKaryawan: d.tipeKaryawan || "TETAP",
      tanggalMasuk: d.tanggalMasuk || tanggalWIB(),
      gajiPokok: d.gajiPokok ?? null,
      wajibAbsen: d.wajibAbsen ?? true,
      aktif: true,
    })
    .returning();

  await simpanLokasiTambahan(karyawan.id, d.lokasiTambahan, d.locationId || null);
  await siapkanSaldoCuti(karyawan.id);

  const info = await infoPermintaan();
  await db.insert(auditLogs).values({
    actorId: pengguna.userId,
    aksi: "TAMBAH_KARYAWAN",
    entitas: "employees",
    entitasId: karyawan.id,
    after: { nama: d.nama, username: d.username, role: d.role },
    ip: info.ip,
    userAgent: info.userAgent,
  });

  segarkan();
  return {
    ok: true,
    pesan: `${d.nama} berhasil ditambahkan.`,
    passwordSementara: password,
  };
}

/**
 * Menyetujui atau menolak pendaftaran mandiri (PRD §6.1 jalur B).
 */
export async function aksiVerifikasiPendaftaran(
  userId: string,
  setuju: boolean,
  alasan?: string,
): Promise<HasilKaryawan> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const db = await getDb();

  const [akun] = await db
    .select({ id: users.id, status: users.status, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!akun) return { ok: false, pesan: "Akun tidak ditemukan." };
  if (akun.status !== "PENDING_APPROVAL") {
    return { ok: false, pesan: "Pendaftaran ini sudah diproses sebelumnya." };
  }

  const [karyawan] = await db
    .select({ id: employees.id, nama: employees.nama })
    .from(employees)
    .where(eq(employees.userId, userId))
    .limit(1);

  await db
    .update(users)
    .set({ status: setuju ? "ACTIVE" : "REJECTED", updatedAt: new Date() })
    .where(eq(users.id, userId));

  if (karyawan) {
    await db
      .update(employees)
      .set({ aktif: setuju })
      .where(eq(employees.id, karyawan.id));
    if (setuju) await siapkanSaldoCuti(karyawan.id);
  }

  await db.insert(notifications).values({
    userId,
    tipe: "AKUN",
    judul: setuju ? "Pendaftaran Anda disetujui" : "Pendaftaran Anda ditolak",
    isi: setuju
      ? "Akun Anda sudah aktif. Silakan masuk dan lakukan absensi seperti biasa."
      : (alasan ?? "Hubungi HRD untuk informasi lebih lanjut."),
    link: "/masuk",
  });

  const info = await infoPermintaan();
  await db.insert(auditLogs).values({
    actorId: pengguna.userId,
    aksi: setuju ? "SETUJUI_PENDAFTARAN" : "TOLAK_PENDAFTARAN",
    entitas: "users",
    entitasId: userId,
    before: { status: "PENDING_APPROVAL" },
    after: { status: setuju ? "ACTIVE" : "REJECTED", alasan: alasan ?? null },
    ip: info.ip,
    userAgent: info.userAgent,
  });

  segarkan();
  return {
    ok: true,
    pesan: setuju
      ? `Pendaftaran ${karyawan?.nama ?? akun.username} disetujui.`
      : `Pendaftaran ${karyawan?.nama ?? akun.username} ditolak.`,
  };
}

/**
 * Mengaktifkan atau menonaktifkan akun.
 * Menonaktifkan juga mencabut seluruh sesi aktif — supaya akses benar-benar
 * berhenti saat itu juga, bukan menunggu cookie kedaluwarsa.
 */
export async function aksiUbahStatusAkun(
  userId: string,
  aktifkan: boolean,
): Promise<HasilKaryawan> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  if (userId === pengguna.userId) {
    return { ok: false, pesan: "Anda tidak bisa menonaktifkan akun Anda sendiri." };
  }

  const db = await getDb();
  const [akun] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!akun) return { ok: false, pesan: "Akun tidak ditemukan." };

  if (akun.role === "SUPER_ADMIN" && pengguna.role !== "SUPER_ADMIN") {
    return {
      ok: false,
      pesan: "Hanya super admin yang boleh mengubah akun super admin.",
    };
  }

  await db
    .update(users)
    .set({ status: aktifkan ? "ACTIVE" : "SUSPENDED", updatedAt: new Date() })
    .where(eq(users.id, userId));
  await db.update(employees).set({ aktif: aktifkan }).where(eq(employees.userId, userId));

  if (!aktifkan) await db.delete(sessions).where(eq(sessions.userId, userId));

  const info = await infoPermintaan();
  await db.insert(auditLogs).values({
    actorId: pengguna.userId,
    aksi: aktifkan ? "AKTIFKAN_AKUN" : "NONAKTIFKAN_AKUN",
    entitas: "users",
    entitasId: userId,
    after: { status: aktifkan ? "ACTIVE" : "SUSPENDED" },
    ip: info.ip,
    userAgent: info.userAgent,
  });

  segarkan();
  return {
    ok: true,
    pesan: aktifkan
      ? "Akun diaktifkan kembali."
      : "Akun dinonaktifkan dan seluruh sesinya dicabut.",
  };
}

/**
 * Mengganti password sebuah akun.
 *
 * Password lama tidak bisa ditampilkan — yang tersimpan hanyalah hash scrypt,
 * dan sifatnya satu arah. Karena itu menolong karyawan yang lupa dilakukan
 * dengan menggantinya, bukan membacanya. Admin boleh menentukan sendiri
 * penggantinya supaya mudah disampaikan; bila dikosongkan, dibuatkan acak.
 */
export async function aksiResetPassword(
  userId: string,
  passwordPilihan?: string,
): Promise<HasilKaryawan> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const db = await getDb();

  const [akun] = await db
    .select({ role: users.role, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!akun) return { ok: false, pesan: "Akun tidak ditemukan." };
  if (akun.role === "SUPER_ADMIN" && pengguna.role !== "SUPER_ADMIN") {
    return { ok: false, pesan: "Hanya super admin yang boleh mereset akun super admin." };
  }

  const diketik = passwordPilihan?.trim();
  if (diketik && diketik.length < 8) {
    return { ok: false, pesan: "Password minimal 8 karakter." };
  }
  const password = diketik || buatPasswordSementara();

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      gagalLogin: 0,
      terkunciSampai: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Sesi lama dicabut supaya password lama benar-benar tidak berlaku lagi.
  await db.delete(sessions).where(eq(sessions.userId, userId));

  await db.insert(notifications).values({
    userId,
    tipe: "AKUN",
    judul: "Password Anda direset oleh HRD",
    isi: "Hubungi HRD untuk menerima password sementara, lalu segera ganti setelah masuk.",
    link: "/profil",
  });

  const info = await infoPermintaan();
  await db.insert(auditLogs).values({
    actorId: pengguna.userId,
    aksi: "RESET_PASSWORD",
    entitas: "users",
    entitasId: userId,
    // Password tidak pernah ikut tercatat di audit log.
    after: { direset: true },
    ip: info.ip,
    userAgent: info.userAgent,
  });

  segarkan();
  return {
    ok: true,
    pesan: `Password ${akun.username} berhasil direset.`,
    passwordSementara: password,
  };
}

const skemaUbah = z.object({
  employeeId: z.string().uuid(),
  nama: z.string().trim().min(3, "Nama minimal 3 karakter"),
  noHp: z.string().trim().max(32).optional(),
  role: z.enum(["ADMIN", "MANAGER", "KARYAWAN"]),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  positionId: z.string().uuid().optional().or(z.literal("")),
  locationId: z.string().uuid().optional().or(z.literal("")),
  shiftId: z.string().uuid().optional().or(z.literal("")),
  tipeKaryawan: z.string().trim().max(40).optional(),
  gajiPokok: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  wajibAbsen: z.coerce.boolean().optional(),
  lokasiTambahan: z.array(z.string().uuid()).optional(),
});

/** Memperbarui data kepegawaian. */
export async function aksiUbahKaryawan(
  _prev: HasilKaryawan | null,
  formData: FormData,
): Promise<HasilKaryawan> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const mentahUbah = Object.fromEntries(formData);
  const parsed = skemaUbah.safeParse({
    ...mentahUbah,
    wajibAbsen: mentahUbah.wajibAbsen === "on" || mentahUbah.wajibAbsen === "true",
    lokasiTambahan: formData.getAll("lokasiTambahan").filter(Boolean),
  });
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  const d = parsed.data;
  const db = await getDb();

  const [sebelum] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, d.employeeId))
    .limit(1);
  if (!sebelum) return { ok: false, pesan: "Karyawan tidak ditemukan." };

  const [akun] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, sebelum.userId))
    .limit(1);
  if (akun?.role === "SUPER_ADMIN" && pengguna.role !== "SUPER_ADMIN") {
    return {
      ok: false,
      pesan: "Hanya super admin yang boleh mengubah akun super admin.",
    };
  }

  await db
    .update(employees)
    .set({
      nama: d.nama,
      noHp: d.noHp || null,
      departmentId: d.departmentId || null,
      positionId: d.positionId || null,
      locationId: d.locationId || null,
      shiftId: d.shiftId || null,
      tipeKaryawan: d.tipeKaryawan || sebelum.tipeKaryawan,
      gajiPokok: d.gajiPokok ?? sebelum.gajiPokok,
      wajibAbsen: d.wajibAbsen ?? sebelum.wajibAbsen,
    })
    .where(eq(employees.id, d.employeeId));

  await simpanLokasiTambahan(d.employeeId, d.lokasiTambahan, d.locationId || null);

  if (akun?.role !== "SUPER_ADMIN") {
    await db
      .update(users)
      .set({ role: d.role, updatedAt: new Date() })
      .where(eq(users.id, sebelum.userId));
  }

  const info = await infoPermintaan();
  await db.insert(auditLogs).values({
    actorId: pengguna.userId,
    aksi: "UBAH_KARYAWAN",
    entitas: "employees",
    entitasId: d.employeeId,
    before: { nama: sebelum.nama, positionId: sebelum.positionId },
    after: { nama: d.nama, positionId: d.positionId || null, role: d.role },
    ip: info.ip,
    userAgent: info.userAgent,
  });

  segarkan();
  return { ok: true, pesan: `Data ${d.nama} diperbarui.` };
}

/** Ganti password sendiri dari halaman profil karyawan. */
export async function aksiGantiPasswordSendiri(
  _prev: HasilKaryawan | null,
  formData: FormData,
): Promise<HasilKaryawan> {
  const { wajibMasuk } = await import("@/lib/auth/session");
  const { verifyPassword } = await import("@/lib/auth/password");
  const pengguna = await wajibMasuk();

  const lama = String(formData.get("passwordLama") ?? "");
  const baru = String(formData.get("passwordBaru") ?? "");
  const ulang = String(formData.get("konfirmasi") ?? "");

  if (baru !== ulang) return { ok: false, pesan: "Konfirmasi password tidak sama." };
  const lemah = periksaKekuatanPassword(baru);
  if (lemah) return { ok: false, pesan: lemah };

  const db = await getDb();
  const [akun] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, pengguna.userId))
    .limit(1);

  if (!(await verifyPassword(lama, akun?.passwordHash ?? null))) {
    return { ok: false, pesan: "Password lama salah." };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(baru), updatedAt: new Date() })
    .where(eq(users.id, pengguna.userId));

  /*
   * Seluruh sesi dicabut, lalu satu sesi baru dibuat untuk yang sedang
   * mengganti password.
   *
   * Orang biasanya mengganti password justru karena curiga ada yang tahu.
   * Kalau sesi lama dibiarkan hidup, yang tahu password lama tetap bisa masuk
   * sampai sesinya kedaluwarsa — penggantiannya jadi sia-sia.
   */
  await cabutSemuaSesi(pengguna.userId);
  const infoSesi = await infoPermintaan();
  await buatSesi(pengguna.userId, {
    userAgent: infoSesi.userAgent,
    ip: infoSesi.ip,
  });

  const info = await infoPermintaan();
  await db.insert(auditLogs).values({
    actorId: pengguna.userId,
    aksi: "GANTI_PASSWORD",
    entitas: "users",
    entitasId: pengguna.userId,
    ip: info.ip,
    userAgent: info.userAgent,
  });

  revalidatePath("/profil");
  return {
    ok: true,
    pesan: "Password berhasil diganti. Sesi di perangkat lain ikut dikeluarkan.",
  };
}

/** Daftar pendaftaran mandiri yang menunggu keputusan. */
export async function antreanPendaftaranBaru() {
  const db = await getDb();
  return db
    .select({
      userId: users.id,
      nama: employees.nama,
      username: users.username,
      nik: users.nik,
      noHp: employees.noHp,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(employees, eq(employees.userId, users.id))
    .where(and(eq(users.status, "PENDING_APPROVAL")))
    .orderBy(users.createdAt);
}
