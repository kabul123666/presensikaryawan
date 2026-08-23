import Link from "next/link";

import {
  daftarAnomali,
  hitungAnomali,
  type SaringanAnomali,
} from "@/features/admin/anomali";
import { TabelAnomali, type BarisAnomali } from "@/features/admin/tabel-anomali";
import { wajibAksesMenu } from "@/lib/auth/akses";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tinjau Anomali" };

const TAB: { nilai: SaringanAnomali; label: string }[] = [
  { nilai: "BELUM", label: "Perlu ditinjau" },
  { nilai: "SUDAH", label: "Sudah ditinjau" },
  { nilai: "SEMUA", label: "Semua" },
];

/**
 * Antrean tinjau anomali absensi.
 *
 * Dashboard hanya memperlihatkan lima teratas dan daftarnya tidak pernah
 * berkurang — tidak ada cara menyatakan "yang ini sudah saya periksa".
 * Halaman ini tempatnya.
 */
export default async function HalamanAnomali({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await wajibAksesMenu("anomali");
  const sp = await searchParams;

  const saringan: SaringanAnomali = TAB.some((t) => t.nilai === sp.status)
    ? (sp.status as SaringanAnomali)
    : "BELUM";

  const [baris, hitung] = await Promise.all([daftarAnomali(saringan), hitungAnomali()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-body text-2xl font-bold tracking-tight">Tinjau Anomali</h1>
        <p className="text-muted mt-1 text-sm">
          Absensi bertanda janggal dan yang tidak pernah ditutup. Penandanya tidak dihapus
          — yang dicatat hanya bahwa Anda sudah memeriksanya.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TAB.map((t) => (
          <Link
            key={t.nilai}
            href={`/admin/anomali?status=${t.nilai}`}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-input)] border px-3.5 text-sm font-semibold transition-colors",
              saringan === t.nilai
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-app bg-surface text-muted hover:text-body",
            )}
          >
            {t.label}
            <span className="tnum text-xs font-normal opacity-75">{hitung[t.nilai]}</span>
          </Link>
        ))}
      </div>

      <TabelAnomali baris={baris as BarisAnomali[]} />
    </div>
  );
}
