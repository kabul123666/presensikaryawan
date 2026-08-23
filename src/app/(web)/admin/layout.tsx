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

  return (
    <div className="bg-app min-h-dvh">
      <SidebarAdmin
        badge={{
          persetujuan: ringkas.menungguPersetujuan,
          pendaftaran: ringkas.pendaftaranBaru,
        }}
        izin={izin}
      />

      <div className="lg:pl-[248px]">
        <TopbarAdmin
          nama={pengguna.nama}
          peran={pengguna.role}
          jabatan={pengguna.namaJabatan}
        />
        <main className="mx-auto max-w-[1400px] px-5 pt-5 pb-24 lg:px-8 lg:py-6">
          {children}
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
