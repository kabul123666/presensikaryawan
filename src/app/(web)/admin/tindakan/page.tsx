import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Card, CardBody } from "@/components/ui/card";
import {
  daftarJabatan,
  daftarTindakan,
  semuaTarifKhusus,
} from "@/features/master/service";
import { PanelKatalog, type BarisKatalog } from "@/features/procedures/panel-katalog";
import {
  PanelVerifikasi,
  type BarisTindakan,
} from "@/features/procedures/panel-verifikasi";
import {
  daftarTindakanTercatat,
  rekapFeePerKaryawan,
  rekapPerJenis,
  ringkasanTindakan,
} from "@/features/procedures/service";
import { wajibAksesMenu } from "@/lib/auth/akses";
import { cn, formatRupiah } from "@/lib/utils";
import { namaBulan, tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "Tindakan & Fee" };

const TAB = [
  { nilai: "verifikasi", label: "Verifikasi" },
  { nilai: "rekap", label: "Rekap Fee" },
  { nilai: "katalog", label: "Katalog & Tarif" },
] as const;

export default async function HalamanTindakan({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; bulan?: string }>;
}) {
  await wajibAksesMenu("tindakan");
  const sp = await searchParams;

  const tab = (TAB.find((t) => t.nilai === sp.tab)?.nilai ?? "verifikasi") as
    "verifikasi" | "rekap" | "katalog";

  const kini = tanggalWIB();
  const cocok = /^(\d{4})-(\d{2})$/.exec(sp.bulan ?? "");
  const tahun = cocok ? Number(cocok[1]) : Number(kini.slice(0, 4));
  const bulan = cocok ? Number(cocok[2]) : Number(kini.slice(5, 7));

  const ringkas = await ringkasanTindakan(tahun, bulan);

  const geser = (delta: number) => {
    const m = bulan + delta;
    const t = tahun + Math.floor((m - 1) / 12);
    const b = ((((m - 1) % 12) + 12) % 12) + 1;
    return `/admin/tindakan?tab=${tab}&bulan=${t}-${String(b).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-body text-2xl font-extrabold tracking-tight">
          Tindakan &amp; Fee · {TAB.find((t) => t.nilai === tab)?.label}
        </h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          Verifikasi tindakan yang dicatat karyawan saat clock out, lihat rekap fee, dan
          kelola katalog beserta tarifnya.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          {
            label: "Tindakan tercatat",
            nilai: String(ringkas.total),
            warna: "text-body",
          },
          {
            label: "Menunggu verifikasi",
            nilai: String(ringkas.menunggu),
            warna: "text-status-late",
          },
          {
            label: "Nilai keseluruhan",
            nilai: formatRupiah(ringkas.nilaiTotal),
            warna: "text-body",
          },
          {
            label: "Belum diverifikasi",
            nilai: formatRupiah(ringkas.nilaiMenunggu),
            warna: "text-status-late",
          },
        ].map((k) => (
          <Card key={k.label}>
            <CardBody>
              <p className="text-subtle text-xs font-bold tracking-wide uppercase">
                {k.label}
              </p>
              <p
                className={cn("tnum mt-2 text-2xl leading-none font-extrabold", k.warna)}
              >
                {k.nilai}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {tab !== "katalog" && (
          <div className="bg-surface border-app flex items-center rounded-[var(--radius-input)] border">
            <Link
              href={geser(-1)}
              className="text-muted hover:bg-surface-muted grid size-10 place-items-center rounded-l-[var(--radius-input)]"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft size={18} />
            </Link>
            <span className="text-body min-w-36 px-3 text-center text-sm font-bold">
              {namaBulan(tahun, bulan)}
            </span>
            <Link
              href={geser(1)}
              className="text-muted hover:bg-surface-muted grid size-10 place-items-center rounded-r-[var(--radius-input)]"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight size={18} />
            </Link>
          </div>
        )}
      </div>

      {tab === "verifikasi" && <TabVerifikasi tahun={tahun} bulan={bulan} />}
      {tab === "rekap" && <TabRekap tahun={tahun} bulan={bulan} />}
      {tab === "katalog" && <TabKatalog />}
    </div>
  );
}

async function TabVerifikasi({ tahun, bulan }: { tahun: number; bulan: number }) {
  const daftar = await daftarTindakanTercatat({ tahun, bulan });
  return (
    <PanelVerifikasi
      daftar={daftar.map((d): BarisTindakan => ({
        id: d.id,
        namaTindakan: d.namaTindakan,
        jumlah: d.jumlah,
        feeSnapshot: d.feeSnapshot,
        kodePasien: d.kodePasien,
        status: d.status,
        tanggal: d.tanggal,
        nama: d.nama,
        jabatan: d.jabatan,
        kategori: d.kategori ?? "—",
      }))}
    />
  );
}

async function TabRekap({ tahun, bulan }: { tahun: number; bulan: number }) {
  const [perKaryawan, perJenis] = await Promise.all([
    rekapFeePerKaryawan(tahun, bulan),
    rekapPerJenis(tahun, bulan),
  ]);

  const periode = `${tahun}-${String(bulan).padStart(2, "0")}`;

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border">
        <h2 className="border-app text-body border-b px-5 py-4 text-base font-extrabold">
          Fee per karyawan
        </h2>
        {perKaryawan.length === 0 ? (
          <p className="text-muted px-5 py-12 text-center text-sm">
            Belum ada tindakan pada periode ini.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-app text-subtle border-b text-left text-[11px] font-bold tracking-wide uppercase">
                <th className="px-5 py-2.5">Karyawan</th>
                <th className="px-3 py-2.5 text-center">Tindakan</th>
                <th className="px-3 py-2.5 text-right">Terverifikasi</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-5 py-2.5 text-right">Slip</th>
              </tr>
            </thead>
            <tbody>
              {perKaryawan.map((k) => (
                <tr key={k.employeeId} className="border-app border-b last:border-0">
                  <td className="px-5 py-3">
                    <p className="text-body font-semibold">{k.nama}</p>
                    <p className="text-subtle text-xs">{k.jabatan ?? "—"}</p>
                  </td>
                  <td className="text-body tnum px-3 py-3 text-center">
                    {k.jumlahTindakan}
                    {k.menunggu > 0 && (
                      <span className="text-status-late block text-[11px] font-semibold">
                        {k.menunggu} menunggu
                      </span>
                    )}
                  </td>
                  <td className="text-status-ontime tnum px-3 py-3 text-right font-semibold">
                    {formatRupiah(k.totalTerverifikasi)}
                  </td>
                  <td className="text-body tnum px-3 py-3 text-right font-extrabold">
                    {formatRupiah(k.totalDiajukan)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/admin/tindakan/slip/${k.employeeId}?bulan=${periode}`}
                      className="text-brand-700 dark:text-brand-300 text-xs font-semibold underline underline-offset-2"
                    >
                      Lihat slip
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border">
        <h2 className="border-app text-body border-b px-5 py-4 text-base font-extrabold">
          Per jenis tindakan
        </h2>
        {perJenis.length === 0 ? (
          <p className="text-muted px-5 py-12 text-center text-sm">Belum ada data.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-app text-subtle border-b text-left text-[11px] font-bold tracking-wide uppercase">
                <th className="px-5 py-2.5">Tindakan</th>
                <th className="px-3 py-2.5 text-center">Jumlah</th>
                <th className="px-5 py-2.5 text-right">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {perJenis.map((j) => (
                <tr key={j.nama} className="border-app border-b last:border-0">
                  <td className="text-body px-5 py-3 font-medium">
                    {j.nama}
                    <span className="text-subtle ml-2 text-xs">{j.kategori}</span>
                  </td>
                  <td className="text-body tnum px-3 py-3 text-center">{j.jumlah}</td>
                  <td className="text-body tnum px-5 py-3 text-right font-semibold">
                    {formatRupiah(j.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

async function TabKatalog() {
  const [daftar, jabatan, tarif] = await Promise.all([
    daftarTindakan(),
    daftarJabatan(),
    semuaTarifKhusus(),
  ]);
  return (
    <PanelKatalog
      jabatan={jabatan.map((j) => ({ id: j.id, nama: j.nama }))}
      tarif={tarif}
      daftar={daftar.map((t): BarisKatalog => ({
        ...t,
        jumlahTarifKhusus: Number(t.jumlahTarifKhusus),
      }))}
    />
  );
}
