-- Возвращает email учеников конкретной группы только владельцу курса группы.
-- Нужен для teacher-gradebook на /dashboard/cohorts/[id].

DROP FUNCTION IF EXISTS public.get_cohort_student_emails(uuid);

CREATE OR REPLACE FUNCTION public.get_cohort_student_emails(p_cohort_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.cohorts ch
    INNER JOIN public.courses c ON c.id = ch.course_id
    WHERE ch.id = p_cohort_id
      AND c.teacher_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    e.user_id,
    u.email::text,
    p.full_name
  FROM public.enrollments e
  INNER JOIN auth.users u ON u.id = e.user_id
  LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE e.cohort_id = p_cohort_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_cohort_student_emails(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cohort_student_emails(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_cohort_student_emails(uuid) IS
  'Возвращает email и имя учеников группы владельцу курса группы.';
