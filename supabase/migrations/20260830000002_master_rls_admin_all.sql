-- Master admin RLS: remaining content, grading, tests, B2B matrix, and taxonomies.
-- Depends on private.is_admin() from 20260830000001_fix_courses_enrollments_rls_admin.sql.
-- Does not touch platform_settings, organizations, support_*, or auth.users.

-- (SELECT private.is_admin()) is an initplan: Postgres evaluates it once per
-- statement, not once per row. WITH CHECK covers INSERT/UPDATE; USING covers
-- SELECT/UPDATE/DELETE. FOR ALL without WITH CHECK would default to USING.

-- ---------------------------------------------------------------------------
-- Course builder
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "modules_admin_all" ON public.modules;

CREATE POLICY "modules_admin_all" ON public.modules
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "modules_admin_all" ON public.modules IS
  'Admin: полный доступ к модулям курса (конструктор).';

DROP POLICY IF EXISTS "lessons_admin_all" ON public.lessons;

CREATE POLICY "lessons_admin_all" ON public.lessons
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "lessons_admin_all" ON public.lessons IS
  'Admin: полный доступ к урокам (конструктор и назначения группе).';

DROP POLICY IF EXISTS "lesson_blocks_admin_all" ON public.lesson_blocks;

CREATE POLICY "lesson_blocks_admin_all" ON public.lesson_blocks
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "lesson_blocks_admin_all" ON public.lesson_blocks IS
  'Admin: полный доступ к блокам урока (текст, квиз, задание).';

DROP POLICY IF EXISTS "cohort_assignments_admin_all" ON public.cohort_assignments;

CREATE POLICY "cohort_assignments_admin_all" ON public.cohort_assignments
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "cohort_assignments_admin_all" ON public.cohort_assignments IS
  'Admin: полный доступ к назначениям уроков группе.';

-- ---------------------------------------------------------------------------
-- Gradebook and attempts
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "student_attempts_admin_all" ON public.student_attempts;

CREATE POLICY "student_attempts_admin_all" ON public.student_attempts
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "student_attempts_admin_all" ON public.student_attempts IS
  'Admin: полный доступ к попыткам тестов (журнал, оценка, пересдача).';

DROP POLICY IF EXISTS "attempt_answers_admin_all" ON public.attempt_answers;

CREATE POLICY "attempt_answers_admin_all" ON public.attempt_answers
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "attempt_answers_admin_all" ON public.attempt_answers IS
  'Admin: полный доступ к ответам в попытке (ручная оценка).';

DROP POLICY IF EXISTS "assignment_submissions_admin_all" ON public.assignment_submissions;

CREATE POLICY "assignment_submissions_admin_all" ON public.assignment_submissions
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "assignment_submissions_admin_all" ON public.assignment_submissions IS
  'Admin: полный доступ к сдачам заданий (очередь проверки, журнал).';

DROP POLICY IF EXISTS "lesson_completions_admin_all" ON public.lesson_completions;

CREATE POLICY "lesson_completions_admin_all" ON public.lesson_completions
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "lesson_completions_admin_all" ON public.lesson_completions IS
  'Admin: полный доступ к отметкам прохождения урока (сброс при пересдаче).';

-- ---------------------------------------------------------------------------
-- Tests
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "tests_admin_all" ON public.tests;

CREATE POLICY "tests_admin_all" ON public.tests
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "tests_admin_all" ON public.tests IS
  'Admin: полный доступ к тестам (архив, удаление, inline-квиз).';

DROP POLICY IF EXISTS "questions_admin_all" ON public.questions;

CREATE POLICY "questions_admin_all" ON public.questions
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "questions_admin_all" ON public.questions IS
  'Admin: полный доступ к вопросам теста.';

DROP POLICY IF EXISTS "options_admin_all" ON public.options;

CREATE POLICY "options_admin_all" ON public.options
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "options_admin_all" ON public.options IS
  'Admin: полный доступ к вариантам ответа.';

