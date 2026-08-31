-- Single-tenant B2B RLS: any authenticated user can read org structure;
-- only admin / head_teacher (private.is_platform_admin) can manage it.

-- ---------------------------------------------------------------------------
-- DROP legacy policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "organizations_select_member" ON public.organizations;

DROP POLICY IF EXISTS "teams_select_same_org" ON public.teams;
DROP POLICY IF EXISTS "teams_admin_all" ON public.teams;

DROP POLICY IF EXISTS "job_titles_select_same_org" ON public.job_titles;
DROP POLICY IF EXISTS "job_titles_admin_all" ON public.job_titles;

DROP POLICY IF EXISTS "team_members_select_same_org" ON public.team_members;
DROP POLICY IF EXISTS "team_members_admin_all" ON public.team_members;

DROP POLICY IF EXISTS "organization_members_select_same_org" ON public.organization_members;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

CREATE POLICY "organizations_read_all" ON public.organizations
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "organizations_manage_all" ON public.organizations
    FOR ALL
    TO authenticated
    USING (private.is_platform_admin())
    WITH CHECK (private.is_platform_admin());

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------

CREATE POLICY "teams_read_all" ON public.teams
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "teams_manage_all" ON public.teams
    FOR ALL
    TO authenticated
    USING (private.is_platform_admin())
    WITH CHECK (private.is_platform_admin());

-- ---------------------------------------------------------------------------
-- job_titles
-- ---------------------------------------------------------------------------

CREATE POLICY "job_titles_read_all" ON public.job_titles
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "job_titles_manage_all" ON public.job_titles
    FOR ALL
    TO authenticated
    USING (private.is_platform_admin())
    WITH CHECK (private.is_platform_admin());

-- ---------------------------------------------------------------------------
-- team_members
-- ---------------------------------------------------------------------------

CREATE POLICY "team_members_read_all" ON public.team_members
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "team_members_manage_all" ON public.team_members
    FOR ALL
    TO authenticated
    USING (private.is_platform_admin())
    WITH CHECK (private.is_platform_admin());

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------

CREATE POLICY "organization_members_read_all" ON public.organization_members
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "organization_members_manage_all" ON public.organization_members
    FOR ALL
    TO authenticated
    USING (private.is_platform_admin())
    WITH CHECK (private.is_platform_admin());
