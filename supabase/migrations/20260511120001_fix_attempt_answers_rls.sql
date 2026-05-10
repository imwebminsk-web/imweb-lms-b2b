-- =============================================================================
-- Phase 188 — RLS: преподаватель читает attempt_answers по попыткам к своим тестам
-- Связь: attempt_answers.attempt_id → student_attempts.id → student_attempts.test_id → tests.id,
--         tests.user_id = создатель теста (текущий преподаватель).
-- Админ: role = admin в profiles.
-- Требуется, чтобы на таблице уже был включён RLS (иначе политика не применится).
-- Если RLS ещё не включён: ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
-- и добавьте отдельные политики на INSERT/DELETE/UPDATE для учеников, иначе сдача теста сломается.
-- =============================================================================

DROP POLICY IF EXISTS "attempt_answers_select_teacher_or_admin"
ON public.attempt_answers;

CREATE POLICY "attempt_answers_select_teacher_or_admin"
ON public.attempt_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
  OR EXISTS (
    SELECT 1
    FROM public.student_attempts sa
    JOIN public.tests t ON t.id = sa.test_id
    WHERE
      sa.id = attempt_answers.attempt_id
      AND t.user_id = (SELECT auth.uid())
  )
);
