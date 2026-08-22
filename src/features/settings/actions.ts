"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import {
  approvalRuleActors,
  approvalRules,
  auditLogs,
  employees,
  leaveBalances,
  leaveEncashments,
  leaveTypes,
  settings,
  yearEndClosings,
  type YearEndChoice,
} from "@/db/schema";
import { PERAN_ADMIN, wajibPeran } from "@/lib/auth/session";
import { bacaPengaturan } from "./service";

export type HasilPengaturan = { ok: boolean; pesan: string };

async function catat(
  actorId: string,
  aksi: string,
  entitas: string,
  entitasId: string,
  after?: Record<string, unknown>,
  before?: Record<string, unknown>,
) {
  const db = await getDb();
  const h = await headers();
  await db.insert(auditLogs).values({
    actorId,
    aksi,
    entitas,
    entitasId,
    before: before ?? null,
    after: after ?? null,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  });
}

/** Menulis satu blok pengaturan sekaligus mencatat nilai lamanya. */
async function simpanPengaturan(
  actorId: string,
  kunci: string,
  nilai: unknown,
  keterangan: string,
) {
  const db = await getDb();
  const [sebelum] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, kunci))
    .limit(1);

  await db
    .insert(settings)
    .values({ key: kunci, value: nilai, keterangan })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: nilai, updatedAt: new Date() },
    });

  await catat(
    actorId,
    "UBAH_PENGATURAN",
    "settings",
    kunci,
    nilai as Record<string, unknown>,
    (sebelum?.value ?? null) as Record<string, unknown>,
  );
  revalidatePath("/admin/pengaturan");
}

/* ==========================================================================
 * Profil & kebijakan
 * ========================================================================== */

const skemaProfil = z.object({
  nama: z.string().trim().min(2, "Nama rumah sakit wajib diisi"),
  alamat: z.string().trim().max(300).optional(),
  telepon: z.string().trim().max(40).optional(),
  email: z.string().trim().max(120).optional(),
});

export async function aksiSimpanProfil(
  _prev: HasilPengaturan | null,
  formData: FormData,
): Promise<HasilPengaturan> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const parsed = skemaProfil.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  await simpanPengaturan(
    pengguna.userId,
    "profil_perusahaan",
    {
      nama: parsed.data.nama,
      alamat: parsed.data.alamat ?? "",
      telepon: parsed.data.telepon ?? "",
      email: parsed.data.email ?? "",
    },
    "Identitas yang tampil di kop laporan",
  );

  return { ok: true, pesan: "Profil rumah sakit disimpan." };
}

const skemaAbsensi = z.object({
  batasBackdateHari: z.coerce.number().int().min(0).max(90),
  hariMulaiPeriode: z.coerce.number().int().min(1).max(28),
  minKarakterCatatan: z.coerce.number().int().min(0).max(500),
  retensiFotoBulan: z.coerce.number().int().min(1).max(120),
  wajibCatatanKerja: z.coerce.boolean().optional(),
  izinkanAbsenTanpaShift: z.coerce.boolean().optional(),
});

export async function aksiSimpanKebijakanAbsensi(
  _prev: HasilPengaturan | null,
  formData: FormData,
): Promise<HasilPengaturan> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const mentah = Object.fromEntries(formData);
  const parsed = skemaAbsensi.safeParse({
    ...mentah,
    wajibCatatanKerja:
      mentah.wajibCatatanKerja === "on" || mentah.wajibCatatanKerja === "true",
    izinkanAbsenTanpaShift:
      mentah.izinkanAbsenTanpaShift === "on" || mentah.izinkanAbsenTanpaShift === "true",
  });
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  await simpanPengaturan(
    pengguna.userId,
    "kebijakan_absensi",
    {
      batasBackdateHari: parsed.data.batasBackdateHari,
      hariMulaiPeriode: parsed.data.hariMulaiPeriode,
      minKarakterCatatan: parsed.data.minKarakterCatatan,
      retensiFotoBulan: parsed.data.retensiFotoBulan,
      wajibCatatanKerja: parsed.data.wajibCatatanKerja ?? false,
      izinkanAbsenTanpaShift: parsed.data.izinkanAbsenTanpaShift ?? false,
    },
    "Aturan umum absensi",
  );

  return { ok: true, pesan: "Kebijakan absensi disimpan." };
}

