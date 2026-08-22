/**
 * Set ikon menu aplikasi presensi.
 *
 * Datar, bukan tiga dimensi. Versi sebelumnya menumpuk empat lapis — bayangan
 * lantai, sisi tebal, gradien permukaan, dan kilau putih — yang pada ukuran
 * empat puluh empat piksel justru saling menumpuk sehingga bentuknya sulit
 * dibedakan satu sama lain.
 *
 * Yang dipertahankan adalah warnanya: hue tiap ikon sama persis dengan yang
 * dulu, sehingga orang yang sudah hafal "yang oranye itu fee" tidak perlu
 * belajar ulang. Susunannya kini tetap di semua ikon:
 *
 *   1. bidang membulat berwarna muda sebagai alas
 *   2. satu bentuk pejal berwarna kuat sebagai isi
 *   3. detail putih di dalam bentuk itu
 *
 * Tanpa gradien berarti tanpa `useId`, tanpa `<defs>`, dan tanpa id yang bisa
 * bentrok ketika belasan ikon dirender bersamaan.
 */

export type IkonProps = {
  size?: number;
  className?: string;
  title?: string;
};

type Palet = { alas: string; utama: string; tua: string };

const PALET = {
  teal: { alas: "#D5F3E8", utama: "#12A07C", tua: "#0B6B54" },
  amber: { alas: "#FDE8CA", utama: "#E0850C", tua: "#A3530A" },
  indigo: { alas: "#E1E3FD", utama: "#6366F1", tua: "#4338CA" },
  rose: { alas: "#FCDBE1", utama: "#E11D48", tua: "#9F1239" },
  sky: { alas: "#D6EBFA", utama: "#0EA5E9", tua: "#0369A1" },
  slate: { alas: "#E3E9E7", utama: "#6D7F7B", tua: "#42514E" },
} satisfies Record<string, Palet>;

export type NamaPalet = keyof typeof PALET;

/** Kerangka bersama: viewBox tetap dan bidang alas membulat. */
function Bingkai({
  size = 48,
  className,
  title,
  palet,
  children,
}: IkonProps & { palet: Palet; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <rect x="4" y="4" width="56" height="56" rx="17" fill={palet.alas} />
      {children}
    </svg>
  );
}

