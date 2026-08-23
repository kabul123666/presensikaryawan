"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import type { YearEndChoice } from "@/db/schema";
import { cn, formatRupiah } from "@/lib/utils";
import { aksiTutupTahunCuti, type HasilPengaturan } from "./actions";
import type { BarisSisaCuti } from "./service";

const PILIHAN: { nilai: YearEndChoice; label: string }[] = [
  { nilai: "CARRY_OVER", label: "Dibawa" },
  { nilai: "ENCASH", label: "Diuangkan" },
  { nilai: "SPLIT", label: "Sebagian" },
];

export function PanelTutupTahun({
  tahun,
  daftar,
  maxCarryOver,
  bolehDiuangkan,
  tarifPerHari,
  sudahDitutup,
  ringkasanTutup,
}: {
  tahun: number;
  daftar: BarisSisaCuti[];
  maxCarryOver: number;
  bolehDiuangkan: boolean;
  tarifPerHari: number;
  sudahDitutup: { dijalankanAt: string; ringkasan: Record<string, unknown> } | null;
  ringkasanTutup: { nama: string; jumlahHari: number; totalNominal: number }[];
}) {
  const [hasil, kirim, sedang] = useActionState<HasilPengaturan | null, FormData>(
    aksiTutupTahunCuti,
    null,
  );

  const [keputusan, setKeputusan] = useState<
    Record<string, { pilihan: YearEndChoice; hari: number }>
  >(() =>
    Object.fromEntries(
      daftar.map((d) => [
        d.employeeId,
        { pilihan: "CARRY_OVER" as YearEndChoice, hari: 0 },
      ]),
    ),
  );

  const punyaSisa = daftar.filter((d) => d.sisa > 0);

  const estimasi = punyaSisa.reduce((total, d) => {
    const k = keputusan[d.employeeId];
    if (!k) return total;
    const hari =
      k.pilihan === "ENCASH"
        ? d.sisa
        : k.pilihan === "SPLIT"
          ? Math.min(k.hari, d.sisa)
          : 0;
    return total + hari * tarifPerHari;
  }, 0);

  if (sudahDitutup) {
    return (
      <div className="space-y-4">
        <div className="border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/40 flex items-start gap-3 rounded-[var(--radius-card)] border p-5">
          <CheckCircle2 className="text-brand-600 dark:text-brand-300 mt-0.5" size={20} />
          <div>
            <p className="text-brand-800 dark:text-brand-100 text-sm font-bold">
              Tutup tahun {tahun} sudah dijalankan
            </p>
            <p className="text-brand-700/85 dark:text-brand-200/80 mt-1 text-[13px]">
              Dijalankan pada {sudahDitutup.dijalankanAt}. Proses ini hanya bisa dilakukan
              sekali per tahun agar pencairan tidak pernah dobel.
            </p>
          </div>
        </div>

        {ringkasanTutup.length > 0 && (
          <div className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border">
            <h3 className="border-app text-body border-b px-5 py-4 text-base font-extrabold">
              Daftar pencairan {tahun}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-app text-subtle border-b text-left text-[11px] font-bold tracking-wide uppercase">
                  <th className="px-5 py-2.5">Karyawan</th>
                  <th className="px-3 py-2.5 text-center">Hari</th>
                  <th className="px-5 py-2.5 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {ringkasanTutup.map((r) => (
                  <tr key={r.nama} className="border-app border-b last:border-0">
                    <td className="text-body px-5 py-3 font-semibold">{r.nama}</td>
                    <td className="text-body tnum px-3 py-3 text-center">
                      {r.jumlahHari}
                    </td>
                    <td className="text-body tnum px-5 py-3 text-right font-extrabold">
                      {formatRupiah(r.totalNominal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={kirim} className="space-y-4">
      <input type="hidden" name="tahun" value={tahun} />
      <input
        type="hidden"
        name="keputusan"
        value={punyaSisa
          .map((d) => {
            const k = keputusan[d.employeeId];
            return `${d.employeeId}:${k?.pilihan ?? "CARRY_OVER"}:${k?.hari ?? 0}`;
          })
          .join(",")}
      />

      {hasil && (
        <div
          role="status"
          className={cn(
            "rounded-[var(--radius-input)] px-4 py-3 text-sm font-medium",
            hasil.ok
              ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100"
              : "bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-100",
          )}
        >
          {hasil.pesan}
        </div>
      )}

      <div className="border-warn-500/40 bg-warn-50 dark:bg-warn-500/10 flex items-start gap-3 rounded-[var(--radius-card)] border p-4">
        <AlertTriangle className="text-warn-600 dark:text-warn-500 mt-0.5" size={19} />
        <div className="text-[13px] leading-relaxed">
          <p className="text-warn-700 dark:text-warn-100 font-bold">
            Proses ini hanya bisa dijalankan sekali untuk tahun {tahun}
          </p>
          <p className="text-warn-700/85 dark:text-warn-100/80 mt-0.5">
            Sisa cuti akan dikonversi sesuai pilihan di bawah, saldo tahun {tahun + 1}{" "}
            dibuat, dan daftar pencairan dihasilkan. Periksa dulu sebelum menekan tombol.
          </p>
        </div>
      </div>

      {punyaSisa.length === 0 ? (
        <p className="text-muted bg-surface border-app rounded-[var(--radius-card)] border px-5 py-12 text-center text-sm">
          Tidak ada karyawan dengan sisa cuti pada tahun {tahun}.
        </p>
      ) : (
        <div className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm lg:min-w-[760px]">
              <thead>
                <tr className="border-app text-subtle border-b text-left text-[11px] font-bold tracking-wide uppercase">
                  <th className="px-5 py-2.5">Karyawan</th>
                  <th className="px-3 py-2.5 text-center">Sisa</th>
                  <th className="px-3 py-2.5">Perlakuan</th>
                  <th className="px-5 py-2.5 text-right">Estimasi uang</th>
                </tr>
              </thead>
              <tbody>
                {punyaSisa.map((d) => {
                  const k = keputusan[d.employeeId] ?? {
                    pilihan: "CARRY_OVER" as YearEndChoice,
                    hari: 0,
                  };
                  const hariUang =
                    k.pilihan === "ENCASH"
                      ? d.sisa
                      : k.pilihan === "SPLIT"
                        ? Math.min(k.hari, d.sisa)
                        : 0;
                  const dibawa = Math.min(d.sisa - hariUang, maxCarryOver);

                  return (
                    <tr key={d.employeeId} className="border-app border-b last:border-0">
                      <td className="px-5 py-3">
                        <p className="text-body font-semibold">{d.nama}</p>
                        <p className="text-subtle text-xs">
                          kuota {d.kuota} + bawaan {d.carryOverMasuk} − terpakai{" "}
                          {d.terpakai}
                        </p>
                      </td>
                      <td className="text-body tnum px-3 py-3 text-center font-extrabold">
                        {d.sisa}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {PILIHAN.filter(
                            (p) => bolehDiuangkan || p.nilai === "CARRY_OVER",
                          ).map((p) => (
                            <button
                              key={p.nilai}
                              type="button"
                              aria-pressed={k.pilihan === p.nilai}
                              onClick={() =>
                                setKeputusan((s) => ({
                                  ...s,
                                  [d.employeeId]: { ...k, pilihan: p.nilai },
                                }))
                              }
                              className={cn(
                                "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                                k.pilihan === p.nilai
                                  ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/50 dark:text-brand-100"
                                  : "border-app-strong text-muted hover:bg-surface-muted",
                              )}
                            >
                              {p.label}
                            </button>
                          ))}
                          {k.pilihan === "SPLIT" && (
                            <input
                              type="number"
                              min={0}
                              max={d.sisa}
                              value={k.hari}
                              onChange={(e) =>
                                setKeputusan((s) => ({
                                  ...s,
                                  [d.employeeId]: {
                                    ...k,
                                    hari: Math.min(Number(e.target.value), d.sisa),
                                  },
                                }))
                              }
                              className="border-app-strong bg-surface text-body h-8 w-16 rounded-lg border px-2 text-sm"
                              aria-label={`Hari diuangkan untuk ${d.nama}`}
                            />
                          )}
                        </div>
                        {dibawa > 0 && (
                          <Badge tone="netral" className="mt-1.5">
                            {dibawa} hari dibawa
                          </Badge>
                        )}
                      </td>
                      <td className="text-body tnum px-5 py-3 text-right font-semibold">
                        {hariUang > 0 ? formatRupiah(hariUang * tarifPerHari) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-surface-muted text-body border-app border-t-2 font-extrabold">
                  <td className="px-5 py-3" colSpan={3}>
                    Estimasi total pencairan
                  </td>
                  <td className="tnum px-5 py-3 text-right">{formatRupiah(estimasi)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        variant="danger"
        disabled={sedang || punyaSisa.length === 0}
      >
        {sedang && <Loader2 size={17} className="animate-spin" />}
        Jalankan tutup tahun {tahun}
      </Button>
    </form>
  );
}
