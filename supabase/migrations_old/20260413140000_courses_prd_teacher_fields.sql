-- =============================================================================
-- PRD: аудитория курса, языки (массив), галерея, старт набора, уровни CEFR,
-- slug для публичной страницы; поля преподавателя в profiles.
-- Применить после 20260413120000_profiles_courses_modules_lessons.sql
-- =============================================================================

CREATE TYPE public.target_audience AS ENUM ('kids', 'adults');

CREATE TYPE public.start_date_type AS ENUM ('fixed', 'on_demand');

CREATE TYPE public.course_level AS ENUM (
  '0',
  'A1',
  'A2',
  'B1',
  'B1+',
  'B2',
  'B2+',
  'C1',
  'C2'
);

COMMENT ON TYPE public.course_level IS
  'Уровни по PRD: 0, A1–C2, включая B1+/B2+.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS specialization text;

COMMENT ON COLUMN public.profiles.profession IS 'Например: преподаватель английского.';

COMMENT ON COLUMN public.profiles.specialization IS 'Узкая специализация / методика.';

-- Slug для маршрута /courses/[slug]
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.courses
SET slug = 'course-' || id::text
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS courses_slug_key ON public.courses (slug);

ALTER TABLE public.courses
  ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS target_audience public.target_audience NOT NULL DEFAULT 'adults',
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS images_gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS start_date_type public.start_date_type NOT NULL DEFAULT 'on_demand',
  ADD COLUMN IF NOT EXISTS start_date timestamp with time zone;

COMMENT ON COLUMN public.courses.languages IS
  'Список языков курса (например English, French) — text[].';

COMMENT ON COLUMN public.courses.images_gallery IS
  'Галерея изображений: JSON-массив URL или объектов { url, alt }.';

-- Перенос старого поля language → languages, затем удаление
UPDATE public.courses
SET languages = ARRAY[language]
WHERE
  language IS NOT NULL
  AND btrim(language) <> ''
  AND cardinality(languages) = 0;

ALTER TABLE public.courses DROP COLUMN IF EXISTS language;

-- level (text) → course_level enum, колонка по-прежнему level
ALTER TABLE public.courses
  ADD COLUMN level_new public.course_level;

UPDATE public.courses
SET level_new = v.mapped
FROM (
  SELECT
    id,
    CASE lower(btrim(coalesce(level, '')))
      WHEN '0' THEN '0'::public.course_level
      WHEN 'a1' THEN 'A1'::public.course_level
      WHEN 'a2' THEN 'A2'::public.course_level
      WHEN 'b1' THEN 'B1'::public.course_level
      WHEN 'b1+' THEN 'B1+'::public.course_level
      WHEN 'b2' THEN 'B2'::public.course_level
      WHEN 'b2+' THEN 'B2+'::public.course_level
      WHEN 'c1' THEN 'C1'::public.course_level
      WHEN 'c2' THEN 'C2'::public.course_level
      ELSE NULL
    END AS mapped
  FROM public.courses
) AS v
WHERE public.courses.id = v.id;

UPDATE public.courses
SET level_new = 'A1'::public.course_level
WHERE level_new IS NULL;

ALTER TABLE public.courses DROP COLUMN IF EXISTS level;

ALTER TABLE public.courses
  RENAME COLUMN level_new TO level;

ALTER TABLE public.courses
  ALTER COLUMN level SET NOT NULL,
  ALTER COLUMN level SET DEFAULT 'A1'::public.course_level;
