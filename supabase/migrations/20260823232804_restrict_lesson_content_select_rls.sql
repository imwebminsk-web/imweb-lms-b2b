-- Lock down lesson content (lesson_blocks) to enrolled users and staff.
-- Published lesson titles stay readable for public course landing pages.
-- Helper lives in `private` so PostgREST / Data API cannot call it directly.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER + empty search_path: no RLS recursion, no search-path hijack)
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

COMMENT ON FUNCTION private.is_platform_admin() IS
  'true, если текущий пользователь — admin или head_teacher.';

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

COMMENT ON FUNCTION private.is_course_owner(uuid) IS
  'true, если текущий пользователь — владелец курса (courses.teacher_id).';

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

COMMENT ON FUNCTION private.is_enrolled_in_course(uuid) IS
  'true, если есть строка enrollments для текущего пользователя и курса.';

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

COMMENT ON FUNCTION private.can_select_lesson(uuid) IS
  'Черновики: admin / head_teacher / владелец курса. Опубликованный урок: ещё и записанный ученик.';

CREATE OR REPLACE FUNCTION private.can_select_lesson_block(p_lesson_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT private.can_select_lesson(p_lesson_id));
$$;

COMMENT ON FUNCTION private.can_select_lesson_block(uuid) IS
  'Контент блоков доступен тем же, кто может читать сам урок по строгим правилам (не публично).';

REVOKE ALL ON FUNCTION private.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_course_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_enrolled_in_course(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_select_lesson(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_select_lesson_block(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_course_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_enrolled_in_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_select_lesson(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_select_lesson_block(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION private.is_platform_admin() TO service_role;
GRANT EXECUTE ON FUNCTION private.is_course_owner(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.is_enrolled_in_course(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.can_select_lesson(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.can_select_lesson_block(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- lessons: published titles stay public (landing); drafts only staff/owner
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

COMMENT ON POLICY lessons_select_published ON public.lessons IS
  'Лендинг курса: названия опубликованных уроков видны всем, включая anon.';

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

COMMENT ON POLICY lessons_select_staff_or_owner ON public.lessons IS
  'Черновики и полный ряд урока: admin, head_teacher или владелец курса.';

-- ---------------------------------------------------------------------------
-- lesson_blocks: NEVER public. Enrolled + published, or staff/owner.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "lesson_blocks_select_visible" ON public.lesson_blocks;
DROP POLICY IF EXISTS lesson_blocks_select_enrolled_or_staff ON public.lesson_blocks;

CREATE POLICY lesson_blocks_select_enrolled_or_staff
  ON public.lesson_blocks
  FOR SELECT
  TO authenticated
  USING (private.can_select_lesson_block(lesson_id));

COMMENT ON POLICY lesson_blocks_select_enrolled_or_staff ON public.lesson_blocks IS
  'Текст, видео, квизы и задания — только записанным ученикам и персоналу курса.';