/** Jarum jam — dipakai beberapa ikon, bentuknya harus persis sama. */
function JarumJam({ warna = "#FFFFFF" }: { warna?: string }) {
  return (
    <path
      d="M30 22v9l6.5 4.5"
      stroke={warna}
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/* ========================================================================== */

/** Jam dengan panah masuk — tombol clock in. */
export function IconClockIn(props: IkonProps) {
  const p = PALET.teal;
  return (
    <Bingkai {...props} palet={p}>
      <circle cx="30" cy="31" r="14" fill={p.utama} />
      <JarumJam />
      <circle cx="46" cy="45" r="9.5" fill={p.tua} />
      <path
        d="M41.5 45h8m0 0-3-3.2m3 3.2-3 3.2"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Bingkai>
  );
}

/** Jam dengan panah keluar — tombol clock out. */
export function IconClockOut(props: IkonProps) {
  const p = PALET.amber;
  return (
    <Bingkai {...props} palet={p}>
      <circle cx="30" cy="31" r="14" fill={p.utama} />
      <JarumJam />
      <circle cx="46" cy="45" r="9.5" fill={p.tua} />
      <path
        d="M50.5 45h-8m0 0 3-3.2m-3 3.2 3 3.2"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Bingkai>
  );
}

/** Gigi — identitas klinik gigi, dipakai untuk menu tindakan. */
export function IconTindakan(props: IkonProps) {
  const p = PALET.sky;
  return (
    <Bingkai {...props} palet={p}>
      <path
        d="M24 16c-5 0-8.5 3.6-8.5 9.2 0 6.4 2.2 9.8 3.8 15.2 1.3 4.4 1.5 9.6 4.2 9.6 2.8 0 2.6-5.6 4-9.4 1-2.8 4-2.8 5 0 1.4 3.8 1.2 9.4 4 9.4 2.7 0 2.9-5.2 4.2-9.6 1.6-5.4 3.8-8.8 3.8-15.2 0-5.6-3.5-9.2-8.5-9.2-3.2 0-4.8 1.6-6 1.6s-2.8-1.6-6-1.6z"
        fill={p.utama}
      />
      <path
        d="M24 23c-2 0-3.2 1.4-3.4 3.6"
        stroke="#FFFFFF"
        strokeOpacity="0.85"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </Bingkai>
  );
}

/**
 * Dompet — fee tindakan.
 *
 * Bukan tumpukan koin: tiga elips bertumpuk mau tak mau membentuk silinder,
 * dan silinder adalah bentuk tiga dimensi — persis yang sedang dihilangkan.
 */
export function IconFee(props: IkonProps) {
  const p = PALET.amber;
  return (
    <Bingkai {...props} palet={p}>
      <rect x="13" y="20" width="38" height="27" rx="6" fill={p.utama} />
      <path d="M13 26h38v8H13z" fill={p.tua} />
      <rect x="35" y="26" width="16" height="8" rx="4" fill={p.tua} />
      <circle cx="43" cy="30" r="2.6" fill="#FFFFFF" />
      <path
        d="M19 20v-3a3 3 0 0 1 3.9-2.9l19 5.9"
        stroke={p.tua}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Bingkai>
  );
}

/** Kalender bermatahari — cuti. */
export function IconCuti(props: IkonProps) {
  const p = PALET.indigo;
  return (
    <Bingkai {...props} palet={p}>
      <rect x="14" y="18" width="36" height="32" rx="6" fill={p.utama} />
      <rect x="14" y="18" width="36" height="9" rx="6" fill={p.tua} />
      <rect x="21" y="13" width="4" height="9" rx="2" fill={p.tua} />
      <rect x="39" y="13" width="4" height="9" rx="2" fill={p.tua} />
      <circle cx="32" cy="38" r="6" fill="#FFFFFF" />
      <path
        d="M32 28.5v2.5M32 45v2.5M23.5 38H26m12 0h2.5M26 32l1.8 1.8M36.2 42.2 38 44M38 32l-1.8 1.8M27.8 42.2 26 44"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </Bingkai>
  );
}

/** Bulan sabit — lembur di luar jam kerja. */
export function IconLembur(props: IkonProps) {
  const p = PALET.indigo;
  return (
    <Bingkai {...props} palet={p}>
      <path
        d="M33.5 15.5a16.5 16.5 0 1 0 14.5 22.5 18.5 18.5 0 0 1-14.5-22.5z"
        fill={p.utama}
      />
      <circle cx="45" cy="19" r="2.6" fill={p.tua} />
      <circle cx="51" cy="27" r="1.8" fill={p.tua} />
      <circle cx="40" cy="12.5" r="1.6" fill={p.tua} />
    </Bingkai>
  );
}

/** Papan dengan centang — persetujuan. */
export function IconApproval(props: IkonProps) {
  const p = PALET.teal;
  return (
    <Bingkai {...props} palet={p}>
      <rect x="16" y="16" width="32" height="36" rx="6" fill={p.utama} />
      <rect x="24" y="11" width="16" height="9" rx="4" fill={p.tua} />
      <path
        d="M24.5 35.5 30 41l10-11"
        stroke="#FFFFFF"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Bingkai>
  );
}

/** Lembar berisi batang — laporan dan rekap. */
export function IconLaporan(props: IkonProps) {
  const p = PALET.sky;
  return (
    <Bingkai {...props} palet={p}>
      <rect x="15" y="13" width="34" height="38" rx="6" fill={p.utama} />
      <rect x="22" y="33" width="5.5" height="11" rx="2.4" fill="#FFFFFF" />
      <rect x="30.5" y="27" width="5.5" height="17" rx="2.4" fill="#FFFFFF" />
      <rect x="39" y="21" width="5.5" height="23" rx="2.4" fill="#FFFFFF" />
    </Bingkai>
  );
}

/** Orang — data kepegawaian. */
export function IconKaryawan(props: IkonProps) {
  const p = PALET.teal;
  return (
    <Bingkai {...props} palet={p}>
      <circle cx="32" cy="25" r="9" fill={p.utama} />
      <path d="M15 51c0-9 7.6-14 17-14s17 5 17 14z" fill={p.tua} />
    </Bingkai>
  );
}

/** Penanda peta — lokasi dan geofence. */
export function IconLokasi(props: IkonProps) {
  const p = PALET.rose;
  return (
    <Bingkai {...props} palet={p}>
      <path
        d="M32 12c-8 0-14.5 6.3-14.5 14.1C17.5 36.9 32 52 32 52s14.5-15.1 14.5-25.9C46.5 18.3 40 12 32 12z"
        fill={p.utama}
      />
      <circle cx="32" cy="26" r="5.6" fill="#FFFFFF" />
    </Bingkai>
  );
}

/** Kamera — foto absensi. */
export function IconKamera(props: IkonProps) {
  const p = PALET.slate;
  return (
    <Bingkai {...props} palet={p}>
      <rect x="13" y="23" width="38" height="26" rx="6" fill={p.utama} />
      <path d="M25 23l3-5h8l3 5z" fill={p.tua} />
      <circle cx="32" cy="36" r="8.5" fill="#FFFFFF" />
      <circle cx="32" cy="36" r="4.2" fill={p.tua} />
    </Bingkai>
  );
}

/** Lonceng — notifikasi. */
export function IconNotifikasi(props: IkonProps) {
  const p = PALET.amber;
  return (
    <Bingkai {...props} palet={p}>
      <path
        d="M32 13a11.5 11.5 0 0 0-11.5 11.5v7.8L16 42h32l-4.5-9.7v-7.8A11.5 11.5 0 0 0 32 13z"
        fill={p.utama}
      />
      <path d="M26.5 45h11a5.5 5.5 0 0 1-11 0z" fill={p.tua} />
    </Bingkai>
  );
}

/** Kalender berjam — riwayat kehadiran. */
export function IconRiwayat(props: IkonProps) {
  const p = PALET.teal;
  return (
    <Bingkai {...props} palet={p}>
      <rect x="14" y="18" width="36" height="32" rx="6" fill={p.utama} />
      <rect x="14" y="18" width="36" height="9" rx="6" fill={p.tua} />
      <rect x="21" y="13" width="4" height="9" rx="2" fill={p.tua} />
      <rect x="39" y="13" width="4" height="9" rx="2" fill={p.tua} />
      <circle cx="32" cy="38.5" r="8.5" fill="#FFFFFF" />
      <path
        d="M32 33.5v5.5l3.5 2.5"
        stroke={p.utama}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Bingkai>
  );
}

/** Perisai — keamanan akun. */
export function IconKeamanan(props: IkonProps) {
  const p = PALET.teal;
  return (
    <Bingkai {...props} palet={p}>
      <path
        d="M32 12l16 6.2v13.3C48 42.6 41 50 32 53c-9-3-16-10.4-16-21.5V18.2z"
        fill={p.utama}
      />
      <path
        d="M25.5 32.5 30 37l9-9.5"
        stroke="#FFFFFF"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Bingkai>
  );
}

/** Empat petak — seluruh menu. */
export function IconMenu(props: IkonProps) {
  const p = PALET.slate;
  return (
    <Bingkai {...props} palet={p}>
      <rect x="16" y="16" width="13.5" height="13.5" rx="4.5" fill={p.utama} />
      <rect x="34.5" y="16" width="13.5" height="13.5" rx="4.5" fill={p.tua} />
      <rect x="16" y="34.5" width="13.5" height="13.5" rx="4.5" fill={p.tua} />
      <rect x="34.5" y="34.5" width="13.5" height="13.5" rx="4.5" fill={p.utama} />
    </Bingkai>
  );
}

/** Rumah — beranda. */
export function IconBeranda(props: IkonProps) {
  const p = PALET.teal;
  return (
    <Bingkai {...props} palet={p}>
      <path d="M32 12 12 29h40z" fill={p.tua} />
      <rect x="18" y="28" width="28" height="24" rx="5" fill={p.utama} />
      <rect x="27" y="37" width="10" height="15" rx="3" fill="#FFFFFF" />
    </Bingkai>
  );
}
