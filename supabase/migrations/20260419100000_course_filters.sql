-- Phase 31: формат проведения и язык для каталога и фильтров на главной.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS delivery_format text;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS language text;

COMMENT ON COLUMN public.courses.delivery_format IS
  'Формат: Онлайн | Офлайн | Гибрид.';

COMMENT ON COLUMN public.courses.language IS
  'Язык курса для витрины (например, Английский).';
