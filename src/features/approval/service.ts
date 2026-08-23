import "server-only";

import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  approvalRuleActors,
  approvalRules,
  attendances,
  departments,
  employees,
  leaveTypes,
  positions,
  requestApprovals,
  requests,
  type RequestStatus,
  type RequestType,
  type Role,
} from "@/db/schema";

/**
 * Mesin persetujuan.
 *
 * Siapa yang boleh menyetujui tidak ditanam di kode — dibaca dari tabel
 * approval_rules yang disusun admin (PRD §6.4). Bila tidak ada aturan yang
 * cocok, pengajuan jatuh ke ADMIN sebagai jaring pengaman supaya tidak
 * pernah ada pengajuan yang menggantung tanpa penyetuju.
 */

export const LABEL_TIPE: Record<RequestType, string> = {
  LEAVE: "Cuti",
  OVERTIME: "Lembur",
  BACKDATE: "Koreksi Absen",
  PERMIT: "Izin / Sakit",
  OUTSIDE_AREA: "Absen di Luar Area",
  DEVICE_CHANGE: "Ganti Perangkat",
};

export type BarisPengajuan = {
  id: string;
  tipe: RequestType;
  status: RequestStatus;
  alasan: string | null;
  lampiran: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
  currentStep: number;
  totalStep: number;
  employeeId: string;
  nama: string;
  jabatan: string | null;
  departemen: string | null;
  departmentId: string | null;
  locationId: string | null;
};

/** Daftar pengajuan beserta identitas pengaju. */
export async function daftarPengajuan(
  status: RequestStatus | "SEMUA" = "PENDING",
  locationIds?: string[] | null,
) {
  const db = await getDb();

  // Pemilik klinik hanya melihat pengajuan dari cabangnya.
  const batasCabang = locationIds?.length
    ? [inArray(employees.locationId, locationIds)]
    : [];

  const kueri = db
    .select({
      id: requests.id,
      tipe: requests.tipe,
      status: requests.status,
      alasan: requests.alasan,
      lampiran: requests.lampiran,
      payload: requests.payload,
      createdAt: requests.createdAt,
      currentStep: requests.currentStep,
      totalStep: requests.totalStep,
      employeeId: requests.employeeId,
      nama: employees.nama,
      jabatan: positions.nama,
      departemen: departments.nama,
      departmentId: employees.departmentId,
      locationId: employees.locationId,
    })
    .from(requests)
    .innerJoin(employees, eq(employees.id, requests.employeeId))
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .orderBy(desc(requests.createdAt))
    .limit(100);

  const syarat = [
    ...(status === "SEMUA" ? [] : [eq(requests.status, status)]),
    ...batasCabang,
  ];

  const baris = syarat.length > 0 ? await kueri.where(and(...syarat)) : await kueri;

  return baris as BarisPengajuan[];
}

/** Jumlah pengajuan per status, untuk tab penyaring. */
export async function hitungPerStatus(locationIds?: string[] | null) {
  const db = await getDb();
  const semua = await db
    .select({ status: requests.status })
    .from(requests)
    .innerJoin(employees, eq(employees.id, requests.employeeId))
    .where(locationIds?.length ? inArray(employees.locationId, locationIds) : undefined);

  const hitung: Record<string, number> = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    SEMUA: semua.length,
  };
  for (const r of semua) hitung[r.status] = (hitung[r.status] ?? 0) + 1;
  return hitung;
}

/**
 * Menentukan apakah seorang pengguna berwenang memutuskan sebuah pengajuan
 * pada langkah yang sedang berjalan.
 *
 * Super admin selalu boleh — dia pemilik sistem dan harus bisa membuka
 * kebuntuan bila approver berhalangan tanpa sempat menunjuk delegasi.
 */
export async function bolehMemutuskan(
  pengguna: { userId: string; role: Role },
  pengajuan: Pick<BarisPengajuan, "tipe" | "currentStep" | "departmentId" | "locationId">,
): Promise<boolean> {
  if (pengguna.role === "SUPER_ADMIN") return true;

  const db = await getDb();

  const aturan = await db
    .select()
    .from(approvalRules)
    .where(
      and(eq(approvalRules.tipePengajuan, pengajuan.tipe), eq(approvalRules.aktif, true)),
    );

  // Aturan paling spesifik menang: departemen/lokasi lebih dulu, baru ALL.
  const cocok =
    aturan.find(
      (a) =>
        (a.scope === "DEPARTMENT" && a.scopeId === pengajuan.departmentId) ||
        (a.scope === "LOCATION" && a.scopeId === pengajuan.locationId),
    ) ?? aturan.find((a) => a.scope === "ALL");

  // Tanpa aturan yang cocok, kewenangan jatuh ke admin (jaring pengaman).
  if (!cocok) return pengguna.role === "ADMIN";

  const pelaku = await db
    .select()
    .from(approvalRuleActors)
    .where(
      and(
        eq(approvalRuleActors.ruleId, cocok.id),
        eq(approvalRuleActors.step, pengajuan.currentStep),
      ),
    );

  if (pelaku.length === 0) return pengguna.role === "ADMIN";

  return pelaku.some(
    (p) =>
      p.approverUserId === pengguna.userId ||
      p.delegateUserId === pengguna.userId ||
      p.approverRole === pengguna.role,
  );
}

