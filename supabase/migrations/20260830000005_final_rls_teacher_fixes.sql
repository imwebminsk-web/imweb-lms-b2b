-- Remaining RLS holes for teachers and head teachers (enrollments, profiles,
-- B2B matrix, course Storage). Depends on private.is_platform_admin() and
-- private.is_course_owner() from 20260823233343.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Safe UUID parse: invalid text must not abort the whole Storage policy.
CREATE OR REPLACE FUNCTION private.try_uuid(p_text text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN NULL;
  END IF;
  RETURN btrim(p_text)::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION private.try_uuid(text) IS
  'Cast text to uuid, or NULL if the value is not a UUID.';

REVOKE ALL ON FUNCTION private.try_uuid(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.try_uuid(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.try_uuid(text) TO service_role;

-- True if auth.uid() owns the course this Storage object belongs to.
-- Path conventions in this app:
--   {course_id}/…                          (audit hint)
--   {user_id}/{course_id}/…                (course cover + promo video)
--   {user_id}/gallery/{course_id}/…        (gallery)
--   {user_id}/lesson-blocks/{block_id}/…   (lesson image blocks)
CREATE OR REPLACE FUNCTION private.owns_course_media_object(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  parts text[];
  course_from_block uuid;
BEGIN
  parts := string_to_array(p_object_name, '/');
  IF parts IS NULL OR coalesce(array_length(parts, 1), 0) < 1 THEN
    RETURN false;
  END IF;

  IF private.is_course_owner(private.try_uuid(parts[1])) THEN
    RETURN true;
  END IF;

  IF coalesce(array_length(parts, 1), 0) >= 2
     AND private.is_course_owner(private.try_uuid(parts[2])) THEN
    RETURN true;
  END IF;

  IF coalesce(array_length(parts, 1), 0) >= 3
     AND parts[2] = 'gallery'
     AND private.is_course_owner(private.try_uuid(parts[3])) THEN
    RETURN true;
  END IF;

  IF coalesce(array_length(parts, 1), 0) >= 3
     AND parts[2] = 'lesson-blocks' THEN
    SELECT m.course_id
      INTO course_from_block
    FROM public.lesson_blocks AS lb
    INNER JOIN public.lessons AS l ON l.id = lb.lesson_id
    INNER JOIN public.modules AS m ON m.id = l.module_id
    WHERE lb.id = private.try_uuid(parts[3]);

    IF private.is_course_owner(course_from_block) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION private.owns_course_media_object(text) IS
  'true, если объект в course-covers / course-videos принадлежит курсу текущего teacher_id.';

REVOKE ALL ON FUNCTION private.owns_course_media_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.owns_course_media_object(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.owns_course_media_object(text) TO service_role;

-- ---------------------------------------------------------------------------
-- enrollments
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "enrollments_head_teacher_all" ON public.enrollments;

CREATE POLICY "enrollments_head_teacher_all" ON public.enrollments
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_platform_admin()))
    WITH CHECK ((SELECT private.is_platform_admin()));

COMMENT ON POLICY "enrollments_head_teacher_all" ON public.enrollments IS
  'Head teacher / admin: полный доступ к записям учеников (список группы, смена статуса).';

DROP POLICY IF EXISTS "enrollments_select_course_owner" ON public.enrollments;

CREATE POLICY "enrollments_select_course_owner" ON public.enrollments
    FOR SELECT
    TO authenticated
    USING (
      (SELECT private.is_course_owner(course_id))
      OR EXISTS (
        SELECT 1
        FROM public.cohorts AS ch
        WHERE ch.id = enrollments.cohort_id
          AND (SELECT private.is_course_owner(ch.course_id))
      )
    );

COMMENT ON POLICY "enrollments_select_course_owner" ON public.enrollments IS
  'Владелец курса: читать записи учеников своего курса / своей группы.';

DROP POLICY IF EXISTS "enrollments_update_course_owner" ON public.enrollments;

CREATE POLICY "enrollments_update_course_owner" ON public.enrollments
    FOR UPDATE
    TO authenticated
    USING (
      (SELECT private.is_course_owner(course_id))
      OR EXISTS (
        SELECT 1
        FROM public.cohorts AS ch
        WHERE ch.id = enrollments.cohort_id
          AND (SELECT private.is_course_owner(ch.course_id))
      )
    )
    WITH CHECK (
      (SELECT private.is_course_owner(course_id))
      OR EXISTS (
        SELECT 1
        FROM public.cohorts AS ch
        WHERE ch.id = enrollments.cohort_id
          AND (SELECT private.is_course_owner(ch.course_id))
      )
    );

COMMENT ON POLICY "enrollments_update_course_owner" ON public.enrollments IS
  'Владелец курса: менять статус ученика (одобрение, приостановка).';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_select_head_teacher" ON public.profiles;

CREATE POLICY "profiles_select_head_teacher" ON public.profiles
    FOR SELECT
    TO authenticated
    USING ((SELECT private.is_platform_admin()));

COMMENT ON POLICY "profiles_select_head_teacher" ON public.profiles IS
  'Head teacher / admin: читать любые профили (имена учеников в группе).';

-- ---------------------------------------------------------------------------
-- B2B matrix
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "team_courses_head_teacher_all" ON public.team_courses;

CREATE POLICY "team_courses_head_teacher_all" ON public.team_courses
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_platform_admin()))
    WITH CHECK ((SELECT private.is_platform_admin()));

COMMENT ON POLICY "team_courses_head_teacher_all" ON public.team_courses IS
  'Head teacher / admin: полный доступ к назначению курсов командам.';

DROP POLICY IF EXISTS "team_courses_owner_all" ON public.team_courses;

CREATE POLICY "team_courses_owner_all" ON public.team_courses
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_course_owner(course_id)))
    WITH CHECK ((SELECT private.is_course_owner(course_id)));

