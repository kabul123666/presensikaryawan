import {
  PanelOrganisasi,
  type BarisDepartemen,
  type BarisJabatan,
} from "@/features/master/panel-organisasi";
import { daftarDepartemen, daftarJabatan } from "@/features/master/service";
import { wajibAksesMenu } from "@/lib/auth/akses";

export const metadata = { title: "Departemen & Jabatan" };

export default async function HalamanOrganisasi() {
  await wajibAksesMenu("organisasi");
  const [departemen, jabatan] = await Promise.all([daftarDepartemen(), daftarJabatan()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-body text-2xl font-extrabold tracking-tight">
          Departemen &amp; Jabatan
        </h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          Struktur organisasi rumah sakit, sekaligus tempat menentukan jabatan mana yang
          mencatat tindakan ber-fee saat clock out.
        </p>
      </div>

      <PanelOrganisasi
        departemen={departemen.map((d): BarisDepartemen => ({
          ...d,
          jumlahKaryawan: Number(d.jumlahKaryawan),
        }))}
        jabatan={jabatan.map((j): BarisJabatan => ({
          ...j,
          jumlahKaryawan: Number(j.jumlahKaryawan),
        }))}
      />
    </div>
  );
}
