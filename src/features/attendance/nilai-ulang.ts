import "server-only";

import { and, eq, gte, inArray, isNotNull, lte, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  attendances,
  employees,
  holidays,
  periodLocks,
  requests,
  shiftSchedules,
  shifts,
  type AttendanceStatus,
} from "@/db/schema";
import { langkahPersetujuan } from "@/features/approval/service";
import { hariPekanWIB } from "@/lib/waktu";
import { nilaiClockIn, nilaiClockOut } from "./service";

/** Status yang bukan hasil penilaian jam, sehingga tidak pernah ditimpa di sini. */
const STATUS_TETAP: AttendanceStatus[] = ["ON_LEAVE", "ON_PERMIT", "HOLIDAY", "DAY_OFF"];

/**
 * Menyelaraskan absensi dengan shift yang berlaku pada tanggalnya.
 *
 * Terlambat, lembur, dan statusnya dihitung saat absen terjadi, memakai shift
 * yang berlaku saat itu. Admin sering baru menyusun atau membetulkan jadwal
 * jaga belakangan — karyawan tanpa shift yang sudah terlanjur absen, atau yang
 * tercatat memakai shift default padahal hari itu ia jaga siang. Dahulu hanya
 * baris tanpa shift yang dinilai ulang, sehingga karyawan yang jadwalnya
 * diganti tetap terbaca terlambat berjam-jam di rekap.
 *
 * Kini setiap baris dinilai ulang memakai shift yang berlaku sekarang (roster
 * menimpa shift default, sama persis dengan `shiftBerlaku`), dan hanya baris
 * yang hasilnya berbeda yang ditulis. Batasannya:
 *
 * - Periode yang sudah dikunci tidak disentuh — angkanya sudah dipakai
 *   membayar orang.
 * - Hari yang sekarang tidak punya shift sama sekali dibiarkan apa adanya.
 * - Menit lembur yang sudah diputuskan (pengajuan disetujui atau ditolak) dan
 *   lembur pada baris hasil koreksi tidak diubah: keputusan atas upah tidak
 *   boleh bergeser diam-diam. Pengajuan lembur yang masih menunggu ikut
 *   disesuaikan, dan dibatalkan bila lemburnya hilang.
 *
 * Seluruh jadwal dimuat sekaligus, bukan per baris, supaya rekap setahun
 * tetap cepat dibuka.
 */
