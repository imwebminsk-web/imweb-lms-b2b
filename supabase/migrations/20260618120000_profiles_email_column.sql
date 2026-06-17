-- Синхронизация email в public.profiles для журнала без service role.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN public.profiles.email IS
  'Копия auth.users.email для отображения преподавателям через стандартный клиент.';

UPDATE public.profiles AS p
SET email = u.email::text
FROM auth.users AS u
WHERE u.id = p.id
  AND (p.email IS NULL OR btrim(p.email) = '');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, email)
  VALUES (
    NEW.id,
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), ''),
    'student'::public.profile_role,
    NULLIF(trim(COALESCE(NEW.email, '')), '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(
      NULLIF(trim(EXCLUDED.email), ''),
      public.profiles.email
    );

  RETURN NEW;
END;
$$;
