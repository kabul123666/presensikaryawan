import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, MapPin } from "lucide-react";

import { BadgeAbsen } from "@/components/ui/status";
import { Badge } from "@/components/ui/status";
import { getDb } from "@/db/client";
import { departments, employees, positions, users } from "@/db/schema";
import { rekapPeriodeAtauKunci } from "@/features/reports/kunci";
import { detailHarian, rentangPeriode } from "@/features/reports/service";
import { TombolCetak } from "@/features/reports/tombol-cetak";
import { lingkupData, PERAN_PENYETUJU, wajibPeran } from "@/lib/auth/session";
import { formatDurasi, formatRupiah } from "@/lib/utils";
import { jamWIB, namaBulan, tanggalPanjang, tanggalWIB } from "@/lib/waktu";

const LABEL_FLAG: Record<string, string> = {
  MOCK_GPS: "Indikasi GPS palsu",
  DILUAR_AREA: "Absen di luar area",
  DILUAR_AREA_PULANG: "Pulang di luar area",
  DEVICE_BARU: "Perangkat baru",
  HARI_LIBUR: "Absen di hari libur",
  TANPA_SHIFT: "Tanpa shift terjadwal",
};

export default async function HalamanDetailAbsensi({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ bulan?: string }>;
}) {
  const pengguna = await wajibPeran(...PERAN_PENYETUJU);
  const { employeeId } = await params;
  const sp = await searchParams;

  const kini = tanggalWIB();
  const cocok = /^(\d{4})-(\d{2})$/.exec(sp.bulan ?? "");
  const tahun = cocok ? Number(cocok[1]) : Number(kini.slice(0, 4));
  const bulan = cocok ? Number(cocok[2]) : Number(kini.slice(5, 7));

  const db = await getDb();
  const [karyawan] = await db
    .select({
      nama: employees.nama,
      nik: users.nik,
      jabatan: positions.nama,
      departemen: departments.nama,
      departmentId: employees.departmentId,
    })
    .from(employees)
    .innerJoin(users, eq(users.id, employees.userId))
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!karyawan) notFound();

  // Manager hanya boleh membuka anggota departemennya sendiri.
  const lingkup = lingkupData(pengguna);
  if (!lingkup.semua && karyawan.departmentId !== lingkup.departmentId) {
    redirect("/tidak-berwenang");
  }

  const rentang = await rentangPeriode(tahun, bulan);

  const [detail, hasilRekap] = await Promise.all([
    detailHarian({ ...rentang, employeeId }),
    rekapPeriodeAtauKunci({ ...rentang, employeeId }),
  ]);
  const rekap = hasilRekap.baris;
  const ringkas = rekap[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/admin/absensi?bulan=${tahun}-${String(bulan).padStart(2, "0")}`}
            className="text-muted hover:text-body inline-flex items-center gap-1.5 text-sm font-semibold print:hidden"
          >
            <ArrowLeft size={15} /> Kembali ke rekap
          </Link>
          <h1 className="text-body mt-2 text-2xl font-extrabold tracking-tight">
            {karyawan.nama}
          </h1>
          <p className="text-muted mt-1 text-sm">
            {karyawan.nik ?? "—"} · {karyawan.jabatan ?? "—"}
            {karyawan.departemen ? ` · ${karyawan.departemen}` : ""} ·{" "}
            {namaBulan(tahun, bulan)}
          </p>
        </div>
        <div className="print:hidden">
          <TombolCetak label="Cetak rincian" />
        </div>
      </div>

      {ringkas && (
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Hadir", nilai: String(ringkas.hadir) },
            { label: "Terlambat", nilai: String(ringkas.terlambat) },
            { label: "Total telat", nilai: formatDurasi(ringkas.menitTerlambat) },
            { label: "Lembur", nilai: formatDurasi(ringkas.menitLembur) },
            { label: "Jam kerja", nilai: formatDurasi(ringkas.menitKerja) },
            { label: "Fee tindakan", nilai: formatRupiah(ringkas.totalFee) },
          ].map((k) => (
            <div
              key={k.label}
              className="bg-surface border-app rounded-[var(--radius-card)] border px-4 py-3"
            >
              <p className="text-subtle text-[11px] font-bold tracking-wide uppercase">
                {k.label}
              </p>
              <p className="text-body tnum mt-1 text-lg font-extrabold">{k.nilai}</p>
            </div>
          ))}
        </div>
      )}

      {detail.length === 0 ? (
        <p className="text-muted bg-surface border-app rounded-[var(--radius-card)] border px-5 py-16 text-center text-sm">
          Tidak ada catatan absensi pada periode ini.
        </p>
      ) : (
        <ul className="space-y-3">
          {detail.map((d) => (
            <li
              key={d.id}
              className="bg-surface border-app rounded-[var(--radius-card)] border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-body text-sm font-bold">
                    {tanggalPanjang(d.tanggal)}
                  </p>
                  <p className="text-muted tnum mt-1 text-sm">
                    {d.clockInAt ? jamWIB(d.clockInAt) : "--:--"} →{" "}
                    {d.clockOutAt ? jamWIB(d.clockOutAt) : "--:--"}
                    {d.durasiKerjaMenit > 0 && (
                      <span className="text-subtle">
                        {" "}
                        · {formatDurasi(d.durasiKerjaMenit)}
                      </span>
                    )}
                    {d.shift && <span className="text-subtle"> · shift {d.shift}</span>}
                  </p>

                  {d.clockInAddress && (
                    <p className="text-subtle mt-1 flex items-start gap-1 text-xs">
                      <MapPin size={12} className="mt-0.5 shrink-0" />
                      {d.clockInAddress}
                      {d.clockInDistanceM !== null && ` · ${d.clockInDistanceM} m`}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {d.menitTerlambat > 0 && (
                      <Badge tone="warn">Terlambat {d.menitTerlambat} menit</Badge>
                    )}
                    {d.menitLembur > 0 && (
                      <Badge tone="brand">Lembur {formatDurasi(d.menitLembur)}</Badge>
                    )}
                    {d.hasilKoreksi && <Badge tone="netral">Hasil koreksi</Badge>}
                    {d.flags.map((f) => (
                      <Badge key={f} tone="danger">
                        {LABEL_FLAG[f] ?? f}
                      </Badge>
                    ))}
                  </div>

                  {d.catatanKerja && (
                    <p className="text-muted bg-surface-muted mt-2 rounded-lg px-3 py-2 text-[13px] leading-relaxed">
                      {d.catatanKerja}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-start gap-3">
                  <BadgeAbsen status={d.status} />
                  {/* Foto bukti absensi — hanya bisa dibuka oleh admin atau
                      pemiliknya sendiri lewat route /api/berkas. */}
                  <div className="flex gap-2 print:hidden">
                    {d.clockInPhoto && (
                      <a
                        href={`/api/berkas/${d.clockInPhoto}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="block"
                        title="Foto absen masuk"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/berkas/${d.clockInPhoto}`}
                          alt={`Foto absen masuk ${d.tanggal}`}
                          className="border-app size-20 rounded-lg border object-cover"
                          loading="lazy"
                        />
                      </a>
                    )}
                    {d.clockOutPhoto && (
                      <a
                        href={`/api/berkas/${d.clockOutPhoto}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="block"
                        title="Foto absen pulang"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/berkas/${d.clockOutPhoto}`}
                          alt={`Foto absen pulang ${d.tanggal}`}
                          className="border-app size-20 rounded-lg border object-cover"
                          loading="lazy"
                        />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
