import Link from "next/link";
import { desc, eq, isNotNull } from "drizzle-orm";
import { Bell, Megaphone } from "lucide-react";

import { Avatar, type JenisKelamin } from "@/components/mobile/avatar";
import { BadgeAbsen } from "@/components/ui/status";
import { getDb } from "@/db/client";
import { announcements, employees } from "@/db/schema";
import { MenuUtama } from "@/components/mobile/menu-aplikasi";
import { absensiAktif, shiftBerlaku } from "@/features/attendance/service";
import { jumlahBelumDibaca } from "@/features/notifications/service";
import { bacaPengaturan } from "@/features/settings/service";
import { wajibMasuk } from "@/lib/auth/session";
import { formatDurasi } from "@/lib/utils";
import { jamWIB, tanggalPanjang, tanggalWIB } from "@/lib/waktu";

export default async function BerandaKaryawan() {
  const pengguna = await wajibMasuk();
  const db = await getDb();

  const hariIni = tanggalWIB();

  const [absen, jadwal, profil] = await Promise.all([
    absensiAktif(pengguna.employeeId),
    shiftBerlaku(pengguna.employeeId, hariIni),
    bacaPengaturan("profil_perusahaan"),
  ]);

  const [karyawan] = await db
    .select({
      menuBeranda: employees.menuBeranda,
      fotoProfil: employees.fotoProfil,
      jenisKelamin: employees.jenisKelamin,
    })
    .from(employees)
    .where(eq(employees.id, pengguna.employeeId))
    .limit(1);

  const belumDibaca = await jumlahBelumDibaca(pengguna.userId);

  const [pengumuman] = await db
    .select()
    .from(announcements)
    .where(isNotNull(announcements.publishedAt))
    .orderBy(desc(announcements.publishedAt))
    .limit(1);

  const absenHariIni =
    absen?.tanggal === hariIni ? absen : absen?.clockOutAt ? null : absen;

  return (
    <div className="pb-6">
      {/* ------------------------------------------------------- Kepala */}
      <header className="bg-brand-700 pt-safe relative overflow-hidden px-5 pb-5 lg:flex lg:items-center lg:gap-8 lg:rounded-[var(--radius-sheet)] lg:px-7 lg:pb-7">
        {/* Ornamen: dua lingkaran cahaya yang sangat samar supaya bidang hijau
            selebar ini tidak terbaca sebagai blok datar. Ditaruh di kepala,
            bukan di atas kartu, agar tidak pernah jatuh di belakang angka. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-white/[0.07]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-24 size-60 rounded-full bg-white/[0.05]"
        />
        <div className="relative flex items-start justify-between pt-4 lg:min-w-0 lg:flex-1 lg:pt-2">
          <div className="min-w-0">
            {profil.nama && (
              <span className="inline-block rounded-md bg-white/15 px-2 py-1 text-[11px] font-bold text-white">
                {profil.nama}
              </span>
            )}
            <h1 className="mt-2 truncate text-[20px] leading-tight font-bold text-white">
              {pengguna.nama}
            </h1>
            <p className="mt-0.5 truncate text-[13px] text-white/75">
              {pengguna.namaJabatan ?? "Karyawan"}
              {pengguna.namaLokasi ? ` · ${pengguna.namaLokasi}` : ""}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1 lg:hidden">
            <Link
              href="/notifikasi"
              className="relative grid size-10 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10"
              aria-label={
                belumDibaca > 0 ? `Notifikasi, ${belumDibaca} belum dibaca` : "Notifikasi"
              }
            >
              <Bell size={21} />
              {belumDibaca > 0 && (
                <span className="bg-danger-500 tnum absolute top-1 right-1 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-semibold text-white">
                  {belumDibaca > 9 ? "9+" : belumDibaca}
                </span>
              )}
            </Link>
            <Link href="/profil" className="shrink-0" aria-label="Profil">
              <Avatar
                nama={pengguna.nama}
                fotoUrl={
                  karyawan?.fotoProfil ? `/api/berkas/${karyawan.fotoProfil}` : null
                }
                jenisKelamin={karyawan?.jenisKelamin as JenisKelamin}
                className="size-11 bg-white/15 text-base text-white ring-1 ring-white/25"
              />
            </Link>
          </div>
        </div>

        {/* Ringkasan hari ini — tanggal, jam shift, dan jam yang tercatat */}
        <div className="bg-surface relative mt-5 rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-raised)] lg:mt-0 lg:w-[440px] lg:shrink-0 lg:p-5">
          <div className="flex items-center justify-between">
            <p className="text-body text-[13px] font-bold">{tanggalPanjang(hariIni)}</p>
            <p className="tnum text-brand-700 dark:text-brand-300 text-[13px] font-bold">
              {jadwal.shift
                ? `${jadwal.shift.jamMasuk.slice(0, 5)} – ${jadwal.shift.jamPulang.slice(0, 5)}`
                : "Tanpa shift"}
            </p>
          </div>

          <div className="border-app mt-3 grid grid-cols-3 gap-2 border-t pt-3">
            {[
              {
                label: "Masuk",
                nilai: absenHariIni?.clockInAt ? jamWIB(absenHariIni.clockInAt) : "--:--",
              },
              {
                label: "Pulang",
                nilai: absenHariIni?.clockOutAt
                  ? jamWIB(absenHariIni.clockOutAt)
                  : "--:--",
              },
              {
                label: "Terlambat",
                nilai: absenHariIni?.menitTerlambat
                  ? formatDurasi(absenHariIni.menitTerlambat)
                  : "--:--",
              },
            ].map((k) => (
              <div key={k.label}>
                <p className="text-subtle text-[11px] font-semibold">{k.label}</p>
                <p className="tnum text-body mt-0.5 text-[15px] font-bold">{k.nilai}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Dua kolom di komputer: yang dikerjakan tiap hari di kiri, kabar di kanan */}
      <div className="lg:mt-5 lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
        <div className="lg:space-y-5">
          {/* Status hari ini */}
          {absenHariIni && (
            <div className="mt-4 px-5 lg:mt-0 lg:px-0">
              <div className="bg-surface border-app flex items-center justify-between rounded-[var(--radius-card)] border px-4 py-3">
                <span className="text-muted text-sm font-semibold">Status hari ini</span>
                <BadgeAbsen status={absenHariIni.status} />
              </div>
            </div>
          )}

          <MenuUtama pilihan={karyawan?.menuBeranda} />
        </div>

        <div>
          {/* ------------------------------------------- Info dari manajemen */}
          <section className="mt-7 px-5 lg:mt-0 lg:px-0">
            <div className="flex items-center justify-between">
              <h2 className="text-body text-[13px] font-semibold">Info dari Manajemen</h2>
              <Link
                href="/notifikasi"
                className="text-brand-700 dark:text-brand-300 text-xs font-semibold"
              >
                Semua
              </Link>
            </div>

            {pengumuman ? (
              <article className="border-app bg-surface mt-3 rounded-[var(--radius-card)] border p-4">
                <div className="flex items-center gap-2">
                  <span className="bg-brand-50 dark:bg-brand-900/40 grid size-8 place-items-center rounded-lg">
                    <Megaphone size={15} className="text-brand-600 dark:text-brand-300" />
                  </span>
                  <p className="text-body flex-1 text-sm font-bold">{pengumuman.judul}</p>
                </div>
                <p className="text-muted mt-2.5 text-[13px] leading-relaxed">
                  {pengumuman.isi}
                </p>
              </article>
            ) : (
              <div className="border-app bg-surface mt-3 rounded-[var(--radius-card)] border px-4 py-8 text-center">
                <Megaphone size={22} className="text-subtle mx-auto" />
                <p className="text-muted mt-2 text-[13px]">
                  Belum ada info dari manajemen
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
