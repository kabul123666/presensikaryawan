import { Card, CardBody } from "@/components/ui/card";
import type { RequestStatus } from "@/db/schema";
import { ringkasanAntrean } from "@/features/approval/actions";
import {
  daftarPengajuan,
  hitungPerStatus,
  petaJenisCuti,
  saringYangBolehDiputuskan,
} from "@/features/approval/service";
import {
  TabelPersetujuan,
  type BarisTampil,
} from "@/features/approval/tabel-persetujuan";
import { wajibAksesMenu } from "@/lib/auth/akses";
import { lingkupData } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "Antrean Persetujuan" };

const TAB: { nilai: RequestStatus | "SEMUA"; label: string }[] = [
  { nilai: "PENDING", label: "Menunggu" },
  { nilai: "APPROVED", label: "Disetujui" },
  { nilai: "REJECTED", label: "Ditolak" },
  { nilai: "SEMUA", label: "Semua" },
];

export default async function HalamanPersetujuan({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const pengguna = await wajibAksesMenu("persetujuan");

  // Pemilik klinik hanya melihat pengajuan dari cabangnya.
  const lingkup = await lingkupData(pengguna);
  const sp = await searchParams;

  const status = (TAB.find((t) => t.nilai === sp.status)?.nilai ?? "PENDING") as
    RequestStatus | "SEMUA";

  const [daftar, hitung, ringkas, jenisCuti] = await Promise.all([
    daftarPengajuan(status, lingkup.locationIds),
    hitungPerStatus(lingkup.locationIds),
    ringkasanAntrean(),
    petaJenisCuti(),
  ]);

  // Wewenang dihitung di server untuk setiap baris, lalu dipakai lagi
  // sebagai penjaga di dalam server action — bukan hanya untuk UI.
  const wewenang = await saringYangBolehDiputuskan(pengguna, daftar);

  const baris: BarisTampil[] = daftar.map((d) => ({
    id: d.id,
    tipe: d.tipe,
    status: d.status,
    alasan: d.alasan,
    payload: d.payload,
    createdAt: tanggalWIB(d.createdAt),
    currentStep: d.currentStep,
    totalStep: d.totalStep,
    nama: d.nama,
    jabatan: d.jabatan,
    departemen: d.departemen,
  }));

  const bisaDiputuskan = Object.values(wewenang).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-body text-2xl font-extrabold tracking-tight">
          Antrean Persetujuan · {TAB.find((t) => t.nilai === status)?.label}
          <span className="text-muted tnum ml-2 text-lg font-bold">
            {hitung[status] ?? 0}
          </span>
        </h1>
        <p className="text-muted mt-1 text-sm">
          Cuti, lembur, koreksi absen, dan absen di luar area dalam satu tempat.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Menunggu keputusan",
            nilai: ringkas.menunggu,
            catatan: "Seluruh jenis pengajuan",
            warna: "text-status-late",
          },
          {
            label: "Masuk hari ini",
            nilai: ringkas.hariIni,
            catatan: "Diajukan pada tanggal ini",
            warna: "text-body",
          },
          {
            label: "Wewenang Anda",
            nilai: bisaDiputuskan,
            catatan: "Bisa Anda putuskan sekarang",
            warna: "text-status-ontime",
          },
        ].map((k) => (
          <Card key={k.label}>
            <CardBody>
              <p className="text-subtle text-xs font-bold tracking-wide uppercase">
                {k.label}
              </p>
              <p
                className={cn("tnum mt-2 text-3xl leading-none font-extrabold", k.warna)}
              >
                {k.nilai}
              </p>
              <p className="text-muted mt-2 text-xs">{k.catatan}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <TabelPersetujuan
        daftar={baris}
        wewenang={wewenang}
        namaJenisCuti={Object.fromEntries(jenisCuti)}
      />
    </div>
  );
}
