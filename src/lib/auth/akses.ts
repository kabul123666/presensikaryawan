import "server-only";

import { redirect } from "next/navigation";

import { bacaPengaturan, SEMUA_KUNCI_MENU } from "@/features/settings/service";
import { PERAN_PENYETUJU, wajibPeran, type PenggunaSesi } from "./session";

/**
 * Penjaga modul admin.
 *
 * Menyembunyikan menu bukan pengamanan — siapa pun bisa mengetik alamatnya.
 * Fungsi inilah pengamanannya: tiap halaman admin memanggilnya dengan kunci
 * modulnya sendiri, dan yang tidak berhak dilempar ke layar "tidak berwenang"
 * sebelum satu baris data pun dibaca.
 *
 * Super admin selalu lolos. Ia pemilik sistem, dan mengunci dirinya sendiri
 * lewat salah centang berarti tidak ada lagi yang bisa membukanya kembali.
 */
export async function wajibAksesMenu(kunci: string): Promise<PenggunaSesi> {
  const pengguna = await wajibPeran(...PERAN_PENYETUJU);
  if (pengguna.role === "SUPER_ADMIN") return pengguna;

  const akses = await bacaPengaturan("akses_menu");
  const daftar = pengguna.role === "ADMIN" ? akses.ADMIN : akses.MANAGER;

  if (!daftar.includes(kunci)) redirect("/tidak-berwenang");
  return pengguna;
}

/** Kunci modul yang boleh dibuka seorang pengguna — untuk menyaring menu. */
export async function aksesMenuPengguna(pengguna: PenggunaSesi): Promise<string[]> {
  // Daftar penuh, bukan gabungan pengaturan kedua peran: mencabut sebuah modul
  // dari Admin dan Kepala Unit sekaligus tidak boleh ikut menyembunyikannya
  // dari pemilik, yang justru satu-satunya orang yang bisa mengembalikannya.
  if (pengguna.role === "SUPER_ADMIN") return [...SEMUA_KUNCI_MENU];

  const akses = await bacaPengaturan("akses_menu");
  return pengguna.role === "ADMIN" ? akses.ADMIN : akses.MANAGER;
}
