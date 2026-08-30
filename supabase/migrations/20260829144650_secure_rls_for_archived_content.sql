-- Block lesson content (RLS helpers) when the course or cohort is archived.
-- Students with an active enrollment must not read lesson_blocks via Data API.

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
    INNER JOIN public.courses AS c ON c.id = e.course_id
    LEFT JOIN public.cohorts AS ch ON ch.id = e.cohort_id
    WHERE e.course_id = p_course_id
      AND e.user_id = (SELECT auth.uid())
      AND e.status = 'active'
      AND c.is_archived = false
      AND (ch.id IS NULL OR ch.is_archived = false)
  );
$$;

COMMENT ON FUNCTION private.is_enrolled_in_course(uuid) IS
  'true, если у текущего пользователя есть активная запись на курс, курс не в архиве, и группа (если есть) не в архиве.';

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
        AND c.is_archived = false
        AND private.is_enrolled_in_course(c.id)
    );
$$;

COMMENT ON FUNCTION private.can_select_lesson(uuid) IS
  'Админ / владелец курса, либо записанный ученик опубликованного неархивного курса. Архив группы проверяется в is_enrolled_in_course.';
