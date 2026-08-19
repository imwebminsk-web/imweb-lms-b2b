-- Junction table: user profiles ↔ taxonomies (B2B / profile tags)

CREATE TABLE IF NOT EXISTS public.user_taxonomies (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  taxonomy_id uuid NOT NULL REFERENCES public.taxonomies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, taxonomy_id)
);

COMMENT ON TABLE public.user_taxonomies IS 'Many-to-many link between users and taxonomy tags.';

CREATE INDEX IF NOT EXISTS user_taxonomies_taxonomy_id_idx
  ON public.user_taxonomies (taxonomy_id);

ALTER TABLE public.user_taxonomies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users"
  ON public.user_taxonomies
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated');
