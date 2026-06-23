-- Phase 342: тикеты поддержки и сообщения 1-on-1 (студент ↔ учитель/админ).

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_tickets_subject_nonempty_chk CHECK (char_length(trim(subject)) > 0),
  CONSTRAINT support_tickets_subject_max_len_chk CHECK (char_length(subject) <= 200),
  CONSTRAINT support_tickets_status_chk CHECK (status IN ('open', 'closed'))
);

CREATE INDEX support_tickets_user_id_idx ON public.support_tickets (user_id);

CREATE INDEX support_tickets_status_updated_at_idx
ON public.support_tickets (status, updated_at DESC);

COMMENT ON TABLE public.support_tickets IS
  'Обращения в поддержку от учеников; статус закрывает учитель или админ.';

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_messages_content_nonempty_chk CHECK (char_length(trim(content)) > 0),
  CONSTRAINT support_messages_content_max_len_chk CHECK (char_length(content) <= 2000)
);

CREATE INDEX support_messages_ticket_id_created_at_idx
ON public.support_messages (ticket_id, created_at ASC);

COMMENT ON TABLE public.support_messages IS
  'Сообщения в тикете поддержки; Realtime для мгновенного обновления чата.';

CREATE OR REPLACE FUNCTION public.set_support_tickets_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER support_tickets_set_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE PROCEDURE public.set_support_tickets_updated_at();

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Тикеты: ученик видит и создаёт только свои.
CREATE POLICY support_tickets_select_own
ON public.support_tickets FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY support_tickets_insert_student
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'student'::public.profile_role
  )
);

-- Тикеты: учитель и админ видят все обращения.
CREATE POLICY support_tickets_select_staff
ON public.support_tickets FOR SELECT TO authenticated
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

-- Тикеты: учитель и админ могут менять статус (например, закрыть).
CREATE POLICY support_tickets_update_staff
ON public.support_tickets FOR UPDATE TO authenticated
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
)
WITH CHECK (
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

-- Сообщения: ученик читает переписку в своём тикете.
CREATE POLICY support_messages_select_own_ticket
ON public.support_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.support_tickets t
    WHERE
      t.id = support_messages.ticket_id
      AND t.user_id = (SELECT auth.uid())
  )
);

-- Сообщения: ученик пишет только в свой тикет от своего имени.
CREATE POLICY support_messages_insert_own_ticket
ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.support_tickets t
    WHERE
      t.id = support_messages.ticket_id
      AND t.user_id = (SELECT auth.uid())
  )
);

-- Сообщения: учитель и админ читают любые тикеты.
CREATE POLICY support_messages_select_staff
ON public.support_messages FOR SELECT TO authenticated
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

-- Сообщения: учитель и админ отвечают в любой тикет от своего имени.
CREATE POLICY support_messages_insert_staff
ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = (SELECT auth.uid())
  AND EXISTS (
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

GRANT SELECT, INSERT ON public.support_tickets TO authenticated;

GRANT UPDATE ON public.support_tickets TO authenticated;

GRANT SELECT, INSERT ON public.support_messages TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
