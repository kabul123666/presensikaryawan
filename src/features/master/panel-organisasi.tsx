"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Pencil, Plus, Stethoscope, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Hint, Input, Label, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/status";
import { cn } from "@/lib/utils";
import {
  aksiAlihkanFormTindakan,
  aksiSimpanDepartemen,
  aksiSimpanJabatan,
  type HasilMaster,
} from "./actions";

export type BarisDepartemen = {
  id: string;
  nama: string;
  keterangan: string | null;
  aktif: boolean;
  jumlahKaryawan: number;
};

export type BarisJabatan = {
  id: string;
  nama: string;
  departmentId: string | null;
  departemen: string | null;
  isiFormTindakan: boolean;
  kuotaCutiOverride: number | null;
  aktif: boolean;
  jumlahKaryawan: number;
};

function FormDepartemen({
  data,
  onSelesai,
}: {
  data: BarisDepartemen | null;
  onSelesai: () => void;
}) {
  const [hasil, kirim, sedang] = useActionState<HasilMaster | null, FormData>(
    aksiSimpanDepartemen,
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
        <Label htmlFor="nama">Nama departemen</Label>
        <Input id="nama" name="nama" defaultValue={data?.nama} required />
      </div>
      <div>
        <Label htmlFor="keterangan">Keterangan</Label>
        <Input id="keterangan" name="keterangan" defaultValue={data?.keterangan ?? ""} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={sedang}>
        {sedang && <Loader2 size={17} className="animate-spin" />}
        Simpan departemen
      </Button>
    </form>
  );
}

function FormJabatan({
  data,
  departemen,
  onSelesai,
}: {
  data: BarisJabatan | null;
  departemen: BarisDepartemen[];
  onSelesai: () => void;
}) {
  const [hasil, kirim, sedang] = useActionState<HasilMaster | null, FormData>(
    aksiSimpanJabatan,
    null,
  );
  const [catatTindakan, setCatatTindakan] = useState(data?.isiFormTindakan ?? false);

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
        <Label htmlFor="nama">Nama jabatan</Label>
        <Input id="nama" name="nama" defaultValue={data?.nama} required />
      </div>

      <div>
        <Label htmlFor="departmentId">Departemen</Label>
        <Select
          id="departmentId"
          name="departmentId"
          defaultValue={data?.departmentId ?? ""}
        >
          <option value="">— Belum diatur —</option>
          {departemen.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nama}
            </option>
          ))}
        </Select>
      </div>

      <label className="border-app bg-surface-muted flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border p-4">
        <input
          type="checkbox"
          name="isiFormTindakan"
          checked={catatTindakan}
          onChange={(e) => setCatatTindakan(e.target.checked)}
          className="accent-brand-600 mt-0.5 size-4"
        />
        <span>
          <span className="text-body block text-sm font-bold">
            Mencatat tindakan saat clock out
          </span>
          <span className="text-muted mt-0.5 block text-[13px] leading-relaxed">
            Karyawan dengan jabatan ini akan melihat form tindakan ber-fee saat absen
            pulang. Matikan untuk jabatan yang cukup mengisi catatan kerja umum.
          </span>
        </span>
      </label>

      <div>
        <Label htmlFor="kuotaCutiOverride">Kuota cuti khusus (opsional)</Label>
        <Input
          id="kuotaCutiOverride"
          name="kuotaCutiOverride"
          type="number"
          min={0}
          max={365}
          defaultValue={data?.kuotaCutiOverride ?? ""}
          placeholder="Kosongkan untuk memakai kuota jenis cuti"
        />
        <Hint>Isi hanya bila jabatan ini punya kuota berbeda dari umum.</Hint>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={sedang}>
        {sedang && <Loader2 size={17} className="animate-spin" />}
        Simpan jabatan
      </Button>
    </form>
  );
}

