import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { jadwalKaryawan } from "@/features/roster/service";
import { wajibMasuk } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { HARI_PENDEK, namaBulan, tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "Jadwal Jaga" };

/**
 * Jadwal jaga milik karyawan sendiri.
 *
 * Ditampilkan sebagai daftar tanggal, bukan kotak kalender: yang perlu dibaca
 * karyawan adalah nama shift dan jam mulainya, dan keduanya tidak muat di
 * dalam sel kalender selebar ponsel. Kalender berwarna sudah ada di Riwayat
 * untuk melihat pola sebulan sekilas.
 */
export default async function HalamanJadwal({
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

  const hari = await jadwalKaryawan(pengguna.employeeId, tahun, bulan);

  const jumlahJaga = hari.filter((h) => h.shift).length;
  const jumlahLibur = hari.filter((h) => h.libur).length;
  const belumDijadwalkan = hari.filter((h) => !h.shift && !h.libur).length;

  const geser = (delta: number) => {
    const m = bulan + delta;
    const t = tahun + Math.floor((m - 1) / 12);
    const b = ((((m - 1) % 12) + 12) % 12) + 1;
    return `/jadwal?bulan=${t}-${String(b).padStart(2, "0")}`;
  };

  return (
    <div className="pb-6">
      <header className="bg-surface border-app pt-safe border-b px-5 pb-6 lg:rounded-[var(--radius-sheet)] lg:border lg:px-7">
        <h1 className="text-body pt-4 text-[18px] font-bold lg:pt-2">Jadwal Jaga</h1>
      </header>

      <div className="lg:mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-start lg:gap-5">
        <div className="lg:space-y-4">
          <div className="bg-surface border-app mx-5 mt-4 flex items-center justify-between rounded-[var(--radius-card)] border px-2 py-2 lg:mx-0 lg:mt-0">
            <Link
              href={geser(-1)}
              className="text-muted hover:bg-surface-muted grid size-9 place-items-center rounded-lg transition-colors"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft size={19} />
            </Link>
            <span className="text-body text-sm font-bold">{namaBulan(tahun, bulan)}</span>
            <Link
              href={geser(1)}
              className="text-muted hover:bg-surface-muted grid size-9 place-items-center rounded-lg transition-colors"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight size={19} />
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 px-5 lg:mt-0 lg:px-0">
            {[
              { label: "Hari jaga", nilai: jumlahJaga, warna: "text-status-ontime" },
              { label: "Libur", nilai: jumlahLibur, warna: "text-status-holiday" },
              {
                label: "Belum diatur",
                nilai: belumDijadwalkan,
                warna: belumDijadwalkan > 0 ? "text-status-late" : "text-subtle",
              },
            ].map((k) => (
              <div
                key={k.label}
                className="bg-surface border-app rounded-[var(--radius-card)] border px-3 py-3 text-center"
              >
                <p className={cn("tnum text-lg font-bold", k.warna)}>{k.nilai}</p>
                <p className="text-subtle mt-0.5 text-[11px] font-semibold">{k.label}</p>
              </div>
            ))}
          </div>
        </div>

        <section className="mt-5 px-5 lg:mt-0 lg:px-0">
          <h2 className="text-body text-[13px] font-semibold">Rincian per tanggal</h2>
          {belumDijadwalkan > 0 && (
            /* Diletakkan sekali di sini, bukan diulang pada tiap baris: staf yang
             memang tidak dijadwalkan akan melihat sebulan penuh baris kosong,
             dan mengulang kalimat yang sama tiga puluh kali hanya jadi bising. */
            <p className="text-muted mt-1.5 text-xs leading-relaxed">
              Tanggal tanpa shift bukan berarti Anda tidak boleh masuk — kehadiran tetap
              tercatat penuh, hanya tidak dinilai terlambat atau lembur.
            </p>
          )}

          <ul className="bg-surface border-app mt-3 divide-y overflow-hidden rounded-[var(--radius-card)] border">
            {hari.map((h) => {
              const iniHariIni = h.tanggal === hariIni;
              const tanggalAngka = Number(h.tanggal.slice(8, 10));
              const dow = new Date(`${h.tanggal}T05:00:00Z`).getUTCDay();

              return (
                <li
                  key={h.tanggal}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    iniHariIni && "bg-brand-50 dark:bg-brand-900/25",
                  )}
                >
                  <div className="w-9 shrink-0 text-center">
                    <p className="text-subtle text-[10px] font-bold tracking-wide uppercase">
                      {HARI_PENDEK[dow]}
                    </p>
                    <p
                      className={cn(
                        "tnum text-[17px] leading-tight font-bold",
                        iniHariIni ? "text-brand-700 dark:text-brand-300" : "text-body",
                      )}
                    >
                      {tanggalAngka}
                    </p>
                  </div>

                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: h.shift ? h.shift.warna : "transparent",
                      outline: h.shift ? "none" : "1px solid var(--border-strong)",
                      outlineOffset: "-1px",
                    }}
                  />

                  <div className="min-w-0 flex-1">
                    {h.shift ? (
                      <>
                        <p className="text-body truncate text-sm font-bold">
                          {h.shift.nama}
                        </p>
                        <p className="tnum text-muted text-xs">
                          {h.shift.jamMasuk.slice(0, 5)}–{h.shift.jamPulang.slice(0, 5)}
                        </p>
                      </>
                    ) : (
                      <p className="text-muted text-sm font-semibold">
                        {h.libur ? (h.keterangan ?? "Libur") : "Belum dijadwalkan"}
                      </p>
                    )}
                  </div>

                  {h.sumber === "ROSTER" && h.shift && (
                    <span className="text-subtle bg-surface-muted shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
                      Khusus
                    </span>
                  )}
                  {iniHariIni && (
                    <span className="bg-brand-600 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white">
                      Hari ini
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
