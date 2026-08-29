import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { departments, employees, positions, users } from "@/db/schema";
import { kunciPeriode, rekapPeriodeAtauKunci } from "@/features/reports/kunci";
import {
  rentangPeriode,
  rincianFeePeriode,
  rincianHarianLengkap,
} from "@/features/reports/service";
import { bacaPengaturan } from "@/features/settings/service";
import { bolehLihatKaryawan, wajibAksesMenu } from "@/lib/auth/akses";
import { formatDurasi } from "@/lib/utils";
import { HARI, jamWIB, namaBulan, tanggalPendek, tanggalWIB } from "@/lib/waktu";

/**
 * Rincian absensi satu karyawan sebagai berkas Excel.
 *
 * Berbeda dari rekap seluruh karyawan yang memuat satu baris per orang, berkas
 * ini memuat satu baris per tanggal — termasuk tanggal yang kosong. Justru hari
 * kosong itu yang paling perlu terlihat saat menghitung gaji: tanpa dibariskan,
 * pembaca tidak bisa membedakan hari libur dari hari yang ditinggalkan begitu
 * saja, dan harus membuka layar satu per satu untuk memastikannya.
 */

const HIJAU = "FF0B8065";
const ABU = "FF6D7F7B";

/** Nama berkas tidak boleh membawa karakter yang ditolak sistem berkas. */
function namaAman(teks: string) {
  return teks.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "Karyawan";
}

