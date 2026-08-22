"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import { auditLogs, periodLocks } from "@/db/schema";
import { PERAN_ADMIN, wajibPeran } from "@/lib/auth/session";
import { tanggalWIB } from "@/lib/waktu";
import { kunciPeriode } from "./kunci";
import { rekapPeriode, rentangPeriode } from "./service";

export type HasilKunci = { ok: boolean; pesan: string };

const skema = z.object({
  tahun: z.number().int().min(2000).max(2100),
  bulan: z.number().int().min(1).max(12),
  catatan: z.string().trim().max(300).optional(),
});

async function jejak() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  };
}

/**
 * Mengunci sebuah periode rekap.
 *
 * Rekapnya dihitung sekali untuk seluruh karyawan — tanpa penyaring
 * departemen — lalu disimpan apa adanya. Menyimpan hasil yang sudah disaring
 * akan membuat periode yang sama punya dua angka berbeda tergantung siapa yang
 * kebetulan menekan tombolnya.
 */
export async function aksiKunciPeriode(
  tahun: number,
  bulan: number,
  catatan?: string,
): Promise<HasilKunci> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);

  const parsed = skema.safeParse({ tahun, bulan, catatan });
  if (!parsed.success) return { ok: false, pesan: "Periode tidak valid." };

  const rentang = await rentangPeriode(parsed.data.tahun, parsed.data.bulan);

  // Periode yang belum selesai tidak boleh dikunci: harinya masih bisa
  // bertambah, dan membekukan angka setengah jalan justru menyesatkan.
  if (rentang.akhir >= tanggalWIB()) {
    return {
      ok: false,
      pesan: "Periode ini belum selesai. Kunci setelah tanggal terakhirnya lewat.",
    };
  }

  const sudah = await kunciPeriode(rentang.mulai, rentang.akhir);
  if (sudah) return { ok: false, pesan: "Periode ini sudah dikunci." };

  const baris = await rekapPeriode(rentang);

  const db = await getDb();
  await db.insert(periodLocks).values({
    mulai: rentang.mulai,
    akhir: rentang.akhir,
    rekap: baris as unknown as Record<string, unknown>[],
    dikunciOleh: pengguna.userId,
    catatan: parsed.data.catatan ?? null,
  });

  const info = await jejak();
  await db.insert(auditLogs).values({
    actorId: pengguna.userId,
    aksi: "KUNCI_PERIODE",
    entitas: "period_locks",
    after: {
      mulai: rentang.mulai,
      akhir: rentang.akhir,
      jumlahKaryawan: baris.length,
    },
    ip: info.ip,
    userAgent: info.userAgent,
  });

  revalidatePath("/admin/absensi");
  return {
    ok: true,
    pesan: `Periode ${rentang.mulai} sampai ${rentang.akhir} dikunci. Angkanya tidak akan berubah lagi.`,
  };
}

/**
 * Membuka kembali periode yang terkunci.
 *
 * Sengaja dibatasi super admin: membuka kunci berarti angka yang sudah dipakai
 * membayar orang bisa bergeser lagi, dan itu keputusan pemilik sistem — bukan
 * langkah rutin admin.
 */
export async function aksiBukaKunciPeriode(id: string): Promise<HasilKunci> {
  const pengguna = await wajibPeran("SUPER_ADMIN");

  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, pesan: "Kunci tidak dikenali." };
  }

  const db = await getDb();
  const [kunci] = await db
    .select()
    .from(periodLocks)
    .where(eq(periodLocks.id, id))
    .limit(1);
  if (!kunci) return { ok: false, pesan: "Kunci tidak ditemukan." };

  await db.delete(periodLocks).where(eq(periodLocks.id, id));

  const info = await jejak();
  await db.insert(auditLogs).values({
    actorId: pengguna.userId,
    aksi: "BUKA_KUNCI_PERIODE",
    entitas: "period_locks",
    entitasId: id,
    before: { mulai: kunci.mulai, akhir: kunci.akhir },
    ip: info.ip,
    userAgent: info.userAgent,
  });

  revalidatePath("/admin/absensi");
  return { ok: true, pesan: "Kunci dibuka. Rekap periode ini dihitung ulang lagi." };
}
