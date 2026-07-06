-- Phase 364 — RLS для ядра тестового движка (tests, questions, options, student_attempts, attempt_answers).
--
-- Колонки владения:
--   tests.user_id          — создатель теста (преподаватель)
--   questions.test_id      — родительский тест
--   options.question_id    — родительский вопрос
--   student_attempts.student_id — ученик, проходящий тест
--   attempt_answers.attempt_id  — попытка ученика

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Drop legacy / partial policies (идемпотентно)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS student_attempts_select_teacher_or_admin ON public.student_attempts;
DROP POLICY IF EXISTS "student_attempts_select_teacher_or_admin" ON public.student_attempts;
DROP POLICY IF EXISTS "student_attempts_delete_own" ON public.student_attempts;
DROP POLICY IF EXISTS "attempt_answers_select_teacher_or_admin" ON public.attempt_answers;

DROP POLICY IF EXISTS tests_select_published ON public.tests;
DROP POLICY IF EXISTS tests_select_owner ON public.tests;
DROP POLICY IF EXISTS tests_select_admin ON public.tests;
DROP POLICY IF EXISTS tests_insert_teacher_or_admin ON public.tests;
DROP POLICY IF EXISTS tests_update_owner ON public.tests;
DROP POLICY IF EXISTS tests_update_admin ON public.tests;
DROP POLICY IF EXISTS tests_delete_owner ON public.tests;
DROP POLICY IF EXISTS tests_delete_admin ON public.tests;

DROP POLICY IF EXISTS questions_select_visible ON public.questions;
DROP POLICY IF EXISTS questions_insert_owner_or_admin ON public.questions;
DROP POLICY IF EXISTS questions_update_owner_or_admin ON public.questions;
DROP POLICY IF EXISTS questions_delete_owner_or_admin ON public.questions;

DROP POLICY IF EXISTS options_select_visible ON public.options;
DROP POLICY IF EXISTS options_insert_owner_or_admin ON public.options;
DROP POLICY IF EXISTS options_update_owner_or_admin ON public.options;
DROP POLICY IF EXISTS options_delete_owner_or_admin ON public.options;

DROP POLICY IF EXISTS student_attempts_select_own ON public.student_attempts;
DROP POLICY IF EXISTS student_attempts_select_teacher_or_admin ON public.student_attempts;
DROP POLICY IF EXISTS student_attempts_insert_own ON public.student_attempts;
DROP POLICY IF EXISTS student_attempts_update_own ON public.student_attempts;
DROP POLICY IF EXISTS student_attempts_update_teacher_or_admin ON public.student_attempts;
DROP POLICY IF EXISTS student_attempts_delete_own ON public.student_attempts;

DROP POLICY IF EXISTS attempt_answers_select_own ON public.attempt_answers;
DROP POLICY IF EXISTS attempt_answers_select_teacher_or_admin ON public.attempt_answers;
DROP POLICY IF EXISTS attempt_answers_insert_own_in_progress ON public.attempt_answers;
DROP POLICY IF EXISTS attempt_answers_update_own_in_progress ON public.attempt_answers;
DROP POLICY IF EXISTS attempt_answers_delete_own_in_progress ON public.attempt_answers;

-- ---------------------------------------------------------------------------
-- tests
-- ---------------------------------------------------------------------------

CREATE POLICY tests_select_published
ON public.tests
FOR SELECT
USING (is_published IS TRUE);

CREATE POLICY tests_select_owner
ON public.tests
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY tests_select_admin
ON public.tests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
);

CREATE POLICY tests_insert_teacher_or_admin
ON public.tests
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role IN (
        'teacher'::public.profile_role,
        'admin'::public.profile_role
      )
  )
);

CREATE POLICY tests_update_owner
ON public.tests
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY tests_update_admin
ON public.tests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
);

CREATE POLICY tests_delete_owner
ON public.tests
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY tests_delete_admin
ON public.tests
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
);

-- ---------------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------------

CREATE POLICY questions_select_visible
ON public.questions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tests AS t
    WHERE
      t.id = questions.test_id
      AND (
        t.is_published IS TRUE
        OR t.user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles AS p
          WHERE
            p.id = (SELECT auth.uid())
            AND p.role = 'admin'::public.profile_role
        )
      )
  )
);

CREATE POLICY questions_insert_owner_or_admin
ON public.questions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tests AS t
    WHERE
      t.id = questions.test_id
      AND (
        t.user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles AS p
          WHERE
            p.id = (SELECT auth.uid())
            AND p.role = 'admin'::public.profile_role
        )
      )
  )
);

CREATE POLICY questions_update_owner_or_admin
ON public.questions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tests AS t
    WHERE
      t.id = questions.test_id
      AND (
        t.user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles AS p
          WHERE
            p.id = (SELECT auth.uid())
            AND p.role = 'admin'::public.profile_role
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tests AS t
    WHERE
      t.id = questions.test_id
      AND (
        t.user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles AS p
          WHERE
            p.id = (SELECT auth.uid())
            AND p.role = 'admin'::public.profile_role
        )
      )
  )
);

CREATE POLICY questions_delete_owner_or_admin
ON public.questions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tests AS t
    WHERE
      t.id = questions.test_id
      AND (
        t.user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles AS p
          WHERE
            p.id = (SELECT auth.uid())
            AND p.role = 'admin'::public.profile_role
        )
      )
  )
);

