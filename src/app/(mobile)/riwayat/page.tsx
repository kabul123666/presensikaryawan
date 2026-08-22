import Link from "next/link";
import { ChevronLeft, ChevronRight, LogIn, LogOut, Timer } from "lucide-react";

import { BadgeAbsen } from "@/components/ui/status";
import { riwayatBulan, ringkasanBulan } from "@/features/attendance/service";
import { wajibMasuk } from "@/lib/auth/session";
import { cn, formatDurasi } from "@/lib/utils";
import { HARI_PENDEK, jamWIB, namaBulan, tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "Riwayat Kehadiran" };

/** Warna titik penanda pada kalender, satu per status absensi. */
const WARNA_STATUS: Record<string, string> = {
  ON_TIME: "bg-status-ontime",
  LATE: "bg-status-late",
  OVERTIME: "bg-status-overtime",
  EARLY_LEAVE: "bg-status-late",
  ABSENT: "bg-status-absent",
  ON_LEAVE: "bg-status-leave",
  HOLIDAY: "bg-status-holiday",
  DAY_OFF: "bg-status-holiday",
  INCOMPLETE: "bg-status-late",
};

/** Keterangan titik warna supaya kalender bisa dibaca tanpa menebak. */
const KETERANGAN = [
  { warna: "bg-status-ontime", label: "Tepat waktu" },
  { warna: "bg-status-late", label: "Terlambat" },
  { warna: "bg-status-overtime", label: "Lembur" },
  { warna: "bg-status-leave", label: "Cuti/Izin" },
];

