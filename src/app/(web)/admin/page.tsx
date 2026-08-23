import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Badge, BadgeAbsen } from "@/components/ui/status";
import type { RequestType } from "@/db/schema";
import {
  absensiHariIni,
  antreanPendaftaran,
  antreanPersetujuan,
  belumAbsen,
  perluDitinjau,
  ringkasanHariIni,
  trenKehadiran,
} from "@/features/admin/service";
import { LABEL_FLAG } from "@/features/admin/tabel-anomali";
import { wajibAksesMenu } from "@/lib/auth/akses";
import { cn } from "@/lib/utils";
import { jamWIB, tanggalPanjang, tanggalPendek, tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "Dashboard" };

const LABEL_TIPE: Record<RequestType, string> = {
  LEAVE: "Cuti",
  OVERTIME: "Lembur",
  BACKDATE: "Koreksi absen",
  PERMIT: "Izin",
  OUTSIDE_AREA: "Absen luar area",
  DEVICE_CHANGE: "Ganti perangkat",
};

function KartuAngka({
  label,
  nilai,
  dari,
  catatan,
  warna,
}: {
  label: string;
  nilai: number | string;
  dari?: number;
  catatan: string;
  warna: string;
}) {
  return (
    <div className="bg-surface border-app rounded-[var(--radius-card)] border px-4 py-3.5">
      <p className="text-subtle text-xs font-medium">{label}</p>
      <p className={cn("tnum mt-1.5 text-2xl leading-none font-semibold", warna)}>
        {nilai}
        {dari !== undefined && (
          <span className="text-subtle text-sm font-normal">/{dari}</span>
        )}
      </p>
      <p className="text-subtle mt-1.5 text-[11px]">{catatan}</p>
    </div>
  );
}

