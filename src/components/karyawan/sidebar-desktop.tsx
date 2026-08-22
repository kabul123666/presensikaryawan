"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  FileText,
  House,
  LayoutGrid,
  ScanFace,
  Settings,
  ShieldCheck,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Avatar, type JenisKelamin } from "@/components/mobile/avatar";
import { cn } from "@/lib/utils";

/**
 * Navigasi karyawan untuk layar lebar.
 *
 * Di ponsel navigasinya bilah bawah dengan lima tujuan; di komputer jumlah itu
 * terlalu sedikit dan menyembunyikan modul yang muat ditampilkan sekaligus.
 * Sidebar ini menggantikannya mulai lebar `lg` — bukan sebagai tambahan,
 * karena dua navigasi sekaligus membuat orang ragu mana yang berlaku.
 */
type Tujuan = {
  label: string;
  href: string;
  Ikon: LucideIcon;
  /** Hanya tampil bagi yang berwenang menyetujui. */
  penyetuju?: boolean;
  /** Hanya tampil bagi admin. */
  admin?: boolean;
};

const KELOMPOK: { judul: string; tujuan: Tujuan[] }[] = [
  {
    judul: "Kehadiran",
    tujuan: [
      { label: "Beranda", href: "/", Ikon: House },
      { label: "Presensi", href: "/riwayat", Ikon: ScanFace },
      { label: "Jadwal Jaga", href: "/jadwal", Ikon: CalendarDays },
    ],
  },
  {
    judul: "Pengajuan",
    tujuan: [
      { label: "Pengajuan Saya", href: "/pengajuan", Ikon: FileText },
      {
        label: "Persetujuan",
        href: "/admin/persetujuan",
        Ikon: ShieldCheck,
        penyetuju: true,
      },
    ],
  },
  {
    judul: "Finance",
    tujuan: [{ label: "Fee Saya", href: "/fee", Ikon: Wallet }],
  },
  {
    judul: "Lainnya",
    tujuan: [
      { label: "Semua Menu", href: "/menu", Ikon: LayoutGrid },
      { label: "Notifikasi", href: "/notifikasi", Ikon: Bell },
      { label: "Profil", href: "/profil", Ikon: UserRound },
      { label: "Pengaturan Akun", href: "/profil/pengaturan", Ikon: Settings },
    ],
  },
];

export function SidebarDesktop({
  nama,
  jabatan,
  lokasi,
  fotoUrl,
  jenisKelamin,
  penyetuju,
  admin,
  belumDibaca,
}: {
  nama: string;
  jabatan: string | null;
  lokasi: string | null;
  fotoUrl: string | null;
  jenisKelamin: JenisKelamin;
  penyetuju: boolean;
  admin: boolean;
  belumDibaca: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="bg-surface border-app hidden w-[268px] shrink-0 flex-col border-r lg:flex">
      <div className="border-app flex items-center gap-2.5 border-b px-5 py-4">
        <span className="bg-brand-700 grid size-9 shrink-0 place-items-center rounded-xl">
          <span className="text-sm font-extrabold text-white">A</span>
        </span>
        <span className="min-w-0">
          <span className="text-body block truncate text-[13px] font-extrabold">
            Presensi Karyawan
          </span>
          <span className="text-subtle block text-[11px]">Tampilan karyawan</span>
        </span>
      </div>

      <div className="border-app flex items-center gap-3 border-b px-5 py-4">
        <Avatar
          nama={nama}
          fotoUrl={fotoUrl}
          jenisKelamin={jenisKelamin}
          className="size-11 shrink-0"
        />
        <div className="min-w-0">
          <p className="text-body truncate text-[13px] leading-tight font-bold">{nama}</p>
          <p className="text-subtle mt-0.5 truncate text-[11px]">
            {jabatan ?? "Karyawan"}
            {lokasi ? ` · ${lokasi}` : ""}
          </p>
        </div>
      </div>

      <nav
        aria-label="Navigasi karyawan"
        className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-3 py-4"
      >
        {KELOMPOK.map((k) => {
          const tujuan = k.tujuan.filter(
            (t) => (!t.penyetuju || penyetuju) && (!t.admin || admin),
          );
          if (tujuan.length === 0) return null;

          return (
            <div key={k.judul} className="mb-4 last:mb-0">
              <p className="text-subtle px-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase">
                {k.judul}
              </p>
              <ul className="space-y-0.5">
                {tujuan.map((t) => {
                  const aktif =
                    t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);

                  return (
                    <li key={t.href}>
                      <Link
                        href={t.href}
                        aria-current={aktif ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
                          aktif
                            ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
                            : "text-muted hover:bg-surface-muted hover:text-body",
                        )}
                      >
                        <t.Ikon size={17} strokeWidth={aktif ? 2.2 : 1.8} />
                        <span className="flex-1 truncate">{t.label}</span>
                        {t.href === "/notifikasi" && belumDibaca > 0 && (
                          <span className="bg-danger-500 tnum grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-semibold text-white">
                            {belumDibaca > 9 ? "9+" : belumDibaca}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {admin && (
        <div className="border-app border-t px-3 py-3">
          <Link
            href="/admin"
            className="bg-surface-muted text-body hover:bg-brand-50 dark:hover:bg-brand-900/40 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[12px] font-bold transition-colors"
          >
            Buka dashboard admin →
          </Link>
        </div>
      )}
    </aside>
  );
}
