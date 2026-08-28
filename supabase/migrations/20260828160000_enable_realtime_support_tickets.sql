-- Enable Realtime UPDATE events so the chat UI can lock instantly when a ticket is closed.
-- duplicate_object: таблица уже есть в публикации (повторный apply миграции безопасен).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Нужно, чтобы при UPDATE в Realtime приходили полные строки (включая status).
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
