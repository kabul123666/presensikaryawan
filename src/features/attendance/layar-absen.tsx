"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crosshair, Loader2, MapPin, ScanFace } from "lucide-react";

import { useJamDetik } from "@/lib/gunakan-jam";
import { cn } from "@/lib/utils";
import { aksiAlamatSekarang } from "./aksi-alamat";
import { jarakMeter, useLokasi } from "./gunakan-lokasi";
import { PanelAbsen, type Tindakan } from "./panel-absen";

const PetaLeaflet = dynamic(() => import("./peta-leaflet").then((m) => m.PetaLeaflet), {
  ssr: false,
  loading: () => (
    <div className="bg-surface-muted text-subtle grid h-full place-items-center text-xs">
      Memuat peta…
    </div>
  ),
});

type Props = {
  sudahMasuk: boolean;
  sudahPulang: boolean;
  jamMasuk: string | null;
  jamPulang: string | null;
  jadwal: { nama: string; jamMasuk: string; jamPulang: string } | null;
  bolehTanpaShift: boolean;
  lokasi: {
    nama: string;
    alamat: string | null;
    lat: number;
    lng: number;
    radiusM: number;
  } | null;
  isiFormTindakan: boolean;
  daftarTindakan: Tindakan[];
};

/**
 * Layar absen.
 *
 * Peta ditaruh paling atas dan dibuat besar karena satu-satunya pertanyaan
 * sebelum menekan tombol adalah "posisi saya sudah benar belum". Keterangan
 * alamat, jadwal, dan tombolnya duduk di lembar putih yang menindih peta —
 * susunan yang sama dipakai hampir semua aplikasi kepegawaian, dan memang
 * paling enak dijangkau ibu jari.
 *
 * Pengambilan foto tetap dikerjakan PanelAbsen yang sudah ada; layar ini
 * hanya pintunya, sehingga aturan geofence dan watermark tidak digandakan.
 */
