-- =============================================================================
-- B2B matrix: organizations, teams, job titles, course assignments, auto-enroll
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_name_nonempty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT organizations_slug_nonempty CHECK (char_length(trim(slug)) > 0)
);

COMMENT ON TABLE public.organizations IS 'B2B tenant / company.';

CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id),
  CONSTRAINT organization_members_role_check CHECK (
    role IN ('owner', 'hr_manager', 'employee')
  )
);

COMMENT ON TABLE public.organization_members IS 'Membership of users in an organization with B2B role.';

CREATE INDEX IF NOT EXISTS organization_members_user_id_idx
  ON public.organization_members (user_id);

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teams_name_nonempty CHECK (char_length(trim(name)) > 0)
);

COMMENT ON TABLE public.teams IS 'Organizational team / department within a tenant.';

CREATE INDEX IF NOT EXISTS teams_organization_id_idx
  ON public.teams (organization_id);

CREATE INDEX IF NOT EXISTS teams_parent_id_idx
  ON public.teams (parent_id);

CREATE TABLE IF NOT EXISTS public.job_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_titles_name_nonempty CHECK (char_length(trim(name)) > 0)
);

COMMENT ON TABLE public.job_titles IS 'Job title / role catalog within an organization.';

CREATE INDEX IF NOT EXISTS job_titles_organization_id_idx
  ON public.job_titles (organization_id);

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_title_id uuid REFERENCES public.job_titles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

COMMENT ON TABLE public.team_members IS 'User membership in a team with optional job title.';

CREATE INDEX IF NOT EXISTS team_members_user_id_idx
  ON public.team_members (user_id);

CREATE INDEX IF NOT EXISTS team_members_job_title_id_idx
  ON public.team_members (job_title_id);

CREATE TABLE IF NOT EXISTS public.team_courses (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, course_id)
);

COMMENT ON TABLE public.team_courses IS 'Courses assigned to a team (matrix row: team → course).';

CREATE INDEX IF NOT EXISTS team_courses_course_id_idx
  ON public.team_courses (course_id);

CREATE TABLE IF NOT EXISTS public.job_title_courses (
  job_title_id uuid NOT NULL REFERENCES public.job_titles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_title_id, course_id)
);

COMMENT ON TABLE public.job_title_courses IS 'Courses assigned to a job title (matrix row: title → course).';

CREATE INDEX IF NOT EXISTS job_title_courses_course_id_idx
  ON public.job_title_courses (course_id);

-- ---------------------------------------------------------------------------
-- Auto-enrollment: team membership × team courses, job title × title courses
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.b2b_auto_enroll_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_team_id uuid;
  v_job_title_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'team_members' THEN
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);

    INSERT INTO public.enrollments (user_id, course_id)
    SELECT DISTINCT tm.user_id, tc.course_id
    FROM public.team_members tm
    INNER JOIN public.team_courses tc ON tc.team_id = tm.team_id
    WHERE tm.user_id = v_user_id
    ON CONFLICT (user_id, course_id) DO NOTHING;

    INSERT INTO public.enrollments (user_id, course_id)
    SELECT DISTINCT tm.user_id, jtc.course_id
    FROM public.team_members tm
    INNER JOIN public.job_title_courses jtc ON jtc.job_title_id = tm.job_title_id
    WHERE tm.user_id = v_user_id
      AND tm.job_title_id IS NOT NULL
    ON CONFLICT (user_id, course_id) DO NOTHING;

  ELSIF TG_TABLE_NAME = 'team_courses' THEN
    v_team_id := COALESCE(NEW.team_id, OLD.team_id);

    INSERT INTO public.enrollments (user_id, course_id)
    SELECT DISTINCT tm.user_id, tc.course_id
    FROM public.team_members tm
    INNER JOIN public.team_courses tc ON tc.team_id = tm.team_id
    WHERE tm.team_id = v_team_id
    ON CONFLICT (user_id, course_id) DO NOTHING;

  ELSIF TG_TABLE_NAME = 'job_title_courses' THEN
    v_job_title_id := COALESCE(NEW.job_title_id, OLD.job_title_id);

    INSERT INTO public.enrollments (user_id, course_id)
    SELECT DISTINCT tm.user_id, jtc.course_id
    FROM public.team_members tm
    INNER JOIN public.job_title_courses jtc ON jtc.job_title_id = tm.job_title_id
    WHERE tm.job_title_id = v_job_title_id
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.b2b_auto_enroll_trigger_fn() IS
  'Syncs enrollments when B2B matrix rows change (team members, team courses, job title courses).';

CREATE TRIGGER b2b_auto_enroll_team_members
  AFTER INSERT OR UPDATE OR DELETE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.b2b_auto_enroll_trigger_fn();

CREATE TRIGGER b2b_auto_enroll_team_courses
  AFTER INSERT OR UPDATE OR DELETE ON public.team_courses
  FOR EACH ROW EXECUTE FUNCTION public.b2b_auto_enroll_trigger_fn();

CREATE TRIGGER b2b_auto_enroll_job_title_courses
  AFTER INSERT OR UPDATE OR DELETE ON public.job_title_courses
  FOR EACH ROW EXECUTE FUNCTION public.b2b_auto_enroll_trigger_fn();

-- ---------------------------------------------------------------------------
-- RLS helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_belongs_to_organization(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.user_belongs_to_organization(uuid) IS
  'True when the current user is a member of the given organization.';

-- ---------------------------------------------------------------------------
-- RLS policies (SELECT for org members)
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_title_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_select_member
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_organization(id));

CREATE POLICY organization_members_select_same_org
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_organization(organization_id));

CREATE POLICY teams_select_same_org
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_organization(organization_id));

CREATE POLICY job_titles_select_same_org
  ON public.job_titles
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_organization(organization_id));

CREATE POLICY team_members_select_same_org
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_members.team_id
        AND public.user_belongs_to_organization(t.organization_id)
    )
  );

CREATE POLICY team_courses_select_same_org
  ON public.team_courses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_courses.team_id
        AND public.user_belongs_to_organization(t.organization_id)
    )
  );

CREATE POLICY job_title_courses_select_same_org
  ON public.job_title_courses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_titles jt
      WHERE jt.id = job_title_courses.job_title_id
        AND public.user_belongs_to_organization(jt.organization_id)
    )
  );
