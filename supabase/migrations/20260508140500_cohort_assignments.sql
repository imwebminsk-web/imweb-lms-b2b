-- Назначения контента (уроки/тесты) для конкретной группы.

CREATE TABLE public.cohort_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
  test_id uuid REFERENCES public.tests(id) ON DELETE CASCADE,
  is_required boolean NOT NULL DEFAULT true,
  due_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cohort_assignments_one_target_chk CHECK (
    (lesson_id IS NOT NULL AND test_id IS NULL)
    OR (lesson_id IS NULL AND test_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX cohort_assignments_cohort_lesson_uidx
ON public.cohort_assignments (cohort_id, lesson_id)
WHERE lesson_id IS NOT NULL;

CREATE UNIQUE INDEX cohort_assignments_cohort_test_uidx
ON public.cohort_assignments (cohort_id, test_id)
WHERE test_id IS NOT NULL;

ALTER TABLE public.cohort_assignments ENABLE ROW LEVEL SECURITY;

-- Учитель курса может читать назначения своей группы.
CREATE POLICY cohort_assignments_select_teacher
ON public.cohort_assignments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cohorts ch
    INNER JOIN public.courses c ON c.id = ch.course_id
    WHERE ch.id = cohort_assignments.cohort_id
      AND c.teacher_id = auth.uid()
  )
);

-- Студент видит только назначения своей группы.
CREATE POLICY cohort_assignments_select_student_member
ON public.cohort_assignments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.cohort_id = cohort_assignments.cohort_id
      AND e.user_id = auth.uid()
  )
);

-- Создание/обновление/удаление — только учитель курса группы.
CREATE POLICY cohort_assignments_insert_teacher
ON public.cohort_assignments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.cohorts ch
    INNER JOIN public.courses c ON c.id = ch.course_id
    WHERE ch.id = cohort_assignments.cohort_id
      AND c.teacher_id = auth.uid()
  )
);

CREATE POLICY cohort_assignments_update_teacher
ON public.cohort_assignments FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cohorts ch
    INNER JOIN public.courses c ON c.id = ch.course_id
    WHERE ch.id = cohort_assignments.cohort_id
      AND c.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.cohorts ch
    INNER JOIN public.courses c ON c.id = ch.course_id
    WHERE ch.id = cohort_assignments.cohort_id
      AND c.teacher_id = auth.uid()
  )
);

CREATE POLICY cohort_assignments_delete_teacher
ON public.cohort_assignments FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cohorts ch
    INNER JOIN public.courses c ON c.id = ch.course_id
    WHERE ch.id = cohort_assignments.cohort_id
      AND c.teacher_id = auth.uid()
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.cohort_assignments
TO authenticated;
