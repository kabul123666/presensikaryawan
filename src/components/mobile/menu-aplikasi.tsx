import Link from "next/link";
import { LayoutGrid } from "lucide-react";

import {
  IconApproval,
  IconCuti,
  IconFee,
  IconKamera,
  IconKaryawan,
  IconKeamanan,
  IconLaporan,
  IconLembur,
  IconLokasi,
  IconNotifikasi,
  IconRiwayat,
  IconTindakan,
  type Icon3DProps,
} from "@/components/icons3d";

type Menu = {
  /** Kunci tetap; label boleh berubah tanpa membatalkan pilihan karyawan. */
  kunci: string;
  label: string;
  Ikon: (p: Icon3DProps) => React.ReactElement;
  /** Kosong berarti fiturnya belum dibangun — ditandai dan tidak bisa dibuka. */
  href?: string;
  /** Hanya tampil bagi yang berwenang menyetujui. */
  penyetuju?: boolean;
  /** Ikut tampil di beranda; sisanya hanya ada di halaman Lainnya. */
  utama?: boolean;
};

/**
 * Peta menu aplikasi karyawan.
 *
 * Menu tanpa `href` sengaja tetap ditampilkan meski fiturnya belum ada, agar
 * bentuk akhir aplikasi terlihat utuh sejak awal. Yang belum jadi ditandai
 * "Segera" dan tidak bisa ditekan — lebih jujur daripada tombol yang tampak
 * hidup lalu membuka halaman kosong.
 */
const KELOMPOK: { judul: string; menu: Menu[] }[] = [
  {
    judul: "Kehadiran",
    menu: [
      {
        kunci: "riwayat",
        label: "Riwayat",
        href: "/riwayat",
        Ikon: IconRiwayat,
        utama: true,
      },
      {
        kunci: "jadwal-shift",
        label: "Jadwal Shift",
        href: "/jadwal",
        Ikon: IconLaporan,
        utama: true,
      },
      {
        kunci: "presensi-backdate",
        label: "Presensi Backdate",
        href: "/pengajuan/koreksi",
        Ikon: IconKamera,
        utama: true,
      },
      { kunci: "aktivitas-harian", label: "Aktivitas Harian", Ikon: IconTindakan },
    ],
  },
  {
    judul: "Pengajuan",
    menu: [
      {
        kunci: "cuti",
        label: "Cuti",
        href: "/pengajuan/cuti",
        Ikon: IconCuti,
        utama: true,
      },
      {
        kunci: "izin",
        label: "Izin",
        href: "/pengajuan/izin",
        Ikon: IconKaryawan,
        utama: true,
      },
      {
        kunci: "lembur",
        label: "Lembur",
        href: "/pengajuan/lembur",
        Ikon: IconLembur,
        utama: true,
      },
      { kunci: "dinas", label: "Dinas", Ikon: IconLokasi },
      { kunci: "wfh", label: "WFH", Ikon: IconKeamanan },
      {
        kunci: "persetujuan",
        label: "Persetujuan",
        href: "/admin/persetujuan",
        Ikon: IconApproval,
        penyetuju: true,
      },
    ],
  },
  {
    judul: "Finance",
    menu: [
      { kunci: "fee-saya", label: "Fee Saya", href: "/fee", Ikon: IconFee, utama: true },
      {
        kunci: "slip-insentif",
        label: "Slip Insentif",
        href: "/fee/slip",
        Ikon: IconLaporan,
      },
      { kunci: "claim", label: "Claim", Ikon: IconFee },
      { kunci: "bonus", label: "Bonus", Ikon: IconFee },
      { kunci: "slip-gaji", label: "Slip Gaji", Ikon: IconLaporan },
      { kunci: "perjalanan-dinas", label: "Perjalanan Dinas", Ikon: IconLokasi },
    ],
  },
  {
    judul: "Lainnya",
    menu: [
      {
        kunci: "notifikasi",
        label: "Notifikasi",
        href: "/notifikasi",
        Ikon: IconNotifikasi,
      },
      { kunci: "profil", label: "Profil", href: "/profil", Ikon: IconKaryawan },
      { kunci: "performance", label: "Performance", Ikon: IconTindakan },
    ],
  },
];

