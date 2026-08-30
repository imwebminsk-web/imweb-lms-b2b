-- Head teacher (and admin via is_platform_admin): full RLS on course builder
-- and tests. Depends on private.is_platform_admin() from
-- 20260823233343_lock_enrollments_and_lesson_content.sql.
-- Overlaps *_admin_all for admin; policies OR together — that is expected.

-- ---------------------------------------------------------------------------
-- Course builder
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "modules_head_teacher_all" ON public.modules;

CREATE POLICY "modules_head_teacher_all" ON public.modules
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_platform_admin()))
    WITH CHECK ((SELECT private.is_platform_admin()));

COMMENT ON POLICY "modules_head_teacher_all" ON public.modules IS
  'Head teacher / admin: полный доступ к модулям курса (конструктор).';

DROP POLICY IF EXISTS "lessons_head_teacher_all" ON public.lessons;

CREATE POLICY "lessons_head_teacher_all" ON public.lessons
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_platform_admin()))
    WITH CHECK ((SELECT private.is_platform_admin()));

COMMENT ON POLICY "lessons_head_teacher_all" ON public.lessons IS
  'Head teacher / admin: полный доступ к урокам.';

DROP POLICY IF EXISTS "lesson_blocks_head_teacher_all" ON public.lesson_blocks;

CREATE POLICY "lesson_blocks_head_teacher_all" ON public.lesson_blocks
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_platform_admin()))
    WITH CHECK ((SELECT private.is_platform_admin()));

COMMENT ON POLICY "lesson_blocks_head_teacher_all" ON public.lesson_blocks IS
  'Head teacher / admin: полный доступ к блокам урока.';

DROP POLICY IF EXISTS "cohort_assignments_head_teacher_all" ON public.cohort_assignments;

CREATE POLICY "cohort_assignments_head_teacher_all" ON public.cohort_assignments
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_platform_admin()))
    WITH CHECK ((SELECT private.is_platform_admin()));

COMMENT ON POLICY "cohort_assignments_head_teacher_all" ON public.cohort_assignments IS
  'Head teacher / admin: полный доступ к назначениям уроков группе.';

-- ---------------------------------------------------------------------------
-- Tests
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "tests_head_teacher_all" ON public.tests;

CREATE POLICY "tests_head_teacher_all" ON public.tests
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_platform_admin()))
    WITH CHECK ((SELECT private.is_platform_admin()));

COMMENT ON POLICY "tests_head_teacher_all" ON public.tests IS
  'Head teacher / admin: полный доступ к тестам (архив чужих тестов).';

DROP POLICY IF EXISTS "questions_head_teacher_all" ON public.questions;

CREATE POLICY "questions_head_teacher_all" ON public.questions
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_platform_admin()))
    WITH CHECK ((SELECT private.is_platform_admin()));

COMMENT ON POLICY "questions_head_teacher_all" ON public.questions IS
  'Head teacher / admin: полный доступ к вопросам теста.';

DROP POLICY IF EXISTS "options_head_teacher_all" ON public.options;

CREATE POLICY "options_head_teacher_all" ON public.options
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_platform_admin()))
    WITH CHECK ((SELECT private.is_platform_admin()));

COMMENT ON POLICY "options_head_teacher_all" ON public.options IS
  'Head teacher / admin: полный доступ к вариантам ответа.';
