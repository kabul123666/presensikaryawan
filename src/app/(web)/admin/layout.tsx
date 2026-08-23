import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { NavBawah } from "@/components/mobile/nav-bawah";
import { SidebarAdmin } from "@/components/web/sidebar-admin";
import { TopbarAdmin } from "@/components/web/topbar-admin";
import { ringkasanHariIni } from "@/features/admin/service";
import { aksesMenuPengguna } from "@/lib/auth/akses";
import { PERAN_PENYETUJU, wajibPeran } from "@/lib/auth/session";

/**
 * Kerangka modul admin.
 *
 * Di layar besar ia dashboard sungguhan: sidebar tetap di kiri, topbar
 * informatif, area konten lebar untuk tabel padat.
 *
 * Di ponsel ia sengaja **bukan** aplikasi kedua. Modul admin dibuka dari menu
 * yang sama dengan menu karyawan, jadi kerangkanya pun harus sama: bilah bawah
 * yang sama, lebar yang sama, dan satu bilah kembali ke menu di atasnya.
 * Sebelumnya di sini ada topbar dan bilah bawah khusus admin — menekan sebuah
 * petak menu terasa melompat ke aplikasi lain, dan itu memang membingungkan.
 *
 * Tinggi kerangka dikunci ke tinggi layar dan hanya area isi yang bergulir,
 * sehingga bilah bawah cukup jadi elemen flex biasa. Elemen `position: fixed`
 * ikut tergeser bilah alamat peramban ponsel yang menciut saat digulir.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pengguna = await wajibPeran(...PERAN_PENYETUJU);
  const ringkas = await ringkasanHariIni();
  const izin = await aksesMenuPengguna(pengguna);

  return (
    <div className="bg-app flex h-dvh flex-col overflow-hidden lg:block lg:h-auto lg:min-h-dvh lg:overflow-visible">
      <SidebarAdmin
        badge={{
          persetujuan: ringkas.menungguPersetujuan,
          pendaftaran: ringkas.pendaftaranBaru,
        }}
        izin={izin}
      />

      {/*
        Lebar dikunci selebar ponsel di bawah `lg` — sama persis dengan kerangka
        karyawan — supaya berpindah dari menu ke modul admin tidak terasa
        berganti aplikasi.
      */}
      <div className="mx-auto flex min-h-0 w-full max-w-[430px] min-w-0 flex-1 flex-col lg:mx-0 lg:block lg:max-w-none lg:flex-none lg:pl-[248px]">
        <div className="bg-surface border-app pt-safe flex shrink-0 items-center gap-3 border-b px-4 pb-3 lg:hidden">
          <Link
            href="/menu"
            className="text-muted hover:bg-surface-muted hover:text-body grid size-9 place-items-center rounded-full transition-colors"
            aria-label="Kembali ke menu"
          >
            <ArrowLeft size={20} />
          </Link>
          <span className="text-body text-[15px] font-bold">Menu Admin</span>
        </div>

        <TopbarAdmin
          nama={pengguna.nama}
          peran={pengguna.role}
          jabatan={pengguna.namaJabatan}
        />

        <main className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overscroll-contain lg:overflow-visible">
          <div className="mx-auto max-w-[1400px] px-5 pt-5 pb-6 lg:px-8 lg:py-6">
            {children}
          </div>
        </main>

        <footer className="text-subtle border-app mt-8 hidden border-t px-5 py-5 text-xs lg:block lg:px-8">
          Presensi Karyawan ·{" "}
          <Link href="/" className="hover:text-body font-semibold">
            Buka tampilan karyawan
          </Link>
        </footer>
      </div>

      <NavBawah role={pengguna.role} />
    </div>
  );
}
