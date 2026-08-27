-- Idempoten dengan sengaja, mengikuti migrasi enum sebelumnya: penyebaran
-- Vercel menjalankan migrasi di setiap build, dan tanpa IF NOT EXISTS build
-- kedua gagal dengan "enum label already exists" sehingga seluruh deploy batal.
ALTER TYPE "public"."attendance_status" ADD VALUE IF NOT EXISTS 'ON_PERMIT' BEFORE 'HOLIDAY';
