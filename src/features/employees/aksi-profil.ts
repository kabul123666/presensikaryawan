"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";

import { getDb } from "@/db/client";
import { employees } from "@/db/schema";
import { wajibMasuk } from "@/lib/auth/session";
import { MAKS_UKURAN_FOTO, terlihatSepertiGambar } from "@/lib/foto";
import { storage } from "@/lib/storage";

export type HasilProfil = { ok: boolean; pesan: string };

/**
 * Mengunggah foto profil.
 *
 * Gambarnya dipotong bujur sangkar dan diperkecil di server, bukan sekadar
 * disimpan apa adanya: foto kamera ponsel bisa berukuran beberapa megabita,
 * padahal yang ditampilkan tidak pernah lebih besar dari seratus piksel.
 * Sekalian di-encode ulang sehingga metadata bawaan kamera — termasuk
 * koordinat tempat foto diambil — tidak ikut tersimpan.
 */
export async function aksiUnggahFotoProfil(formData: FormData): Promise<HasilProfil> {
  const pengguna = await wajibMasuk();

  const berkas = formData.get("foto");
  if (!(berkas instanceof File) || berkas.size === 0) {
    return { ok: false, pesan: "Pilih berkas fotonya dulu." };
  }
  if (berkas.size > MAKS_UKURAN_FOTO) {
    return { ok: false, pesan: "Ukuran foto terlalu besar." };
  }

  const buf = Buffer.from(await berkas.arrayBuffer());
  if (!terlihatSepertiGambar(buf)) {
    return {
      ok: false,
      pesan:
        "Pilih foto berformat JPG, PNG, atau WebP. Foto HEIC dari iPhone perlu diubah dulu lewat menu bagikan.",
    };
  }

  // Berkas yang lolos pemeriksaan awal pun masih bisa terpotong atau rusak.
  // Tanpa penangkap ini, kegagalannya keluar sebagai galat server tanpa
  // penjelasan, dan yang mengunggah tidak tahu harus berbuat apa.
  let jadi: Buffer;
  try {
    jadi = await sharp(buf)
      .rotate()
      .resize(320, 320, { fit: "cover", position: "centre" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
  } catch {
    return {
      ok: false,
      pesan: "Foto tidak bisa dibaca — berkasnya mungkin rusak. Coba potret ulang.",
    };
  }

  const kunci = `profil/${pengguna.employeeId}-${Date.now()}.jpg`;
  await storage().put(kunci, jadi, "image/jpeg");

  const db = await getDb();
  await db
    .update(employees)
    .set({ fotoProfil: kunci })
    .where(eq(employees.id, pengguna.employeeId));

  revalidatePath("/profil");
  revalidatePath("/");
  return { ok: true, pesan: "Foto profil diperbarui." };
}

const skemaStiker = z.enum(["PRIA", "WANITA", "TANPA"]);

/** Memilih gambar diri bawaan, atau kembali memakai inisial. */
export async function aksiPilihStiker(pilihan: string): Promise<HasilProfil> {
  const pengguna = await wajibMasuk();

  const parsed = skemaStiker.safeParse(pilihan);
  if (!parsed.success) return { ok: false, pesan: "Pilihan tidak dikenali." };

  const db = await getDb();
  await db
    .update(employees)
    .set({
      jenisKelamin: parsed.data === "TANPA" ? null : parsed.data,
      // Stiker menggantikan foto; menyisakan keduanya membuat foto lama tetap
      // menang saat ditampilkan dan pilihan barunya seolah tidak tersimpan.
      fotoProfil: null,
    })
    .where(eq(employees.id, pengguna.employeeId));

  revalidatePath("/profil");
  revalidatePath("/");
  return { ok: true, pesan: "Gambar diri diperbarui." };
}
