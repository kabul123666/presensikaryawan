"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/status";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { jamWIB, tanggalPendek, tanggalWIB } from "@/lib/waktu";
import { aksiBatalTinjau, aksiTandaiDitinjau } from "./aksi-anomali";

/** Nama manusia untuk penanda anomali; dipakai juga oleh dashboard. */
export const LABEL_FLAG: Record<string, string> = {
  MOCK_GPS: "Indikasi GPS palsu",
  DILUAR_AREA: "Absen di luar area",
  DILUAR_AREA_PULANG: "Pulang di luar area",
  DEVICE_BARU: "Perangkat baru",
  HARI_LIBUR: "Absen di hari libur",
  TANPA_SHIFT: "Tanpa shift terjadwal",
  LOKASI_MELOMPAT: "Lokasi melompat",
  WFH: "Bekerja dari rumah",
  FOTO_GAGAL: "Foto gagal tersimpan",
};

/** Penanda yang menuntut perhatian lebih, diwarnai berbeda. */
const BERAT = new Set(["MOCK_GPS", "LOKASI_MELOMPAT", "DILUAR_AREA", "FOTO_GAGAL"]);

export type BarisAnomali = {
  id: string;
  tanggal: string;
  nama: string;
  employeeId: string;
  departemen: string | null;
  flags: string[];
  clockInAt: Date | null;
  clockOutAt: Date | null;
  jarakM: number | null;
  alamat: string | null;
  alasan: string | null;
  ditinjauAt: Date | null;
  ditinjauOleh: string | null;
  catatanTinjau: string | null;
};

