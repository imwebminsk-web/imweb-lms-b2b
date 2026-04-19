-- Phase 24: галерея промо-изображений на лендинге курса (массив публичных URL).
-- После применения: supabase db push

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS promotional_images text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.courses.promotional_images IS
  'Публичные URL изображений галереи лендинга (Storage course-covers, сжатие на клиенте).';
