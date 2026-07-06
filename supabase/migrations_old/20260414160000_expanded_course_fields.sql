-- =============================================================================
-- Phase 10: маркетинговые поля курса + bucket course-videos (до ~500 МБ)
--
-- Уже есть в схеме: start_date (timestamptz), level (course_level = CEFR),
-- target_audience (enum kids/adults). Добавляем отдельные текстовые поля
-- для лендинга и видео, не дублируя эти колонки.
-- =============================================================================

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS detailed_description text,
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS vimeo_url text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS has_certificate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_audience text,
  ADD COLUMN IF NOT EXISTS difficulty_level text,
  ADD COLUMN IF NOT EXISTS duration_value integer,
  ADD COLUMN IF NOT EXISTS duration_unit text;

COMMENT ON COLUMN public.courses.detailed_description IS
  'Развёрнутое описание для лендинга курса.';

COMMENT ON COLUMN public.courses.youtube_url IS 'Ссылка на ролик YouTube.';

COMMENT ON COLUMN public.courses.vimeo_url IS 'Ссылка на ролик Vimeo.';

COMMENT ON COLUMN public.courses.video_url IS
  'Публичный URL видео с self-host (Supabase Storage, bucket course-videos).';

COMMENT ON COLUMN public.courses.category IS 'Категория / тематика курса (текст).';

COMMENT ON COLUMN public.courses.has_certificate IS 'Флаг выдачи сертификата.';

COMMENT ON COLUMN public.courses.marketing_audience IS
  'Сегмент для лендинга: kids | teens | adults | all (отдельно от enum target_audience).';

COMMENT ON COLUMN public.courses.difficulty_level IS
  'Сложность: beginner | intermediate | advanced | any.';

COMMENT ON COLUMN public.courses.duration_value IS 'Число для длительности (вместе с duration_unit).';

COMMENT ON COLUMN public.courses.duration_unit IS 'Единица: hours | weeks | months.';

-- ---------------------------------------------------------------------------
-- Storage: course-videos (публичное чтение; запись в {auth.uid()}/…)
-- Если INSERT в buckets падает из-за версии API — создайте bucket в Dashboard.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-videos',
  'course-videos',
  true,
  524288000,
  ARRAY['video/mp4', 'video/webm']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "course_videos_select_public" ON storage.objects;
DROP POLICY IF EXISTS "course_videos_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "course_videos_update_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "course_videos_delete_own_folder" ON storage.objects;

CREATE POLICY "course_videos_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'course-videos');

CREATE POLICY "course_videos_insert_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-videos'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "course_videos_update_own_folder"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'course-videos'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'course-videos'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "course_videos_delete_own_folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'course-videos'
  AND (string_to_array(name, '/'))[1] = (SELECT auth.uid()::text)
);
