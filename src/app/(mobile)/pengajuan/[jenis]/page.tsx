import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, FileText, Plus } from "lucide-react";

import { BadgePengajuan } from "@/components/ui/status";
import { getDb } from "@/db/client";
import { requestApprovals, requests, type RequestType } from "@/db/schema";
import { TombolBatal } from "@/features/requests/tombol-batal";
import { wajibMasuk } from "@/lib/auth/session";
import { tanggalPendek, tanggalWIB } from "@/lib/waktu";

const JENIS = ["cuti", "izin", "lembur", "koreksi"] as const;
type Jenis = (typeof JENIS)[number];

/**
 * Satu halaman menampung satu jenis pengajuan.
 *
 * Menu Lembur membuka riwayat lembur, bukan formulir kosong — yang paling
 * sering dicari orang adalah "pengajuan saya kemarin sudah disetujui belum",
 * sedangkan membuat pengajuan baru lebih jarang dan cukup lewat tombol tambah.
 */
const PETA: Record<Jenis, { tipe: RequestType[]; judul: string; kosong: string }> = {
  cuti: {
    tipe: ["LEAVE"],
    judul: "Cuti",
    kosong: "Belum ada pengajuan cuti.",
  },
  izin: {
    tipe: ["PERMIT"],
    judul: "Izin / Sakit",
    kosong: "Belum ada pengajuan izin.",
  },
  lembur: {
    tipe: ["OVERTIME"],
    judul: "Lembur",
    kosong: "Belum ada pengajuan lembur.",
  },
  koreksi: {
    tipe: ["BACKDATE"],
    judul: "Presensi Backdate",
    kosong: "Belum ada pengajuan koreksi absen.",
  },
};

export default async function HalamanDaftarJenis({
  params,
}: {
  params: Promise<{ jenis: string }>;
}) {
  const pengguna = await wajibMasuk();
  const { jenis } = await params;

  if (!JENIS.includes(jenis as Jenis)) notFound();
  const info = PETA[jenis as Jenis];

  const db = await getDb();

  const daftar = await db
    .select()
    .from(requests)
    .where(eq(requests.employeeId, pengguna.employeeId))
    .orderBy(desc(requests.createdAt))
    .limit(50);

  const milikJenis = daftar.filter((r) => info.tipe.includes(r.tipe));

  // Catatan penyetuju tinggal di tabel terpisah; tanpa ini karyawan hanya
  // melihat pengajuannya ditolak tanpa tahu alasannya.
  const keputusan = milikJenis.length
    ? await db
        .select({
          requestId: requestApprovals.requestId,
          catatan: requestApprovals.catatan,
          keputusan: requestApprovals.keputusan,
        })
        .from(requestApprovals)
        .where(
          inArray(
            requestApprovals.requestId,
            milikJenis.map((r) => r.id),
          ),
        )
    : [];

  const petaCatatan = new Map(
    keputusan
      .filter((k) => k.catatan && k.keputusan !== "PENDING")
      .map((k) => [k.requestId, k.catatan] as const),
  );

  return (
    <div className="pb-6">
      <header className="bg-brand-700 pt-safe px-5 pb-5 lg:rounded-[var(--radius-sheet)] lg:px-7">
        <div className="flex items-center gap-3 pt-4 lg:pt-2">
          <Link
            href="/pengajuan"
            className="grid size-9 place-items-center rounded-full text-white transition-colors hover:bg-white/10"
            aria-label="Kembali"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="flex-1 text-[18px] font-extrabold text-white">{info.judul}</h1>
          <Link
            href={`/pengajuan/${jenis}/baru`}
            className="text-brand-700 grid size-9 place-items-center rounded-full bg-white transition-transform active:scale-95"
            aria-label={`Ajukan ${info.judul.toLowerCase()}`}
          >
            <Plus size={20} />
          </Link>
        </div>
      </header>

      {milikJenis.length === 0 ? (
        <div className="px-5 lg:px-0">
          <div className="border-app bg-surface mt-5 rounded-[var(--radius-card)] border border-dashed px-5 py-12 text-center">
            <FileText size={26} className="text-subtle mx-auto" />
            <p className="text-body mt-3 text-sm font-bold">{info.kosong}</p>
            <p className="text-muted mt-1 text-[13px]">
              Tekan tombol tambah di kanan atas untuk membuatnya.
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-4 space-y-3 px-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0 lg:px-0">
          {milikJenis.map((r) => {
            const p = (r.payload ?? {}) as Record<string, unknown>;
            const tgl = typeof p.tanggal === "string" ? p.tanggal : null;
            const mulai = typeof p.mulai === "string" ? p.mulai : null;
            const selesai = typeof p.selesai === "string" ? p.selesai : null;
            const sampai = typeof p.sampai === "string" ? p.sampai : null;

            const waktu = [
              tgl ? tanggalPendek(tgl) : null,
              sampai && sampai !== tgl ? `– ${tanggalPendek(sampai)}` : null,
              mulai && selesai ? `${mulai.slice(0, 5)} – ${selesai.slice(0, 5)}` : null,
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li
                key={r.id}
                className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="bg-brand-50 dark:bg-brand-900/40 grid size-9 shrink-0 place-items-center rounded-lg">
                    <FileText size={17} className="text-brand-600 dark:text-brand-300" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body text-sm font-bold">{info.judul}</p>
                    <p className="text-subtle text-[12px]">
                      Diajukan {tanggalPendek(tanggalWIB(r.createdAt))}
                    </p>
                  </div>
                  <BadgePengajuan status={r.status} />
                </div>

                <dl className="border-app space-y-1.5 border-t px-4 py-3 text-[13px]">
                  {waktu && (
                    <div className="flex gap-2">
                      <dt className="text-muted w-24 shrink-0">Tanggal/Waktu</dt>
                      <dd className="text-body flex-1 font-semibold">{waktu}</dd>
                    </div>
                  )}
                  {r.alasan && (
                    <div className="flex gap-2">
                      <dt className="text-muted w-24 shrink-0">Alasan</dt>
                      <dd className="text-body flex-1 font-semibold">{r.alasan}</dd>
                    </div>
                  )}
                  {petaCatatan.get(r.id) && (
                    <div className="flex gap-2">
                      <dt className="text-muted w-24 shrink-0">Catatan</dt>
                      <dd className="text-body flex-1 font-semibold">
                        {petaCatatan.get(r.id)}
                      </dd>
                    </div>
                  )}
                </dl>

                {r.status === "PENDING" && (
                  <div className="border-app border-t px-4 py-2.5">
                    <TombolBatal id={r.id} label={info.judul} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
