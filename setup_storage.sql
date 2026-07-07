-- =============================================================================
-- Supabase Storage setup for new-edu-test
-- Buckets discovered in codebase (supabase.storage.from(...)):
--   avatars           — profile avatars (avatar-upload.tsx)
--   course-content    — lesson/course file uploads (api/upload/route.ts)
--   course-covers     — course covers, gallery, lesson block images
--   course-videos     — self-hosted course videos (course-video-upload.tsx)
--   test-attachments  — test audio/video attachments (upload-test-audio/video.ts)
--   test-images       — test question/option images (ChoiceOptionImageUpload, etc.)
--
-- Run manually in Supabase Dashboard → SQL Editor on a new project.
-- Safe to re-run: uses ON CONFLICT and DROP POLICY IF EXISTS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Buckets (public read via getPublicUrl)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('course-content', 'course-content', true),
  ('course-covers', 'course-covers', true),
  ('course-videos', 'course-videos', true),
  ('test-attachments', 'test-attachments', true),
  ('test-images', 'test-images', true)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

-- ---------------------------------------------------------------------------
-- RLS policies on storage.objects
-- Pattern per bucket:
--   SELECT  — public (anon + authenticated)
--   INSERT/UPDATE/DELETE — authenticated only
-- ---------------------------------------------------------------------------

-- avatars
DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_authenticated_delete" ON storage.objects;

CREATE POLICY "avatars_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "avatars_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "avatars_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "avatars_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- course-content
DROP POLICY IF EXISTS "course_content_public_select" ON storage.objects;
DROP POLICY IF EXISTS "course_content_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "course_content_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "course_content_authenticated_delete" ON storage.objects;

CREATE POLICY "course_content_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-content');

CREATE POLICY "course_content_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'course-content' AND auth.role() = 'authenticated');

CREATE POLICY "course_content_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'course-content' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'course-content' AND auth.role() = 'authenticated');

CREATE POLICY "course_content_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'course-content' AND auth.role() = 'authenticated');

-- course-covers
DROP POLICY IF EXISTS "course_covers_public_select" ON storage.objects;
DROP POLICY IF EXISTS "course_covers_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "course_covers_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "course_covers_authenticated_delete" ON storage.objects;

CREATE POLICY "course_covers_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-covers');

CREATE POLICY "course_covers_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'course-covers' AND auth.role() = 'authenticated');

CREATE POLICY "course_covers_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'course-covers' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'course-covers' AND auth.role() = 'authenticated');

CREATE POLICY "course_covers_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'course-covers' AND auth.role() = 'authenticated');

-- course-videos
DROP POLICY IF EXISTS "course_videos_public_select" ON storage.objects;
DROP POLICY IF EXISTS "course_videos_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "course_videos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "course_videos_authenticated_delete" ON storage.objects;

CREATE POLICY "course_videos_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-videos');

CREATE POLICY "course_videos_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'course-videos' AND auth.role() = 'authenticated');

CREATE POLICY "course_videos_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'course-videos' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'course-videos' AND auth.role() = 'authenticated');

CREATE POLICY "course_videos_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'course-videos' AND auth.role() = 'authenticated');

-- test-attachments
DROP POLICY IF EXISTS "test_attachments_public_select" ON storage.objects;
DROP POLICY IF EXISTS "test_attachments_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "test_attachments_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "test_attachments_authenticated_delete" ON storage.objects;

CREATE POLICY "test_attachments_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'test-attachments');

CREATE POLICY "test_attachments_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'test-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "test_attachments_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'test-attachments' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'test-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "test_attachments_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'test-attachments' AND auth.role() = 'authenticated');

-- test-images
DROP POLICY IF EXISTS "test_images_public_select" ON storage.objects;
DROP POLICY IF EXISTS "test_images_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "test_images_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "test_images_authenticated_delete" ON storage.objects;

CREATE POLICY "test_images_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'test-images');

CREATE POLICY "test_images_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'test-images' AND auth.role() = 'authenticated');

CREATE POLICY "test_images_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'test-images' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'test-images' AND auth.role() = 'authenticated');

CREATE POLICY "test_images_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'test-images' AND auth.role() = 'authenticated');
