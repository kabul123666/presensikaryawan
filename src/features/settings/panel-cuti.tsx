"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Hint, Input, Label, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/status";
import { cn, formatRupiah } from "@/lib/utils";
import {
  aksiSimpanJenisCuti,
  aksiSimpanKebijakanCuti,
  type HasilPengaturan,
} from "./actions";
import type { KebijakanCuti } from "./service";

export type BarisJenisCuti = {
  id: string;
  nama: string;
  kuotaDefault: number;
  berbayar: boolean;
  butuhLampiran: boolean;
  bolehCarryOver: boolean;
  bolehDiuangkan: boolean;
  maxCarryOverHari: number;
  tglKedaluwarsaCarry: string | null;
};

function FormJenisCuti({
  data,
  onSelesai,
}: {
  data: BarisJenisCuti | null;
  onSelesai: () => void;
}) {
  const [hasil, kirim, sedang] = useActionState<HasilPengaturan | null, FormData>(
    aksiSimpanJenisCuti,
    null,
  );
  useEffect(() => {
    if (hasil?.ok) onSelesai();
  }, [hasil, onSelesai]);

  return (
    <form action={kirim} className="space-y-4">
      {data && <input type="hidden" name="id" value={data.id} />}
      {hasil && !hasil.ok && (
        <div className="bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-100 rounded-[var(--radius-input)] px-4 py-3 text-sm font-medium">
          {hasil.pesan}
        </div>
      )}

      <div>
        <Label htmlFor="nama">Nama jenis cuti</Label>
        <Input id="nama" name="nama" defaultValue={data?.nama} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="kuotaDefault">Kuota per tahun (hari)</Label>
          <Input
            id="kuotaDefault"
            name="kuotaDefault"
            type="number"
            min={0}
            max={365}
            defaultValue={data?.kuotaDefault ?? 12}
            required
          />
        </div>
        <div>
          <Label htmlFor="maxCarryOverHari">Maksimal dibawa ke tahun depan</Label>
          <Input
            id="maxCarryOverHari"
            name="maxCarryOverHari"
            type="number"
            min={0}
            max={365}
            defaultValue={data?.maxCarryOverHari ?? 0}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="tglKedaluwarsaCarry">Sisa bawaan hangus tanggal (MM-DD)</Label>
        <Input
          id="tglKedaluwarsaCarry"
          name="tglKedaluwarsaCarry"
          placeholder="03-31"
          defaultValue={data?.tglKedaluwarsaCarry ?? ""}
        />
        <Hint>Kosongkan bila sisa bawaan tidak pernah hangus.</Hint>
      </div>

      <div className="space-y-2">
        {[
          { name: "berbayar", label: "Cuti berbayar", cek: data?.berbayar ?? true },
          {
            name: "butuhLampiran",
            label: "Wajib melampirkan bukti (mis. surat dokter)",
            cek: data?.butuhLampiran ?? false,
          },
          {
            name: "bolehCarryOver",
            label: "Sisa boleh dibawa ke tahun berikutnya",
            cek: data?.bolehCarryOver ?? false,
          },
          {
            name: "bolehDiuangkan",
            label: "Sisa boleh diuangkan saat tutup tahun",
            cek: data?.bolehDiuangkan ?? false,
          },
        ].map((c) => (
          <label
            key={c.name}
            className="border-app flex cursor-pointer items-center gap-3 rounded-[var(--radius-input)] border px-3.5 py-2.5"
          >
            <input
              type="checkbox"
              name={c.name}
              defaultChecked={c.cek}
              className="accent-brand-600 size-4"
            />
            <span className="text-body text-sm font-medium">{c.label}</span>
          </label>
        ))}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={sedang}>
        {sedang && <Loader2 size={17} className="animate-spin" />}
        Simpan jenis cuti
      </Button>
    </form>
  );
}

