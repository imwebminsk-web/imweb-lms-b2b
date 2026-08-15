-- Drop trigger if it already exists to avoid duplication errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger linking auth.users insertion to public.handle_new_user()
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
