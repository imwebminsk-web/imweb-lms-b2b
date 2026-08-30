-- Break RLS recursion: enrollments_select_course_owner / enrollments_update_course_owner
-- used to SELECT public.cohorts, while cohorts_select_teacher_or_member SELECTs
-- public.enrollments. SECURITY DEFINER + empty search_path bypasses RLS on that lookup.

CREATE OR REPLACE FUNCTION private.is_cohort_in_teachers_course(p_cohort_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cohorts AS ch
    INNER JOIN public.courses AS c ON c.id = ch.course_id
    WHERE ch.id = p_cohort_id
      AND c.teacher_id = (SELECT auth.uid())
  );
$$;

COMMENT ON FUNCTION private.is_cohort_in_teachers_course(uuid) IS
  'true, если группа принадлежит курсу текущего teacher_id (без RLS, без рекурсии cohorts↔enrollments).';

REVOKE ALL ON FUNCTION private.is_cohort_in_teachers_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_cohort_in_teachers_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_cohort_in_teachers_course(uuid) TO service_role;

DROP POLICY IF EXISTS "enrollments_select_course_owner" ON public.enrollments;

CREATE POLICY "enrollments_select_course_owner" ON public.enrollments
    FOR SELECT
    TO authenticated
    USING (
      (SELECT private.is_course_owner(course_id))
      OR (SELECT private.is_cohort_in_teachers_course(cohort_id))
    );

COMMENT ON POLICY "enrollments_select_course_owner" ON public.enrollments IS
  'Владелец курса: читать записи учеников своего курса / своей группы (без рекурсии RLS).';

DROP POLICY IF EXISTS "enrollments_update_course_owner" ON public.enrollments;

CREATE POLICY "enrollments_update_course_owner" ON public.enrollments
    FOR UPDATE
    TO authenticated
    USING (
      (SELECT private.is_course_owner(course_id))
      OR (SELECT private.is_cohort_in_teachers_course(cohort_id))
    )
    WITH CHECK (
      (SELECT private.is_course_owner(course_id))
      OR (SELECT private.is_cohort_in_teachers_course(cohort_id))
    );

COMMENT ON POLICY "enrollments_update_course_owner" ON public.enrollments IS
  'Владелец курса: менять статус ученика (без рекурсии RLS).';