const skemaCuti = z.object({
  tarifPencairanPerHari: z.coerce.number().int().min(0).max(100_000_000),
  sumberTarif: z.enum(["TETAP", "GAJI_POKOK"]),
  pembagiGajiPokok: z.coerce.number().int().min(1).max(31),
});

export async function aksiSimpanKebijakanCuti(
  _prev: HasilPengaturan | null,
  formData: FormData,
): Promise<HasilPengaturan> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const parsed = skemaCuti.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  await simpanPengaturan(
    pengguna.userId,
    "kebijakan_cuti",
    parsed.data,
    "Dasar perhitungan pencairan sisa cuti",
  );

  return { ok: true, pesan: "Kebijakan cuti disimpan." };
}

/* ==========================================================================
 * Jenis cuti
 * ========================================================================== */

const skemaJenisCuti = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  nama: z.string().trim().min(2, "Nama jenis cuti wajib diisi"),
  kuotaDefault: z.coerce.number().int().min(0).max(365),
  maxCarryOverHari: z.coerce.number().int().min(0).max(365),
  tglKedaluwarsaCarry: z.string().trim().max(5).optional(),
  berbayar: z.coerce.boolean().optional(),
  butuhLampiran: z.coerce.boolean().optional(),
  bolehCarryOver: z.coerce.boolean().optional(),
  bolehDiuangkan: z.coerce.boolean().optional(),
});

export async function aksiSimpanJenisCuti(
  _prev: HasilPengaturan | null,
  formData: FormData,
): Promise<HasilPengaturan> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const m = Object.fromEntries(formData);
  const cek = (k: string) => m[k] === "on" || m[k] === "true";

  const parsed = skemaJenisCuti.safeParse({
    ...m,
    berbayar: cek("berbayar"),
    butuhLampiran: cek("butuhLampiran"),
    bolehCarryOver: cek("bolehCarryOver"),
    bolehDiuangkan: cek("bolehDiuangkan"),
  });
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  const d = parsed.data;
  const db = await getDb();
  const nilai = {
    nama: d.nama,
    kuotaDefault: d.kuotaDefault,
    berbayar: d.berbayar ?? true,
    butuhLampiran: d.butuhLampiran ?? false,
    bolehCarryOver: d.bolehCarryOver ?? false,
    bolehDiuangkan: d.bolehDiuangkan ?? false,
    maxCarryOverHari: d.maxCarryOverHari,
    tglKedaluwarsaCarry: d.tglKedaluwarsaCarry || null,
  };

  if (d.id) {
    await db.update(leaveTypes).set(nilai).where(eq(leaveTypes.id, d.id));
    await catat(pengguna.userId, "UBAH_JENIS_CUTI", "leave_types", d.id, nilai);
  } else {
    const [baru] = await db.insert(leaveTypes).values(nilai).returning();
    await catat(pengguna.userId, "TAMBAH_JENIS_CUTI", "leave_types", baru.id, nilai);
  }

  revalidatePath("/admin/pengaturan");
  return { ok: true, pesan: `Jenis cuti ${d.nama} disimpan.` };
}

/* ==========================================================================
 * Aturan persetujuan
 * ========================================================================== */

const skemaAturan = z.object({
  tipePengajuan: z.enum([
    "OVERTIME",
    "BACKDATE",
    "LEAVE",
    "PERMIT",
    "OUTSIDE_AREA",
    "DEVICE_CHANGE",
  ]),
  scope: z.enum(["ALL", "DEPARTMENT", "LOCATION"]),
  scopeId: z.string().uuid().optional().or(z.literal("")),
  mode: z.enum(["ANY", "ALL"]),
  totalStep: z.coerce.number().int().min(1).max(3),
  /** Daftar "step:penanda" — penanda berupa userId atau nama peran. */
  pelaku: z.string(),
});

/**
 * Menyusun aturan persetujuan (PRD §6.4).
 * Aturan lama dengan kombinasi tipe+cakupan yang sama akan digantikan supaya
 * tidak ada dua aturan yang saling bertabrakan.
 */
