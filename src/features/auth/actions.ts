"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import { auditLogs, employees, positions, users } from "@/db/schema";
import {
  hashPassword,
  periksaKekuatanPassword,
  verifyPassword,
} from "@/lib/auth/password";
import {
  buatSesi,
  hapusSesi,
  PERAN_ADMIN,
  cabutSemuaSesi,
  wajibMasuk,
} from "@/lib/auth/session";

export type HasilForm = { ok: boolean; pesan?: string; field?: string };

const MAKS_GAGAL = 5;
const MENIT_KUNCI = 15;

const skemaMasuk = z.object({
  identitas: z.string().trim().toLowerCase().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

/** Username hanya huruf kecil, angka, titik, dan garis bawah. */
const POLA_USERNAME = /^[a-z0-9._]{3,40}$/;

async function infoPermintaan() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent"),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

/**
 * Masuk dengan username.
 *
 * Pesan galat sengaja dibuat sama untuk akun tidak ditemukan dan password
 * salah, agar tidak bisa dipakai menebak username mana yang terdaftar.
 */
export async function aksiMasuk(
  _prev: HasilForm | null,
  formData: FormData,
): Promise<HasilForm> {
  const parsed = skemaMasuk.safeParse({
    identitas: formData.get("identitas"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const isu = parsed.error.issues[0];
    return { ok: false, pesan: isu.message, field: String(isu.path[0]) };
  }

  const { identitas, password } = parsed.data;
  const db = await getDb();

  const [akun] = await db
    .select()
    .from(users)
    .where(eq(users.username, identitas.toLowerCase()))
    .limit(1);

  const gagalUmum = { ok: false, pesan: "Username atau password salah" } as const;

  if (!akun) {
    // Tetap jalankan verifikasi palsu supaya waktu respons tidak membocorkan
    // apakah akun ada atau tidak.
    await verifyPassword(password, null);
    return gagalUmum;
  }

  if (akun.terkunciSampai && akun.terkunciSampai > new Date()) {
    const sisa = Math.ceil((akun.terkunciSampai.getTime() - Date.now()) / 60000);
    return {
      ok: false,
      pesan: `Akun terkunci sementara. Coba lagi dalam ${sisa} menit.`,
    };
  }

  const cocok = await verifyPassword(password, akun.passwordHash);

  if (!cocok) {
    const gagalBaru = akun.gagalLogin + 1;
    await db
      .update(users)
      .set({
        gagalLogin: gagalBaru,
        terkunciSampai:
          gagalBaru >= MAKS_GAGAL
            ? new Date(Date.now() + MENIT_KUNCI * 60_000)
            : akun.terkunciSampai,
      })
      .where(eq(users.id, akun.id));

    if (gagalBaru >= MAKS_GAGAL) {
      return {
        ok: false,
        pesan: `Terlalu banyak percobaan gagal. Akun dikunci ${MENIT_KUNCI} menit.`,
      };
    }
    return gagalUmum;
  }

  if (akun.status === "PENDING_APPROVAL") {
    return {
      ok: false,
      pesan: "Pendaftaran Anda masih menunggu persetujuan admin.",
    };
  }
  if (akun.status === "REJECTED") {
    return { ok: false, pesan: "Pendaftaran Anda ditolak. Hubungi HRD." };
  }
  if (akun.status === "SUSPENDED") {
    return { ok: false, pesan: "Akun Anda dinonaktifkan. Hubungi HRD." };
  }

  const info = await infoPermintaan();
  await db
    .update(users)
    .set({ gagalLogin: 0, terkunciSampai: null, lastLoginAt: new Date() })
    .where(eq(users.id, akun.id));
  await buatSesi(akun.id, info);
  await db.insert(auditLogs).values({
    actorId: akun.id,
    aksi: "MASUK",
    entitas: "users",
    entitasId: akun.id,
    ip: info.ip,
    userAgent: info.userAgent,
  });

  redirect(PERAN_ADMIN.includes(akun.role) ? "/admin" : "/");
}

const skemaDaftar = z
  .object({
    nama: z.string().trim().min(3, "Nama minimal 3 karakter"),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(POLA_USERNAME, "Username 3–40 karakter, hanya huruf kecil, angka, . dan _"),
    nik: z.string().trim().max(40).optional(),
    noHp: z.string().trim().min(9, "Nomor HP tidak valid"),
    /** Jabatan boleh kosong — admin yang menetapkan saat verifikasi. */
    positionId: z.string().uuid().optional().or(z.literal("")),
    password: z.string(),
    konfirmasi: z.string(),
  })
  .refine((v) => v.password === v.konfirmasi, {
    message: "Konfirmasi password tidak sama",
    path: ["konfirmasi"],
  });

/**
 * Pendaftaran mandiri. Akun dibuat dengan status PENDING_APPROVAL sehingga
 * belum bisa dipakai absen sampai admin memverifikasi (PRD §6.1 jalur B).
 */
export async function aksiDaftar(
  _prev: HasilForm | null,
  formData: FormData,
): Promise<HasilForm> {
  const parsed = skemaDaftar.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const isu = parsed.error.issues[0];
    return { ok: false, pesan: isu.message, field: String(isu.path[0]) };
  }

  const data = parsed.data;
  const lemah = periksaKekuatanPassword(data.password);
  if (lemah) return { ok: false, pesan: lemah, field: "password" };

  const db = await getDb();
  const [bentrok] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, data.username))
    .limit(1);

  if (bentrok) {
    return {
      ok: false,
      pesan: "Username sudah dipakai. Pilih yang lain.",
      field: "username",
    };
  }

  // Jabatan opsional: pada instalasi baru daftarnya masih kosong, dan admin
  // yang menetapkannya saat memverifikasi pendaftaran.
  const jabatan = data.positionId
    ? (
        await db
          .select({ id: positions.id, departmentId: positions.departmentId })
          .from(positions)
          .where(and(eq(positions.id, data.positionId), eq(positions.aktif, true)))
          .limit(1)
      )[0]
    : undefined;

  const [akun] = await db
    .insert(users)
    .values({
      username: data.username,
      nik: data.nik ? data.nik.toUpperCase() : null,
      passwordHash: await hashPassword(data.password),
      role: "KARYAWAN",
      status: "PENDING_APPROVAL",
    })
    .returning();

  await db.insert(employees).values({
    userId: akun.id,
    nama: data.nama,
    noHp: data.noHp,
    positionId: jabatan?.id ?? null,
    departmentId: jabatan?.departmentId ?? null,
    aktif: false,
  });

  const info = await infoPermintaan();
  await db.insert(auditLogs).values({
    actorId: akun.id,
    aksi: "DAFTAR_MANDIRI",
    entitas: "users",
    entitasId: akun.id,
    after: { username: data.username, nama: data.nama },
    ip: info.ip,
    userAgent: info.userAgent,
  });

  return {
    ok: true,
    pesan:
      "Pendaftaran terkirim. Hubungi admin untuk mengaktifkan akun Anda sebelum bisa absen.",
  };
}

export async function aksiKeluar() {
  await hapusSesi();
  redirect("/masuk");
}

/**
 * Mengeluarkan pengguna dari seluruh perangkat sekaligus.
 *
 * Berguna ketika seseorang lupa menutup sesinya di ponsel bersama atau di
 * komputer kantor: satu tombol mencabut semuanya, tanpa perlu tahu perangkat
 * mana saja yang masih terbuka.
 */
export async function aksiKeluarSemuaPerangkat() {
  const pengguna = await wajibMasuk();
  await cabutSemuaSesi(pengguna.userId);
  redirect("/masuk");
}
