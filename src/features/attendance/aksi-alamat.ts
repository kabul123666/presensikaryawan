"use server";

import { alamatDariKoordinat } from "@/lib/geo";
import { wajibMasuk } from "@/lib/auth/session";

/**
 * Menerjemahkan koordinat menjadi alamat untuk ditampilkan sebelum absen.
 *
 * Dikerjakan di server, bukan dari peramban: Nominatim membatasi permintaan
 * per alamat IP dan mensyaratkan User-Agent yang bisa dihubungi, dan hasilnya
 * di sini masuk cache yang sama dengan yang dipakai saat absen tercatat —
 * jadi satu karyawan yang berdiri di tempat yang sama tidak memanggil layanan
 * itu dua kali.
 *
 * Kegagalan tidak pernah memblokir absensi: yang dikembalikan cukup null dan
 * layar menampilkan nama lokasi kerja sebagai gantinya.
 */
export async function aksiAlamatSekarang(
  lat: number,
  lng: number,
): Promise<string | null> {
  await wajibMasuk();

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return alamatDariKoordinat(lat, lng);
}
