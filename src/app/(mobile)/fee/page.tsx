import Link from "next/link";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { FileText } from "lucide-react";

import { IconFee } from "@/components/icons3d";
import { Badge } from "@/components/ui/status";
import { getDb } from "@/db/client";
import { attendances, workLogItems } from "@/db/schema";
import { ringkasanBulan } from "@/features/attendance/service";
import { wajibMasuk } from "@/lib/auth/session";
import { formatRupiah } from "@/lib/utils";
import { batasBulan, namaBulan, tanggalPendek, tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "Fee Saya" };

export default async function HalamanFee() {
  const pengguna = await wajibMasuk();
  const db = await getDb();

  const [tahun, bulan] = tanggalWIB().split("-").map(Number);
  const { mulai, akhir } = batasBulan(tahun, bulan);

  const ringkas = await ringkasanBulan(pengguna.employeeId, tahun, bulan);

  const daftar = await db
    .select({
      id: workLogItems.id,
      nama: workLogItems.namaTindakan,
      jumlah: workLogItems.jumlah,
      fee: workLogItems.feeSnapshot,
      status: workLogItems.status,
      kodePasien: workLogItems.kodePasien,
      tanggal: attendances.tanggal,
    })
    .from(workLogItems)
    .innerJoin(attendances, eq(attendances.id, workLogItems.attendanceId))
    .where(
      and(
        eq(attendances.employeeId, pengguna.employeeId),
        gte(attendances.tanggal, mulai),
        lte(attendances.tanggal, akhir),
      ),
    )
    .orderBy(desc(attendances.tanggal));

  if (!pengguna.isiFormTindakan) {
    return (
      <div className="pb-6">
        <header className="bg-surface border-app pt-safe border-b px-5 pb-6 lg:rounded-[var(--radius-sheet)] lg:border lg:px-7">
          <h1 className="text-body pt-4 text-[19px] font-extrabold lg:pt-2">Fee Saya</h1>
        </header>
        <div className="border-app bg-surface mx-5 mt-5 rounded-[var(--radius-card)] border border-dashed px-5 py-12 text-center lg:mx-0">
          <IconFee size={56} className="mx-auto opacity-60" />
          <p className="text-body mt-4 text-sm font-bold">
            Jabatan Anda tidak mencatat fee tindakan
          </p>
          <p className="text-muted mx-auto mt-1.5 max-w-[17rem] text-[13px] leading-relaxed">
            Pencatatan tindakan diaktifkan admin per jabatan. Hubungi HRD bila menurut
            Anda seharusnya aktif.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <header className="bg-surface border-app pt-safe border-b px-5 pb-16 lg:rounded-[var(--radius-sheet)] lg:border lg:px-7 lg:pb-7">
        <h1 className="text-body pt-4 text-[19px] font-extrabold lg:pt-2">Fee Saya</h1>
        <p className="text-subtle mt-0.5 text-xs">
          Tindakan yang Anda kerjakan bulan ini
        </p>
      </header>

      <div className="lg:mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-start lg:gap-5">
        <div className="lg:space-y-4">
          <div className="-mt-12 px-5 lg:mt-0 lg:px-0">
            <div className="bg-surface rounded-[var(--radius-sheet)] p-5 shadow-[var(--shadow-raised)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-subtle text-xs font-semibold">
                    Estimasi {namaBulan(tahun, bulan)}
                  </p>
                  <p className="tnum text-body mt-1 text-[32px] leading-none font-extrabold">
                    {formatRupiah(ringkas.totalFee)}
                  </p>
                </div>
                <IconFee size={58} />
              </div>

              <div className="border-app mt-4 grid grid-cols-2 gap-3 border-t pt-4">
                <div>
                  <p className="text-subtle text-xs font-semibold">Terverifikasi</p>
                  <p className="text-status-ontime tnum mt-1 text-lg font-extrabold">
                    {formatRupiah(ringkas.feeTerverifikasi)}
                  </p>
                </div>
                <div>
                  <p className="text-subtle text-xs font-semibold">Jumlah tindakan</p>
                  <p className="text-body tnum mt-1 text-lg font-extrabold">
                    {ringkas.jumlahTindakan}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 px-5 lg:mt-0 lg:px-0">
            <Link
              href={`/fee/slip?bulan=${tahun}-${String(bulan).padStart(2, "0")}`}
              className="border-app-strong bg-surface text-body hover:bg-surface-muted flex h-11 items-center justify-center gap-2 rounded-[var(--radius-input)] border text-sm font-semibold transition-colors"
            >
              <FileText size={16} /> Lihat slip insentif
            </Link>
          </div>
        </div>

        <section className="mt-6 px-5 lg:mt-0 lg:px-0">
          <h2 className="text-body text-sm font-extrabold tracking-tight">
            Rincian tindakan
          </h2>

          {daftar.length === 0 ? (
            <div className="border-app bg-surface mt-3 rounded-[var(--radius-card)] border border-dashed px-5 py-10 text-center">
              <p className="text-body text-sm font-bold">Belum ada tindakan</p>
              <p className="text-muted mt-1 text-[13px]">
                Catat tindakan saat Anda melakukan clock out.
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {daftar.map((d) => (
                <li
                  key={d.id}
                  className="bg-surface border-app rounded-[var(--radius-card)] border px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body text-sm font-bold">{d.nama}</p>
                      <p className="text-subtle mt-0.5 text-[12px]">
                        {tanggalPendek(d.tanggal)}
                        {d.jumlah > 1 ? ` · ${d.jumlah}×` : ""}
                        {d.kodePasien ? ` · ${d.kodePasien}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-body tnum text-sm font-extrabold">
                        {formatRupiah(d.fee * d.jumlah)}
                      </p>
                      <Badge
                        tone={d.status === "VERIFIED" ? "brand" : "warn"}
                        className="mt-1"
                      >
                        {d.status === "VERIFIED" ? "Terverifikasi" : "Menunggu"}
                      </Badge>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="text-subtle mt-4 text-center text-[11px] leading-relaxed">
            Nominal mengikuti tarif yang berlaku saat tindakan dicatat dan tidak berubah
            bila admin memperbarui tarif di kemudian hari.
          </p>
        </section>
      </div>
    </div>
  );
}
