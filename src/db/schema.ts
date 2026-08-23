/**
 * Skema database aplikasi presensi.
 *
 * Prinsip yang dipegang di sini (PRD §6.0 — Zero Hardcode):
 * seluruh angka kebijakan (toleransi, radius, kuota, tarif) tinggal di tabel,
 * bukan di kode. Kode hanya membacanya.
 */
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  time,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* ==========================================================================
 * Enum
 * ========================================================================== */

/**
 * OWNER adalah pemilik klinik, bukan pengelola sistem.
 *
 * Ia melihat data operasional cabang miliknya — kehadiran, pengajuan, rekap —
 * tetapi tidak mengurus pengaturan sistem. Cabang mana yang jadi haknya
 * ditentukan penempatannya, sama seperti karyawan lintas cabang: pemilik satu
 * klinik hanya melihat kliniknya, pemilik seluruh jaringan ditugaskan ke
 * semua cabang.
 */
export const roleEnum = pgEnum("role", [
  "SUPER_ADMIN",
  "ADMIN",
  "OWNER",
  "MANAGER",
  "KARYAWAN",
]);

export const userStatusEnum = pgEnum("user_status", [
  "PENDING_APPROVAL", // mendaftar sendiri, menunggu verifikasi admin
  "INVITED", // didaftarkan admin, belum mengaktifkan akun
  "ACTIVE",
  "SUSPENDED",
  "REJECTED",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "ON_TIME",
  "LATE",
  "EARLY_LEAVE",
  "OVERTIME",
  "ABSENT",
  "ON_LEAVE",
  "HOLIDAY",
  "DAY_OFF",
  "INCOMPLETE",
]);

export const outsidePolicyEnum = pgEnum("outside_policy", [
  "BLOCK",
  "REQUIRE_REASON",
  "FLAG_ONLY",
]);

export const requestTypeEnum = pgEnum("request_type", [
  "OVERTIME",
  "BACKDATE",
  "LEAVE",
  "PERMIT",
  "OUTSIDE_AREA",
  "DEVICE_CHANGE",
]);

