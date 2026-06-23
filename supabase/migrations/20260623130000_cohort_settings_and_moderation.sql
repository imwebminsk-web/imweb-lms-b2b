-- Phase 339: настройки группы (чат) и модерация сообщений преподавателем.

ALTER TABLE public.cohorts
ADD COLUMN IF NOT EXISTS is_chat_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.cohorts.is_chat_enabled IS
  'Включён ли групповой чат когорты; при false участники не могут читать и писать сообщения.';

GRANT DELETE ON public.cohort_messages TO authenticated;

-- Удаление: админ или учитель курса, к которому относится когорта сообщения.
CREATE POLICY cohort_messages_delete_teacher
ON public.cohort_messages FOR DELETE TO authenticated
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
);
