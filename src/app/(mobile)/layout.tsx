import { eq } from "drizzle-orm";

import type { JenisKelamin } from "@/components/mobile/avatar";
import { NavBawah } from "@/components/mobile/nav-bawah";
import { SidebarDesktop } from "@/components/karyawan/sidebar-desktop";
import { getDb } from "@/db/client";
import { employees } from "@/db/schema";
import { jumlahBelumDibaca } from "@/features/notifications/service";
import { PERAN_ADMIN, PERAN_PENYETUJU, wajibMasuk } from "@/lib/auth/session";

/**
 * Kerangka aplikasi karyawan.
 *
 * Satu kerangka melayani dua bentuk. Di ponsel: satu kolom, navigasi bilah
 * bawah, target sentuh besar. Mulai lebar `lg`: sidebar kiri dan area isi
 * lebar seperti aplikasi kepegawaian di komputer — bukan lagi bingkai ponsel
 * yang ditaruh di tengah layar kosong, karena karyawan yang membuka dari
 * komputer kantor mendapat tampilan yang terlihat belum jadi.
 *
 * Halamannya sendiri tetap satu berkas untuk kedua bentuk; yang berubah hanya
 * lebar dan susunan kolomnya lewat varian `lg:`.
 */
export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const pengguna = await wajibMasuk();
  const db = await getDb();

  const [detail] = await db
    .select({
      fotoProfil: employees.fotoProfil,
      jenisKelamin: employees.jenisKelamin,
    })
    .from(employees)
    .where(eq(employees.id, pengguna.employeeId))
    .limit(1);

  const belumDibaca = await jumlahBelumDibaca(pengguna.userId);

  return (
    <div className="bg-app flex h-dvh overflow-hidden">
      <SidebarDesktop
        nama={pengguna.nama}
        jabatan={pengguna.namaJabatan}
        lokasi={pengguna.namaLokasi}
        fotoUrl={detail?.fotoProfil ? `/api/berkas/${detail.fotoProfil}` : null}
        jenisKelamin={detail?.jenisKelamin as JenisKelamin}
        penyetuju={PERAN_PENYETUJU.includes(pengguna.role)}
        admin={PERAN_ADMIN.includes(pengguna.role)}
        belumDibaca={belumDibaca}
      />

      {/*
        Di bawah `lg` kolom ini dikunci selebar ponsel beserta bilah bawahnya,
        supaya di tablet keduanya tetap satu kesatuan dan bilah bawah tidak
        melebar sendiri meninggalkan isinya.
      */}
      <div className="mx-auto flex w-full max-w-[430px] min-w-0 flex-col lg:mx-0 lg:max-w-none lg:flex-1">
        <main className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="lg:mx-auto lg:w-full lg:max-w-[1120px] lg:px-8 lg:py-7">
            {children}
          </div>
        </main>
        <NavBawah role={pengguna.role} />
      </div>
    </div>
  );
}
