-- Phase 288 — преподаватель может удалять свои попытки (песочница / сброс preview)
-- attempt_answers удаляются каскадом (ON DELETE CASCADE).

DROP POLICY IF EXISTS "student_attempts_delete_own"
ON public.student_attempts;

CREATE POLICY "student_attempts_delete_own"
ON public.student_attempts
FOR DELETE
TO authenticated
USING (student_id = (SELECT auth.uid()));
