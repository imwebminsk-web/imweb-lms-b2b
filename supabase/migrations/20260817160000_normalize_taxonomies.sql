-- =============================================================================
-- Normalize taxonomies: taxonomy_groups + course_taxonomies (many-to-many)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.taxonomy_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  CONSTRAINT taxonomy_groups_slug_nonempty CHECK (char_length(trim(slug)) > 0),
  CONSTRAINT taxonomy_groups_name_nonempty CHECK (char_length(trim(name)) > 0)
);

COMMENT ON TABLE public.taxonomy_groups IS 'Группы таксономий (бывший taxonomies.type): format, language, audience и т.д.';
COMMENT ON COLUMN public.taxonomy_groups.slug IS 'Стабильный ключ группы (совпадает с прежним taxonomies.type).';
COMMENT ON COLUMN public.taxonomy_groups.name IS 'Человекочитаемое название группы для админки.';

INSERT INTO public.taxonomy_groups (slug, name)
SELECT DISTINCT
  t.type AS slug,
  CASE t.type
    WHEN 'format' THEN 'Формат'
    WHEN 'language' THEN 'Язык'
    WHEN 'audience' THEN 'Аудитория'
    WHEN 'age_group' THEN 'Возраст'
    WHEN 'cefr_level' THEN 'Уровень CEFR'
    ELSE initcap(replace(t.type, '_', ' '))
  END AS name
FROM public.taxonomies t
WHERE char_length(trim(t.type)) > 0
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.taxonomies
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.taxonomy_groups(id) ON DELETE CASCADE;

UPDATE public.taxonomies t
SET group_id = g.id
FROM public.taxonomy_groups g
WHERE g.slug = t.type
  AND t.group_id IS NULL;

ALTER TABLE public.taxonomies
  ALTER COLUMN group_id SET NOT NULL;

ALTER TABLE public.taxonomies
  DROP CONSTRAINT IF EXISTS taxonomies_type_value_unique;

DROP INDEX IF EXISTS public.taxonomies_type_active_idx;
DROP INDEX IF EXISTS public.taxonomies_type_sort_order_idx;

ALTER TABLE public.taxonomies
  DROP COLUMN IF EXISTS type;

ALTER TABLE public.taxonomies
  ADD CONSTRAINT taxonomies_group_value_unique UNIQUE (group_id, value);

CREATE INDEX IF NOT EXISTS taxonomies_group_id_active_idx
  ON public.taxonomies (group_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS taxonomies_group_sort_order_idx
  ON public.taxonomies (group_id, sort_order);

CREATE TABLE IF NOT EXISTS public.course_taxonomies (
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  taxonomy_id uuid NOT NULL REFERENCES public.taxonomies(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, taxonomy_id)
);

COMMENT ON TABLE public.course_taxonomies IS 'Связь курсов с таксономиями (many-to-many).';

CREATE INDEX IF NOT EXISTS course_taxonomies_taxonomy_id_idx
  ON public.course_taxonomies (taxonomy_id);

INSERT INTO public.course_taxonomies (course_id, taxonomy_id)
SELECT c.id, c.delivery_format
FROM public.courses c
WHERE c.delivery_format IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.course_taxonomies (course_id, taxonomy_id)
SELECT c.id, c.language
FROM public.courses c
WHERE c.language IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.course_taxonomies (course_id, taxonomy_id)
SELECT c.id, c.marketing_audience
FROM public.courses c
WHERE c.marketing_audience IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.course_taxonomies (course_id, taxonomy_id)
SELECT c.id, c.age_group
FROM public.courses c
WHERE c.age_group IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.course_taxonomies (course_id, taxonomy_id)
SELECT c.id, c.level
FROM public.courses c
WHERE c.level IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.courses
  DROP COLUMN IF EXISTS delivery_format,
  DROP COLUMN IF EXISTS language,
  DROP COLUMN IF EXISTS marketing_audience,
  DROP COLUMN IF EXISTS age_group,
  DROP COLUMN IF EXISTS level,
  DROP COLUMN IF EXISTS target_audience;

DROP TYPE IF EXISTS public.target_audience;

-- RLS: taxonomy_groups
ALTER TABLE public.taxonomy_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY taxonomy_groups_select_all
  ON public.taxonomy_groups
  FOR SELECT
  USING (true);

CREATE POLICY taxonomy_groups_insert_admin
  ON public.taxonomy_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY taxonomy_groups_update_admin
  ON public.taxonomy_groups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY taxonomy_groups_delete_admin
  ON public.taxonomy_groups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- RLS: course_taxonomies
ALTER TABLE public.course_taxonomies ENABLE ROW LEVEL SECURITY;

CREATE POLICY course_taxonomies_select_visible
  ON public.course_taxonomies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.status = 'published'::public.course_status
          OR c.teacher_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
          )
        )
    )
  );

CREATE POLICY course_taxonomies_write_teacher_or_admin
  ON public.course_taxonomies
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.teacher_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'head_teacher')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.teacher_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'head_teacher')
          )
        )
    )
  );
