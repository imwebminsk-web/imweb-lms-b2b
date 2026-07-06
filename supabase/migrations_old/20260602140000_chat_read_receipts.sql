-- Phase 223: отметки прочтения чата когорты.

CREATE TABLE public.chat_read_receipts (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cohort_id)
);

CREATE INDEX chat_read_receipts_cohort_id_idx
ON public.chat_read_receipts (cohort_id);

COMMENT ON TABLE public.chat_read_receipts IS
  'Время последнего просмотра чата когорты пользователем.';

ALTER TABLE public.chat_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_read_receipts_select_own
ON public.chat_read_receipts FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY chat_read_receipts_insert_own
ON public.chat_read_receipts FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY chat_read_receipts_update_own
ON public.chat_read_receipts FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.chat_read_receipts TO authenticated;
