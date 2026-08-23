"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/status";
import type { WorklogStatus } from "@/db/schema";
import { cn, formatRupiah } from "@/lib/utils";
import { tanggalPendek } from "@/lib/waktu";
import {
  aksiTolakTindakan,
  aksiVerifikasiTindakan,
  type HasilVerifikasi,
} from "./actions";

export type BarisTindakan = {
  id: string;
  namaTindakan: string;
  jumlah: number;
  feeSnapshot: number;
  kodePasien: string | null;
  status: WorklogStatus;
  tanggal: string;
  nama: string;
  jabatan: string | null;
  kategori: string;
};

const NADA_STATUS: Record<
  WorklogStatus,
  { teks: string; nada: "brand" | "warn" | "danger" }
> = {
  VERIFIED: { teks: "Terverifikasi", nada: "brand" },
  SUBMITTED: { teks: "Menunggu", nada: "warn" },
  REJECTED: { teks: "Ditolak", nada: "danger" },
};

const NADA_KATEGORI: Record<string, "danger" | "warn" | "netral"> = {
  BESAR: "danger",
  SEDANG: "warn",
  RINGAN: "netral",
};

export function PanelVerifikasi({ daftar }: { daftar: BarisTindakan[] }) {
  const router = useRouter();
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const [modalTolak, setModalTolak] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [hasil, setHasil] = useState<HasilVerifikasi | null>(null);
  const [proses, mulai] = useTransition();

  const menunggu = daftar.filter((d) => d.status === "SUBMITTED");
  const semua = menunggu.length > 0 && menunggu.every((d) => terpilih.has(d.id));
  const ids = [...terpilih];

  const nilaiTerpilih = daftar
    .filter((d) => terpilih.has(d.id))
    .reduce((t, d) => t + d.feeSnapshot * d.jumlah, 0);

  function jalankan(fn: () => Promise<HasilVerifikasi>) {
    mulai(async () => {
      const res = await fn();
      setHasil(res);
      if (res.ok) {
        setTerpilih(new Set());
        setModalTolak(false);
        setAlasan("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
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

      {ids.length > 0 && (
        <div className="bg-surface border-app sticky top-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border px-4 py-3 shadow-[var(--shadow-raised)]">
          <p className="text-body text-sm font-semibold">
            {ids.length} tindakan dipilih
            <span className="text-muted ml-2 font-normal">
              senilai {formatRupiah(nilaiTerpilih)}
            </span>
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTerpilih(new Set())}
              disabled={proses}
            >
              Batal
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setModalTolak(true)}
              disabled={proses}
            >
              <X size={15} /> Tolak
            </Button>
            <Button
              size="sm"
              onClick={() => jalankan(() => aksiVerifikasiTindakan(ids))}
              disabled={proses}
            >
              {proses ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              Verifikasi
            </Button>
          </div>
        </div>
      )}

      <div className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border">
        {daftar.length === 0 ? (
          <p className="text-muted px-5 py-16 text-center text-sm">
            Belum ada tindakan yang dicatat pada periode ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm lg:min-w-[900px]">
              <thead>
                <tr className="border-app text-subtle border-b text-left text-[11px] font-bold tracking-wide uppercase">
                  <th className="w-10 px-5 py-2.5">
                    {menunggu.length > 0 && (
                      <input
                        type="checkbox"
                        className="accent-brand-600 size-4"
                        checked={semua}
                        onChange={() =>
                          setTerpilih(
                            semua ? new Set() : new Set(menunggu.map((d) => d.id)),
                          )
                        }
                        aria-label="Pilih semua tindakan menunggu"
                      />
                    )}
                  </th>
                  <th className="px-3 py-2.5">Tindakan</th>
                  <th className="px-3 py-2.5">Karyawan</th>
                  <th className="px-3 py-2.5">Tanggal</th>
                  <th className="px-3 py-2.5 text-center">Jumlah</th>
                  <th className="px-3 py-2.5 text-right">Fee</th>
                  <th className="px-5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((d) => {
                  const bisa = d.status === "SUBMITTED";
                  return (
                    <tr
                      key={d.id}
                      className={cn(
                        "border-app hover:bg-surface-muted border-b transition-colors last:border-0",
                        terpilih.has(d.id) && "bg-brand-50/60 dark:bg-brand-900/20",
                      )}
                    >
                      <td className="px-5 py-3">
                        {bisa && (
                          <input
                            type="checkbox"
                            className="accent-brand-600 size-4"
                            checked={terpilih.has(d.id)}
                            onChange={() =>
                              setTerpilih((s) => {
                                const baru = new Set(s);
                                if (baru.has(d.id)) baru.delete(d.id);
                                else baru.add(d.id);
                                return baru;
                              })
                            }
                            aria-label={`Pilih ${d.namaTindakan}`}
                          />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-body font-semibold">{d.namaTindakan}</p>
                        <div className="mt-1 flex gap-1.5">
                          <Badge tone={NADA_KATEGORI[d.kategori] ?? "netral"}>
                            {d.kategori}
                          </Badge>
                          {d.kodePasien && (
                            <span className="text-subtle text-xs">{d.kodePasien}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-body font-medium">{d.nama}</p>
                        <p className="text-subtle text-xs">{d.jabatan ?? "—"}</p>
                      </td>
                      <td className="text-muted px-3 py-3">{tanggalPendek(d.tanggal)}</td>
                      <td className="text-body tnum px-3 py-3 text-center">{d.jumlah}</td>
                      <td className="text-body tnum px-3 py-3 text-right font-semibold">
                        {formatRupiah(d.feeSnapshot * d.jumlah)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={NADA_STATUS[d.status].nada}>
                          {NADA_STATUS[d.status].teks}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalTolak && (
        <div className="fixed inset-0 z-50 grid place-items-center p-5">
          <button
            className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm"
            onClick={() => setModalTolak(false)}
            aria-label="Tutup"
          />
          <div className="bg-surface relative w-full max-w-md rounded-[var(--radius-sheet)] p-6 shadow-[var(--shadow-float)]">
            <h2 className="text-body text-lg font-extrabold tracking-tight">
              Tolak {ids.length} tindakan
            </h2>
            <p className="text-muted mt-1.5 text-sm">
              Alasan dikirim ke karyawan dan tindakan tidak ikut terhitung di rekap fee.
            </p>
            <Textarea
              autoFocus
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Contoh: tindakan tercatat dobel dengan tanggal sebelumnya."
              className="mt-4"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalTolak(false)}>
                Batal
              </Button>
              <Button
                variant="danger"
                disabled={proses || alasan.trim().length < 5}
                onClick={() => jalankan(() => aksiTolakTindakan(ids, alasan))}
              >
                {proses && <Loader2 size={15} className="animate-spin" />}
                Tolak tindakan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
