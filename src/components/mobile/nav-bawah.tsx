"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  LayoutGrid,
  ListChecks,
  ScanFace,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/db/schema";
import { cn } from "@/lib/utils";

/**
 * Bilah bawah memakai ikon garis, bukan ikon 3D.
 *
 * Ikon 3D bagus pada ukuran besar di beranda, tetapi pada dua puluh empat
 * piksel detailnya saling menumpuk sehingga satu ikon sulit dibedakan dari
 * tetangganya. Garis tunggal tetap terbaca pada ukuran itu.
 *
 * Mulai lebar `lg` bilah ini disembunyikan: navigasinya diambil alih sidebar
 * agar tidak ada dua navigasi yang berlaku bersamaan.
 */
type Tujuan = {
  label: string;
  Ikon: LucideIcon;
  /** Kosong berarti fiturnya belum ada — ditandai dan tidak bisa ditekan. */
  href?: string;
  /** Ditinggikan di tengah bilah sebagai pintu ke seluruh menu. */
  tengah?: boolean;
};

const MENU: Tujuan[] = [
  { href: "/", label: "Beranda", Ikon: House },
  { href: "/riwayat", label: "Presensi", Ikon: ScanFace },
  { href: "/menu", label: "Menu", Ikon: LayoutGrid, tengah: true },
  { label: "Tugas", Ikon: ListChecks },
  { href: "/profil", label: "Profil", Ikon: UserRound },
];

export function NavBawah({ role }: { role: Role }) {
  const pathname = usePathname();
  void role;

  return (
    <nav
      aria-label="Navigasi utama"
      className="border-app bg-surface pb-safe shrink-0 border-t lg:hidden"
    >
      <ul className="grid grid-cols-5 items-end">
        {MENU.map((m) => {
          const aktif = m.href
            ? m.href === "/"
              ? pathname === "/"
              : pathname.startsWith(m.href)
            : false;

          const label = (
            <span
              className={cn(
                "text-[11px] leading-none",
                aktif ? "font-bold" : "font-medium",
              )}
            >
              {m.label}
            </span>
          );

          // Tombol tengah dinaikkan supaya seluruh menu tetap terjangkau ibu
          // jari tanpa menggeser tombol absen dari tengah beranda.
          if (m.tengah && m.href) {
            return (
              <li key={m.label} className="flex justify-center">
                <Link
                  href={m.href}
                  aria-current={aktif ? "page" : undefined}
                  className="flex flex-col items-center gap-1 pb-2"
                >
                  <span
                    className={cn(
                      "-mt-5 grid size-14 place-items-center rounded-full shadow-[var(--shadow-float)] transition-colors",
                      aktif ? "bg-brand-700" : "bg-brand-600",
                    )}
                  >
                    <m.Ikon size={24} className="text-white" strokeWidth={2} />
                  </span>
                  <span
                    className={cn(
                      "text-[11px] leading-none",
                      aktif
                        ? "text-brand-600 dark:text-brand-300 font-bold"
                        : "text-subtle font-medium",
                    )}
                  >
                    {m.label}
                  </span>
                </Link>
              </li>
            );
          }

          // Menu yang fiturnya belum ada tetap tampil agar bentuk akhir
          // aplikasi terbaca, tetapi tidak bisa ditekan.
          if (!m.href) {
            return (
              <li key={m.label}>
                <span
                  aria-disabled
                  title="Fitur ini belum tersedia"
                  className="text-subtle relative flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 opacity-45"
                >
                  <m.Ikon size={23} strokeWidth={1.7} />
                  {label}
                  <span className="bg-warn-500 absolute top-1 right-2 rounded-full px-1 py-px text-[8px] font-bold text-white">
                    Segera
                  </span>
                </span>
              </li>
            );
          }

          return (
            <li key={m.label}>
              <Link
                href={m.href}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 transition-colors",
                  aktif ? "text-brand-600 dark:text-brand-300" : "text-subtle",
                )}
              >
                <m.Ikon size={23} strokeWidth={aktif ? 2.2 : 1.7} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
