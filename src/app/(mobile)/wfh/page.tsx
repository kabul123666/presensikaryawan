import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { ArrowLeft, House, ScanFace } from "lucide-react";

import { BadgeAbsen } from "@/components/ui/status";
import { getDb } from "@/db/client";
import { attendances } from "@/db/schema";
import { wajibMasuk } from "@/lib/auth/session";
import { formatDurasi } from "@/lib/utils";
import { geserTanggal, jamWIB, tanggalPendek, tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "WFH" };

/**
 * Bekerja dari rumah.
 *
 * Tidak ada formulir pengajuan di sini: WFH bukan sesuatu yang diminta lalu
 * disetujui, melainkan kewenangan yang melekat pada kepala unit — ia boleh
 * absen dari luar area, dan absen itu ditandai WFH. Halaman ini menjelaskan
 * aturannya dan menampilkan hari-hari yang tercatat, supaya yang bersangkutan
 * maupun HRD punya satu tempat untuk melihatnya.
 */
export default async function HalamanWFH() {
  const pengguna = await wajibMasuk();
  const boleh = pengguna.role === "MANAGER";

  const db = await getDb();
  const sejak = geserTanggal(tanggalWIB(), -60);

  const daftar = boleh
    ? await db
        .select()
        .from(attendances)
        .where(
          and(
            eq(attendances.employeeId, pengguna.employeeId),
            gte(attendances.tanggal, sejak),
            sql`${attendances.flags} @> '["WFH"]'::jsonb`,
          ),
        )
        .orderBy(desc(attendances.tanggal))
        .limit(60)
    : [];

  return (
    <div className="pb-6 lg:mx-auto lg:max-w-[720px]">
      <header className="bg-surface border-app pt-safe border-b px-5 pb-5 lg:rounded-[var(--radius-sheet)] lg:border lg:px-7">
        <div className="flex items-center gap-3 pt-4 lg:pt-2">
          <Link
            href="/menu"
            className="text-muted hover:bg-surface-muted hover:text-body grid size-9 place-items-center rounded-full transition-colors lg:hidden"
            aria-label="Kembali ke menu"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-body text-[18px] font-bold">Bekerja dari Rumah</h1>
        </div>
      </header>

      <section className="mt-4 px-5 lg:px-0">
        <div className="bg-surface border-app rounded-[var(--radius-card)] border p-4">
          <div className="flex items-start gap-3">
            <span className="bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300 grid size-10 shrink-0 place-items-center rounded-xl">
              <House size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-body text-sm font-bold">
                {boleh ? "Anda boleh absen dari rumah" : "Menu ini untuk kepala unit"}
              </p>
              <p className="text-muted mt-1 text-[13px] leading-relaxed">
                {boleh
                  ? "Absen seperti biasa lewat menu Presensi — foto selfie tetap wajib. Karena Anda kepala unit, jarak ke klinik tidak diperiksa, dan hari itu tercatat sebagai WFH."
                  : "Absen dari luar area hanya bisa dilakukan kepala unit. Bila Anda perlu bekerja dari rumah, bicarakan dengan atasan Anda atau ajukan Izin lewat menu Pengajuan."}
              </p>
            </div>
          </div>

          {boleh && (
            <Link
              href="/riwayat"
              className="bg-brand-600 hover:bg-brand-700 mt-4 flex h-11 items-center justify-center gap-2 rounded-full text-sm font-bold text-white transition-colors"
            >
              <ScanFace size={17} /> Buka layar absen
            </Link>
          )}
        </div>
      </section>

      {boleh && (
        <section className="mt-6 px-5 lg:px-0">
          <h2 className="text-body text-[13px] font-semibold">
            Tercatat WFH — 60 hari terakhir
          </h2>

          {daftar.length === 0 ? (
            <div className="border-app bg-surface mt-3 rounded-[var(--radius-card)] border px-5 py-9 text-center">
              <p className="text-body text-sm font-bold">Belum ada</p>
              <p className="text-muted mt-1 text-[13px]">
                Hari yang Anda absen dari luar area akan muncul di sini.
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {daftar.map((d) => (
                <li
                  key={d.id}
                  className="bg-surface border-app flex items-center gap-3 rounded-[var(--radius-card)] border px-4 py-3"
                >
                  <span className="bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300 grid size-9 shrink-0 place-items-center rounded-lg">
                    <House size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body text-sm font-bold">
                      {tanggalPendek(d.tanggal)}
                    </p>
                    <p className="text-subtle tnum text-[12px]">
                      {d.clockInAt ? jamWIB(d.clockInAt) : "--:--"} →{" "}
                      {d.clockOutAt ? jamWIB(d.clockOutAt) : "--:--"}
                      {d.durasiKerjaMenit > 0
                        ? ` · ${formatDurasi(d.durasiKerjaMenit)}`
                        : ""}
                    </p>
                  </div>
                  <BadgeAbsen status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