export const requestStatusEnum = pgEnum("request_status", [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

export const approvalScopeEnum = pgEnum("approval_scope", [
  "ALL",
  "DEPARTMENT",
  "LOCATION",
]);

export const approvalModeEnum = pgEnum("approval_mode", ["ANY", "ALL"]);

export const decisionEnum = pgEnum("decision", ["PENDING", "APPROVED", "REJECTED"]);

export const worklogStatusEnum = pgEnum("worklog_status", [
  "SUBMITTED",
  "VERIFIED",
  "REJECTED",
]);

export const encashmentStatusEnum = pgEnum("encashment_status", [
  "DRAFT",
  "APPROVED",
  "PAID",
]);

export const yearEndChoiceEnum = pgEnum("year_end_choice", [
  "ENCASH", // diuangkan
  "CARRY_OVER", // dibawa ke tahun depan
  "SPLIT", // sebagian diuangkan, sebagian dibawa
]);

/* ==========================================================================
 * Organisasi & master data
 * ========================================================================== */

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  nama: varchar("nama", { length: 120 }).notNull().unique(),
  keterangan: text("keterangan"),
  aktif: boolean("aktif").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const positions = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  nama: varchar("nama", { length: 120 }).notNull(),
  departmentId: uuid("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  /**
   * Sakelar PRD §6.3: menentukan apakah jabatan ini mengisi form tindakan
   * saat clock out. Default awal hanya menyala untuk Perawat/Asisten.
   */
  isiFormTindakan: boolean("isi_form_tindakan").notNull().default(false),
  /** Kuota cuti tahunan khusus jabatan ini. Null = ikut kuota jenis cuti. */
  kuotaCutiOverride: integer("kuota_cuti_override"),
  aktif: boolean("aktif").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  nama: varchar("nama", { length: 160 }).notNull(),
  alamat: text("alamat"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  /** Radius geofence dalam meter — diatur bebas oleh admin (PRD §6.2.1). */
  radiusM: integer("radius_m").notNull().default(150),
  outsidePolicy: outsidePolicyEnum("outside_policy").notNull().default("REQUIRE_REASON"),
  /** Margin akurasi GPS yang dimaafkan, untuk sinyal lemah di dalam gedung. */
  gpsAccuracyToleranceM: integer("gps_accuracy_tolerance_m").notNull().default(50),
  aktif: boolean("aktif").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  nama: varchar("nama", { length: 80 }).notNull(),
  jamMasuk: time("jam_masuk").notNull(),
  jamPulang: time("jam_pulang").notNull(),
  /** Shift malam: jam pulang jatuh di tanggal berikutnya. */
  lintasHari: boolean("lintas_hari").notNull().default(false),
  toleransiMenit: integer("toleransi_menit").notNull().default(10),
  ambangLemburMenit: integer("ambang_lembur_menit").notNull().default(30),
  /** 0 = Minggu … 6 = Sabtu */
  hariKerja: jsonb("hari_kerja").$type<number[]>().notNull().default([1, 2, 3, 4, 5]),
  istirahatMenit: integer("istirahat_menit").notNull().default(60),
  /** Mencegah absen kepagian dari rumah. */
  batasClockinDiniMenit: integer("batas_clockin_dini_menit").notNull().default(60),
  warna: varchar("warna", { length: 16 }).notNull().default("#14a07c"),
  aktif: boolean("aktif").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const holidays = pgTable(
  "holidays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tanggal: date("tanggal").notNull(),
    nama: varchar("nama", { length: 160 }).notNull(),
    nasional: boolean("nasional").notNull().default(true),
  },
  (t) => [unique("holidays_tanggal_unique").on(t.tanggal)],
);

/* ==========================================================================
 * Pengguna & kepegawaian
 * ========================================================================== */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Identitas masuk. Sengaja username, bukan email: banyak perawat dan staf
     * front office tidak punya email kantor, dan username lebih cepat diketik
     * di ponsel saat antre absen pagi.
     */
    username: varchar("username", { length: 40 }).notNull(),
    /** Opsional — hanya untuk pemberitahuan, bukan untuk masuk. */
    email: varchar("email", { length: 190 }),
    nik: varchar("nik", { length: 40 }),
    passwordHash: text("password_hash"),
    role: roleEnum("role").notNull().default("KARYAWAN"),
    status: userStatusEnum("status").notNull().default("PENDING_APPROVAL"),
    /** Untuk lockout setelah percobaan login gagal berulang (PRD §9). */
    gagalLogin: integer("gagal_login").notNull().default(0),
    terkunciSampai: timestamp("terkunci_sampai", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("users_username_unique").on(t.username),
    unique("users_nik_unique").on(t.nik),
  ],
);

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nama: varchar("nama", { length: 160 }).notNull(),
    noHp: varchar("no_hp", { length: 32 }),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    positionId: uuid("position_id").references(() => positions.id, {
      onDelete: "set null",
    }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    /** Shift default; dapat ditimpa per tanggal lewat shiftSchedules. */
    shiftId: uuid("shift_id").references(() => shifts.id, { onDelete: "set null" }),
    tipeKaryawan: varchar("tipe_karyawan", { length: 40 }).notNull().default("TETAP"),
    tanggalMasuk: date("tanggal_masuk"),
    fotoProfil: text("foto_profil"),
    /**
     * Dipakai memilih gambar diri bawaan ketika karyawan belum mengunggah
     * foto. Boleh dikosongkan — tidak semua orang mau mengisinya, dan
     * aplikasi tetap berjalan tanpa keterangan ini.
     */
    jenisKelamin: varchar("jenis_kelamin", { length: 12 }),
    tanggalLahir: date("tanggal_lahir"),
    tempatLahir: varchar("tempat_lahir", { length: 120 }),
    email: varchar("email", { length: 160 }),
    gajiPokok: integer("gaji_pokok"),
    /** Perangkat utama yang diikat ke akun ini (PRD §6.2, anti titip absen). */
    deviceFingerprint: varchar("device_fingerprint", { length: 128 }),
    /**
     * Menu pilihan yang tampil di beranda, disimpan sebagai daftar kunci menu.
     * Null berarti karyawan belum mengubahnya dan memakai susunan bawaan.
     */
    menuBeranda: jsonb("menu_beranda").$type<string[]>(),
    /**
     * Apakah orang ini ikut pencatatan kehadiran. Akun administrator sistem
     * bukan karyawan yang absen, sehingga tidak boleh ikut terhitung sebagai
     * "belum absen" di dashboard maupun muncul di rekap dan jadwal jaga.
     */
    wajibAbsen: boolean("wajib_absen").notNull().default(true),
    aktif: boolean("aktif").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("employees_user_unique").on(t.userId),
    index("employees_department_idx").on(t.departmentId),
  ],
);

/** Sesi login — token buram di cookie httpOnly, bukan JWT (PRD §9). */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    userAgent: text("user_agent"),
    ip: varchar("ip", { length: 64 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("sessions_token_unique").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

/* ==========================================================================
 * Absensi
 * ========================================================================== */

/** Jadwal shift per tanggal (roster). Menimpa shift default karyawan. */
export const shiftSchedules = pgTable(
  "shift_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    tanggal: date("tanggal").notNull(),
    shiftId: uuid("shift_id").references(() => shifts.id, { onDelete: "set null" }),
    /** true = hari libur terjadwal untuk karyawan ini */
    libur: boolean("libur").notNull().default(false),
  },
  (t) => [unique("shift_schedules_unique").on(t.employeeId, t.tanggal)],
);

/**
 * Cabang tambahan tempat seorang karyawan boleh absen.
 *
 * Jabatan pengawas ke atas tidak terikat satu cabang — mereka berkeliling dan
 * harus bisa absen di mana pun sedang bertugas. Lokasi utama tetap disimpan di
 * employees.locationId sebagai penempatan resminya; tabel ini menambah cabang
 * lain yang juga diizinkan, sehingga geofence menerima salah satunya.
 */
export const employeeLocations = pgTable(
  "employee_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
  },
  (t) => [
    unique("employee_locations_unique").on(t.employeeId, t.locationId),
    index("employee_locations_employee_idx").on(t.employeeId),
  ],
);

export const attendances = pgTable(
  "attendances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    tanggal: date("tanggal").notNull(),
    shiftId: uuid("shift_id").references(() => shifts.id, { onDelete: "set null" }),
    status: attendanceStatusEnum("status").notNull().default("INCOMPLETE"),

    // --- Clock in ---
    clockInAt: timestamp("clock_in_at", { withTimezone: true }),
    clockInPhoto: text("clock_in_photo"),
    clockInLat: real("clock_in_lat"),
    clockInLng: real("clock_in_lng"),
    clockInAccuracy: real("clock_in_accuracy"),
    clockInAddress: text("clock_in_address"),
    clockInDistanceM: integer("clock_in_distance_m"),
    clockInOutsideArea: boolean("clock_in_outside_area").notNull().default(false),
    clockInReason: text("clock_in_reason"),

    // --- Clock out ---
    clockOutAt: timestamp("clock_out_at", { withTimezone: true }),
    clockOutPhoto: text("clock_out_photo"),
    clockOutLat: real("clock_out_lat"),
    clockOutLng: real("clock_out_lng"),
    clockOutAccuracy: real("clock_out_accuracy"),
    clockOutAddress: text("clock_out_address"),
    clockOutDistanceM: integer("clock_out_distance_m"),
    clockOutOutsideArea: boolean("clock_out_outside_area").notNull().default(false),
    clockOutReason: text("clock_out_reason"),

    // --- Hasil perhitungan ---
    menitTerlambat: integer("menit_terlambat").notNull().default(0),
    menitLembur: integer("menit_lembur").notNull().default(0),
    durasiKerjaMenit: integer("durasi_kerja_menit").notNull().default(0),

    catatanKerja: text("catatan_kerja"),
    deviceFingerprint: varchar("device_fingerprint", { length: 128 }),
    /** Penanda anomali: MOCK_GPS, DEVICE_BARU, LOKASI_MELOMPAT, dll. */
    flags: jsonb("flags").$type<string[]>().notNull().default([]),
    /** true bila baris ini hasil koreksi/backdate yang disetujui. */
    hasilKoreksi: boolean("hasil_koreksi").notNull().default(false),

    /*
     * Jejak peninjauan anomali.
     *
     * Penanda di `flags` tidak pernah dihapus — ia bukti apa yang terjadi saat
     * absen tercatat. Yang ditandai di sini adalah bahwa seorang admin sudah
     * melihatnya dan memutuskan, sehingga barisnya keluar dari antrean tinjau
     * tanpa buktinya ikut hilang.
     */
    ditinjauAt: timestamp("ditinjau_at", { withTimezone: true }),
    ditinjauOleh: uuid("ditinjau_oleh").references(() => users.id, {
      onDelete: "set null",
    }),
    catatanTinjau: text("catatan_tinjau"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("attendances_employee_tanggal_unique").on(t.employeeId, t.tanggal),
    index("attendances_tanggal_idx").on(t.tanggal),
    index("attendances_status_idx").on(t.status),
  ],
);

/* ==========================================================================
 * Katalog tindakan & fee
 * ========================================================================== */

export const procedureCatalog = pgTable("procedure_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  nama: varchar("nama", { length: 160 }).notNull(),
  kategori: varchar("kategori", { length: 40 }).notNull().default("RINGAN"),
  /** Fee default dalam rupiah. Dapat ditimpa per jabatan. */
  feeDefault: integer("fee_default").notNull().default(0),
  keterangan: text("keterangan"),
  aktif: boolean("aktif").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const procedureFeeRates = pgTable(
  "procedure_fee_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    procedureId: uuid("procedure_id")
      .notNull()
      .references(() => procedureCatalog.id, { onDelete: "cascade" }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "cascade" }),
    fee: integer("fee").notNull(),
  },
  (t) => [unique("procedure_fee_rates_unique").on(t.procedureId, t.positionId)],
);

