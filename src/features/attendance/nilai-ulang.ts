import "server-only";

import { and, eq, gte, isNotNull, isNull, lte, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import { attendances, employees, periodLocks, requests } from "@/db/schema";
import { langkahPersetujuan } from "@/features/approval/service";
import { nilaiClockIn, nilaiClockOut, shiftBerlaku } from "./service";

/**
 * Menilai ulang absensi yang tercatat tanpa shift.
 *
 * Karyawan yang belum dijadwalkan tetap boleh absen, dan kehadirannya dicatat
 * apa adanya: tanpa terlambat, tanpa lembur. Begitu admin menetapkan shiftnya
 * — lewat jadwal jaga atau shift default karyawan — hari-hari itu harus ikut
 * dinilai memakai shift tersebut, persis seperti bila shiftnya sudah ada saat
 * absen terjadi. Sebelumnya baris lama dibiarkan tanpa shift selamanya.
 *
 * Hanya baris yang belum punya shift yang disentuh; absensi yang sejak awal
 * dinilai dengan shift tidak pernah diubah di sini. Periode yang sudah dikunci
 * juga dilewati karena angkanya sudah dipakai membayar orang.
 *
 * Lembur yang muncul dari penilaian ulang diajukan untuk persetujuan, sama
 * seperti lembur yang tercatat saat absen pulang.
 */
export async function nilaiUlangAbsensiTanpaShift(filter: {
  employeeId?: string;
  mulai?: string;
  akhir?: string;
}): Promise<number> {
  const db = await getDb();

  const syarat: SQL[] = [isNull(attendances.shiftId), isNotNull(attendances.clockInAt)];
  if (filter.employeeId) syarat.push(eq(attendances.employeeId, filter.employeeId));
  if (filter.mulai) syarat.push(gte(attendances.tanggal, filter.mulai));
  if (filter.akhir) syarat.push(lte(attendances.tanggal, filter.akhir));

  const daftar = await db
    .select()
    .from(attendances)
    .where(and(...syarat));
  if (daftar.length === 0) return 0;

  const kunci = await db
    .select({ mulai: periodLocks.mulai, akhir: periodLocks.akhir })
    .from(periodLocks);

  let dinilai = 0;

  for (const baris of daftar) {
    if (!baris.clockInAt) continue;
    if (kunci.some((k) => baris.tanggal >= k.mulai && baris.tanggal <= k.akhir)) continue;

    const { shift, libur } = await shiftBerlaku(baris.employeeId, baris.tanggal);
    if (!shift) continue;

    const masuk = nilaiClockIn(shift, baris.clockInAt);
    const pulang = baris.clockOutAt
      ? nilaiClockOut(shift, baris.clockInAt, baris.clockOutAt, masuk.status)
      : null;

    const flags = baris.flags.filter((f) => f !== "TANPA_SHIFT");
    if (libur && !flags.includes("HARI_LIBUR")) flags.push("HARI_LIBUR");

    const menitLembur = pulang?.menitLembur ?? 0;

    await db
      .update(attendances)
      .set({
        shiftId: shift.id,
        status: pulang?.status ?? masuk.status,
        menitTerlambat: masuk.menitTerlambat,
        menitLembur,
        durasiKerjaMenit: pulang?.durasiKerjaMenit ?? baris.durasiKerjaMenit,
        flags,
        updatedAt: new Date(),
      })
      .where(eq(attendances.id, baris.id));

    if (menitLembur > 0) {
      const [sudahDiajukan] = await db
        .select({ id: requests.id })
        .from(requests)
        .where(
          and(
            eq(requests.tipe, "OVERTIME"),
            sql`${requests.payload}->>'attendanceId' = ${baris.id}`,
          ),
        )
        .limit(1);

      if (!sudahDiajukan) {
        const [karyawan] = await db
          .select({
            departmentId: employees.departmentId,
            locationId: employees.locationId,
          })
          .from(employees)
          .where(eq(employees.id, baris.employeeId))
          .limit(1);

        await db.insert(requests).values({
          employeeId: baris.employeeId,
          tipe: "OVERTIME",
          status: "PENDING",
          totalStep: await langkahPersetujuan("OVERTIME", {
            departmentId: karyawan?.departmentId ?? null,
            locationId: karyawan?.locationId ?? null,
          }),
          alasan: (baris.catatanKerja ?? "Lembur dari penilaian ulang shift").slice(
            0,
            300,
          ),
          payload: {
            attendanceId: baris.id,
            tanggal: baris.tanggal,
            menitLembur,
          },
        });
      }
    }

    dinilai++;
  }

  return dinilai;
}
