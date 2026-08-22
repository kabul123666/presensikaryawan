"use client";

import { Check } from "lucide-react";

import { terapkanWarna, useWarna, type Warna } from "@/lib/tema";
import { cn } from "@/lib/utils";

/**
 * Pemilih warna aplikasi.
 *
 * Contoh warnanya ditulis langsung di sini sebagai nilai heksadesimal, bukan
 * lewat kelas `bg-brand-*`: petak contoh harus memperlihatkan warna yang
 * ditawarkan, sedangkan `bg-brand-*` selalu mengikuti warna yang sedang
 * aktif — semua petak akan tampak sama dan tak ada yang bisa dipilih.
 */
const PILIHAN: { nilai: Warna; label: string; contoh: string }[] = [
  { nilai: "hijau", label: "Hijau", contoh: "#0f5340" },
  { nilai: "biru", label: "Biru", contoh: "#1b476f" },
  { nilai: "ungu", label: "Ungu", contoh: "#4a3565" },
  { nilai: "jingga", label: "Jingga", contoh: "#8a4620" },
  { nilai: "merah", label: "Merah", contoh: "#822e3e" },
];

export function PilihWarna() {
  const warna = useWarna();

  return (
    <div className="mt-4 grid grid-cols-5 gap-2">
      {PILIHAN.map(({ nilai, label, contoh }) => {
        const aktif = warna === nilai;

        return (
          <button
            key={nilai}
            type="button"
            onClick={() => terapkanWarna(nilai)}
            aria-pressed={aktif}
            className="flex flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "grid size-10 place-items-center rounded-full transition-transform",
                aktif
                  ? "ring-brand-500 ring-2 ring-offset-2 ring-offset-[var(--surface)]"
                  : "hover:scale-105",
              )}
              style={{ backgroundColor: contoh }}
            >
              {aktif && <Check size={17} className="text-white" strokeWidth={3} />}
            </span>
            <span
              className={cn(
                "text-[11px] font-semibold",
                aktif ? "text-body" : "text-muted",
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
