-- Phase 319: шкала журнала 0–100 (points), без деления score на число вопросов.

CREATE OR REPLACE FUNCTION public.get_my_student_progress()
RETURNS TABLE (
  id text,
  type text,
  title text,
  status text,
  points integer,
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
  enrolled_courses AS (
    SELECT e.course_id, e.cohort_id, c.slug AS course_slug, c.title AS course_title
    FROM public.enrollments AS e
    INNER JOIN public.courses AS c ON c.id = e.course_id
    WHERE e.user_id = (SELECT uid FROM student_user)
  ),
  cohort_lessons AS (
    SELECT ca.cohort_id, ca.lesson_id
    FROM public.cohort_assignments AS ca
    WHERE ca.lesson_id IS NOT NULL
  ),
  eligible_lessons AS (
    SELECT
      l.id AS lesson_id,
      l.title AS lesson_title,
      l.test_id AS lesson_test_id,
      l.order_index AS lesson_order,
      m.order_index AS module_order,
      ec.course_id,
      ec.course_slug,
      ec.course_title
    FROM public.lessons AS l
    INNER JOIN public.modules AS m ON m.id = l.module_id
    INNER JOIN enrolled_courses AS ec ON ec.course_id = m.course_id
    LEFT JOIN cohort_lessons AS cl
      ON cl.cohort_id = ec.cohort_id AND cl.lesson_id = l.id
    WHERE
      l.is_published = true
      AND (
        ec.cohort_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM cohort_lessons AS cl2 WHERE cl2.cohort_id = ec.cohort_id
        )
        OR cl.lesson_id IS NOT NULL
      )
  ),
  relevant_test_ids AS (
    SELECT DISTINCT t.test_id
    FROM (
      SELECT el.lesson_test_id AS test_id
      FROM eligible_lessons AS el
      WHERE el.lesson_test_id IS NOT NULL
      UNION
      SELECT NULLIF(TRIM(lb.content->>'test_id'), '')::uuid AS test_id
      FROM public.lesson_blocks AS lb
      INNER JOIN eligible_lessons AS el ON el.lesson_id = lb.lesson_id
      WHERE
        lb.type = 'quiz'::public.lesson_block_type
        AND NULLIF(TRIM(lb.content->>'test_id'), '') IS NOT NULL
    ) AS t
    WHERE t.test_id IS NOT NULL
  ),
  question_points AS (
    SELECT q.test_id, SUM(GREATEST(COALESCE(q.points, 1), 1))::integer AS total_pts
    FROM public.questions AS q
    WHERE q.test_id IN (SELECT rt.test_id FROM relevant_test_ids AS rt)
    GROUP BY q.test_id
  ),
  attempt_points AS (
    SELECT
      sa.test_id,
      LEAST(
        100,
        GREATEST(
          0,
          CASE
            WHEN COALESCE(sa.score, 0) > 100 AND qp.total_pts > 0 THEN
              ROUND((COALESCE(sa.score, 0)::numeric / qp.total_pts) * 100)
            WHEN COALESCE(sa.score, 0) <= COALESCE(qp.total_pts, 1) AND qp.total_pts > 0 THEN
              ROUND((COALESCE(sa.score, 0)::numeric / qp.total_pts) * 100)
            ELSE ROUND(COALESCE(sa.score, 0)::numeric)
          END
        )
      )::integer AS pts
    FROM public.student_attempts AS sa
    INNER JOIN question_points AS qp ON qp.test_id = sa.test_id
    WHERE
      sa.student_id = (SELECT uid FROM student_user)
      AND sa.status = 'completed'::public.attempt_status
  ),
  best_points AS (
    SELECT ap.test_id, MAX(ap.pts)::integer AS points
    FROM attempt_points AS ap
    GROUP BY ap.test_id
  ),
  attempt_flags AS (
    SELECT
      sa.test_id,
      BOOL_OR(sa.status = 'completed'::public.attempt_status) AS has_completed,
      BOOL_OR(sa.status = 'in_progress'::public.attempt_status) AS has_in_progress,
      BOOL_OR(sa.status = 'pending_review'::public.attempt_status) AS has_pending
    FROM public.student_attempts AS sa
    WHERE
      sa.student_id = (SELECT uid FROM student_user)
      AND sa.test_id IN (SELECT rt.test_id FROM relevant_test_ids AS rt)
    GROUP BY sa.test_id
  ),
  journal_tests AS (
    SELECT t.id AS test_id, t.save_to_journal, t.is_published
    FROM public.tests AS t
    WHERE t.id IN (SELECT rt.test_id FROM relevant_test_ids AS rt)
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
        WHEN COALESCE(af.has_pending, false) THEN 'pending'
        WHEN COALESCE(af.has_completed, false) THEN 'completed'
        WHEN COALESCE(af.has_in_progress, false) THEN 'in_progress'
        ELSE 'not_started'
      END AS status,
      bp.points,
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
    INNER JOIN journal_tests AS jt ON jt.test_id = el.lesson_test_id
    LEFT JOIN attempt_flags AS af ON af.test_id = el.lesson_test_id
    LEFT JOIN best_points AS bp ON bp.test_id = el.lesson_test_id
    WHERE
      el.lesson_test_id IS NOT NULL
      AND jt.save_to_journal = true
      AND jt.is_published = true
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
        WHEN COALESCE(af.has_pending, false) THEN 'pending'
        WHEN COALESCE(af.has_completed, false) THEN 'completed'
        WHEN COALESCE(af.has_in_progress, false) THEN 'in_progress'
        ELSE 'not_started'
      END AS status,
      bp.points,
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
    INNER JOIN journal_tests AS jt ON jt.test_id = qb.quiz_test_id::uuid
    LEFT JOIN attempt_flags AS af ON af.test_id = qb.quiz_test_id::uuid
    LEFT JOIN best_points AS bp ON bp.test_id = qb.quiz_test_id::uuid
    WHERE
      jt.save_to_journal = true
      AND jt.is_published = true
      AND (
        el.lesson_test_id IS NULL
        OR el.lesson_test_id::text <> qb.quiz_test_id
      )
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
              WHEN ls.grade >= 0 AND ls.grade <= 100 THEN ROUND(ls.grade::numeric)::integer
              WHEN ls.grade >= 0 AND ls.grade <= 10 THEN LEAST(100, GREATEST(0, ls.grade * 10))
              ELSE LEAST(100, GREATEST(0, ROUND(ls.grade::numeric)))
            END
        ELSE NULL
      END AS points,
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
    WHERE
      lb.type = 'assignment'::public.lesson_block_type
      AND COALESCE((lb.content->>'save_to_journal')::boolean, false) = true
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
    c.points,
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

COMMENT ON FUNCTION public.get_my_student_progress() IS
  'Строки прогресса (тесты и задания) для текущего ученика: баллы 0–100, только save_to_journal.';
