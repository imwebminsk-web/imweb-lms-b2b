-- Public bucket for organization branding assets (logo, hero image)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'platform-assets',
  'platform-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read platform assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload platform assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins update platform assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete platform assets" ON storage.objects;

CREATE POLICY "Public read platform assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'platform-assets');

CREATE POLICY "Admins upload platform assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'platform-assets'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'head_teacher')
  )
);

CREATE POLICY "Admins update platform assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'platform-assets'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'head_teacher')
  )
);

CREATE POLICY "Admins delete platform assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'platform-assets'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'head_teacher')
  )
);
