import "server-only";

import sharp from "sharp";

import { jamDetikWIB, tanggalPanjang, tanggalWIB } from "./waktu";

/**
 * Pemrosesan foto absensi di sisi server.
 *
 * Watermark sengaja dibakar di server, bukan hanya digambar di kanvas ponsel.
 * Kalau hanya klien yang menempelkannya, siapa pun yang bisa memodifikasi
 * permintaan jaringan bisa mengirim gambar dengan jam palsu. Karena itu:
 *   · jam diambil dari waktu server, bukan dari ponsel;
 *   · gambar di-encode ulang sehingga metadata EXIF asli hilang;
 *   · ukuran dan kualitas dipaksa seragam agar konsumsi storage terkendali.
 */

const LEBAR_MAKS = 720;
const TINGGI_MAKS = 960;
const KUALITAS = 72;

export type MetaWatermark = {
  waktu: Date;
  alamat: string | null;
  lat: number;
  lng: number;
  akurasiM: number | null;
  diLuarArea: boolean;
  /** Null bila tidak ada cabang yang dinilai (kepala unit tanpa cabang). */
  jarakM: number | null;
  namaLokasi: string | null;
  namaKaryawan: string;
};

function escapeXml(teks: string) {
  return teks
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Potong teks agar tidak melebihi lebar panel watermark. */
function potong(teks: string, maks: number) {
  return teks.length > maks ? `${teks.slice(0, maks - 1)}…` : teks;
}

function panelSvg(lebar: number, tinggi: number, meta: MetaWatermark) {
  const tanggal = tanggalWIB(meta.waktu);
  const barisWaktu = `${tanggalPanjang(tanggal)} · ${jamDetikWIB(meta.waktu)} WIB`;
  const barisAlamat = meta.alamat
    ? potong(meta.alamat, 46)
    : "Alamat tidak terbaca — koordinat tercatat";
  const barisKoordinat = `${meta.lat.toFixed(5)}, ${meta.lng.toFixed(5)}${
    meta.akurasiM ? ` · ±${Math.round(meta.akurasiM)} m` : ""
  }`;
  const barisArea =
    meta.namaLokasi === null || meta.jarakM === null
      ? "Kepala unit · bebas lokasi"
      : meta.diLuarArea
        ? `Di luar area · ${meta.jarakM} m dari ${potong(meta.namaLokasi, 22)}`
        : `Dalam area ${potong(meta.namaLokasi, 26)} · ${meta.jarakM} m`;

  const tinggiPanel = 132;
  const y = tinggi - tinggiPanel;
  const warnaArea = meta.diLuarArea ? "#ff9aa8" : "#7fe9c8";

  return Buffer.from(`
<svg width="${lebar}" height="${tinggi}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tirai" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#04120f" stop-opacity="0"/>
      <stop offset="0.45" stop-color="#04120f" stop-opacity="0.72"/>
      <stop offset="1" stop-color="#04120f" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${y - 40}" width="${lebar}" height="${tinggiPanel + 40}" fill="url(#tirai)"/>
  <rect x="16" y="${y + 8}" width="4" height="104" rx="2" fill="#14a07c"/>
  <text x="30" y="${y + 32}" font-family="Helvetica, Arial, sans-serif" font-size="19" font-weight="700" fill="#ffffff">${escapeXml(potong(meta.namaKaryawan, 32))}</text>
  <text x="30" y="${y + 56}" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="600" fill="#d7f5ea">${escapeXml(barisWaktu)}</text>
  <text x="30" y="${y + 78}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#bcd6cf">${escapeXml(barisAlamat)}</text>
  <text x="30" y="${y + 97}" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#9dbbb4">${escapeXml(barisKoordinat)}</text>
  <text x="30" y="${y + 116}" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="${warnaArea}">${escapeXml(barisArea)}</text>
  <text x="${lebar - 16}" y="${y + 116}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#6f8f88" letter-spacing="1">ALIAPRESENSI</text>
</svg>`);
}

/**
 * Menerima foto mentah dari kamera, mengembalikan JPEG terkompresi
 * yang sudah bercap waktu dan lokasi.
 */
export async function olahFotoAbsensi(
  mentah: Buffer,
  meta: MetaWatermark,
): Promise<Buffer> {
  const dasar = sharp(mentah, { failOn: "none" })
    .rotate() // hormati orientasi kamera sebelum EXIF dibuang
    .resize(LEBAR_MAKS, TINGGI_MAKS, { fit: "cover", position: "centre" });

  const { data, info } = await dasar
    .jpeg({ quality: KUALITAS, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return sharp(data)
    .composite([{ input: panelSvg(info.width, info.height, meta), top: 0, left: 0 }])
    .jpeg({ quality: KUALITAS, mozjpeg: true })
    .toBuffer();
}

/** Versi kecil untuk arsip jangka panjang (tiering storage, PRD §5.1). */
export async function buatThumbnail(jpeg: Buffer): Promise<Buffer> {
  return sharp(jpeg).resize(240, 320, { fit: "cover" }).jpeg({ quality: 60 }).toBuffer();
}

/** Batas ukuran unggahan yang diterima server. */
export const MAKS_UKURAN_FOTO = 6 * 1024 * 1024;

/**
 * Memastikan berkas benar-benar gambar dengan memeriksa magic bytes,
 * bukan sekadar percaya pada content-type yang dikirim klien.
 */
export function terlihatSepertiGambar(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const webp =
    buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
  return jpeg || png || webp;
}