function Panel({
  judul,
  jumlah,
  tautan,
  labelTautan,
  children,
}: {
  judul: string;
  jumlah?: number;
  tautan?: string;
  labelTautan?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border">
      <header className="border-app flex items-baseline justify-between border-b px-4 py-3">
        <h2 className="text-body text-sm font-semibold">
          {judul}
          {jumlah !== undefined && (
            <span className="text-subtle tnum ml-1.5 text-xs font-normal">{jumlah}</span>
          )}
        </h2>
        {tautan && (
          <Link
            href={tautan}
            className="text-brand-700 dark:text-brand-300 text-xs font-medium"
          >
            {labelTautan ?? "Lihat"}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

export default async function HalamanDashboard() {
  await wajibAksesMenu("dashboard");
  const hariIni = tanggalWIB();

  const [ringkas, feed, tren, antrean, pendaftaran, tinjau, belum] = await Promise.all([
    ringkasanHariIni(hariIni),
    absensiHariIni(hariIni),
    trenKehadiran(14),
    antreanPersetujuan(5),
    antreanPendaftaran(),
    perluDitinjau(5),
    belumAbsen(hariIni),
  ]);

  const maksTren = Math.max(1, ...tren.map((t) => t.hadir));
  const persenHadir =
    ringkas.totalKaryawan > 0
      ? Math.round((ringkas.hadir / ringkas.totalKaryawan) * 100)
      : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-body text-xl font-semibold">Dashboard</h1>
        <p className="text-muted text-[13px]">{tanggalPanjang(hariIni)}</p>
      </div>

      {/* Angka utama hari ini */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KartuAngka
          label="Hadir hari ini"
          nilai={ringkas.hadir}
          dari={ringkas.totalKaryawan}
          catatan={`${persenHadir}% dari karyawan aktif`}
          warna="text-status-ontime"
        />
        <KartuAngka
          label="Terlambat"
          nilai={ringkas.terlambat}
          catatan="Melewati toleransi shift"
          warna="text-status-late"
        />
        <KartuAngka
          label="Belum absen"
          nilai={ringkas.belumAbsen}
          catatan="Karyawan aktif tanpa clock in"
          warna="text-status-absent"
        />
        <KartuAngka
          label="Butuh persetujuan"
          nilai={ringkas.menungguPersetujuan}
          catatan="Cuti, lembur, koreksi"
          warna="text-status-leave"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          {/* Tren kehadiran */}
          <Panel judul="Tren kehadiran 14 hari">
            <div className="px-4 py-4">
              {tren.every((t) => t.hadir === 0) ? (
                <p className="text-subtle py-8 text-center text-[13px]">
                  Belum ada data kehadiran.
                </p>
              ) : (
                <>
                  <div className="flex h-32 items-end gap-1.5">
                    {tren.map((t) => (
                      <div
                        key={t.tanggal}
                        className="group flex flex-1 flex-col justify-end gap-0.5"
                        title={`${tanggalPendek(t.tanggal)} · hadir ${t.hadir}, terlambat ${t.terlambat}`}
                      >
                        <div
                          className="bg-brand-600/85 group-hover:bg-brand-700 w-full rounded-t-sm transition-colors"
                          style={{ height: `${(t.hadir / maksTren) * 100}%` }}
                        />
                        {t.terlambat > 0 && (
                          <div
                            className="bg-status-late w-full rounded-b-sm"
                            style={{
                              height: `${Math.max(4, (t.terlambat / maksTren) * 100)}%`,
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="text-subtle tnum mt-2 flex justify-between text-[11px]">
                    <span>{tanggalPendek(tren[0]?.tanggal ?? hariIni)}</span>
                    <span>{tanggalPendek(hariIni)}</span>
                  </div>
                </>
              )}
            </div>
          </Panel>

          {/* Absensi hari ini */}
          <Panel
            judul="Absensi hari ini"
            jumlah={feed.length}
            tautan="/admin/absensi"
            labelTautan="Rekap lengkap"
          >
            {feed.length === 0 ? (
              <p className="text-subtle px-4 py-10 text-center text-[13px]">
                Belum ada yang absen hari ini.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="border-app text-subtle border-b text-left text-[11px] font-medium">
                      <th className="px-4 py-2">Karyawan</th>
                      <th className="px-3 py-2">Masuk</th>
                      <th className="px-3 py-2">Pulang</th>
                      <th className="px-3 py-2">Lokasi</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feed.map((f) => (
                      <tr
                        key={f.id}
                        className="border-app hover:bg-surface-muted border-b transition-colors last:border-0"
                      >
                        <td className="px-4 py-2.5">
                          <p className="text-body text-[13px] font-medium">{f.nama}</p>
                          <p className="text-subtle text-[11px]">{f.jabatan ?? "—"}</p>
                        </td>
                        <td className="text-body tnum px-3 py-2.5 text-[13px]">
                          {f.clockInAt ? jamWIB(f.clockInAt) : "—"}
                          {f.menitTerlambat > 0 && (
                            <span className="text-status-late tnum block text-[10px]">
                              +{f.menitTerlambat}m
                            </span>
                          )}
                        </td>
                        <td className="text-muted tnum px-3 py-2.5 text-[13px]">
                          {f.clockOutAt ? jamWIB(f.clockOutAt) : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {f.diLuarArea ? (
                            <Badge tone="danger">Luar area · {f.jarakM} m</Badge>
                          ) : (
                            <span className="text-subtle text-[11px]">
                              Dalam area
                              {f.jarakM !== null ? ` · ${f.jarakM} m` : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <BadgeAbsen status={f.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        {/* Rail kanan */}
        <div className="space-y-5">
          {pendaftaran.length > 0 && (
            <Panel
              judul="Pendaftaran baru"
              jumlah={pendaftaran.length}
              tautan="/admin/karyawan"
              labelTautan="Verifikasi"
            >
              <ul className="divide-app divide-y">
                {pendaftaran.slice(0, 4).map((p) => (
                  <li key={p.userId} className="px-4 py-2.5">
                    <p className="text-body truncate text-[13px] font-medium">{p.nama}</p>
                    <p className="text-subtle truncate font-mono text-[11px]">
                      {p.username}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel
            judul="Menunggu persetujuan"
            jumlah={ringkas.menungguPersetujuan}
            tautan="/admin/persetujuan"
            labelTautan="Buka antrean"
          >
            {antrean.length === 0 ? (
              <p className="text-subtle px-4 py-6 text-center text-[13px]">
                Tidak ada antrean.
              </p>
            ) : (
              <ul className="divide-app divide-y">
                {antrean.map((a) => (
                  <li key={a.id} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-body truncate text-[13px] font-medium">
                        {a.nama}
                      </p>
                      <span className="text-subtle shrink-0 text-[11px]">
                        {LABEL_TIPE[a.tipe]}
                      </span>
                    </div>
                    {a.alasan && (
                      <p className="text-subtle mt-0.5 line-clamp-1 text-[11px]">
                        {a.alasan}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {belum.length > 0 && (
            <Panel judul="Belum absen hari ini" jumlah={belum.length}>
              <ul className="divide-app divide-y">
                {belum.slice(0, 6).map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 px-4 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="text-body block truncate text-[13px]">
                        {b.nama}
                      </span>
                      <span className="text-subtle block truncate text-[11px]">
                        {b.jabatan ?? "—"}
                      </span>
                    </span>
                    {b.noHp && (
                      <a
                        href={`https://wa.me/${b.noHp.replace(/^0/, "62")}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-brand-700 dark:text-brand-300 inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium"
                      >
                        Ingatkan <ArrowUpRight size={11} />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {tinjau.length > 0 && (
            <Panel
              judul="Perlu ditinjau"
              jumlah={tinjau.length}
              tautan="/admin/anomali"
              labelTautan="Tinjau"
            >
              <ul className="divide-app divide-y">
                {tinjau.map((t) => (
                  <li key={t.id} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-body truncate text-[13px] font-medium">
                        {t.nama}
                      </p>
                      <span className="text-subtle tnum shrink-0 text-[11px]">
                        {tanggalPendek(t.tanggal)}
                      </span>
                    </div>
                    <p className="text-status-absent mt-0.5 text-[11px]">
                      {t.flags.map((f) => LABEL_FLAG[f] ?? f).join(" · ") ||
                        "Belum clock out"}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