export function PanelCuti({
  kebijakan,
  jenisCuti,
}: {
  kebijakan: KebijakanCuti;
  jenisCuti: BarisJenisCuti[];
}) {
  const router = useRouter();
  const [hasil, kirim, sedang] = useActionState<HasilPengaturan | null, FormData>(
    aksiSimpanKebijakanCuti,
    null,
  );
  const [sumber, setSumber] = useState(kebijakan.sumberTarif);
  const [modal, setModal] = useState(false);
  const [terpilih, setTerpilih] = useState<BarisJenisCuti | null>(null);

  return (
    <div className="space-y-5">
      <form
        action={kirim}
        className="bg-surface border-app space-y-4 rounded-[var(--radius-card)] border p-5"
      >
        <div>
          <h2 className="text-body text-base font-extrabold">Pencairan sisa cuti</h2>
          <p className="text-muted mt-1 text-sm">
            Dasar perhitungan saat sisa cuti diuangkan pada tutup tahun.
          </p>
        </div>

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

        <div>
          <Label htmlFor="sumberTarif">Sumber tarif</Label>
          <Select
            id="sumberTarif"
            name="sumberTarif"
            value={sumber}
            onChange={(e) => setSumber(e.target.value as KebijakanCuti["sumberTarif"])}
          >
            <option value="TETAP">Nominal tetap per hari</option>
            <option value="GAJI_POKOK">Dihitung dari gaji pokok karyawan</option>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tarifPencairanPerHari">Nominal tetap per hari (Rp)</Label>
            <Input
              id="tarifPencairanPerHari"
              name="tarifPencairanPerHari"
              type="number"
              min={0}
              step={10000}
              defaultValue={kebijakan.tarifPencairanPerHari}
              disabled={sumber === "GAJI_POKOK"}
              required
            />
          </div>
          <div>
            <Label htmlFor="pembagiGajiPokok">Pembagi gaji pokok</Label>
            <Input
              id="pembagiGajiPokok"
              name="pembagiGajiPokok"
              type="number"
              min={1}
              max={31}
              defaultValue={kebijakan.pembagiGajiPokok}
              disabled={sumber === "TETAP"}
              required
            />
            <Hint>
              Umumnya 21 — jumlah hari kerja sebulan. Tarif = gaji pokok ÷ pembagi.
            </Hint>
          </div>
        </div>

        <p className="text-muted bg-surface-muted rounded-lg px-3 py-2 text-[13px]">
          Contoh: sisa 4 hari{" "}
          {sumber === "TETAP"
            ? `× ${formatRupiah(kebijakan.tarifPencairanPerHari)} = ${formatRupiah(kebijakan.tarifPencairanPerHari * 4)}`
            : `× (gaji pokok ÷ ${kebijakan.pembagiGajiPokok})`}
        </p>

        <Button type="submit" disabled={sedang}>
          {sedang && <Loader2 size={16} className="animate-spin" />}
          Simpan kebijakan cuti
        </Button>
      </form>

      <div className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border">
        <div className="border-app flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-body text-base font-extrabold">Jenis cuti</h2>
          <Button
            size="sm"
            onClick={() => {
              setTerpilih(null);
              setModal(true);
            }}
          >
            <Plus size={15} /> Tambah
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm lg:min-w-[720px]">
            <thead>
              <tr className="border-app text-subtle border-b text-left text-[11px] font-bold tracking-wide uppercase">
                <th className="px-5 py-2.5">Jenis</th>
                <th className="px-3 py-2.5 text-center">Kuota</th>
                <th className="px-3 py-2.5">Sifat</th>
                <th className="px-5 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {jenisCuti.map((j) => (
                <tr key={j.id} className="border-app border-b last:border-0">
                  <td className="text-body px-5 py-3 font-semibold">{j.nama}</td>
                  <td className="text-body tnum px-3 py-3 text-center">
                    {j.kuotaDefault} hari
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={j.berbayar ? "brand" : "netral"}>
                        {j.berbayar ? "Berbayar" : "Tidak dibayar"}
                      </Badge>
                      {j.bolehCarryOver && (
                        <Badge tone="netral">Bawa maks {j.maxCarryOverHari} hari</Badge>
                      )}
                      {j.bolehDiuangkan && <Badge tone="warn">Bisa diuangkan</Badge>}
                      {j.butuhLampiran && <Badge tone="netral">Wajib lampiran</Badge>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => {
                        setTerpilih(j);
                        setModal(true);
                      }}
                      className="text-muted hover:bg-surface-muted hover:text-body grid size-9 place-items-center rounded-lg transition-colors"
                      aria-label={`Ubah ${j.nama}`}
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                {terpilih ? `Ubah ${terpilih.nama}` : "Tambah jenis cuti"}
              </h2>
              <button
                onClick={() => setModal(false)}
                className="text-subtle hover:text-body grid size-9 place-items-center rounded-lg"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            <FormJenisCuti
              data={terpilih}
              onSelesai={() => {
                setModal(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
