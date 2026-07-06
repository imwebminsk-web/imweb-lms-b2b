-- Администратор видит все курсы (для дашборда и отчётов).
-- Политики SELECT для одной таблицы объединяются через OR.

CREATE POLICY "courses_select_admin"
ON public.courses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE
        p.id = (SELECT auth.uid())
        AND p.role = 'admin'::public.profile_role
    )
  );
