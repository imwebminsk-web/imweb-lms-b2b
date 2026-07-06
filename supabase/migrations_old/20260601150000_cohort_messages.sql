-- Phase 216: групповой чат когорты с Supabase Realtime.

CREATE TABLE public.cohort_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cohort_messages_content_nonempty_chk CHECK (char_length(trim(content)) > 0),
  CONSTRAINT cohort_messages_content_max_len_chk CHECK (char_length(content) <= 2000)
);

CREATE INDEX cohort_messages_cohort_id_created_at_idx
ON public.cohort_messages (cohort_id, created_at DESC);

COMMENT ON TABLE public.cohort_messages IS
  'Сообщения группового чата когорты; доступ по RLS для учителя, админа и записанных учеников.';

ALTER TABLE public.cohort_messages ENABLE ROW LEVEL SECURITY;

-- Чтение: учитель курса группы, админ или записанный участник когорты.
CREATE POLICY cohort_messages_select_member
ON public.cohort_messages FOR SELECT TO authenticated
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
    FROM public.cohorts ch
      INNER JOIN public.courses c ON c.id = ch.course_id
    WHERE
      ch.id = cohort_messages.cohort_id
      AND c.teacher_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE
      e.cohort_id = cohort_messages.cohort_id
      AND e.user_id = (SELECT auth.uid())
  )
);

-- Отправка: только от своего user_id и при доступе к когорте.
CREATE POLICY cohort_messages_insert_member
ON public.cohort_messages FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE
        p.id = (SELECT auth.uid())
        AND p.role = 'admin'::public.profile_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.cohorts ch
        INNER JOIN public.courses c ON c.id = ch.course_id
      WHERE
        ch.id = cohort_messages.cohort_id
        AND c.teacher_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.enrollments e
      WHERE
        e.cohort_id = cohort_messages.cohort_id
        AND e.user_id = (SELECT auth.uid())
    )
  )
);

GRANT SELECT, INSERT ON public.cohort_messages TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.cohort_messages;