export function PanelOrganisasi({
  departemen,
  jabatan,
}: {
  departemen: BarisDepartemen[];
  jabatan: BarisJabatan[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"departemen" | "jabatan" | null>(null);
  const [dept, setDept] = useState<BarisDepartemen | null>(null);
  const [jab, setJab] = useState<BarisJabatan | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [proses, mulai] = useTransition();

  return (
    <div className="space-y-6">
      {pesan && (
        <div
          role="status"
          className="bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100 rounded-[var(--radius-input)] px-4 py-3 text-sm font-medium"
        >
          {pesan}
        </div>
      )}

      {/* Departemen */}
      <section className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border">
        <div className="border-app flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-body flex items-center gap-2 text-base font-extrabold">
            <Building2 size={17} className="text-brand-600" /> Departemen
          </h2>
          <Button
            size="sm"
            onClick={() => {
              setDept(null);
              setModal("departemen");
            }}
          >
            <Plus size={15} /> Tambah
          </Button>
        </div>
        <ul className="divide-app divide-y">
          {departemen.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-body text-sm font-bold">{d.nama}</p>
                <p className="text-subtle text-xs">
                  {d.keterangan ?? "—"} · {d.jumlahKaryawan} karyawan
                </p>
              </div>
              <button
                onClick={() => {
                  setDept(d);
                  setModal("departemen");
                }}
                className="text-muted hover:bg-surface-muted hover:text-body grid size-9 place-items-center rounded-lg transition-colors"
                aria-label={`Ubah ${d.nama}`}
              >
                <Pencil size={15} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Jabatan */}
      <section className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border">
        <div className="border-app flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-body flex items-center gap-2 text-base font-extrabold">
              <Stethoscope size={17} className="text-brand-600" /> Jabatan
            </h2>
            <p className="text-muted mt-0.5 text-xs">
              Sakelar hijau menentukan siapa yang mencatat tindakan ber-fee.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setJab(null);
              setModal("jabatan");
            }}
          >
            <Plus size={15} /> Tambah
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm lg:min-w-[680px]">
            <thead>
              <tr className="border-app text-subtle border-b text-left text-[11px] font-bold tracking-wide uppercase">
                <th className="px-5 py-2.5">Jabatan</th>
                <th className="px-3 py-2.5">Departemen</th>
                <th className="px-3 py-2.5">Karyawan</th>
                <th className="px-3 py-2.5">Catat tindakan</th>
                <th className="px-5 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {jabatan.map((j) => (
                <tr
                  key={j.id}
                  className="border-app hover:bg-surface-muted border-b transition-colors last:border-0"
                >
                  <td className="text-body px-5 py-3 font-semibold">
                    {j.nama}
                    {j.kuotaCutiOverride !== null && (
                      <span className="text-subtle ml-2 text-xs font-normal">
                        kuota cuti {j.kuotaCutiOverride} hari
                      </span>
                    )}
                  </td>
                  <td className="text-muted px-3 py-3">{j.departemen ?? "—"}</td>
                  <td className="text-muted tnum px-3 py-3">{j.jumlahKaryawan}</td>
                  <td className="px-3 py-3">
                    <button
                      role="switch"
                      aria-checked={j.isiFormTindakan}
                      aria-label={`Catat tindakan untuk ${j.nama}`}
                      disabled={proses}
                      onClick={() =>
                        mulai(async () => {
                          const r = await aksiAlihkanFormTindakan(
                            j.id,
                            !j.isiFormTindakan,
                          );
                          setPesan(r.pesan);
                          router.refresh();
                        })
                      }
                      className={cn(
                        "relative h-6 w-11 rounded-full transition-colors",
                        j.isiFormTindakan ? "bg-brand-600" : "bg-ink-300 dark:bg-ink-700",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
                          j.isiFormTindakan ? "left-[22px]" : "left-0.5",
                        )}
                      />
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => {
                        setJab(j);
                        setModal("jabatan");
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

        <div className="border-app bg-surface-muted border-t px-5 py-3">
          <Badge tone="brand">
            {jabatan.filter((j) => j.isiFormTindakan).length} jabatan mencatat tindakan
          </Badge>
        </div>
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-5 py-10">
          <button
            className="fixed inset-0 bg-[var(--overlay)] backdrop-blur-sm"
            onClick={() => setModal(null)}
            aria-label="Tutup"
          />
          <div className="bg-surface relative w-full max-w-lg rounded-[var(--radius-sheet)] p-6 shadow-[var(--shadow-float)]">
            <div className="mb-5 flex items-start justify-between">
              <h2 className="text-body text-lg font-extrabold tracking-tight">
                {modal === "departemen"
                  ? dept
                    ? `Ubah ${dept.nama}`
                    : "Tambah departemen"
                  : jab
                    ? `Ubah ${jab.nama}`
                    : "Tambah jabatan"}
              </h2>
              <button
                onClick={() => setModal(null)}
                className="text-subtle hover:text-body grid size-9 place-items-center rounded-lg"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            {modal === "departemen" ? (
              <FormDepartemen
                data={dept}
                onSelesai={() => {
                  setModal(null);
                  setPesan("Departemen disimpan.");
                  router.refresh();
                }}
              />
            ) : (
              <FormJabatan
                data={jab}
                departemen={departemen}
                onSelesai={() => {
                  setModal(null);
                  setPesan("Jabatan disimpan.");
                  router.refresh();
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
