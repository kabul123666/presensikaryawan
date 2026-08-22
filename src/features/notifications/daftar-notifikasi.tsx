"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { aksiTandaiDibaca, aksiTandaiSemuaDibaca } from "./actions";

export type BarisNotifikasi = {
  id: string;
  tipe: string;
  judul: string;
  isi: string | null;
  link: string | null;
  sudahDibaca: boolean;
  waktu: string;
};

const NADA: Record<string, string> = {
  PENGAJUAN: "bg-status-leave",
  TINDAKAN: "bg-status-ontime",
  AKUN: "bg-status-late",
};

export function DaftarNotifikasi({ daftar }: { daftar: BarisNotifikasi[] }) {
  const router = useRouter();
  const [proses, mulai] = useTransition();

  const belumDibaca = daftar.filter((d) => !d.sudahDibaca).length;

  if (daftar.length === 0) {
    return (
      <div className="border-app bg-surface mx-5 mt-5 rounded-[var(--radius-card)] border px-5 py-9 text-center lg:mx-0">
        <p className="text-body text-sm font-medium">Belum ada notifikasi</p>
        <p className="text-muted mt-1.5 text-[13px]">
          Hasil persetujuan cuti, lembur, dan verifikasi tindakan muncul di sini.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 lg:mt-5 lg:px-0">
      {belumDibaca > 0 && (
        <button
          onClick={() =>
            mulai(async () => {
              await aksiTandaiSemuaDibaca();
              router.refresh();
            })
          }
          disabled={proses}
          className="text-brand-700 dark:text-brand-300 mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium"
        >
          <CheckCheck size={15} /> Tandai semua sudah dibaca ({belumDibaca})
        </button>
      )}

      <ul className="mt-3 space-y-2">
        {daftar.map((n) => {
          const isi = (
            <>
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    n.sudahDibaca
                      ? "bg-ink-300 dark:bg-ink-700"
                      : (NADA[n.tipe] ?? "bg-brand-600"),
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-[13px]",
                      n.sudahDibaca ? "text-muted" : "text-body font-semibold",
                    )}
                  >
                    {n.judul}
                  </p>
                  {n.isi && (
                    <p className="text-muted mt-0.5 text-[13px] leading-relaxed">
                      {n.isi}
                    </p>
                  )}
                  <p className="text-subtle mt-1 text-[11px]">{n.waktu}</p>
                </div>
              </div>
            </>
          );

          return (
            <li
              key={n.id}
              className={cn(
                "bg-surface border-app rounded-[var(--radius-card)] border px-4 py-3",
                !n.sudahDibaca && "border-brand-300 dark:border-brand-800",
              )}
              onClick={() => {
                if (n.sudahDibaca) return;
                mulai(async () => {
                  await aksiTandaiDibaca(n.id);
                  router.refresh();
                });
              }}
            >
              {n.link ? (
                <Link href={n.link} className="block">
                  {isi}
                </Link>
              ) : (
                isi
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
