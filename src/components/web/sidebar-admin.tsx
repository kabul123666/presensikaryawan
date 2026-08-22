"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Building2,
  ChevronDown,
  CalendarRange,
  ClipboardCheck,
  LayoutDashboard,
  MapPinned,
  Menu,
  Megaphone,
  ScrollText,
  Settings,
  CalendarDays,
  Stethoscope,
  Users,
  Wallet,
  X,
  ShieldAlert,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Badge = { persetujuan: number; pendaftaran: number };

/**
 * `hanyaAdmin` menandai modul yang server-nya memang menolak Manager.
 * Menyaringnya di sini bukan pengamanan — pengamanannya ada di wajibPeran()
 * pada tiap halaman — melainkan supaya Manager tidak disuguhi delapan menu
 * yang semuanya berujung ke layar "tidak berwenang".
 */
const KELOMPOK = [
  {
    judul: "Operasional",
    menu: [
      { href: "/admin", label: "Dashboard", Ikon: LayoutDashboard, exact: true },
      { href: "/admin/absensi", label: "Rekap Absensi", Ikon: CalendarRange },
      {
        href: "/admin/anomali",
        label: "Tinjau Anomali",
        Ikon: ShieldAlert,
        hanyaAdmin: true,
      },
      {
        href: "/admin/persetujuan",
        label: "Persetujuan",
        Ikon: ClipboardCheck,
        badge: "persetujuan" as const,
        param: "status" as const,
        anak: [
          {
            href: "/admin/persetujuan?status=PENDING",
            label: "Menunggu",
            tab: "PENDING",
          },
          {
            href: "/admin/persetujuan?status=APPROVED",
            label: "Disetujui",
            tab: "APPROVED",
          },
          {
            href: "/admin/persetujuan?status=REJECTED",
            label: "Ditolak",
            tab: "REJECTED",
          },
          { href: "/admin/persetujuan?status=SEMUA", label: "Semua", tab: "SEMUA" },
        ],
      },
      {
        href: "/admin/tindakan",
        label: "Tindakan & Fee",
        Ikon: Wallet,
        anak: [
          {
            href: "/admin/tindakan?tab=verifikasi",
            label: "Verifikasi",
            tab: "verifikasi",
          },
          { href: "/admin/tindakan?tab=rekap", label: "Rekap Fee", tab: "rekap" },
          {
            href: "/admin/tindakan?tab=katalog",
            label: "Katalog & Tarif",
            tab: "katalog",
          },
        ],
      },
      {
        href: "/admin/pengumuman",
        label: "Pengumuman",
        Ikon: Megaphone,
        hanyaAdmin: true,
      },
    ],
  },
  {
    judul: "Kepegawaian",
    menu: [
      {
        href: "/admin/karyawan",
        label: "Karyawan",
        Ikon: Users,
        badge: "pendaftaran" as const,
        hanyaAdmin: true,
        param: "status" as const,
        anak: [
          { href: "/admin/karyawan?status=SEMUA", label: "Semua", tab: "SEMUA" },
          { href: "/admin/karyawan?status=ACTIVE", label: "Aktif", tab: "ACTIVE" },
          {
            href: "/admin/karyawan?status=PENDING_APPROVAL",
            label: "Menunggu Verifikasi",
            tab: "PENDING_APPROVAL",
          },
          {
            href: "/admin/karyawan?status=SUSPENDED",
            label: "Nonaktif",
            tab: "SUSPENDED",
          },
        ],
      },
      {
        href: "/admin/organisasi",
        label: "Departemen & Jabatan",
        Ikon: Building2,
        hanyaAdmin: true,
      },
      {
        href: "/admin/jadwal",
        label: "Jadwal Jaga",
        Ikon: CalendarDays,
        hanyaAdmin: true,
      },
      { href: "/admin/shift", label: "Shift", Ikon: Stethoscope, hanyaAdmin: true },
      {
        href: "/admin/lokasi",
        label: "Lokasi & Geofence",
        Ikon: MapPinned,
        hanyaAdmin: true,
      },
    ],
  },
  {
    judul: "Sistem",
    menu: [
      {
        href: "/admin/pengaturan",
        label: "Pengaturan",
        Ikon: Settings,
        hanyaAdmin: true,
        anak: [
          { href: "/admin/pengaturan?tab=umum", label: "Umum", tab: "umum" },
          { href: "/admin/pengaturan?tab=cuti", label: "Cuti", tab: "cuti" },
          {
            href: "/admin/pengaturan?tab=persetujuan",
            label: "Aturan Persetujuan",
            tab: "persetujuan",
          },
          { href: "/admin/pengaturan?tab=libur", label: "Hari Libur", tab: "libur" },
          {
            href: "/admin/pengaturan?tab=tutup-tahun",
            label: "Tutup Tahun",
            tab: "tutup-tahun",
          },
        ],
      },
      { href: "/admin/audit", label: "Audit Log", Ikon: ScrollText, hanyaAdmin: true },
    ],
  },
];

export function SidebarAdmin({
  badge,
  adminPenuh,
}: {
  badge: Badge;
  adminPenuh: boolean;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [terbuka, setTerbuka] = useState(false);
  const [dibuka, setDibuka] = useState<string[]>([]);

  const nilaiParam = (nama: string) => params.get(nama);

  // Kelompok yang sedang dibuka isinya ikut terbuka sendiri, supaya pengguna
  // tidak perlu mencari di mana halaman yang sedang ia lihat berada.
  const grupTerbuka = (href: string) =>
    dibuka.includes(href) || pathname.startsWith(href);

  const alihkan = (href: string) =>
    setDibuka((s) => (s.includes(href) ? s.filter((x) => x !== href) : [...s, href]));

  const kelompok = adminPenuh
    ? KELOMPOK
    : KELOMPOK.map((k) => ({
        ...k,
        menu: k.menu.filter((m) => !("hanyaAdmin" in m && m.hanyaAdmin)),
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
                                  onClick={() => setTerbuka(false)}
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
                      onClick={() => setTerbuka(false)}
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

      {/* Mobile: laci */}
      <button
        onClick={() => setTerbuka(true)}
        className="bg-surface border-app text-body fixed top-3.5 left-4 z-30 grid size-10 place-items-center rounded-xl border shadow-[var(--shadow-soft)] lg:hidden"
        aria-label="Buka menu"
      >
        <Menu size={19} />
      </button>

      {terbuka && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-[var(--overlay)]"
            onClick={() => setTerbuka(false)}
            aria-label="Tutup menu"
          />
          <aside className="bg-surface absolute inset-y-0 left-0 w-[264px] shadow-[var(--shadow-float)]">
            <button
              onClick={() => setTerbuka(false)}
              className="text-subtle absolute top-4 right-3 grid size-9 place-items-center rounded-lg"
              aria-label="Tutup menu"
            >
              <X size={18} />
            </button>
            {isi}
          </aside>
        </div>
      )}
    </>
  );
}
