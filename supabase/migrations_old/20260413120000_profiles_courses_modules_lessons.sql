-- =============================================================================
-- Профили с ролями, курсы, модули и уроки (оболочка «школа» вокруг тестов).
-- Выполнить через Supabase SQL Editor или: supabase db push
-- =============================================================================

-- Роли пользователя в приложении (синхронно с public.profiles.role)
CREATE TYPE public.profile_role AS ENUM ('admin', 'teacher', 'student');

CREATE TYPE public.course_status AS ENUM ('draft', 'published');

CREATE TYPE public.lesson_type AS ENUM ('video', 'text', 'test');

-- Профиль = расширение auth.users
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  role public.profile_role NOT NULL DEFAULT 'student',
  bio text,
  avatar_url text
);

COMMENT ON TABLE public.profiles IS
  'Публичный профиль; id совпадает с auth.users.id.';

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  title text NOT NULL,
  description text,
  language text,
  level text,
  price numeric NOT NULL DEFAULT 0,
  teacher_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  thumbnail_url text,
  status public.course_status NOT NULL DEFAULT 'draft'
);

CREATE INDEX courses_teacher_id_idx ON public.courses (teacher_id);

CREATE INDEX courses_status_idx ON public.courses (status);

CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  title text NOT NULL,
  order_index integer NOT NULL DEFAULT 0
);

CREATE INDEX modules_course_id_idx ON public.modules (course_id);

CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  module_id uuid NOT NULL REFERENCES public.modules (id) ON DELETE CASCADE,
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  type public.lesson_type NOT NULL,
  test_id uuid REFERENCES public.tests (id) ON DELETE SET NULL,
  order_index integer NOT NULL DEFAULT 0
);

CREATE INDEX lessons_module_id_idx ON public.lessons (module_id);

CREATE INDEX lessons_test_id_idx ON public.lessons (test_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- profiles: чтение для каталога / карточек курса (без чувствительных полей в таблице)
CREATE POLICY "profiles_select_all"
ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- courses: опубликованные — всем; черновики — только преподавателю-владельцу
CREATE POLICY "courses_select_visible"
ON public.courses FOR SELECT
  USING (
    status = 'published'::public.course_status
    OR (
      (SELECT auth.uid()) IS NOT NULL
      AND teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "courses_insert_teacher_or_admin"
ON public.courses FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE
        p.id = (SELECT auth.uid())
        AND p.role IN (
          'teacher'::public.profile_role,
          'admin'::public.profile_role
        )
    )
  );

CREATE POLICY "courses_update_own"
ON public.courses FOR UPDATE TO authenticated
  USING (teacher_id = (SELECT auth.uid()))
  WITH CHECK (teacher_id = (SELECT auth.uid()));

CREATE POLICY "courses_delete_own"
ON public.courses FOR DELETE TO authenticated
  USING (teacher_id = (SELECT auth.uid()));

-- modules: видимость следует за курсом
CREATE POLICY "modules_select_visible"
ON public.modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE
        c.id = modules.course_id
        AND (
          c.status = 'published'::public.course_status
          OR (
            (SELECT auth.uid()) IS NOT NULL
            AND c.teacher_id = (SELECT auth.uid())
          )
        )
    )
  );

CREATE POLICY "modules_insert_owner"
ON public.modules FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE
        c.id = course_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "modules_update_owner"
ON public.modules FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE
        c.id = course_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE
        c.id = course_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "modules_delete_owner"
ON public.modules FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE
        c.id = course_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

-- lessons: видимость через модуль → курс
CREATE POLICY "lessons_select_visible"
ON public.lessons FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.modules m
        JOIN public.courses c ON c.id = m.course_id
      WHERE
        m.id = lessons.module_id
        AND (
          c.status = 'published'::public.course_status
          OR (
            (SELECT auth.uid()) IS NOT NULL
            AND c.teacher_id = (SELECT auth.uid())
          )
        )
    )
  );

CREATE POLICY "lessons_insert_owner"
ON public.lessons FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.modules m
        JOIN public.courses c ON c.id = m.course_id
      WHERE
        m.id = module_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "lessons_update_owner"
ON public.lessons FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.modules m
        JOIN public.courses c ON c.id = m.course_id
      WHERE
        m.id = module_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.modules m
        JOIN public.courses c ON c.id = m.course_id
      WHERE
        m.id = module_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "lessons_delete_owner"
ON public.lessons FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.modules m
        JOIN public.courses c ON c.id = m.course_id
      WHERE
        m.id = module_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

-- Права API-ролей (Supabase PostgREST)
GRANT SELECT ON public.profiles TO anon, authenticated;

GRANT INSERT, UPDATE ON public.profiles TO authenticated;

GRANT SELECT ON public.courses TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.courses TO authenticated;

GRANT SELECT ON public.modules TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.modules TO authenticated;

GRANT SELECT ON public.lessons TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.lessons TO authenticated;

