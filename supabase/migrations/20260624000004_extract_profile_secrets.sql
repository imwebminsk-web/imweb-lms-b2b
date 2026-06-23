-- Phase 368: email вынесен из public.profiles в profile_secrets (строгий RLS).

CREATE TABLE public.profile_secrets (
  id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  email text,
  CONSTRAINT profile_secrets_email_max_len_chk CHECK (
    email IS NULL OR char_length(email) <= 320
  )
);

COMMENT ON TABLE public.profile_secrets IS
  'Приватные поля профиля (email). Одногруппники читают profiles без доступа к email.';

COMMENT ON COLUMN public.profile_secrets.email IS
  'Копия auth.users.email; видят владелец и staff (is_staff_user).';

INSERT INTO public.profile_secrets (id, email)
SELECT id, NULLIF(btrim(email), '')
FROM public.profiles
WHERE email IS NOT NULL
  AND btrim(email) <> '';

ALTER TABLE public.profiles
DROP COLUMN IF EXISTS email;

ALTER TABLE public.profile_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_secrets_select_own_or_staff ON public.profile_secrets;
DROP POLICY IF EXISTS profile_secrets_insert_own_or_staff ON public.profile_secrets;
DROP POLICY IF EXISTS profile_secrets_update_own_or_staff ON public.profile_secrets;

CREATE POLICY profile_secrets_select_own_or_staff
ON public.profile_secrets
FOR SELECT
TO authenticated
USING (
  id = (SELECT auth.uid())
  OR (SELECT public.is_staff_user())
);

CREATE POLICY profile_secrets_insert_own_or_staff
ON public.profile_secrets
FOR INSERT
TO authenticated
WITH CHECK (
  id = (SELECT auth.uid())
  OR (SELECT public.is_staff_user())
);

CREATE POLICY profile_secrets_update_own_or_staff
ON public.profile_secrets
FOR UPDATE
TO authenticated
USING (
  id = (SELECT auth.uid())
  OR (SELECT public.is_staff_user())
)
WITH CHECK (
  id = (SELECT auth.uid())
  OR (SELECT public.is_staff_user())
);

GRANT SELECT, INSERT, UPDATE ON public.profile_secrets TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), ''),
    'student'::public.profile_role
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profile_secrets (id, email)
  VALUES (
    NEW.id,
    NULLIF(trim(COALESCE(NEW.email, '')), '')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = COALESCE(
    NULLIF(trim(EXCLUDED.email), ''),
    public.profile_secrets.email
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Создаёт profiles и profile_secrets при регистрации в auth.users.';
