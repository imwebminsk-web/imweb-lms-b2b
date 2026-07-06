-- Время создания курса: сортировка «новые сверху» на /dashboard/courses
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.courses.created_at IS
  'Момент создания записи; для существующих строк задаётся при добавлении колонки.';