export function TabelAnomali({ baris }: { baris: BarisAnomali[] }) {
  const router = useRouter();
  const [proses, mulai] = useTransition();
  const [dipilih, setDipilih] = useState<string[]>([]);
  const [catatan, setCatatan] = useState("");
  const [pesan, setPesan] = useState<string | null>(null);

  const belumDitinjau = baris.filter((b) => !b.ditinjauAt);
  const semuaTerpilih =
    belumDitinjau.length > 0 && dipilih.length === belumDitinjau.length;

  const alih = (id: string) =>
    setDipilih((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  const tandai = () =>
    mulai(async () => {
      const hasil = await aksiTandaiDitinjau(dipilih, catatan.trim() || undefined);
      setPesan(hasil.pesan);
      if (hasil.ok) {
        setDipilih([]);
        setCatatan("");
        router.refresh();
      }
    });

  const batalkan = (id: string) =>
    mulai(async () => {
      const hasil = await aksiBatalTinjau(id);
      setPesan(hasil.pesan);
      if (hasil.ok) router.refresh();
    });

  if (baris.length === 0) {
    return (
      <div className="border-app bg-surface rounded-[var(--radius-card)] border px-5 py-12 text-center">
        <p className="text-body text-sm font-semibold">Tidak ada yang perlu ditinjau</p>
        <p className="text-muted mt-1 text-[13px]">
          Absensi bertanda anomali dan yang belum ditutup akan muncul di sini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Aksi massal hanya muncul saat ada yang dipilih — bilah kosong yang
          selalu nongkrong di atas tabel hanya memakan tempat. */}
      {dipilih.length > 0 && (
        <div className="border-app bg-surface rounded-[var(--radius-card)] border p-3">
          <p className="text-body text-sm font-semibold">
            {dipilih.length} baris dipilih
          </p>
          <Textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            rows={2}
            className="mt-2"
            placeholder="Catatan hasil tinjauan, mis. sudah dikonfirmasi ke yang bersangkutan — sinyal GPS di ruang radiologi memang buruk."
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={tandai}
              disabled={proses}
              className="bg-brand-600 hover:bg-brand-700 inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-input)] px-3.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {proses ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Tandai sudah ditinjau
            </button>
            <button
              onClick={() => setDipilih([])}
              disabled={proses}
              className="text-muted hover:text-body h-9 px-2 text-sm font-semibold"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {pesan && (
        <p role="status" className="text-muted text-xs">
          {pesan}
        </p>
      )}

      <div className="border-app bg-surface overflow-x-auto rounded-[var(--radius-card)] border">
        <table className="w-full text-sm lg:min-w-[52rem]">
          <thead>
            <tr className="border-app text-subtle border-b text-left text-xs">
              <th className="w-10 py-2.5 pl-3">
                <input
                  type="checkbox"
                  aria-label="Pilih semua yang belum ditinjau"
                  checked={semuaTerpilih}
                  onChange={(e) =>
                    setDipilih(e.target.checked ? belumDitinjau.map((b) => b.id) : [])
                  }
                  disabled={belumDitinjau.length === 0}
                  className="accent-brand-600 size-4"
                />
              </th>
              <th className="px-3 py-2.5 font-medium">Tanggal</th>
              <th className="px-3 py-2.5 font-medium">Karyawan</th>
              <th className="px-3 py-2.5 font-medium">Penanda</th>
              <th className="px-3 py-2.5 font-medium">Jam</th>
              <th className="px-3 py-2.5 font-medium">Keterangan</th>
              <th className="px-3 py-2.5 font-medium">Tinjauan</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => {
              const menggantung = b.clockInAt && !b.clockOutAt;

              return (
                <tr
                  key={b.id}
                  className={cn(
                    "border-app border-b last:border-0",
                    b.ditinjauAt && "opacity-60",
                  )}
                >
                  <td className="py-2.5 pl-3 align-top">
                    {!b.ditinjauAt && (
                      <input
                        type="checkbox"
                        aria-label={`Pilih ${b.nama} ${b.tanggal}`}
                        checked={dipilih.includes(b.id)}
                        onChange={() => alih(b.id)}
                        className="accent-brand-600 size-4"
                      />
                    )}
                  </td>
                  <td className="text-body tnum px-3 py-2.5 align-top whitespace-nowrap">
                    {tanggalPendek(b.tanggal)}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <Link
                      href={`/admin/absensi/${b.employeeId}`}
                      className="text-body font-medium hover:underline"
                    >
                      {b.nama}
                    </Link>
                    {b.departemen && (
                      <span className="text-subtle block text-xs">{b.departemen}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <span className="flex flex-wrap gap-1">
                      {b.flags.map((f) => (
                        <Badge key={f} tone={BERAT.has(f) ? "danger" : "warn"}>
                          {LABEL_FLAG[f] ?? f}
                        </Badge>
                      ))}
                      {menggantung && <Badge tone="netral">Belum clock out</Badge>}
                    </span>
                  </td>
                  <td className="text-muted tnum px-3 py-2.5 align-top whitespace-nowrap">
                    {b.clockInAt ? jamWIB(b.clockInAt) : "--:--"} →{" "}
                    {b.clockOutAt ? jamWIB(b.clockOutAt) : "--:--"}
                  </td>
                  <td className="text-muted max-w-[18rem] px-3 py-2.5 align-top text-xs">
                    {b.jarakM !== null && <span className="tnum">{b.jarakM} m · </span>}
                    {b.alamat ?? "—"}
                    {b.alasan && (
                      <span className="text-body mt-0.5 block">“{b.alasan}”</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top text-xs">
                    {b.ditinjauAt ? (
                      <>
                        <span className="text-body block font-medium">
                          {b.ditinjauOleh ?? "—"} ·{" "}
                          {tanggalPendek(tanggalWIB(b.ditinjauAt))}
                        </span>
                        {b.catatanTinjau && (
                          <span className="text-muted block">{b.catatanTinjau}</span>
                        )}
                        <button
                          onClick={() => batalkan(b.id)}
                          disabled={proses}
                          className="text-brand-700 dark:text-brand-300 mt-1 inline-flex items-center gap-1 font-semibold hover:underline disabled:opacity-60"
                        >
                          <RotateCcw size={11} /> Kembalikan
                        </button>
                      </>
                    ) : (
                      <span className="text-subtle">Belum</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