COMMENT ON POLICY "team_courses_owner_all" ON public.team_courses IS
  'Владелец курса: менять привязку своего курса к командам.';

DROP POLICY IF EXISTS "job_title_courses_head_teacher_all" ON public.job_title_courses;

CREATE POLICY "job_title_courses_head_teacher_all" ON public.job_title_courses
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_platform_admin()))
    WITH CHECK ((SELECT private.is_platform_admin()));

COMMENT ON POLICY "job_title_courses_head_teacher_all" ON public.job_title_courses IS
  'Head teacher / admin: полный доступ к назначению курсов должностям.';

DROP POLICY IF EXISTS "job_title_courses_owner_all" ON public.job_title_courses;

CREATE POLICY "job_title_courses_owner_all" ON public.job_title_courses
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_course_owner(course_id)))
    WITH CHECK ((SELECT private.is_course_owner(course_id)));

COMMENT ON POLICY "job_title_courses_owner_all" ON public.job_title_courses IS
  'Владелец курса: менять привязку своего курса к должностям.';

DO $$
BEGIN
  IF to_regclass('public.course_tags') IS NULL THEN
    RAISE NOTICE 'public.course_tags is missing; skip course_tags head_teacher/owner policies';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.course_tags ENABLE ROW LEVEL SECURITY;';

  EXECUTE 'DROP POLICY IF EXISTS "course_tags_head_teacher_all" ON public.course_tags;';
  EXECUTE $pol_ht$
    CREATE POLICY "course_tags_head_teacher_all" ON public.course_tags
        FOR ALL
        TO authenticated
        USING ((SELECT private.is_platform_admin()))
        WITH CHECK ((SELECT private.is_platform_admin()));
  $pol_ht$;
  EXECUTE $cmt_ht$
    COMMENT ON POLICY "course_tags_head_teacher_all" ON public.course_tags IS
      'Head teacher / admin: полный доступ к тегам курса.';
  $cmt_ht$;

  EXECUTE 'DROP POLICY IF EXISTS "course_tags_owner_all" ON public.course_tags;';
  EXECUTE $pol_own$
    CREATE POLICY "course_tags_owner_all" ON public.course_tags
        FOR ALL
        TO authenticated
        USING ((SELECT private.is_course_owner(course_id)))
        WITH CHECK ((SELECT private.is_course_owner(course_id)));
  $pol_own$;
  EXECUTE $cmt_own$
    COMMENT ON POLICY "course_tags_owner_all" ON public.course_tags IS
      'Владелец курса: менять теги своего курса.';
  $cmt_own$;
END $$;

-- ---------------------------------------------------------------------------
-- Storage: course owner on course-covers / course-videos
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "course_media_select_owner" ON storage.objects;
DROP POLICY IF EXISTS "course_media_insert_owner" ON storage.objects;
DROP POLICY IF EXISTS "course_media_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "course_media_delete_owner" ON storage.objects;

CREATE POLICY "course_media_select_owner"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id IN ('course-covers', 'course-videos')
  AND (SELECT private.owns_course_media_object(name))
);

CREATE POLICY "course_media_insert_owner"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('course-covers', 'course-videos')
  AND (SELECT private.owns_course_media_object(name))
);

CREATE POLICY "course_media_update_owner"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('course-covers', 'course-videos')
  AND (SELECT private.owns_course_media_object(name))
)
WITH CHECK (
  bucket_id IN ('course-covers', 'course-videos')
  AND (SELECT private.owns_course_media_object(name))
);

CREATE POLICY "course_media_delete_owner"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN ('course-covers', 'course-videos')
  AND (SELECT private.owns_course_media_object(name))
);