-- ---------------------------------------------------------------------------
-- B2B matrix
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "team_courses_admin_all" ON public.team_courses;

CREATE POLICY "team_courses_admin_all" ON public.team_courses
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "team_courses_admin_all" ON public.team_courses IS
  'Admin: полный доступ к назначению курсов командам.';

DROP POLICY IF EXISTS "job_title_courses_admin_all" ON public.job_title_courses;

CREATE POLICY "job_title_courses_admin_all" ON public.job_title_courses
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "job_title_courses_admin_all" ON public.job_title_courses IS
  'Admin: полный доступ к назначению курсов должностям.';

DROP POLICY IF EXISTS "teams_admin_all" ON public.teams;

CREATE POLICY "teams_admin_all" ON public.teams
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "teams_admin_all" ON public.teams IS
  'Admin: полный доступ к командам организации.';

DROP POLICY IF EXISTS "job_titles_admin_all" ON public.job_titles;

CREATE POLICY "job_titles_admin_all" ON public.job_titles
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "job_titles_admin_all" ON public.job_titles IS
  'Admin: полный доступ к справочнику должностей.';

DROP POLICY IF EXISTS "team_members_admin_all" ON public.team_members;

CREATE POLICY "team_members_admin_all" ON public.team_members
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "team_members_admin_all" ON public.team_members IS
  'Admin: полный доступ к составу команд (создание B2B-пользователя).';

-- ---------------------------------------------------------------------------
-- Taxonomies (catalog filters and B2B user tags)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "taxonomies_admin_all" ON public.taxonomies;

CREATE POLICY "taxonomies_admin_all" ON public.taxonomies
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "taxonomies_admin_all" ON public.taxonomies IS
  'Admin: полный доступ к значениям таксономий (фильтры каталога).';

DROP POLICY IF EXISTS "taxonomy_groups_admin_all" ON public.taxonomy_groups;

CREATE POLICY "taxonomy_groups_admin_all" ON public.taxonomy_groups
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "taxonomy_groups_admin_all" ON public.taxonomy_groups IS
  'Admin: полный доступ к группам таксономий.';

DROP POLICY IF EXISTS "course_taxonomies_admin_all" ON public.course_taxonomies;

CREATE POLICY "course_taxonomies_admin_all" ON public.course_taxonomies
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "course_taxonomies_admin_all" ON public.course_taxonomies IS
  'Admin: полный доступ к привязке таксономий к курсу.';

DROP POLICY IF EXISTS "user_taxonomies_admin_all" ON public.user_taxonomies;

CREATE POLICY "user_taxonomies_admin_all" ON public.user_taxonomies
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "user_taxonomies_admin_all" ON public.user_taxonomies IS
  'Admin: полный доступ к тегам пользователя (создание B2B-сотрудника).';

-- course_tags существует в живой БД и в коде, но CREATE TABLE нет в этом репозитории.
-- DDL через EXECUTE: Postgres разбирает строку только в runtime, после проверки to_regclass.
-- Иначе CREATE POLICY на несуществующей таблице падает ещё на этапе парсинга всего файла.
DO $$
BEGIN
  IF to_regclass('public.course_tags') IS NULL THEN
    RAISE NOTICE 'public.course_tags is missing; skip course_tags_admin_all';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.course_tags ENABLE ROW LEVEL SECURITY;';
  EXECUTE 'DROP POLICY IF EXISTS "course_tags_admin_all" ON public.course_tags;';
  EXECUTE $pol$
    CREATE POLICY "course_tags_admin_all" ON public.course_tags
        FOR ALL
        TO authenticated
        USING ((SELECT private.is_admin()))
        WITH CHECK ((SELECT private.is_admin()));
  $pol$;
  EXECUTE $cmt$
    COMMENT ON POLICY "course_tags_admin_all" ON public.course_tags IS
      'Admin: полный доступ к тегам курса (B2B-матрица).';
  $cmt$;
END $$;
