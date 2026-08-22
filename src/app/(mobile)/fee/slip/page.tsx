import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { TombolCetak } from "@/features/reports/tombol-cetak";
import { slipInsentif } from "@/features/procedures/service";
import { SlipInsentifCetak } from "@/features/procedures/slip-insentif";
import { bacaPengaturan } from "@/features/settings/service";
import { wajibMasuk } from "@/lib/auth/session";
import { tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "Slip Insentif" };

/**
 * Slip insentif milik karyawan yang sedang masuk.
 *
 * employeeId diambil dari sesi, tidak pernah dari URL — halaman ini hanya
 * bisa menampilkan slip pemiliknya sendiri, sekalipun ada yang menebak-nebak
 * alamatnya.
 */
export default async function HalamanSlipSaya({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const pengguna = await wajibMasuk();
  const sp = await searchParams;

  const [tahunKini, bulanKini] = tanggalWIB().split("-").map(Number);
  const cocok = /^(\d{4})-(\d{2})$/.exec(sp.bulan ?? "");
  const tahun = cocok ? Number(cocok[1]) : tahunKini;
  const bulan = cocok ? Number(cocok[2]) : bulanKini;

  const [slip, profil] = await Promise.all([
    slipInsentif(pengguna.employeeId, tahun, bulan),
    bacaPengaturan("profil_perusahaan"),
  ]);

  return (
    <div className="pb-6 lg:mx-auto lg:max-w-[720px]">
      <header className="bg-surface border-app pt-safe border-b px-5 pb-5 lg:rounded-[var(--radius-sheet)] lg:border lg:px-7 print:hidden">
        <Link
          href="/fee"
          className="text-muted hover:text-body inline-flex items-center gap-1.5 pt-4 text-[13px] font-medium transition-colors"
        >
          <ArrowLeft size={15} /> Kembali ke Fee Saya
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3">
          <h1 className="text-body text-[18px] font-bold">Slip Insentif</h1>
          <TombolCetak label="Cetak" />
        </div>
      </header>

      <div className="mt-4 px-5 lg:px-0 print:mt-0 print:px-0">
        <SlipInsentifCetak slip={slip} profil={profil} tahun={tahun} bulan={bulan} />
      </div>
    </div>
  );
}
