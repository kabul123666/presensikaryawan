import { NextResponse } from "next/server";

import { kunciPeriode, rekapPeriodeAtauKunci } from "@/features/reports/kunci";
import {
  rentangPeriode,
  rincianFeePeriode,
  totalRekap,
} from "@/features/reports/service";
import { bacaPengaturan } from "@/features/settings/service";
import { lingkupData, PERAN_PENYETUJU, wajibPeran } from "@/lib/auth/session";
import { namaBulan, tanggalPendek, tanggalWIB } from "@/lib/waktu";

/**
 * Mengunduh rekap absensi sebagai berkas Excel.
 *
 * Angka yang ditulis di sini berasal dari fungsi rekap yang sama dengan yang
 * dipakai layar — sehingga isi berkas tidak pernah berbeda dari yang dilihat
 * admin sebelum menekan tombol unduh.
 */
export async function GET(request: Request) {
  const pengguna = await wajibPeran(...PERAN_PENYETUJU);

  const url = new URL(request.url);
  const kini = tanggalWIB();
  const tahun = Number(url.searchParams.get("tahun") ?? kini.slice(0, 4));
  const bulan = Number(url.searchParams.get("bulan") ?? kini.slice(5, 7));

  // Berkas unduhan menempuh jalur terpisah dari layar, jadi batas departemen
  // manager harus ditegakkan lagi di sini — bukan diwarisi dari halaman.
  const lingkup = await lingkupData(pengguna);
  const departmentId = lingkup.semua
    ? (url.searchParams.get("dept") ?? undefined)
    : (lingkup.departmentId ?? undefined);

  if (!lingkup.semua && !lingkup.departmentId) {
    return NextResponse.json(
      { pesan: "Departemen Anda belum ditetapkan." },
      { status: 403 },
    );
  }

  if (!Number.isInteger(tahun) || !Number.isInteger(bulan) || bulan < 1 || bulan > 12) {
    return NextResponse.json({ pesan: "Periode tidak valid" }, { status: 400 });
  }

  const profil = await bacaPengaturan("profil_perusahaan");
  const rentang = await rentangPeriode(tahun, bulan);
  const { baris } = await rekapPeriodeAtauKunci({
    ...rentang,
    departmentId,
    locationIds: lingkup.locationIds ?? undefined,
  });
  const total = totalRekap(baris);
  const [rincianFee, kunci] = await Promise.all([
    rincianFeePeriode({
      ...rentang,
      departmentId,
      locationIds: lingkup.locationIds ?? undefined,
    }),
    kunciPeriode(rentang.mulai, rentang.akhir),
  ]);

  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = profil.nama || "Presensi Karyawan";
  wb.created = new Date();

  const ws = wb.addWorksheet("Rekap", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  // --- Kop laporan
  ws.mergeCells("A1:P1");
  ws.getCell("A1").value = profil.nama
    ? `REKAP ABSENSI KARYAWAN — ${profil.nama.toUpperCase()}`
    : "REKAP ABSENSI KARYAWAN";
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center" };

  ws.mergeCells("A2:P2");
  ws.getCell("A2").value =
    `Periode ${namaBulan(tahun, bulan)} · ${tanggalPendek(rentang.mulai)} – ${tanggalPendek(rentang.akhir)}` +
    (kunci ? " · TERKUNCI" : "");
  ws.getCell("A2").alignment = { horizontal: "center" };

  const judul = [
    "No",
    "NIK",
    "Nama",
    "Jabatan",
    "Departemen",
    "Hadir",
    "Tepat Waktu",
    "Terlambat",
    "Total Telat (menit)",
    "Lembur",
    "Total Lembur (menit)",
    "Cuti",
    "Izin",
    "Alpa",
    "Jam Kerja (jam)",
    "Fee Tindakan",
  ];

  ws.getRow(4).values = judul;
  ws.getRow(4).font = { bold: true };
  ws.getRow(4).alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(4).eachCell((sel) => {
    sel.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0B8065" },
    };
    sel.font = { bold: true, color: { argb: "FFFFFFFF" } };
    sel.border = { bottom: { style: "thin" } };
  });

  baris.forEach((b, i) => {
    ws.addRow([
      i + 1,
      b.nik ?? "-",
      b.nama,
      b.jabatan ?? "-",
      b.departemen ?? "-",
      b.hadir,
      b.tepatWaktu,
      b.terlambat,
      b.menitTerlambat,
      b.lembur,
      b.menitLembur,
      b.cuti,
      b.izin,
      b.alpa,
      Number((b.menitKerja / 60).toFixed(2)),
      b.totalFee,
    ]);
  });

  // --- Baris total
  const barisTotal = ws.addRow([
    "",
    "",
    "TOTAL",
    "",
    "",
    total.hadir,
    "",
    total.terlambat,
    total.menitTerlambat,
    "",
    total.menitLembur,
    total.cuti,
    total.izin,
    total.alpa,
    Number((total.menitKerja / 60).toFixed(2)),
    total.totalFee,
  ]);
  barisTotal.font = { bold: true };
  barisTotal.eachCell((sel) => {
    sel.border = { top: { style: "double" } };
  });

  // Kolom fee ditulis sebagai angka dengan format rupiah agar bisa dijumlah
  // ulang di Excel tanpa perlu membersihkan teks.
  ws.getColumn(15).numFmt = "0.00";
  ws.getColumn(16).numFmt = '"Rp"#,##0';

  const lebar = [5, 12, 26, 20, 18, 8, 12, 10, 12, 9, 13, 7, 7, 7, 12, 16];
  lebar.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  ws.addRow([]);
  const catatan = ws.addRow([
    kunci
      ? `Diunduh ${tanggalWIB()}. Periode ini sudah dikunci, sehingga angkanya tidak akan berubah lagi.`
      : `Diunduh ${tanggalWIB()}. Periode ini belum dikunci — angkanya masih bisa berubah bila ada koreksi absen yang disetujui.`,
  ]);
  catatan.font = { italic: true, size: 9, color: { argb: "FF6D7F7B" } };

  /*
   * Lembar kedua: rincian tiap tindakan ber-fee.
   *
   * Rekap hanya memuat satu jumlah fee per orang. Tanpa rinciannya, bagian
   * keuangan tidak punya cara memeriksa dari mana jumlah itu datang selain
   * membuka layar satu per satu — dan itulah pekerjaan manual yang berkas ini
   * seharusnya menghapus.
   */
  const wsFee = wb.addWorksheet("Rincian Tindakan", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  wsFee.getRow(1).values = [
    "Tanggal",
    "NIK",
    "Nama",
    "Tindakan",
    "Kode Pasien",
    "Jumlah",
    "Fee Satuan",
    "Total",
    "Status",
  ];
  wsFee.getRow(1).eachCell((sel) => {
    sel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B8065" } };
    sel.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });

  for (const r of rincianFee) {
    wsFee.addRow([
      r.tanggal,
      r.nik ?? "-",
      r.nama,
      r.tindakan,
      r.kodePasien ?? "-",
      r.jumlah,
      r.fee,
      r.fee * r.jumlah,
      r.status === "VERIFIED" ? "Terverifikasi" : "Menunggu",
    ]);
  }

  wsFee.getColumn(7).numFmt = '"Rp"#,##0';
  wsFee.getColumn(8).numFmt = '"Rp"#,##0';
  [12, 12, 26, 30, 14, 8, 14, 14, 14].forEach((w, i) => {
    wsFee.getColumn(i + 1).width = w;
  });

  if (rincianFee.length === 0) {
    wsFee.addRow(["Tidak ada tindakan ber-fee pada periode ini."]);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const namaBerkas = `Rekap-Absensi-Fee-${tahun}-${String(bulan).padStart(2, "0")}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${namaBerkas}"`,
      "Cache-Control": "no-store",
    },
  });
}
