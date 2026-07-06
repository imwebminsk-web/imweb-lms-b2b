-- =============================================================================
-- Профиль при регистрации: строка в public.profiles при INSERT в auth.users.
-- full_name берётся из raw_user_meta_data (передаётся в signUp options.data).
-- При подтверждении email новая строка в auth.users не создаётся — триггер
-- срабатывает один раз на регистрацию.
-- =============================================================================

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

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Создаёт public.profiles при появлении пользователя в auth.users (sign up).';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
