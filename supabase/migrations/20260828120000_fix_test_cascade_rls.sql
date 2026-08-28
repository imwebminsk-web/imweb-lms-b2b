-- Remove permissive legacy RLS policies on tests (superseded by role-scoped policies).
DROP POLICY IF EXISTS "Allow authenticated users to insert tests" ON public.tests;
DROP POLICY IF EXISTS "Allow authenticated users to view tests list" ON public.tests;
DROP POLICY IF EXISTS "Users can delete their own tests" ON public.tests;