-- ---------------------------------------------------------------------------
-- options
-- ---------------------------------------------------------------------------

CREATE POLICY options_select_visible
ON public.options
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.questions AS q
    INNER JOIN public.tests AS t ON t.id = q.test_id
    WHERE
      q.id = options.question_id
      AND (
        t.is_published IS TRUE
        OR t.user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles AS p
          WHERE
            p.id = (SELECT auth.uid())
            AND p.role = 'admin'::public.profile_role
        )
      )
  )
);

CREATE POLICY options_insert_owner_or_admin
ON public.options
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.questions AS q
    INNER JOIN public.tests AS t ON t.id = q.test_id
    WHERE
      q.id = options.question_id
      AND (
        t.user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles AS p
          WHERE
            p.id = (SELECT auth.uid())
            AND p.role = 'admin'::public.profile_role
        )
      )
  )
);

CREATE POLICY options_update_owner_or_admin
ON public.options
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.questions AS q
    INNER JOIN public.tests AS t ON t.id = q.test_id
    WHERE
      q.id = options.question_id
      AND (
        t.user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles AS p
          WHERE
            p.id = (SELECT auth.uid())
            AND p.role = 'admin'::public.profile_role
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.questions AS q
    INNER JOIN public.tests AS t ON t.id = q.test_id
    WHERE
      q.id = options.question_id
      AND (
        t.user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles AS p
          WHERE
            p.id = (SELECT auth.uid())
            AND p.role = 'admin'::public.profile_role
        )
      )
  )
);

CREATE POLICY options_delete_owner_or_admin
ON public.options
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.questions AS q
    INNER JOIN public.tests AS t ON t.id = q.test_id
    WHERE
      q.id = options.question_id
      AND (
        t.user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles AS p
          WHERE
            p.id = (SELECT auth.uid())
            AND p.role = 'admin'::public.profile_role
        )
      )
  )
);

-- ---------------------------------------------------------------------------
-- student_attempts
-- ---------------------------------------------------------------------------

CREATE POLICY student_attempts_select_own
ON public.student_attempts
FOR SELECT
TO authenticated
USING (student_id = (SELECT auth.uid()));

CREATE POLICY student_attempts_select_teacher_or_admin
ON public.student_attempts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
  OR EXISTS (
    SELECT 1
    FROM public.tests AS t
    WHERE
      t.id = student_attempts.test_id
      AND t.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY student_attempts_insert_own
ON public.student_attempts
FOR INSERT
TO authenticated
WITH CHECK (student_id = (SELECT auth.uid()));

CREATE POLICY student_attempts_update_own
ON public.student_attempts
FOR UPDATE
TO authenticated
USING (student_id = (SELECT auth.uid()))
WITH CHECK (student_id = (SELECT auth.uid()));

CREATE POLICY student_attempts_update_teacher_or_admin
ON public.student_attempts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
  OR EXISTS (
    SELECT 1
    FROM public.tests AS t
    WHERE
      t.id = student_attempts.test_id
      AND t.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
  OR EXISTS (
    SELECT 1
    FROM public.tests AS t
    WHERE
      t.id = student_attempts.test_id
      AND t.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY student_attempts_delete_own
ON public.student_attempts
FOR DELETE
TO authenticated
USING (student_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- attempt_answers
-- ---------------------------------------------------------------------------

CREATE POLICY attempt_answers_select_own
ON public.attempt_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.student_attempts AS sa
    WHERE
      sa.id = attempt_answers.attempt_id
      AND sa.student_id = (SELECT auth.uid())
  )
);

CREATE POLICY attempt_answers_select_teacher_or_admin
ON public.attempt_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
  OR EXISTS (
    SELECT 1
    FROM public.student_attempts AS sa
    INNER JOIN public.tests AS t ON t.id = sa.test_id
    WHERE
      sa.id = attempt_answers.attempt_id
      AND t.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY attempt_answers_insert_own_in_progress
ON public.attempt_answers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.student_attempts AS sa
    WHERE
      sa.id = attempt_answers.attempt_id
      AND sa.student_id = (SELECT auth.uid())
      AND sa.status = 'in_progress'::public.attempt_status
  )
);

CREATE POLICY attempt_answers_update_own_in_progress
ON public.attempt_answers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.student_attempts AS sa
    WHERE
      sa.id = attempt_answers.attempt_id
      AND sa.student_id = (SELECT auth.uid())
      AND sa.status = 'in_progress'::public.attempt_status
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.student_attempts AS sa
    WHERE
      sa.id = attempt_answers.attempt_id
      AND sa.student_id = (SELECT auth.uid())
      AND sa.status = 'in_progress'::public.attempt_status
  )
);

CREATE POLICY attempt_answers_delete_own_in_progress
ON public.attempt_answers
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.student_attempts AS sa
    WHERE
      sa.id = attempt_answers.attempt_id
      AND sa.student_id = (SELECT auth.uid())
      AND sa.status = 'in_progress'::public.attempt_status
  )
);

COMMENT ON POLICY tests_select_published ON public.tests IS
  'Опубликованные тесты читают все (в т.ч. anon) — контент без is_correct на клиенте.';

COMMENT ON POLICY student_attempts_select_teacher_or_admin ON public.student_attempts IS
  'Преподаватель видит попытки по своим тестам; admin — все.';
