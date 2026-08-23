"use client";

import { useActionState, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MENU_ADMIN } from "@/components/web/menu-admin";
import type { AksesMenu } from "@/features/settings/service";
import { cn } from "@/lib/utils";
import { aksiSimpanAksesMenu, type HasilPengaturan } from "./actions";

const PERAN = [
  {
    kunci: "ADMIN" as const,
    label: "Admin / HRD",
    catatan: "Mengelola kepegawaian sehari-hari.",
  },
  {
    kunci: "MANAGER" as const,
    label: "Kepala Unit",
    catatan: "Memantau tim dan menyetujui pengajuan.",
  },
];

/**
 * Mengatur modul admin yang boleh dibuka tiap peran.
 *
 * Super Admin sengaja tidak ada di daftar: ia pemilik sistem dan selalu boleh
 * membuka apa pun. Kalau ikut diatur, satu centang yang salah bisa mengunci
 * satu-satunya orang yang berwenang membukanya kembali.
 */
export function PanelAkses({ akses }: { akses: AksesMenu }) {
  const [hasil, kirim, sedang] = useActionState<HasilPengaturan | null, FormData>(
    aksiSimpanAksesMenu,
    null,
  );

  const [pilihan, setPilihan] = useState<AksesMenu>(akses);

  const alih = (peran: "ADMIN" | "MANAGER", kunci: string) =>
    setPilihan((s) => ({
      ...s,
      [peran]: s[peran].includes(kunci)
        ? s[peran].filter((x) => x !== kunci)
        : [...s[peran], kunci],
    }));

  // Kelompok dipertahankan supaya susunannya sama dengan sidebar; orang mencari
  // "Shift" di tempat yang sama seperti ia biasa menemukannya.
  const kelompok = [...new Set(MENU_ADMIN.map((m) => m.kelompok))];

  return (
    <form action={kirim} className="space-y-5">
      <input type="hidden" name="admin" value={pilihan.ADMIN.join(",")} />
      <input type="hidden" name="manager" value={pilihan.MANAGER.join(",")} />

      {hasil && (
        <div
          role="status"
          className={cn(
            "rounded-[var(--radius-input)] px-4 py-3 text-sm font-medium",
            hasil.ok
              ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100"
              : "bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-100",
          )}
        >
          {hasil.pesan}
        </div>
      )}

      <div className="bg-surface border-app flex items-start gap-3 rounded-[var(--radius-card)] border p-4">
        <ShieldCheck size={18} className="text-brand-600 dark:text-brand-300 mt-0.5" />
        <p className="text-muted text-[13px] leading-relaxed">
          Yang tidak dicentang bukan sekadar disembunyikan dari menu — halamannya
          benar-benar menolak dibuka, termasuk bila alamatnya diketik langsung. Super
          Admin tidak diatur di sini dan selalu bisa membuka semuanya.
        </p>
      </div>

      {kelompok.map((judul) => (
        <div
          key={judul}
          className="border-app bg-surface overflow-hidden rounded-[var(--radius-card)] border"
        >
          <div className="border-app bg-surface-muted grid grid-cols-[1fr_auto_auto] gap-3 border-b px-4 py-2.5">
            <p className="text-subtle text-[10.5px] font-bold tracking-[0.12em] uppercase">
              {judul}
            </p>
            {PERAN.map((p) => (
              <p
                key={p.kunci}
                className="text-subtle w-24 text-center text-[10.5px] font-bold"
              >
                {p.label}
              </p>
            ))}
          </div>

          <ul className="divide-app divide-y">
            {MENU_ADMIN.filter((m) => m.kelompok === judul).map((m) => (
              <li
                key={m.kunci}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5"
              >
                <span className="text-body text-sm font-medium">{m.label}</span>
                {PERAN.map((p) => (
                  <label
                    key={p.kunci}
                    className="hover:bg-surface-muted grid w-24 cursor-pointer place-items-center rounded-lg py-1.5"
                  >
                    <span className="sr-only">
                      {m.label} untuk {p.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={pilihan[p.kunci].includes(m.kunci)}
                      onChange={() => alih(p.kunci, m.kunci)}
                      className="accent-brand-600 size-4"
                    />
                  </label>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <Button type="submit" disabled={sedang} size="lg">
        {sedang && <Loader2 size={16} className="animate-spin" />} Simpan hak akses
      </Button>
    </form>
  );
}
