-- =============================================================================
-- Phase 177 — Преподаватель видит попытки учеников в журнале / успеваемости
-- Server Action фильтрует по student_id = ученик, но без этой политики RLS
-- отдаёт пустой результат для сессии преподавателя (видны только свои строки).
-- =============================================================================

DROP POLICY IF EXISTS student_attempts_select_teacher_or_admin
ON public.student_attempts;

CREATE POLICY student_attempts_select_teacher_or_admin
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
  OR EXISTS (
    SELECT 1
    FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
    WHERE
      l.test_id = student_attempts.test_id
      AND c.teacher_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.lesson_blocks lb
      JOIN public.lessons l ON l.id = lb.lesson_id
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
    WHERE
      lb.type = 'quiz'::public.lesson_block_type
      AND (lb.content ->> 'test_id') IS NOT NULL
      AND (lb.content ->> 'test_id')::uuid = student_attempts.test_id
      AND c.teacher_id = (SELECT auth.uid())
  )
);
