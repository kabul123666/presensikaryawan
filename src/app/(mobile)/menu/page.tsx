import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MenuAplikasi } from "@/components/mobile/menu-aplikasi";
import { aksesMenuPengguna } from "@/lib/auth/akses";
import { PERAN_PENYETUJU, wajibMasuk } from "@/lib/auth/session";

export const metadata = { title: "Menu" };

/**
 * Seluruh menu aplikasi.
 *
 * Beranda hanya memuat yang paling sering dipakai; halaman ini menampung
 * sisanya supaya tidak ada modul yang hanya bisa ditemukan dengan menghafal
 * alamatnya.
 */
export default async function HalamanMenu() {
  const pengguna = await wajibMasuk();

  // Modul panel admin ikut ditampilkan di sini — satu halaman menu untuk
  // semuanya, dengan bahasa visual yang sama. Yang tidak berhak tidak melihat
  // petaknya, dan halamannya sendiri tetap menolak bila alamatnya diketik.
  const penyetuju = PERAN_PENYETUJU.includes(pengguna.role);
  const izinAdmin = penyetuju ? await aksesMenuPengguna(pengguna) : [];

  return (
    <div className="pb-6">
      <header className="bg-surface border-app pt-safe border-b px-5 pb-5 lg:rounded-[var(--radius-sheet)] lg:border lg:px-7">
        <Link
          href="/"
          className="text-muted hover:text-body inline-flex items-center gap-1.5 pt-4 text-[13px] font-medium transition-colors lg:hidden"
        >
          <ArrowLeft size={15} /> Beranda
        </Link>
        <h1 className="text-body mt-3 text-[18px] font-bold lg:mt-2">Semua Menu</h1>
      </header>

      <MenuAplikasi
        penyetuju={penyetuju}
        kepalaUnit={pengguna.role === "MANAGER"}
        izinAdmin={izinAdmin}
      />
    </div>
  );
}
