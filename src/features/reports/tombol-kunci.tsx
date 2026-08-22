"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, LockOpen } from "lucide-react";

import { aksiBukaKunciPeriode, aksiKunciPeriode } from "./aksi-kunci";

/**
 * Mengunci atau membuka periode rekap.
 *
 * Keduanya meminta penegasan lebih dulu. Mengunci menghentikan koreksi absen
 * untuk seluruh rentang, dan membuka kembali membuat angka yang mungkin sudah
 * dibayarkan bisa bergeser lagi — dua-duanya bukan hal yang pantas terjadi
 * karena tombolnya kesenggol.
 */
export function TombolKunci({
  tahun,
  bulan,
  kunciId,
  bolehBuka,
}: {
  tahun: number;
  bulan: number;
  /** Terisi bila periode yang sedang dilihat sudah dikunci. */
  kunciId?: string;
  bolehBuka: boolean;
}) {
  const router = useRouter();
  const [proses, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [konfirmasi, setKonfirmasi] = useState(false);

  const jalankan = () =>
    mulai(async () => {
      const hasil = kunciId
        ? await aksiBukaKunciPeriode(kunciId)
        : await aksiKunciPeriode(tahun, bulan);
      setPesan(hasil.pesan);
      setKonfirmasi(false);
      if (hasil.ok) router.refresh();
    });

  if (kunciId && !bolehBuka) return null;

  return (
    <div className="print:hidden">
      {konfirmasi ? (
        <div className="bg-surface border-app flex items-center gap-2 rounded-[var(--radius-input)] border px-3 py-2">
          <span className="text-body text-xs">
            {kunciId
              ? "Buka kunci? Angka periode ini bisa berubah lagi."
              : "Kunci periode ini? Absensinya tidak bisa dikoreksi lagi."}
          </span>
          <button
            onClick={jalankan}
            disabled={proses}
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-input)] px-3 text-xs font-semibold text-white disabled:opacity-60"
          >
            {proses && <Loader2 size={13} className="animate-spin" />} Ya
          </button>
          <button
            onClick={() => setKonfirmasi(false)}
            disabled={proses}
            className="text-muted hover:text-body h-8 px-2 text-xs font-semibold"
          >
            Batal
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setPesan(null);
            setKonfirmasi(true);
          }}
          className="border-app-strong bg-surface text-body hover:bg-surface-muted inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-input)] border px-4 text-sm font-semibold transition-colors"
        >
          {kunciId ? <LockOpen size={15} /> : <Lock size={15} />}
          {kunciId ? "Buka kunci" : "Kunci periode"}
        </button>
      )}

      {pesan && (
        <p role="status" className="text-muted mt-1.5 max-w-[22rem] text-xs">
          {pesan}
        </p>
      )}
    </div>
  );
}
