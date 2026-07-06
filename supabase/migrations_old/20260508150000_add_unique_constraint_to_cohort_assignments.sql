ALTER TABLE public.cohort_assignments
ADD CONSTRAINT cohort_assignments_cohort_lesson_key UNIQUE (cohort_id, lesson_id);