export default async function HalamanRiwayat({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const pengguna = await wajibMasuk();
  const sp = await searchParams;

  const hariIni = tanggalWIB();
  const [tahunKini, bulanKini] = hariIni.split("-").map(Number);

  const cocok = /^(\d{4})-(\d{2})$/.exec(sp.bulan ?? "");
  const tahun = cocok ? Number(cocok[1]) : tahunKini;
  const bulan = cocok ? Number(cocok[2]) : bulanKini;

  const [daftar, ringkas] = await Promise.all([
    riwayatBulan(pengguna.employeeId, tahun, bulan),
    ringkasanBulan(pengguna.employeeId, tahun, bulan),
  ]);

  const petaStatus = new Map(daftar.map((d) => [d.tanggal, d]));
  const jumlahHari = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
  const awalKolom = new Date(Date.UTC(tahun, bulan - 1, 1)).getUTCDay();
  const bulanIni = tahun === tahunKini && bulan === bulanKini;

  const geser = (delta: number) => {
    const m = bulan + delta;
    const t = tahun + Math.floor((m - 1) / 12);
    const b = ((((m - 1) % 12) + 12) % 12) + 1;
    return `/riwayat?bulan=${t}-${String(b).padStart(2, "0")}`;
  };

  return (
    <div className="pb-6">
      {/* ------------------------------------------------------- Kepala */}
      <header className="bg-brand-700 pt-safe px-5 pb-16 lg:flex lg:items-center lg:gap-8 lg:rounded-[var(--radius-sheet)] lg:px-7 lg:pb-7">
        <div className="flex items-start justify-between pt-4 lg:min-w-0 lg:flex-1 lg:pt-2">
          <div className="min-w-0">
            <h1 className="text-[20px] leading-tight font-extrabold text-white">
              Presensi Saya
            </h1>
            <p className="mt-0.5 truncate text-[13px] text-white/75">
              Rekap kehadiran {pengguna.nama}
            </p>
          </div>
          {!bulanIni && (
            <Link
              href="/riwayat"
              className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-white/25"
            >
              Bulan ini
            </Link>
          )}
        </div>

        {/* Pemilih bulan menempel di kepala agar konteks angka di bawahnya jelas */}
        <div className="mt-4 flex items-center justify-between rounded-[var(--radius-card)] bg-white/12 px-1.5 py-1.5 lg:mt-0 lg:w-[260px] lg:shrink-0">
          <Link
            href={geser(-1)}
            className="grid size-8 place-items-center rounded-lg text-white/85 transition-colors hover:bg-white/15"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft size={18} />
          </Link>
          <span className="text-[13px] font-extrabold text-white">
            {namaBulan(tahun, bulan)}
          </span>
          <Link
            href={geser(1)}
            className="grid size-8 place-items-center rounded-lg text-white/85 transition-colors hover:bg-white/15"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight size={18} />
          </Link>
        </div>
      </header>

      <div className="lg:mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-start lg:gap-5">
        <div className="lg:space-y-5">
          {/* ----------------------------------------------------- Ringkasan */}
          <div className="-mt-12 px-5 lg:mt-0 lg:px-0">
            <div className="bg-surface rounded-[var(--radius-sheet)] p-5 shadow-[var(--shadow-raised)]">
              <p className="text-subtle text-xs font-semibold">Hari hadir</p>
              <p className="tnum text-body mt-1 text-[32px] leading-none font-extrabold">
                {ringkas.hadir}{" "}
                <span className="text-muted text-base font-bold">hari</span>
              </p>

              <div className="border-app text-muted mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center text-[11px]">
                <div>
                  <p className="text-status-late tnum text-sm font-extrabold">
                    {ringkas.terlambat}
                  </p>
                  <p className="mt-0.5">Terlambat</p>
                </div>
                <div>
                  <p className="text-status-overtime tnum text-sm font-extrabold">
                    {formatDurasi(ringkas.totalMenitLembur)}
                  </p>
                  <p className="mt-0.5">Lembur</p>
                </div>
                <div>
                  <p className="text-body tnum text-sm font-extrabold">
                    {formatDurasi(ringkas.totalMenitKerja)}
                  </p>
                  <p className="mt-0.5">Jam kerja</p>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------ Kalender */}
          <section className="mt-6 px-5 lg:mt-0 lg:px-0">
            <h2 className="text-body text-sm font-extrabold tracking-tight">
              Kalender kehadiran
            </h2>

            <div className="bg-surface border-app mt-3 rounded-[var(--radius-card)] border p-4">
              <div className="grid grid-cols-7 gap-1">
                {HARI_PENDEK.map((h) => (
                  <div
                    key={h}
                    className="text-subtle pb-1 text-center text-[10px] font-bold"
                  >
                    {h}
                  </div>
                ))}
                {Array.from({ length: awalKolom }).map((_, i) => (
                  <div key={`kosong-${i}`} />
                ))}
                {Array.from({ length: jumlahHari }).map((_, i) => {
                  const tgl = `${tahun}-${String(bulan).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                  const data = petaStatus.get(tgl);
                  const iniHariIni = tgl === hariIni;
                  return (
                    <div
                      key={tgl}
                      className={cn(
                        "relative grid aspect-square place-items-center rounded-lg text-[11px] font-bold",
                        data ? "text-body bg-surface-muted" : "text-subtle",
                        iniHariIni && "ring-brand-500 ring-2",
                      )}
                    >
                      {i + 1}
                      {data && (
                        <span
                          className={cn(
                            "absolute bottom-1 size-1.5 rounded-full",
                            WARNA_STATUS[data.status] ?? "bg-status-holiday",
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="border-app mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t pt-3">
                {KETERANGAN.map((k) => (
                  <span key={k.label} className="flex items-center gap-1.5">
                    <span className={cn("size-1.5 rounded-full", k.warna)} />
                    <span className="text-subtle text-[10px] font-semibold">
                      {k.label}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ------------------------------------------------ Rincian harian */}
        <section className="mt-6 px-5 lg:mt-0 lg:px-0">
          <div className="flex items-center justify-between">
            <h2 className="text-body text-sm font-extrabold tracking-tight">
              Rincian harian
            </h2>
            {daftar.length > 0 && (
              <span className="text-subtle tnum text-[11px] font-semibold">
                {daftar.length} catatan
              </span>
            )}
          </div>

          {daftar.length === 0 ? (
            <div className="border-app bg-surface mt-3 rounded-[var(--radius-card)] border border-dashed px-5 py-12 text-center">
              <Timer size={26} className="text-subtle mx-auto" />
              <p className="text-body mt-3 text-sm font-bold">Belum ada catatan</p>
              <p className="text-muted mt-1 text-[13px]">
                Absensi {namaBulan(tahun, bulan)} belum terekam.
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {daftar.map((d) => {
                const [, , tanggalKe] = d.tanggal.split("-").map(Number);
                const namaHari =
                  HARI_PENDEK[new Date(`${d.tanggal}T00:00:00Z`).getUTCDay()];

                return (
                  <li
                    key={d.id}
                    className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border"
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Tanggal dibuat blok besar supaya baris mudah dipindai */}
                      <span className="bg-brand-50 dark:bg-brand-900/40 grid size-11 shrink-0 place-items-center rounded-lg leading-none">
                        <span className="text-brand-700 dark:text-brand-200 tnum text-[15px] font-extrabold">
                          {tanggalKe}
                        </span>
                        <span className="text-brand-600 dark:text-brand-300 mt-0.5 text-[9px] font-bold">
                          {namaHari}
                        </span>
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-body text-sm font-bold">
                          {d.durasiKerjaMenit > 0
                            ? formatDurasi(d.durasiKerjaMenit)
                            : "Belum ada durasi"}
                        </p>
                        <p className="text-subtle text-[12px]">
                          {d.menitLembur > 0
                            ? `Lembur ${formatDurasi(d.menitLembur)}`
                            : "Jam kerja tercatat"}
                        </p>
                      </div>

                      <BadgeAbsen status={d.status} />
                    </div>

                    <div className="border-app grid grid-cols-2 gap-2 border-t px-4 py-3">
                      <div className="flex items-center gap-2">
                        <LogIn size={15} className="text-status-ontime shrink-0" />
                        <span>
                          <span className="text-subtle block text-[10px] font-semibold">
                            Masuk
                          </span>
                          <span className="text-body tnum block text-[13px] font-bold">
                            {d.clockInAt ? jamWIB(d.clockInAt) : "--:--"}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <LogOut size={15} className="text-status-absent shrink-0" />
                        <span>
                          <span className="text-subtle block text-[10px] font-semibold">
                            Pulang
                          </span>
                          <span className="text-body tnum block text-[13px] font-bold">
                            {d.clockOutAt ? jamWIB(d.clockOutAt) : "--:--"}
                          </span>
                        </span>
                      </div>
                    </div>

                    {(d.menitTerlambat > 0 || d.clockInOutsideArea) && (
                      <div className="border-app space-y-1 border-t px-4 py-2.5">
                        {d.menitTerlambat > 0 && (
                          <p className="text-status-late text-[12px] font-semibold">
                            Terlambat {d.menitTerlambat} menit
                          </p>
                        )}
                        {d.clockInOutsideArea && (
                          <p className="text-status-absent text-[12px] font-semibold">
                            Absen di luar area ({d.clockInDistanceM} m)
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
