import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PanelRoster } from "@/features/roster/panel-roster";
import { jadwalBulan, karyawanRoster, shiftRoster } from "@/features/roster/service";
import { wajibAksesMenu } from "@/lib/auth/akses";
import {
  batasBulan,
  namaBulan,
  selisihHari,
  geserTanggal,
  tanggalWIB,
} from "@/lib/waktu";

export const metadata = { title: "Jadwal Jaga" };

export default async function HalamanJadwal({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  await wajibAksesMenu("jadwal");
  const sp = await searchParams;

  const kini = tanggalWIB();
  const cocok = /^(\d{4})-(\d{2})$/.exec(sp.bulan ?? "");
  const tahun = cocok ? Number(cocok[1]) : Number(kini.slice(0, 4));
  const bulan = cocok ? Number(cocok[2]) : Number(kini.slice(5, 7));

  const [karyawan, shift, isi] = await Promise.all([
    karyawanRoster(),
    shiftRoster(),
    jadwalBulan(tahun, bulan),
  ]);

  const { mulai, akhir } = batasBulan(tahun, bulan);
  const jumlahHari = selisihHari(mulai, akhir) + 1;
  const hari = Array.from({ length: jumlahHari }, (_, i) => {
    const tanggal = geserTanggal(mulai, i);
    const [y, m, d] = tanggal.split("-").map(Number);
    return {
      tanggal,
      tgl: d,
      dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
    };
  });

  const geser = (delta: number) => {
    const mm = bulan + delta;
    const t = tahun + Math.floor((mm - 1) / 12);
    const b = ((((mm - 1) % 12) + 12) % 12) + 1;
    return `/admin/jadwal?bulan=${t}-${String(b).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-body text-xl font-semibold">Jadwal Jaga</h1>
          <p className="text-muted mt-1 max-w-2xl text-[13px]">
            Jadwal per tanggal menimpa shift default karyawan. Status terlambat dan lembur
            dihitung terhadap shift yang berlaku pada tanggal tersebut.
          </p>
        </div>

        <div className="bg-surface border-app flex items-center rounded-[var(--radius-input)] border">
          <Link
            href={geser(-1)}
            className="text-muted hover:bg-surface-muted grid size-9 place-items-center rounded-l-[var(--radius-input)]"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft size={17} />
          </Link>
          <span className="text-body min-w-36 px-3 text-center text-sm font-medium">
            {namaBulan(tahun, bulan)}
          </span>
          <Link
            href={geser(1)}
            className="text-muted hover:bg-surface-muted grid size-9 place-items-center rounded-r-[var(--radius-input)]"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight size={17} />
          </Link>
        </div>
      </div>

      <PanelRoster
        tahun={tahun}
        bulan={bulan}
        hari={hari}
        karyawan={karyawan}
        shift={shift}
        isiAwal={isi}
      />
    </div>
  );
}
