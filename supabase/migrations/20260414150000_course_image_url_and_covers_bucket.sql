-- =============================================================================
-- Phase 9: обложка курса (image_url) + публичный bucket course-covers в Storage
-- После применения: Supabase Dashboard → Storage → убедиться, что bucket есть.
-- =============================================================================

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.courses.image_url IS
  'Публичный URL обложки (Supabase Storage, bucket course-covers).';

-- Bucket для обложек (публичное чтение; запись — только в папку auth.uid()/…)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-covers',
  'course-covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "course_covers_select_public" ON storage.objects;
DROP POLICY IF EXISTS "course_covers_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "course_covers_update_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "course_covers_delete_own_folder" ON storage.objects;

CREATE POLICY "course_covers_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'course-covers');

CREATE POLICY "course_covers_insert_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-covers'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "course_covers_update_own_folder"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'course-covers'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'course-covers'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "course_covers_delete_own_folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'course-covers'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
);
