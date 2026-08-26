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
| Commit terakhir | `a5c00b8` (23 Agustus 2026)                                     |
| Hosting         | Vercel, proyek `presensikaryawan`, akun `tyashalihaa@gmail.com` |
| Database        | Neon Postgres lewat integrasi Vercel                            |
| Foto            | Vercel Blob (privat), disajikan lewat `/api/berkas`             |
| Peta            | Leaflet + ubin OpenStreetMap (gratis, tanpa kunci API)          |

Deploy berjalan otomatis dari setiap push ke `main`. Migrasi database dan
pembuatan akun admin dijalankan skrip `vercel-build`, jadi tidak perlu
dikerjakan manual.

## Akun

| Peran               | Username       | Catatan                                |
| ------------------- | -------------- | -------------------------------------- |
| Super Admin         | `admin`        | password `wjyZxcReyER3uU8k`            |
| Pemilik             | `drg_mira`     | drg. Mira — pemilik ketiga cabang      |
| Kepala Unit         | `tyah_shaliha` | Manager Poli Gigi, ditugaskan 3 cabang |
| Uji coba (karyawan) | `uji.coba`     | password `6n2icemdbt`                  |

Akun uji sengaja dibuat atas permintaan pemilik proyek, memakai lokasi Alia
Hospital Depok dan shift Pagi. Hapus bila tidak diperlukan lagi.

**Sesi asisten tidak pernah mengisi password.** Karena itu sebagian layar admin
hanya bisa diperiksa bila pemilik proyek login sendiri di panel pratinjau.
Kalau perlu memverifikasi sesuatu di sisi admin, minta ia masuk lebih dulu.

## Keadaan data per 27 Agustus 2026

|                                            |                                               |
| ------------------------------------------ | --------------------------------------------- |
| Karyawan aktif                             | 10                                            |
| Wajib absen (di luar pemilik/admin)        | 8, **7 di antaranya tanpa shift**             |
| Shift terdefinisi                          | 1                                             |
| Absensi tercatat                           | 21 baris, terakhir 26 Agustus                 |
| Pengajuan                                  | 2                                             |
| Aturan persetujuan aktif                   | 4 (cuti, izin, lembur, koreksi — dua langkah) |
| Jenis cuti · katalog tindakan · hari libur | 0 · 0 · 0                                     |
| Baris `settings` tersimpan                 | 0 — seluruh kebijakan masih nilai bawaan      |
| Radius geofence                            | 500 m di ketiga cabang                        |

## Yang menghambat pemakaian sungguhan

1. **Belum ada jenis cuti** di database, sehingga pengajuan cuti dan izin belum
   bisa dibuat siapa pun. Diisi pemilik lewat Pengaturan → Cuti; jangan diisi
   sendiri karena kuota cuti adalah keputusan kebijakan.
2. **Shift belum ditetapkan** untuk tujuh dari delapan karyawan wajib absen,
   dan hanya satu shift yang terdefinisi. Akibatnya kehadiran tercatat tetapi
   tidak pernah dinilai terlambat maupun lembur. Jam shift adalah keputusan
   kebijakan, jadi harus diisi pemilik — lihat bagian Trial di bawah.
3. **Katalog tindakan masih kosong** padahal tiga jabatan mencatat fee. Saat
   clock out mereka disodori daftar kosong dan feenya selalu nol. Tarif adalah
   keputusan kebijakan.
4. **Radius geofence 500 m di ketiga cabang** — cukup longgar untuk absen dari
   seberang jalan. Perlu ditinjau pemilik.
5. **Vercel Hobby melarang pemakaian komersial.** Untuk dipakai operasional
   sungguhan, paketnya perlu dinaikkan ke Pro.

## Belum sempat diperiksa langsung

Dua fitur admin di bawah ini lolos typecheck, lint, dan `next build`, tetapi
**belum pernah dijalankan sungguhan** — belum ada yang menekan tombolnya.
Periksa sekali sebelum dipakai untuk periode gaji:

