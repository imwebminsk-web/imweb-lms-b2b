-- =============================================================================
-- Phase 158 — Явная отметка «урок завершён» (lesson_completions)
-- =============================================================================

CREATE TABLE public.lesson_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  student_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT lesson_completions_student_lesson_key UNIQUE (student_id, lesson_id)
);

CREATE INDEX lesson_completions_student_id_idx ON public.lesson_completions (student_id);

CREATE INDEX lesson_completions_lesson_id_idx ON public.lesson_completions (lesson_id);

COMMENT ON TABLE public.lesson_completions IS
  'Ученик явно отметил урок как завершённый; не более одной записи на пару студент–урок.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.lesson_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY lesson_completions_insert_own_student
ON public.lesson_completions FOR INSERT TO authenticated
WITH CHECK (student_id = (SELECT auth.uid()));

CREATE POLICY lesson_completions_select_own_student
ON public.lesson_completions FOR SELECT TO authenticated
USING (student_id = (SELECT auth.uid()));

CREATE POLICY lesson_completions_select_teacher_or_admin
ON public.lesson_completions FOR SELECT TO authenticated
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
    FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
    WHERE
      l.id = lesson_completions.lesson_id
      AND c.teacher_id = (SELECT auth.uid())
  )
);

CREATE POLICY lesson_completions_delete_own_student
ON public.lesson_completions FOR DELETE TO authenticated
USING (student_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, DELETE ON public.lesson_completions TO authenticated;
