-- Admin had no SELECT/ALL policy on public.cohorts (unlike head_teacher).
-- User-scoped queries therefore hid other teachers' groups from admins.
-- Mirror cohorts_head_teacher_all for the admin role.

DROP POLICY IF EXISTS "cohorts_admin_all" ON public.cohorts;

CREATE POLICY "cohorts_admin_all" ON public.cohorts
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'::public.profile_role
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'::public.profile_role
        )
    );

COMMENT ON POLICY "cohorts_admin_all" ON public.cohorts IS
  'Admin: полный доступ к группам, как у head_teacher (cohorts_head_teacher_all).';
