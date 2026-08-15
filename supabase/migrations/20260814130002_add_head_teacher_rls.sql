-- 2. Grant full RLS access to 'courses' for 'head_teacher'
CREATE POLICY "courses_head_teacher_all" ON public.courses
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'head_teacher'::public.profile_role
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'head_teacher'::public.profile_role
        )
    );

-- 3. Grant full RLS access to 'cohorts' for 'head_teacher'
CREATE POLICY "cohorts_head_teacher_all" ON public.cohorts
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'head_teacher'::public.profile_role
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'head_teacher'::public.profile_role
        )
    );
