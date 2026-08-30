-- Course owner: gradebook access to attempts on tests that live in their course,
-- even when tests.user_id is another staff member (e.g. head_teacher inline quiz).
-- SECURITY DEFINER + empty search_path: helpers must not recurse into RLS.

-- A test belongs to the current teacher's course if it appears as:
--   1) tests.lesson_block_id → lesson_blocks → lessons → modules → courses
--   2) lessons.test_id (legacy footer test)
--   3) quiz-block content.test_id (library test attached to a lesson)

CREATE OR REPLACE FUNCTION private.is_test_in_teachers_course(p_test_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_test_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.tests AS t
        INNER JOIN public.lesson_blocks AS lb ON lb.id = t.lesson_block_id
        INNER JOIN public.lessons AS l ON l.id = lb.lesson_id
        INNER JOIN public.modules AS m ON m.id = l.module_id
        INNER JOIN public.courses AS c ON c.id = m.course_id
        WHERE t.id = p_test_id
          AND c.teacher_id = (SELECT auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM public.lessons AS l
        INNER JOIN public.modules AS m ON m.id = l.module_id
        INNER JOIN public.courses AS c ON c.id = m.course_id
        WHERE l.test_id = p_test_id
          AND c.teacher_id = (SELECT auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM public.lesson_blocks AS lb
        INNER JOIN public.lessons AS l ON l.id = lb.lesson_id
        INNER JOIN public.modules AS m ON m.id = l.module_id
        INNER JOIN public.courses AS c ON c.id = m.course_id
        WHERE lb.type = 'quiz'
          AND (lb.content ->> 'test_id') = p_test_id::text
          AND c.teacher_id = (SELECT auth.uid())
      )
    );
$$;

COMMENT ON FUNCTION private.is_test_in_teachers_course(uuid) IS
  'true, если тест стоит в курсе текущего teacher_id (inline-блок, подвал урока или quiz content.test_id).';

REVOKE ALL ON FUNCTION private.is_test_in_teachers_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_test_in_teachers_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_test_in_teachers_course(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.is_attempt_in_teachers_course(p_attempt_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT private.is_test_in_teachers_course(sa.test_id)
      FROM public.student_attempts AS sa
      WHERE sa.id = p_attempt_id
    ),
    false
  );
$$;

COMMENT ON FUNCTION private.is_attempt_in_teachers_course(uuid) IS
  'true, если попытка относится к тесту в курсе текущего teacher_id.';

REVOKE ALL ON FUNCTION private.is_attempt_in_teachers_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_attempt_in_teachers_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_attempt_in_teachers_course(uuid) TO service_role;

DROP POLICY IF EXISTS "student_attempts_course_owner_all" ON public.student_attempts;

CREATE POLICY "student_attempts_course_owner_all" ON public.student_attempts
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_test_in_teachers_course(test_id)))
    WITH CHECK ((SELECT private.is_test_in_teachers_course(test_id)));

COMMENT ON POLICY "student_attempts_course_owner_all" ON public.student_attempts IS
  'Владелец курса: попытки по тестам своего курса (журнал), даже если tests.user_id — другой сотрудник.';

DROP POLICY IF EXISTS "attempt_answers_course_owner_all" ON public.attempt_answers;

CREATE POLICY "attempt_answers_course_owner_all" ON public.attempt_answers
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_attempt_in_teachers_course(attempt_id)))
    WITH CHECK ((SELECT private.is_attempt_in_teachers_course(attempt_id)));

COMMENT ON POLICY "attempt_answers_course_owner_all" ON public.attempt_answers IS
  'Владелец курса: ответы в попытках тестов своего курса.';
