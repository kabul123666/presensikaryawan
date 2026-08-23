-- Ditulis idempoten dengan sengaja: nilai enum ini sempat diterapkan lebih
-- dulu ke basis data produksi, dan tanpa IF NOT EXISTS migrasinya gagal
-- dengan "enum label already exists" sehingga seluruh penyebaran batal.
ALTER TYPE "public"."role" ADD VALUE IF NOT EXISTS 'OWNER' BEFORE 'MANAGER';