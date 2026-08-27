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

  /*
   * Kedua tab membagi habis daftar jenisnya, tidak saling tumpang tindih.
   *
   * Yang mensyaratkan lampiran atau tidak berkuota masuk ke Izin/Sakit —
   * keduanya tidak memotong cuti tahunan. Sisanya masuk ke Cuti. Dahulu
   * saringannya dua-duanya menyaring maju, sehingga jenis berkuota yang
   * mensyaratkan lampiran tidak muncul di mana pun, dan bila tab Izin
   * kebetulan kosong daftarnya jatuh kembali ke seluruh jenis — termasuk
   * cuti tahunan, yang lalu ikut terpotong hanya karena karyawan mengajukan
   * izin sakit dari tab yang salah.
   */
  const keIzin = (s: JenisCutiOpsi) => s.butuhLampiran || s.kuotaDefault === 0;
  const jenisCuti = semua.filter((s) => (jenis === "izin" ? keIzin(s) : !keIzin(s)));

  const kebijakan = await bacaPengaturan("kebijakan_absensi");

  return (
    <div className="pb-6 lg:mx-auto lg:max-w-[720px]">
      <header className="bg-surface border-app pt-safe border-b px-5 pb-5 lg:rounded-[var(--radius-sheet)] lg:border lg:px-7">
        <div className="flex items-center gap-3 pt-4 lg:pt-2">
          <Link
            href={`/pengajuan/${jenis}`}
            className="text-muted hover:bg-surface-muted hover:text-body grid size-9 place-items-center rounded-full transition-colors"
            aria-label="Kembali ke daftar pengajuan"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-body text-[18px] font-bold">
            {JUDUL_HALAMAN[jenis as Jenis]}
          </h1>
        </div>
      </header>

      <div className="pt-5">
        <FormPengajuan
          jenis={jenis as Jenis}
          jenisCuti={jenisCuti}
          batasBackdateHari={kebijakan.batasBackdateHari}
        />
      </div>
    </div>
  );
}
