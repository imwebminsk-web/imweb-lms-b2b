-- Admin is missing ALL policies on courses / enrollments / profiles
-- (head_teacher already has courses_head_teacher_all).
-- Role is read from public.profiles, same as cohorts_admin_all.

CREATE SCHEMA IF NOT EXISTS private;

-- Needed for profiles_admin_all: a policy ON profiles that SELECTs profiles
-- would recurse. SECURITY DEFINER bypasses RLS for that lookup.
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'admin'::public.profile_role
  );
$$;

COMMENT ON FUNCTION private.is_admin() IS
  'true, если текущий пользователь — admin (без рекурсии RLS на profiles).';

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin() TO service_role;

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "courses_admin_all" ON public.courses;

CREATE POLICY "courses_admin_all" ON public.courses
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

COMMENT ON POLICY "courses_admin_all" ON public.courses IS
  'Admin: полный доступ к курсам, как у head_teacher (courses_head_teacher_all).';

-- ---------------------------------------------------------------------------
-- enrollments
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "enrollments_admin_all" ON public.enrollments;

CREATE POLICY "enrollments_admin_all" ON public.enrollments
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

COMMENT ON POLICY "enrollments_admin_all" ON public.enrollments IS
  'Admin: полный доступ к записям на курсы (ученики группы, журнал).';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;

CREATE POLICY "profiles_admin_all" ON public.profiles
    FOR ALL
    TO authenticated
    USING ((SELECT private.is_admin()))
    WITH CHECK ((SELECT private.is_admin()));

COMMENT ON POLICY "profiles_admin_all" ON public.profiles IS
  'Admin: читать и менять любые профили (имена и аватары учеников в журнале).';
