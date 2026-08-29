"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Images,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Hint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { selisihHari, tanggalWIB } from "@/lib/waktu";
import {
  aksiAjukanCuti,
  aksiAjukanKoreksi,
  aksiAjukanLembur,
  type HasilPengajuan,
} from "./actions";
import { kecilkanFoto } from "./kecilkan-foto";

export type JenisCutiOpsi = {
  id: string;
  nama: string;
  butuhLampiran: boolean;
  sisa: number;
  kuotaDefault: number;
};

type Jenis = "cuti" | "izin" | "lembur" | "koreksi";

/**
 * Formulir pengajuan memakai isian bergaris bawah, bukan kotak berbingkai.
 *
 * Satu layar di sini berisi lima sampai enam isian berturut-turut; kotak
 * penuh membuat layarnya penuh garis dan berat dibaca, sedangkan garis bawah
 * menyisakan satu garis per isian dan menjaga labelnya tetap menonjol.
 * Gayanya ditaruh di berkas ini saja supaya formulir admin — yang padat dan
 * memang lebih terbantu oleh kotak — tidak ikut berubah.
 */
const ISIAN =
  "rounded-none border-0 border-b bg-transparent px-0 focus:border-brand-600 focus:ring-0";

const JUDUL: Record<Jenis, { judul: string; isi: string }> = {
  cuti: {
    judul: "Ajukan Cuti",
    isi: "Saldo cuti dicek otomatis dan hari yang diajukan langsung ditahan.",
  },
  izin: {
    judul: "Ajukan Izin / Sakit",
    isi: "Izin dan sakit tidak memotong cuti tahunan. Lampirkan surat dokter untuk sakit lebih dari satu hari.",
  },
  lembur: {
    judul: "Ajukan Lembur",
    isi: "Lembur yang terdeteksi otomatis saat clock out tidak perlu diajukan lagi.",
  },
  koreksi: {
    judul: "Koreksi Absen",
    isi: "Perbaiki jam masuk atau pulang yang salah tercatat.",
  },
};

function Sukses({ pesan }: { pesan: string }) {
  return (
    <div className="animate-[pop_0.4s_cubic-bezier(0.34,1.56,0.64,1)] px-5 py-10 text-center">
      <div className="bg-brand-50 dark:bg-brand-900/40 mx-auto grid size-16 place-items-center rounded-full">
        <CheckCircle2 className="text-brand-600 dark:text-brand-300" size={34} />
      </div>
      <h2 className="text-body mt-5 text-xl font-extrabold">Pengajuan terkirim</h2>
      <p className="text-muted mx-auto mt-2 max-w-[18rem] text-sm leading-relaxed">
        {pesan}
      </p>
      <Link href="/pengajuan" className="mt-7 inline-block">
        <Button size="lg">Lihat daftar pengajuan</Button>
      </Link>
    </div>
  );
}

