import Link from "next/link";
import { eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight, LogIn, LogOut, Timer } from "lucide-react";

import { BadgeAbsen } from "@/components/ui/status";
import { getDb } from "@/db/client";
import { locations, procedureCatalog } from "@/db/schema";
import { LayarAbsen } from "@/features/attendance/layar-absen";
import {
  absensiAktif,
  riwayatBulan,
  ringkasanBulan,
  shiftBerlaku,
} from "@/features/attendance/service";
import { bacaPengaturan } from "@/features/settings/service";
import { wajibMasuk } from "@/lib/auth/session";
import { cn, formatDurasi } from "@/lib/utils";
import { HARI_PENDEK, jamWIB, namaBulan, tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "Presensi" };

export default async function HalamanPresensi({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const pengguna = await wajibMasuk();
  const sp = await searchParams;
  const db = await getDb();

  const hariIni = tanggalWIB();
  const [tahunKini, bulanKini] = hariIni.split("-").map(Number);

  const cocok = /^(\d{4})-(\d{2})$/.exec(sp.bulan ?? "");
  const tahun = cocok ? Number(cocok[1]) : tahunKini;
  const bulan = cocok ? Number(cocok[2]) : bulanKini;

  const [absen, jadwal, kebijakan, daftar, ringkas] = await Promise.all([
    absensiAktif(pengguna.employeeId),
    shiftBerlaku(pengguna.employeeId, hariIni),
    bacaPengaturan("kebijakan_absensi"),
    riwayatBulan(pengguna.employeeId, tahun, bulan),
    ringkasanBulan(pengguna.employeeId, tahun, bulan),
  ]);

  const [lokasi] = pengguna.locationId
    ? await db
        .select()
        .from(locations)
        .where(eq(locations.id, pengguna.locationId))
        .limit(1)
    : [];

  const daftarTindakan = pengguna.isiFormTindakan
    ? await db
        .select({
          id: procedureCatalog.id,
          nama: procedureCatalog.nama,
          kategori: procedureCatalog.kategori,
          fee: procedureCatalog.feeDefault,
        })
        .from(procedureCatalog)
        .where(eq(procedureCatalog.aktif, true))
    : [];

  const absenHariIni =
    absen?.tanggal === hariIni ? absen : absen?.clockOutAt ? null : absen;

  const geser = (delta: number) => {
    const m = bulan + delta;
    const t = tahun + Math.floor((m - 1) / 12);
    const b = ((((m - 1) % 12) + 12) % 12) + 1;
    return `/riwayat?bulan=${t}-${String(b).padStart(2, "0")}`;
  };

  const bulanIni = tahun === tahunKini && bulan === bulanKini;

  return (
    <div className="pb-6">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-5">
        {/* ------------------------------------------------- Layar absen */}
        <LayarAbsen
          sudahMasuk={Boolean(absenHariIni?.clockInAt)}
          sudahPulang={Boolean(absenHariIni?.clockOutAt)}
          jamMasuk={absenHariIni?.clockInAt ? jamWIB(absenHariIni.clockInAt) : null}
          jamPulang={absenHariIni?.clockOutAt ? jamWIB(absenHariIni.clockOutAt) : null}
          jadwal={
            jadwal.shift
              ? {
                  nama: jadwal.shift.nama,
                  jamMasuk: jadwal.shift.jamMasuk,
                  jamPulang: jadwal.shift.jamPulang,
                }
              : null
          }
          bolehTanpaShift={kebijakan.izinkanAbsenTanpaShift}
          lokasi={
            lokasi
              ? {
                  nama: lokasi.nama,
                  alamat: lokasi.alamat,
                  lat: lokasi.lat,
                  lng: lokasi.lng,
                  radiusM: lokasi.radiusM,
                  toleransiAkurasiM: lokasi.gpsAccuracyToleranceM,
                }
              : null
          }
          isiFormTindakan={pengguna.isiFormTindakan}
          daftarTindakan={daftarTindakan}
        />

        {/* ---------------------------------------------- Rekap kehadiran */}
        <section className="mt-6 px-5 lg:mt-4 lg:px-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-body text-[13px] font-semibold">Rekap kehadiran</h2>
            <div className="bg-surface border-app flex items-center gap-1 rounded-full border py-1 pr-1 pl-1">
              <Link
                href={geser(-1)}
                className="text-muted hover:bg-surface-muted grid size-7 place-items-center rounded-full transition-colors"
                aria-label="Bulan sebelumnya"
              >
                <ChevronLeft size={16} />
              </Link>
              <span className="text-body px-1 text-[12px] font-bold">
                {namaBulan(tahun, bulan)}
              </span>
              <Link
                href={geser(1)}
                className="text-muted hover:bg-surface-muted grid size-7 place-items-center rounded-full transition-colors"
                aria-label="Bulan berikutnya"
              >
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>

          {!bulanIni && (
            <Link
              href="/riwayat"
              className="text-brand-700 dark:text-brand-300 mt-1.5 inline-block text-[11px] font-semibold"
            >
              Kembali ke bulan ini
            </Link>
          )}

          {/* Ringkasan angka */}
          <div className="bg-surface border-app mt-3 grid grid-cols-4 gap-2 rounded-[var(--radius-card)] border px-3 py-3 text-center">
            {[
              {
                label: "Hadir",
                nilai: String(ringkas.hadir),
                warna: "text-status-ontime",
              },
              {
                label: "Telat",
                nilai: String(ringkas.terlambat),
                warna: "text-status-late",
              },
              {
                label: "Lembur",
                nilai: formatDurasi(ringkas.totalMenitLembur),
                warna: "text-status-overtime",
              },
              {
                label: "Jam kerja",
                nilai: formatDurasi(ringkas.totalMenitKerja),
                warna: "text-body",
              },
            ].map((k) => (
              <div key={k.label}>
                <p className={cn("tnum text-sm font-bold", k.warna)}>{k.nilai}</p>
                <p className="text-subtle mt-0.5 text-[10px] font-semibold">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Kartu per hari — bukan kalender: yang dicari orang adalah jam
              masuk dan pulangnya, dan itu tidak muat di dalam sel tanggal. */}
          {daftar.length === 0 ? (
            <div className="border-app bg-surface mt-3 rounded-[var(--radius-card)] border px-5 py-9 text-center">
              <Timer size={26} className="text-subtle mx-auto" />
              <p className="text-body mt-3 text-sm font-bold">Belum ada catatan</p>
              <p className="text-muted mt-1 text-[13px]">
                Absensi {namaBulan(tahun, bulan)} belum terekam.
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {daftar.map((d) => {
                const tanggalKe = Number(d.tanggal.slice(8, 10));
                const namaHari =
                  HARI_PENDEK[new Date(`${d.tanggal}T00:00:00Z`).getUTCDay()];

                return (
                  <li
                    key={d.id}
                    className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border"
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="bg-brand-50 dark:bg-brand-900/40 grid size-11 shrink-0 place-items-center rounded-lg leading-none">
                        <span className="text-brand-700 dark:text-brand-200 tnum text-[15px] font-bold">
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

                    {(d.menitTerlambat > 0 ||
                      d.clockInOutsideArea ||
                      d.flags.includes("WFH")) && (
                      <div className="border-app space-y-1 border-t px-4 py-2.5">
                        {d.menitTerlambat > 0 && (
                          <p className="text-status-late text-[12px] font-semibold">
                            Terlambat {d.menitTerlambat} menit
                          </p>
                        )}
                        {d.flags.includes("WFH") ? (
                          <p className="text-status-leave text-[12px] font-semibold">
                            Bekerja dari rumah ({d.clockInDistanceM} m dari klinik)
                          </p>
                        ) : (
                          d.clockInOutsideArea && (
                            <p className="text-status-absent text-[12px] font-semibold">
                              Absen di luar area ({d.clockInDistanceM} m)
                            </p>
                          )
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
