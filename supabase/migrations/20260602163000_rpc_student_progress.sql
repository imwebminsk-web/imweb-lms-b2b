-- Phase 235: прогресс ученика одним SQL-запросом (без тяжёлых PostgREST join / RLS).

CREATE OR REPLACE FUNCTION public.get_my_student_progress()
RETURNS TABLE (
  id text,
  type text,
  title text,
  status text,
  grade10 integer,
  course_id uuid,
  course_slug text,
  course_title text,
  lesson_id uuid,
  test_id uuid,
  lesson_block_id uuid,
  assignment_submission_id uuid,
  has_completed_test_attempt boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH student_user AS (
    SELECT auth.uid() AS uid
  ),
  eligible_lessons AS (
    SELECT
      l.id AS lesson_id,
      COALESCE(NULLIF(TRIM(l.title), ''), 'Урок') AS lesson_title,
      l.order_index AS lesson_order,
      l.test_id AS lesson_test_id,
      m.order_index AS module_order,
      m.course_id,
      c.slug AS course_slug,
      c.title AS course_title
    FROM public.lessons AS l
    INNER JOIN public.modules AS m ON m.id = l.module_id
    INNER JOIN public.courses AS c ON c.id = m.course_id
    INNER JOIN public.enrollments AS e
      ON e.course_id = c.id
      AND e.user_id = (SELECT uid FROM student_user)
    WHERE
      l.is_published = true
      AND (SELECT uid FROM student_user) IS NOT NULL
      AND (
        e.cohort_id IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM public.cohort_assignments AS ca
          WHERE
            ca.cohort_id = e.cohort_id
            AND ca.lesson_id IS NOT NULL
        )
        OR EXISTS (
          SELECT 1
          FROM public.cohort_assignments AS ca
          WHERE
            ca.cohort_id = e.cohort_id
            AND ca.lesson_id = l.id
        )
      )
  ),
  relevant_test_ids AS (
    SELECT DISTINCT tid AS test_id
    FROM (
      SELECT el.lesson_test_id AS tid
      FROM eligible_lessons AS el
      WHERE el.lesson_test_id IS NOT NULL
      UNION ALL
      SELECT NULLIF(TRIM(lb.content->>'test_id'), '')::uuid AS tid
      FROM public.lesson_blocks AS lb
      INNER JOIN eligible_lessons AS el ON el.lesson_id = lb.lesson_id
      WHERE
        lb.type = 'quiz'::public.lesson_block_type
        AND NULLIF(TRIM(lb.content->>'test_id'), '') IS NOT NULL
    ) AS source_tests
    WHERE tid IS NOT NULL
  ),
  question_counts AS (
    SELECT q.test_id, COUNT(*)::integer AS cnt
    FROM public.questions AS q
    WHERE q.test_id IN (SELECT rt.test_id FROM relevant_test_ids AS rt)
    GROUP BY q.test_id
  ),
  attempt_grades AS (
    SELECT
      sa.test_id,
      LEAST(
        10,
        GREATEST(
          0,
          ROUND((COALESCE(sa.score, 0)::numeric / qc.cnt) * 10)
        )
      )::integer AS g10
    FROM public.student_attempts AS sa
    INNER JOIN question_counts AS qc ON qc.test_id = sa.test_id
    WHERE
      sa.student_id = (SELECT uid FROM student_user)
      AND sa.status = 'completed'::public.attempt_status
      AND qc.cnt > 0
  ),
  best_grades AS (
    SELECT ag.test_id, MAX(ag.g10)::integer AS grade10
    FROM attempt_grades AS ag
    GROUP BY ag.test_id
  ),
  attempt_flags AS (
    SELECT
      sa.test_id,
      BOOL_OR(sa.status = 'completed'::public.attempt_status) AS has_completed,
      BOOL_OR(sa.status = 'in_progress'::public.attempt_status) AS has_in_progress
    FROM public.student_attempts AS sa
    WHERE
      sa.student_id = (SELECT uid FROM student_user)
      AND sa.test_id IN (SELECT rt.test_id FROM relevant_test_ids AS rt)
    GROUP BY sa.test_id
  ),
  latest_submissions AS (
    SELECT DISTINCT ON (s.lesson_block_id)
      s.id,
      s.lesson_block_id,
      s.status,
      s.grade
    FROM public.assignment_submissions AS s
    INNER JOIN public.lesson_blocks AS lb ON lb.id = s.lesson_block_id
    INNER JOIN eligible_lessons AS el ON el.lesson_id = lb.lesson_id
    WHERE
      s.student_id = (SELECT uid FROM student_user)
      AND lb.type = 'assignment'::public.lesson_block_type
    ORDER BY s.lesson_block_id, s.updated_at DESC
  ),
  quiz_blocks_raw AS (
    SELECT
      lb.id AS block_id,
      lb.lesson_id,
      lb.order_index,
      NULLIF(TRIM(lb.content->>'test_id'), '') AS quiz_test_id
    FROM public.lesson_blocks AS lb
    INNER JOIN eligible_lessons AS el ON el.lesson_id = lb.lesson_id
    WHERE
      lb.type = 'quiz'::public.lesson_block_type
      AND NULLIF(TRIM(lb.content->>'test_id'), '') IS NOT NULL
  ),
  quiz_blocks_deduped AS (
    SELECT DISTINCT ON (qbr.lesson_id, qbr.quiz_test_id)
      qbr.block_id,
      qbr.lesson_id,
      qbr.order_index,
      qbr.quiz_test_id
    FROM quiz_blocks_raw AS qbr
    ORDER BY qbr.lesson_id, qbr.quiz_test_id, qbr.order_index
  ),
  lesson_test_items AS (
    SELECT
      ('test-' || el.lesson_id::text || '-' || el.lesson_test_id::text) AS id,
      'test'::text AS type,
      el.lesson_title AS title,
      CASE
        WHEN COALESCE(af.has_completed, false) THEN 'completed'
        WHEN COALESCE(af.has_in_progress, false) THEN 'in_progress'
        ELSE 'not_started'
      END AS status,
      bg.grade10,
      el.course_id,
      el.course_slug,
      el.course_title,
      el.lesson_id,
      el.lesson_test_id AS test_id,
      NULL::uuid AS lesson_block_id,
      NULL::uuid AS assignment_submission_id,
      COALESCE(af.has_completed, false) AS has_completed_test_attempt,
      el.course_title AS sort_course_title,
      el.module_order,
      el.lesson_order,
      1 AS sort_group,
      0 AS block_order
    FROM eligible_lessons AS el
    LEFT JOIN attempt_flags AS af ON af.test_id = el.lesson_test_id
    LEFT JOIN best_grades AS bg ON bg.test_id = el.lesson_test_id
    WHERE el.lesson_test_id IS NOT NULL
  ),
  quiz_test_items AS (
    SELECT
      (
        'test-'
        || el.lesson_id::text
        || '-block-'
        || qb.block_id::text
        || '-'
        || qb.quiz_test_id
      ) AS id,
      'test'::text AS type,
      el.lesson_title AS title,
      CASE
        WHEN COALESCE(af.has_completed, false) THEN 'completed'
        WHEN COALESCE(af.has_in_progress, false) THEN 'in_progress'
        ELSE 'not_started'
      END AS status,
      bg.grade10,
      el.course_id,
      el.course_slug,
      el.course_title,
      el.lesson_id,
      qb.quiz_test_id::uuid AS test_id,
      qb.block_id AS lesson_block_id,
      NULL::uuid AS assignment_submission_id,
      COALESCE(af.has_completed, false) AS has_completed_test_attempt,
      el.course_title AS sort_course_title,
      el.module_order,
      el.lesson_order,
      2 AS sort_group,
      qb.order_index AS block_order
    FROM quiz_blocks_deduped AS qb
    INNER JOIN eligible_lessons AS el ON el.lesson_id = qb.lesson_id
    LEFT JOIN attempt_flags AS af ON af.test_id = qb.quiz_test_id::uuid
    LEFT JOIN best_grades AS bg ON bg.test_id = qb.quiz_test_id::uuid
    WHERE
      el.lesson_test_id IS NULL
      OR el.lesson_test_id::text <> qb.quiz_test_id
  ),
  assignment_items AS (
    SELECT
      ('assignment-' || el.lesson_id::text || '-' || lb.id::text) AS id,
      'assignment'::text AS type,
      el.lesson_title AS title,
      COALESCE(ls.status::text, 'not_started') AS status,
      CASE
        WHEN
          ls.status = 'approved'::public.submission_status
          AND ls.grade IS NOT NULL
          THEN
            CASE
              WHEN ls.grade >= 0 AND ls.grade <= 10 THEN ROUND(ls.grade::numeric)::integer
              WHEN ls.grade > 10 AND ls.grade <= 100 THEN
                LEAST(10, GREATEST(0, ROUND((ls.grade::numeric / 100) * 10)))::integer
              ELSE LEAST(10, GREATEST(0, ROUND(ls.grade::numeric)))::integer
            END
        ELSE NULL
      END AS grade10,
      el.course_id,
      el.course_slug,
      el.course_title,
      el.lesson_id,
      NULL::uuid AS test_id,
      lb.id AS lesson_block_id,
      ls.id AS assignment_submission_id,
      false AS has_completed_test_attempt,
      el.course_title AS sort_course_title,
      el.module_order,
      el.lesson_order,
      3 AS sort_group,
      lb.order_index AS block_order
    FROM public.lesson_blocks AS lb
    INNER JOIN eligible_lessons AS el ON el.lesson_id = lb.lesson_id
    LEFT JOIN latest_submissions AS ls ON ls.lesson_block_id = lb.id
    WHERE lb.type = 'assignment'::public.lesson_block_type
  ),
  combined AS (
    SELECT * FROM lesson_test_items
    UNION ALL
    SELECT * FROM quiz_test_items
    UNION ALL
    SELECT * FROM assignment_items
  )
  SELECT
    c.id,
    c.type,
    c.title,
    c.status,
    c.grade10,
    c.course_id,
    c.course_slug,
    c.course_title,
    c.lesson_id,
    c.test_id,
    c.lesson_block_id,
    c.assignment_submission_id,
    c.has_completed_test_attempt
  FROM combined AS c
  ORDER BY
    c.sort_course_title,
    c.module_order,
    c.lesson_order,
    c.sort_group,
    c.block_order,
    c.id;
$$;

REVOKE ALL ON FUNCTION public.get_my_student_progress() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_student_progress() TO authenticated;

COMMENT ON FUNCTION public.get_my_student_progress() IS
  'Строки прогресса (тесты и задания) для текущего ученика (auth.uid()).';
