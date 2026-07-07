-- =============================================================================
-- Migrate courses taxonomy columns to use taxonomy UUIDs
-- =============================================================================

ALTER TABLE public.courses
  DROP COLUMN IF EXISTS delivery_format,
  DROP COLUMN IF EXISTS language,
  DROP COLUMN IF EXISTS marketing_audience,
  DROP COLUMN IF EXISTS age_group,
  DROP COLUMN IF EXISTS level;

ALTER TABLE public.courses
  ADD COLUMN delivery_format uuid REFERENCES public.taxonomies(id) ON DELETE SET NULL,
  ADD COLUMN language uuid REFERENCES public.taxonomies(id) ON DELETE SET NULL,
  ADD COLUMN marketing_audience uuid REFERENCES public.taxonomies(id) ON DELETE SET NULL,
  ADD COLUMN age_group uuid REFERENCES public.taxonomies(id) ON DELETE SET NULL,
  ADD COLUMN level uuid REFERENCES public.taxonomies(id) ON DELETE SET NULL;
