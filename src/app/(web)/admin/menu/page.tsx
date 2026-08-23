import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";

import { KELOMPOK } from "@/components/web/menu-admin";
import { aksiKeluar } from "@/features/auth/actions";
import { ringkasanHariIni } from "@/features/admin/service";
import { aksesMenuPengguna } from "@/lib/auth/akses";
import { PERAN_PENYETUJU, wajibPeran } from "@/lib/auth/session";

export const metadata = { title: "Menu Admin" };

/**
 * Seluruh menu admin dalam bentuk daftar.
 *
 * Kembarannya di layar besar adalah sidebar. Di ponsel sidebar itu hanya bisa
 * dibuka lewat laci, sehingga menu yang jarang dipakai praktis tak pernah
 * ditemukan. Halaman ini menampilkan semuanya sekaligus — sama seperti
 * "Semua Menu" di aplikasi karyawan.
 */
export default async function HalamanMenuAdmin() {
  const pengguna = await wajibPeran(...PERAN_PENYETUJU);
  const ringkas = await ringkasanHariIni();
  const izin = await aksesMenuPengguna(pengguna);

  const badge: Record<string, number> = {
    persetujuan: ringkas.menungguPersetujuan,
    pendaftaran: ringkas.pendaftaranBaru,
  };

  const kelompok = KELOMPOK.map((k) => ({
    ...k,
    menu: k.menu.filter((m) => izin.includes(m.kunci)),
  })).filter((k) => k.menu.length > 0);

  return (
    <div className="space-y-6 lg:hidden">
      <div>
        <h1 className="text-body text-2xl font-bold tracking-tight">Menu Admin</h1>
        <p className="text-muted mt-1 text-sm">
          {pengguna.nama} · {izin.length} modul dapat dibuka
        </p>
      </div>

      {kelompok.map((k) => (
        <section key={k.judul}>
          <h2 className="text-subtle px-1 pb-2 text-[10.5px] font-bold tracking-[0.12em] uppercase">
            {k.judul}
          </h2>
          <ul className="border-app bg-surface divide-y overflow-hidden rounded-[var(--radius-card)] border">
            {k.menu.map(({ href, label, Ikon, ...sisa }) => {
              const jumlah = "badge" in sisa && sisa.badge ? (badge[sisa.badge] ?? 0) : 0;

              return (
                <li key={href}>
                  <Link href={href} className="flex items-center gap-3 px-4 py-3.5">
                    <span className="bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300 grid size-9 shrink-0 place-items-center rounded-lg">
                      <Ikon size={17} />
                    </span>
                    <span className="text-body flex-1 text-sm font-semibold">
                      {label}
                    </span>
                    {jumlah > 0 && (
                      <span className="bg-danger-500 tnum grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-[10.5px] font-bold text-white">
                        {jumlah}
                      </span>
                    )}
                    <ChevronRight size={16} className="text-subtle shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="space-y-2">
        <Link
          href="/"
          className="border-app bg-surface text-body flex h-11 items-center justify-center rounded-[var(--radius-input)] border text-sm font-semibold"
        >
          Buka tampilan karyawan
        </Link>
        <form action={aksiKeluar}>
          <button
            type="submit"
            className="border-danger-500/40 text-danger-700 dark:text-danger-300 flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-input)] border text-sm font-semibold"
          >
            <LogOut size={16} /> Keluar dari akun
          </button>
        </form>
      </div>
    </div>
  );
}
