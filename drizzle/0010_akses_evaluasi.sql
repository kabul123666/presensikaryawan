-- Modul baru "evaluasi": peran yang sudah boleh membuka Rekap Absensi
-- otomatis ikut boleh membukanya. Hak akses yang sudah disimpan pemilik
-- tidak punya kunci ini, sehingga tanpa langkah ini modulnya tersembunyi.
UPDATE "settings"
SET "value" = (
  SELECT jsonb_object_agg(
    e.k,
    CASE
      WHEN jsonb_typeof(e.v) = 'array'
        AND jsonb_exists(e.v, 'absensi')
        AND NOT jsonb_exists(e.v, 'evaluasi')
      THEN e.v || '["evaluasi"]'::jsonb
      ELSE e.v
    END
  )
  FROM jsonb_each("settings"."value") AS e(k, v)
)
WHERE "key" = 'akses_menu'
  AND jsonb_typeof("value") = 'object'
  AND "value" <> '{}'::jsonb;
