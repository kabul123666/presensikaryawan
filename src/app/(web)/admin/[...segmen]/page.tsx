import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { PERAN_PENYETUJU, wajibPeran } from "@/lib/auth/session";

/**
 * Penampung alamat admin yang tidak dikenali.
 * Seluruh modul sudah punya halamannya sendiri, jadi rute yang sampai ke sini
 * memang salah ketik atau tautan lama.
 */
export default async function HalamanTidakDikenal() {
  await wajibPeran(...PERAN_PENYETUJU);

  return (
    <div className="grid min-h-[60dvh] place-items-center px-6 py-12">
      <div className="max-w-md text-center">
        <div className="bg-surface-muted mx-auto grid size-16 place-items-center rounded-full">
          <FileQuestion className="text-subtle" size={30} />
        </div>
        <h1 className="text-body mt-5 text-xl font-bold tracking-tight">
          Halaman tidak ditemukan
        </h1>
        <p className="text-muted mt-3 text-[15px] leading-relaxed">
          Alamat yang Anda buka tidak dikenali. Gunakan menu untuk berpindah modul.
        </p>
        <Link
          href="/admin"
          className="border-app-strong bg-surface text-body hover:bg-surface-muted mt-7 inline-flex h-11 items-center rounded-[var(--radius-input)] border px-5 text-sm font-semibold transition-colors"
        >
          Kembali ke dashboard
        </Link>
      </div>
    </div>
  );
}
