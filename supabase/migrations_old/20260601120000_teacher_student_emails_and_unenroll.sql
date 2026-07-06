-- Email учеников для CRM преподавателя + право отчислять из своих групп.

CREATE OR REPLACE FUNCTION public.get_users_emails(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_ids IS NULL OR cardinality(p_user_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    e.user_id,
    u.email::text
  FROM public.enrollments e
  INNER JOIN auth.users u ON u.id = e.user_id
  INNER JOIN public.courses c ON c.id = e.course_id
  WHERE e.user_id = ANY (p_user_ids)
    AND c.teacher_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.get_users_emails(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_users_emails(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_users_emails(uuid[]) IS
  'Возвращает email учеников, записанных на курсы текущего преподавателя.';

CREATE POLICY enrollments_delete_teacher
ON public.enrollments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE
        c.id = enrollments.course_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

GRANT DELETE ON public.enrollments TO authenticated;
