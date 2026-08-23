import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { slipInsentif } from "@/features/procedures/service";
import { SlipInsentifCetak } from "@/features/procedures/slip-insentif";
import { TombolCetak } from "@/features/reports/tombol-cetak";
import { bacaPengaturan } from "@/features/settings/service";
import { wajibAksesMenu } from "@/lib/auth/akses";
import { namaBulan, tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "Slip Insentif" };

export default async function HalamanSlipKaryawan({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ bulan?: string }>;
}) {
  await wajibAksesMenu("tindakan");
  const { employeeId } = await params;
  const sp = await searchParams;

  const [tahunKini, bulanKini] = tanggalWIB().split("-").map(Number);
  const cocok = /^(\d{4})-(\d{2})$/.exec(sp.bulan ?? "");
  const tahun = cocok ? Number(cocok[1]) : tahunKini;
  const bulan = cocok ? Number(cocok[2]) : bulanKini;

  const [slip, profil] = await Promise.all([
    slipInsentif(employeeId, tahun, bulan),
    bacaPengaturan("profil_perusahaan"),
  ]);

  const geser = (delta: number) => {
    const m = bulan + delta;
    const t = tahun + Math.floor((m - 1) / 12);
    const b = ((((m - 1) % 12) + 12) % 12) + 1;
    return `/admin/tindakan/slip/${employeeId}?bulan=${t}-${String(b).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <Link
          href={`/admin/tindakan?tab=rekap&bulan=${tahun}-${String(bulan).padStart(2, "0")}`}
          className="text-muted hover:text-body inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors"
        >
          <ArrowLeft size={15} /> Kembali ke Rekap Fee
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-body text-xl font-extrabold tracking-tight">
              Slip Insentif
            </h1>
            <p className="text-muted mt-0.5 text-sm">
              {slip.karyawan?.nama ?? "Karyawan tidak ditemukan"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="border-app bg-surface flex items-center rounded-[var(--radius-input)] border">
              <Link
                href={geser(-1)}
                className="text-muted hover:bg-surface-muted grid size-9 place-items-center rounded-l-[var(--radius-input)] transition-colors"
                aria-label="Bulan sebelumnya"
              >
                <ChevronLeft size={17} />
              </Link>
              <span className="text-body px-3 text-sm font-bold whitespace-nowrap">
                {namaBulan(tahun, bulan)}
              </span>
              <Link
                href={geser(1)}
                className="text-muted hover:bg-surface-muted grid size-9 place-items-center rounded-r-[var(--radius-input)] transition-colors"
                aria-label="Bulan berikutnya"
              >
                <ChevronRight size={17} />
              </Link>
            </div>
            <TombolCetak label="Cetak / PDF" />
          </div>
        </div>
      </div>

      <SlipInsentifCetak slip={slip} profil={profil} tahun={tahun} bulan={bulan} />
    </div>
  );
}
