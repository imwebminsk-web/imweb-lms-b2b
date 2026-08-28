-- Support inbox: staff is admin + head_teacher only. Students keep own-ticket access.
-- Teachers must not SELECT/INSERT/UPDATE/DELETE support data.

DROP POLICY IF EXISTS "support_messages_insert_staff" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_select_staff" ON public.support_messages;
DROP POLICY IF EXISTS "support_tickets_delete_teacher" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_select_staff" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_update_staff" ON public.support_tickets;

CREATE POLICY "support_messages_insert_staff"
  ON public.support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (sender_id = (SELECT auth.uid()))
    AND (
      (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()))
      IN ('admin'::public.profile_role, 'head_teacher'::public.profile_role)
    )
  );

CREATE POLICY "support_messages_select_staff"
  ON public.support_messages
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()))
    IN ('admin'::public.profile_role, 'head_teacher'::public.profile_role)
  );

CREATE POLICY "support_tickets_delete_staff"
  ON public.support_tickets
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()))
    IN ('admin'::public.profile_role, 'head_teacher'::public.profile_role)
  );

CREATE POLICY "support_tickets_select_staff"
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()))
    IN ('admin'::public.profile_role, 'head_teacher'::public.profile_role)
  );

CREATE POLICY "support_tickets_update_staff"
  ON public.support_tickets
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()))
    IN ('admin'::public.profile_role, 'head_teacher'::public.profile_role)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()))
    IN ('admin'::public.profile_role, 'head_teacher'::public.profile_role)
  );