function hariDari(tanggal: string) {
  const [y, m, d] = tanggal.split("-").map(Number);
  return HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export async function GET(request: Request) {
  const pengguna = await wajibAksesMenu("absensi");

  const url = new URL(request.url);
  const employeeId = url.searchParams.get("karyawan") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(employeeId)) {
    return NextResponse.json({ pesan: "Karyawan tidak dikenali" }, { status: 400 });
  }

  const kini = tanggalWIB();
  const tahun = Number(url.searchParams.get("tahun") ?? kini.slice(0, 4));
  const bulan = Number(url.searchParams.get("bulan") ?? kini.slice(5, 7));
  if (!Number.isInteger(tahun) || !Number.isInteger(bulan) || bulan < 1 || bulan > 12) {
    return NextResponse.json({ pesan: "Periode tidak valid" }, { status: 400 });
  }

  const db = await getDb();
  const [karyawan] = await db
    .select({
      nama: employees.nama,
      nik: users.nik,
      jabatan: positions.nama,
      departemen: departments.nama,
      departmentId: employees.departmentId,
      locationId: employees.locationId,
    })
    .from(employees)
    .innerJoin(users, eq(users.id, employees.userId))
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!karyawan) {
    return NextResponse.json({ pesan: "Karyawan tidak ditemukan" }, { status: 404 });
  }

  // Berkas unduhan menempuh jalur sendiri, jadi batas departemen dan cabang
  // ditegakkan lagi di sini — bukan diwarisi dari halaman yang memuat tombolnya.
  if (!(await bolehLihatKaryawan(pengguna, karyawan))) {
    return NextResponse.json({ pesan: "Tidak berwenang" }, { status: 403 });
  }

  const profil = await bacaPengaturan("profil_perusahaan");
  const rentang = await rentangPeriode(tahun, bulan);

  const [harian, hasilRekap, fee, kunci] = await Promise.all([
    rincianHarianLengkap(employeeId, rentang.mulai, rentang.akhir),
    rekapPeriodeAtauKunci({ ...rentang, employeeId }),
    rincianFeePeriode({ ...rentang, employeeId }),
    kunciPeriode(rentang.mulai, rentang.akhir),
  ]);
  const ringkas = hasilRekap.baris[0] ?? null;

  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = profil.nama || "Presensi Karyawan";
  wb.created = new Date();

  /* ---------------------------------------------------- Lembar rincian harian */

  const ws = wb.addWorksheet("Rincian Harian", {
    views: [{ state: "frozen", ySplit: 9 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  const kop = (baris: number, teks: string, tebal: boolean, ukuran: number) => {
    ws.mergeCells(`A${baris}:M${baris}`);
    const sel = ws.getCell(`A${baris}`);
    sel.value = teks;
    sel.font = { bold: tebal, size: ukuran };
    sel.alignment = { horizontal: "center" };
  };

  kop(
    1,
    profil.nama
      ? `RINCIAN ABSENSI — ${profil.nama.toUpperCase()}`
      : "RINCIAN ABSENSI KARYAWAN",
    true,
    14,
  );
  kop(
    2,
    [karyawan.nama, karyawan.nik, karyawan.jabatan, karyawan.departemen]
      .filter(Boolean)
      .join(" · "),
    true,
    11,
  );
  kop(
    3,
    `Periode ${namaBulan(tahun, bulan)} · ${tanggalPendek(rentang.mulai)} – ${tanggalPendek(rentang.akhir)}` +
      (kunci ? " · TERKUNCI" : ""),
    false,
    10,
  );

  // --- Ringkasan periode, angkanya dari rekap yang sama dengan layar.
  const ringkasan: [string, string | number][] = [
    ["Hadir", ringkas?.hadir ?? 0],
    ["Tepat waktu", ringkas?.tepatWaktu ?? 0],
    ["Terlambat", ringkas?.terlambat ?? 0],
    ["Total telat", formatDurasi(ringkas?.menitTerlambat ?? 0)],
    ["Lembur", formatDurasi(ringkas?.menitLembur ?? 0)],
    ["Cuti", ringkas?.cuti ?? 0],
    ["Izin", ringkas?.izin ?? 0],
    ["Alpa", ringkas?.alpa ?? 0],
    ["Jam kerja", formatDurasi(ringkas?.menitKerja ?? 0)],
    ["Fee tindakan", ringkas?.totalFee ?? 0],
  ];

  ws.getRow(5).values = ringkasan.map(([label]) => label);
  ws.getRow(5).eachCell((sel) => {
    sel.font = { bold: true, size: 9, color: { argb: ABU } };
    sel.alignment = { horizontal: "center" };
  });
  ws.getRow(6).values = ringkasan.map(([, nilai]) => nilai);
  ws.getRow(6).eachCell((sel) => {
    sel.font = { bold: true, size: 11 };
    sel.alignment = { horizontal: "center" };
    sel.border = { bottom: { style: "thin", color: { argb: ABU } } };
  });
  ws.getCell("J6").numFmt = '"Rp"#,##0';

  // --- Tabel harian
  const judul = [
    "Tanggal",
    "Hari",
    "Shift",
    "Status",
    "Masuk",
    "Pulang",
    "Jam Kerja (jam)",
    "Telat (menit)",
    "Lembur (menit)",
    "Lokasi Absen",
    "Jarak (m)",
    "Catatan Pekerjaan",
    "Keterangan",
  ];

  ws.getRow(9).values = judul;
  ws.getRow(9).eachCell((sel) => {
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HIJAU } };
    sel.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    sel.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    sel.border = { bottom: { style: "thin" } };
  });
  ws.getRow(9).height = 28;

  for (const h of harian) {
    const baris = ws.addRow([
      h.tanggal,
      hariDari(h.tanggal),
      h.shift ?? "—",
      h.status,
      h.clockInAt ? jamWIB(h.clockInAt) : "—",
      h.clockOutAt ? jamWIB(h.clockOutAt) : "—",
      h.durasiKerjaMenit > 0 ? Number((h.durasiKerjaMenit / 60).toFixed(2)) : 0,
      h.menitTerlambat,
      h.menitLembur,
      h.alamat ?? "—",
      h.jarakM ?? "—",
      h.catatanKerja ?? "—",
      [h.keterangan, h.hasilKoreksi ? "Hasil koreksi" : null, ...h.penanda]
        .filter(Boolean)
        .join(" · ") || "—",
    ]);

    baris.eachCell((sel) => {
      sel.border = { bottom: { style: "hair", color: { argb: "FFD8E0DE" } } };
      sel.alignment = { vertical: "top", wrapText: false };
    });
    baris.getCell(1).alignment = { horizontal: "left" };
    for (const kolom of [5, 6, 7, 8, 9, 11]) {
      baris.getCell(kolom).alignment = { horizontal: "center" };
    }

    // Hari yang ditinggalkan harus langsung terlihat; hari libur justru harus
    // mundur ke belakang supaya tidak ikut menarik perhatian pembaca.
    if (h.alpa) baris.font = { color: { argb: "FFB3261E" }, bold: true };
    else if (h.libur) baris.font = { color: { argb: ABU }, italic: true };
  }

  const total = ws.addRow([
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    Number(((ringkas?.menitKerja ?? 0) / 60).toFixed(2)),
    ringkas?.menitTerlambat ?? 0,
    ringkas?.menitLembur ?? 0,
    "",
    "",
    "",
    "",
  ]);
  total.font = { bold: true };
  total.eachCell((sel) => {
    sel.border = { top: { style: "double" } };
  });
  for (const kolom of [7, 8, 9]) {
    total.getCell(kolom).alignment = { horizontal: "center" };
  }

  ws.getColumn(7).numFmt = "0.00";

  const lebar = [12, 9, 16, 14, 8, 8, 14, 13, 15, 42, 10, 44, 30];
  lebar.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  ws.addRow([]);
  const catatan = ws.addRow([
    kunci
      ? `Diunduh ${tanggalWIB()}. Periode ini sudah dikunci, sehingga angkanya tidak akan berubah lagi.`
      : `Diunduh ${tanggalWIB()}. Periode ini belum dikunci — angkanya masih bisa berubah bila ada koreksi absen yang disetujui.`,
  ]);
  catatan.font = { italic: true, size: 9, color: { argb: ABU } };

  /* ------------------------------------------------------ Lembar tindakan fee */

  const wsFee = wb.addWorksheet("Tindakan & Fee", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  wsFee.getRow(1).values = [
    "Tanggal",
    "Tindakan",
    "Kode Pasien",
    "Jumlah",
    "Fee Satuan",
    "Total",
    "Status",
  ];
  wsFee.getRow(1).eachCell((sel) => {
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HIJAU } };
    sel.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });

  for (const f of fee) {
    wsFee.addRow([
      f.tanggal,
      f.tindakan,
      f.kodePasien ?? "—",
      f.jumlah,
      f.fee,
      f.fee * f.jumlah,
      f.status === "VERIFIED" ? "Terverifikasi" : "Menunggu",
    ]);
  }

  if (fee.length === 0) {
    wsFee.addRow(["Tidak ada tindakan ber-fee pada periode ini."]);
  } else {
    const totalFee = wsFee.addRow([
      "TOTAL",
      "",
      "",
      fee.reduce((t, f) => t + f.jumlah, 0),
      "",
      fee.reduce((t, f) => t + f.fee * f.jumlah, 0),
      "",
    ]);
    totalFee.font = { bold: true };
    totalFee.eachCell((sel) => {
      sel.border = { top: { style: "double" } };
    });
  }

  wsFee.getColumn(5).numFmt = '"Rp"#,##0';
  wsFee.getColumn(6).numFmt = '"Rp"#,##0';
  [12, 34, 16, 9, 15, 16, 15].forEach((w, i) => {
    wsFee.getColumn(i + 1).width = w;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const berkas = `Absensi-${namaAman(karyawan.nama)}-${tahun}-${String(bulan).padStart(2, "0")}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${berkas}"`,
      "Cache-Control": "no-store",
    },
  });
}
