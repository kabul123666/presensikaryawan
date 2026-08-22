# Titik lanjut — konteks untuk sesi berikutnya

Berkas ini ditulis agar percakapan berikutnya bisa langsung bekerja tanpa
menelusuri ulang. Perbarui bila keadaannya berubah.

## Aplikasi

Presensi karyawan untuk klinik/rumah sakit. Next.js 16 App Router, TypeScript
strict, Tailwind v4, Drizzle ORM. Seluruh antarmuka berbahasa Indonesia.

|                 |                                                                 |
| --------------- | --------------------------------------------------------------- |
| Produksi        | https://presensikaryawan-eight.vercel.app                       |
| Repo            | https://github.com/kabul123666/presensikaryawan                 |
| Commit terakhir | `569f616`                                                       |
| Hosting         | Vercel, proyek `presensikaryawan`, akun `tyashalihaa@gmail.com` |
| Database        | Neon Postgres lewat integrasi Vercel                            |
| Foto            | Vercel Blob (privat), disajikan lewat `/api/berkas`             |
| Peta            | Leaflet + ubin OpenStreetMap (gratis, tanpa kunci API)          |

Deploy berjalan otomatis dari setiap push ke `main`. Migrasi database dan
pembuatan akun admin dijalankan skrip `vercel-build`, jadi tidak perlu
dikerjakan manual.

## Akun

| Peran               | Username   | Password           |
| ------------------- | ---------- | ------------------ |
| Administrator       | `admin`    | `wjyZxcReyER3uU8k` |
| Uji coba (karyawan) | `uji.coba` | `6n2icemdbt`       |

Akun uji sengaja dibuat atas permintaan pemilik proyek untuk mencoba aplikasi,
memakai lokasi Alia Hospital Depok dan shift Pagi. Hapus bila tidak diperlukan
lagi.

## Yang menghambat pemakaian sungguhan

1. **Belum ada jenis cuti** di database, sehingga pengajuan cuti dan izin belum
   bisa dibuat siapa pun. Diisi pemilik lewat Pengaturan → Cuti; jangan diisi
   sendiri karena kuota cuti adalah keputusan kebijakan.
2. **Belum ada aturan persetujuan.** Pengajuan tetap bisa disetujui admin lewat
   jalur cadangan, tetapi persetujuan berjenjang belum berlaku.
3. **Vercel Hobby melarang pemakaian komersial.** Untuk dipakai operasional
   sungguhan, paketnya perlu dinaikkan ke Pro.

## Jebakan yang sudah diketahui

- **`.env.local` menunjuk database produksi.** `npm run db:reset` di komputer
  akan menghapus data sungguhan. Kosongkan `DATABASE_URL` lebih dulu bila ingin
  memakai PGlite lokal.
- Vercel CLI tidak selalu ada di PATH; deploy tetap jalan lewat push.
- Setelah memindahkan berkas rute, server pengembangan perlu dijalankan ulang —
  HMR yang basi memunculkan galat hidrasi yang bukan bug.
- Peta hanya bisa diuji penuh di peramban yang izin lokasinya diberikan. Panel
  pratinjau menolak izin, jadi titik posisi tidak akan pernah muncul di sana.
- **Leaflet memakai z-index ratusan** untuk panel petanya. Lapisan yang harus
  tampil di atas peta perlu angka lebih tinggi, dan wadah petanya wajib diberi
  `isolate` — tanpa itu angka setinggi itu ikut menembus panel absen yang
  terbuka di atasnya.
- **Jangan memeriksa `navigator` saat render.** Server tidak punya objek itu,
  jadi kesimpulannya berbeda dari peramban dan hidrasi gagal diam-diam. Pakai
  `useSyncExternalStore` dengan snapshot server, seperti di `gunakan-lokasi.ts`.
- **Payload pengajuan berbeda kunci per jenis.** Baca lewat
  `src/features/requests/ringkasan.ts`, jangan menebak sendiri — layar admin
  dan layar karyawan pernah berbeda tampilan gara-gara itu.

## Sudah selesai

Tema terang sebagai bawaan · halaman masuk tanpa nama unit · absen tanpa shift
beserta sakelarnya · jadwal jaga karyawan · slip insentif · pembatasan rekap
Manager ke departemennya · penugasan lintas cabang · penggantian password oleh
admin · beranda bergaya aplikasi kepegawaian · menu pilihan yang bisa diatur
karyawan · bilah bawah bertombol tengah · profil berfoto dengan stiker · halaman
pengaturan akun · peta area absen dengan pemantauan GPS berkelanjutan · daftar
dan formulir pengajuan per jenis · tampilan desktop untuk karyawan (sidebar +
dua kolom) · layar absen bergaya peta penuh di menu Presensi · rekap kehadiran
berbentuk kartu per hari · pemilih warna aplikasi.

Tampilan karyawan punya dua bentuk dari satu berkas halaman. Di bawah lebar
`lg` (1024px): satu kolom selebar 430px dengan bilah bawah, seperti sebelumnya.
Mulai `lg`: sidebar kiri (`src/components/karyawan/sidebar-desktop.tsx`), bilah
bawah disembunyikan, isi dibatasi 1120px dan disusun dua kolom lewat varian
`lg:`. Halaman berisi formulir dibatasi 720px. Kalau menambah halaman karyawan
baru, ikuti pola yang sama — jangan membuat berkas terpisah untuk desktop.

## Belum dikerjakan

- **Tampilan halaman lain belum dirombak**: Fee Saya, Jadwal, dan seluruh
  panel admin masih tampilan lama. Pemilik meminta semuanya mengikuti pola
  aplikasi kepegawaian seperti Talenta/Epployee.
- **Menu bertanda "Segera"** — fiturnya belum ada sama sekali: Dinas, WFH,
  Aktivitas Harian, Claim, Bonus, Slip Gaji, Perjalanan Dinas, Performance,
  dan Tugas di bilah bawah.
- **Pilihan warna aplikasi tinggal di localStorage**, bukan di basis data —
  sama seperti terang/gelap. Karyawan yang berganti perangkat mulai dari hijau
  lagi. Kalau nanti dianggap perlu ikut akun, itu perubahan tersendiri.
- **Data pribadi belum bisa diisi**: kolom tempat/tanggal lahir, jenis kelamin,
  dan email sudah ada di basis data tetapi belum ada layar pengisinya, sehingga
  masih tampil sebagai tanda hubung di profil.
- **Retensi foto absensi tidak berjalan** — setelannya ada di Pengaturan tetapi
  belum ada penjadwal yang menghapus foto lama.
- **`docs/PRD.md` masih memuat nama Alia** di banyak tempat; dokumen lain sudah
  dibersihkan.
- **Proyek `presensikaryawan-lama` di Vercel** belum dihapus.

## Cara kerja yang disepakati

Aturan lengkap ada di `CLAUDE.md`. Yang paling sering terpakai:

- Kerjakan hanya yang diminta; bila menurut Anda ada yang perlu ditambah,
  tanyakan lebih dulu.
- Bahasa Indonesia untuk seluruh teks antarmuka, nama variabel domain, dan
  komentar.
- Angka kebijakan tidak pernah ditanam di kode — dikelola admin lewat antarmuka.
- Wajib bersih sebelum selesai: `npx tsc --noEmit && npx eslint .`
- Jangan menambahkan data contoh ke database.

Pemilik proyek ingin perubahan langsung dikerjakan, bukan ditawarkan berulang,
dan setiap selesai langsung didorong ke GitHub agar Vercel menyebarkannya.
