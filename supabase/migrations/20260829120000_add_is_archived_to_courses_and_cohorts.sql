-- Soft-delete flags for courses and cohorts: true = archived, hidden from default lists.
ALTER TABLE IF EXISTS public.courses
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false NOT NULL;

ALTER TABLE IF EXISTS public.cohorts
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN public.courses.is_archived IS
  'true — курс в архиве (soft delete). Не показывается в активных списках B2B/B2C.';

COMMENT ON COLUMN public.cohorts.is_archived IS
  'true — поток в архиве (soft delete). Зарезервировано для будущей синхронизации с архивом курса.';
