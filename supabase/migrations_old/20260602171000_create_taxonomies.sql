-- Phase 248: справочник таксономий для динамических фильтров каталога и форм.

CREATE TABLE public.taxonomies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  label text NOT NULL,
  value text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT taxonomies_type_value_unique UNIQUE (type, value),
  CONSTRAINT taxonomies_type_nonempty_chk CHECK (char_length(trim(type)) > 0),
  CONSTRAINT taxonomies_label_nonempty_chk CHECK (char_length(trim(label)) > 0),
  CONSTRAINT taxonomies_value_nonempty_chk CHECK (char_length(trim(value)) > 0)
);

CREATE INDEX taxonomies_type_sort_order_idx
ON public.taxonomies (type, sort_order);

CREATE INDEX taxonomies_type_active_idx
ON public.taxonomies (type)
WHERE is_active = true;

COMMENT ON TABLE public.taxonomies IS
  'Унифицированный справочник значений фильтров (format, language, audience, age_group, cefr_level).';

COMMENT ON COLUMN public.taxonomies.type IS
  'Категория: format, language, audience, age_group, cefr_level и т.д.';

COMMENT ON COLUMN public.taxonomies.label IS
  'Человекочитаемая подпись для UI (например, «Онлайн»).';

COMMENT ON COLUMN public.taxonomies.value IS
  'Стабильный ключ для URL и бизнес-логики (например, online).';

ALTER TABLE public.taxonomies ENABLE ROW LEVEL SECURITY;

-- Публичное чтение активных записей; админ видит все (включая неактивные).
CREATE POLICY taxonomies_select_visible
ON public.taxonomies FOR SELECT
USING (
  is_active = true
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
);

CREATE POLICY taxonomies_insert_admin
ON public.taxonomies FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
);

CREATE POLICY taxonomies_update_admin
ON public.taxonomies FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
);

CREATE POLICY taxonomies_delete_admin
ON public.taxonomies FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  )
);

GRANT SELECT ON public.taxonomies TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.taxonomies TO authenticated;
