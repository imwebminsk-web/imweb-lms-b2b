-- Phase 365: ограничить SELECT на profiles — убрать массовую утечку email.
-- Паттерн: SECURITY DEFINER helper, чтобы проверка роли staff не рекурсировала через RLS.

CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.role IN (
        'teacher'::public.profile_role,
        'admin'::public.profile_role
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_user() TO anon;

COMMENT ON FUNCTION public.is_staff_user() IS
  'true, если текущий JWT-пользователь — teacher или admin (обход RLS без рекурсии).';

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_staff_directory ON public.profiles;
DROP POLICY IF EXISTS profiles_select_staff_read_all ON public.profiles;

-- Собственный профиль (включая email для настроек).
CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (id = (SELECT auth.uid()));

-- Публичный каталог преподавателей / админов (имя, аватар на лендинге).
CREATE POLICY profiles_select_staff_directory
ON public.profiles
FOR SELECT
USING (
  role IN (
    'teacher'::public.profile_role,
    'admin'::public.profile_role
  )
);

-- Staff видит всех пользователей (журнал, когорты, поддержка).
CREATE POLICY profiles_select_staff_read_all
ON public.profiles
FOR SELECT
TO authenticated
USING ((SELECT public.is_staff_user()));

COMMENT ON POLICY profiles_select_staff_directory ON public.profiles IS
  'Карточки курсов: любой может читать профили teacher/admin.';

COMMENT ON POLICY profiles_select_staff_read_all ON public.profiles IS
  'Teacher/admin читают все profiles (в т.ч. email учеников).';
