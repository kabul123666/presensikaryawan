import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { leaveBalances, leaveTypes } from "@/db/schema";
import { FormPengajuan, type JenisCutiOpsi } from "@/features/requests/form-pengajuan";
import { bacaPengaturan } from "@/features/settings/service";
import { wajibMasuk } from "@/lib/auth/session";
import { tanggalWIB } from "@/lib/waktu";

const JENIS = ["cuti", "izin", "lembur", "koreksi"] as const;
type Jenis = (typeof JENIS)[number];

const JUDUL_HALAMAN: Record<Jenis, string> = {
  cuti: "Formulir Cuti",
  izin: "Formulir Izin",
  lembur: "Formulir Lembur",
  koreksi: "Formulir Presensi Backdate",
};

export default async function HalamanFormPengajuan({
  params,
}: {
  params: Promise<{ jenis: string }>;
}) {
  const pengguna = await wajibMasuk();
  const { jenis } = await params;

  if (!JENIS.includes(jenis as Jenis)) notFound();

  const db = await getDb();
  const tahun = Number(tanggalWIB().slice(0, 4));

  // Saldo dihitung di server; formulir hanya menampilkannya.
  const baris = await db
    .select({
      id: leaveTypes.id,
      nama: leaveTypes.nama,
      butuhLampiran: leaveTypes.butuhLampiran,
      kuotaDefault: leaveTypes.kuotaDefault,
      kuota: leaveBalances.kuota,
      carryOverMasuk: leaveBalances.carryOverMasuk,
      terpakai: leaveBalances.terpakai,
      pending: leaveBalances.pending,
    })
    .from(leaveTypes)
    .leftJoin(
      leaveBalances,
      and(
        eq(leaveBalances.leaveTypeId, leaveTypes.id),
        eq(leaveBalances.employeeId, pengguna.employeeId),
        eq(leaveBalances.tahun, tahun),
      ),
    )
    .where(eq(leaveTypes.aktif, true));

  // Tab "cuti" menampilkan cuti biasa, tab "izin" yang butuh lampiran.
  const semua: JenisCutiOpsi[] = baris.map((b) => ({
    id: b.id,
    nama: b.nama,
    butuhLampiran: b.butuhLampiran,
    kuotaDefault: b.kuotaDefault,
    sisa: Math.max(
      0,
      (b.kuota ?? b.kuotaDefault) +
        (b.carryOverMasuk ?? 0) -
        (b.terpakai ?? 0) -
        (b.pending ?? 0),
    ),
  }));

  const jenisCuti =
    jenis === "izin"
      ? semua.filter((s) => s.butuhLampiran || s.kuotaDefault === 0)
      : semua.filter((s) => !s.butuhLampiran && s.kuotaDefault > 0);

  const kebijakan = await bacaPengaturan("kebijakan_absensi");

  return (
    <div className="pb-6 lg:mx-auto lg:max-w-[720px]">
      <header className="bg-brand-700 pt-safe px-5 pb-5 lg:rounded-[var(--radius-sheet)] lg:px-7">
        <div className="flex items-center gap-3 pt-4 lg:pt-2">
          <Link
            href={`/pengajuan/${jenis}`}
            className="grid size-9 place-items-center rounded-full text-white transition-colors hover:bg-white/10"
            aria-label="Kembali ke daftar pengajuan"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-[18px] font-extrabold text-white">
            {JUDUL_HALAMAN[jenis as Jenis]}
          </h1>
        </div>
      </header>

      <div className="pt-5">
        <FormPengajuan
          jenis={jenis as Jenis}
          jenisCuti={jenisCuti.length > 0 ? jenisCuti : semua}
          batasBackdateHari={kebijakan.batasBackdateHari}
        />
      </div>
    </div>
  );
}
