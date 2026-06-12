-- Phase 249: начальное наполнение справочника taxonomies из констант course-settings-schema.

INSERT INTO public.taxonomies (type, label, value, sort_order)
VALUES
  ('format', 'Онлайн', 'online', 0),
  ('format', 'Офлайн', 'offline', 1),
  ('format', 'Гибрид', 'hybrid', 2),
  ('language', 'Английский', 'english', 0),
  ('language', 'Испанский', 'spanish', 1),
  ('language', 'Французский', 'french', 2),
  ('language', 'Немецкий', 'german', 3),
  ('language', 'Китайский', 'chinese', 4),
  ('language', 'Русский', 'russian', 5),
  ('audience', 'Дети', 'children', 0),
  ('audience', 'Взрослые', 'adults', 1),
  ('age_group', '5-6 лет', '5-6', 0),
  ('age_group', '6-8 лет', '6-8', 1),
  ('age_group', '9-13 лет', '9-13', 2),
  ('age_group', '13-17 лет', '13-17', 3),
  ('cefr_level', '0', '0', 0),
  ('cefr_level', 'A1', 'a1', 1),
  ('cefr_level', 'A2', 'a2', 2),
  ('cefr_level', 'B1', 'b1', 3),
  ('cefr_level', 'B1+', 'b1-plus', 4),
  ('cefr_level', 'B2', 'b2', 5),
  ('cefr_level', 'B2+', 'b2-plus', 6),
  ('cefr_level', 'C1', 'c1', 7),
  ('cefr_level', 'C2', 'c2', 8)
ON CONFLICT (type, value) DO NOTHING;
