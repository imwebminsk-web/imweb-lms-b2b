-- =============================================================================
-- Phase 148 — Сдачи заданий (блок lesson_blocks type = assignment)
-- =============================================================================

CREATE TYPE public.submission_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TABLE public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  lesson_block_id uuid NOT NULL REFERENCES public.lesson_blocks (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content text NOT NULL,
  status public.submission_status NOT NULL DEFAULT 'pending'::public.submission_status,
  grade integer,
  teacher_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assignment_submissions_lesson_block_id_idx
ON public.assignment_submissions (lesson_block_id);

CREATE INDEX assignment_submissions_student_id_idx
ON public.assignment_submissions (student_id);

COMMENT ON TABLE public.assignment_submissions IS
  'Ответы учеников на блоки урока с типом assignment; проверка преподавателем.';

-- ---------------------------------------------------------------------------
-- Авто-обновление updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_assignment_submissions_updated_at ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER assignment_submissions_set_updated_at
BEFORE UPDATE ON public.assignment_submissions
FOR EACH ROW
EXECUTE PROCEDURE public.set_assignment_submissions_updated_at ();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Вставка: только свой user_id и только для блока типа assignment.
CREATE POLICY assignment_submissions_insert_own_student
ON public.assignment_submissions FOR INSERT TO authenticated
WITH CHECK (
  student_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.lesson_blocks lb
    WHERE
      lb.id = lesson_block_id
      AND lb.type = 'assignment'::public.lesson_block_type
  )
);

-- Чтение: ученик видит только свои сдачи.
CREATE POLICY assignment_submissions_select_own_student
ON public.assignment_submissions FOR SELECT TO authenticated
USING (student_id = (SELECT auth.uid()));

-- Чтение: преподаватель курса урока или администратор.
CREATE POLICY assignment_submissions_select_teacher_or_admin
ON public.assignment_submissions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
  OR EXISTS (
    SELECT 1
    FROM public.lesson_blocks lb
      JOIN public.lessons l ON l.id = lb.lesson_id
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
    WHERE
      lb.id = assignment_submissions.lesson_block_id
      AND c.teacher_id = (SELECT auth.uid())
  )
);

-- Обновление (оценка, комментарий, статус): только преподаватель курса или админ.
CREATE POLICY assignment_submissions_update_teacher_or_admin
ON public.assignment_submissions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
  OR EXISTS (
    SELECT 1
    FROM public.lesson_blocks lb
      JOIN public.lessons l ON l.id = lb.lesson_id
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
    WHERE
      lb.id = assignment_submissions.lesson_block_id
      AND c.teacher_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
  OR EXISTS (
    SELECT 1
    FROM public.lesson_blocks lb
      JOIN public.lessons l ON l.id = lb.lesson_id
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
    WHERE
      lb.id = assignment_submissions.lesson_block_id
      AND c.teacher_id = (SELECT auth.uid())
  )
);

GRANT SELECT, INSERT, UPDATE ON public.assignment_submissions TO authenticated;