1. **Kunci periode** di Rekap Absensi — kunci satu periode lama, pastikan
   angkanya membeku dan koreksi absen untuk tanggal itu ditolak.
2. **Unduh Excel** di Rekap Absensi — dua lembar; pastikan lembar "Rincian
   Tindakan" terisi dan kolom menit/jam bisa dijumlah di Excel.

Tinjau Anomali sudah diperiksa (daftar, hitungan, dan penyaringan per cabang
terbukti bekerja); yang belum dicoba hanya penandaan massalnya.

## Trial sebulan (mulai 23 Agustus 2026)

Pemilik menjalankan uji pakai sebulan dengan lingkup **absensi dan rekap saja**
— cuti, fee, dan slip belum dipakai. Shift sengaja **belum ditetapkan**, jadi
selama trial ini kolom **terlambat, lembur, dan alpa akan selalu nol** dan
logikanya tidak ikut teruji (lihat `hitungAlpa`: tanpa shift maupun roster,
seseorang tidak punya jadwal sehingga tidak bisa alpa). Radius geofence masih
500 m di ketiga cabang, jadi penolakan karena di luar area praktis tidak akan
pernah terjadi.

Yang benar-benar teruji sebulan ini: clock in/out, foto berwatermark,
pembacaan lokasi, jam kerja, riwayat karyawan, dan rekap admin.

**Asimetri yang wajib diingat bila shift ditetapkan di tengah periode:**
terlambat dan lembur **dibekukan saat absen terjadi** (`nilaiClockIn` jalan
sekali lalu disimpan), jadi hari-hari sebelumnya tetap nol selamanya. Alpa
sebaliknya **dihitung ulang tiap rekap dibuka**, jadi begitu shift ditetapkan
alpa langsung muncul mundur ke belakang — termasuk tanggal sebelum shift itu
dibuat. Saran: tetapkan shift di awal periode berikutnya, bukan di tengah.

## Keputusan yang sengaja diambil

- **Kepala Unit dan Admin/HRD mendapat seluruh modul admin sebagai bawaan**,
  atas permintaan pemilik. Pembatasan dilakukan pemilik lewat Pengaturan → Hak
  Akses Menu, bukan dipaksakan kode. Perlu disadari: bawaan ini berarti kepala
  unit bisa membuka Pengaturan dan Audit Log.
- **Peran Pemilik (`OWNER`) dibatasi per cabang, bukan per departemen.**
  Batasnya berlaku di dashboard, rekap absensi (layar, rincian, unduhan),
  daftar karyawan, antrean persetujuan, dan tinjau anomali. Layar admin baru
  yang menampilkan data karyawan wajib ikut menyaring lewat
  `lingkupData().locationIds`.
  Cabang haknya diambil dari penempatan ditambah penugasan lintas cabang —
  mekanisme yang sama dengan "di mana seseorang boleh absen" — jadi pemilik
  seluruh jaringan cukup ditugaskan ke semua cabang tanpa tabel baru. Pemilik
  yang mencakup seluruh cabang aktif otomatis dianggap tidak terbatas.
- **Pemilik, admin, dan super admin tidak pernah dituntut hadir**
  (`PERAN_TANPA_ABSEN`). Mereka dikeluarkan dari hitungan "belum absen",
  jumlah karyawan wajib absen, dan perhitungan alpa.
- **Gagal menyimpan foto tidak membatalkan absen.** Barisnya tetap ditulis
  tanpa foto dan ditandai `FOTO_GAGAL` sehingga masuk antrean Tinjau Anomali.
  Orangnya sudah berdiri di klinik; kehadirannya tidak boleh hilang hanya
  karena berkasnya gagal naik.
- **WFH bukan pengajuan.** Ia kewenangan yang melekat pada peran Kepala Unit —
  boleh absen dari luar area, foto tetap wajib, hari itu ditandai `WFH`.

