-- Head teacher (and admin via is_platform_admin): full RLS on gradebook tables.
-- Depends on private.is_platform_admin() from
-- 20260823233343_lock_enrollments_and_lesson_content.sql.
-- Overlaps *_admin_all for admin; policies OR together — that is expected.

DROP POLICY IF EXISTS "student_attempts_head_teacher_all" ON public.student_attempts;

CREATE POLICY "student_attempts_head_teacher_all" ON public.student_attempts
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_platform_admin()))
    WITH CHECK ((SELECT private.is_platform_admin()));

COMMENT ON POLICY "student_attempts_head_teacher_all" ON public.student_attempts IS
  'Head teacher / admin: полный доступ к попыткам тестов (журнал группы).';

DROP POLICY IF EXISTS "attempt_answers_head_teacher_all" ON public.attempt_answers;

CREATE POLICY "attempt_answers_head_teacher_all" ON public.attempt_answers
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_platform_admin()))
    WITH CHECK ((SELECT private.is_platform_admin()));

COMMENT ON POLICY "attempt_answers_head_teacher_all" ON public.attempt_answers IS
  'Head teacher / admin: полный доступ к ответам в попытке.';

DROP POLICY IF EXISTS "assignment_submissions_head_teacher_all" ON public.assignment_submissions;

CREATE POLICY "assignment_submissions_head_teacher_all" ON public.assignment_submissions
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_platform_admin()))
    WITH CHECK ((SELECT private.is_platform_admin()));

COMMENT ON POLICY "assignment_submissions_head_teacher_all" ON public.assignment_submissions IS
  'Head teacher / admin: полный доступ к сдачам заданий (журнал).';

DROP POLICY IF EXISTS "lesson_completions_head_teacher_all" ON public.lesson_completions;

CREATE POLICY "lesson_completions_head_teacher_all" ON public.lesson_completions
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_platform_admin()))
    WITH CHECK ((SELECT private.is_platform_admin()));

COMMENT ON POLICY "lesson_completions_head_teacher_all" ON public.lesson_completions IS
  'Head teacher / admin: полный доступ к отметкам прохождения урока.';