export async function nilaiUlangAbsensi(filter: {
  employeeId?: string;
  mulai?: string;
  akhir?: string;
}): Promise<number> {
  const db = await getDb();

  const syarat: SQL[] = [isNotNull(attendances.clockInAt)];
  if (filter.employeeId) syarat.push(eq(attendances.employeeId, filter.employeeId));
  if (filter.mulai) syarat.push(gte(attendances.tanggal, filter.mulai));
  if (filter.akhir) syarat.push(lte(attendances.tanggal, filter.akhir));

  const daftar = await db
    .select()
    .from(attendances)
    .where(and(...syarat));
  if (daftar.length === 0) return 0;

  const tanggalAwal = daftar.reduce((a, b) => (b.tanggal < a ? b.tanggal : a), "9999");
  const tanggalAkhir = daftar.reduce((a, b) => (b.tanggal > a ? b.tanggal : a), "0000");
  const idKaryawan = [...new Set(daftar.map((b) => b.employeeId))];

  const [kunci, semuaShift, liburNasional, roster, karyawan] = await Promise.all([
    db.select({ mulai: periodLocks.mulai, akhir: periodLocks.akhir }).from(periodLocks),
    db.select().from(shifts),
    db
      .select({ tanggal: holidays.tanggal })
      .from(holidays)
      .where(
        and(gte(holidays.tanggal, tanggalAwal), lte(holidays.tanggal, tanggalAkhir)),
      ),
    db
      .select({
        employeeId: shiftSchedules.employeeId,
        tanggal: shiftSchedules.tanggal,
        shiftId: shiftSchedules.shiftId,
        libur: shiftSchedules.libur,
      })
      .from(shiftSchedules)
      .where(
        and(
          inArray(shiftSchedules.employeeId, idKaryawan),
          gte(shiftSchedules.tanggal, tanggalAwal),
          lte(shiftSchedules.tanggal, tanggalAkhir),
        ),
      ),
    db
      .select({
        id: employees.id,
        shiftId: employees.shiftId,
        departmentId: employees.departmentId,
        locationId: employees.locationId,
      })
      .from(employees)
      .where(inArray(employees.id, idKaryawan)),
  ]);

  const petaShift = new Map(semuaShift.map((s) => [s.id, s]));
  const setLibur = new Set(liburNasional.map((h) => h.tanggal));
  const petaRoster = new Map(roster.map((r) => [`${r.employeeId}|${r.tanggal}`, r]));
  const petaKaryawan = new Map(karyawan.map((k) => [k.id, k]));

  // Tahap 1: hitung hasil yang seharusnya, kumpulkan yang berbeda.
  const berubah: {
    baris: (typeof daftar)[number];
    shiftId: string;
    menitTerlambat: number;
    lemburHitung: number;
    durasiKerjaMenit: number;
    pulangCepat: boolean;
    statusMasuk: AttendanceStatus;
    flags: string[];
  }[] = [];

  for (const baris of daftar) {
    if (!baris.clockInAt || STATUS_TETAP.includes(baris.status)) continue;
    if (kunci.some((k) => baris.tanggal >= k.mulai && baris.tanggal <= k.akhir)) continue;

    const jadwal = petaRoster.get(`${baris.employeeId}|${baris.tanggal}`);
    if (jadwal?.libur) continue;
    const shiftId = jadwal?.shiftId ?? petaKaryawan.get(baris.employeeId)?.shiftId;
    const shift = shiftId ? petaShift.get(shiftId) : undefined;
    if (!shift) continue;

    const dow = hariPekanWIB(new Date(`${baris.tanggal}T05:00:00Z`));
    const libur = setLibur.has(baris.tanggal) || !shift.hariKerja.includes(dow);

    const masuk = nilaiClockIn(shift, baris.clockInAt);
    const pulang = baris.clockOutAt
      ? nilaiClockOut(shift, baris.clockInAt, baris.clockOutAt, masuk.status)
      : null;

    const flags = baris.flags.filter((f) => f !== "TANPA_SHIFT");
    if (libur && !flags.includes("HARI_LIBUR")) flags.push("HARI_LIBUR");

    const hasil = {
      baris,
      shiftId: shift.id,
      menitTerlambat: masuk.menitTerlambat,
      lemburHitung: pulang?.menitLembur ?? 0,
      durasiKerjaMenit: pulang?.durasiKerjaMenit ?? baris.durasiKerjaMenit,
      pulangCepat: pulang?.pulangCepat ?? false,
      statusMasuk: masuk.status,
      flags,
    };

    const sama =
      baris.shiftId === hasil.shiftId &&
      baris.menitTerlambat === hasil.menitTerlambat &&
      baris.durasiKerjaMenit === hasil.durasiKerjaMenit &&
      (baris.hasilKoreksi || baris.menitLembur === hasil.lemburHitung) &&
      baris.flags.length === flags.length;
    if (!sama) berubah.push(hasil);
  }

  if (berubah.length === 0) return 0;

  // Tahap 2: pengajuan lembur yang sudah ada untuk baris-baris itu.
  const pengajuanLembur = await db
    .select({ id: requests.id, status: requests.status, payload: requests.payload })
    .from(requests)
    .where(
      and(
        eq(requests.tipe, "OVERTIME"),
        inArray(
          sql<string>`${requests.payload}->>'attendanceId'`,
          berubah.map((b) => b.baris.id),
        ),
      ),
    );
  const petaPengajuan = new Map(
    pengajuanLembur.map((p) => [String(p.payload.attendanceId), p] as const),
  );

  // Tahap 3: tulis.
  for (const h of berubah) {
    const { baris } = h;
    const pengajuan = petaPengajuan.get(baris.id);
    const sudahDiputuskan =
      pengajuan?.status === "APPROVED" || pengajuan?.status === "REJECTED";

    const menitLembur =
      baris.hasilKoreksi || sudahDiputuskan ? baris.menitLembur : h.lemburHitung;

    let status: AttendanceStatus = h.statusMasuk;
    if (menitLembur > 0) status = "OVERTIME";
    else if (h.pulangCepat) status = "EARLY_LEAVE";

    await db
      .update(attendances)
      .set({
        shiftId: h.shiftId,
        status,
        menitTerlambat: h.menitTerlambat,
        menitLembur,
        durasiKerjaMenit: h.durasiKerjaMenit,
        flags: h.flags,
        updatedAt: new Date(),
      })
      .where(eq(attendances.id, baris.id));

    if (baris.hasilKoreksi || sudahDiputuskan) continue;

    if (pengajuan?.status === "PENDING") {
      if (menitLembur > 0) {
        await db
          .update(requests)
          .set({ payload: { ...pengajuan.payload, menitLembur } })
          .where(eq(requests.id, pengajuan.id));
      } else {
        await db
          .update(requests)
          .set({ status: "CANCELLED", selesaiAt: new Date() })
          .where(eq(requests.id, pengajuan.id));
      }
    } else if (!pengajuan || pengajuan.status === "CANCELLED") {
      if (menitLembur > 0) {
        const k = petaKaryawan.get(baris.employeeId);
        await db.insert(requests).values({
          employeeId: baris.employeeId,
          tipe: "OVERTIME",
          status: "PENDING",
          totalStep: await langkahPersetujuan("OVERTIME", {
            departmentId: k?.departmentId ?? null,
            locationId: k?.locationId ?? null,
          }),
          alasan: (baris.catatanKerja ?? "Lembur dari penilaian ulang shift").slice(
            0,
            300,
          ),
          payload: { attendanceId: baris.id, tanggal: baris.tanggal, menitLembur },
        });
      }
    }
  }

  return berubah.length;
}
