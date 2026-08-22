"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Hint, Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  aksiSimpanKebijakanAbsensi,
  aksiSimpanProfil,
  type HasilPengaturan,
} from "./actions";
import type { KebijakanAbsensi, ProfilPerusahaan } from "./service";

function Notifikasi({ hasil }: { hasil: HasilPengaturan | null }) {
  if (!hasil) return null;
  return (
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
  );
}

export function PanelUmum({
  profil,
  absensi,
}: {
  profil: ProfilPerusahaan;
  absensi: KebijakanAbsensi;
}) {
  const [hasilProfil, kirimProfil, sedangProfil] = useActionState<
    HasilPengaturan | null,
    FormData
  >(aksiSimpanProfil, null);
  const [hasilAbsensi, kirimAbsensi, sedangAbsensi] = useActionState<
    HasilPengaturan | null,
    FormData
  >(aksiSimpanKebijakanAbsensi, null);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <form
        action={kirimProfil}
        className="bg-surface border-app space-y-4 rounded-[var(--radius-card)] border p-5"
      >
        <div>
          <h2 className="text-body text-base font-extrabold">Profil rumah sakit</h2>
          <p className="text-muted mt-1 text-sm">
            Dipakai sebagai kop pada laporan dan berkas ekspor.
          </p>
        </div>

        <Notifikasi hasil={hasilProfil} />

        <div>
          <Label htmlFor="nama">Nama rumah sakit</Label>
          <Input id="nama" name="nama" defaultValue={profil.nama} required />
        </div>
        <div>
          <Label htmlFor="alamat">Alamat</Label>
          <Input id="alamat" name="alamat" defaultValue={profil.alamat} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="telepon">Telepon</Label>
            <Input id="telepon" name="telepon" defaultValue={profil.telepon} />
          </div>
          <div>
            <Label htmlFor="email">Email HRD</Label>
            <Input id="email" name="email" type="email" defaultValue={profil.email} />
          </div>
        </div>

        <Button type="submit" disabled={sedangProfil}>
          {sedangProfil && <Loader2 size={16} className="animate-spin" />}
          Simpan profil
        </Button>
      </form>

      <form
        action={kirimAbsensi}
        className="bg-surface border-app space-y-4 rounded-[var(--radius-card)] border p-5"
      >
        <div>
          <h2 className="text-body text-base font-extrabold">Kebijakan absensi</h2>
          <p className="text-muted mt-1 text-sm">
            Aturan umum yang berlaku untuk seluruh karyawan.
          </p>
        </div>

        <Notifikasi hasil={hasilAbsensi} />

        <div>
          <Label htmlFor="batasBackdateHari">Batas mundur koreksi absen (hari)</Label>
          <Input
            id="batasBackdateHari"
            name="batasBackdateHari"
            type="number"
            min={0}
            max={90}
            defaultValue={absensi.batasBackdateHari}
            required
          />
          <Hint>Karyawan tidak bisa mengajukan koreksi lebih lama dari ini.</Hint>
        </div>

        <div>
          <Label htmlFor="hariMulaiPeriode">Tanggal mulai periode rekap</Label>
          <Input
            id="hariMulaiPeriode"
            name="hariMulaiPeriode"
            type="number"
            min={1}
            max={28}
            defaultValue={absensi.hariMulaiPeriode}
            required
          />
          <Hint>
            Isi 1 bila rekap mengikuti bulan kalender. Isi 26 bila siklus potong gaji
            berjalan tanggal 26 sampai 25 — rekap Agustus lalu berisi 26 Juli sampai 25
            Agustus. Dibatasi 28 supaya tidak ada periode yang hilang di Februari.
          </Hint>
        </div>

        <label className="border-app bg-surface-muted flex cursor-pointer items-start gap-3 rounded-[var(--radius-input)] border p-3.5">
          <input
            type="checkbox"
            name="wajibCatatanKerja"
            defaultChecked={absensi.wajibCatatanKerja}
            className="accent-brand-600 mt-0.5 size-4"
          />
          <span>
            <span className="text-body block text-sm font-bold">
              Wajib isi catatan kerja saat clock out
            </span>
            <span className="text-muted mt-0.5 block text-[13px]">
              Mematikan ini membuat absen pulang bisa dilakukan tanpa keterangan apa pun.
            </span>
          </span>
        </label>

        <label className="border-app bg-surface-muted flex cursor-pointer items-start gap-3 rounded-[var(--radius-input)] border p-3.5">
          <input
            type="checkbox"
            name="izinkanAbsenTanpaShift"
            defaultChecked={absensi.izinkanAbsenTanpaShift}
            className="accent-brand-600 mt-0.5 size-4"
          />
          <span>
            <span className="text-body block text-sm font-bold">
              Izinkan absen tanpa shift
            </span>
            <span className="text-muted mt-0.5 block text-[13px]">
              Untuk staf yang hanya datang bila ada pasien. Kehadirannya tercatat penuh,
              hanya saja tidak dinilai terlambat atau lembur karena tidak ada jam acuan.
              Bila dimatikan, karyawan tanpa shift harus menunggu HRD menetapkan jadwal.
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="minKarakterCatatan">Minimal karakter catatan</Label>
            <Input
              id="minKarakterCatatan"
              name="minKarakterCatatan"
              type="number"
              min={0}
              max={500}
              defaultValue={absensi.minKarakterCatatan}
              required
            />
          </div>
          <div>
            <Label htmlFor="retensiFotoBulan">Retensi foto absensi (bulan)</Label>
            <Input
              id="retensiFotoBulan"
              name="retensiFotoBulan"
              type="number"
              min={1}
              max={120}
              defaultValue={absensi.retensiFotoBulan}
              required
            />
            <Hint>Foto lebih tua dari ini dihapus; datanya tetap tersimpan.</Hint>
          </div>
        </div>

        <Button type="submit" disabled={sedangAbsensi}>
          {sedangAbsensi && <Loader2 size={16} className="animate-spin" />}
          Simpan kebijakan
        </Button>
      </form>
    </div>
  );
}
