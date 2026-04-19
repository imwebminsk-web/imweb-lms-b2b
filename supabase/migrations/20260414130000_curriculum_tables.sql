-- =============================================================================
-- Phase 6 — Curriculum: дополнение схемы modules / lessons
--
-- Базовые таблицы и RLS уже созданы в:
--   20260413120000_profiles_courses_modules_lessons.sql
--
-- Здесь только: временные метки, флаг публикации урока, значение enum quiz,
-- значение по умолчанию для type, поясняющие COMMENT.
-- Колонка порядка модулей/уроков в проекте: order_index (= семантика position).
-- Контент урока: jsonb content (гибко для Phase 7); простой текст/URL — внутри
-- структуры JSON или отдельным полем в следующих итерациях при необходимости.
-- =============================================================================

COMMENT ON COLUMN public.modules.order_index IS
  'Порядок модуля в курсе (аналог поля position из спецификации Phase 6).';

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.modules.created_at IS
  'Время создания записи модуля.';

COMMENT ON COLUMN public.lessons.content IS
  'JSON-контент урока (структура под video/text/quiz в UI следующих фаз).';

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.lessons.is_published IS
  'Показывать ли урок в опубликованном курсе (черновик урока при status курса published).';

COMMENT ON COLUMN public.lessons.created_at IS
  'Время создания записи урока.';

-- Расширение enum: quiz для интерактивных уроков; test — связь с public.tests (как раньше).
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE
      n.nspname = 'public'
      AND t.typname = 'lesson_type'
      AND e.enumlabel = 'quiz'
  ) THEN
    ALTER TYPE public.lesson_type ADD VALUE 'quiz';
  END IF;
END
$do$;

ALTER TABLE public.lessons
  ALTER COLUMN type SET DEFAULT 'text'::public.lesson_type;

-- RLS: политики modules_* и lessons_* (SELECT/INSERT/UPDATE/DELETE через владельца
-- курса c.teacher_id = auth.uid()) уже включены в миграции 20260413120000; повторно
-- не создаём, чтобы не дублировать имена политик.
