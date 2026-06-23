-- Phase 345: флаги непрочитанных обращений и удаление тикетов staff.

ALTER TABLE public.support_tickets
ADD COLUMN IF NOT EXISTS has_unread_teacher boolean NOT NULL DEFAULT true;

ALTER TABLE public.support_tickets
ADD COLUMN IF NOT EXISTS has_unread_student boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.support_tickets.has_unread_teacher IS
  'true — у преподавателя/админа есть непросмотренные обновления по тикету.';

COMMENT ON COLUMN public.support_tickets.has_unread_student IS
  'true — у ученика есть непросмотренные ответы по тикету.';

GRANT DELETE ON public.support_tickets TO authenticated;

-- Удаление: только учитель или админ.
CREATE POLICY support_tickets_delete_teacher
ON public.support_tickets FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role IN (
        'teacher'::public.profile_role,
        'admin'::public.profile_role
      )
  )
);
