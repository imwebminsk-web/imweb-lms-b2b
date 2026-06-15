-- Phase 279.2 — Clear development test data (safe for local/staging only)
--
-- Removes student quiz attempts and test definitions (questions/options cascade).
-- Does NOT drop tables. lessons.test_id is set to NULL on test delete (ON DELETE SET NULL).
-- cohort_assignments rows linked to tests are removed via ON DELETE CASCADE.
--
-- HOW TO RUN (pick one):
--
-- 1) Supabase Dashboard → SQL Editor → paste and execute this file.
--
-- 2) Supabase CLI (linked project):
--    supabase db execute --file supabase/clear-test-data.sql
--
-- 3) psql with your DATABASE_URL:
--    psql "$DATABASE_URL" -f supabase/clear-test-data.sql
--
-- WARNING: This permanently deletes ALL rows in these tables. Use only on dev/test data.

BEGIN;

-- Child rows first (explicit order; CASCADE on tests would also remove these)
DELETE FROM public.attempt_answers;
DELETE FROM public.student_attempts;

-- Tests → cascades to questions and options; nullifies lessons.test_id
DELETE FROM public.tests;

COMMIT;

-- Optional: verify counts after run
-- SELECT
--   (SELECT COUNT(*) FROM public.student_attempts) AS attempts,
--   (SELECT COUNT(*) FROM public.attempt_answers) AS answers,
--   (SELECT COUNT(*) FROM public.tests) AS tests,
--   (SELECT COUNT(*) FROM public.questions) AS questions,
--   (SELECT COUNT(*) FROM public.options) AS options;
