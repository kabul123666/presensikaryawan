"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ShieldAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Badge, BadgePengajuan } from "@/components/ui/status";
import type { RequestStatus, RequestType } from "@/db/schema";
import { cn } from "@/lib/utils";
import { tanggalPendek } from "@/lib/waktu";
import { LABEL_TIPE, ringkasPengajuan } from "@/features/requests/ringkasan";
import { aksiSetujui, aksiTolak, type HasilKeputusan } from "./actions";

export type BarisTampil = {
  id: string;
  tipe: RequestType;
  status: RequestStatus;
  alasan: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  currentStep: number;
  totalStep: number;
  nama: string;
  jabatan: string | null;
  departemen: string | null;
};

const NADA_TIPE: Record<RequestType, "brand" | "warn" | "danger" | "netral"> = {
  LEAVE: "brand",
  OVERTIME: "warn",
  BACKDATE: "netral",
  PERMIT: "brand",
  OUTSIDE_AREA: "danger",
  DEVICE_CHANGE: "danger",
};

export function TabelPersetujuan({
  daftar,
  wewenang,
  namaJenisCuti,
}: {
  daftar: BarisTampil[];
  wewenang: Record<string, boolean>;
  namaJenisCuti: Record<string, string>;
}) {
  const router = useRouter();
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const [modalTolak, setModalTolak] = useState(false);
  const [alasanTolak, setAlasanTolak] = useState("");
  const [hasil, setHasil] = useState<HasilKeputusan | null>(null);
  const [proses, mulaiProses] = useTransition();

  const bisaDipilih = daftar.filter((d) => wewenang[d.id]);
  const semuaTerpilih =
    bisaDipilih.length > 0 && bisaDipilih.every((d) => terpilih.has(d.id));

  function alihkan(id: string) {
    setTerpilih((s) => {
      const baru = new Set(s);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });
  }

  function jalankan(fn: () => Promise<HasilKeputusan>) {
    mulaiProses(async () => {
      const res = await fn();
      setHasil(res);
      if (res.ok) {
        setTerpilih(new Set());
        setModalTolak(false);
        setAlasanTolak("");
        router.refresh();
      }
    });
  }

  const ids = [...terpilih];

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

      {/* Bilah aksi massal */}
      {ids.length > 0 && (
        <div className="bg-surface border-app sticky top-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border px-4 py-3 shadow-[var(--shadow-raised)]">
          <p className="text-body text-sm font-semibold">
            {ids.length} pengajuan dipilih
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
              onClick={() => jalankan(() => aksiSetujui(ids))}
              disabled={proses}
            >
              {proses ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              Setujui
            </Button>
          </div>
        </div>
      )}

      {daftar.length === 0 ? (
        <div className="border-app bg-surface rounded-[var(--radius-card)] border border-dashed px-6 py-16 text-center">
          <p className="text-body text-sm font-bold">Tidak ada pengajuan</p>
          <p className="text-muted mt-1.5 text-sm">
            Semua pengajuan pada penyaring ini sudah diproses.
          </p>
        </div>
      ) : (
        <>
          {bisaDipilih.length > 0 && (
            <label className="text-muted flex cursor-pointer items-center gap-2.5 px-1 text-sm select-none">
              <input
                type="checkbox"
                className="accent-brand-600 size-4"
                checked={semuaTerpilih}
                onChange={() =>
                  setTerpilih(
                    semuaTerpilih ? new Set() : new Set(bisaDipilih.map((d) => d.id)),
                  )
                }
              />
              Pilih semua yang bisa Anda putuskan ({bisaDipilih.length})
            </label>
          )}

          <ul className="space-y-2.5">
            {daftar.map((d) => {
              const boleh = wewenang[d.id];
              const dipilih = terpilih.has(d.id);

              return (
                <li
                  key={d.id}
                  className={cn(
                    "bg-surface rounded-[var(--radius-card)] border transition-colors",
                    dipilih ? "border-brand-400 ring-brand-500/15 ring-2" : "border-app",
                  )}
                >
                  <div className="flex items-start gap-3 p-4">
                    {boleh ? (
                      <input
                        type="checkbox"
                        className="accent-brand-600 mt-1 size-4 shrink-0"
                        checked={dipilih}
                        onChange={() => alihkan(d.id)}
                        aria-label={`Pilih pengajuan ${LABEL_TIPE[d.tipe]} dari ${d.nama}`}
                      />
                    ) : (
                      <span className="mt-0.5 w-4 shrink-0" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-body text-sm font-bold">{d.nama}</span>
                        <Badge tone={NADA_TIPE[d.tipe]}>{LABEL_TIPE[d.tipe]}</Badge>
                        <BadgePengajuan status={d.status} />
                        {d.totalStep > 1 && (
                          <span className="text-subtle text-[11px] font-semibold">
                            Langkah {d.currentStep}/{d.totalStep}
                          </span>
                        )}
                      </div>

                      <p className="text-subtle mt-0.5 text-xs">
                        {d.jabatan ?? "—"}
                        {d.departemen ? ` · ${d.departemen}` : ""} · diajukan{" "}
                        {tanggalPendek(d.createdAt)}
                      </p>

                      <p className="text-body mt-2 text-sm font-semibold">
                        {ringkasPengajuan(d.tipe, d.payload, namaJenisCuti)}
                      </p>

                      {d.alasan && (
                        <p className="text-muted bg-surface-muted mt-2 rounded-lg px-3 py-2 text-[13px] leading-relaxed">
                          {d.alasan}
                        </p>
                      )}

                      {!boleh && d.status === "PENDING" && (
                        <p className="text-subtle mt-2 flex items-center gap-1.5 text-xs">
                          <ShieldAlert size={13} />
                          Di luar wewenang Anda — menunggu penyetuju yang ditunjuk
                        </p>
                      )}
                    </div>

                    {boleh && (
                      <div className="hidden shrink-0 gap-2 sm:flex">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTerpilih(new Set([d.id]));
                            setModalTolak(true);
                          }}
                          disabled={proses}
                        >
                          Tolak
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => jalankan(() => aksiSetujui([d.id]))}
                          disabled={proses}
                        >
                          Setujui
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Dialog penolakan — alasan wajib supaya karyawan tahu penyebabnya */}
      {modalTolak && (
        <div className="fixed inset-0 z-50 grid place-items-center p-5">
          <button
            className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm"
            onClick={() => setModalTolak(false)}
            aria-label="Tutup"
          />
          <div className="bg-surface relative w-full max-w-md rounded-[var(--radius-sheet)] p-6 shadow-[var(--shadow-float)]">
            <h2 className="text-body text-lg font-extrabold tracking-tight">
              Tolak {ids.length} pengajuan
            </h2>
            <p className="text-muted mt-1.5 text-sm">
              Alasan ini dikirim ke karyawan sebagai pemberitahuan.
            </p>
            <Textarea
              autoFocus
              value={alasanTolak}
              onChange={(e) => setAlasanTolak(e.target.value)}
              placeholder="Contoh: tanggal bentrok dengan jadwal poli, ajukan ulang di minggu berikutnya."
              className="mt-4"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalTolak(false)}>
                Batal
              </Button>
              <Button
                variant="danger"
                onClick={() => jalankan(() => aksiTolak(ids, alasanTolak))}
                disabled={proses || alasanTolak.trim().length < 5}
              >
                {proses && <Loader2 size={15} className="animate-spin" />}
                Tolak pengajuan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
