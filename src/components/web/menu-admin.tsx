/**
 * Peta menu panel admin.
 *
 * Dipisah dari komponen sidebar karena dipakai dua sisi sekaligus: sidebar
 * yang berjalan di peramban, dan halaman Menu yang dirender di server. Nilai
 * biasa yang diekspor dari modul `"use client"` tidak sampai utuh ke server —
 * yang diterima hanya referensi komponen — sehingga datanya harus tinggal di
 * berkas netral seperti ini.
 */
import {
  Building2,
  CalendarRange,
  ClipboardCheck,
  LayoutDashboard,
  MapPinned,
  Megaphone,
  ScrollText,
  Settings,
  CalendarDays,
  Stethoscope,
  Users,
  Wallet,
  ShieldAlert,
} from "lucide-react";

/**
 * `hanyaAdmin` menandai modul yang server-nya memang menolak Manager.
 * Menyaringnya di sini bukan pengamanan — pengamanannya ada di wajibPeran()
 * pada tiap halaman — melainkan supaya Manager tidak disuguhi delapan menu
 * yang semuanya berujung ke layar "tidak berwenang".
 */
export type Badge = { persetujuan: number; pendaftaran: number };

export const KELOMPOK = [
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
