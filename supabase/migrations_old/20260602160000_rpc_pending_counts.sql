-- Phase 234: быстрый подсчёт pending-сдач по когортам для текущего преподавателя.

CREATE OR REPLACE FUNCTION public.get_my_pending_review_counts()
RETURNS TABLE (
  cohort_id uuid,
  pending_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.cohort_id,
    COUNT(s.id)::bigint AS pending_count
  FROM public.assignment_submissions AS s
  INNER JOIN public.lesson_blocks AS lb ON lb.id = s.lesson_block_id
  INNER JOIN public.lessons AS l ON l.id = lb.lesson_id
  INNER JOIN public.modules AS m ON m.id = l.module_id
  INNER JOIN public.courses AS c ON c.id = m.course_id
  INNER JOIN public.enrollments AS e
    ON e.user_id = s.student_id
    AND e.course_id = c.id
    AND e.cohort_id IS NOT NULL
  WHERE
    s.status = 'pending'::public.submission_status
    AND c.teacher_id = auth.uid()
  GROUP BY e.cohort_id;
$$;

REVOKE ALL ON FUNCTION public.get_my_pending_review_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_pending_review_counts() TO authenticated;

COMMENT ON FUNCTION public.get_my_pending_review_counts() IS
  'Число сдач со статусом pending по когортам для курсов текущего преподавателя (auth.uid()).';