/**
 * Berapa langkah persetujuan yang harus dilalui sebuah pengajuan baru.
 *
 * Aturan berjenjang selama ini hanya tersimpan, tidak pernah terpakai:
 * `requests.totalStep` memakai nilai bawaan satu dan tak ada yang membacanya
 * dari aturan, sehingga pengajuan selalu selesai pada persetujuan pertama
 * meski admin sudah menyusun dua langkah.
 *
 * Jumlah langkahnya dibekukan ke dalam pengajuan saat dibuat, bukan dibaca
 * ulang tiap kali diputuskan. Dengan begitu mengubah aturan hari ini tidak
 * mengacaukan pengajuan yang sudah berjalan setengah jalan.
 */
export async function langkahPersetujuan(
  tipe: RequestType,
  karyawan: { departmentId: string | null; locationId: string | null },
): Promise<number> {
  const db = await getDb();

  const aturan = await db
    .select()
    .from(approvalRules)
    .where(and(eq(approvalRules.tipePengajuan, tipe), eq(approvalRules.aktif, true)));

  // Aturan paling spesifik menang — urutannya sama persis dengan yang dipakai
  // `bolehMemutuskan`, supaya yang menetapkan langkah dan yang memeriksa
  // wewenang tidak pernah memilih aturan yang berbeda.
  const cocok =
    aturan.find(
      (a) =>
        (a.scope === "DEPARTMENT" && a.scopeId === karyawan.departmentId) ||
        (a.scope === "LOCATION" && a.scopeId === karyawan.locationId),
    ) ?? aturan.find((a) => a.scope === "ALL");

  return Math.max(1, cocok?.totalStep ?? 1);
}

/** Menyaring daftar pengajuan menjadi hanya yang boleh diputuskan pengguna. */
export async function saringYangBolehDiputuskan(
  pengguna: { userId: string; role: Role },
  daftar: BarisPengajuan[],
) {
  const hasil: Record<string, boolean> = {};
  for (const p of daftar) {
    hasil[p.id] = p.status === "PENDING" ? await bolehMemutuskan(pengguna, p) : false;
  }
  return hasil;
}

/** Riwayat keputusan sebuah pengajuan. */
export async function riwayatKeputusan(requestId: string) {
  const db = await getDb();
  return db
    .select()
    .from(requestApprovals)
    .where(eq(requestApprovals.requestId, requestId))
    .orderBy(requestApprovals.step);
}

/** Nama jenis cuti untuk ditampilkan pada kartu pengajuan. */
export async function petaJenisCuti() {
  const db = await getDb();
  const baris = await db
    .select({ id: leaveTypes.id, nama: leaveTypes.nama })
    .from(leaveTypes);
  return new Map(baris.map((b) => [b.id, b.nama]));
}

/** Absensi yang belum lengkap dan berpotensi butuh koreksi. */
export async function absensiTanpaClockOut(batas = 20) {
  const db = await getDb();
  return db
    .select({
      id: attendances.id,
      tanggal: attendances.tanggal,
      nama: employees.nama,
      clockInAt: attendances.clockInAt,
    })
    .from(attendances)
    .innerJoin(employees, eq(employees.id, attendances.employeeId))
    .where(and(isNull(attendances.clockOutAt), or(eq(attendances.status, "INCOMPLETE"))))
    .orderBy(desc(attendances.tanggal))
    .limit(batas);
}

/** Ambil beberapa pengajuan sekaligus (dipakai aksi massal). */
export async function ambilPengajuan(ids: string[]) {
  if (ids.length === 0) return [];
  const db = await getDb();
  return db
    .select({
      id: requests.id,
      tipe: requests.tipe,
      status: requests.status,
      payload: requests.payload,
      currentStep: requests.currentStep,
      totalStep: requests.totalStep,
      employeeId: requests.employeeId,
      userId: employees.userId,
      nama: employees.nama,
      departmentId: employees.departmentId,
      locationId: employees.locationId,
    })
    .from(requests)
    .innerJoin(employees, eq(employees.id, requests.employeeId))
    .where(inArray(requests.id, ids));
}
