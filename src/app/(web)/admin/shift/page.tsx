import { PanelShift, type BarisShift } from "@/features/master/panel-shift";
import { daftarShift } from "@/features/master/service";
import { wajibAksesMenu } from "@/lib/auth/akses";

export const metadata = { title: "Shift & Jadwal" };

export default async function HalamanShift() {
  await wajibAksesMenu("shift");
  const daftar = await daftarShift();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-body text-2xl font-extrabold tracking-tight">
          Shift &amp; Jadwal Kerja
        </h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          Semua shift dibuat di sini — tidak ada jam kerja yang ditanam di dalam aplikasi.
          Status terlambat, pulang cepat, dan lembur selalu dihitung terhadap shift yang
          berlaku pada tanggal tersebut.
        </p>
      </div>

      <PanelShift
        daftar={daftar.map((s): BarisShift => ({
          ...s,
          jumlahKaryawan: Number(s.jumlahKaryawan),
        }))}
      />
    </div>
  );
}
