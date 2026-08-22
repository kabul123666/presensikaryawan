import type { RequestType } from "@/db/schema";
import { formatDurasi } from "@/lib/utils";
import { tanggalPendek } from "@/lib/waktu";

/**
 * Satu tempat membaca isi payload pengajuan.
 *
 * Rincian tiap jenis disimpan sebagai JSON dengan kunci yang berbeda-beda —
 * cuti memakai `mulai`/`akhir`, lembur memakai `tanggal`/`menitLembur`,
 * koreksi memakai `jamMasuk`/`jamPulang`. Sebelumnya layar admin dan layar
 * karyawan menebak kunci itu sendiri-sendiri, dan tebakan di sisi karyawan
 * meleset: pengajuan cuti tampil tanpa tanggal sama sekali sementara admin
 * melihatnya lengkap. Keduanya kini membaca dari berkas ini, sehingga apa
 * yang dilihat karyawan selalu sama dengan yang dilihat penyetuju.
 */

export const LABEL_TIPE: Record<RequestType, string> = {
  LEAVE: "Cuti",
  OVERTIME: "Lembur",
  BACKDATE: "Koreksi Absen",
  PERMIT: "Izin / Sakit",
  OUTSIDE_AREA: "Absen di Luar Area",
  DEVICE_CHANGE: "Ganti Perangkat",
};

export type BarisRincian = { label: string; nilai: string };

function teks(p: Record<string, unknown>, k: string) {
  return typeof p[k] === "string" ? (p[k] as string) : null;
}

function angka(p: Record<string, unknown>, k: string) {
  return p[k] === undefined || p[k] === null ? null : Number(p[k]);
}

/** Rentang tanggal yang menyusut jadi satu tanggal bila mulai dan akhir sama. */
function rentang(mulai: string, akhir: string | null) {
  return akhir && akhir !== mulai
    ? `${tanggalPendek(mulai)} – ${tanggalPendek(akhir)}`
    : tanggalPendek(mulai);
}

/**
 * Rincian pengajuan sebagai pasangan label dan nilai.
 *
 * `namaJenisCuti` hanya cadangan: nama jenis cuti sudah ikut disimpan di
 * payload saat pengajuan dibuat, supaya kartu lama tetap terbaca meski jenis
 * cutinya kemudian diganti namanya oleh admin.
 */
export function rincianPengajuan(
  tipe: RequestType,
  payload: Record<string, unknown> | null | undefined,
  namaJenisCuti?: Record<string, string>,
): BarisRincian[] {
  const p = payload ?? {};
  const baris: BarisRincian[] = [];

  switch (tipe) {
    case "LEAVE":
    case "PERMIT": {
      const jenisId = teks(p, "leaveTypeId");
      const nama =
        teks(p, "namaJenis") ?? (jenisId ? namaJenisCuti?.[jenisId] : null) ?? null;
      const mulai = teks(p, "mulai");
      const akhir = teks(p, "akhir");
      const hari = angka(p, "jumlahHari");

      if (nama) baris.push({ label: "Jenis", nilai: nama });
      if (mulai) baris.push({ label: "Tanggal", nilai: rentang(mulai, akhir) });
      if (hari) baris.push({ label: "Lama", nilai: `${hari} hari` });
      break;
    }

    case "OVERTIME": {
      const tanggal = teks(p, "tanggal");
      const mulai = teks(p, "jamMulai");
      const selesai = teks(p, "jamSelesai");
      const menit = angka(p, "menitLembur");

      if (tanggal) baris.push({ label: "Tanggal", nilai: tanggalPendek(tanggal) });
      if (mulai && selesai) baris.push({ label: "Jam", nilai: `${mulai} – ${selesai}` });
      if (menit) baris.push({ label: "Durasi", nilai: formatDurasi(menit) });
      break;
    }

    case "BACKDATE": {
      const tanggal = teks(p, "tanggal");
      const masuk = teks(p, "jamMasuk");
      const pulang = teks(p, "jamPulang");

      if (tanggal) baris.push({ label: "Tanggal", nilai: tanggalPendek(tanggal) });
      baris.push({
        label: "Jam diminta",
        nilai: `${masuk ?? "--:--"} → ${pulang ?? "--:--"}`,
      });
      break;
    }

    case "OUTSIDE_AREA": {
      const tanggal = teks(p, "tanggal");
      const jarak = angka(p, "jarakM");

      if (tanggal) baris.push({ label: "Tanggal", nilai: tanggalPendek(tanggal) });
      baris.push({
        label: "Saat",
        nilai: teks(p, "jenis") === "PULANG" ? "Absen pulang" : "Absen masuk",
      });
      if (jarak) baris.push({ label: "Jarak", nilai: `${jarak} m dari kantor` });
      break;
    }

    case "DEVICE_CHANGE":
      baris.push({
        label: "Permintaan",
        nilai: "Mengikat perangkat baru ke akun",
      });
      break;
  }

  return baris;
}

/** Rincian yang sama, dipadatkan jadi satu baris untuk tabel penyetuju. */
export function ringkasPengajuan(
  tipe: RequestType,
  payload: Record<string, unknown> | null | undefined,
  namaJenisCuti?: Record<string, string>,
): string {
  const baris = rincianPengajuan(tipe, payload, namaJenisCuti);
  if (baris.length === 0) return "—";
  return baris.map((b) => b.nilai).join(" · ");
}
