-- Final lockdown: no self-enrollment via Data API.
-- lesson_blocks: enrolled / course owner / admin / head_teacher only.
-- lessons: published metadata stays public for landing pages; drafts = staff/owner.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER, empty search_path — no RLS recursion)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.role IN (
        'admin'::public.profile_role,
        'head_teacher'::public.profile_role
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.is_course_owner(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.courses AS c
    WHERE c.id = p_course_id
      AND c.teacher_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION private.is_enrolled_in_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments AS e
    WHERE e.course_id = p_course_id
      AND e.user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION private.can_select_lesson(p_lesson_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT private.is_platform_admin())
    OR EXISTS (
      SELECT 1
      FROM public.lessons AS l
      INNER JOIN public.modules AS m ON m.id = l.module_id
      WHERE l.id = p_lesson_id
        AND private.is_course_owner(m.course_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.lessons AS l
      INNER JOIN public.modules AS m ON m.id = l.module_id
      INNER JOIN public.courses AS c ON c.id = m.course_id
      WHERE l.id = p_lesson_id
        AND l.is_published = true
        AND c.status = 'published'::public.course_status
        AND private.is_enrolled_in_course(c.id)
    );
$$;

CREATE OR REPLACE FUNCTION private.can_select_lesson_block(p_lesson_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.can_select_lesson(p_lesson_id);
$$;

REVOKE ALL ON FUNCTION private.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_course_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_enrolled_in_course(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_select_lesson(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_select_lesson_block(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.is_platform_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_course_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_enrolled_in_course(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_select_lesson(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_select_lesson_block(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- enrollments: запрет самозаписи
-- Легитимные INSERT: join_cohort_by_pin, B2B-триггеры (SECURITY DEFINER),
-- service_role, либо staff/владелец курса ниже.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "enrollments_insert_own" ON public.enrollments;
DROP POLICY IF EXISTS enrollments_insert_staff_or_owner ON public.enrollments;

CREATE POLICY enrollments_insert_staff_or_owner
  ON public.enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT private.is_platform_admin())
    OR private.is_course_owner(course_id)
  );

COMMENT ON POLICY enrollments_insert_staff_or_owner ON public.enrollments IS
  'Записать ученика может admin, head_teacher или владелец курса. Самозапись запрещена.';

-- ---------------------------------------------------------------------------
-- lessons: лендинг видит опубликованные названия; черновики — staff/owner
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "lessons_select_visible" ON public.lessons;
DROP POLICY IF EXISTS lessons_select_published ON public.lessons;
DROP POLICY IF EXISTS lessons_select_staff_or_owner ON public.lessons;

CREATE POLICY lessons_select_published
  ON public.lessons
  FOR SELECT
  TO anon, authenticated
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1
      FROM public.modules AS m
      INNER JOIN public.courses AS c ON c.id = m.course_id
      WHERE m.id = lessons.module_id
        AND c.status = 'published'::public.course_status
    )
  );

CREATE POLICY lessons_select_staff_or_owner
  ON public.lessons
  FOR SELECT
  TO authenticated
  USING (
    (SELECT private.is_platform_admin())
    OR EXISTS (
      SELECT 1
      FROM public.modules AS m
      WHERE m.id = lessons.module_id
        AND private.is_course_owner(m.course_id)
    )
  );

-- ---------------------------------------------------------------------------
-- lesson_blocks: контент только записанным и персоналу
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "lesson_blocks_select_visible" ON public.lesson_blocks;
DROP POLICY IF EXISTS lesson_blocks_select_enrolled_or_staff ON public.lesson_blocks;

CREATE POLICY lesson_blocks_select_enrolled_or_staff
  ON public.lesson_blocks
  FOR SELECT
  TO authenticated
  USING (private.can_select_lesson_block(lesson_id));