- **Ikatan perangkat dicabut** atas permintaan pemilik. Aplikasi boleh dibuka
  dan dipasang di perangkat mana pun. Kolom `employees.device_fingerprint` dan
  jenis pengajuan `DEVICE_CHANGE` sengaja disisakan supaya baris lama tetap
  terbaca, tetapi keduanya tidak pernah diisi lagi. Penanda `DEVICE_BARU` juga
  tidak dipasang lagi; labelnya disisakan agar absensi lama tetap terbaca di
  halaman anomali. Jangan menghidupkannya kembali tanpa diminta.
- **Umur sesi dibedakan**: tujuh hari untuk karyawan, satu hari untuk akun yang
  bisa melihat data seluruh karyawan. Risiko terbesar di klinik bukan
  pembobolan dari luar, melainkan sesi admin yang tertinggal terbuka di
  perangkat bersama.
- **Mengganti password mencabut seluruh sesi**, lalu membuat satu sesi baru
  untuk yang sedang menggantinya.

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
- **`requests.totalStep` harus diisi saat pengajuan dibuat**, lewat
  `langkahPersetujuan()`. Nilai bawaannya satu, dan sebelum ini tidak ada yang
  membacanya dari aturan — akibatnya aturan berjenjang tersimpan rapi tapi
  tidak pernah berlaku. Setiap tempat baru yang membuat baris `requests` wajib
  memanggilnya.
- **Jangan menerapkan perubahan skema manual ke produksi.** Nilai enum `OWNER`
  sempat diterapkan lewat skrip, lalu migrasi Drizzle yang sama menabraknya
  dengan "enum label already exists" dan seluruh penyebaran Vercel batal.
  Migrasi penambahan nilai enum kini ditulis `ADD VALUE IF NOT EXISTS`; kalau
  terpaksa menerapkan manual, tulis migrasinya idempoten sejak awal.
- **Jangan pakai `position: fixed` untuk bilah menu di ponsel.** Bilah alamat
  peramban yang menciut saat digulir ikut menggesernya, sehingga menunya
  terlihat naik-turun bahkan hilang di bawah lipatan. Pola yang dipakai
  aplikasi karyawan maupun panel admin: kerangka setinggi `h-dvh`, hanya area
  isi yang bergulir, bilah menu jadi elemen flex biasa di dasarnya — halamannya
  sendiri tidak pernah bergulir, jadi bilah alamat tidak berpengaruh.
- **Halaman admin dijaga `wajibAksesMenu("<kunci>")`, bukan `wajibPeran`.**
  Halaman admin baru wajib memakainya, dan kuncinya didaftarkan di
  `src/components/web/menu-admin.tsx` serta `SEMUA_KUNCI_MENU` di
  `features/settings/service.ts` — kalau tidak, modulnya tidak akan pernah
  muncul di layar pengaturan hak akses.
- **Nilai biasa tidak bisa diimpor server dari modul `"use client"`.** Yang
  sampai hanya referensi komponen. Peta menu admin karena itu tinggal di
  berkas netral `menu-admin.tsx`, bukan di dalam komponen sidebar.
- **Periode rekap belum tentu bulan kalender.** Ambil rentangnya lewat
  `rentangPeriode()`, jangan memanggil `batasBulan()` sendiri — layar, halaman
  rincian, dan berkas unduhan harus memotong periode di tanggal yang sama.
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
dan formulir pengajuan per jenis · persetujuan dua langkah (Kepala Unit lalu
Admin/HRD) untuk cuti, izin, lembur, dan koreksi absen · larangan menyetujui
pengajuan sendiri · keluar dari semua perangkat · WFH untuk kepala unit ·
peran Pemilik dengan batas cabang · tampilan desktop untuk karyawan (sidebar +
dua kolom) · panel admin bentuk mobile · pengaturan hak akses menu per peran ·
layar absen bergaya peta penuh di menu Presensi · rekap kehadiran berbentuk
kartu per hari · pemilih warna aplikasi · ikon menu datar · periode rekap
mengikuti siklus gaji · kunci periode · antrean tinjau anomali · ekspor rekap
berikut rincian fee.

