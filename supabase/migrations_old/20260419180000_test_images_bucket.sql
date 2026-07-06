-- Bucket для картинок вопросов «Подпиши картинку» (публичное чтение; запись в папку auth.uid()/…)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'test-images',
  'test-images',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "test_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "test_images_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "test_images_update_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "test_images_delete_own_folder" ON storage.objects;

CREATE POLICY "test_images_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'test-images');

CREATE POLICY "test_images_insert_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'test-images'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "test_images_update_own_folder"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'test-images'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'test-images'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "test_images_delete_own_folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'test-images'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
);
