import Link from "next/link";

import { nilaiUlangAbsensi } from "@/features/attendance/nilai-ulang";
import {
  opsiPenyaring,
  rekapPeriode,
  rentangPeriode,
  totalRekap,
} from "@/features/reports/service";
import { lingkupData } from "@/lib/auth/session";
import { wajibAksesMenu } from "@/lib/auth/akses";
import { cn, formatDurasi } from "@/lib/utils";
import { tanggalPendek, tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "Evaluasi Karyawan" };

/** Pilihan rentang evaluasi, dalam jumlah periode gaji ke belakang. */
const RENTANG = [3, 6, 12] as const;

/**
 * Evaluasi kehadiran jangka panjang.
 *
 * Rekap Absensi menjawab "bagaimana bulan ini", dipakai menggaji. Halaman ini
 * menjawab "bagaimana orang ini selama setengah tahun terakhir" — berapa kali
 * terlambat, berapa kali tidak masuk — yang dipakai menimbang bonus tahunan.
 * Angkanya dihitung dari aturan yang sama persis dengan rekap, hanya
 * rentangnya yang lebih panjang.
 *
 * Rentangnya dihitung per periode gaji (mengikuti tanggal potong di
 * Pengaturan), berakhir hari ini.
 */
export default async function HalamanEvaluasi({
  searchParams,
}: {
  searchParams: Promise<{ rentang?: string; dept?: string }>;
}) {
  const pengguna = await wajibAksesMenu("evaluasi");
  const sp = await searchParams;

  const jumlahBulan = RENTANG.find((r) => String(r) === sp.rentang) ?? RENTANG[0];

  const lingkup = await lingkupData(pengguna);
  const departmentId = lingkup.semua ? sp.dept : (lingkup.departmentId ?? undefined);

  if (!lingkup.semua && !lingkup.departmentId && !lingkup.locationIds?.length) {
    return (
      <div className="grid min-h-[50dvh] place-items-center">
        <div className="max-w-md text-center">
          <h1 className="text-body text-xl font-extrabold tracking-tight">
            Departemen Anda belum ditetapkan
          </h1>
          <p className="text-muted mt-3 text-sm leading-relaxed">
            Evaluasi tim hanya bisa ditampilkan setelah HRD menetapkan departemen pada
            data kepegawaian Anda.
          </p>
        </div>
      </div>
    );
  }

  // Periode gaji paling awal dalam rentang, dihitung mundur dari periode kini.
  const hariIni = tanggalWIB();
  const [tahunKini, bulanKini] = hariIni.split("-").map(Number);
  const m = bulanKini - (jumlahBulan - 1);
  const tahunAwal = tahunKini + Math.floor((m - 1) / 12);
  const bulanAwal = ((((m - 1) % 12) + 12) % 12) + 1;
  const { mulai } = await rentangPeriode(tahunAwal, bulanAwal);
  const akhir = hariIni;

  await nilaiUlangAbsensi({ mulai, akhir });

  const [baris, opsi] = await Promise.all([
    rekapPeriode({
      mulai,
      akhir,
      departmentId,
      locationIds: lingkup.locationIds ?? undefined,
    }),
    opsiPenyaring(),
  ]);
  const total = totalRekap(baris);

  const tautan = (rentang: number) => {
    const q = new URLSearchParams({ rentang: String(rentang) });
    if (lingkup.semua && sp.dept) q.set("dept", sp.dept);
    return `/admin/evaluasi?${q}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-body text-2xl font-extrabold tracking-tight">
          Evaluasi Karyawan
        </h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          Rekap kehadiran jangka panjang untuk menilai karyawan — berapa kali terlambat
          dan tidak masuk — misalnya sebagai bahan bonus tahunan.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-surface border-app flex items-center gap-1 rounded-[var(--radius-input)] border p-1">
          {RENTANG.map((r) => (
            <Link
              key={r}
              href={tautan(r)}
              className={cn(
                "rounded-[calc(var(--radius-input)-4px)] px-3.5 py-1.5 text-sm font-semibold transition-colors",
                r === jumlahBulan
                  ? "bg-brand-600 text-white"
                  : "text-muted hover:bg-surface-muted",
              )}
            >
              {r === 12 ? "1 tahun" : `${r} bulan`}
            </Link>
          ))}
        </div>

        <span className="text-subtle tnum text-xs">
          {tanggalPendek(mulai)} – {tanggalPendek(akhir)}
        </span>

        {lingkup.semua && (
          <form action="/admin/evaluasi" className="flex gap-2">
            <input type="hidden" name="rentang" value={jumlahBulan} />
            <select
              name="dept"
              defaultValue={sp.dept ?? ""}
              className="bg-surface border-app-strong text-body h-10 rounded-[var(--radius-input)] border px-3 text-sm outline-none"
            >
              <option value="">Semua departemen</option>
              {opsi.departemen.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nama}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="border-app-strong bg-surface text-body hover:bg-surface-muted h-10 rounded-[var(--radius-input)] border px-4 text-sm font-semibold transition-colors"
            >
              Terapkan
            </button>
          </form>
        )}
      </div>

      <div className="bg-surface border-app overflow-hidden rounded-[var(--radius-card)] border">
        {baris.length === 0 ? (
          <p className="text-muted px-5 py-16 text-center text-sm">
            Belum ada data absensi pada rentang ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm lg:min-w-[960px]">
              <thead>
                <tr className="border-app text-subtle border-b text-left text-[11px] font-bold tracking-wide uppercase">
                  <th className="px-5 py-2.5">Karyawan</th>
                  <th className="px-2 py-2.5 text-center">Hadir</th>
                  <th className="px-2 py-2.5 text-center">Shift</th>
                  <th className="px-2 py-2.5 text-center">Telat</th>
                  <th className="px-2 py-2.5 text-right">Total telat</th>
                  <th className="px-2 py-2.5 text-center">Pulang cepat</th>
                  <th className="px-2 py-2.5 text-center">Alpa</th>
                  <th className="px-2 py-2.5 text-center">Izin</th>
                  <th className="px-2 py-2.5 text-center">Cuti</th>
                  <th className="px-2 py-2.5 text-right">Lembur</th>
                  <th className="px-5 py-2.5 text-right">Jam kerja</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b) => (
                  <tr
                    key={b.employeeId}
                    className="border-app hover:bg-surface-muted border-b transition-colors last:border-0"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/absensi/${b.employeeId}`}
                        className="text-body hover:text-brand-700 dark:hover:text-brand-300 font-semibold"
                      >
                        {b.nama}
                      </Link>
                      <p className="text-subtle text-xs">
                        {b.jabatan ?? "—"}
                        {b.departemen ? ` · ${b.departemen}` : ""}
                      </p>
                    </td>
                    <td className="text-body tnum px-2 py-3 text-center font-semibold">
                      {b.hadir}
                    </td>
                    <td className="text-muted tnum px-2 py-3 text-center">
                      {b.jumlahShift}
                    </td>
                    <td
                      className={cn(
                        "tnum px-2 py-3 text-center font-semibold",
                        b.terlambat > 0 ? "text-status-late" : "text-muted",
                      )}
                    >
                      {b.terlambat}×
                    </td>
                    <td className="text-muted tnum px-2 py-3 text-right">
                      {b.menitTerlambat > 0 ? formatDurasi(b.menitTerlambat) : "—"}
                    </td>
                    <td className="text-muted tnum px-2 py-3 text-center">
                      {b.pulangCepat}
                    </td>
                    <td
                      className={cn(
                        "tnum px-2 py-3 text-center font-semibold",
                        b.alpa > 0 ? "text-status-absent" : "text-muted",
                      )}
                    >
                      {b.alpa}×
                    </td>
                    <td className="text-muted tnum px-2 py-3 text-center">{b.izin}</td>
                    <td className="text-muted tnum px-2 py-3 text-center">{b.cuti}</td>
                    <td className="text-muted tnum px-2 py-3 text-right">
                      {b.menitLembur > 0 ? formatDurasi(b.menitLembur) : "—"}
                    </td>
                    <td className="text-body tnum px-5 py-3 text-right">
                      {formatDurasi(b.menitKerja)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-muted text-body border-app border-t-2 font-extrabold">
                  <td className="px-5 py-3">TOTAL</td>
                  <td className="tnum px-2 py-3 text-center">{total.hadir}</td>
                  <td className="tnum px-2 py-3 text-center">{total.jumlahShift}</td>
                  <td className="tnum px-2 py-3 text-center">{total.terlambat}×</td>
                  <td className="tnum px-2 py-3 text-right">
                    {formatDurasi(total.menitTerlambat)}
                  </td>
                  <td />
                  <td className="tnum px-2 py-3 text-center">{total.alpa}×</td>
                  <td className="tnum px-2 py-3 text-center">{total.izin}</td>
                  <td className="tnum px-2 py-3 text-center">{total.cuti}</td>
                  <td className="tnum px-2 py-3 text-right">
                    {formatDurasi(total.menitLembur)}
                  </td>
                  <td className="tnum px-5 py-3 text-right">
                    {formatDurasi(total.menitKerja)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="text-subtle max-w-3xl text-xs leading-relaxed">
        Alpa hanya dihitung pada hari yang memang dijadwalkan — lewat Jadwal Jaga atau
        shift default karyawan. Hari tanpa jadwal sama sekali tidak bisa dianggap alpa,
        jadi jadwal yang lengkap membuat angka evaluasi ini akurat.
      </p>
    </div>
  );
}