Tampilan karyawan punya dua bentuk dari satu berkas halaman. Di bawah lebar
`lg` (1024px): satu kolom selebar 430px dengan bilah bawah, seperti sebelumnya.
Mulai `lg`: sidebar kiri (`src/components/karyawan/sidebar-desktop.tsx`), bilah
bawah disembunyikan, isi dibatasi 1120px dan disusun dua kolom lewat varian
`lg:`. Halaman berisi formulir dibatasi 720px. Kalau menambah halaman karyawan
baru, ikuti pola yang sama — jangan membuat berkas terpisah untuk desktop.

## Belum dikerjakan

- **Isi halaman admin belum dirombak.** Kerangkanya sudah berbentuk mobile dan
  tabelnya tidak lagi terpotong, tetapi isinya masih tabel padat — belum
  bergaya kartu seperti sisi karyawan. Fee Saya dan Jadwal juga masih tampilan
  lama.
- **Menu bertanda "Segera"** — fiturnya belum ada sama sekali: Dinas,
  Aktivitas Harian, Claim, Bonus, Slip Gaji, Perjalanan Dinas, Performance,
  dan Tugas di bilah bawah. (WFH sudah dirilis.)
- **Beberapa ikon menu masih kembar maknanya**: bagan batang dipakai untuk
  Jadwal Shift, Slip Insentif, dan Slip Gaji; dompet untuk Fee Saya, Claim, dan
  Bonus. Pemetaannya ada di `src/components/mobile/menu-aplikasi.tsx`.
- **Pilihan warna aplikasi tinggal di localStorage**, bukan di basis data —
  sama seperti terang/gelap. Karyawan yang berganti perangkat mulai dari hijau
  lagi. Kalau nanti dianggap perlu ikut akun, itu perubahan tersendiri.
- **Data pribadi belum bisa diisi**: kolom tempat/tanggal lahir, jenis kelamin,
  dan email sudah ada di basis data tetapi belum ada layar pengisinya, sehingga
  masih tampil sebagai tanda hubung di profil.
- **Retensi foto absensi tidak berjalan** — setelannya ada di Pengaturan tetapi
  belum ada penjadwal yang menghapus foto lama. `buatThumbnail()` di
  `src/lib/foto.ts` sudah ditulis tetapi tidak pernah dipanggil; dengan foto
  720×960 (~80 KB) dan 12 karyawan, penyimpanan tumbuh ±50 MB per bulan.
- **Penyetuju berperan Kepala Unit belum bisa membuka lampiran pengajuan.**
  `/api/berkas` membatasi ke `bolehKelolaSemua` (Admin dan Super Admin saja),
  jadi surat dokter pada pengajuan cuti tidak bisa dibuka penyetuju. Belum
  menggigit karena jenis cuti masih kosong.
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

## Cara memverifikasi

Jalankan server lewat panel pratinjau (`preview_start` dengan konfigurasi
`aliapresensi` di `.claude/launch.json`), bukan lewat `npm run dev` di Bash.
Verifikasi paling murah dan paling dapat dipercaya adalah membaca DOM lewat
JavaScript — lebar elemen, kelas yang aktif, status `fetch` sebuah rute —
bukan menebak dari tangkapan layar, yang ukuran bingkainya sering tidak sesuai
dengan viewport sebenarnya.

Untuk memastikan sebuah pembatasan benar-benar berlaku (bukan sekadar menu yang
disembunyikan), ubah datanya sementara, panggil rutenya lewat `fetch` dan
periksa apakah dialihkan ke `/tidak-berwenang`, lalu kembalikan datanya. Pola
itu dipakai saat menguji hak akses menu dan batas cabang pemilik.

Setelah menghapus berkas rute, hapus `.next/types` sebelum `tsc` — berkas
validator lama menyisakan galat modul yang sudah tidak ada.