export async function aksiSimpanAturanPersetujuan(
  _prev: HasilPengaturan | null,
  formData: FormData,
): Promise<HasilPengaturan> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const parsed = skemaAturan.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  const d = parsed.data;
  if (d.scope !== "ALL" && !d.scopeId) {
    return { ok: false, pesan: "Pilih departemen atau lokasi untuk cakupan ini." };
  }

  const pelaku = d.pelaku
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [step, penanda] = x.split(":");
      return { step: Number(step) || 1, penanda };
    });

  if (pelaku.length === 0) {
    return { ok: false, pesan: "Tentukan minimal satu penyetuju." };
  }

  const db = await getDb();

  // Hapus aturan lama yang cakupannya identik.
  const lama = await db
    .select({ id: approvalRules.id })
    .from(approvalRules)
    .where(
      and(
        eq(approvalRules.tipePengajuan, d.tipePengajuan),
        eq(approvalRules.scope, d.scope),
        d.scopeId ? eq(approvalRules.scopeId, d.scopeId) : undefined,
      ),
    );
  for (const l of lama) {
    await db.delete(approvalRules).where(eq(approvalRules.id, l.id));
  }

  const [aturan] = await db
    .insert(approvalRules)
    .values({
      tipePengajuan: d.tipePengajuan,
      scope: d.scope,
      scopeId: d.scopeId || null,
      totalStep: d.totalStep,
      mode: d.mode,
      aktif: true,
    })
    .returning();

  const PERAN = ["SUPER_ADMIN", "ADMIN", "MANAGER", "KARYAWAN"];
  await db.insert(approvalRuleActors).values(
    pelaku.map((p) => ({
      ruleId: aturan.id,
      step: p.step,
      approverUserId: PERAN.includes(p.penanda) ? null : p.penanda,
      approverRole: PERAN.includes(p.penanda)
        ? (p.penanda as "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "KARYAWAN")
        : null,
    })),
  );

  await catat(pengguna.userId, "UBAH_ATURAN_PERSETUJUAN", "approval_rules", aturan.id, {
    tipe: d.tipePengajuan,
    scope: d.scope,
    totalStep: d.totalStep,
    pelaku: pelaku.length,
  });

  revalidatePath("/admin/pengaturan");
  return { ok: true, pesan: "Aturan persetujuan disimpan." };
}

export async function aksiHapusAturanPersetujuan(id: string): Promise<HasilPengaturan> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const db = await getDb();
  await db.delete(approvalRules).where(eq(approvalRules.id, id));
  await catat(pengguna.userId, "HAPUS_ATURAN_PERSETUJUAN", "approval_rules", id);
  revalidatePath("/admin/pengaturan");
  return {
    ok: true,
    pesan: "Aturan dihapus. Pengajuan yang tidak tercakup jatuh ke Admin/HRD.",
  };
}

/* ==========================================================================
 * Tutup tahun cuti
 * ========================================================================== */

const skemaTutupTahun = z.object({
  tahun: z.coerce.number().int().min(2020).max(2100),
  /** Format "employeeId:pilihan:hariDiuangkan", dipisah koma. */
  keputusan: z.string(),
});

/**
 * Menjalankan proses tutup tahun cuti (PRD §6.4.1).
 *
 * Bersifat idempoten: satu tahun hanya bisa diproses sekali. Ini penting
 * karena prosesnya menghasilkan pencairan uang — klik dua kali tidak boleh
 * berarti bayar dua kali.
 */
