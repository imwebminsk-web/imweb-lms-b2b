-- Admin and head_teacher: full access to course media buckets.
-- Split CRUD: Storage upsert needs INSERT + SELECT + UPDATE; DELETE is a
-- separate policy. Role check uses private.is_platform_admin() (admin +
-- head_teacher, SECURITY DEFINER — no profiles RLS recursion).

DROP POLICY IF EXISTS "course_media_select_admin_head_teacher" ON storage.objects;
DROP POLICY IF EXISTS "course_media_insert_admin_head_teacher" ON storage.objects;
DROP POLICY IF EXISTS "course_media_update_admin_head_teacher" ON storage.objects;
DROP POLICY IF EXISTS "course_media_delete_admin_head_teacher" ON storage.objects;

CREATE POLICY "course_media_select_admin_head_teacher"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id IN ('course-covers', 'course-videos')
  AND (SELECT private.is_platform_admin())
);

CREATE POLICY "course_media_insert_admin_head_teacher"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('course-covers', 'course-videos')
  AND (SELECT private.is_platform_admin())
);

CREATE POLICY "course_media_update_admin_head_teacher"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('course-covers', 'course-videos')
  AND (SELECT private.is_platform_admin())
)
WITH CHECK (
  bucket_id IN ('course-covers', 'course-videos')
  AND (SELECT private.is_platform_admin())
);

CREATE POLICY "course_media_delete_admin_head_teacher"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN ('course-covers', 'course-videos')
  AND (SELECT private.is_platform_admin())
);
