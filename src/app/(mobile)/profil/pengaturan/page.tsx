import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  CircleHelp,
  Fingerprint,
  Info,
  KeyRound,
  Languages,
  LogOut,
  Paintbrush,
  Palette,
  ScanFace,
  ShieldCheck,
} from "lucide-react";

import { PilihTema } from "@/components/mobile/pilih-tema";
import { PilihWarna } from "@/components/mobile/pilih-warna";
import { aksiKeluar } from "@/features/auth/actions";
import { FormGantiPassword } from "@/features/employees/form-ganti-password";
import { wajibMasuk } from "@/lib/auth/session";

export const metadata = { title: "Pengaturan Akun" };

/** Baris yang fiturnya belum dibangun — ditandai, tidak bisa ditekan. */
const SEGERA = [
  { judul: "Keamanan", isi: [{ label: "Pengaturan PIN", Ikon: Fingerprint }] },
  {
    judul: "Akun",
    isi: [
      { label: "Verifikasi dua langkah", Ikon: ShieldCheck },
      { label: "Registrasi ulang wajah", Ikon: ScanFace },
    ],
  },
  {
    judul: "Preferensi",
    isi: [
      { label: "Notifikasi", Ikon: Bell },
      { label: "Bahasa", Ikon: Languages },
    ],
  },
  {
    judul: "Lainnya",
    isi: [
      { label: "Bantuan", Ikon: CircleHelp },
      { label: "Tentang aplikasi", Ikon: Info },
    ],
  },
];

export default async function HalamanPengaturanAkun() {
  await wajibMasuk();

  return (
    <div className="pb-10 lg:mx-auto lg:max-w-[720px]">
      <header className="bg-brand-700 pt-safe px-5 pb-5 lg:rounded-[var(--radius-sheet)] lg:px-7">
        <div className="flex items-center gap-3 pt-4 lg:pt-2">
          <Link
            href="/profil"
            className="grid size-9 place-items-center rounded-full text-white transition-colors hover:bg-white/10"
            aria-label="Kembali ke profil"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-[18px] font-extrabold text-white">Pengaturan Akun</h1>
        </div>
      </header>

      {/* Yang sudah berfungsi diletakkan lebih dulu supaya tidak tenggelam di
          antara baris yang belum bisa ditekan. */}
      <section className="mt-5 px-5">
        <h2 className="text-body text-sm font-extrabold tracking-tight">Keamanan</h2>
        <div className="border-app bg-surface mt-2 rounded-[var(--radius-card)] border p-4">
          <div className="flex items-center gap-2.5">
            <KeyRound size={16} className="text-brand-600 dark:text-brand-300" />
            <p className="text-body text-sm font-bold">Ubah kata sandi</p>
          </div>
          <div className="mt-3">
            <FormGantiPassword />
          </div>
        </div>
      </section>

      <section className="mt-5 px-5">
        <h2 className="text-body text-sm font-extrabold tracking-tight">Tampilan</h2>
        <div className="border-app bg-surface mt-2 rounded-[var(--radius-card)] border p-4">
          <div className="flex items-center gap-2.5">
            <Palette size={16} className="text-brand-600 dark:text-brand-300" />
            <p className="text-body text-sm font-bold">Tema aplikasi</p>
          </div>
          <PilihTema />

          <div className="border-app mt-4 border-t pt-4">
            <div className="flex items-center gap-2.5">
              <Paintbrush size={16} className="text-brand-600 dark:text-brand-300" />
              <p className="text-body text-sm font-bold">Warna aplikasi</p>
            </div>
            <p className="text-muted mt-1 text-[12px] leading-relaxed">
              Hanya warna aksen yang berubah. Warna status kehadiran sengaja tetap, supaya
              arti hijau, jingga, dan merah tidak ikut bergeser.
            </p>
            <PilihWarna />
          </div>
        </div>
      </section>

      {SEGERA.map((k) => (
        <section key={k.judul} className="mt-5 px-5">
          <h2 className="text-body text-sm font-extrabold tracking-tight">{k.judul}</h2>
          <ul className="border-app bg-surface mt-2 divide-y overflow-hidden rounded-[var(--radius-card)] border">
            {k.isi.map((b) => (
              <li
                key={b.label}
                title="Fitur ini belum tersedia"
                className="flex items-center gap-3 px-4 py-3.5 opacity-50"
              >
                <b.Ikon size={17} className="text-muted shrink-0" />
                <span className="text-body flex-1 text-sm">{b.label}</span>
                <span className="bg-warn-500 rounded-full px-1.5 py-px text-[9px] font-bold text-white">
                  Segera
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="mt-7 px-5">
        <form action={aksiKeluar}>
          <button
            type="submit"
            className="border-danger-500/40 text-danger-600 dark:text-danger-100 flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-input)] border text-sm font-bold"
          >
            <LogOut size={17} /> Keluar dari akun
          </button>
        </form>
      </div>

      <p className="text-subtle mt-6 text-center text-[11px]">Presensi Karyawan v0.1</p>
    </div>
  );
}
