-- Phase 297 — Индексы для виджета «ожидают проверки» (pending reviews).
-- Ускоряет фильтрацию assignment_submissions и student_attempts по статусу.

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_status_block
  ON public.assignment_submissions (status, lesson_block_id);

CREATE INDEX IF NOT EXISTS idx_student_attempts_status_test
  ON public.student_attempts (status, test_id);

COMMENT ON INDEX public.idx_assignment_submissions_status_block IS
  'Pending assignment reviews: status + lesson_block_id IN (...).';

COMMENT ON INDEX public.idx_student_attempts_status_test IS
  'Pending test reviews: status + test_id lookups for teacher dashboard.';
