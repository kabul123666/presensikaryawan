"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Moon, Pencil, Plus, Power, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Hint, Input, Label } from "@/components/ui/field";
import { Badge } from "@/components/ui/status";
import { cn, formatDurasi } from "@/lib/utils";
import { HARI_PENDEK, jamKeMenit } from "@/lib/waktu";
import { aksiSimpanShift, aksiUbahAktifShift, type HasilMaster } from "./actions";

export type BarisShift = {
  id: string;
  nama: string;
  jamMasuk: string;
  jamPulang: string;
  lintasHari: boolean;
  toleransiMenit: number;
  ambangLemburMenit: number;
  hariKerja: number[];
  batasClockinDiniMenit: number;
  warna: string;
  aktif: boolean;
  jumlahKaryawan: number;
};

/** Durasi kerja sebuah shift, memperhitungkan lintas hari. */
function durasiShift(s: Pick<BarisShift, "jamMasuk" | "jamPulang">) {
  const masuk = jamKeMenit(s.jamMasuk);
  const pulang = jamKeMenit(s.jamPulang);
  const kotor = pulang > masuk ? pulang - masuk : 1440 - masuk + pulang;
  return kotor;
}

function FormShift({
  shift,
  onSelesai,
}: {
  shift: BarisShift | null;
  onSelesai: () => void;
}) {
  const [hasil, kirim, sedang] = useActionState<HasilMaster | null, FormData>(
    aksiSimpanShift,
    null,
  );
  const [hari, setHari] = useState<number[]>(shift?.hariKerja ?? [1, 2, 3, 4, 5]);

  useEffect(() => {
    if (hasil?.ok) onSelesai();
  }, [hasil, onSelesai]);

  return (
    <form action={kirim} className="space-y-4">
      {shift && <input type="hidden" name="id" value={shift.id} />}
      <input type="hidden" name="hariKerja" value={hari.join(",")} />

      {hasil && !hasil.ok && (
        <div className="bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-100 rounded-[var(--radius-input)] px-4 py-3 text-sm font-medium">
          {hasil.pesan}
        </div>
      )}

      <div>
        <Label htmlFor="nama">Nama shift</Label>
        <Input
          id="nama"
          name="nama"
          defaultValue={shift?.nama}
          placeholder="Pagi / Siang / Malam"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="jamMasuk">Jam masuk</Label>
          <Input
            id="jamMasuk"
            name="jamMasuk"
            type="time"
            defaultValue={shift?.jamMasuk.slice(0, 5) ?? "08:00"}
            required
          />
        </div>
        <div>
          <Label htmlFor="jamPulang">Jam pulang</Label>
          <Input
            id="jamPulang"
            name="jamPulang"
            type="time"
            defaultValue={shift?.jamPulang.slice(0, 5) ?? "16:00"}
            required
          />
          <Hint>Jam pulang lebih awal dari jam masuk otomatis dianggap lintas hari.</Hint>
        </div>
      </div>

      <div>
        <Label>Hari kerja</Label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {HARI_PENDEK.map((nama, i) => {
            const aktif = hari.includes(i);
            return (
              <button
                key={nama}
                type="button"
                aria-pressed={aktif}
                onClick={() =>
                  setHari((s) =>
                    s.includes(i) ? s.filter((x) => x !== i) : [...s, i].sort(),
                  )
                }
                className={cn(
                  "h-10 w-14 rounded-[var(--radius-input)] border text-sm font-semibold transition-colors",
                  aktif
                    ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/50 dark:text-brand-100"
                    : "border-app-strong text-muted hover:bg-surface-muted",
                )}
              >
                {nama}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="toleransiMenit">Toleransi terlambat (menit)</Label>
          <Input
            id="toleransiMenit"
            name="toleransiMenit"
            type="number"
            min={0}
            max={240}
            defaultValue={shift?.toleransiMenit ?? 10}
            required
          />
        </div>
        <div>
          <Label htmlFor="ambangLemburMenit">Ambang lembur (menit)</Label>
          <Input
            id="ambangLemburMenit"
            name="ambangLemburMenit"
            type="number"
            min={0}
            max={480}
            defaultValue={shift?.ambangLemburMenit ?? 30}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="batasClockinDiniMenit">
            Boleh absen berapa menit lebih awal
          </Label>
          <Input
            id="batasClockinDiniMenit"
            name="batasClockinDiniMenit"
            type="number"
            min={0}
            max={480}
            defaultValue={shift?.batasClockinDiniMenit ?? 60}
            required
          />
          <Hint>Mencegah karyawan absen dari rumah jauh sebelum jam masuk.</Hint>
        </div>
      </div>

      <div>
        <Label htmlFor="warna">Warna penanda</Label>
        <input
          id="warna"
          name="warna"
          type="color"
          defaultValue={shift?.warna ?? "#14a07c"}
          className="border-app-strong h-11 w-24 cursor-pointer rounded-[var(--radius-input)] border bg-transparent p-1"
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={sedang}>
        {sedang && <Loader2 size={17} className="animate-spin" />}
        Simpan shift
      </Button>
    </form>
  );
}

export function PanelShift({ daftar }: { daftar: BarisShift[] }) {
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const [terpilih, setTerpilih] = useState<BarisShift | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [proses, mulai] = useTransition();

  return (
    <div className="space-y-4">
      {pesan && (
        <div
          role="status"
          className="bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100 rounded-[var(--radius-input)] px-4 py-3 text-sm font-medium"
        >
          {pesan}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => {
            setTerpilih(null);
            setModal(true);
          }}
        >
          <Plus size={16} /> Tambah shift
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {daftar.map((s) => (
          <div
            key={s.id}
            className={cn(
              "bg-surface border-app rounded-[var(--radius-card)] border p-5",
              !s.aktif && "opacity-60",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: s.warna }}
                  aria-hidden
                />
                <div>
                  <h3 className="text-body text-base font-extrabold">{s.nama}</h3>
                  <p className="text-muted tnum text-sm">
                    {s.jamMasuk.slice(0, 5)}–{s.jamPulang.slice(0, 5)}
                    {s.lintasHari && (
                      <span className="text-status-leave ml-1.5 inline-flex items-center gap-0.5 text-xs font-semibold">
                        <Moon size={11} /> lintas hari
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setTerpilih(s);
                    setModal(true);
                  }}
                  className="text-muted hover:bg-surface-muted hover:text-body grid size-8 place-items-center rounded-lg transition-colors"
                  aria-label={`Ubah shift ${s.nama}`}
                >
                  <Pencil size={15} />
                </button>
                <button
                  disabled={proses}
                  onClick={() =>
                    mulai(async () => {
                      const r = await aksiUbahAktifShift(s.id, !s.aktif);
                      setPesan(r.pesan);
                      router.refresh();
                    })
                  }
                  className={cn(
                    "grid size-8 place-items-center rounded-lg transition-colors",
                    s.aktif
                      ? "text-muted hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/15"
                      : "text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/40",
                  )}
                  aria-label={s.aktif ? "Nonaktifkan shift" : "Aktifkan shift"}
                >
                  <Power size={15} />
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {HARI_PENDEK.map((nama, i) => (
                <span
                  key={nama}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10.5px] font-bold",
                    s.hariKerja.includes(i)
                      ? "bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200"
                      : "bg-surface-muted text-subtle",
                  )}
                >
                  {nama}
                </span>
              ))}
            </div>

            <dl className="border-app text-muted mt-4 grid grid-cols-2 gap-y-2 border-t pt-3 text-xs">
              <dt>Durasi kerja</dt>
              <dd className="text-body tnum text-right font-semibold">
                {formatDurasi(durasiShift(s))}
              </dd>
              <dt>Toleransi telat</dt>
              <dd className="text-body tnum text-right font-semibold">
                {s.toleransiMenit} menit
              </dd>
              <dt>Ambang lembur</dt>
              <dd className="text-body tnum text-right font-semibold">
                {s.ambangLemburMenit} menit
              </dd>
              <dt>Karyawan memakai</dt>
              <dd className="text-body tnum text-right font-semibold">
                {s.jumlahKaryawan}
              </dd>
            </dl>

            {!s.aktif && (
              <Badge tone="danger" className="mt-3">
                Nonaktif
              </Badge>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-5 py-10">
          <button
            className="fixed inset-0 bg-[var(--overlay)] backdrop-blur-sm"
            onClick={() => setModal(false)}
            aria-label="Tutup"
          />
          <div className="bg-surface relative w-full max-w-lg rounded-[var(--radius-sheet)] p-6 shadow-[var(--shadow-float)]">
            <div className="mb-5 flex items-start justify-between">
              <h2 className="text-body text-lg font-extrabold tracking-tight">
                {terpilih ? `Ubah shift ${terpilih.nama}` : "Tambah shift"}
              </h2>
              <button
                onClick={() => setModal(false)}
                className="text-subtle hover:text-body grid size-9 place-items-center rounded-lg"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            <FormShift
              shift={terpilih}
              onSelesai={() => {
                setModal(false);
                setPesan("Shift disimpan.");
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
