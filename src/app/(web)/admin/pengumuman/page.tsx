import { daftarPengumuman } from "@/features/announcements/actions";
import {
  PanelPengumuman,
  type BarisPengumuman,
} from "@/features/announcements/panel-pengumuman";
import { wajibAksesMenu } from "@/lib/auth/akses";
import { jamWIB, tanggalPendek, tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "Pengumuman" };

export default async function HalamanPengumuman() {
  await wajibAksesMenu("pengumuman");
  const daftar = await daftarPengumuman();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-body text-xl font-semibold">Pengumuman</h1>
        <p className="text-muted mt-1 max-w-2xl text-[13px]">
          Pengumuman yang diterbitkan tampil di beranda aplikasi karyawan.
        </p>
      </div>

      <PanelPengumuman
        daftar={daftar.map((p): BarisPengumuman => {
          const acuan = p.publishedAt ?? p.createdAt;
          return {
            id: p.id,
            judul: p.judul,
            isi: p.isi,
            terbit: p.publishedAt !== null,
            waktu: `${p.publishedAt ? "Terbit" : "Dibuat"} ${tanggalPendek(
              tanggalWIB(acuan),
            )} ${jamWIB(acuan)}`,
            pembuat: p.pembuat,
          };
        })}
      />
    </div>
  );
}
