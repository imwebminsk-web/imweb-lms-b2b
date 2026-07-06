-- =============================================================================
-- Каскадное удаление теста на уровне БД + владелец tests.user_id (Zero Trust в приложении).
-- Выполните в Supabase SQL Editor или: supabase db push
-- Перед продакшеном — бэкап.
-- =============================================================================

-- Владелец теста (дополняет RLS; deleteTest фильтрует .eq('user_id', auth.uid()))
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tests.user_id IS
  'Создатель теста; удаление только при совпадении с текущим пользователем в Server Action.';

CREATE INDEX IF NOT EXISTS tests_user_id_idx ON public.tests (user_id);

-- ---------------------------------------------------------------------------
-- Внешние ключи: ON DELETE CASCADE (имена constraint из типичной схемы Supabase)
-- ---------------------------------------------------------------------------

ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_test_id_fkey,
  ADD CONSTRAINT questions_test_id_fkey
    FOREIGN KEY (test_id) REFERENCES public.tests (id) ON DELETE CASCADE;

ALTER TABLE public.options
  DROP CONSTRAINT IF EXISTS options_question_id_fkey,
  ADD CONSTRAINT options_question_id_fkey
    FOREIGN KEY (question_id) REFERENCES public.questions (id) ON DELETE CASCADE;

ALTER TABLE public.student_attempts
  DROP CONSTRAINT IF EXISTS student_attempts_test_id_fkey,
  ADD CONSTRAINT student_attempts_test_id_fkey
    FOREIGN KEY (test_id) REFERENCES public.tests (id) ON DELETE CASCADE;

ALTER TABLE public.attempt_answers
  DROP CONSTRAINT IF EXISTS attempt_answers_attempt_id_fkey,
  ADD CONSTRAINT attempt_answers_attempt_id_fkey
    FOREIGN KEY (attempt_id) REFERENCES public.student_attempts (id) ON DELETE CASCADE;

ALTER TABLE public.attempt_answers
  DROP CONSTRAINT IF EXISTS attempt_answers_question_id_fkey,
  ADD CONSTRAINT attempt_answers_question_id_fkey
    FOREIGN KEY (question_id) REFERENCES public.questions (id) ON DELETE CASCADE;

-- Иначе при удалении вопроса → option строки удалятся, а attempt_answers.option_id заблокирует каскад
ALTER TABLE public.attempt_answers
  DROP CONSTRAINT IF EXISTS attempt_answers_option_id_fkey,
  ADD CONSTRAINT attempt_answers_option_id_fkey
    FOREIGN KEY (option_id) REFERENCES public.options (id) ON DELETE CASCADE;

-- Опционально: проставить владельца для уже существующих тестов (раскомментируйте и замените uuid)
-- UPDATE public.tests SET user_id = '<ваш-admin-uuid>'::uuid WHERE user_id IS NULL;
