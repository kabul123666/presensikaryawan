ALTER TABLE "shifts" ALTER COLUMN "istirahat_menit" SET DEFAULT 0;--> statement-breakpoint
-- Jam istirahat tidak lagi dipotong dari jam kerja.
UPDATE "shifts" SET "istirahat_menit" = 0;--> statement-breakpoint
-- Hitung ulang jam kerja absensi lama secara utuh (jam pulang - jam masuk).
-- Periode yang sudah dikunci tidak disentuh.
UPDATE "attendances" a
SET "durasi_kerja_menit" = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (a."clock_out_at" - a."clock_in_at")) / 60))::integer
WHERE a."clock_in_at" IS NOT NULL
  AND a."clock_out_at" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "period_locks" k WHERE a."tanggal" BETWEEN k."mulai" AND k."akhir"
  );
