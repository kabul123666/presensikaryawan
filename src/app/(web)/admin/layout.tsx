import Link from "next/link";

import { NavBawahAdmin } from "@/components/web/nav-bawah-admin";
import { SidebarAdmin } from "@/components/web/sidebar-admin";
import { TopbarAdmin } from "@/components/web/topbar-admin";
import { ringkasanHariIni } from "@/features/admin/service";
import { aksesMenuPengguna } from "@/lib/auth/akses";
import { PERAN_PENYETUJU, wajibPeran } from "@/lib/auth/session";

/**
 * Kerangka dashboard admin.
 *
 * Di layar besar: sidebar tetap di kiri, topbar informatif, area konten lebar
 * untuk tabel padat. Di ponsel bentuknya berganti seperti aplikasi karyawan —
 * navigasi bawah untuk empat tujuan yang paling sering dibuka, sisanya lewat
 * halaman Menu. Sebelumnya satu-satunya jalan adalah laci hamburger, dan menu
 * yang jarang dipakai praktis tak pernah ditemukan sambil memantau dari
 * ponsel.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pengguna = await wajibPeran(...PERAN_PENYETUJU);
  const ringkas = await ringkasanHariIni();
  const izin = await aksesMenuPengguna(pengguna);

  /*
   * Di ponsel tinggi kerangka dikunci ke tinggi layar dan hanya area isi yang
   * bergulir, sehingga bilah menu bawah cukup jadi elemen flex biasa.
   *
   * Sebelumnya bilah itu `position: fixed`, dan di peramban ponsel bilah
   * alamat yang menciut lalu mengembang saat digulir ikut menggeser elemen
   * fixed — menunya terlihat naik-turun, bahkan sempat hilang di bawah lipatan.
   * Pola yang sama sudah dipakai aplikasi karyawan dan tidak pernah bermasalah.
   *
   * Mulai lebar lg semuanya kembali ke aliran dokumen biasa: sidebar melayang
   * di kiri, halaman bergulir seperti halaman web pada umumnya.
   */
  return (
    <div className="bg-app flex h-dvh flex-col overflow-hidden lg:block lg:h-auto lg:min-h-dvh lg:overflow-visible">
      <SidebarAdmin
        badge={{
          persetujuan: ringkas.menungguPersetujuan,
          pendaftaran: ringkas.pendaftaranBaru,
        }}
        izin={izin}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:block lg:pl-[248px]">
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

      <NavBawahAdmin menunggu={ringkas.menungguPersetujuan} />
    </div>
  );
}
