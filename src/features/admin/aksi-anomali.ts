"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import { attendances, auditLogs } from "@/db/schema";
import { PERAN_ADMIN, wajibPeran } from "@/lib/auth/session";

export type HasilTinjau = { ok: boolean; pesan: string };

const skema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  catatan: z.string().trim().max(300).optional(),
});

/**
 * Menandai anomali sudah ditinjau.
 *
 * Penanda di `flags` sengaja dibiarkan utuh — ia bukti apa yang terjadi saat
 * absen tercatat, bukan status pekerjaan. Yang berubah hanya catatan bahwa
 * seorang admin sudah melihatnya, lengkap dengan nama dan waktunya.
 */
export async function aksiTandaiDitinjau(
  ids: string[],
  catatan?: string,
): Promise<HasilTinjau> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);

  const parsed = skema.safeParse({ ids, catatan });
  if (!parsed.success) return { ok: false, pesan: "Baris tidak dikenali." };

  const db = await getDb();
  const hasil = await db
    .update(attendances)
    .set({
      ditinjauAt: new Date(),
      ditinjauOleh: pengguna.userId,
      catatanTinjau: parsed.data.catatan ?? null,
      updatedAt: new Date(),
    })
    .where(inArray(attendances.id, parsed.data.ids))
    .returning();

  if (hasil.length === 0) return { ok: false, pesan: "Tidak ada baris yang berubah." };

  const h = await headers();
  await db.insert(auditLogs).values({
    actorId: pengguna.userId,
    aksi: "TINJAU_ANOMALI",
    entitas: "attendances",
    after: { jumlah: hasil.length, catatan: parsed.data.catatan ?? null },
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  });

  revalidatePath("/admin/anomali");
  revalidatePath("/admin");
  return { ok: true, pesan: `${hasil.length} baris ditandai sudah ditinjau.` };
}

/** Mengembalikan baris ke antrean bila ternyata masih perlu dilihat lagi. */
export async function aksiBatalTinjau(id: string): Promise<HasilTinjau> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, pesan: "Baris tidak dikenali." };
  }

  const db = await getDb();
  await db
    .update(attendances)
    .set({
      ditinjauAt: null,
      ditinjauOleh: null,
      catatanTinjau: null,
      updatedAt: new Date(),
    })
    .where(inArray(attendances.id, [id]));

  const h = await headers();
  await db.insert(auditLogs).values({
    actorId: pengguna.userId,
    aksi: "BATAL_TINJAU_ANOMALI",
    entitas: "attendances",
    entitasId: id,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  });

  revalidatePath("/admin/anomali");
  revalidatePath("/admin");
  return { ok: true, pesan: "Baris dikembalikan ke antrean tinjau." };
}