export function LayarAbsen({
  sudahMasuk,
  sudahPulang,
  jamMasuk,
  jamPulang,
  jadwal,
  bolehTanpaShift,
  lokasi,
  isiFormTindakan,
  daftarTindakan,
}: Props) {
  const router = useRouter();
  const jam = useJamDetik();
  const [panelTerbuka, setPanelTerbuka] = useState(false);
  const [alamat, setAlamat] = useState<string | null>(null);

  const { posisi, pesan: pesanLokasi, perbarui } = useLokasi();

  const jarak = posisi && lokasi ? jarakMeter(posisi, lokasi) : null;
  const diLuarArea =
    jarak !== null && lokasi ? jarak - (posisi?.akurasi ?? 0) > lokasi.radiusM : false;

  const mode = sudahMasuk ? "pulang" : "masuk";
  const selesai = sudahMasuk && sudahPulang;
  const bisaAbsen = Boolean(jadwal) || bolehTanpaShift || sudahMasuk;

  /**
   * Alamat dicari ulang hanya ketika posisinya bergeser cukup jauh.
   *
   * Koordinat dibulatkan empat desimal (~11 m) supaya rentetan pembacaan GPS
   * yang bergetar beberapa meter tidak memanggil layanan geocoding berkali-kali
   * untuk tempat yang sama.
   */
  const kunciPosisi = posisi ? `${posisi.lat.toFixed(4)},${posisi.lng.toFixed(4)}` : null;

  useEffect(() => {
    if (!kunciPosisi) return;
    let dibatalkan = false;

    const [lat, lng] = kunciPosisi.split(",").map(Number);
    void aksiAlamatSekarang(lat, lng).then((hasil) => {
      if (!dibatalkan) setAlamat(hasil);
    });

    return () => {
      dibatalkan = true;
    };
  }, [kunciPosisi]);

  const alamatTampil =
    alamat ?? lokasi?.alamat ?? lokasi?.nama ?? "Lokasi kerja belum diatur";

  return (
    <>
      <section className="relative">
        {/* ------------------------------------------------------- Peta */}
        {/* `isolate` mengurung z-index di dalam peta.
            Lapisan judul dan tombol harus melampaui panel Leaflet yang ber-z-index
            ratusan; tanpa stacking context sendiri, angka setinggi itu juga
            menembus panel absen yang terbuka di atasnya. */}
        <div className="bg-surface-muted relative isolate h-[340px] overflow-hidden lg:h-[380px] lg:rounded-[var(--radius-sheet)]">
          {lokasi ? (
            <PetaLeaflet
              posisi={posisi ? { lat: posisi.lat, lng: posisi.lng } : null}
              pusat={{ lat: lokasi.lat, lng: lokasi.lng }}
              radiusM={lokasi.radiusM}
              akurasiM={posisi?.akurasi ?? 0}
              diLuarArea={diLuarArea}
              kelasTinggi="h-full"
            />
          ) : (
            <div className="grid h-full place-items-center px-8 text-center">
              <p className="text-muted text-sm">
                Lokasi kerja Anda belum diatur admin, jadi areanya belum bisa digambar.
              </p>
            </div>
          )}

          {/* Judul di atas peta memakai peneduh supaya tetap terbaca di atas
              ubin peta yang warnanya tidak bisa ditebak. */}
          <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-[1000] bg-gradient-to-b from-black/55 via-black/25 to-transparent px-5 pt-4 pb-10 lg:rounded-t-[var(--radius-sheet)] lg:pt-5">
            <h1 className="text-center text-[19px] font-extrabold text-white drop-shadow">
              Presensi Kehadiran
            </h1>
            <p className="mt-1 text-center text-[13px] text-white/85 drop-shadow">
              Pastikan koordinat Anda sudah sesuai.
            </p>
          </div>

          {/* Perbarui lokasi */}
          <button
            type="button"
            onClick={perbarui}
            aria-label="Perbarui lokasi"
            className="bg-surface text-brand-700 dark:text-brand-300 absolute right-4 bottom-9 z-[1000] grid size-12 place-items-center rounded-full shadow-[var(--shadow-float)] transition-transform active:scale-95"
          >
            <Crosshair size={22} />
          </button>

          {/* Status posisi, menempel di kiri bawah peta */}
          <div className="absolute bottom-9 left-4 z-[1000] max-w-[60%]">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold shadow-[var(--shadow-soft)]",
                !posisi
                  ? "bg-surface text-muted"
                  : diLuarArea
                    ? "bg-danger-600 text-white"
                    : "bg-brand-600 text-white",
              )}
            >
              {!posisi ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Membaca lokasi…
                </>
              ) : diLuarArea ? (
                <>Di luar area · {jarak} m</>
              ) : (
                <>Di dalam area · {jarak} m</>
              )}
            </span>
          </div>
        </div>

        {/* --------------------------------------------------- Lembar isi */}
        <div className="bg-surface relative -mt-5 rounded-t-[var(--radius-sheet)] px-5 pt-5 pb-1 lg:mt-4 lg:rounded-[var(--radius-sheet)] lg:border lg:border-[var(--border)] lg:px-6 lg:py-5">
          <div className="flex items-start gap-3">
            <span className="bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300 grid size-10 shrink-0 place-items-center rounded-xl">
              <MapPin size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body text-[13px] leading-relaxed font-semibold">
                {alamatTampil}
              </p>
              {pesanLokasi && (
                <p className="text-danger-700 dark:text-danger-300 mt-1 text-[12px] font-semibold">
                  {pesanLokasi}
                </p>
              )}
              {posisi && lokasi && (
                <p className="text-subtle tnum mt-1 text-[12px]">
                  {lokasi.nama} · batas {lokasi.radiusM} m · akurasi ±
                  {Math.round(posisi.akurasi)} m
                </p>
              )}
            </div>
          </div>

          <div className="border-app mt-4 grid grid-cols-2 gap-3 border-t pt-4">
            <div>
              <p className="text-subtle text-[12px] font-semibold">Jadwal Mulai Kerja</p>
              <p className="tnum text-body mt-1 text-[22px] leading-none font-extrabold">
                {jadwal ? jadwal.jamMasuk.slice(0, 5) : "--:--"}
              </p>
              <p className="text-subtle mt-1.5 text-[11px]">
                Masuk tercatat <span className="tnum">{jamMasuk ?? "--:--"}</span>
              </p>
            </div>
            <div>
              <p className="text-subtle text-[12px] font-semibold">
                Jadwal Selesai Kerja
              </p>
              <p className="tnum text-body mt-1 text-[22px] leading-none font-extrabold">
                {jadwal ? jadwal.jamPulang.slice(0, 5) : "--:--"}
              </p>
              <p className="text-subtle mt-1.5 text-[11px]">
                Pulang tercatat <span className="tnum">{jamPulang ?? "--:--"}</span>
              </p>
            </div>
          </div>

          {/* Keterangan shift sekaligus pintu ke jadwal sebulan penuh. */}
          <Link
            href="/jadwal"
            className="text-subtle hover:text-body mt-3 block text-[11px] transition-colors"
          >
            {jadwal
              ? `Shift ${jadwal.nama} · lihat jadwal sebulan`
              : bolehTanpaShift
                ? "Tanpa shift terjadwal · kehadiran tetap tercatat"
                : "Shift belum diatur — hubungi HRD"}
          </Link>

          <div className="pb-safe pt-4 lg:pb-0">
            {selesai ? (
              <div className="bg-surface-muted rounded-[var(--radius-input)] px-4 py-4 text-center">
                <p className="text-body text-sm font-extrabold">Absen hari ini selesai</p>
                <p className="text-muted mt-1 text-[13px]">Sampai jumpa besok.</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPanelTerbuka(true)}
                disabled={!bisaAbsen}
                className={cn(
                  "flex h-14 w-full items-center justify-center gap-2.5 rounded-full text-[16px] font-bold text-white transition-colors",
                  "active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45",
                  mode === "masuk"
                    ? "bg-brand-600 hover:bg-brand-700"
                    : "bg-warn-600 hover:bg-warn-700",
                )}
              >
                <ScanFace size={21} />
                {mode === "masuk" ? "Check In" : "Check Out"}
                <span className="tnum text-[13px] font-semibold text-white/75">
                  {jam}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

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
