"use client";

import Link from "next/link";
import { ChevronRight, LogIn, LogOut, ScanFace } from "lucide-react";

import { useJamDetik } from "@/lib/gunakan-jam";
import { cn } from "@/lib/utils";

type Props = {
  sudahMasuk: boolean;
  sudahPulang: boolean;
  jamMasuk: string | null;
  jamPulang: string | null;
  jadwal: { nama: string; jamMasuk: string; jamPulang: string } | null;
  /** Kebijakan admin: karyawan tanpa shift hari itu tetap boleh absen. */
  bolehTanpaShift: boolean;
};

/**
 * Ringkasan absen di beranda.
 *
 * Sejak absen punya layarnya sendiri, kartu ini tidak lagi memuat tombol
 * piringan besar yang memakan hampir seluruh layar beranda — ia cukup
 * menunjukkan jam, apa yang sudah tercatat hari ini, dan satu tombol yang
 * membuka layar absen. Beranda kembali muat menampilkan menu tanpa digulir.
 */
export function KartuAbsen({
  sudahMasuk,
  sudahPulang,
  jamMasuk,
  jamPulang,
  jadwal,
  bolehTanpaShift,
}: Props) {
  const jam = useJamDetik();

  const mode = sudahMasuk ? "pulang" : "masuk";
  const selesai = sudahMasuk && sudahPulang;
  const bisaAbsen = Boolean(jadwal) || bolehTanpaShift || sudahMasuk;

  return (
    <div className="px-5 lg:px-0">
      <div className="bg-surface border-app rounded-[var(--radius-card)] border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Waktu sekarang · WIB</p>
            <p className="tnum text-body mt-1 text-[30px] leading-none font-medium">
              {jam}
            </p>
          </div>

          <Link
            href="/jadwal"
            className="hover:bg-surface-muted -mr-1 flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 transition-colors"
          >
            <span className="text-right">
              {jadwal ? (
                <>
                  <span className="text-body block text-[13px] font-bold">
                    {jadwal.nama}
                  </span>
                  <span className="tnum text-subtle block text-[11px]">
                    {jadwal.jamMasuk.slice(0, 5)}–{jadwal.jamPulang.slice(0, 5)}
                  </span>
                </>
              ) : bolehTanpaShift ? (
                <span className="text-subtle block text-[11px]">Tanpa shift</span>
              ) : (
                <span className="text-warn-600 dark:text-warn-500 block text-[11px] font-semibold">
                  Shift belum diatur
                </span>
              )}
            </span>
            <ChevronRight size={15} className="text-subtle shrink-0" />
          </Link>
        </div>

        <div className="border-app mt-3 grid grid-cols-2 gap-2 border-t pt-3">
          {[
            { Ikon: LogIn, label: "Masuk", nilai: jamMasuk, warna: "text-status-ontime" },
            {
              Ikon: LogOut,
              label: "Pulang",
              nilai: jamPulang,
              warna: "text-status-absent",
            },
          ].map((k) => (
            <div key={k.label} className="flex items-center gap-2">
              <k.Ikon size={15} className={cn("shrink-0", k.warna)} />
              <span>
                <span className="text-subtle block text-[10px] font-semibold">
                  {k.label}
                </span>
                <span className="text-body tnum block text-[14px] font-extrabold">
                  {k.nilai ?? "--:--"}
                </span>
              </span>
            </div>
          ))}
        </div>

        {selesai ? (
          <p className="bg-surface-muted text-muted mt-3 rounded-[var(--radius-input)] px-4 py-3 text-center text-[13px] font-semibold">
            Absen hari ini selesai
          </p>
        ) : (
          <Link
            href="/riwayat"
            aria-disabled={!bisaAbsen}
            className={cn(
              "mt-3 flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white transition-colors",
              mode === "masuk"
                ? "bg-brand-600 hover:bg-brand-700"
                : "bg-warn-600 hover:bg-warn-700",
              !bisaAbsen && "pointer-events-none opacity-45",
            )}
          >
            <ScanFace size={19} />
            {mode === "masuk" ? "Check In" : "Check Out"}
          </Link>
        )}
      </div>
    </div>
  );
}
