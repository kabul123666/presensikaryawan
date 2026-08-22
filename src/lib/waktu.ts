/**
 * Seluruh perhitungan waktu operasional memakai zona WIB (Asia/Jakarta),
 * sementara database menyimpan UTC. Semua konversi dikumpulkan di sini agar
 * tidak ada komponen yang menghitung zona waktu sendiri-sendiri.
 */

export const ZONA = "Asia/Jakarta";

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;

/** Singkatan tiga huruf — dipakai sebagai kepala kolom kalender. */
const HARI_PENDEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;

const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

/** Pecah sebuah Date menjadi komponen tanggal/jam menurut zona WIB. */
function bagianWIB(waktu: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const bagian = Object.fromEntries(
    fmt.formatToParts(waktu).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  return {
    tahun: Number(bagian.year),
    bulan: Number(bagian.month),
    hari: Number(bagian.day),
    jam: Number(bagian.hour === "24" ? "0" : bagian.hour),
    menit: Number(bagian.minute),
    detik: Number(bagian.second),
  };
}

/** Tanggal WIB dalam format YYYY-MM-DD — dipakai sebagai kunci baris absensi. */
export function tanggalWIB(waktu: Date = new Date()): string {
  const b = bagianWIB(waktu);
  return `${b.tahun}-${String(b.bulan).padStart(2, "0")}-${String(b.hari).padStart(2, "0")}`;
}

/** Jam WIB dalam format HH:mm. */
export function jamWIB(waktu: Date): string {
  const b = bagianWIB(waktu);
  return `${String(b.jam).padStart(2, "0")}:${String(b.menit).padStart(2, "0")}`;
}

/** Jam WIB lengkap dengan detik. */
export function jamDetikWIB(waktu: Date): string {
  const b = bagianWIB(waktu);
  return `${String(b.jam).padStart(2, "0")}:${String(b.menit).padStart(2, "0")}:${String(b.detik).padStart(2, "0")}`;
}

/** Menit sejak tengah malam WIB. */
export function menitHariWIB(waktu: Date): number {
  const b = bagianWIB(waktu);
  return b.jam * 60 + b.menit;
}

/** Indeks hari dalam pekan menurut WIB: 0 = Minggu … 6 = Sabtu. */
export function hariPekanWIB(waktu: Date = new Date()): number {
  const [y, m, d] = tanggalWIB(waktu).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Ubah "08:30" atau "08:30:00" menjadi menit sejak tengah malam. */
export function jamKeMenit(jam: string): number {
  const [j, m] = jam.split(":").map(Number);
  return (j || 0) * 60 + (m || 0);
}

/** Kebalikan dari jamKeMenit: 510 -> "08:30". */
export function menitKeJam(menit: number): string {
  const total = ((menit % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "2026-08-14" -> "Jumat, 14 Agustus 2026" */
export function tanggalPanjang(tanggal: string): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  const hari = HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${hari}, ${d} ${BULAN[m - 1]} ${y}`;
}

/** "2026-08-14" -> "14 Agu 2026" */
export function tanggalPendek(tanggal: string): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  return `${d} ${BULAN[m - 1].slice(0, 3)} ${y}`;
}

/** Nama bulan beserta tahunnya, mis. "Agustus 2026". */
export function namaBulan(tahun: number, bulan: number): string {
  return `${BULAN[bulan - 1]} ${tahun}`;
}

/**
 * Susun sebuah Date dari tanggal dan jam WIB.
 * Dipakai saat admin memasukkan jam koreksi absen: yang diketik adalah waktu
 * WIB, sedangkan yang disimpan tetap UTC.
 */
export function waktuWIB(tanggal: string, jam: string): Date {
  const [y, m, d] = tanggal.split("-").map(Number);
  const [jj, mm] = jam.split(":").map(Number);
  // WIB = UTC+7, tanpa daylight saving sehingga selisihnya tetap.
  return new Date(Date.UTC(y, m - 1, d, (jj || 0) - 7, mm || 0, 0));
}

/** Tambah/kurangi hari pada tanggal berformat YYYY-MM-DD. */
export function geserTanggal(tanggal: string, hari: number): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + hari));
  return dt.toISOString().slice(0, 10);
}

/** Selisih hari antara dua tanggal YYYY-MM-DD (b - a). */
export function selisihHari(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Daftar tanggal dari a sampai b (inklusif). */
export function rentangTanggal(a: string, b: string): string[] {
  const hasil: string[] = [];
  for (let i = 0; i <= selisihHari(a, b); i++) hasil.push(geserTanggal(a, i));
  return hasil;
}

/**
 * Rentang tanggal sebuah periode rekap.
 *
 * `hariMulai` adalah tanggal siklus potong gaji, 1–28. Satu berarti periode
 * sama dengan bulan kalender. Nilai lain menggeser periodenya mundur:
 * periode "Agustus" dengan hariMulai 26 berjalan dari 26 Juli sampai 25
 * Agustus, sehingga bulan yang tertulis di rekap adalah bulan gajinya
 * dibayarkan — bukan bulan sebagian besar harinya jatuh.
 *
 * Dibatasi 28 supaya tidak ada periode yang hilang di Februari.
 */
export function periodeRekap(tahun: number, bulan: number, hariMulai = 1) {
  const hari = Math.min(28, Math.max(1, Math.trunc(hariMulai) || 1));
  if (hari === 1) return batasBulan(tahun, bulan);

  const dd = String(hari).padStart(2, "0");
  const sebelum = bulan === 1 ? { t: tahun - 1, b: 12 } : { t: tahun, b: bulan - 1 };

  return {
    mulai: `${sebelum.t}-${String(sebelum.b).padStart(2, "0")}-${dd}`,
    akhir: geserTanggal(`${tahun}-${String(bulan).padStart(2, "0")}-${dd}`, -1),
  };
}

/** Tanggal pertama dan terakhir suatu bulan. */
export function batasBulan(tahun: number, bulan: number) {
  const mulai = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
  const akhirHari = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
  return { mulai, akhir: `${tahun}-${String(bulan).padStart(2, "0")}-${akhirHari}` };
}

export { HARI, HARI_PENDEK, BULAN };
