import Link from "next/link";
import { and, asc, desc, eq, gt } from "drizzle-orm";

import { IconApproval, IconCuti, IconLembur, IconRiwayat } from "@/components/ikon";
import { FileText } from "lucide-react";

import { BadgePengajuan } from "@/components/ui/status";
import { getDb } from "@/db/client";
import { leaveBalances, leaveTypes, requestApprovals, requests } from "@/db/schema";
import { LABEL_TIPE, rincianPengajuan } from "@/features/requests/ringkasan";
import { TombolBatal } from "@/features/requests/tombol-batal";
import { wajibMasuk } from "@/lib/auth/session";
import { tanggalPendek, tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "Pengajuan" };

export default async function HalamanPengajuan() {
  const pengguna = await wajibMasuk();
  const db = await getDb();
  const tahun = Number(tanggalWIB().slice(0, 4));

  const [daftar, saldo, keputusan] = await Promise.all([
    db
      .select()
      .from(requests)
      .where(eq(requests.employeeId, pengguna.employeeId))
      .orderBy(desc(requests.createdAt))
      .limit(30),
    /*
     * Saldo dibaca dari jenis cutinya, bukan dari baris saldo.
     *
     * Baris saldo baru terbentuk untuk karyawan yang didaftarkan setelah
     * jenis cutinya dibuat; yang lebih dulu masuk tidak punya baris sama
     * sekali dan kartunya menampilkan nol hari padahal kuotanya utuh. Jenis
     * berlampiran tidak ikut — itu wilayah izin/sakit, yang memang tidak
     * berkuota.
     */
    db
      .select({
        nama: leaveTypes.nama,
        kuotaDefault: leaveTypes.kuotaDefault,
        kuota: leaveBalances.kuota,
        carryOver: leaveBalances.carryOverMasuk,
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
      .where(
        and(
          eq(leaveTypes.aktif, true),
          eq(leaveTypes.butuhLampiran, false),
          gt(leaveTypes.kuotaDefault, 0),
        ),
      )
      .orderBy(asc(leaveTypes.nama)),

    // Catatan penyetuju tinggal di tabel tersendiri. Tanpa ini karyawan hanya
    // melihat pengajuannya ditolak tanpa pernah tahu alasannya.
    db
      .select({
        requestId: requestApprovals.requestId,
        catatan: requestApprovals.catatan,
        keputusan: requestApprovals.keputusan,
      })
      .from(requestApprovals)
      .innerJoin(requests, eq(requests.id, requestApprovals.requestId))
      .where(eq(requests.employeeId, pengguna.employeeId)),
  ]);

  const petaCatatan = new Map(
    keputusan
      .filter((k) => k.catatan && k.keputusan !== "PENDING")
      .map((k) => [k.requestId, k.catatan] as const),
  );

  const jenisUtama = saldo[0] ?? null;
  const cutiTahunan = jenisUtama
    ? {
        nama: jenisUtama.nama,
        kuota: jenisUtama.kuota ?? jenisUtama.kuotaDefault,
        carryOver: jenisUtama.carryOver ?? 0,
        terpakai: jenisUtama.terpakai ?? 0,
        pending: jenisUtama.pending ?? 0,
      }
    : null;
  const sisaCuti = cutiTahunan
    ? cutiTahunan.kuota +
      cutiTahunan.carryOver -
      cutiTahunan.terpakai -
      cutiTahunan.pending
    : 0;

  const jenisAjuan = [
    { href: "/pengajuan/cuti", label: "Cuti", Ikon: IconCuti },
    { href: "/pengajuan/lembur", label: "Lembur", Ikon: IconLembur },
    { href: "/pengajuan/koreksi", label: "Presensi Backdate", Ikon: IconRiwayat },
    { href: "/pengajuan/izin", label: "Izin / Sakit", Ikon: IconApproval },
  ];

  return (
    <div className="pb-6">
      <header className="bg-surface border-app pt-safe border-b px-5 pb-5 lg:rounded-[var(--radius-sheet)] lg:border lg:px-7">
        <h1 className="text-body pt-4 text-[18px] font-bold lg:pt-2">Pengajuan</h1>
      </header>

      <div className="lg:mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-start lg:gap-5">
        <div className="lg:space-y-5">
          {/* Saldo cuti */}
          <div className="mt-4 px-5 lg:mt-0 lg:px-0">
            <div className="bg-surface rounded-[var(--radius-sheet)] p-5 shadow-[var(--shadow-raised)]">
              <p className="text-subtle text-xs font-semibold">
                Sisa {cutiTahunan?.nama ?? "cuti"} {tahun}
              </p>
              <p className="tnum text-body mt-1 text-[32px] leading-none font-bold">
                {sisaCuti} <span className="text-muted text-base font-bold">hari</span>
              </p>
              {cutiTahunan && (
                <div className="border-app text-muted mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center text-[11px]">
                  <div>
                    <p className="text-body tnum text-sm font-bold">
                      {cutiTahunan.kuota}
                    </p>
                    <p className="mt-0.5">Kuota</p>
                  </div>
                  <div>
                    <p className="text-body tnum text-sm font-bold">
                      +{cutiTahunan.carryOver}
                    </p>
                    <p className="mt-0.5">Sisa tahun lalu</p>
                  </div>
                  <div>
                    <p className="text-body tnum text-sm font-bold">
                      {cutiTahunan.terpakai}
                    </p>
                    <p className="mt-0.5">Terpakai</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Jenis pengajuan */}
          <section className="mt-6 px-5 lg:mt-0 lg:px-0">
            <h2 className="text-body text-[13px] font-semibold">Jenis pengajuan</h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {jenisAjuan.map(({ href, label, Ikon }) => (
                <Link
                  key={href}
                  href={href}
                  className="bg-surface border-app hover:border-brand-300 flex items-center gap-3 rounded-[var(--radius-card)] border px-3.5 py-3.5 transition-colors"
                >
                  <Ikon size={36} />
                  <span className="text-body text-[13px] leading-tight font-bold">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* Riwayat pengajuan */}
        <section className="mt-6 px-5 lg:mt-0 lg:px-0">
          <h2 className="text-body text-[13px] font-semibold">Riwayat pengajuan</h2>

          {daftar.length === 0 ? (
            <div className="border-app bg-surface mt-3 rounded-[var(--radius-card)] border px-5 py-9 text-center">
              <p className="text-body text-sm font-bold">Belum ada pengajuan</p>
              <p className="text-muted mt-1 text-[13px]">
                Pengajuan yang Anda buat akan muncul di sini.
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {daftar.map((r) => {
                // Rincian tiap jenis dibaca lewat penolong bersama, sama persis
                // dengan yang dipakai layar persetujuan admin.
                const rincian = rincianPengajuan(
                  r.tipe,
                  r.payload as Record<string, unknown>,
                );

                return (
                  <li
                    key={r.id}
                    className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border"
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="bg-brand-50 dark:bg-brand-900/40 grid size-9 shrink-0 place-items-center rounded-lg">
                        <FileText
                          size={17}
                          className="text-brand-600 dark:text-brand-300"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-body text-sm font-bold">
                          {LABEL_TIPE[r.tipe]}
                        </p>
                        <p className="text-subtle text-[12px]">
                          Diajukan {tanggalPendek(tanggalWIB(r.createdAt))}
                        </p>
                      </div>
                      <BadgePengajuan status={r.status} />
                    </div>

                    <dl className="border-app space-y-1.5 border-t px-4 py-3 text-[13px]">
                      {rincian.map((b) => (
                        <div key={b.label} className="flex gap-2">
                          <dt className="text-muted w-24 shrink-0">{b.label}</dt>
                          <dd className="text-body flex-1 font-semibold">{b.nilai}</dd>
                        </div>
                      ))}
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
                        <TombolBatal id={r.id} label={LABEL_TIPE[r.tipe]} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
