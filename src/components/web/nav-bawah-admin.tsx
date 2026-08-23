"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarRange,
  ClipboardCheck,
  LayoutDashboard,
  LayoutGrid,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Navigasi bawah panel admin — hanya tampil di layar kecil.
 *
 * Sebelumnya satu-satunya jalan ke menu admin di ponsel adalah laci hamburger:
 * seluruh menunya tersembunyi sampai seseorang ingat menekan ikon di pojok.
 * Untuk memantau kehadiran sambil berjalan, empat tujuan yang paling sering
 * dibuka pantas selalu terlihat, dan sisanya dikumpulkan di halaman Menu.
 *
 * Bukan `position: fixed`, melainkan elemen flex biasa di dasar kerangka
 * setinggi layar (lihat layout admin). Elemen fixed ikut tergeser bilah alamat
 * peramban ponsel yang menciut saat digulir, dan menunya terlihat naik-turun.
 */
type Tujuan = { href: string; label: string; Ikon: LucideIcon; exact?: boolean };

const MENU: Tujuan[] = [
  { href: "/admin", label: "Dashboard", Ikon: LayoutDashboard, exact: true },
  { href: "/admin/absensi", label: "Rekap", Ikon: CalendarRange },
  { href: "/admin/persetujuan", label: "Setujui", Ikon: ClipboardCheck },
  { href: "/admin/karyawan", label: "Karyawan", Ikon: Users },
  // Menunya satu untuk semuanya: petak berwarna di aplikasi karyawan, sudah
  // memuat modul admin sesuai izin. Tidak perlu daftar kedua yang berbeda
  // rupa hanya karena dibuka dari panel admin.
  { href: "/menu", label: "Menu", Ikon: LayoutGrid },
];

export function NavBawahAdmin({ menunggu }: { menunggu: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi admin"
      className="border-app bg-surface pb-safe shrink-0 border-t lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {MENU.map((m) => {
          const aktif = m.exact ? pathname === m.href : pathname.startsWith(m.href);

          return (
            <li key={m.href}>
              <Link
                href={m.href}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 transition-colors",
                  aktif ? "text-brand-600 dark:text-brand-300" : "text-subtle",
                )}
              >
                <m.Ikon size={21} strokeWidth={aktif ? 2.2 : 1.7} />
                <span
                  className={cn(
                    "text-[10.5px] leading-none",
                    aktif ? "font-bold" : "font-medium",
                  )}
                >
                  {m.label}
                </span>
                {m.href === "/admin/persetujuan" && menunggu > 0 && (
                  <span className="bg-danger-500 tnum absolute top-1 right-[22%] grid min-w-4 place-items-center rounded-full px-1 text-[9px] leading-4 font-bold text-white">
                    {menunggu > 9 ? "9+" : menunggu}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