export const workLogItems = pgTable(
  "work_log_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attendanceId: uuid("attendance_id")
      .notNull()
      .references(() => attendances.id, { onDelete: "cascade" }),
    procedureId: uuid("procedure_id").references(() => procedureCatalog.id, {
      onDelete: "set null",
    }),
    namaTindakan: varchar("nama_tindakan", { length: 160 }).notNull(),
    jumlah: integer("jumlah").notNull().default(1),
    /** Kode/inisial pasien saja — tidak menyimpan data medis (PRD §9 Privasi). */
    kodePasien: varchar("kode_pasien", { length: 40 }),
    /** Nominal dibekukan saat pencatatan agar riwayat tidak berubah
        ketika admin mengubah tarif di kemudian hari. */
    feeSnapshot: integer("fee_snapshot").notNull().default(0),
    catatan: text("catatan"),
    status: worklogStatusEnum("status").notNull().default("SUBMITTED"),
    verifiedBy: uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("work_log_items_attendance_idx").on(t.attendanceId)],
);

/* ==========================================================================
 * Pengajuan & persetujuan
 * ========================================================================== */

export const requests = pgTable(
  "requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    tipe: requestTypeEnum("tipe").notNull(),
    status: requestStatusEnum("status").notNull().default("PENDING"),
    /** Isi spesifik per tipe (tanggal cuti, jam lembur, dsb). */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    alasan: text("alasan"),
    lampiran: text("lampiran"),
    currentStep: integer("current_step").notNull().default(1),
    totalStep: integer("total_step").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    selesaiAt: timestamp("selesai_at", { withTimezone: true }),
  },
  (t) => [
    index("requests_status_idx").on(t.status),
    index("requests_employee_idx").on(t.employeeId),
  ],
);

