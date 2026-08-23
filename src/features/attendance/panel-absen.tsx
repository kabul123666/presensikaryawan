"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  Plus,
  RefreshCcw,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/field";
import { formatRupiah } from "@/lib/utils";
import { aksiClockIn, aksiClockOut, type HasilAbsen } from "./actions";
import { jarakMeter, useLokasi } from "./gunakan-lokasi";
import { PetaArea } from "./peta-area";

export type Tindakan = { id: string; nama: string; kategori: string; fee: number };

type Mode = "masuk" | "pulang";
type Tahap = "izin" | "kamera" | "form" | "kirim" | "selesai";

type Props = {
  mode: Mode;
  lokasi: { nama: string; lat: number; lng: number; radiusM: number } | null;
  isiFormTindakan: boolean;
  daftarTindakan: Tindakan[];
  onTutup: () => void;
  onBerhasil: () => void;
};

type BarisTindakan = {
  key: string;
  procedureId: string;
  jumlah: number;
  kodePasien: string;
};

export function PanelAbsen({
  mode,
  lokasi,
  isiFormTindakan,
  daftarTindakan,
  onTutup,
  onBerhasil,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [tahap, setTahap] = useState<Tahap>("izin");
  const [galatKamera, setGalatKamera] = useState<string | null>(null);

  // Pembacaan posisi ditangani penolong bersama, sama dengan layar absen.
  const { posisi, pesan: pesanLokasi, perbarui: ambilLokasi } = useLokasi();
  const [foto, setFoto] = useState<Blob | null>(null);
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [alasan, setAlasan] = useState("");
  const [catatanKerja, setCatatanKerja] = useState("");
  const [baris, setBaris] = useState<BarisTindakan[]>([]);
  const [hasil, setHasil] = useState<HasilAbsen | null>(null);

  const jarak = posisi && lokasi ? jarakMeter(posisi, lokasi) : null;
  const diLuarArea =
    jarak !== null && lokasi ? jarak - (posisi?.akurasi ?? 0) > lokasi.radiusM : false;

  /* ------------------------------------------------------------- Kamera */
  const hidupkanKamera = useCallback(async () => {
    setGalatKamera(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      // Pemasangan stream ke elemen dikerjakan effect di bawah. Elemen <video>
      // baru ada setelah tahap berpindah, jadi menyetelnya di sini selalu
      // mengenai ref yang masih kosong dan pratinjaunya berakhir hitam.
      setTahap("kamera");
    } catch {
      setGalatKamera(
        "Kamera tidak bisa diakses. Berikan izin kamera pada browser, lalu coba lagi.",
      );
    }
  }, []);

  /**
   * Menyambungkan stream ke elemen video begitu elemennya benar-benar ada.
   *
   * play() bisa ditolak peramban bila dipanggil di luar gestur pengguna;
   * penolakan itu diabaikan karena elemennya sudah bersumber dan atribut
   * autoPlay akan menjalankannya sendiri.
   */
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (tahap !== "kamera" || !video || !stream) return;

    video.srcObject = stream;
    void video.play().catch(() => {});
  }, [tahap]);

  const matikanKamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => matikanKamera(), [matikanKamera]);

  /** Ambil frame dan kompres di klien agar unggahan tetap ringan. */
  const jepret = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const kanvas = document.createElement("canvas");
    const rasio = video.videoWidth / video.videoHeight;
    kanvas.width = 720;
    kanvas.height = Math.round(720 / (rasio || 0.75));

    const ctx = kanvas.getContext("2d");
    if (!ctx) return;
    // Cerminkan agar sesuai dengan yang dilihat pengguna di layar.
    ctx.translate(kanvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, kanvas.width, kanvas.height);

    kanvas.toBlob(
      (blob) => {
        if (!blob) return;
        setFoto(blob);
        setPratinjau(URL.createObjectURL(blob));
        matikanKamera();
        setTahap("form");
      },
      "image/jpeg",
      0.82,
    );
  }, [matikanKamera]);

  /* -------------------------------------------------------------- Kirim */
  async function kirim() {
    if (!foto || !posisi) return;
    setTahap("kirim");

    const fd = new FormData();
    fd.set("foto", foto, "absen.jpg");
    fd.set("lat", String(posisi.lat));
    fd.set("lng", String(posisi.lng));
    fd.set("akurasi", String(Math.round(posisi.akurasi)));
    if (alasan.trim()) fd.set("alasan", alasan.trim());

    if (mode === "pulang") {
      fd.set("catatanKerja", catatanKerja.trim());
      const isi = baris
        .filter((b) => b.procedureId)
        .map((b) => ({
          procedureId: b.procedureId,
          jumlah: b.jumlah,
          kodePasien: b.kodePasien || undefined,
        }));
      if (isi.length) fd.set("tindakan", JSON.stringify(isi));
    }

    const res =
      mode === "masuk" ? await aksiClockIn(null, fd) : await aksiClockOut(null, fd);

    setHasil(res);
    setTahap(res.ok ? "selesai" : "form");
  }

  const totalFee = baris.reduce((jml, b) => {
    const t = daftarTindakan.find((x) => x.id === b.procedureId);
    return jml + (t ? t.fee * b.jumlah : 0);
  }, 0);

  const judul = mode === "masuk" ? "Absen Masuk" : "Absen Pulang";
  const catatanKurang = mode === "pulang" && catatanKerja.trim().length < 10;
  const alasanKurang = diLuarArea && alasan.trim().length < 5;

  /* ==================================================================== */

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <button
        aria-label="Tutup"
        onClick={() => {
          matikanKamera();
          onTutup();
        }}
        className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm"
      />

      <div className="bg-surface relative flex max-h-[92dvh] w-full max-w-[430px] animate-[rise_0.28s_cubic-bezier(0.16,1,0.3,1)] flex-col overflow-hidden rounded-t-[var(--radius-sheet)] shadow-[var(--shadow-float)] lg:rounded-[var(--radius-sheet)]">
        {/* Kepala */}
        <div className="border-app flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-body text-lg font-extrabold tracking-tight">{judul}</h2>
            <p className="text-subtle text-xs">
              {tahap === "izin" && "Menyiapkan lokasi"}
              {tahap === "kamera" && "Posisikan wajah di dalam bingkai"}
              {tahap === "form" && "Periksa data sebelum mengirim"}
              {tahap === "kirim" && "Mengirim ke server…"}
              {tahap === "selesai" && "Selesai"}
            </p>
          </div>
          <button
            onClick={() => {
              matikanKamera();
              onTutup();
            }}
            className="text-subtle hover:text-body hover:bg-surface-muted grid size-9 place-items-center rounded-full transition-colors"
            aria-label="Tutup"
          >
            <X size={19} />
          </button>
        </div>

        <div className="scrollbar-slim flex-1 overflow-y-auto px-5 py-5">
          {/* ---------------------------------------------------- Selesai */}
          {tahap === "selesai" && hasil?.ok && (
            <div className="animate-[pop_0.4s_cubic-bezier(0.34,1.56,0.64,1)] py-6 text-center">
              <div className="bg-brand-50 dark:bg-brand-900/40 mx-auto grid size-20 place-items-center rounded-full">
                <CheckCircle2 className="text-brand-600 dark:text-brand-300" size={44} />
              </div>
              <h3 className="text-body mt-5 text-xl font-extrabold">Berhasil</h3>
              <p className="text-muted mx-auto mt-2 max-w-[18rem] text-sm leading-relaxed">
                {hasil.pesan}
              </p>
              <Button size="lg" className="mt-7 w-full" onClick={onBerhasil}>
                Kembali ke beranda
              </Button>
            </div>
          )}

          {tahap !== "selesai" && (
            <>
              {/* --------------------------------------------- Gambaran area */}
              {lokasi && (
                <PetaArea
                  posisi={posisi ? { lat: posisi.lat, lng: posisi.lng } : null}
                  pusat={{ lat: lokasi.lat, lng: lokasi.lng }}
                  jarakM={jarak}
                  radiusM={lokasi.radiusM}
                  akurasiM={posisi?.akurasi ?? null}
                  namaLokasi={lokasi.nama}
                  diLuarArea={diLuarArea}
                />
              )}

              {/* -------------------------------------------------- Lokasi */}
              <div className="border-app bg-surface-muted rounded-[var(--radius-card)] border p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={
                      diLuarArea
                        ? "bg-danger-50 text-danger-600 dark:bg-danger-500/15 grid size-10 shrink-0 place-items-center rounded-xl"
                        : "bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300 grid size-10 shrink-0 place-items-center rounded-xl"
                    }
                  >
                    <MapPin size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    {!posisi && !pesanLokasi && (
                      <p className="text-muted flex items-center gap-2 text-sm">
                        <Loader2 size={15} className="animate-spin" /> Membaca lokasi…
                      </p>
                    )}
                    {pesanLokasi && (
                      <>
                        <p className="text-danger-700 dark:text-danger-300 text-sm font-semibold">
                          {pesanLokasi}
                        </p>
                        <button
                          onClick={ambilLokasi}
                          className="text-brand-700 dark:text-brand-300 mt-2 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
                        >
                          <RefreshCcw size={14} /> Coba lagi
                        </button>
                      </>
                    )}
                    {posisi && (
                      <>
                        <p className="text-body text-sm font-bold">
                          {diLuarArea ? "Di luar area kantor" : "Berada di area kantor"}
                        </p>
                        <p className="text-muted tnum mt-0.5 text-[13px]">
                          {lokasi
                            ? `${jarak} m dari ${lokasi.nama}`
                            : "Lokasi kerja belum diatur"}
                          {" · "}akurasi ±{Math.round(posisi.akurasi)} m
                        </p>
                        <button
                          onClick={ambilLokasi}
                          className="text-brand-700 dark:text-brand-300 mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold hover:underline"
                        >
                          <RefreshCcw size={13} /> Perbarui lokasi
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------- Kamera */}
              <div className="mt-4">
                {tahap === "izin" && (
                  <>
                    {pratinjau ? null : (
                      <div className="border-app bg-surface-muted grid aspect-[3/4] place-items-center rounded-[var(--radius-card)] border border-dashed">
                        <div className="px-8 text-center">
                          <Camera className="text-subtle mx-auto" size={34} />
                          <p className="text-body mt-3 text-sm font-bold">
                            Foto selfie wajib
                          </p>
                          <p className="text-muted mt-1.5 text-[13px] leading-relaxed">
                            Foto diambil langsung dari kamera dan tidak bisa dipilih dari
                            galeri.
                          </p>
                          {galatKamera && (
                            <p className="text-danger-700 dark:text-danger-300 mt-3 text-[13px] font-semibold">
                              {galatKamera}
                            </p>
                          )}
                          <Button
                            className="mt-4"
                            onClick={hidupkanKamera}
                            disabled={!posisi}
                          >
                            <Camera size={17} /> Buka kamera
                          </Button>
                          {!posisi && (
                            <p className="text-subtle mt-2 text-xs">
                              Menunggu lokasi terbaca lebih dulu
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {tahap === "kamera" && (
                  <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="aspect-[3/4] w-full scale-x-[-1] object-cover"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 grid place-items-center"
                    >
                      <div className="size-48 rounded-full border-2 border-dashed border-white/45" />
                    </div>
                    <button
                      onClick={jepret}
                      aria-label="Ambil foto"
                      className="absolute bottom-5 left-1/2 grid size-16 -translate-x-1/2 place-items-center rounded-full bg-white/25 ring-4 ring-white/50 backdrop-blur transition-transform active:scale-95"
                    >
                      <span className="size-11 rounded-full bg-white" />
                    </button>
                  </div>
                )}

                {(tahap === "form" || tahap === "kirim") && pratinjau && (
                  <div className="relative overflow-hidden rounded-[var(--radius-card)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pratinjau}
                      alt="Pratinjau foto absensi"
                      className="aspect-[3/4] w-full object-cover"
                    />
                    <button
                      onClick={() => {
                        setFoto(null);
                        setPratinjau(null);
                        setTahap("izin");
                      }}
                      className="absolute top-3 right-3 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"
                    >
                      Ulangi foto
                    </button>
                    <p className="text-subtle mt-2 text-center text-[11px]">
                      Cap waktu &amp; lokasi ditambahkan server saat foto disimpan
                    </p>
                  </div>
                )}
              </div>

              {/* -------------------------------------------------- Alasan */}
              {tahap === "form" && diLuarArea && (
                <div className="border-warn-500/40 bg-warn-50 dark:bg-warn-500/10 mt-4 rounded-[var(--radius-card)] border p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className="text-warn-600 dark:text-warn-500"
                      size={17}
                    />
                    <p className="text-warn-700 dark:text-warn-100 text-sm font-bold">
                      Anda di luar radius kantor
                    </p>
                  </div>
                  <p className="text-warn-700/85 dark:text-warn-100/80 mt-1.5 text-[13px]">
                    Absen tetap tercatat, namun perlu persetujuan admin.
                  </p>
                  <Textarea
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    placeholder="Contoh: mengantar sampel ke laboratorium rekanan"
                    className="mt-3 min-h-20 bg-white/70 dark:bg-black/20"
                  />
                </div>
              )}

              {/* ------------------------------------------ Catatan kerja */}
              {tahap === "form" && mode === "pulang" && (
                <div className="mt-5">
                  <Label htmlFor="catatanKerja">Catatan pekerjaan hari ini</Label>
                  <Textarea
                    id="catatanKerja"
                    value={catatanKerja}
                    onChange={(e) => setCatatanKerja(e.target.value)}
                    placeholder="Ringkas apa saja yang Anda kerjakan hari ini…"
                  />
                  <p className="text-subtle mt-1.5 text-xs">
                    {catatanKerja.trim().length}/10 karakter minimum
                  </p>
                </div>
              )}

              {/* --------------------------------------------- Tindakan */}
              {tahap === "form" && mode === "pulang" && isiFormTindakan && (
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <Label className="mb-0">Tindakan yang dikerjakan</Label>
                    <span className="text-subtle text-xs">Opsional</span>
                  </div>

                  <div className="mt-3 space-y-3">
                    {baris.map((b, i) => {
                      const t = daftarTindakan.find((x) => x.id === b.procedureId);
                      return (
                        <div
                          key={b.key}
                          className="border-app bg-surface-muted rounded-[var(--radius-input)] border p-3"
                        >
                          <div className="flex items-start gap-2">
                            <Select
                              value={b.procedureId}
                              onChange={(e) =>
                                setBaris((s) =>
                                  s.map((x, j) =>
                                    j === i ? { ...x, procedureId: e.target.value } : x,
                                  ),
                                )
                              }
                              className="flex-1"
                            >
                              <option value="">Pilih tindakan…</option>
                              {daftarTindakan.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.nama}
                                </option>
                              ))}
                            </Select>
                            <button
                              onClick={() => setBaris((s) => s.filter((_, j) => j !== i))}
                              aria-label="Hapus tindakan"
                              className="text-subtle hover:text-danger-600 grid size-11 shrink-0 place-items-center rounded-xl transition-colors"
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-muted text-xs font-semibold">
                                Jumlah
                              </span>
                              <div className="border-app bg-surface flex items-center rounded-lg border">
                                <button
                                  onClick={() =>
                                    setBaris((s) =>
                                      s.map((x, j) =>
                                        j === i
                                          ? { ...x, jumlah: Math.max(1, x.jumlah - 1) }
                                          : x,
                                      ),
                                    )
                                  }
                                  className="text-muted grid size-8 place-items-center"
                                  aria-label="Kurangi"
                                >
                                  −
                                </button>
                                <span className="tnum text-body w-7 text-center text-sm font-bold">
                                  {b.jumlah}
                                </span>
                                <button
                                  onClick={() =>
                                    setBaris((s) =>
                                      s.map((x, j) =>
                                        j === i
                                          ? { ...x, jumlah: Math.min(50, x.jumlah + 1) }
                                          : x,
                                      ),
                                    )
                                  }
                                  className="text-muted grid size-8 place-items-center"
                                  aria-label="Tambah"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            {t && t.fee > 0 && (
                              <span className="text-brand-700 dark:text-brand-300 tnum text-sm font-bold">
                                {formatRupiah(t.fee * b.jumlah)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() =>
                      setBaris((s) => [
                        ...s,
                        {
                          key: crypto.randomUUID(),
                          procedureId: "",
                          jumlah: 1,
                          kodePasien: "",
                        },
                      ])
                    }
                  >
                    <Plus size={17} /> Tambah tindakan
                  </Button>

                  {totalFee > 0 && (
                    <div className="bg-brand-50 dark:bg-brand-900/35 mt-3 flex items-center justify-between rounded-[var(--radius-input)] px-4 py-3">
                      <span className="text-brand-800 dark:text-brand-200 text-sm font-semibold">
                        Estimasi fee hari ini
                      </span>
                      <span className="text-brand-800 dark:text-brand-100 tnum text-base font-extrabold">
                        {formatRupiah(totalFee)}
                      </span>
                    </div>
                  )}
                  <p className="text-subtle mt-2 text-xs leading-relaxed">
                    Nominal masih estimasi. Nilai final dihitung server dan dikunci
                    setelah diverifikasi admin.
                  </p>
                </div>
              )}

              {/* --------------------------------------------------- Galat */}
              {hasil && !hasil.ok && (
                <div
                  role="alert"
                  className="bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-100 mt-4 rounded-[var(--radius-input)] px-4 py-3 text-sm font-medium"
                >
                  {hasil.pesan}
                </div>
              )}
            </>
          )}
        </div>

        {/* Kaki */}
        {tahap === "form" && (
          <div className="border-app bg-surface pb-safe border-t px-5 pt-4">
            <Button
              size="lg"
              className="w-full"
              onClick={kirim}
              disabled={!foto || !posisi || catatanKurang || alasanKurang}
            >
              {mode === "masuk" ? "Kirim absen masuk" : "Kirim absen pulang"}
            </Button>
            {(catatanKurang || alasanKurang) && (
              <p className="text-subtle mt-2 text-center text-xs">
                {alasanKurang
                  ? "Isi alasan absen di luar area terlebih dahulu"
                  : "Catatan pekerjaan minimal 10 karakter"}
              </p>
            )}
          </div>
        )}

        {tahap === "kirim" && (
          <div className="border-app bg-surface pb-safe border-t px-5 pt-4">
            <Button size="lg" className="w-full" disabled>
              <Loader2 size={18} className="animate-spin" /> Mengirim…
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
