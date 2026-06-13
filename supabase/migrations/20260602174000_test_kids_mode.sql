-- Phase 253: детский режим (оценки смайликами) для тестов
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS is_for_kids boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tests.is_for_kids IS
  'Детский режим: оценки отображаются смайликами вместо числовых баллов.';
