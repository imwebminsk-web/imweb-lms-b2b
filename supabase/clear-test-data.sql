-- =============================================================================
-- Phase 279.3 — Comprehensive test data cleanup (dev/staging ONLY)
-- =============================================================================
--
-- SCHEMA AUDIT (public tables, FK direction → tests):
--
--   tests                    ← root table (test definitions)
--     ├─ questions           test_id → tests  ON DELETE CASCADE
--     │    └─ options         question_id → questions  ON DELETE CASCADE
--     ├─ student_attempts    test_id → tests  ON DELETE CASCADE
--     │    └─ attempt_answers attempt_id → student_attempts  ON DELETE CASCADE
--     │                       question_id → questions      ON DELETE CASCADE
--     │                       option_id → options          ON DELETE CASCADE
--     ├─ cohort_assignments  test_id → tests  ON DELETE CASCADE
--     └─ lessons             test_id → tests  ON DELETE SET NULL  (column FK)
--
-- SOFT REFERENCES (no FK — must be cleared manually or orphans remain):
--   lesson_blocks.content->>'test_id'  (type = 'quiz', JSONB)
--
-- NOT TOUCHED (unrelated to test engine rows):
--   courses, modules, lessons (rows kept), lesson_blocks (rows kept, unlinked),
--   assignment_submissions, lesson_completions, enrollments, profiles, …
--   storage.objects in bucket "test-attachments" (optional; see note below)
--
-- CASCADE NOTE:
--   Deleting from `tests` would auto-delete questions, options, student_attempts,
--   cohort_assignments (test rows), and SET NULL on lessons.test_id.
--   This script still deletes attempts/answers explicitly and unlinks JSON/column
--   refs FIRST so no dangling UUIDs remain in lesson UI after the wipe.
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste & Run
--   supabase db execute --file supabase/clear-test-data.sql
--   psql "$DATABASE_URL" -f supabase/clear-test-data.sql
--
-- WARNING: Permanently deletes ALL tests and ALL student quiz attempts.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Step 1: Unlink soft JSON references in lesson_blocks (quiz blocks)
-- ---------------------------------------------------------------------------
UPDATE public.lesson_blocks
SET
  content = content - 'test_id',
  updated_at = now()
WHERE
  type = 'quiz'
  AND content ? 'test_id';

-- ---------------------------------------------------------------------------
-- Step 2: Unlink column FK on lessons (explicit; mirrors ON DELETE SET NULL)
-- ---------------------------------------------------------------------------
UPDATE public.lessons
SET test_id = NULL
WHERE test_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 3: Remove cohort-level test assignments (explicit before tests delete)
-- ---------------------------------------------------------------------------
DELETE FROM public.cohort_assignments
WHERE test_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 4: Delete all student answers, then attempts (child → parent)
-- ---------------------------------------------------------------------------
DELETE FROM public.attempt_answers;

DELETE FROM public.student_attempts;

-- ---------------------------------------------------------------------------
-- Step 5: Delete question bank (options first if CASCADE path is uncertain)
--         questions.test_id CASCADE would remove options; explicit is safer.
-- ---------------------------------------------------------------------------
DELETE FROM public.options
WHERE question_id IN (SELECT id FROM public.questions);

DELETE FROM public.questions;

-- ---------------------------------------------------------------------------
-- Step 6: Delete all test definitions
-- ---------------------------------------------------------------------------
DELETE FROM public.tests;

COMMIT;

-- ---------------------------------------------------------------------------
-- Post-run verification (run separately; all counts should be 0)
-- ---------------------------------------------------------------------------
-- SELECT 'tests' AS tbl, COUNT(*) AS cnt FROM public.tests
-- UNION ALL SELECT 'questions', COUNT(*) FROM public.questions
-- UNION ALL SELECT 'options', COUNT(*) FROM public.options
-- UNION ALL SELECT 'student_attempts', COUNT(*) FROM public.student_attempts
-- UNION ALL SELECT 'attempt_answers', COUNT(*) FROM public.attempt_answers
-- UNION ALL SELECT 'cohort_assignments (test)', COUNT(*) FROM public.cohort_assignments WHERE test_id IS NOT NULL
-- UNION ALL SELECT 'lessons (test_id set)', COUNT(*) FROM public.lessons WHERE test_id IS NOT NULL
-- UNION ALL SELECT 'lesson_blocks (quiz test_id)', COUNT(*) FROM public.lesson_blocks WHERE type = 'quiz' AND content ? 'test_id';

-- ---------------------------------------------------------------------------
-- OPTIONAL: purge uploaded test media from Storage (not in public.* tables)
-- Uncomment only if you also want to empty the test-attachments bucket.
-- ---------------------------------------------------------------------------
-- DELETE FROM storage.objects WHERE bucket_id = 'test-attachments';
