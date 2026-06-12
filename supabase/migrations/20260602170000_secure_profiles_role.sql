-- Phase 248: блокировка эскалации привилегий через public.profiles.role.
-- Клиент (authenticated/anon) не может менять role; service_role и postgres — могут.

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF COALESCE(auth.role(), '') IN ('authenticated', 'anon') THEN
      NEW.role := OLD.role;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_profile_role() IS
  'Запрещает смену profiles.role через клиентский JWT (authenticated/anon). '
  'Обновления full_name, avatar_url и других полей не затрагивает.';

DROP TRIGGER IF EXISTS protect_profile_role_trigger ON public.profiles;

CREATE TRIGGER protect_profile_role_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.protect_profile_role();
