-- Phase 214: удаление legacy-колонок courses, не используемых в UI.

ALTER TABLE public.courses
  DROP COLUMN IF EXISTS difficulty_level,
  DROP COLUMN IF EXISTS languages,
  DROP COLUMN IF EXISTS thumbnail_url,
  DROP COLUMN IF EXISTS images_gallery;
