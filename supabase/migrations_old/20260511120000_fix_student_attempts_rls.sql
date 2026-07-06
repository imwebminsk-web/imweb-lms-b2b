-- =============================================================================
-- Phase 178 — RLS: преподаватель читает student_attempts по тестам, которые он создал
-- (упрощённая политика вместо обхода через уроки/квиз-блоки).
-- Не открывает чужие тесты: видны только попытки по test_id, где tests.user_id = учитель.
-- Админ читает всё в рамках этой политики (role = admin).
-- =============================================================================

DROP POLICY IF EXISTS "student_attempts_select_teacher_or_admin"
ON public.student_attempts;

CREATE POLICY "student_attempts_select_teacher_or_admin"
ON public.student_attempts
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
    FROM public.tests t
    WHERE
      t.id = student_attempts.test_id
      AND t.user_id = (SELECT auth.uid())
  )
);