export async function aksiTutupTahunCuti(
  _prev: HasilPengaturan | null,
  formData: FormData,
): Promise<HasilPengaturan> {
  const pengguna = await wajibPeran(...PERAN_ADMIN);
  const parsed = skemaTutupTahun.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, pesan: parsed.error.issues[0].message };

  const { tahun, keputusan } = parsed.data;
  const db = await getDb();

  const [sudah] = await db
    .select()
    .from(yearEndClosings)
    .where(eq(yearEndClosings.tahun, tahun))
    .limit(1);
  if (sudah) {
    return {
      ok: false,
      pesan: `Tutup tahun ${tahun} sudah pernah dijalankan pada ${sudah.dijalankanAt.toLocaleDateString("id-ID")}.`,
    };
  }

  const [jenis] = await db
    .select()
    .from(leaveTypes)
    .where(eq(leaveTypes.nama, "Cuti Tahunan"))
    .limit(1);
  if (!jenis) return { ok: false, pesan: "Jenis Cuti Tahunan belum diatur." };

  const kebijakan = await bacaPengaturan("kebijakan_cuti");

  const baris = keputusan
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [employeeId, pilihan, hari] = x.split(":");
      return {
        employeeId,
        pilihan: pilihan as YearEndChoice,
        hariDiuangkan: Number(hari) || 0,
      };
    });

  let totalDiuangkan = 0;
  let totalHariDibawa = 0;
  let jumlahKaryawan = 0;

  for (const b of baris) {
    const [saldo] = await db
      .select()
      .from(leaveBalances)
      .where(
        and(
          eq(leaveBalances.employeeId, b.employeeId),
          eq(leaveBalances.leaveTypeId, jenis.id),
          eq(leaveBalances.tahun, tahun),
        ),
      )
      .limit(1);
    if (!saldo) continue;

    const sisa = Math.max(
      0,
      saldo.kuota + saldo.carryOverMasuk - saldo.terpakai - saldo.pending,
    );
    if (sisa === 0) continue;

    const diuangkan =
      b.pilihan === "ENCASH"
        ? sisa
        : b.pilihan === "SPLIT"
          ? Math.min(Math.max(0, b.hariDiuangkan), sisa)
          : 0;
    const dibawaMentah = sisa - diuangkan;
    const dibawa = Math.min(dibawaMentah, jenis.maxCarryOverHari);

    // Tarif diambil dari kebijakan, bukan dari angka yang dikirim peramban.
    if (diuangkan > 0 && jenis.bolehDiuangkan) {
      const [kar] = await db
        .select({ gajiPokok: employees.gajiPokok })
        .from(employees)
        .where(eq(employees.id, b.employeeId))
        .limit(1);

      const tarif =
        kebijakan.sumberTarif === "GAJI_POKOK" && kar?.gajiPokok
          ? Math.round(kar.gajiPokok / kebijakan.pembagiGajiPokok)
          : kebijakan.tarifPencairanPerHari;

      await db.insert(leaveEncashments).values({
        employeeId: b.employeeId,
        leaveTypeId: jenis.id,
        tahun,
        jumlahHari: diuangkan,
        tarifPerHari: tarif,
        totalNominal: diuangkan * tarif,
        status: "DRAFT",
        diprosesOleh: pengguna.userId,
      });
      totalDiuangkan += diuangkan * tarif;
    }

    // Saldo tahun berikutnya dibuat dengan carry-over yang disetujui.
    await db
      .insert(leaveBalances)
      .values({
        employeeId: b.employeeId,
        leaveTypeId: jenis.id,
        tahun: tahun + 1,
        kuota: jenis.kuotaDefault,
        carryOverMasuk: jenis.bolehCarryOver ? dibawa : 0,
      })
      .onConflictDoUpdate({
        target: [
          leaveBalances.employeeId,
          leaveBalances.leaveTypeId,
          leaveBalances.tahun,
        ],
        set: { carryOverMasuk: jenis.bolehCarryOver ? dibawa : 0 },
      });

    totalHariDibawa += dibawa;
    jumlahKaryawan++;
  }

  await db.insert(yearEndClosings).values({
    tahun,
    dijalankanOleh: pengguna.userId,
    ringkasan: {
      jumlahKaryawan,
      totalNominalPencairan: totalDiuangkan,
      totalHariDibawa,
    },
  });

  await catat(pengguna.userId, "TUTUP_TAHUN_CUTI", "year_end_closings", String(tahun), {
    jumlahKaryawan,
    totalDiuangkan,
    totalHariDibawa,
  });

  revalidatePath("/admin/pengaturan");
  return {
    ok: true,
    pesan: `Tutup tahun ${tahun} selesai: ${jumlahKaryawan} karyawan diproses, pencairan Rp${totalDiuangkan.toLocaleString("id-ID")}, ${totalHariDibawa} hari dibawa ke tahun depan.`,
  };
}
