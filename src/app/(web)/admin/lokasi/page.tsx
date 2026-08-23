import { PanelLokasi, type BarisLokasi } from "@/features/master/panel-lokasi";
import { daftarLokasi } from "@/features/master/service";
import { wajibAksesMenu } from "@/lib/auth/akses";

export const metadata = { title: "Lokasi & Geofence" };

export default async function HalamanLokasi() {
  await wajibAksesMenu("lokasi");
  const daftar = await daftarLokasi();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-body text-2xl font-extrabold tracking-tight">
          Lokasi &amp; Geofence
        </h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          Atur titik pusat, besar radius, dan apa yang terjadi bila karyawan absen di luar
          area. Peta memakai OpenStreetMap — gratis dan tanpa kunci API.
        </p>
      </div>

      <PanelLokasi
        daftar={daftar.map((l): BarisLokasi => ({
          ...l,
          jumlahKaryawan: Number(l.jumlahKaryawan),
        }))}
      />
    </div>
  );
}
