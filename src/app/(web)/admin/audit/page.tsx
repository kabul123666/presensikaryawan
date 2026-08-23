import Link from "next/link";

import { Badge } from "@/components/ui/status";
import { daftarAuditLog, jenisAksiAudit } from "@/features/settings/service";
import { wajibAksesMenu } from "@/lib/auth/akses";
import { cn } from "@/lib/utils";
import { jamDetikWIB, tanggalPendek, tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "Audit Log" };

/** Aksi yang mengubah uang atau akses diberi penanda merah. */
const AKSI_SENSITIF = new Set([
  "RESET_PASSWORD",
  "NONAKTIFKAN_AKUN",
  "TUTUP_TAHUN_CUTI",
  "HAPUS_ATURAN_PERSETUJUAN",
  "LEPAS_PERANGKAT",
  "TOLAK_PENDAFTARAN",
]);

function ringkasNilai(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return "—";
  if (typeof nilai !== "object") return String(nilai);
  const isi = Object.entries(nilai as Record<string, unknown>)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? "…" : String(v)}`)
    .join(" · ");
  return isi || "—";
}

export default async function HalamanAudit({
  searchParams,
}: {
  searchParams: Promise<{ aksi?: string }>;
}) {
  await wajibAksesMenu("audit");
  const sp = await searchParams;

  const [daftar, jenisAksi] = await Promise.all([
    daftarAuditLog({ aksi: sp.aksi }),
    jenisAksiAudit(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-body text-2xl font-extrabold tracking-tight">Audit Log</h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          Jejak seluruh perubahan data: siapa melakukan apa, kapan, dan dari alamat mana.
          Catatan ini tidak dapat diubah maupun dihapus dari dalam aplikasi.
        </p>
      </div>

      {/* Penyaring jenis aksi */}
      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/admin/audit"
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            !sp.aksi
              ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/50 dark:text-brand-100"
              : "border-app-strong text-muted hover:bg-surface-muted",
          )}
        >
          Semua
        </Link>
        {jenisAksi.map((a) => (
          <Link
            key={a}
            href={`/admin/audit?aksi=${a}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              sp.aksi === a
                ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/50 dark:text-brand-100"
                : "border-app-strong text-muted hover:bg-surface-muted",
            )}
          >
            {a}
          </Link>
        ))}
      </div>

      <div className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border">
        {daftar.length === 0 ? (
          <p className="text-muted px-5 py-16 text-center text-sm">
            Belum ada catatan untuk penyaring ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-app text-subtle border-b text-left text-[11px] font-bold tracking-wide uppercase">
                  <th className="px-5 py-2.5">Waktu</th>
                  <th className="px-3 py-2.5">Pelaku</th>
                  <th className="px-3 py-2.5">Aksi</th>
                  <th className="px-3 py-2.5">Entitas</th>
                  <th className="px-5 py-2.5">Perubahan</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((a) => (
                  <tr
                    key={a.id}
                    className="border-app hover:bg-surface-muted border-b align-top transition-colors last:border-0"
                  >
                    <td className="text-muted tnum px-5 py-3 whitespace-nowrap">
                      {tanggalPendek(tanggalWIB(a.createdAt))}
                      <span className="text-subtle block text-xs">
                        {jamDetikWIB(a.createdAt)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-body font-semibold">{a.pelaku ?? "Sistem"}</p>
                      <p className="text-subtle text-xs">{a.usernamePelaku ?? "—"}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={AKSI_SENSITIF.has(a.aksi) ? "danger" : "netral"}>
                        {a.aksi}
                      </Badge>
                    </td>
                    <td className="text-muted px-3 py-3">
                      {a.entitas}
                      <span className="text-subtle block font-mono text-[11px]">
                        {a.entitasId?.slice(0, 8) ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {a.before && (
                        <p className="text-subtle text-xs">
                          <span className="font-semibold">Sebelum:</span>{" "}
                          {ringkasNilai(a.before)}
                        </p>
                      )}
                      {a.after && (
                        <p className="text-muted text-xs">
                          <span className="font-semibold">Sesudah:</span>{" "}
                          {ringkasNilai(a.after)}
                        </p>
                      )}
                      {a.ip && (
                        <p className="text-subtle mt-0.5 font-mono text-[11px]">{a.ip}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-subtle text-xs">
        Menampilkan 200 catatan terbaru. Password tidak pernah ikut tercatat.
      </p>
    </div>
  );
}