function Petak({ m }: { m: Menu }) {
  const isi = (
    <>
      <span className="relative">
        <m.Ikon size={44} />
        {!m.href && (
          <span className="bg-warn-500 absolute -top-1 -right-2 rounded-full px-1.5 py-px text-[9px] font-bold text-white">
            Segera
          </span>
        )}
      </span>
      <span
        className={
          m.href
            ? "text-body text-center text-[11px] leading-tight font-semibold"
            : "text-subtle text-center text-[11px] leading-tight font-semibold"
        }
      >
        {m.label}
      </span>
    </>
  );

  // Tanpa bingkai maupun latar: ikon 3D-nya sudah punya bentuk dan bayangan
  // sendiri, sehingga kotak di sekelilingnya hanya menambah garis yang ramai.
  const kelas = "flex flex-col items-center gap-2 rounded-xl px-1 py-2.5";

  if (!m.href) {
    return (
      <span
        aria-disabled
        title="Fitur ini belum tersedia"
        className={`${kelas} opacity-45`}
      >
        {isi}
      </span>
    );
  }

  return (
    <Link href={m.href} className={`${kelas} active:bg-surface-muted transition-colors`}>
      {isi}
    </Link>
  );
}

/**
 * Menu pilihan di beranda.
 *
 * Hanya yang paling sering dipakai yang tampil; selebihnya lewat "Lainnya".
 * Beranda adalah layar yang dibuka sambil berjalan menuju tempat kerja, jadi
 * yang dicari harus langsung terlihat tanpa memindai dua puluh ikon.
 */
export const SEMUA_MENU = KELOMPOK.flatMap((k) => k.menu);

/** Susunan bawaan bagi karyawan yang belum pernah mengubah berandanya. */
export const MENU_BAWAAN = SEMUA_MENU.filter((m) => m.utama).map((m) => m.kunci);

export function MenuUtama({ pilihan }: { pilihan?: string[] | null }) {
  const dipilih = pilihan?.length ? pilihan : MENU_BAWAAN;

  // Kunci yang tidak dikenal diabaikan, sehingga menghapus sebuah menu dari
  // aplikasi tidak membuat beranda siapa pun rusak.
  const utama = dipilih
    .map((k) => SEMUA_MENU.find((m) => m.kunci === k))
    .filter((m): m is Menu => Boolean(m))
    .slice(0, 7);

  return (
    <section className="mt-6 px-5 lg:mt-0 lg:px-0">
      <div className="flex items-center justify-between">
        <h2 className="text-body text-sm font-extrabold tracking-tight">Menu</h2>
        <Link
          href="/menu/atur"
          className="text-brand-700 dark:text-brand-300 text-xs font-semibold"
        >
          Ubah
        </Link>
      </div>
      <div className="bg-surface border-app mt-2 grid grid-cols-4 gap-x-1 gap-y-3 lg:rounded-[var(--radius-card)] lg:border lg:p-3">
        {utama.map((m) => (
          <Petak key={m.label} m={m} />
        ))}

        <Link
          href="/menu"
          className="active:bg-surface-muted flex flex-col items-center gap-2 rounded-xl px-1 py-2.5 transition-colors"
        >
          <span className="bg-surface-muted grid size-11 place-items-center rounded-2xl">
            <LayoutGrid className="text-muted" size={22} />
          </span>
          <span className="text-body text-center text-[11px] leading-tight font-semibold">
            Lainnya
          </span>
        </Link>
      </div>
    </section>
  );
}

export function MenuAplikasi({ penyetuju }: { penyetuju: boolean }) {
  return (
    <div className="mt-6 space-y-6 px-5 lg:mt-5 lg:px-0">
      {KELOMPOK.map((k) => {
        const menu = k.menu.filter((m) => !m.penyetuju || penyetuju);
        if (menu.length === 0) return null;

        return (
          <section key={k.judul}>
            <h2 className="text-body text-sm font-extrabold tracking-tight">{k.judul}</h2>
            <div className="bg-surface border-app mt-2 grid grid-cols-4 gap-x-1 gap-y-3 lg:grid-cols-8 lg:rounded-[var(--radius-card)] lg:border lg:p-3">
              {menu.map((m) => (
                <Petak key={m.label} m={m} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
