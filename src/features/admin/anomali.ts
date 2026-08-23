import "server-only";

import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { attendances, departments, employees, users } from "@/db/schema";
import { tanggalWIB } from "@/lib/waktu";

/**
 * Antrean tinjau anomali absensi.
 *
 * Yang masuk antrean ada dua macam: baris yang membawa penanda (GPS palsu,
 * absen di luar area, perangkat baru) dan baris yang tidak pernah ditutup —
 * clock in ada, clock out tidak, dan harinya sudah lewat. Keduanya menuntut
 * keputusan manusia, dan sebelum ini tidak ada tempat untuk mencatat bahwa
 * keputusan itu sudah diambil: dashboard hanya menampilkan lima teratas dan
 * daftarnya tidak pernah berkurang.
 *
 * Penandanya sendiri tidak pernah dihapus. Yang dicatat adalah siapa yang
 * meninjau dan kapan, sehingga buktinya tetap utuh untuk audit.
 */

export type SaringanAnomali = "BELUM" | "SUDAH" | "SEMUA";

/** Baris yang dianggap anomali: berpenanda, atau menggantung tanpa clock out. */
function syaratAnomali() {
  // Penanda WFH dikeluarkan dari hitungan: kepala unit yang absen dari rumah
  // memang sudah diizinkan, jadi memasukkannya ke antrean tinjau hanya membuat
  // daftar yang tidak pernah selesai diperiksa.
  return sql`((${attendances.flags} - 'WFH') <> '[]'::jsonb or (${attendances.clockInAt} is not null and ${attendances.clockOutAt} is null and ${attendances.tanggal} < ${tanggalWIB()}))`;
}

export async function daftarAnomali(
  saringan: SaringanAnomali = "BELUM",
  batas = 100,
  locationIds?: string[] | null,
) {
  const db = await getDb();

  const syarat = [syaratAnomali()];
  if (saringan === "BELUM") syarat.push(isNull(attendances.ditinjauAt));
  if (saringan === "SUDAH") syarat.push(isNotNull(attendances.ditinjauAt));
  if (locationIds?.length) syarat.push(inArray(employees.locationId, locationIds));

  return db
    .select({
      id: attendances.id,
      tanggal: attendances.tanggal,
      nama: employees.nama,
      employeeId: employees.id,
      departemen: departments.nama,
      flags: attendances.flags,
      clockInAt: attendances.clockInAt,
      clockOutAt: attendances.clockOutAt,
      jarakM: attendances.clockInDistanceM,
      alamat: attendances.clockInAddress,
      alasan: attendances.clockInReason,
      ditinjauAt: attendances.ditinjauAt,
      ditinjauOleh: users.username,
      catatanTinjau: attendances.catatanTinjau,
    })
    .from(attendances)
    .innerJoin(employees, eq(employees.id, attendances.employeeId))
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .leftJoin(users, eq(users.id, attendances.ditinjauOleh))
    .where(and(...syarat))
    .orderBy(desc(attendances.tanggal))
    .limit(batas);
}

/** Jumlah per saringan, untuk tab dan lencana di sidebar. */
export async function hitungAnomali(locationIds?: string[] | null) {
  const db = await getDb();
  const [row] = await db
    .select({
      belum: sql<number>`count(*) filter (where ${attendances.ditinjauAt} is null)`,
      sudah: sql<number>`count(*) filter (where ${attendances.ditinjauAt} is not null)`,
      semua: sql<number>`count(*)`,
    })
    .from(attendances)
    .innerJoin(employees, eq(employees.id, attendances.employeeId))
    .where(
      and(
        syaratAnomali(),
        ...(locationIds?.length ? [inArray(employees.locationId, locationIds)] : []),
      ),
    );

  return {
    BELUM: Number(row?.belum ?? 0),
    SUDAH: Number(row?.sudah ?? 0),
    SEMUA: Number(row?.semua ?? 0),
  };
}
