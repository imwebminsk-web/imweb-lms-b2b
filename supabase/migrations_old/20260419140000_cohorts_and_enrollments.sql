-- Phase 32: группы (cohorts) с PIN и записи (enrollments).

CREATE TABLE public.cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  name text NOT NULL,
  pin_code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cohorts_pin_code_key UNIQUE (pin_code),
  CONSTRAINT cohorts_pin_code_format_chk CHECK (
    pin_code ~ '^[A-Z0-9]{6}$'
  )
);

CREATE INDEX cohorts_course_id_idx ON public.cohorts (course_id);

COMMENT ON TABLE public.cohorts IS
  'Учебная группа по курсу; PIN для доступа учеников.';

CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  cohort_id uuid REFERENCES public.cohorts (id) ON DELETE SET NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT enrollments_user_course_key UNIQUE (user_id, course_id)
);

CREATE INDEX enrollments_user_id_idx ON public.enrollments (user_id);

CREATE INDEX enrollments_course_id_idx ON public.enrollments (course_id);

CREATE INDEX enrollments_cohort_id_idx ON public.enrollments (cohort_id);

COMMENT ON TABLE public.enrollments IS
  'Запись пользователя на курс; cohort_id — группа или NULL (индивидуально).';

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Когорты: чтение — владелец курса или участник группы.
CREATE POLICY cohorts_select_teacher_or_member
ON public.cohorts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE
        c.id = cohorts.course_id
        AND c.teacher_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.enrollments e
      WHERE
        e.cohort_id = cohorts.id
        AND e.user_id = (SELECT auth.uid())
    )
  );

-- Создание группы — только владелец курса.
CREATE POLICY cohorts_insert_teacher
ON public.cohorts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE
        c.id = cohorts.course_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY cohorts_update_teacher
ON public.cohorts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE
        c.id = cohorts.course_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE
        c.id = cohorts.course_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY cohorts_delete_teacher
ON public.cohorts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE
        c.id = cohorts.course_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

-- Записи: своё или курсы преподавателя.
CREATE POLICY enrollments_select_own_or_teacher
ON public.enrollments FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE
        c.id = enrollments.course_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohorts TO authenticated;

GRANT SELECT ON public.enrollments TO authenticated;
