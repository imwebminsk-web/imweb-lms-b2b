-- Ограничение времени на прохождение теста (в минутах). 0 = без лимита.
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS time_limit integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tests.time_limit IS
  'Лимит времени на попытку в минутах; 0 означает отсутствие ограничения.';
