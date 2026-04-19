-- =============================================================================
-- Phase 17 — Блочная структура уроков (lesson_blocks)
-- =============================================================================

CREATE TYPE public.lesson_block_type AS ENUM (
  'text',
  'image',
  'youtube',
  'vimeo',
  'assignment',
  'quiz'
);

CREATE TABLE public.lesson_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  lesson_id uuid NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  type public.lesson_block_type NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lesson_blocks_lesson_id_order_idx ON public.lesson_blocks (lesson_id, order_index);

COMMENT ON TABLE public.lesson_blocks IS
  'Содержимое урока как набор блоков (текст, медиа, задание, квиз).';

ALTER TABLE public.lesson_blocks ENABLE ROW LEVEL SECURITY;

-- Чтение: опубликованный курс ИЛИ владелец курса (преподаватель)
CREATE POLICY "lesson_blocks_select_visible"
ON public.lesson_blocks FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
    WHERE
      l.id = lesson_blocks.lesson_id
      AND (
        c.status = 'published'::public.course_status
        OR (
          (SELECT auth.uid()) IS NOT NULL
          AND c.teacher_id = (SELECT auth.uid())
        )
      )
  )
);

CREATE POLICY "lesson_blocks_insert_teacher"
ON public.lesson_blocks FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
    WHERE
      l.id = lesson_blocks.lesson_id
      AND c.teacher_id = (SELECT auth.uid())
  )
);

CREATE POLICY "lesson_blocks_update_teacher"
ON public.lesson_blocks FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
    WHERE
      l.id = lesson_blocks.lesson_id
      AND c.teacher_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
    WHERE
      l.id = lesson_blocks.lesson_id
      AND c.teacher_id = (SELECT auth.uid())
  )
);

CREATE POLICY "lesson_blocks_delete_teacher"
ON public.lesson_blocks FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
    WHERE
      l.id = lesson_blocks.lesson_id
      AND c.teacher_id = (SELECT auth.uid())
  )
);

GRANT SELECT ON public.lesson_blocks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lesson_blocks TO authenticated;

-- ---------------------------------------------------------------------------
-- Миграция существующих уроков в один блок на урок (идемпотентно)
-- ---------------------------------------------------------------------------

INSERT INTO public.lesson_blocks (lesson_id, type, content, order_index)
SELECT
  l.id,
  'text'::public.lesson_block_type,
  jsonb_build_object('html', COALESCE(l.content ->> 'body', '')),
  0
FROM public.lessons l
WHERE
  l.type = 'text'::public.lesson_type
  AND NOT EXISTS (
    SELECT 1
    FROM public.lesson_blocks b
    WHERE b.lesson_id = l.id
  );

INSERT INTO public.lesson_blocks (lesson_id, type, content, order_index)
SELECT
  l.id,
  CASE
    WHEN
      COALESCE(l.content ->> 'videoUrl', '') ILIKE '%vimeo.com%'
      OR COALESCE(l.content ->> 'videoUrl', '') ILIKE '%player.vimeo.com%'
      THEN 'vimeo'::public.lesson_block_type
    WHEN
      COALESCE(l.content ->> 'videoUrl', '') ILIKE '%youtube.com%'
      OR COALESCE(l.content ->> 'videoUrl', '') ILIKE '%youtu.be%'
      THEN 'youtube'::public.lesson_block_type
    ELSE 'youtube'::public.lesson_block_type
  END,
  jsonb_build_object('url', NULLIF(trim(COALESCE(l.content ->> 'videoUrl', '')), '')),
  0
FROM public.lessons l
WHERE
  l.type = 'video'::public.lesson_type
  AND NOT EXISTS (
    SELECT 1
    FROM public.lesson_blocks b
    WHERE b.lesson_id = l.id
  );

INSERT INTO public.lesson_blocks (lesson_id, type, content, order_index)
SELECT
  l.id,
  'quiz'::public.lesson_block_type,
  jsonb_build_object('test_id', l.test_id::text),
  0
FROM public.lessons l
WHERE
  l.type IN ('quiz'::public.lesson_type, 'test'::public.lesson_type)
  AND l.test_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.lesson_blocks b
    WHERE b.lesson_id = l.id
  );

-- Остальные уроки без блоков — один пустой текстовый блок
INSERT INTO public.lesson_blocks (lesson_id, type, content, order_index)
SELECT
  l.id,
  'text'::public.lesson_block_type,
  jsonb_build_object('html', ''),
  0
FROM public.lessons l
WHERE
  NOT EXISTS (
    SELECT 1
    FROM public.lesson_blocks b
    WHERE b.lesson_id = l.id
  );
