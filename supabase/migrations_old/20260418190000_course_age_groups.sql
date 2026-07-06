-- Phase 21: возрастная группа + nullable CEFR (level) при смене аудитории.
-- После применения: supabase db push (или выполнить SQL вручную).

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS age_group text;

COMMENT ON COLUMN public.courses.age_group IS
  'Возрастная группа для маркетинговой аудитории «Дети»: 5-6 лет | 6-8 лет | 9-13 лет | 13-17 лет.';

-- CEFR (колонка level) может быть NULL, если курс не для взрослых.
ALTER TABLE public.courses
  ALTER COLUMN level DROP NOT NULL;

-- Сложность больше не используется в продукте — очищаем сохранённые значения.
UPDATE public.courses
SET difficulty_level = NULL
WHERE difficulty_level IS NOT NULL;

-- Легаси-коды аудитории → русские подписи (как в UI Phase 21).
UPDATE public.courses
SET marketing_audience = CASE trim(marketing_audience)
  WHEN 'kids' THEN 'Дети'
  WHEN 'adults' THEN 'Взрослые'
  WHEN 'all' THEN 'Все'
  WHEN 'teens' THEN NULL
  ELSE marketing_audience
END
WHERE marketing_audience IS NOT NULL
  AND trim(marketing_audience) IN ('kids', 'adults', 'all', 'teens');

COMMENT ON COLUMN public.courses.marketing_audience IS
  'Сегмент лендинга: Дети | Взрослые | Все (текст; отдельно от enum target_audience).';
