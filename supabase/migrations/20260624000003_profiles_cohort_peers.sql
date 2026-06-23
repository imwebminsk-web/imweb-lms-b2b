-- Phase 366: ученики видят профили одногруппников (чат когорты).
-- Связь: public.enrollments (user_id, cohort_id), отдельной cohort_students нет.

CREATE OR REPLACE FUNCTION public.is_cohort_peer(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments AS e_self
    INNER JOIN public.enrollments AS e_peer
      ON e_peer.cohort_id = e_self.cohort_id
    WHERE
      e_self.user_id = (SELECT auth.uid())
      AND e_peer.user_id = p_profile_id
      AND e_self.cohort_id IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_cohort_peer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_cohort_peer(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_cohort_peer(uuid) IS
  'true, если текущий пользователь и p_profile_id в одной cohort (enrollments.cohort_id).';

DROP POLICY IF EXISTS profiles_select_cohort_peers ON public.profiles;

CREATE POLICY profiles_select_cohort_peers
ON public.profiles
FOR SELECT
TO authenticated
USING ((SELECT public.is_cohort_peer(profiles.id)));

COMMENT ON POLICY profiles_select_cohort_peers ON public.profiles IS
  'Участники одной группы видят профили друг друга (имя, аватар в чате).';

CREATE INDEX IF NOT EXISTS enrollments_cohort_id_user_id_idx
ON public.enrollments (cohort_id, user_id)
WHERE cohort_id IS NOT NULL;

COMMENT ON INDEX public.enrollments_cohort_id_user_id_idx IS
  'Ускоряет is_cohort_peer и проверки участников группы.';
