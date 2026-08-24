-- Inline quizzes are bound to a lesson block. Students can SELECT
-- questions/options only when tests.is_published is true (questions_select_visible,
-- options_select_visible). Keep existing inline tests readable.

UPDATE public.tests
SET is_published = true
WHERE scope = 'inline'
  AND is_published IS DISTINCT FROM true;
