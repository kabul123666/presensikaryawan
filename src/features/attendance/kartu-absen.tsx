"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { useJamDetik } from "@/lib/gunakan-jam";
import { cn } from "@/lib/utils";
import { PanelAbsen, type Tindakan } from "./panel-absen";

type Props = {
  sudahMasuk: boolean;
  sudahPulang: boolean;
  jadwal: { nama: string; jamMasuk: string; jamPulang: string } | null;
  /** Kebijakan admin: karyawan tanpa shift hari itu tetap boleh absen. */
  bolehTanpaShift: boolean;
  lokasi: { nama: string; lat: number; lng: number; radiusM: number } | null;
  isiFormTindakan: boolean;
  daftarTindakan: Tindakan[];
};

export function KartuAbsen({
  sudahMasuk,
  sudahPulang,
  jadwal,
  bolehTanpaShift,
  lokasi,
  isiFormTindakan,
  daftarTindakan,
}: Props) {
  const router = useRouter();
  const [panelTerbuka, setPanelTerbuka] = useState(false);

  // Jam dibaca dari sumber waktu bersama; nilainya baru terisi setelah
  // hidrasi sehingga render server dan klien tetap cocok.
  const jam = useJamDetik();

  const mode = sudahMasuk ? "pulang" : "masuk";
  const selesai = sudahMasuk && sudahPulang;

  // Yang sudah terlanjur absen masuk harus selalu bisa menutup harinya,
  // sekalipun jadwalnya baru saja dicabut admin di tengah hari.
  const bisaAbsen = Boolean(jadwal) || bolehTanpaShift || sudahMasuk;

  return (
    <>
      <div className="px-5 lg:px-0">
        <div className="bg-surface border-app relative rounded-[var(--radius-card)] border p-6">
          <div className="relative text-center">
            <p className="eyebrow">Waktu sekarang · WIB</p>
            <p className="tnum text-body mt-2 text-[44px] leading-none font-medium">
              {jam}
            </p>
            {/* Keterangan shift sekaligus pintu masuk ke jadwal sebulan penuh —
                pertanyaan "besok saya masuk jam berapa?" paling sering muncul
                justru saat sedang melihat shift hari ini. */}
            <Link
              href="/jadwal"
              className="hover:bg-surface-muted mt-2 -mb-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 transition-colors"
            >
              {jadwal ? (
                <span className="text-muted text-sm">
                  Shift <span className="text-body font-bold">{jadwal.nama}</span> ·{" "}
                  {jadwal.jamMasuk.slice(0, 5)}–{jadwal.jamPulang.slice(0, 5)}
                </span>
              ) : bolehTanpaShift ? (
                /* Bukan peringatan: sebagian staf memang datang hanya bila ada
                   pasien, jadi tidak punya shift adalah keadaan normal baginya
                   dan tidak perlu diwarnai seperti masalah. */
                <span className="text-muted text-sm">
                  Tanpa shift terjadwal · kehadiran tetap tercatat
                </span>
              ) : (
                <span className="text-warn-600 dark:text-warn-500 text-sm font-semibold">
                  Shift belum diatur — hubungi HRD
                </span>
              )}
              <ChevronRight size={15} className="text-subtle shrink-0" />
            </Link>
          </div>

          {/* Tombol utama */}
          <div className="relative mt-7 flex justify-center">
            {selesai ? (
              <div className="bg-surface-muted grid size-44 place-items-center rounded-full">
                <div className="text-center">
                  <p className="text-body text-base font-extrabold">Absen selesai</p>
                  <p className="text-muted mt-1 text-sm">Sampai jumpa besok</p>
                </div>
              </div>
            ) : (
              /* Satu piringan pekat, tanpa gradien maupun cahaya berdenyut —
                 tombol ini sudah jadi elemen terbesar di layar, tidak perlu
                 efek tambahan untuk menarik perhatian. */
              <button
                onClick={() => setPanelTerbuka(true)}
                disabled={!bisaAbsen}
                className={cn(
                  "grid size-40 place-items-center rounded-full transition-colors",
                  "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45",
                  mode === "masuk"
                    ? "bg-brand-600 hover:bg-brand-700"
                    : "bg-warn-600 hover:bg-warn-700",
                )}
              >
                <span className="flex flex-col items-center gap-1">
                  <span className="text-[19px] font-semibold text-white">
                    {mode === "masuk" ? "Masuk" : "Pulang"}
                  </span>
                  <span className="text-[11px] text-white/75">
                    {mode === "masuk" ? "Mulai absen" : "Akhiri hari"}
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {panelTerbuka && (
        <PanelAbsen
          mode={mode}
          lokasi={lokasi}
          isiFormTindakan={isiFormTindakan}
          daftarTindakan={daftarTindakan}
          onTutup={() => setPanelTerbuka(false)}
          onBerhasil={() => {
            setPanelTerbuka(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
