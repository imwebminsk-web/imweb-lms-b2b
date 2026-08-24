-- Emails of students in a cohort (from enrollments + auth.users).
-- SECURITY DEFINER: auth.users.email is not readable via RLS from the client.
-- Access matches assertCanManageCohort: admin, head_teacher, course owner, curator.

DROP FUNCTION IF EXISTS public.get_cohort_student_emails(uuid);

CREATE FUNCTION public.get_cohort_student_emails(p_cohort_id uuid)
RETURNS TABLE(user_id uuid, email text, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Empty result (not an error) if the caller cannot manage this cohort.
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'head_teacher')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.cohorts ch
    INNER JOIN public.courses c ON c.id = ch.course_id
    WHERE ch.id = p_cohort_id
      AND c.teacher_id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.cohorts ch
    INNER JOIN public.course_curators cc ON cc.course_id = ch.course_id
    WHERE ch.id = p_cohort_id
      AND cc.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    e.user_id,
    u.email::text,
    pr.full_name
  FROM public.enrollments e
  INNER JOIN auth.users u ON u.id = e.user_id
  LEFT JOIN public.profiles pr ON pr.id = e.user_id
  WHERE e.cohort_id = p_cohort_id;
END;
$$;

COMMENT ON FUNCTION public.get_cohort_student_emails(uuid) IS
  'Returns student emails and names for a cohort. Allowed: admin, head_teacher, course owner, curator.';

REVOKE ALL ON FUNCTION public.get_cohort_student_emails(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_cohort_student_emails(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_cohort_student_emails(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cohort_student_emails(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
