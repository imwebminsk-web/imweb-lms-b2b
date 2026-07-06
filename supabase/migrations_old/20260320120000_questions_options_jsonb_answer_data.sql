-- =============================================================================
-- MVP: гибкие типы вопросов + JSONB для контента + сложные ответы ученика
-- Выполнить целиком в Supabase SQL Editor (или через supabase db push).
-- Перед продакшеном сделайте бэкап / тест на копии проекта.
-- =============================================================================

-- 1) Тип вопроса: ENUM → VARCHAR(50) (новые значения задаются на уровне приложения)
ALTER TABLE public.questions
  ALTER COLUMN type TYPE VARCHAR(50)
  USING type::text;

-- 2) Старый ENUM больше не используется колонкой — удаляем
DROP TYPE IF EXISTS public.question_type;

-- 3) Текст вопроса: TEXT → JSONB (старые строки оборачиваем в {"text": "..."})
ALTER TABLE public.questions
  ALTER COLUMN content TYPE JSONB
  USING (
    CASE
      WHEN content IS NULL THEN NULL
      ELSE jsonb_build_object('text', content)
    END
  );

-- 4) Текст/данные варианта: TEXT → JSONB
ALTER TABLE public.options
  ALTER COLUMN content TYPE JSONB
  USING (
    CASE
      WHEN content IS NULL THEN NULL
      ELSE jsonb_build_object('text', content)
    END
  );

-- 5) Сложный ответ ученика (порядок, координаты, массивы id и т.д.)
ALTER TABLE public.attempt_answers
  ADD COLUMN IF NOT EXISTS answer_data JSONB;

-- Подсказки для команды (не влияют на выполнение)
COMMENT ON COLUMN public.questions.type IS
  'Ожидаемые значения приложения: true_false, single_choice, multiple_choice, ordering, matching_puzzle, image_hotspot, text_input, fill_blanks_text, fill_blanks_dnd, image_select_objects, image_dnd_labels';

COMMENT ON COLUMN public.questions.content IS
  'JSONB: легенда вопроса (текст, координаты, слоты пазла и т.д.). Legacy-строки мигрированы как {"text": "<было>"}.';

COMMENT ON COLUMN public.options.content IS
  'JSONB: данные варианта ответа. Legacy-строки мигрированы как {"text": "<было>"}.';

COMMENT ON COLUMN public.attempt_answers.answer_data IS
  'JSONB: ответ ученика при интерактивных типах (порядок id, точки клика, заполнение пропусков и т.д.).';

-- -----------------------------------------------------------------------------
-- Опционально: переименовать старые значения ENUM после приведения к VARCHAR
-- (раньше были literal ''single'' / ''multiple'').
-- Раскомментируйте при необходимости:
-- UPDATE public.questions SET type = 'single_choice' WHERE type = 'single';
-- UPDATE public.questions SET type = 'multiple_choice' WHERE type = 'multiple';
-- -----------------------------------------------------------------------------
