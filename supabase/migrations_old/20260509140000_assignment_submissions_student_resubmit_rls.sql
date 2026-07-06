-- Phase 149: ученик может повторно отправить ответ после status = rejected.

CREATE POLICY assignment_submissions_update_own_when_rejected
ON public.assignment_submissions
FOR UPDATE
TO authenticated
USING (
  student_id = (SELECT auth.uid())
  AND status = 'rejected'::public.submission_status
)
WITH CHECK (
  student_id = (SELECT auth.uid())
  AND status = 'pending'::public.submission_status
  AND grade IS NULL
  AND teacher_comment IS NULL
);

-- Запрет смены ученика или блока урока при любом UPDATE.
CREATE OR REPLACE FUNCTION public.assignment_submissions_enforce_immutable_ids ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.lesson_block_id IS DISTINCT FROM OLD.lesson_block_id THEN
    RAISE EXCEPTION 'Нельзя менять ученика или блок урока';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assignment_submissions_immutable_ids
BEFORE UPDATE ON public.assignment_submissions
FOR EACH ROW
EXECUTE PROCEDURE public.assignment_submissions_enforce_immutable_ids ();
