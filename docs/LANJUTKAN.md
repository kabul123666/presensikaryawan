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
| Commit terakhir | `784f76e` (27 Agustus 2026)                                     |
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

## Keadaan data per 27 Agustus 2026 (sore)

|                                     |                                                          |
| ----------------------------------- | -------------------------------------------------------- |
| Karyawan aktif                      | 10                                                       |
| Wajib absen (di luar pemilik/admin) | 7                                                        |
| Shift terdefinisi                   | 9, dijadwalkan lewat roster (43 baris `shift_schedules`) |
| Absensi tercatat                    | 24 baris, berjalan setiap hari                           |
| Pengajuan                           | 7 (4 backdate, 2 lembur, 1 selesai)                      |
| Aturan persetujuan aktif            | 4 (cuti, izin, lembur, koreksi — dua langkah)            |
| Jenis cuti                          | 2 — Cuti Tahunan (12) dan Sakit (12, butuh lampiran)     |
| Baris `leave_balances`              | **0** — lihat catatan di bawah                           |
| Katalog tindakan · hari libur       | 0 · 0                                                    |
| Baris `settings` tersimpan          | 0 — seluruh kebijakan masih nilai bawaan                 |
| Radius geofence                     | 500 m di ketiga cabang, toleransi GPS 50–78 m            |
| Karyawan lintas cabang              | hanya drg. Mira (3) dan Tyah (2); sisanya satu cabang    |

Shift sudah ditetapkan lewat roster, jadi catatan lama bahwa "terlambat dan
lembur selalu nol" **tidak berlaku lagi** — keduanya sudah terhitung.

## Yang menghambat pemakaian sungguhan

1. **Belum ada jenis "Izin"** — yang ada hanya "Sakit", sehingga orang yang mau
   izin biasa terpaksa memilih Sakit. Ditambahkan pemilik lewat Pengaturan →
   Cuti dengan kuota **0**. Jenis berkuota 0 atau berlampiran otomatis masuk
   ke tab Izin/Sakit dan tidak pernah memotong saldo.
2. **"Sakit" masih berkuota 12.** Angkanya sekarang diabaikan — izin dan sakit
   tidak lagi memotong kuota apa pun — tetapi selama masih di atas nol ia ikut
   membuatkan baris saldo untuk karyawan baru dan terbaca membingungkan di
   layar pengaturan. Sebaiknya diubah ke 0 oleh pemilik.
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
   angkanya membeku dan koreksi absen untuk tanggal itu ditolak. Sengaja belum
   diuji sesi asisten: mengujinya berarti menulis baris kunci ke produksi.
2. ~~Unduh Excel~~ — sudah diperiksa 27 Agustus: berkasnya sah, dua lembar,
   kolom Izin ikut terbawa. Yang belum dipastikan hanya isi lembar "Rincian
   Tindakan", karena katalog tindakannya masih kosong.

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
- **Sesi yang lupa ditutup tidak terbawa ke hari berikutnya.** `absensiAktif`
  hanya menganggap sesi berjalan bila barisnya bertanggal hari ini, atau shift
  malam (`lintasHari`) yang jam pulangnya memang jatuh besok — batasnya jam
  pulang shift ditambah ambang lemburnya. Baris lama **tidak ditutup otomatis**:
  jamnya tidak diketahui siapa pun dan menebaknya berarti mengarang jam kerja
  yang terbawa ke penggajian. Barisnya sudah masuk antrean Tinjau Anomali, dan
  karyawannya membetulkan lewat Presensi Backdate. Konsekuensi yang disadari:
  yang bekerja melewati tengah malam **tanpa shift lintas hari terdaftar** tidak
  bisa clock out setelah pukul 00.00.
- **Izin dan sakit tidak berkuota.** Keduanya tidak pernah menyentuh
  `leave_balances` — tidak saat diajukan, disetujui, ditolak, maupun dibatalkan.
  Yang menentukan sebuah pengajuan itu cuti atau izin adalah **formulir yang
  dipakai** (`jenisPengajuan` di form), bukan tebakan dari `butuhLampiran`
  seperti dahulu. Hari izin/sakit yang disetujui bersatus `ON_PERMIT`, terpisah
  dari `ON_LEAVE`, dan punya kolom sendiri di rekap serta di Excel.
- **Koreksi absen menghitung ulang jam kerja, keterlambatan, dan statusnya**,
  tetapi **tidak** menghitung ulang menit lembur — lembur punya jalur
  persetujuannya sendiri, dan koreksi jam tidak boleh diam-diam menambah upah
  yang tidak pernah diputuskan siapa pun.
- **Penyetuju boleh membuka berkas milik karyawan dalam lingkupnya.**
  `/api/berkas` dahulu hanya mengizinkan Admin dan Super Admin, sehingga dua
  peran yang justru bertugas memeriksa — Pemilik dan Kepala Unit — melihat foto
  di Tinjau Anomali sebagai gambar rusak. Batasnya sama persis dengan layar:
  kepala unit sebatas departemennya, pemilik sebatas cabangnya, dan tanpa
  lingkup yang jelas aksesnya ditolak.
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
- **Salinan rekap yang dibekukan tidak ikut bertambah kolom.** `period_locks`
  menyimpan `BarisRekap[]` sebagai JSON, jadi salinan lama tidak punya kolom
  yang ditambahkan belakangan. `rekapPeriodeAtauKunci` menormalkannya
  (`izin: b.izin ?? 0`); setiap kolom baru wajib ikut dinormalkan di sana.
- **Layar absen dan server harus memakai rumus geofence yang sama.** Layar
  dahulu memotong akurasi GPS seutuhnya sementara server membatasinya pada
  toleransi lokasi, sehingga ponsel bersinyal buruk menampilkan "berada di
  area" lalu absennya tetap diminta beralasan. Keduanya kini lewat
  `marginAkurasi()` di `gunakan-lokasi.ts`.
- **Server Action punya batas badan permintaan 1 MB, dan itu bawaan Next.**
  Lampiran pengajuan sempat selalu gagal dengan layar "A server error occurred"
  karena foto kamera ponsel 2–5 MB ditolak sebelum kode aplikasi berjalan —
  jadi pesan galat aplikasi tidak pernah sempat muncul. Batasnya kini 8 MB di
  `next.config.ts`, dan fotonya diperkecil dulu di peramban lewat
  `kecilkan-foto.ts`. Setiap kolom unggahan baru wajib lewat pengecil itu.
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
berikut rincian fee · sesi absen yang tereset tiap ganti hari · izin dan sakit
tanpa kuota · kolom Izin terpisah di rekap · unduhan Excel rincian harian per
karyawan · lampiran surat dokter dari galeri atau kamera.

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
- **Peta absen hanya menampilkan cabang utama.** Server sudah memilih cabang
  terdekat yang melingkupi, tetapi layarnya cuma tahu satu cabang — jadi
  karyawan yang bertugas di cabang lain melihat "di luar area" dan diminta
  alasan padahal absennya diterima. Sengaja belum dikerjakan: yang terkena
  hanya drg. Mira (tidak absen) dan Tyah (kepala unit, sudah dikecualikan lewat
  WFH), sementara memperbaikinya berarti merombak peta jadi banyak cabang di
  layar yang paling sering dipakai.
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
