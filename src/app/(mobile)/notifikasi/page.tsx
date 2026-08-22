import {
  DaftarNotifikasi,
  type BarisNotifikasi,
} from "@/features/notifications/daftar-notifikasi";
import { daftarNotifikasi } from "@/features/notifications/service";
import { wajibMasuk } from "@/lib/auth/session";
import { jamWIB, tanggalPendek, tanggalWIB } from "@/lib/waktu";

export const metadata = { title: "Notifikasi" };

export default async function HalamanNotifikasi() {
  const pengguna = await wajibMasuk();
  const daftar = await daftarNotifikasi(pengguna.userId);
  const hariIni = tanggalWIB();

  return (
    <div className="pb-6">
      <header className="bg-surface border-app pt-safe border-b px-5 pb-6 lg:rounded-[var(--radius-sheet)] lg:border lg:px-7">
        <h1 className="text-body pt-4 text-[19px] font-extrabold lg:pt-2">Notifikasi</h1>
        <p className="text-subtle mt-0.5 text-xs">
          Hasil persetujuan dan perubahan akun Anda
        </p>
      </header>

      <DaftarNotifikasi
        daftar={daftar.map((n): BarisNotifikasi => {
          const tanggal = tanggalWIB(n.createdAt);
          return {
            id: n.id,
            tipe: n.tipe,
            judul: n.judul,
            isi: n.isi,
            link: n.link,
            sudahDibaca: n.readAt !== null,
            waktu:
              tanggal === hariIni
                ? `Hari ini ${jamWIB(n.createdAt)}`
                : `${tanggalPendek(tanggal)} ${jamWIB(n.createdAt)}`,
          };
        })}
      />
    </div>
  );
}