export function FormPengajuan({
  jenis,
  jenisCuti,
  batasBackdateHari,
}: {
  jenis: Jenis;
  jenisCuti: JenisCutiOpsi[];
  batasBackdateHari: number;
}) {
  const aksi =
    jenis === "lembur"
      ? aksiAjukanLembur
      : jenis === "koreksi"
        ? aksiAjukanKoreksi
        : aksiAjukanCuti;

  const [hasil, kirim, sedang] = useActionState<HasilPengajuan | null, FormData>(
    aksi,
    null,
  );

  const inputLampiran = useRef<HTMLInputElement>(null);
  const [menyiapkanLampiran, setMenyiapkanLampiran] = useState(false);
  const [infoLampiran, setInfoLampiran] = useState<string | null>(null);
  const [pratinjauLampiran, setPratinjauLampiran] = useState<string | null>(null);

  /**
   * Dua jalan mengambil surat dokter, dari satu kolom berkas yang sama.
   *
   * Atribut `capture` yang menentukan peramban membuka kamera atau galeri, dan
   * ia dipasang tepat sebelum kolomnya diklik — bukan lewat dua kolom terpisah,
   * karena dua kolom bernama sama membuat yang kosong menimpa yang berisi saat
   * formulirnya dikirim.
   */
  function bukaSumberLampiran(sumber: "galeri" | "kamera") {
    const kolom = inputLampiran.current;
    if (!kolom) return;

    if (sumber === "kamera") kolom.setAttribute("capture", "environment");
    else kolom.removeAttribute("capture");
    kolom.click();
  }

  function hapusLampiran() {
    if (inputLampiran.current) inputLampiran.current.value = "";
    if (pratinjauLampiran) URL.revokeObjectURL(pratinjauLampiran);
    setPratinjauLampiran(null);
    setInfoLampiran(null);
  }

  /**
   * Foto diperkecil di peramban begitu dipilih, bukan saat dikirim.
   *
   * Selesai di sini, yang berangkat ke server tinggal ratusan kilobyte — dan
   * pengguna melihat ukurannya lebih dulu, bukan menunggu unggahan panjang
   * yang baru ketahuan gagalnya di ujung.
   */
  async function siapkanLampiran(berkas: File | undefined) {
    if (!berkas) {
      setInfoLampiran(null);
      return;
    }

    setMenyiapkanLampiran(true);
    try {
      const kecil = await kecilkanFoto(berkas);
      if (kecil !== berkas && inputLampiran.current) {
        const wadah = new DataTransfer();
        wadah.items.add(kecil);
        inputLampiran.current.files = wadah.files;
      }
      if (pratinjauLampiran) URL.revokeObjectURL(pratinjauLampiran);
      setPratinjauLampiran(URL.createObjectURL(kecil));
      setInfoLampiran(`Siap dikirim · ${Math.round(kecil.size / 1024)} KB`);
    } catch {
      setInfoLampiran(
        "Foto dikirim apa adanya — peramban ini tidak bisa memperkecilnya.",
      );
    } finally {
      setMenyiapkanLampiran(false);
    }
  }

  const hariIni = tanggalWIB();
  const [mulai, setMulai] = useState(hariIni);
  const [akhir, setAkhir] = useState(hariIni);
  const [jenisTerpilih, setJenisTerpilih] = useState(jenisCuti[0]?.id ?? "");

  const jumlahHari = Math.max(0, selisihHari(mulai, akhir) + 1);
  const cutiAktif = jenisCuti.find((j) => j.id === jenisTerpilih);

  /*
   * Hanya cuti yang bertumpu pada saldo. Izin dan sakit tidak pernah memotong
   * cuti tahunan, jadi kuotanya tidak ikut ditampilkan maupun diperiksa di
   * sini — pemeriksaan sesungguhnya tetap di server.
   */
  const pakaiKuota = jenis === "cuti";
  const kurang =
    pakaiKuota && cutiAktif && cutiAktif.kuotaDefault > 0 && jumlahHari > cutiAktif.sisa;

  if (hasil?.ok) return <Sukses pesan={hasil.pesan} />;

  const info = JUDUL[jenis];

  // Cuti dan izin bergantung pada jenis yang dibuat admin. Tanpa itu, dahulu
  // yang tampil hanya daftar pilihan kosong tanpa keterangan — orang mengira
  // aplikasinya rusak, padahal yang kurang adalah data yang memang harus
  // ditetapkan HRD lebih dulu.
  const butuhJenis = jenis === "cuti" || jenis === "izin";
  if (butuhJenis && jenisCuti.length === 0) {
    return (
      <div className="px-5 pb-8">
        <div className="border-app bg-surface rounded-[var(--radius-card)] border border-dashed px-5 py-10 text-center">
          <p className="text-body text-sm font-bold">
            Jenis {jenis === "izin" ? "izin" : "cuti"} belum diatur
          </p>
          <p className="text-muted mx-auto mt-2 max-w-[19rem] text-[13px] leading-relaxed">
            HRD perlu menetapkan jenis beserta kuotanya lebih dulu di Pengaturan → Cuti.
            Setelah itu pengajuan bisa dibuat dari sini.
          </p>
          <Link
            href="/pengajuan"
            className="border-app-strong bg-surface text-body hover:bg-surface-muted mt-6 inline-flex h-11 items-center rounded-[var(--radius-input)] border px-5 text-sm font-semibold transition-colors"
          >
            Kembali
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-8">
      <form action={kirim} className="space-y-4">
        {/* Cuti dan izin memakai aksi yang sama; yang membedakan keduanya —
            termasuk apakah saldo cuti ikut terpotong — adalah formulir ini. */}
        {butuhJenis && <input type="hidden" name="jenisPengajuan" value={jenis} />}
        <p className="text-muted text-[13px] leading-relaxed">{info.isi}</p>

        {hasil && !hasil.ok && (
          <div
            role="alert"
            className="bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-100 rounded-[var(--radius-input)] px-4 py-3 text-sm font-medium"
          >
            {hasil.pesan}
          </div>
        )}

        {/* ------------------------------------------------ Cuti & izin */}
        {(jenis === "cuti" || jenis === "izin") && (
          <>
            <div>
              <Label className="text-muted text-[13px] font-medium" htmlFor="leaveTypeId">
                Jenis
              </Label>
              <Select
                className={ISIAN}
                id="leaveTypeId"
                name="leaveTypeId"
                value={jenisTerpilih}
                onChange={(e) => setJenisTerpilih(e.target.value)}
                required
              >
                {jenisCuti.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.nama}
                    {pakaiKuota && j.kuotaDefault > 0 ? ` — sisa ${j.sisa} hari` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted text-[13px] font-medium" htmlFor="mulai">
                  Mulai
                </Label>
                <Input
                  className={ISIAN}
                  id="mulai"
                  name="mulai"
                  type="date"
                  value={mulai}
                  onChange={(e) => {
                    setMulai(e.target.value);
                    if (selisihHari(e.target.value, akhir) < 0) setAkhir(e.target.value);
                  }}
                  required
                />
              </div>
              <div>
                <Label className="text-muted text-[13px] font-medium" htmlFor="akhir">
                  Selesai
                </Label>
                <Input
                  className={ISIAN}
                  id="akhir"
                  name="akhir"
                  type="date"
                  value={akhir}
                  min={mulai}
                  onChange={(e) => setAkhir(e.target.value)}
                  required
                />
              </div>
            </div>

            <div
              className={cn(
                "rounded-[var(--radius-input)] px-4 py-3 text-sm font-semibold",
                kurang
                  ? "bg-danger-50 text-danger-700 dark:bg-danger-500/12 dark:text-danger-100"
                  : "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100",
              )}
            >
              {jumlahHari} hari diajukan
              {pakaiKuota && cutiAktif && cutiAktif.kuotaDefault > 0 && (
                <span className="font-normal">
                  {" · "}sisa saldo {cutiAktif.sisa} hari
                  {kurang ? " — tidak mencukupi" : ""}
                </span>
              )}
            </div>

            {cutiAktif?.butuhLampiran && (
              <div>
                <Label className="text-muted text-[13px] font-medium" htmlFor="lampiran">
                  <span className="inline-flex items-center gap-1.5">
                    <Paperclip size={14} /> Lampiran surat dokter
                  </span>
                </Label>
                {/* Kolom berkasnya disembunyikan dari mata, bukan dari
                    formulir — yang ditekan pengguna adalah dua tombol di bawah,
                    dan kolom inilah yang tetap membawa berkasnya saat dikirim. */}
                <input
                  ref={inputLampiran}
                  id="lampiran"
                  name="lampiran"
                  type="file"
                  accept="image/*"
                  onChange={(e) => siapkanLampiran(e.target.files?.[0])}
                  className="sr-only"
                />

                <div className="mt-1.5 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => bukaSumberLampiran("galeri")}
                    disabled={menyiapkanLampiran}
                    className="border-app-strong bg-surface text-body hover:border-brand-300 hover:bg-surface-muted flex h-[52px] items-center justify-center gap-2 rounded-[var(--radius-input)] border text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    <Images size={17} /> Dari Galeri
                  </button>
                  <button
                    type="button"
                    onClick={() => bukaSumberLampiran("kamera")}
                    disabled={menyiapkanLampiran}
                    className="border-app-strong bg-surface text-body hover:border-brand-300 hover:bg-surface-muted flex h-[52px] items-center justify-center gap-2 rounded-[var(--radius-input)] border text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    <Camera size={17} /> Foto Langsung
                  </button>
                </div>

                {pratinjauLampiran && (
                  <div className="border-app bg-surface mt-2.5 flex items-center gap-3 rounded-[var(--radius-input)] border p-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pratinjauLampiran}
                      alt="Pratinjau surat dokter"
                      className="size-14 shrink-0 rounded-lg object-cover"
                    />
                    <p className="text-body min-w-0 flex-1 text-[13px] font-semibold">
                      Surat dokter terlampir
                      <span className="text-subtle block text-[12px] font-normal">
                        {infoLampiran}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={hapusLampiran}
                      aria-label="Hapus lampiran"
                      className="text-subtle hover:bg-surface-muted hover:text-body grid size-9 shrink-0 place-items-center rounded-full transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                <Hint>
                  {menyiapkanLampiran
                    ? "Menyiapkan foto…"
                    : pratinjauLampiran
                      ? "Tekan salah satu tombol lagi untuk mengganti fotonya."
                      : "Boleh dikosongkan. Suratnya bisa menyusul ke atasan bila belum ada."}
                </Hint>
              </div>
            )}
          </>
        )}

        {/* ---------------------------------------------------- Lembur */}
        {jenis === "lembur" && (
          <>
            <div>
              <Label className="text-muted text-[13px] font-medium" htmlFor="tanggal">
                Tanggal lembur
              </Label>
              <Input
                className={ISIAN}
                id="tanggal"
                name="tanggal"
                type="date"
                max={hariIni}
                defaultValue={hariIni}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted text-[13px] font-medium" htmlFor="jamMulai">
                  Jam mulai
                </Label>
                <Input
                  className={ISIAN}
                  id="jamMulai"
                  name="jamMulai"
                  type="time"
                  defaultValue="16:00"
                  required
                />
              </div>
              <div>
                <Label
                  className="text-muted text-[13px] font-medium"
                  htmlFor="jamSelesai"
                >
                  Jam selesai
                </Label>
                <Input
                  className={ISIAN}
                  id="jamSelesai"
                  name="jamSelesai"
                  type="time"
                  defaultValue="18:00"
                  required
                />
              </div>
            </div>
          </>
        )}

        {/* --------------------------------------------------- Koreksi */}
        {jenis === "koreksi" && (
          <>
            <div>
              <Label className="text-muted text-[13px] font-medium" htmlFor="tanggal">
                Tanggal yang dikoreksi
              </Label>
              <Input
                className={ISIAN}
                id="tanggal"
                name="tanggal"
                type="date"
                max={hariIni}
                defaultValue={hariIni}
                required
              />
              <Hint>Maksimal {batasBackdateHari} hari ke belakang.</Hint>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted text-[13px] font-medium" htmlFor="jamMasuk">
                  Jam masuk sebenarnya
                </Label>
                <Input
                  className={ISIAN}
                  id="jamMasuk"
                  name="jamMasuk"
                  type="time"
                  defaultValue="08:00"
                  required
                />
              </div>
              <div>
                <Label className="text-muted text-[13px] font-medium" htmlFor="jamPulang">
                  Jam pulang sebenarnya
                </Label>
                <Input
                  className={ISIAN}
                  id="jamPulang"
                  name="jamPulang"
                  type="time"
                  defaultValue="16:00"
                  required
                />
              </div>
            </div>
          </>
        )}

        <div>
          <Label className="text-muted text-[13px] font-medium" htmlFor="alasan">
            Alasan
          </Label>
          <Textarea
            className={ISIAN}
            id="alasan"
            name="alasan"
            placeholder={
              jenis === "koreksi"
                ? "Contoh: lupa clock out karena menutup pendaftaran sampai pasien terakhir."
                : "Jelaskan keperluan Anda…"
            }
            required
          />
        </div>

        <button
          type="submit"
          disabled={sedang || menyiapkanLampiran || Boolean(kurang)}
          className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800 mt-2 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white transition-colors disabled:opacity-50"
        >
          {sedang && <Loader2 size={17} className="animate-spin" />}
          Ajukan Sekarang
        </button>

        <Link
          href="/pengajuan"
          className="text-muted hover:text-body flex items-center justify-center gap-1.5 pt-1 text-sm font-semibold"
        >
          <ArrowLeft size={15} /> Batal
        </Link>
      </form>
    </div>
  );
}
