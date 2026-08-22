import Link from "next/link";
import { eq } from "drizzle-orm";
import { Settings } from "lucide-react";

import { GantiAvatar } from "@/components/mobile/ganti-avatar";
import type { JenisKelamin } from "@/components/mobile/avatar";
import { getDb } from "@/db/client";
import { departments, employees, positions } from "@/db/schema";
import { cabangKaryawan } from "@/features/employees/service";
import { wajibMasuk } from "@/lib/auth/session";
import { tanggalPanjang } from "@/lib/waktu";

export const metadata = { title: "Profil Saya" };

const LABEL_PERAN: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin / HRD",
  MANAGER: "Kepala Unit",
  KARYAWAN: "Karyawan",
};

export default async function HalamanProfil() {
  const pengguna = await wajibMasuk();
  const db = await getDb();

  const [detail] = await db
    .select({
      noHp: employees.noHp,
      email: employees.email,
      tanggalMasuk: employees.tanggalMasuk,
      tanggalLahir: employees.tanggalLahir,
      tempatLahir: employees.tempatLahir,
      jenisKelamin: employees.jenisKelamin,
      tipeKaryawan: employees.tipeKaryawan,
      fotoProfil: employees.fotoProfil,
      deviceFingerprint: employees.deviceFingerprint,
      departemen: departments.nama,
      jabatan: positions.nama,
    })
    .from(employees)
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .where(eq(employees.id, pengguna.employeeId))
    .limit(1);

  // Di Profil seluruh nama cabang ditulis, bukan jumlahnya — di sinilah
  // orang mencari kepastian ia terdaftar di cabang mana saja.
  const cabang = await cabangKaryawan(pengguna.employeeId);

  const kelahiran = [
    detail?.tempatLahir,
    detail?.tanggalLahir ? tanggalPanjang(detail.tanggalLahir) : null,
  ]
    .filter(Boolean)
    .join(", ");

  const pribadi = [
    { label: "Nama", nilai: pengguna.nama },
    { label: "NIK / NIP", nilai: pengguna.nik ?? "—" },
    { label: "Username", nilai: pengguna.username },
    { label: "Tempat, tanggal lahir", nilai: kelahiran || "—" },
    {
      label: "Jenis kelamin",
      nilai:
        detail?.jenisKelamin === "PRIA"
          ? "Laki-laki"
          : detail?.jenisKelamin === "WANITA"
            ? "Perempuan"
            : "—",
    },
    { label: "Nomor HP", nilai: detail?.noHp ?? "—" },
    { label: "Email", nilai: detail?.email ?? "—" },
  ];

  const kepegawaian = [
    { label: "Jabatan", nilai: detail?.jabatan ?? "—" },
    { label: "Departemen", nilai: detail?.departemen ?? "—" },
    {
      label: cabang.nama.length > 1 ? "Cabang" : "Lokasi kerja",
      nilai: cabang.nama.join(", ") || "—",
    },
    { label: "Shift", nilai: pengguna.namaShift ?? "Tanpa shift" },
    { label: "Status", nilai: detail?.tipeKaryawan ?? "—" },
    {
      label: "Bergabung",
      nilai: detail?.tanggalMasuk ? tanggalPanjang(detail.tanggalMasuk) : "—",
    },
    { label: "Peran akun", nilai: LABEL_PERAN[pengguna.role] ?? pengguna.role },
    {
      label: "Perangkat terikat",
      nilai: detail?.deviceFingerprint ? "Sudah terikat" : "Belum ada",
    },
  ];

  return (
    <div className="pb-6">
      <header className="bg-brand-700 pt-safe px-5 pb-6 lg:rounded-[var(--radius-sheet)] lg:px-7">
        <div className="flex items-center justify-between pt-4 lg:pt-2">
          <h1 className="text-[19px] font-bold text-white">Profil Saya</h1>
          <Link
            href="/profil/pengaturan"
            className="grid size-10 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10"
            aria-label="Pengaturan akun"
          >
            <Settings size={21} />
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <GantiAvatar
            nama={pengguna.nama}
            fotoUrl={detail?.fotoProfil ? `/api/berkas/${detail.fotoProfil}` : null}
            jenisKelamin={detail?.jenisKelamin as JenisKelamin}
          />
          <div className="min-w-0">
            <p className="truncate text-[17px] leading-tight font-bold text-white">
              {pengguna.nama}
            </p>
            <p className="mt-1 truncate text-[13px] text-white/80">
              {detail?.jabatan ?? "Karyawan"}
              {detail?.departemen ? ` · ${detail.departemen}` : ""}
            </p>
            {pengguna.nik && (
              <p className="tnum mt-0.5 text-[12px] text-white/65">NIK {pengguna.nik}</p>
            )}
          </div>
        </div>
      </header>

      <div className="lg:mt-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
        {[
          { judul: "Data Pribadi", isi: pribadi },
          { judul: "Kepegawaian", isi: kepegawaian },
        ].map((blok) => (
          <section key={blok.judul} className="mt-5 px-5 lg:mt-0 lg:px-0">
            <h2 className="text-body text-[13px] font-semibold">{blok.judul}</h2>
            <dl className="border-app bg-surface mt-2 divide-y overflow-hidden rounded-[var(--radius-card)] border">
              {blok.isi.map((b) => (
                <div key={b.label} className="flex items-start gap-3 px-4 py-3">
                  <dt className="text-muted w-[42%] shrink-0 text-[13px]">{b.label}</dt>
                  <dd className="text-body flex-1 text-[13px] font-semibold">
                    {b.nilai}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <p className="text-subtle mt-6 text-center text-[11px]">Presensi Karyawan v0.1</p>
    </div>
  );
}
