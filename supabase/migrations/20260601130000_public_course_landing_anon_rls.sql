-- Phase 213: публичный лендинг курса для anon — опубликованный курс и только опубликованные уроки.

DROP POLICY IF EXISTS "courses_select_visible" ON public.courses;
DROP POLICY IF EXISTS "modules_select_visible" ON public.modules;
DROP POLICY IF EXISTS "lessons_select_visible" ON public.lessons;

CREATE POLICY "courses_select_visible"
ON public.courses FOR SELECT TO anon, authenticated
  USING (
    status = 'published'::public.course_status
    OR (
      (SELECT auth.uid()) IS NOT NULL
      AND teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "modules_select_visible"
ON public.modules FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE
        c.id = modules.course_id
        AND (
          c.status = 'published'::public.course_status
          OR (
            (SELECT auth.uid()) IS NOT NULL
            AND c.teacher_id = (SELECT auth.uid())
          )
        )
    )
  );

CREATE POLICY "lessons_select_visible"
ON public.lessons FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.modules m
        JOIN public.courses c ON c.id = m.course_id
      WHERE
        m.id = lessons.module_id
        AND (SELECT auth.uid()) IS NOT NULL
        AND c.teacher_id = (SELECT auth.uid())
    )
    OR (
      lessons.is_published = true
      AND EXISTS (
        SELECT 1
        FROM public.modules m
          JOIN public.courses c ON c.id = m.course_id
        WHERE
          m.id = lessons.module_id
          AND c.status = 'published'::public.course_status
      )
    )
  );

GRANT SELECT ON public.courses TO anon, authenticated;
GRANT SELECT ON public.modules TO anon, authenticated;
GRANT SELECT ON public.lessons TO anon, authenticated;