/**
 * Aturan persetujuan yang disusun admin (PRD §6.4).
 * Satu aturan = satu kombinasi tipe pengajuan + cakupan.
 */
export const approvalRules = pgTable("approval_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tipePengajuan: requestTypeEnum("tipe_pengajuan").notNull(),
  scope: approvalScopeEnum("scope").notNull().default("ALL"),
  /** id departemen atau lokasi, sesuai scope. Null untuk scope ALL. */
  scopeId: uuid("scope_id"),
  totalStep: integer("total_step").notNull().default(1),
  mode: approvalModeEnum("mode").notNull().default("ANY"),
  aktif: boolean("aktif").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvalRuleActors = pgTable("approval_rule_actors", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => approvalRules.id, { onDelete: "cascade" }),
  step: integer("step").notNull().default(1),
  /** Isi salah satu: orang tertentu, atau seluruh pemegang peran. */
  approverUserId: uuid("approver_user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  approverRole: roleEnum("approver_role"),
  /** Pengganti saat approver berhalangan. */
  delegateUserId: uuid("delegate_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
});

export const requestApprovals = pgTable(
  "request_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    step: integer("step").notNull().default(1),
    approverId: uuid("approver_id").references(() => users.id, {
      onDelete: "set null",
    }),
    keputusan: decisionEnum("keputusan").notNull().default("PENDING"),
    catatan: text("catatan"),
    actedAt: timestamp("acted_at", { withTimezone: true }),
  },
  (t) => [index("request_approvals_request_idx").on(t.requestId)],
);

