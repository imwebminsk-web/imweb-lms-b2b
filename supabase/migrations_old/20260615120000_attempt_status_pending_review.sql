-- Ручная проверка развёрнутых ответов (text_input)
ALTER TYPE public.attempt_status ADD VALUE IF NOT EXISTS 'pending_review';

COMMENT ON TYPE public.attempt_status IS
  'in_progress | completed | pending_review (ожидает проверки преподавателем)';
