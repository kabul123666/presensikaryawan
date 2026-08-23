import { Card, CardBody } from "@/components/ui/card";
import type { UserStatus } from "@/db/schema";
import { antreanPendaftaranBaru } from "@/features/employees/actions";
import { PanelKaryawan } from "@/features/employees/panel-karyawan";
import {
  daftarKaryawan,
  hitungStatusKaryawan,
  opsiFormulir,
  ringkasanKaryawan,
} from "@/features/employees/service";
import { wajibAksesMenu } from "@/lib/auth/akses";
import { cn } from "@/lib/utils";
import { tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "Manajemen Karyawan" };

const TAB: { nilai: UserStatus | "SEMUA"; label: string }[] = [
  { nilai: "SEMUA", label: "Semua" },
  { nilai: "ACTIVE", label: "Aktif" },
  { nilai: "PENDING_APPROVAL", label: "Menunggu" },
  { nilai: "SUSPENDED", label: "Nonaktif" },
];

export default async function HalamanKaryawan({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cari?: string; dept?: string }>;
}) {
  await wajibAksesMenu("karyawan");
  const sp = await searchParams;

  const status = (TAB.find((t) => t.nilai === sp.status)?.nilai ?? "SEMUA") as
    UserStatus | "SEMUA";

  const [daftar, hitung, ringkas, opsi, pendaftaran] = await Promise.all([
    daftarKaryawan({ cari: sp.cari, departmentId: sp.dept, status }),
    hitungStatusKaryawan(),
    ringkasanKaryawan(),
    opsiFormulir(),
    antreanPendaftaranBaru(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-body text-2xl font-extrabold tracking-tight">
          Manajemen Karyawan · {TAB.find((t) => t.nilai === status)?.label}
          <span className="text-muted tnum ml-2 text-lg font-bold">
            {hitung[status] ?? 0}
          </span>
        </h1>
        <p className="text-muted mt-1 text-sm">
          Pendaftaran akun, verifikasi, peran, dan status kepegawaian.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total karyawan", nilai: ringkas.total, warna: "text-body" },
          { label: "Aktif", nilai: ringkas.aktif, warna: "text-status-ontime" },
          {
            label: "Menunggu verifikasi",
            nilai: ringkas.menunggu,
            warna: "text-status-late",
          },
          { label: "Nonaktif", nilai: ringkas.nonaktif, warna: "text-status-absent" },
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
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Penyaring */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex gap-2" action="/admin/karyawan">
          <input type="hidden" name="status" value={status} />
          <input
            name="cari"
            defaultValue={sp.cari ?? ""}
            placeholder="Cari nama, email, atau NIK…"
            className="bg-surface border-app-strong text-body placeholder:text-subtle focus:border-brand-500 focus:ring-brand-500/12 h-10 w-64 rounded-[var(--radius-input)] border px-3.5 text-sm outline-none focus:ring-4"
          />
          <button
            type="submit"
            className="border-app-strong bg-surface text-body hover:bg-surface-muted h-10 rounded-[var(--radius-input)] border px-4 text-sm font-semibold transition-colors"
          >
            Cari
          </button>
        </form>
      </div>

      <PanelKaryawan
        daftar={daftar}
        opsi={opsi}
        pendaftaran={pendaftaran.map((p) => ({
          userId: p.userId,
          nama: p.nama,
          username: p.username,
          nik: p.nik,
          noHp: p.noHp,
          createdAt: tanggalWIB(p.createdAt),
        }))}
      />
    </div>
  );
}
