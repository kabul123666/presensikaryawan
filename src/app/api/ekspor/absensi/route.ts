import { NextResponse } from "next/server";

import { rekapPeriodeAtauKunci } from "@/features/reports/kunci";
import { rentangPeriode, totalRekap } from "@/features/reports/service";
import { bacaPengaturan } from "@/features/settings/service";
import { lingkupData, PERAN_PENYETUJU, wajibPeran } from "@/lib/auth/session";
import { formatDurasi } from "@/lib/utils";
import { namaBulan, tanggalWIB } from "@/lib/waktu";

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
  const lingkup = lingkupData(pengguna);
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
  const { baris } = await rekapPeriodeAtauKunci({ ...rentang, departmentId });
  const total = totalRekap(baris);

  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = profil.nama || "Presensi Karyawan";
  wb.created = new Date();

  const ws = wb.addWorksheet(`Rekap ${namaBulan(tahun, bulan)}`, {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  // --- Kop laporan
  ws.mergeCells("A1:N1");
  ws.getCell("A1").value = profil.nama
    ? `REKAP ABSENSI KARYAWAN — ${profil.nama.toUpperCase()}`
    : "REKAP ABSENSI KARYAWAN";
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center" };

  ws.mergeCells("A2:N2");
  ws.getCell("A2").value = `Periode ${namaBulan(tahun, bulan)}`;
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
    "Total Telat",
    "Lembur",
    "Total Lembur",
    "Cuti",
    "Alpa",
    "Jam Kerja",
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
      formatDurasi(b.menitTerlambat),
      b.lembur,
      formatDurasi(b.menitLembur),
      b.cuti,
      b.alpa,
      formatDurasi(b.menitKerja),
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
    formatDurasi(total.menitTerlambat),
    "",
    formatDurasi(total.menitLembur),
    total.cuti,
    total.alpa,
    formatDurasi(total.menitKerja),
    total.totalFee,
  ]);
  barisTotal.font = { bold: true };
  barisTotal.eachCell((sel) => {
    sel.border = { top: { style: "double" } };
  });

  // Kolom fee ditulis sebagai angka dengan format rupiah agar bisa dijumlah
  // ulang di Excel tanpa perlu membersihkan teks.
  ws.getColumn(15).numFmt = '"Rp"#,##0';

  const lebar = [5, 12, 26, 20, 18, 8, 12, 10, 12, 9, 13, 7, 7, 12, 16];
  lebar.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  ws.addRow([]);
  const catatan = ws.addRow([
    `Diunduh ${tanggalWIB()}. Angka mengikuti data absensi pada saat pengunduhan.`,
  ]);
  catatan.font = { italic: true, size: 9, color: { argb: "FF6D7F7B" } };

  const buffer = await wb.xlsx.writeBuffer();
  const namaBerkas = `Rekap-Absensi-${tahun}-${String(bulan).padStart(2, "0")}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${namaBerkas}"`,
      "Cache-Control": "no-store",
    },
  });
}
