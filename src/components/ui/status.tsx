import type { AttendanceStatus, RequestStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

/**
 * Satu tempat untuk memetakan status ke warna dan label bahasa Indonesia,
 * supaya seluruh aplikasi menampilkan istilah yang persis sama.
 */

const STATUS_ABSEN: Record<
  AttendanceStatus,
  { label: string; kelas: string; titik: string }
> = {
  ON_TIME: {
    label: "Tepat Waktu",
    kelas: "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200",
    titik: "bg-status-ontime",
  },
  LATE: {
    label: "Terlambat",
    kelas: "bg-warn-50 text-warn-700 dark:bg-warn-500/15 dark:text-warn-100",
    titik: "bg-status-late",
  },
  EARLY_LEAVE: {
    label: "Pulang Cepat",
    kelas: "bg-warn-50 text-warn-700 dark:bg-warn-500/15 dark:text-warn-100",
    titik: "bg-status-late",
  },
  OVERTIME: {
    label: "Lembur",
    kelas: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
    titik: "bg-status-overtime",
  },
  ABSENT: {
    label: "Alpa",
    kelas: "bg-danger-50 text-danger-700 dark:bg-danger-500/15 dark:text-danger-100",
    titik: "bg-status-absent",
  },
  ON_LEAVE: {
    label: "Cuti",
    kelas: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200",
    titik: "bg-status-leave",
  },
  ON_PERMIT: {
    label: "Izin / Sakit",
    kelas: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
    titik: "bg-status-leave",
  },
  HOLIDAY: {
    label: "Libur Nasional",
    kelas: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200",
    titik: "bg-status-holiday",
  },
  DAY_OFF: {
    label: "Libur",
    kelas: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200",
    titik: "bg-status-holiday",
  },
  INCOMPLETE: {
    label: "Belum Lengkap",
    kelas: "bg-warn-50 text-warn-700 dark:bg-warn-500/15 dark:text-warn-100",
    titik: "bg-status-late",
  },
};

const STATUS_PENGAJUAN: Record<RequestStatus, { label: string; kelas: string }> = {
  DRAFT: {
    label: "Draf",
    kelas: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200",
  },
  PENDING: {
    label: "Menunggu",
    kelas: "bg-warn-50 text-warn-700 dark:bg-warn-500/15 dark:text-warn-100",
  },
  APPROVED: {
    label: "Disetujui",
    kelas: "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200",
  },
  REJECTED: {
    label: "Ditolak",
    kelas: "bg-danger-50 text-danger-700 dark:bg-danger-500/15 dark:text-danger-100",
  },
  CANCELLED: {
    label: "Dibatalkan",
    kelas: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200",
  },
};

export function labelStatusAbsen(status: AttendanceStatus) {
  return STATUS_ABSEN[status].label;
}

export function BadgeAbsen({
  status,
  className,
}: {
  status: AttendanceStatus;
  className?: string;
}) {
  const s = STATUS_ABSEN[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        s.kelas,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.titik)} />
      {s.label}
    </span>
  );
}

export function BadgePengajuan({
  status,
  className,
}: {
  status: RequestStatus;
  className?: string;
}) {
  const s = STATUS_PENGAJUAN[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        s.kelas,
        className,
      )}
    >
      {s.label}
    </span>
  );
}

export function Badge({
  children,
  tone = "netral",
  className,
}: {
  children: React.ReactNode;
  tone?: "netral" | "brand" | "warn" | "danger";
  className?: string;
}) {
  const nada = {
    netral: "bg-surface-muted text-muted",
    brand: "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200",
    warn: "bg-warn-50 text-warn-700 dark:bg-warn-500/15 dark:text-warn-100",
    danger: "bg-danger-50 text-danger-700 dark:bg-danger-500/15 dark:text-danger-100",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        nada,
        className,
      )}
    >
      {children}
    </span>
  );
}
