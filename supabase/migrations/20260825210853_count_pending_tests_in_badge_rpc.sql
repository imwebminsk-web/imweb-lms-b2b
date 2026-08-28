-- Badge «на проверке» по когортам: задания (pending) + итоговые тесты (pending_review).

CREATE OR REPLACE FUNCTION "public"."get_my_pending_review_counts"()
RETURNS TABLE("cohort_id" "uuid", "pending_count" bigint)
LANGUAGE "sql"
STABLE
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
  WITH assignment_pending AS (
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
      AND COALESCE((lb.content->>'save_to_journal')::boolean, false) = true
    GROUP BY e.cohort_id
  ),
  test_course_links AS (
    SELECT l.test_id AS test_id, m.course_id
    FROM public.lessons AS l
    INNER JOIN public.modules AS m ON m.id = l.module_id
    WHERE l.test_id IS NOT NULL

    UNION

    SELECT (lb.content->>'test_id')::uuid AS test_id, m.course_id
    FROM public.lesson_blocks AS lb
    INNER JOIN public.lessons AS l ON l.id = lb.lesson_id
    INNER JOIN public.modules AS m ON m.id = l.module_id
    WHERE lb.type = 'quiz'
      AND (lb.content->>'test_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

    UNION

    SELECT t.id AS test_id, m.course_id
    FROM public.tests AS t
    INNER JOIN public.lesson_blocks AS lb ON lb.id = t.lesson_block_id
    INNER JOIN public.lessons AS l ON l.id = lb.lesson_id
    INNER JOIN public.modules AS m ON m.id = l.module_id
    WHERE t.lesson_block_id IS NOT NULL
  ),
  test_pending AS (
    SELECT
      uniq.cohort_id,
      COUNT(uniq.attempt_id)::bigint AS pending_count
    FROM (
      SELECT DISTINCT
        e.cohort_id,
        sa.id AS attempt_id
      FROM public.student_attempts AS sa
      INNER JOIN public.tests AS t ON t.id = sa.test_id
      INNER JOIN test_course_links AS tcl ON tcl.test_id = t.id
      INNER JOIN public.courses AS c ON c.id = tcl.course_id
      INNER JOIN public.enrollments AS e
        ON e.user_id = sa.student_id
        AND e.course_id = c.id
        AND e.cohort_id IS NOT NULL
      WHERE
        sa.status = 'pending_review'::public.attempt_status
        AND COALESCE(sa.is_training_mode, false) = false
        AND t.test_type IS DISTINCT FROM 'training'
        AND c.teacher_id = auth.uid()
    ) AS uniq
    GROUP BY uniq.cohort_id
  ),
  combined AS (
    SELECT cohort_id, pending_count FROM assignment_pending
    UNION ALL
    SELECT cohort_id, pending_count FROM test_pending
  )
  SELECT
    combined.cohort_id,
    SUM(combined.pending_count)::bigint AS pending_count
  FROM combined
  GROUP BY combined.cohort_id;
$$;

COMMENT ON FUNCTION "public"."get_my_pending_review_counts"() IS
  'Число сдач на проверке по когортам для курсов текущего преподавателя: assignment_submissions.status = pending (только блоки с save_to_journal) и student_attempts.status = pending_review (не тренировочные тесты).';
