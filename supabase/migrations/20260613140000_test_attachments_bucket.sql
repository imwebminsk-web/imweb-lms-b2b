-- Аудио для заданий тестов (Listening): mp3/wav, публичное чтение
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'test-attachments',
  'test-attachments',
  true,
  15728640,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "test_attachments_select_public" ON storage.objects;
DROP POLICY IF EXISTS "test_attachments_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "test_attachments_update_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "test_attachments_delete_own_folder" ON storage.objects;

CREATE POLICY "test_attachments_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'test-attachments');

CREATE POLICY "test_attachments_insert_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'test-attachments'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "test_attachments_update_own_folder"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'test-attachments'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'test-attachments'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "test_attachments_delete_own_folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'test-attachments'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
);
