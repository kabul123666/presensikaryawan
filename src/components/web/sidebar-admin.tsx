"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { KELOMPOK, type Badge } from "./menu-admin";

export function SidebarAdmin({
  badge,
  izin,
}: {
  badge: Badge;
  /** Kunci modul yang boleh dibuka pengguna ini. */
  izin: string[];
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [dibuka, setDibuka] = useState<string[]>([]);

  const nilaiParam = (nama: string) => params.get(nama);

  // Kelompok yang sedang dibuka isinya ikut terbuka sendiri, supaya pengguna
  // tidak perlu mencari di mana halaman yang sedang ia lihat berada.
  const grupTerbuka = (href: string) =>
    dibuka.includes(href) || pathname.startsWith(href);

  const alihkan = (href: string) =>
    setDibuka((s) => (s.includes(href) ? s.filter((x) => x !== href) : [...s, href]));

  const kelompok = KELOMPOK.map((k) => ({
    ...k,
    menu: k.menu.filter((m) => izin.includes(m.kunci)),
  })).filter((k) => k.menu.length > 0);

  const isi = (
    <nav className="flex h-full flex-col">
      <div className="border-app flex h-16 items-center gap-2.5 border-b px-5">
        <span className="bg-brand-600 grid size-9 place-items-center rounded-xl shadow-[var(--shadow-brand)]">
          <span className="text-sm font-extrabold text-white">A</span>
        </span>
        <span className="min-w-0">
          <span className="text-body block truncate text-sm font-extrabold">
            Presensi Karyawan
          </span>
          <span className="text-subtle block text-[11px]">Panel Admin</span>
        </span>
      </div>

      <div className="scrollbar-slim flex-1 overflow-y-auto px-3 py-4">
        {kelompok.map((k) => (
          <div key={k.judul} className="mb-5">
            <p className="text-subtle px-3 pb-2 text-[10.5px] font-bold tracking-[0.12em] uppercase">
              {k.judul}
            </p>
            <ul className="space-y-0.5">
              {k.menu.map(({ href, label, Ikon, ...sisa }) => {
                const exact = "exact" in sisa && sisa.exact;
                const aktif = exact ? pathname === href : pathname.startsWith(href);
                const jumlah = "badge" in sisa && sisa.badge ? badge[sisa.badge] : 0;
                const anak = "anak" in sisa ? sisa.anak : undefined;
                const namaParam = ("param" in sisa && sisa.param) || "tab";

                const kelas = cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors",
                  aktif
                    ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
                    : "text-muted hover:bg-surface-muted hover:text-body",
                );

                if (anak) {
                  const buka = grupTerbuka(href);
                  return (
                    <li key={href}>
                      <button
                        type="button"
                        onClick={() => alihkan(href)}
                        aria-expanded={buka}
                        className={kelas}
                      >
                        <Ikon size={17.5} strokeWidth={aktif ? 2.3 : 1.9} />
                        <span className="flex-1 truncate">{label}</span>
                        <ChevronDown
                          size={15}
                          className={cn("transition-transform", buka && "rotate-180")}
                        />
                      </button>

                      {buka && (
                        <ul className="border-app mt-0.5 ml-[1.4rem] space-y-0.5 border-l pl-3">
                          {anak.map((a) => {
                            const aAktif =
                              aktif && (nilaiParam(namaParam) ?? anak[0].tab) === a.tab;
                            return (
                              <li key={a.href}>
                                <Link
                                  href={a.href}
                                  aria-current={aAktif ? "page" : undefined}
                                  className={cn(
                                    "block truncate rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                                    aAktif
                                      ? "text-brand-800 bg-brand-50 dark:bg-brand-900/40 dark:text-brand-200 font-semibold"
                                      : "text-muted hover:bg-surface-muted hover:text-body",
                                  )}
                                >
                                  {a.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                }

                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={aktif ? "page" : undefined}
                      className={kelas}
                    >
                      <Ikon size={17.5} strokeWidth={aktif ? 2.3 : 1.9} />
                      <span className="flex-1 truncate">{label}</span>
                      {jumlah > 0 && (
                        <span className="bg-danger-500 tnum grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-[10.5px] font-bold text-white">
                          {jumlah}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="bg-surface border-app fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r lg:block">
        {isi}
      </aside>
    </>
  );
}
