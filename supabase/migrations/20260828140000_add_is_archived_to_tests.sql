-- Soft-delete flag for tests: true = archived, hidden from default library lists.
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN public.tests.is_archived IS
  'true — тест в архиве (soft delete). Не показывается в библиотеке по умолчанию.';
