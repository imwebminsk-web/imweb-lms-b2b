-- Restrict platform-assets writes to admin only (drop head_teacher).
-- Public SELECT stays: logos are shown on the login page without a session.

DROP POLICY IF EXISTS "Admins upload platform assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins update platform assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete platform assets" ON storage.objects;

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
      AND profiles.role = 'admin'
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
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'platform-assets'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
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
      AND profiles.role = 'admin'
  )
);