/* ==========================================================================
 * Cuti
 * ========================================================================== */

export const leaveTypes = pgTable("leave_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  nama: varchar("nama", { length: 120 }).notNull(),
  kuotaDefault: integer("kuota_default").notNull().default(0),
  berbayar: boolean("berbayar").notNull().default(true),
  butuhLampiran: boolean("butuh_lampiran").notNull().default(false),
  bolehCarryOver: boolean("boleh_carry_over").notNull().default(false),
  bolehDiuangkan: boolean("boleh_diuangkan").notNull().default(false),
  maxCarryOverHari: integer("max_carry_over_hari").notNull().default(0),
  /** Format MM-DD, mis. "03-31" = carry-over hangus 31 Maret. */
  tglKedaluwarsaCarry: varchar("tgl_kedaluwarsa_carry", { length: 5 }),
  warna: varchar("warna", { length: 16 }).notNull().default("#6366f1"),
  aktif: boolean("aktif").notNull().default(true),
});

export const leaveBalances = pgTable(
  "leave_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    leaveTypeId: uuid("leave_type_id")
      .notNull()
      .references(() => leaveTypes.id, { onDelete: "cascade" }),
    tahun: integer("tahun").notNull(),
    kuota: integer("kuota").notNull().default(0),
    carryOverMasuk: integer("carry_over_masuk").notNull().default(0),
    terpakai: integer("terpakai").notNull().default(0),
    /** Hari yang sedang diajukan tapi belum disetujui — ditahan dulu. */
    pending: integer("pending").notNull().default(0),
  },
  (t) => [unique("leave_balances_unique").on(t.employeeId, t.leaveTypeId, t.tahun)],
);

