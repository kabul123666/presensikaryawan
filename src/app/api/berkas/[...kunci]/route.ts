import { normalize } from "node:path";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { employees } from "@/db/schema";
import {
  ambilPengguna,
  bolehKelolaSemua,
  lingkupData,
  PERAN_PENYETUJU,
  type PenggunaSesi,
} from "@/lib/auth/session";
import { storage } from "@/lib/storage";

/**
 * Menyajikan foto absensi.
 *
 * Berkas tidak pernah terbuka untuk publik: setiap permintaan harus membawa
 * sesi yang sah, dan karyawan biasa hanya boleh membuka fotonya sendiri.
 * Dipakai oleh driver lokal (pengembangan) dan driver Vercel Blob privat —
 * pada keduanya pemeriksaan hak akses dilakukan di sini. Driver R2 memakai
 * URL bertanda tangan sehingga tidak melewati route ini.
 */
/** UUID pada awal nama berkas, dipakai kunci foto profil. */
const AWALAN_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Employee id pemilik sebuah berkas, atau null bila bentuk kuncinya asing.
 *
 * absensi/<tahun>/<bulan>/<employeeId>/<berkas>
 * lampiran/<employeeId>/<berkas>
 * profil/<employeeId>-<stempelWaktu>.jpg
 */
function pemilikBerkas(bagian: string[]): string | null {
  if (bagian[0] === "absensi") return bagian[3] ?? null;
  if (bagian[0] === "lampiran") return bagian[1] ?? null;
  if (bagian[0] === "profil") return AWALAN_UUID.exec(bagian[1] ?? "")?.[0] ?? null;
  return null;
}

/**
 * Apakah seorang penyetuju boleh membuka berkas milik karyawan lain.
 *
 * Sebelumnya hanya Admin dan Super Admin yang boleh, sehingga dua peran yang
 * justru bertugas memeriksa — Pemilik dan Kepala Unit — melihat foto absensi
 * di antrean Tinjau Anomali sebagai gambar rusak, dan surat dokter pada
 * pengajuan sakit tidak bisa dibuka oleh penyetuju pertamanya sama sekali.
 *
 * Batas datanya sama persis dengan layar: kepala unit sebatas departemennya,
 * pemilik sebatas cabangnya. Tanpa lingkup yang jelas, aksesnya ditolak.
 */
async function bolehLihatMilikOrangLain(pengguna: PenggunaSesi, employeeId: string) {
  if (!PERAN_PENYETUJU.includes(pengguna.role)) return false;

  const lingkup = await lingkupData(pengguna);
  if (lingkup.semua) return true;

  const db = await getDb();
  const [karyawan] = await db
    .select({
      departmentId: employees.departmentId,
      locationId: employees.locationId,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  if (!karyawan) return false;

  if (lingkup.departmentId) return karyawan.departmentId === lingkup.departmentId;
  if (lingkup.locationIds?.length) {
    return Boolean(
      karyawan.locationId && lingkup.locationIds.includes(karyawan.locationId),
    );
  }
  return false;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kunci: string[] }> },
) {
  const pengguna = await ambilPengguna();
  if (!pengguna) {
    return NextResponse.json({ pesan: "Tidak berwenang" }, { status: 401 });
  }

  const { kunci } = await params;
  const relatif = kunci.join("/");

  // Cegah path traversal: kunci hasil normalisasi harus tetap relatif.
  const aman = normalize(relatif);
  if (aman.startsWith("..") || aman.startsWith("/")) {
    return NextResponse.json({ pesan: "Jalur tidak sah" }, { status: 400 });
  }

  /*
   * Menentukan pemilik berkas dari bentuk kuncinya.
   *
   * Ketiganya berbeda bentuk, dan sebelumnya hanya foto absensi yang dikenali.
   * Akibatnya foto profil dan lampiran selalu dianggap tak bertuan, sehingga
   * karyawan biasa ditolak membuka fotonya sendiri — foto yang baru saja ia
   * unggah tampil sebagai gambar rusak.
   */
  const bagian = aman.split("/");
  const pemilik = pemilikBerkas(bagian);

  if (!bolehKelolaSemua(pengguna.role) && pemilik !== pengguna.employeeId) {
    const boleh = pemilik ? await bolehLihatMilikOrangLain(pengguna, pemilik) : false;
    if (!boleh) {
      return NextResponse.json({ pesan: "Tidak berwenang" }, { status: 403 });
    }
  }

  const isi = await storage().ambil(aman);
  if (!isi) {
    return NextResponse.json({ pesan: "Berkas tidak ditemukan" }, { status: 404 });
  }

  return new NextResponse(isi, {
    headers: {
      "Content-Type": "image/jpeg",
      // Privat: hanya boleh disimpan di cache peramban pengguna sendiri.
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": "inline",
    },
  });
}
