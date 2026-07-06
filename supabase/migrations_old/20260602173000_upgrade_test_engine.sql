-- Phase 251: расширение движка тестов — 100-балльная шкала, веса вопросов, режимы обучения.

-- ---------------------------------------------------------------------------
-- tests: метаданные для преподавателя/ученика, тип теста, журнал, макс. балл
-- ---------------------------------------------------------------------------

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS title_teacher text,
  ADD COLUMN IF NOT EXISTS title_student text,
  ADD COLUMN IF NOT EXISTS test_type varchar(50) NOT NULL DEFAULT 'final',
  ADD COLUMN IF NOT EXISTS auto_check boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS save_to_journal boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_score integer NOT NULL DEFAULT 100;

COMMENT ON COLUMN public.tests.title_teacher IS
  'Внутреннее название для преподавателя (опционально).';

COMMENT ON COLUMN public.tests.title_student IS
  'Название, отображаемое ученику (опционально; fallback — title).';

COMMENT ON COLUMN public.tests.test_type IS
  'Режим теста: training (тренировка) или final (контрольный).';

COMMENT ON COLUMN public.tests.auto_check IS
  'true — автопроверка; false — требуется ручная проверка преподавателем.';

COMMENT ON COLUMN public.tests.save_to_journal IS
  'false — попытка не влияет на итоговый журнал успеваемости.';

COMMENT ON COLUMN public.tests.max_score IS
  'Максимально возможный балл/процент теста (по умолчанию 100).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tests_test_type_chk'
      AND conrelid = 'public.tests'::regclass
  ) THEN
    ALTER TABLE public.tests
      ADD CONSTRAINT tests_test_type_chk
      CHECK (test_type IN ('training', 'final'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tests_max_score_positive_chk'
      AND conrelid = 'public.tests'::regclass
  ) THEN
    ALTER TABLE public.tests
      ADD CONSTRAINT tests_max_score_positive_chk
      CHECK (max_score > 0);
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- questions: вес отдельного вопроса
-- ---------------------------------------------------------------------------

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.questions.points IS
  'Вес вопроса при подсчёте итогового балла (по умолчанию 1).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_points_positive_chk'
      AND conrelid = 'public.questions'::regclass
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_points_positive_chk
      CHECK (points > 0);
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- student_attempts: тренировочная попытка и комментарий преподавателя
-- ---------------------------------------------------------------------------

ALTER TABLE public.student_attempts
  ADD COLUMN IF NOT EXISTS is_training_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS teacher_comment text;

COMMENT ON COLUMN public.student_attempts.is_training_mode IS
  'true — тренировочная пересдача; false — официальная попытка.';

COMMENT ON COLUMN public.student_attempts.teacher_comment IS
  'Комментарий преподавателя при ручной проверке (auto_check = false).';