/** Pencairan sisa cuti menjadi uang di akhir tahun (PRD §6.4.1). */
export const leaveEncashments = pgTable("leave_encashments", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  leaveTypeId: uuid("leave_type_id")
    .notNull()
    .references(() => leaveTypes.id, { onDelete: "cascade" }),
  tahun: integer("tahun").notNull(),
  jumlahHari: integer("jumlah_hari").notNull(),
  tarifPerHari: integer("tarif_per_hari").notNull(),
  totalNominal: integer("total_nominal").notNull(),
  status: encashmentStatusEnum("status").notNull().default("DRAFT"),
  diprosesOleh: uuid("diproses_oleh").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Kunci proses tutup tahun. Bersifat idempoten: satu tahun hanya boleh
 * diproses sekali agar pencairan tidak pernah dobel.
 */
export const yearEndClosings = pgTable(
  "year_end_closings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tahun: integer("tahun").notNull(),
    dijalankanOleh: uuid("dijalankan_oleh").references(() => users.id, {
      onDelete: "set null",
    }),
    dijalankanAt: timestamp("dijalankan_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ringkasan: jsonb("ringkasan").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [unique("year_end_closings_tahun_unique").on(t.tahun)],
);

/**
 * Periode rekap yang sudah dikunci.
 *
 * Alpa tidak disimpan sebagai baris absensi — ia dihitung ulang setiap kali
 * rekap dibuka (lihat `hitungAlpa`). Cara itu benar selama periodenya masih
 * berjalan, tetapi berbahaya sesudah angkanya dipakai membayar orang:
 * mengedit shift atau menambah hari libur bulan lalu diam-diam mengubah rekap
 * yang sudah dicetak.
 *
 * Mengunci periode membekukan hasil hitungannya ke dalam `rekap`, dan sejak
 * saat itu rekap periode tersebut dibaca dari sini — bukan dihitung ulang.
 * Absensi di dalam rentangnya pun tidak bisa lagi diubah.
 */
export const periodLocks = pgTable(
  "period_locks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mulai: date("mulai").notNull(),
    akhir: date("akhir").notNull(),
    /** Salinan baris rekap saat dikunci; bentuknya mengikuti BarisRekap. */
    rekap: jsonb("rekap").$type<Record<string, unknown>[]>().notNull().default([]),
    dikunciOleh: uuid("dikunci_oleh").references(() => users.id, {
      onDelete: "set null",
    }),
    dikunciAt: timestamp("dikunci_at", { withTimezone: true }).notNull().defaultNow(),
    catatan: text("catatan"),
  },
  (t) => [unique("period_locks_rentang_unique").on(t.mulai, t.akhir)],
);

/* ==========================================================================
 * Komunikasi & jejak
 * ========================================================================== */

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  judul: varchar("judul", { length: 200 }).notNull(),
  isi: text("isi").notNull(),
  targetRole: jsonb("target_role").$type<string[]>().notNull().default([]),
  dibuatOleh: uuid("dibuat_oleh").references(() => users.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tipe: varchar("tipe", { length: 40 }).notNull(),
    judul: varchar("judul", { length: 200 }).notNull(),
    isi: text("isi"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    aksi: varchar("aksi", { length: 80 }).notNull(),
    entitas: varchar("entitas", { length: 80 }).notNull(),
    entitasId: varchar("entitas_id", { length: 80 }),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt)],
);

/** Pengaturan bebas berbentuk key-value agar kebijakan baru tidak butuh migrasi. */
export const settings = pgTable("settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  keterangan: text("keterangan"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ==========================================================================
 * Tipe bantuan
 * ========================================================================== */

export type Role = (typeof roleEnum.enumValues)[number];
export type UserStatus = (typeof userStatusEnum.enumValues)[number];
export type AttendanceStatus = (typeof attendanceStatusEnum.enumValues)[number];
export type RequestType = (typeof requestTypeEnum.enumValues)[number];
export type RequestStatus = (typeof requestStatusEnum.enumValues)[number];
export type OutsidePolicy = (typeof outsidePolicyEnum.enumValues)[number];
export type WorklogStatus = (typeof worklogStatusEnum.enumValues)[number];
export type EncashmentStatus = (typeof encashmentStatusEnum.enumValues)[number];
export type YearEndChoice = (typeof yearEndChoiceEnum.enumValues)[number];

export type User = typeof users.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Attendance = typeof attendances.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type Location = typeof locations.$inferSelect;
