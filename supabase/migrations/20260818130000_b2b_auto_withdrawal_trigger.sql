-- =============================================================================
-- B2B matrix: auto-withdraw enrollments when matrix access is removed
-- =============================================================================

CREATE OR REPLACE FUNCTION public.b2b_user_has_matrix_access(
  p_user_id uuid,
  p_course_id uuid,
  p_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    INNER JOIN public.teams t ON t.id = tm.team_id
    INNER JOIN public.team_courses tc
      ON tc.team_id = tm.team_id AND tc.course_id = p_course_id
    WHERE tm.user_id = p_user_id
      AND t.organization_id = p_organization_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.team_members tm
    INNER JOIN public.teams t ON t.id = tm.team_id
    INNER JOIN public.job_title_courses jtc
      ON jtc.job_title_id = tm.job_title_id AND jtc.course_id = p_course_id
    WHERE tm.user_id = p_user_id
      AND tm.job_title_id IS NOT NULL
      AND t.organization_id = p_organization_id
  );
$$;

COMMENT ON FUNCTION public.b2b_user_has_matrix_access(uuid, uuid, uuid) IS
  'True when user still has B2B matrix access to course within the organization.';

CREATE OR REPLACE FUNCTION public.b2b_try_withdraw_enrollment(
  p_user_id uuid,
  p_course_id uuid,
  p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.b2b_user_has_matrix_access(p_user_id, p_course_id, p_organization_id) THEN
    RETURN;
  END IF;

  DELETE FROM public.enrollments
  WHERE user_id = p_user_id
    AND course_id = p_course_id
    AND cohort_id IS NULL;
END;
$$;

COMMENT ON FUNCTION public.b2b_try_withdraw_enrollment(uuid, uuid, uuid) IS
  'Removes B2B-sourced enrollment when matrix no longer grants access.';

CREATE OR REPLACE FUNCTION public.b2b_auto_withdraw_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_team_id uuid;
  v_job_title_id uuid;
  v_course_id uuid;
  v_organization_id uuid;
  r RECORD;
BEGIN
  IF TG_TABLE_NAME = 'team_members' THEN
    v_user_id := OLD.user_id;
    v_team_id := OLD.team_id;
    v_job_title_id := OLD.job_title_id;

    SELECT t.organization_id INTO v_organization_id
    FROM public.teams t
    WHERE t.id = v_team_id;

    IF v_organization_id IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    FOR r IN
      SELECT tc.course_id
      FROM public.team_courses tc
      WHERE tc.team_id = v_team_id
    LOOP
      PERFORM public.b2b_try_withdraw_enrollment(v_user_id, r.course_id, v_organization_id);
    END LOOP;

    IF v_job_title_id IS NOT NULL THEN
      FOR r IN
        SELECT jtc.course_id
        FROM public.job_title_courses jtc
        WHERE jtc.job_title_id = v_job_title_id
      LOOP
        PERFORM public.b2b_try_withdraw_enrollment(v_user_id, r.course_id, v_organization_id);
      END LOOP;
    END IF;

  ELSIF TG_TABLE_NAME = 'team_courses' THEN
    v_team_id := OLD.team_id;
    v_course_id := OLD.course_id;

    SELECT t.organization_id INTO v_organization_id
    FROM public.teams t
    WHERE t.id = v_team_id;

    IF v_organization_id IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    FOR r IN
      SELECT tm.user_id
      FROM public.team_members tm
      WHERE tm.team_id = v_team_id
    LOOP
      PERFORM public.b2b_try_withdraw_enrollment(r.user_id, v_course_id, v_organization_id);
    END LOOP;

  ELSIF TG_TABLE_NAME = 'job_title_courses' THEN
    v_job_title_id := OLD.job_title_id;
    v_course_id := OLD.course_id;

    SELECT jt.organization_id INTO v_organization_id
    FROM public.job_titles jt
    WHERE jt.id = v_job_title_id;

    IF v_organization_id IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    FOR r IN
      SELECT DISTINCT tm.user_id
      FROM public.team_members tm
      INNER JOIN public.teams t ON t.id = tm.team_id
      WHERE tm.job_title_id = v_job_title_id
        AND t.organization_id = v_organization_id
    LOOP
      PERFORM public.b2b_try_withdraw_enrollment(r.user_id, v_course_id, v_organization_id);
    END LOOP;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.b2b_auto_withdraw_trigger_fn() IS
  'Revokes B2B enrollments when matrix rows are deleted or updated.';

CREATE TRIGGER b2b_auto_withdraw_team_members
  AFTER DELETE OR UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.b2b_auto_withdraw_trigger_fn();

CREATE TRIGGER b2b_auto_withdraw_team_courses
  AFTER DELETE OR UPDATE ON public.team_courses
  FOR EACH ROW EXECUTE FUNCTION public.b2b_auto_withdraw_trigger_fn();

CREATE TRIGGER b2b_auto_withdraw_job_title_courses
  AFTER DELETE OR UPDATE ON public.job_title_courses
  FOR EACH ROW EXECUTE FUNCTION public.b2b_auto_withdraw_trigger_fn();
