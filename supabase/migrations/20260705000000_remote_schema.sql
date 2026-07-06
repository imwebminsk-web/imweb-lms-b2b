


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."attempt_status" AS ENUM (
    'in_progress',
    'completed',
    'pending_review'
);


ALTER TYPE "public"."attempt_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."attempt_status" IS 'in_progress | completed | pending_review (ожидает проверки преподавателем)';



CREATE TYPE "public"."course_level" AS ENUM (
    '0',
    'A1',
    'A2',
    'B1',
    'B1+',
    'B2',
    'B2+',
    'C1',
    'C2'
);


ALTER TYPE "public"."course_level" OWNER TO "postgres";


COMMENT ON TYPE "public"."course_level" IS 'Уровни по PRD: 0, A1–C2, включая B1+/B2+.';



CREATE TYPE "public"."course_status" AS ENUM (
    'draft',
    'published'
);


ALTER TYPE "public"."course_status" OWNER TO "postgres";


CREATE TYPE "public"."lesson_block_type" AS ENUM (
    'text',
    'image',
    'youtube',
    'vimeo',
    'assignment',
    'quiz'
);


ALTER TYPE "public"."lesson_block_type" OWNER TO "postgres";


CREATE TYPE "public"."lesson_type" AS ENUM (
    'video',
    'text',
    'test',
    'quiz'
);


ALTER TYPE "public"."lesson_type" OWNER TO "postgres";


CREATE TYPE "public"."profile_role" AS ENUM (
    'admin',
    'teacher',
    'student'
);


ALTER TYPE "public"."profile_role" OWNER TO "postgres";


CREATE TYPE "public"."start_date_type" AS ENUM (
    'fixed',
    'on_demand'
);


ALTER TYPE "public"."start_date_type" OWNER TO "postgres";


CREATE TYPE "public"."submission_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."submission_status" OWNER TO "postgres";


CREATE TYPE "public"."target_audience" AS ENUM (
    'kids',
    'adults'
);


ALTER TYPE "public"."target_audience" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assignment_submissions_enforce_immutable_ids"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.lesson_block_id IS DISTINCT FROM OLD.lesson_block_id THEN
    RAISE EXCEPTION 'Нельзя менять ученика или блок урока';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assignment_submissions_enforce_immutable_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_cohort_student_emails"("p_cohort_id" "uuid") RETURNS TABLE("user_id" "uuid", "email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.cohorts ch
    INNER JOIN public.courses c ON c.id = ch.course_id
    WHERE ch.id = p_cohort_id
      AND c.teacher_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    e.user_id,
    u.email::text
  FROM public.enrollments e
  INNER JOIN auth.users u ON u.id = e.user_id
  WHERE e.cohort_id = p_cohort_id;
END;
$$;


ALTER FUNCTION "public"."get_cohort_student_emails"("p_cohort_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_cohort_student_emails"("p_cohort_id" "uuid") IS 'Возвращает email учеников группы владельцу курса группы.';



CREATE OR REPLACE FUNCTION "public"."get_my_pending_review_counts"() RETURNS TABLE("cohort_id" "uuid", "pending_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    e.cohort_id,
    COUNT(s.id)::bigint AS pending_count
  FROM public.assignment_submissions AS s
  INNER JOIN public.lesson_blocks AS lb ON lb.id = s.lesson_block_id
  INNER JOIN public.lessons AS l ON l.id = lb.lesson_id
  INNER JOIN public.modules AS m ON m.id = l.module_id
  INNER JOIN public.courses AS c ON c.id = m.course_id
  INNER JOIN public.enrollments AS e
    ON e.user_id = s.student_id
    AND e.course_id = c.id
    AND e.cohort_id IS NOT NULL
  WHERE
    s.status = 'pending'::public.submission_status
    AND c.teacher_id = auth.uid()
    AND COALESCE((lb.content->>'save_to_journal')::boolean, false) = true
  GROUP BY e.cohort_id;
$$;


ALTER FUNCTION "public"."get_my_pending_review_counts"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_pending_review_counts"() IS 'Число сдач со статусом pending по когортам для курсов текущего преподавателя; только блоки assignment с save_to_journal = true.';



CREATE OR REPLACE FUNCTION "public"."get_my_student_progress"() RETURNS TABLE("id" "text", "type" "text", "title" "text", "status" "text", "grade10" integer, "course_id" "uuid", "course_slug" "text", "course_title" "text", "lesson_id" "uuid", "test_id" "uuid", "lesson_block_id" "uuid", "assignment_submission_id" "uuid", "has_completed_test_attempt" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH student_user AS (
    SELECT auth.uid() AS uid
  ),
  eligible_lessons AS (
    SELECT
      l.id AS lesson_id,
      COALESCE(NULLIF(TRIM(l.title), ''), 'Урок') AS lesson_title,
      l.order_index AS lesson_order,
      l.test_id AS lesson_test_id,
      m.order_index AS module_order,
      m.course_id,
      c.slug AS course_slug,
      c.title AS course_title
    FROM public.lessons AS l
    INNER JOIN public.modules AS m ON m.id = l.module_id
    INNER JOIN public.courses AS c ON c.id = m.course_id
    INNER JOIN public.enrollments AS e
      ON e.course_id = c.id
      AND e.user_id = (SELECT uid FROM student_user)
    WHERE
      l.is_published = true
      AND (SELECT uid FROM student_user) IS NOT NULL
      AND (
        e.cohort_id IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM public.cohort_assignments AS ca
          WHERE
            ca.cohort_id = e.cohort_id
            AND ca.lesson_id IS NOT NULL
        )
        OR EXISTS (
          SELECT 1
          FROM public.cohort_assignments AS ca
          WHERE
            ca.cohort_id = e.cohort_id
            AND ca.lesson_id = l.id
        )
      )
  ),
  relevant_test_ids AS (
    SELECT DISTINCT tid AS test_id
    FROM (
      SELECT el.lesson_test_id AS tid
      FROM eligible_lessons AS el
      WHERE el.lesson_test_id IS NOT NULL
      UNION ALL
      SELECT NULLIF(TRIM(lb.content->>'test_id'), '')::uuid AS tid
      FROM public.lesson_blocks AS lb
      INNER JOIN eligible_lessons AS el ON el.lesson_id = lb.lesson_id
      WHERE
        lb.type = 'quiz'::public.lesson_block_type
        AND NULLIF(TRIM(lb.content->>'test_id'), '') IS NOT NULL
    ) AS source_tests
    WHERE tid IS NOT NULL
  ),
  question_counts AS (
    SELECT q.test_id, COUNT(*)::integer AS cnt
    FROM public.questions AS q
    WHERE q.test_id IN (SELECT rt.test_id FROM relevant_test_ids AS rt)
    GROUP BY q.test_id
  ),
  attempt_grades AS (
    SELECT
      sa.test_id,
      LEAST(
        10,
        GREATEST(
          0,
          ROUND((COALESCE(sa.score, 0)::numeric / qc.cnt) * 10)
        )
      )::integer AS g10
    FROM public.student_attempts AS sa
    INNER JOIN question_counts AS qc ON qc.test_id = sa.test_id
    WHERE
      sa.student_id = (SELECT uid FROM student_user)
      AND sa.status = 'completed'::public.attempt_status
      AND qc.cnt > 0
  ),
  best_grades AS (
    SELECT ag.test_id, MAX(ag.g10)::integer AS grade10
    FROM attempt_grades AS ag
    GROUP BY ag.test_id
  ),
  attempt_flags AS (
    SELECT
      sa.test_id,
      BOOL_OR(sa.status = 'completed'::public.attempt_status) AS has_completed,
      BOOL_OR(sa.status = 'in_progress'::public.attempt_status) AS has_in_progress
    FROM public.student_attempts AS sa
    WHERE
      sa.student_id = (SELECT uid FROM student_user)
      AND sa.test_id IN (SELECT rt.test_id FROM relevant_test_ids AS rt)
    GROUP BY sa.test_id
  ),
  latest_submissions AS (
    SELECT DISTINCT ON (s.lesson_block_id)
      s.id,
      s.lesson_block_id,
      s.status,
      s.grade
    FROM public.assignment_submissions AS s
    INNER JOIN public.lesson_blocks AS lb ON lb.id = s.lesson_block_id
    INNER JOIN eligible_lessons AS el ON el.lesson_id = lb.lesson_id
    WHERE
      s.student_id = (SELECT uid FROM student_user)
      AND lb.type = 'assignment'::public.lesson_block_type
    ORDER BY s.lesson_block_id, s.updated_at DESC
  ),
  quiz_blocks_raw AS (
    SELECT
      lb.id AS block_id,
      lb.lesson_id,
      lb.order_index,
      NULLIF(TRIM(lb.content->>'test_id'), '') AS quiz_test_id
    FROM public.lesson_blocks AS lb
    INNER JOIN eligible_lessons AS el ON el.lesson_id = lb.lesson_id
    WHERE
      lb.type = 'quiz'::public.lesson_block_type
      AND NULLIF(TRIM(lb.content->>'test_id'), '') IS NOT NULL
  ),
  quiz_blocks_deduped AS (
    SELECT DISTINCT ON (qbr.lesson_id, qbr.quiz_test_id)
      qbr.block_id,
      qbr.lesson_id,
      qbr.order_index,
      qbr.quiz_test_id
    FROM quiz_blocks_raw AS qbr
    ORDER BY qbr.lesson_id, qbr.quiz_test_id, qbr.order_index
  ),
  lesson_test_items AS (
    SELECT
      ('test-' || el.lesson_id::text || '-' || el.lesson_test_id::text) AS id,
      'test'::text AS type,
      el.lesson_title AS title,
      CASE
        WHEN COALESCE(af.has_completed, false) THEN 'completed'
        WHEN COALESCE(af.has_in_progress, false) THEN 'in_progress'
        ELSE 'not_started'
      END AS status,
      bg.grade10,
      el.course_id,
      el.course_slug,
      el.course_title,
      el.lesson_id,
      el.lesson_test_id AS test_id,
      NULL::uuid AS lesson_block_id,
      NULL::uuid AS assignment_submission_id,
      COALESCE(af.has_completed, false) AS has_completed_test_attempt,
      el.course_title AS sort_course_title,
      el.module_order,
      el.lesson_order,
      1 AS sort_group,
      0 AS block_order
    FROM eligible_lessons AS el
    LEFT JOIN attempt_flags AS af ON af.test_id = el.lesson_test_id
    LEFT JOIN best_grades AS bg ON bg.test_id = el.lesson_test_id
    WHERE el.lesson_test_id IS NOT NULL
  ),
  quiz_test_items AS (
    SELECT
      (
        'test-'
        || el.lesson_id::text
        || '-block-'
        || qb.block_id::text
        || '-'
        || qb.quiz_test_id
      ) AS id,
      'test'::text AS type,
      el.lesson_title AS title,
      CASE
        WHEN COALESCE(af.has_completed, false) THEN 'completed'
        WHEN COALESCE(af.has_in_progress, false) THEN 'in_progress'
        ELSE 'not_started'
      END AS status,
      bg.grade10,
      el.course_id,
      el.course_slug,
      el.course_title,
      el.lesson_id,
      qb.quiz_test_id::uuid AS test_id,
      qb.block_id AS lesson_block_id,
      NULL::uuid AS assignment_submission_id,
      COALESCE(af.has_completed, false) AS has_completed_test_attempt,
      el.course_title AS sort_course_title,
      el.module_order,
      el.lesson_order,
      2 AS sort_group,
      qb.order_index AS block_order
    FROM quiz_blocks_deduped AS qb
    INNER JOIN eligible_lessons AS el ON el.lesson_id = qb.lesson_id
    LEFT JOIN attempt_flags AS af ON af.test_id = qb.quiz_test_id::uuid
    LEFT JOIN best_grades AS bg ON bg.test_id = qb.quiz_test_id::uuid
    WHERE
      el.lesson_test_id IS NULL
      OR el.lesson_test_id::text <> qb.quiz_test_id
  ),
  assignment_items AS (
    SELECT
      ('assignment-' || el.lesson_id::text || '-' || lb.id::text) AS id,
      'assignment'::text AS type,
      el.lesson_title AS title,
      COALESCE(ls.status::text, 'not_started') AS status,
      CASE
        WHEN
          ls.status = 'approved'::public.submission_status
          AND ls.grade IS NOT NULL
          THEN
            CASE
              WHEN ls.grade >= 0 AND ls.grade <= 10 THEN ROUND(ls.grade::numeric)::integer
              WHEN ls.grade > 10 AND ls.grade <= 100 THEN
                LEAST(10, GREATEST(0, ROUND((ls.grade::numeric / 100) * 10)))::integer
              ELSE LEAST(10, GREATEST(0, ROUND(ls.grade::numeric)))::integer
            END
        ELSE NULL
      END AS grade10,
      el.course_id,
      el.course_slug,
      el.course_title,
      el.lesson_id,
      NULL::uuid AS test_id,
      lb.id AS lesson_block_id,
      ls.id AS assignment_submission_id,
      false AS has_completed_test_attempt,
      el.course_title AS sort_course_title,
      el.module_order,
      el.lesson_order,
      3 AS sort_group,
      lb.order_index AS block_order
    FROM public.lesson_blocks AS lb
    INNER JOIN eligible_lessons AS el ON el.lesson_id = lb.lesson_id
    LEFT JOIN latest_submissions AS ls ON ls.lesson_block_id = lb.id
    WHERE lb.type = 'assignment'::public.lesson_block_type
  ),
  combined AS (
    SELECT * FROM lesson_test_items
    UNION ALL
    SELECT * FROM quiz_test_items
    UNION ALL
    SELECT * FROM assignment_items
  )
  SELECT
    c.id,
    c.type,
    c.title,
    c.status,
    c.grade10,
    c.course_id,
    c.course_slug,
    c.course_title,
    c.lesson_id,
    c.test_id,
    c.lesson_block_id,
    c.assignment_submission_id,
    c.has_completed_test_attempt
  FROM combined AS c
  ORDER BY
    c.sort_course_title,
    c.module_order,
    c.lesson_order,
    c.sort_group,
    c.block_order,
    c.id;
$$;


ALTER FUNCTION "public"."get_my_student_progress"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_student_progress"() IS 'Строки прогресса (тесты и задания) для текущего ученика (auth.uid()).';



CREATE OR REPLACE FUNCTION "public"."get_users_emails"("p_user_ids" "uuid"[]) RETURNS TABLE("user_id" "uuid", "email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_ids IS NULL OR cardinality(p_user_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    e.user_id,
    u.email::text
  FROM public.enrollments e
  INNER JOIN auth.users u ON u.id = e.user_id
  INNER JOIN public.courses c ON c.id = e.course_id
  WHERE e.user_id = ANY (p_user_ids)
    AND c.teacher_id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."get_users_emails"("p_user_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_users_emails"("p_user_ids" "uuid"[]) IS 'Возвращает email учеников, записанных на курсы текущего преподавателя.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Создаёт profiles и profile_secrets при регистрации в auth.users.';



CREATE OR REPLACE FUNCTION "public"."is_cohort_peer"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments AS e_self
    INNER JOIN public.enrollments AS e_peer
      ON e_peer.cohort_id = e_self.cohort_id
    WHERE
      e_self.user_id = (SELECT auth.uid())
      AND e_peer.user_id = p_profile_id
      AND e_self.cohort_id IS NOT NULL
  );
$$;


ALTER FUNCTION "public"."is_cohort_peer"("p_profile_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_cohort_peer"("p_profile_id" "uuid") IS 'true, если текущий пользователь и p_profile_id в одной cohort (enrollments.cohort_id).';



CREATE OR REPLACE FUNCTION "public"."is_staff_user"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."is_staff_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_staff_user"() IS 'true, если текущий JWT-пользователь — teacher или admin (обход RLS без рекурсии).';



CREATE OR REPLACE FUNCTION "public"."join_cohort_by_pin"("p_pin" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  jwt_uid uuid;
  norm_pin text;
  pick jsonb;
  enroll_pick jsonb;
BEGIN
  jwt_uid := auth.uid();
  IF jwt_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthorized');
  END IF;

  norm_pin := upper(trim(both from coalesce(p_pin, '')));
  IF length(norm_pin) <> 6 OR norm_pin !~ '^[A-Z0-9]{6}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_pin');
  END IF;

  -- Во всех SQL ниже только аргумент p_pin и auth.uid() — нет имён PL-переменных, нет EXECUTE INTO.
  pick := (
    SELECT jsonb_build_object(
      'cid', ch.id::text,
      'qid', ch.course_id::text,
      'st', crs.status::text,
      'sl', crs.slug
    )
    FROM public.cohorts AS ch
    INNER JOIN public.courses AS crs ON ch.course_id = crs.id
    WHERE ch.pin_code = upper(trim(both from coalesce(p_pin, '')))
      AND ch.is_active = true
    LIMIT 1
  );

  IF pick IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF (pick->>'st') IS DISTINCT FROM 'published' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'course_not_published');
  END IF;

  enroll_pick := (
    SELECT jsonb_build_array(e.course_id::text, e.cohort_id::text)
    FROM public.enrollments AS e
    WHERE e.user_id = auth.uid()
      AND e.course_id = (
        SELECT ch.course_id
        FROM public.cohorts AS ch
        INNER JOIN public.courses AS crs ON ch.course_id = crs.id
        WHERE ch.pin_code = upper(trim(both from coalesce(p_pin, '')))
          AND ch.is_active = true
        LIMIT 1
      )
    LIMIT 1
  );

  IF enroll_pick IS NULL THEN
    INSERT INTO public.enrollments (user_id, course_id, cohort_id)
    SELECT auth.uid(), ch.course_id, ch.id
    FROM public.cohorts AS ch
    INNER JOIN public.courses AS crs ON ch.course_id = crs.id
    WHERE ch.pin_code = upper(trim(both from coalesce(p_pin, '')))
      AND ch.is_active = true
    LIMIT 1;

    RETURN jsonb_build_object('ok', true, 'slug', pick->>'sl');
  END IF;

  IF (enroll_pick->>1) IS NOT DISTINCT FROM (pick->>'cid') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_same');
  END IF;

  IF enroll_pick->>1 IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_other_cohort');
  END IF;

  UPDATE public.enrollments AS e
  SET cohort_id = src.cohort_id
  FROM (
    SELECT ch.id AS cohort_id, ch.course_id
    FROM public.cohorts AS ch
    INNER JOIN public.courses AS crs ON ch.course_id = crs.id
    WHERE ch.pin_code = upper(trim(both from coalesce(p_pin, '')))
      AND ch.is_active = true
    LIMIT 1
  ) AS src
  WHERE e.user_id = auth.uid()
    AND e.course_id = src.course_id
    AND e.cohort_id IS NULL;

  RETURN jsonb_build_object('ok', true, 'slug', pick->>'sl');
END;
$_$;


ALTER FUNCTION "public"."join_cohort_by_pin"("p_pin" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."join_cohort_by_pin"("p_pin" "text") IS 'Запись пользователя в группу по PIN-коду.';



CREATE OR REPLACE FUNCTION "public"."mark_support_ticket_read"("p_ticket_id" "uuid", "p_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_role = 'student' THEN
    UPDATE public.support_tickets
    SET has_unread_student = false
    WHERE id = p_ticket_id;
  ELSIF p_role = 'teacher' THEN
    UPDATE public.support_tickets
    SET has_unread_teacher = false
    WHERE id = p_ticket_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."mark_support_ticket_read"("p_ticket_id" "uuid", "p_role" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_support_ticket_read"("p_ticket_id" "uuid", "p_role" "text") IS 'Сбрасывает флаг непрочитанного для ученика или преподавателя (SECURITY DEFINER).';



CREATE OR REPLACE FUNCTION "public"."protect_profile_role"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."protect_profile_role"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."protect_profile_role"() IS 'Запрещает смену profiles.role через клиентский JWT (authenticated/anon). Обновления full_name, avatar_url и других полей не затрагивает.';



CREATE OR REPLACE FUNCTION "public"."set_assignment_submissions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_assignment_submissions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_support_tickets_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_support_tickets_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_support_ticket"("p_ticket_id" "uuid", "p_sender_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_sender_role = 'student' THEN
    UPDATE public.support_tickets
    SET
      updated_at = now(),
      has_unread_teacher = true,
      has_unread_student = false
    WHERE id = p_ticket_id;
  ELSE
    UPDATE public.support_tickets
    SET
      updated_at = now(),
      has_unread_student = true,
      has_unread_teacher = false
    WHERE id = p_ticket_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."touch_support_ticket"("p_ticket_id" "uuid", "p_sender_role" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."touch_support_ticket"("p_ticket_id" "uuid", "p_sender_role" "text") IS 'Обновляет updated_at и флаги непрочитанных при новом сообщении (SECURITY DEFINER).';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."assignment_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lesson_block_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "status" "public"."submission_status" DEFAULT 'pending'::"public"."submission_status" NOT NULL,
    "grade" integer,
    "teacher_comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."assignment_submissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."assignment_submissions" IS 'Ответы учеников на блоки урока с типом assignment; проверка преподавателем.';



CREATE TABLE IF NOT EXISTS "public"."attempt_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attempt_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "option_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "answer_data" "jsonb"
);


ALTER TABLE "public"."attempt_answers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."attempt_answers"."answer_data" IS 'JSONB: ответ ученика при интерактивных типах (порядок id, точки клика, заполнение пропусков и т.д.).';



CREATE TABLE IF NOT EXISTS "public"."chat_read_receipts" (
    "user_id" "uuid" NOT NULL,
    "cohort_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_read_receipts" OWNER TO "postgres";


COMMENT ON TABLE "public"."chat_read_receipts" IS 'Время последнего просмотра чата когорты пользователем.';



CREATE TABLE IF NOT EXISTS "public"."cohort_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cohort_id" "uuid" NOT NULL,
    "lesson_id" "uuid",
    "test_id" "uuid",
    "is_required" boolean DEFAULT true NOT NULL,
    "due_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cohort_assignments_one_target_chk" CHECK (((("lesson_id" IS NOT NULL) AND ("test_id" IS NULL)) OR (("lesson_id" IS NULL) AND ("test_id" IS NOT NULL))))
);


ALTER TABLE "public"."cohort_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cohort_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cohort_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cohort_messages_content_max_len_chk" CHECK (("char_length"("content") <= 2000)),
    CONSTRAINT "cohort_messages_content_nonempty_chk" CHECK (("char_length"(TRIM(BOTH FROM "content")) > 0))
);


ALTER TABLE "public"."cohort_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."cohort_messages" IS 'Сообщения группового чата когорты; доступ по RLS для учителя, админа и записанных учеников.';



CREATE TABLE IF NOT EXISTS "public"."cohorts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "pin_code" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_chat_enabled" boolean DEFAULT true NOT NULL,
    CONSTRAINT "cohorts_pin_code_format_chk" CHECK (("pin_code" ~ '^[A-Z0-9]{6}$'::"text"))
);


ALTER TABLE "public"."cohorts" OWNER TO "postgres";


COMMENT ON TABLE "public"."cohorts" IS 'Учебная группа по курсу; PIN для доступа учеников.';



COMMENT ON COLUMN "public"."cohorts"."is_chat_enabled" IS 'Включён ли групповой чат когорты; при false участники не могут читать и писать сообщения.';



CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "price" numeric DEFAULT 0 NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "status" "public"."course_status" DEFAULT 'draft'::"public"."course_status" NOT NULL,
    "slug" "text" NOT NULL,
    "target_audience" "public"."target_audience" DEFAULT 'adults'::"public"."target_audience" NOT NULL,
    "start_date_type" "public"."start_date_type" DEFAULT 'on_demand'::"public"."start_date_type" NOT NULL,
    "start_date" timestamp with time zone,
    "level" "public"."course_level" DEFAULT 'A1'::"public"."course_level",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text",
    "detailed_description" "text",
    "youtube_url" "text",
    "vimeo_url" "text",
    "video_url" "text",
    "category" "text",
    "has_certificate" boolean DEFAULT false NOT NULL,
    "marketing_audience" "text",
    "duration_value" integer,
    "duration_unit" "text",
    "age_group" "text",
    "promotional_images" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "delivery_format" "text",
    "language" "text"
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."courses"."created_at" IS 'Момент создания записи; для существующих строк задаётся при добавлении колонки.';



COMMENT ON COLUMN "public"."courses"."image_url" IS 'Публичный URL обложки (Supabase Storage, bucket course-covers).';



COMMENT ON COLUMN "public"."courses"."detailed_description" IS 'Развёрнутое описание для лендинга курса.';



COMMENT ON COLUMN "public"."courses"."youtube_url" IS 'Ссылка на ролик YouTube.';



COMMENT ON COLUMN "public"."courses"."vimeo_url" IS 'Ссылка на ролик Vimeo.';



COMMENT ON COLUMN "public"."courses"."video_url" IS 'Публичный URL видео с self-host (Supabase Storage, bucket course-videos).';



COMMENT ON COLUMN "public"."courses"."category" IS 'Категория / тематика курса (текст).';



COMMENT ON COLUMN "public"."courses"."has_certificate" IS 'Флаг выдачи сертификата.';



COMMENT ON COLUMN "public"."courses"."marketing_audience" IS 'Сегмент лендинга: Дети | Взрослые | Все (текст; отдельно от enum target_audience).';



COMMENT ON COLUMN "public"."courses"."duration_value" IS 'Число для длительности (вместе с duration_unit).';



COMMENT ON COLUMN "public"."courses"."duration_unit" IS 'Единица: hours | weeks | months.';



COMMENT ON COLUMN "public"."courses"."age_group" IS 'Возрастная группа для маркетинговой аудитории «Дети»: 5-6 лет | 6-8 лет | 9-13 лет | 13-17 лет.';



COMMENT ON COLUMN "public"."courses"."promotional_images" IS 'Публичные URL изображений галереи лендинга (Storage course-covers, сжатие на клиенте).';



COMMENT ON COLUMN "public"."courses"."delivery_format" IS 'Формат: Онлайн | Офлайн | Гибрид.';



COMMENT ON COLUMN "public"."courses"."language" IS 'Язык курса для витрины (например, Английский).';



CREATE TABLE IF NOT EXISTS "public"."enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "cohort_id" "uuid",
    "enrolled_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."enrollments" OWNER TO "postgres";


COMMENT ON TABLE "public"."enrollments" IS 'Запись пользователя на курс; cohort_id — группа или NULL (индивидуально).';



CREATE TABLE IF NOT EXISTS "public"."lesson_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "type" "public"."lesson_block_type" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lesson_blocks" OWNER TO "postgres";


COMMENT ON TABLE "public"."lesson_blocks" IS 'Содержимое урока как набор блоков (текст, медиа, задание, квиз).';



CREATE TABLE IF NOT EXISTS "public"."lesson_completions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lesson_completions" OWNER TO "postgres";


COMMENT ON TABLE "public"."lesson_completions" IS 'Ученик явно отметил урок как завершённый; не более одной записи на пару студент–урок.';



CREATE TABLE IF NOT EXISTS "public"."lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "type" "public"."lesson_type" DEFAULT 'text'::"public"."lesson_type" NOT NULL,
    "test_id" "uuid",
    "order_index" integer DEFAULT 0 NOT NULL,
    "is_published" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lessons" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lessons"."content" IS 'JSON-контент урока (структура под video/text/quiz в UI следующих фаз).';



COMMENT ON COLUMN "public"."lessons"."is_published" IS 'Показывать ли урок в опубликованном курсе (черновик урока при status курса published).';



COMMENT ON COLUMN "public"."lessons"."created_at" IS 'Время создания записи урока.';



CREATE TABLE IF NOT EXISTS "public"."modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."modules" OWNER TO "postgres";


COMMENT ON COLUMN "public"."modules"."order_index" IS 'Порядок модуля в курсе (аналог поля position из спецификации Phase 6).';



COMMENT ON COLUMN "public"."modules"."created_at" IS 'Время создания записи модуля.';



CREATE TABLE IF NOT EXISTS "public"."options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid" NOT NULL,
    "content" "jsonb" NOT NULL,
    "is_correct" boolean DEFAULT false NOT NULL,
    "order_index" integer NOT NULL
);


ALTER TABLE "public"."options" OWNER TO "postgres";


COMMENT ON COLUMN "public"."options"."content" IS 'JSONB: данные варианта ответа. Legacy-строки мигрированы как {"text": "<было>"}.';



CREATE TABLE IF NOT EXISTS "public"."profile_secrets" (
    "id" "uuid" NOT NULL,
    "email" "text",
    CONSTRAINT "profile_secrets_email_max_len_chk" CHECK ((("email" IS NULL) OR ("char_length"("email") <= 320)))
);


ALTER TABLE "public"."profile_secrets" OWNER TO "postgres";


COMMENT ON TABLE "public"."profile_secrets" IS 'Приватные поля профиля (email). Одногруппники читают profiles без доступа к email.';



COMMENT ON COLUMN "public"."profile_secrets"."email" IS 'Копия auth.users.email; видят владелец и staff (is_staff_user).';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "public"."profile_role" DEFAULT 'student'::"public"."profile_role" NOT NULL,
    "bio" "text",
    "avatar_url" "text",
    "profession" "text",
    "specialization" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Публичный профиль; id совпадает с auth.users.id.';



COMMENT ON COLUMN "public"."profiles"."profession" IS 'Например: преподаватель английского.';



COMMENT ON COLUMN "public"."profiles"."specialization" IS 'Узкая специализация / методика.';



CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_id" "uuid" NOT NULL,
    "content" "jsonb" NOT NULL,
    "type" character varying(50) DEFAULT 'single_choice'::character varying,
    "order_index" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "points" integer DEFAULT 1 NOT NULL,
    "media_play_limit" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "questions_media_play_limit_non_negative_chk" CHECK (("media_play_limit" >= 0)),
    CONSTRAINT "questions_points_positive_chk" CHECK (("points" > 0))
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."questions"."content" IS 'JSONB: легенда вопроса (текст, координаты, слоты пазла и т.д.). Legacy-строки мигрированы как {"text": "<было>"}.';



COMMENT ON COLUMN "public"."questions"."type" IS 'Ожидаемые значения приложения: true_false, single_choice, multiple_choice, ordering, matching_puzzle, image_hotspot, text_input, fill_blanks_text, fill_blanks_dnd, image_select_objects, image_dnd_labels';



COMMENT ON COLUMN "public"."questions"."points" IS 'Вес вопроса при подсчёте итогового балла (по умолчанию 1).';



COMMENT ON COLUMN "public"."questions"."media_play_limit" IS 'Макс. число воспроизведений native audio/video в HTML-инструкции. 0 = безлимит. iframe (YouTube и т.д.) не ограничивается.';



CREATE TABLE IF NOT EXISTS "public"."student_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "status" "public"."attempt_status" DEFAULT 'in_progress'::"public"."attempt_status",
    "score" integer DEFAULT 0,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "is_training_mode" boolean DEFAULT false NOT NULL,
    "teacher_comment" "text"
);


ALTER TABLE "public"."student_attempts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."student_attempts"."is_training_mode" IS 'true — тренировочная пересдача; false — официальная попытка.';



COMMENT ON COLUMN "public"."student_attempts"."teacher_comment" IS 'Комментарий преподавателя при ручной проверке (auto_check = false).';



CREATE TABLE IF NOT EXISTS "public"."support_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_messages_content_max_len_chk" CHECK (("char_length"("content") <= 2000)),
    CONSTRAINT "support_messages_content_nonempty_chk" CHECK (("char_length"(TRIM(BOTH FROM "content")) > 0))
);


ALTER TABLE "public"."support_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."support_messages" IS 'Сообщения в тикете поддержки; Realtime для мгновенного обновления чата.';



CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "has_unread_teacher" boolean DEFAULT true NOT NULL,
    "has_unread_student" boolean DEFAULT false NOT NULL,
    CONSTRAINT "support_tickets_status_chk" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text"]))),
    CONSTRAINT "support_tickets_subject_max_len_chk" CHECK (("char_length"("subject") <= 200)),
    CONSTRAINT "support_tickets_subject_nonempty_chk" CHECK (("char_length"(TRIM(BOTH FROM "subject")) > 0))
);


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";


COMMENT ON TABLE "public"."support_tickets" IS 'Обращения в поддержку от учеников; статус закрывает учитель или админ.';



COMMENT ON COLUMN "public"."support_tickets"."has_unread_teacher" IS 'true — у преподавателя/админа есть непросмотренные обновления по тикету.';



COMMENT ON COLUMN "public"."support_tickets"."has_unread_student" IS 'true — у ученика есть непросмотренные ответы по тикету.';



CREATE TABLE IF NOT EXISTS "public"."taxonomies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "label" "text" NOT NULL,
    "value" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "taxonomies_label_nonempty_chk" CHECK (("char_length"(TRIM(BOTH FROM "label")) > 0)),
    CONSTRAINT "taxonomies_type_nonempty_chk" CHECK (("char_length"(TRIM(BOTH FROM "type")) > 0)),
    CONSTRAINT "taxonomies_value_nonempty_chk" CHECK (("char_length"(TRIM(BOTH FROM "value")) > 0))
);


ALTER TABLE "public"."taxonomies" OWNER TO "postgres";


COMMENT ON TABLE "public"."taxonomies" IS 'Унифицированный справочник значений фильтров (format, language, audience, age_group, cefr_level).';



COMMENT ON COLUMN "public"."taxonomies"."type" IS 'Категория: format, language, audience, age_group, cefr_level и т.д.';



COMMENT ON COLUMN "public"."taxonomies"."label" IS 'Человекочитаемая подпись для UI (например, «Онлайн»).';



COMMENT ON COLUMN "public"."taxonomies"."value" IS 'Стабильный ключ для URL и бизнес-логики (например, online).';



CREATE TABLE IF NOT EXISTS "public"."tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "is_published" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "folder_name" "text",
    "title_teacher" "text",
    "title_student" "text",
    "test_type" character varying(50) DEFAULT 'final'::character varying NOT NULL,
    "auto_check" boolean DEFAULT true NOT NULL,
    "save_to_journal" boolean DEFAULT true NOT NULL,
    "max_score" integer DEFAULT 100 NOT NULL,
    "is_for_kids" boolean DEFAULT false NOT NULL,
    "time_limit" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "tests_max_score_positive_chk" CHECK (("max_score" > 0)),
    CONSTRAINT "tests_test_type_chk" CHECK ((("test_type")::"text" = ANY ((ARRAY['training'::character varying, 'final'::character varying])::"text"[])))
);


ALTER TABLE "public"."tests" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tests"."user_id" IS 'Создатель теста; удаление только при совпадении с текущим пользователем в Server Action.';



COMMENT ON COLUMN "public"."tests"."title_teacher" IS 'Внутреннее название для преподавателя (опционально).';



COMMENT ON COLUMN "public"."tests"."title_student" IS 'Название, отображаемое ученику (опционально; fallback — title).';



COMMENT ON COLUMN "public"."tests"."test_type" IS 'Режим теста: training (тренировка) или final (контрольный).';



COMMENT ON COLUMN "public"."tests"."auto_check" IS 'true — автопроверка; false — требуется ручная проверка преподавателем.';



COMMENT ON COLUMN "public"."tests"."save_to_journal" IS 'false — попытка не влияет на итоговый журнал успеваемости.';



COMMENT ON COLUMN "public"."tests"."max_score" IS 'Максимально возможный балл/процент теста (по умолчанию 100).';



COMMENT ON COLUMN "public"."tests"."is_for_kids" IS 'Детский режим: оценки отображаются смайликами вместо числовых баллов.';



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attempt_answers"
    ADD CONSTRAINT "attempt_answers_attempt_id_question_id_option_id_key" UNIQUE ("attempt_id", "question_id", "option_id");



ALTER TABLE ONLY "public"."attempt_answers"
    ADD CONSTRAINT "attempt_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_read_receipts"
    ADD CONSTRAINT "chat_read_receipts_pkey" PRIMARY KEY ("user_id", "cohort_id");



ALTER TABLE ONLY "public"."cohort_assignments"
    ADD CONSTRAINT "cohort_assignments_cohort_lesson_key" UNIQUE ("cohort_id", "lesson_id");



ALTER TABLE ONLY "public"."cohort_assignments"
    ADD CONSTRAINT "cohort_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cohort_messages"
    ADD CONSTRAINT "cohort_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cohorts"
    ADD CONSTRAINT "cohorts_pin_code_key" UNIQUE ("pin_code");



ALTER TABLE ONLY "public"."cohorts"
    ADD CONSTRAINT "cohorts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_user_course_key" UNIQUE ("user_id", "course_id");



ALTER TABLE ONLY "public"."lesson_blocks"
    ADD CONSTRAINT "lesson_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lesson_completions"
    ADD CONSTRAINT "lesson_completions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lesson_completions"
    ADD CONSTRAINT "lesson_completions_student_lesson_key" UNIQUE ("student_id", "lesson_id");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."options"
    ADD CONSTRAINT "options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_secrets"
    ADD CONSTRAINT "profile_secrets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_attempts"
    ADD CONSTRAINT "student_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."taxonomies"
    ADD CONSTRAINT "taxonomies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."taxonomies"
    ADD CONSTRAINT "taxonomies_type_value_unique" UNIQUE ("type", "value");



ALTER TABLE ONLY "public"."tests"
    ADD CONSTRAINT "tests_pkey" PRIMARY KEY ("id");



CREATE INDEX "assignment_submissions_lesson_block_id_idx" ON "public"."assignment_submissions" USING "btree" ("lesson_block_id");



CREATE INDEX "assignment_submissions_student_id_idx" ON "public"."assignment_submissions" USING "btree" ("student_id");



CREATE INDEX "chat_read_receipts_cohort_id_idx" ON "public"."chat_read_receipts" USING "btree" ("cohort_id");



CREATE UNIQUE INDEX "cohort_assignments_cohort_lesson_uidx" ON "public"."cohort_assignments" USING "btree" ("cohort_id", "lesson_id") WHERE ("lesson_id" IS NOT NULL);



CREATE UNIQUE INDEX "cohort_assignments_cohort_test_uidx" ON "public"."cohort_assignments" USING "btree" ("cohort_id", "test_id") WHERE ("test_id" IS NOT NULL);



CREATE INDEX "cohort_messages_cohort_id_created_at_idx" ON "public"."cohort_messages" USING "btree" ("cohort_id", "created_at" DESC);



CREATE INDEX "cohorts_course_id_idx" ON "public"."cohorts" USING "btree" ("course_id");



CREATE UNIQUE INDEX "courses_slug_key" ON "public"."courses" USING "btree" ("slug");



CREATE INDEX "courses_status_idx" ON "public"."courses" USING "btree" ("status");



CREATE INDEX "courses_teacher_id_idx" ON "public"."courses" USING "btree" ("teacher_id");



CREATE INDEX "enrollments_cohort_id_idx" ON "public"."enrollments" USING "btree" ("cohort_id");



CREATE INDEX "enrollments_cohort_id_user_id_idx" ON "public"."enrollments" USING "btree" ("cohort_id", "user_id") WHERE ("cohort_id" IS NOT NULL);



COMMENT ON INDEX "public"."enrollments_cohort_id_user_id_idx" IS 'Ускоряет is_cohort_peer и проверки участников группы.';



CREATE INDEX "enrollments_course_id_idx" ON "public"."enrollments" USING "btree" ("course_id");



CREATE INDEX "enrollments_user_id_idx" ON "public"."enrollments" USING "btree" ("user_id");



CREATE INDEX "idx_assignment_submissions_status_block" ON "public"."assignment_submissions" USING "btree" ("status", "lesson_block_id");



COMMENT ON INDEX "public"."idx_assignment_submissions_status_block" IS 'Pending assignment reviews: status + lesson_block_id IN (...).';



CREATE INDEX "idx_student_attempts_status_test" ON "public"."student_attempts" USING "btree" ("status", "test_id");



COMMENT ON INDEX "public"."idx_student_attempts_status_test" IS 'Pending test reviews: status + test_id lookups for teacher dashboard.';



CREATE INDEX "idx_student_attempts_user_test" ON "public"."student_attempts" USING "btree" ("student_id", "test_id");



CREATE INDEX "lesson_blocks_lesson_id_order_idx" ON "public"."lesson_blocks" USING "btree" ("lesson_id", "order_index");



CREATE INDEX "lesson_completions_lesson_id_idx" ON "public"."lesson_completions" USING "btree" ("lesson_id");



CREATE INDEX "lesson_completions_student_id_idx" ON "public"."lesson_completions" USING "btree" ("student_id");



CREATE INDEX "lessons_module_id_idx" ON "public"."lessons" USING "btree" ("module_id");



CREATE INDEX "lessons_test_id_idx" ON "public"."lessons" USING "btree" ("test_id");



CREATE INDEX "modules_course_id_idx" ON "public"."modules" USING "btree" ("course_id");



CREATE INDEX "support_messages_ticket_id_created_at_idx" ON "public"."support_messages" USING "btree" ("ticket_id", "created_at");



CREATE INDEX "support_tickets_status_updated_at_idx" ON "public"."support_tickets" USING "btree" ("status", "updated_at" DESC);



CREATE INDEX "support_tickets_user_id_idx" ON "public"."support_tickets" USING "btree" ("user_id");



CREATE INDEX "taxonomies_type_active_idx" ON "public"."taxonomies" USING "btree" ("type") WHERE ("is_active" = true);



CREATE INDEX "taxonomies_type_sort_order_idx" ON "public"."taxonomies" USING "btree" ("type", "sort_order");



CREATE INDEX "tests_user_id_idx" ON "public"."tests" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "assignment_submissions_immutable_ids" BEFORE UPDATE ON "public"."assignment_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."assignment_submissions_enforce_immutable_ids"();



CREATE OR REPLACE TRIGGER "assignment_submissions_set_updated_at" BEFORE UPDATE ON "public"."assignment_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."set_assignment_submissions_updated_at"();



CREATE OR REPLACE TRIGGER "protect_profile_role_trigger" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_role"();



CREATE OR REPLACE TRIGGER "support_tickets_set_updated_at" BEFORE UPDATE ON "public"."support_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."set_support_tickets_updated_at"();



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_lesson_block_id_fkey" FOREIGN KEY ("lesson_block_id") REFERENCES "public"."lesson_blocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attempt_answers"
    ADD CONSTRAINT "attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."student_attempts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attempt_answers"
    ADD CONSTRAINT "attempt_answers_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attempt_answers"
    ADD CONSTRAINT "attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_read_receipts"
    ADD CONSTRAINT "chat_read_receipts_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_read_receipts"
    ADD CONSTRAINT "chat_read_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cohort_assignments"
    ADD CONSTRAINT "cohort_assignments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cohort_assignments"
    ADD CONSTRAINT "cohort_assignments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cohort_assignments"
    ADD CONSTRAINT "cohort_assignments_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cohort_messages"
    ADD CONSTRAINT "cohort_messages_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cohort_messages"
    ADD CONSTRAINT "cohort_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cohorts"
    ADD CONSTRAINT "cohorts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_blocks"
    ADD CONSTRAINT "lesson_blocks_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_completions"
    ADD CONSTRAINT "lesson_completions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_completions"
    ADD CONSTRAINT "lesson_completions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."options"
    ADD CONSTRAINT "options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_secrets"
    ADD CONSTRAINT "profile_secrets_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_attempts"
    ADD CONSTRAINT "student_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_attempts"
    ADD CONSTRAINT "student_attempts_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tests"
    ADD CONSTRAINT "tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



CREATE POLICY "Allow authenticated users to insert tests" ON "public"."tests" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated users to view tests list" ON "public"."tests" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read published tests" ON "public"."tests" FOR SELECT TO "authenticated" USING (("is_published" = true));



CREATE POLICY "Allow users to insert own answers" ON "public"."attempt_answers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."student_attempts"
  WHERE (("student_attempts"."id" = "attempt_answers"."attempt_id") AND ("student_attempts"."student_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to insert own attempts" ON "public"."student_attempts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "student_id"));



CREATE POLICY "Allow users to read own answers" ON "public"."attempt_answers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."student_attempts"
  WHERE (("student_attempts"."id" = "attempt_answers"."attempt_id") AND ("student_attempts"."student_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to read own attempts" ON "public"."student_attempts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Allow users to update own attempts" ON "public"."student_attempts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Users can delete their own tests" ON "public"."tests" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own tests" ON "public"."tests" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."assignment_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assignment_submissions_insert_own_student" ON "public"."assignment_submissions" FOR INSERT TO "authenticated" WITH CHECK ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."lesson_blocks" "lb"
  WHERE (("lb"."id" = "assignment_submissions"."lesson_block_id") AND ("lb"."type" = 'assignment'::"public"."lesson_block_type"))))));



CREATE POLICY "assignment_submissions_select_own_student" ON "public"."assignment_submissions" FOR SELECT TO "authenticated" USING (("student_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "assignment_submissions_select_teacher_or_admin" ON "public"."assignment_submissions" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR (EXISTS ( SELECT 1
   FROM ((("public"."lesson_blocks" "lb"
     JOIN "public"."lessons" "l" ON (("l"."id" = "lb"."lesson_id")))
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("lb"."id" = "assignment_submissions"."lesson_block_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "assignment_submissions_update_own_when_rejected" ON "public"."assignment_submissions" FOR UPDATE TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'rejected'::"public"."submission_status"))) WITH CHECK ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'pending'::"public"."submission_status") AND ("grade" IS NULL) AND ("teacher_comment" IS NULL)));



CREATE POLICY "assignment_submissions_update_teacher_or_admin" ON "public"."assignment_submissions" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR (EXISTS ( SELECT 1
   FROM ((("public"."lesson_blocks" "lb"
     JOIN "public"."lessons" "l" ON (("l"."id" = "lb"."lesson_id")))
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("lb"."id" = "assignment_submissions"."lesson_block_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR (EXISTS ( SELECT 1
   FROM ((("public"."lesson_blocks" "lb"
     JOIN "public"."lessons" "l" ON (("l"."id" = "lb"."lesson_id")))
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("lb"."id" = "assignment_submissions"."lesson_block_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."attempt_answers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attempt_answers_delete_own_in_progress" ON "public"."attempt_answers" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."student_attempts" "sa"
  WHERE (("sa"."id" = "attempt_answers"."attempt_id") AND ("sa"."student_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."status" = 'in_progress'::"public"."attempt_status")))));



CREATE POLICY "attempt_answers_insert_own_in_progress" ON "public"."attempt_answers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."student_attempts" "sa"
  WHERE (("sa"."id" = "attempt_answers"."attempt_id") AND ("sa"."student_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."status" = 'in_progress'::"public"."attempt_status")))));



CREATE POLICY "attempt_answers_select_own" ON "public"."attempt_answers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."student_attempts" "sa"
  WHERE (("sa"."id" = "attempt_answers"."attempt_id") AND ("sa"."student_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "attempt_answers_select_teacher_or_admin" ON "public"."attempt_answers" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR (EXISTS ( SELECT 1
   FROM ("public"."student_attempts" "sa"
     JOIN "public"."tests" "t" ON (("t"."id" = "sa"."test_id")))
  WHERE (("sa"."id" = "attempt_answers"."attempt_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "attempt_answers_update_own_in_progress" ON "public"."attempt_answers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."student_attempts" "sa"
  WHERE (("sa"."id" = "attempt_answers"."attempt_id") AND ("sa"."student_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."status" = 'in_progress'::"public"."attempt_status"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."student_attempts" "sa"
  WHERE (("sa"."id" = "attempt_answers"."attempt_id") AND ("sa"."student_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sa"."status" = 'in_progress'::"public"."attempt_status")))));



ALTER TABLE "public"."chat_read_receipts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_read_receipts_insert_own" ON "public"."chat_read_receipts" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "chat_read_receipts_select_own" ON "public"."chat_read_receipts" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "chat_read_receipts_update_own" ON "public"."chat_read_receipts" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."cohort_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cohort_assignments_delete_teacher" ON "public"."cohort_assignments" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."cohorts" "ch"
     JOIN "public"."courses" "c" ON (("c"."id" = "ch"."course_id")))
  WHERE (("ch"."id" = "cohort_assignments"."cohort_id") AND ("c"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "cohort_assignments_insert_teacher" ON "public"."cohort_assignments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."cohorts" "ch"
     JOIN "public"."courses" "c" ON (("c"."id" = "ch"."course_id")))
  WHERE (("ch"."id" = "cohort_assignments"."cohort_id") AND ("c"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "cohort_assignments_select_student_member" ON "public"."cohort_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."cohort_id" = "cohort_assignments"."cohort_id") AND ("e"."user_id" = "auth"."uid"())))));



CREATE POLICY "cohort_assignments_select_teacher" ON "public"."cohort_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."cohorts" "ch"
     JOIN "public"."courses" "c" ON (("c"."id" = "ch"."course_id")))
  WHERE (("ch"."id" = "cohort_assignments"."cohort_id") AND ("c"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "cohort_assignments_update_teacher" ON "public"."cohort_assignments" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."cohorts" "ch"
     JOIN "public"."courses" "c" ON (("c"."id" = "ch"."course_id")))
  WHERE (("ch"."id" = "cohort_assignments"."cohort_id") AND ("c"."teacher_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."cohorts" "ch"
     JOIN "public"."courses" "c" ON (("c"."id" = "ch"."course_id")))
  WHERE (("ch"."id" = "cohort_assignments"."cohort_id") AND ("c"."teacher_id" = "auth"."uid"())))));



ALTER TABLE "public"."cohort_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cohort_messages_delete_teacher" ON "public"."cohort_messages" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR (EXISTS ( SELECT 1
   FROM ("public"."cohorts" "ch"
     JOIN "public"."courses" "c" ON (("c"."id" = "ch"."course_id")))
  WHERE (("ch"."id" = "cohort_messages"."cohort_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "cohort_messages_insert_member" ON "public"."cohort_messages" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR (EXISTS ( SELECT 1
   FROM ("public"."cohorts" "ch"
     JOIN "public"."courses" "c" ON (("c"."id" = "ch"."course_id")))
  WHERE (("ch"."id" = "cohort_messages"."cohort_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."cohort_id" = "cohort_messages"."cohort_id") AND ("e"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "cohort_messages_select_member" ON "public"."cohort_messages" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR (EXISTS ( SELECT 1
   FROM ("public"."cohorts" "ch"
     JOIN "public"."courses" "c" ON (("c"."id" = "ch"."course_id")))
  WHERE (("ch"."id" = "cohort_messages"."cohort_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."cohort_id" = "cohort_messages"."cohort_id") AND ("e"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."cohorts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cohorts_delete_teacher" ON "public"."cohorts" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "cohorts"."course_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "cohorts_insert_teacher" ON "public"."cohorts" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "cohorts"."course_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "cohorts_select_teacher_or_member" ON "public"."cohorts" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "cohorts"."course_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."cohort_id" = "cohorts"."id") AND ("e"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "cohorts_update_teacher" ON "public"."cohorts" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "cohorts"."course_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "cohorts"."course_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "courses_delete_own" ON "public"."courses" FOR DELETE TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "courses_insert_teacher_or_admin" ON "public"."courses" FOR INSERT TO "authenticated" WITH CHECK ((("teacher_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = ANY (ARRAY['teacher'::"public"."profile_role", 'admin'::"public"."profile_role"])))))));



CREATE POLICY "courses_select_visible" ON "public"."courses" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'published'::"public"."course_status") OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("teacher_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "courses_update_own" ON "public"."courses" FOR UPDATE TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."enrollments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enrollments_delete_teacher" ON "public"."enrollments" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "enrollments"."course_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "enrollments_insert_own" ON "public"."enrollments" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "enrollments_select_own_or_teacher" ON "public"."enrollments" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "enrollments"."course_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "enrollments_update_own" ON "public"."enrollments" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."lesson_blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lesson_blocks_delete_teacher" ON "public"."lesson_blocks" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("l"."id" = "lesson_blocks"."lesson_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "lesson_blocks_insert_teacher" ON "public"."lesson_blocks" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("l"."id" = "lesson_blocks"."lesson_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "lesson_blocks_select_visible" ON "public"."lesson_blocks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("l"."id" = "lesson_blocks"."lesson_id") AND (("c"."status" = 'published'::"public"."course_status") OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "lesson_blocks_update_teacher" ON "public"."lesson_blocks" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("l"."id" = "lesson_blocks"."lesson_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("l"."id" = "lesson_blocks"."lesson_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."lesson_completions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lesson_completions_delete_own_student" ON "public"."lesson_completions" FOR DELETE TO "authenticated" USING (("student_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "lesson_completions_insert_own_student" ON "public"."lesson_completions" FOR INSERT TO "authenticated" WITH CHECK (("student_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "lesson_completions_select_own_student" ON "public"."lesson_completions" FOR SELECT TO "authenticated" USING (("student_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "lesson_completions_select_teacher_or_admin" ON "public"."lesson_completions" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR (EXISTS ( SELECT 1
   FROM (("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("l"."id" = "lesson_completions"."lesson_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."lessons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lessons_delete_owner" ON "public"."lessons" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."modules" "m"
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("m"."id" = "lessons"."module_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "lessons_insert_owner" ON "public"."lessons" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."modules" "m"
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("m"."id" = "lessons"."module_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "lessons_select_visible" ON "public"."lessons" FOR SELECT TO "authenticated", "anon" USING (((EXISTS ( SELECT 1
   FROM ("public"."modules" "m"
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("m"."id" = "lessons"."module_id") AND (( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (("is_published" = true) AND (EXISTS ( SELECT 1
   FROM ("public"."modules" "m"
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("m"."id" = "lessons"."module_id") AND ("c"."status" = 'published'::"public"."course_status")))))));



CREATE POLICY "lessons_update_owner" ON "public"."lessons" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."modules" "m"
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("m"."id" = "lessons"."module_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."modules" "m"
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("m"."id" = "lessons"."module_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."modules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "modules_delete_owner" ON "public"."modules" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "modules"."course_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "modules_insert_owner" ON "public"."modules" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "modules"."course_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "modules_select_visible" ON "public"."modules" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "modules"."course_id") AND (("c"."status" = 'published'::"public"."course_status") OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "modules_update_owner" ON "public"."modules" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "modules"."course_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "modules"."course_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "options_delete_owner_or_admin" ON "public"."options" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."questions" "q"
     JOIN "public"."tests" "t" ON (("t"."id" = "q"."test_id")))
  WHERE (("q"."id" = "options"."question_id") AND (("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))))))));



CREATE POLICY "options_delete_teacher_or_admin" ON "public"."options" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'teacher'::"public"."profile_role")))) AND (EXISTS ( SELECT 1
   FROM ("public"."questions" "q"
     JOIN "public"."tests" "t" ON (("t"."id" = "q"."test_id")))
  WHERE (("q"."id" = "options"."question_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "options_insert_owner_or_admin" ON "public"."options" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."questions" "q"
     JOIN "public"."tests" "t" ON (("t"."id" = "q"."test_id")))
  WHERE (("q"."id" = "options"."question_id") AND (("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))))))));



CREATE POLICY "options_insert_teacher_or_admin" ON "public"."options" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'teacher'::"public"."profile_role")))) AND (EXISTS ( SELECT 1
   FROM ("public"."questions" "q"
     JOIN "public"."tests" "t" ON (("t"."id" = "q"."test_id")))
  WHERE (("q"."id" = "options"."question_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "options_select_visible" ON "public"."options" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."questions" "q"
     JOIN "public"."tests" "t" ON (("t"."id" = "q"."test_id")))
  WHERE (("q"."id" = "options"."question_id") AND (("t"."is_published" IS TRUE) OR ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))))))));



CREATE POLICY "options_update_owner_or_admin" ON "public"."options" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."questions" "q"
     JOIN "public"."tests" "t" ON (("t"."id" = "q"."test_id")))
  WHERE (("q"."id" = "options"."question_id") AND (("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role"))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."questions" "q"
     JOIN "public"."tests" "t" ON (("t"."id" = "q"."test_id")))
  WHERE (("q"."id" = "options"."question_id") AND (("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))))))));



CREATE POLICY "options_update_teacher_or_admin" ON "public"."options" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'teacher'::"public"."profile_role")))) AND (EXISTS ( SELECT 1
   FROM ("public"."questions" "q"
     JOIN "public"."tests" "t" ON (("t"."id" = "q"."test_id")))
  WHERE (("q"."id" = "options"."question_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'teacher'::"public"."profile_role")))) AND (EXISTS ( SELECT 1
   FROM ("public"."questions" "q"
     JOIN "public"."tests" "t" ON (("t"."id" = "q"."test_id")))
  WHERE (("q"."id" = "options"."question_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



ALTER TABLE "public"."profile_secrets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_secrets_insert_own_or_staff" ON "public"."profile_secrets" FOR INSERT TO "authenticated" WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_staff_user"() AS "is_staff_user")));



CREATE POLICY "profile_secrets_select_own_or_staff" ON "public"."profile_secrets" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_staff_user"() AS "is_staff_user")));



CREATE POLICY "profile_secrets_update_own_or_staff" ON "public"."profile_secrets" FOR UPDATE TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_staff_user"() AS "is_staff_user"))) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_staff_user"() AS "is_staff_user")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles_select_cohort_peers" ON "public"."profiles" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_cohort_peer"("profiles"."id") AS "is_cohort_peer"));



COMMENT ON POLICY "profiles_select_cohort_peers" ON "public"."profiles" IS 'Участники одной группы видят профили друг друга (имя, аватар в чате).';



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles_select_staff_directory" ON "public"."profiles" FOR SELECT USING (("role" = ANY (ARRAY['teacher'::"public"."profile_role", 'admin'::"public"."profile_role"])));



COMMENT ON POLICY "profiles_select_staff_directory" ON "public"."profiles" IS 'Карточки курсов: любой может читать профили teacher/admin.';



CREATE POLICY "profiles_select_staff_read_all" ON "public"."profiles" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_staff_user"() AS "is_staff_user"));



COMMENT ON POLICY "profiles_select_staff_read_all" ON "public"."profiles" IS 'Teacher/admin читают все profiles (в т.ч. email учеников).';



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "questions_delete_owner_or_admin" ON "public"."questions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "questions"."test_id") AND (("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))))))));



CREATE POLICY "questions_delete_teacher_or_admin" ON "public"."questions" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'teacher'::"public"."profile_role")))) AND (EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "questions"."test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "questions_insert_owner_or_admin" ON "public"."questions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "questions"."test_id") AND (("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))))))));



CREATE POLICY "questions_insert_teacher_or_admin" ON "public"."questions" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'teacher'::"public"."profile_role")))) AND (EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "questions"."test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "questions_select_visible" ON "public"."questions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "questions"."test_id") AND (("t"."is_published" IS TRUE) OR ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))))))));



CREATE POLICY "questions_update_owner_or_admin" ON "public"."questions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "questions"."test_id") AND (("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role"))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "questions"."test_id") AND (("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))))))));



CREATE POLICY "questions_update_teacher_or_admin" ON "public"."questions" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'teacher'::"public"."profile_role")))) AND (EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "questions"."test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'teacher'::"public"."profile_role")))) AND (EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "questions"."test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



ALTER TABLE "public"."student_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_attempts_delete_own" ON "public"."student_attempts" FOR DELETE TO "authenticated" USING (("student_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "student_attempts_insert_own" ON "public"."student_attempts" FOR INSERT TO "authenticated" WITH CHECK (("student_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "student_attempts_select_own" ON "public"."student_attempts" FOR SELECT TO "authenticated" USING (("student_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "student_attempts_select_teacher_or_admin" ON "public"."student_attempts" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "student_attempts"."test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



COMMENT ON POLICY "student_attempts_select_teacher_or_admin" ON "public"."student_attempts" IS 'Преподаватель видит попытки по своим тестам; admin — все.';



CREATE POLICY "student_attempts_update_own" ON "public"."student_attempts" FOR UPDATE TO "authenticated" USING (("student_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("student_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "student_attempts_update_teacher_or_admin" ON "public"."student_attempts" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "student_attempts"."test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "student_attempts"."test_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."support_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_messages_insert_own_ticket" ON "public"."support_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."support_tickets" "t"
  WHERE (("t"."id" = "support_messages"."ticket_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "support_messages_insert_staff" ON "public"."support_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = ANY (ARRAY['teacher'::"public"."profile_role", 'admin'::"public"."profile_role"])))))));



CREATE POLICY "support_messages_select_own_ticket" ON "public"."support_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."support_tickets" "t"
  WHERE (("t"."id" = "support_messages"."ticket_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "support_messages_select_staff" ON "public"."support_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = ANY (ARRAY['teacher'::"public"."profile_role", 'admin'::"public"."profile_role"]))))));



ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_tickets_delete_teacher" ON "public"."support_tickets" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = ANY (ARRAY['teacher'::"public"."profile_role", 'admin'::"public"."profile_role"]))))));



CREATE POLICY "support_tickets_insert_student" ON "public"."support_tickets" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'student'::"public"."profile_role"))))));



CREATE POLICY "support_tickets_select_own" ON "public"."support_tickets" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "support_tickets_select_staff" ON "public"."support_tickets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = ANY (ARRAY['teacher'::"public"."profile_role", 'admin'::"public"."profile_role"]))))));



CREATE POLICY "support_tickets_update_staff" ON "public"."support_tickets" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = ANY (ARRAY['teacher'::"public"."profile_role", 'admin'::"public"."profile_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = ANY (ARRAY['teacher'::"public"."profile_role", 'admin'::"public"."profile_role"]))))));



ALTER TABLE "public"."taxonomies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "taxonomies_delete_admin" ON "public"."taxonomies" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))));



CREATE POLICY "taxonomies_insert_admin" ON "public"."taxonomies" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))));



CREATE POLICY "taxonomies_select_visible" ON "public"."taxonomies" FOR SELECT USING ((("is_active" = true) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role"))))));



CREATE POLICY "taxonomies_update_admin" ON "public"."taxonomies" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))));



ALTER TABLE "public"."tests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tests_delete_admin" ON "public"."tests" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))));



CREATE POLICY "tests_delete_owner" ON "public"."tests" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "tests_insert_teacher_or_admin" ON "public"."tests" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = ANY (ARRAY['teacher'::"public"."profile_role", 'admin'::"public"."profile_role"])))))));



CREATE POLICY "tests_select_admin" ON "public"."tests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))));



CREATE POLICY "tests_select_owner" ON "public"."tests" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "tests_select_published" ON "public"."tests" FOR SELECT USING (("is_published" IS TRUE));



COMMENT ON POLICY "tests_select_published" ON "public"."tests" IS 'Опубликованные тесты читают все (в т.ч. anon) — контент без is_correct на клиенте.';



CREATE POLICY "tests_update_admin" ON "public"."tests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."profile_role")))));



CREATE POLICY "tests_update_owner" ON "public"."tests" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Опубликованные тесты читают все" ON "public"."tests" FOR SELECT TO "authenticated", "anon" USING (("is_published" = true));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."cohort_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."support_messages";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."assignment_submissions_enforce_immutable_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."assignment_submissions_enforce_immutable_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assignment_submissions_enforce_immutable_ids"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_cohort_student_emails"("p_cohort_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_cohort_student_emails"("p_cohort_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_cohort_student_emails"("p_cohort_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cohort_student_emails"("p_cohort_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_pending_review_counts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_pending_review_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_pending_review_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_pending_review_counts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_student_progress"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_student_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_student_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_student_progress"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_users_emails"("p_user_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_users_emails"("p_user_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_users_emails"("p_user_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_users_emails"("p_user_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_cohort_peer"("p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_cohort_peer"("p_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_cohort_peer"("p_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_cohort_peer"("p_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_staff_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_staff_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_staff_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_staff_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."join_cohort_by_pin"("p_pin" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."join_cohort_by_pin"("p_pin" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_cohort_by_pin"("p_pin" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_cohort_by_pin"("p_pin" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_support_ticket_read"("p_ticket_id" "uuid", "p_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_support_ticket_read"("p_ticket_id" "uuid", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_profile_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_profile_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_profile_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_assignment_submissions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_assignment_submissions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_assignment_submissions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_support_tickets_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_support_tickets_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_support_tickets_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."touch_support_ticket"("p_ticket_id" "uuid", "p_sender_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."touch_support_ticket"("p_ticket_id" "uuid", "p_sender_role" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."assignment_submissions" TO "anon";
GRANT ALL ON TABLE "public"."assignment_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."attempt_answers" TO "anon";
GRANT ALL ON TABLE "public"."attempt_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."attempt_answers" TO "service_role";



GRANT ALL ON TABLE "public"."chat_read_receipts" TO "anon";
GRANT ALL ON TABLE "public"."chat_read_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_read_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."cohort_assignments" TO "anon";
GRANT ALL ON TABLE "public"."cohort_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."cohort_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."cohort_messages" TO "anon";
GRANT ALL ON TABLE "public"."cohort_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."cohort_messages" TO "service_role";



GRANT ALL ON TABLE "public"."cohorts" TO "anon";
GRANT ALL ON TABLE "public"."cohorts" TO "authenticated";
GRANT ALL ON TABLE "public"."cohorts" TO "service_role";



GRANT ALL ON TABLE "public"."courses" TO "anon";
GRANT ALL ON TABLE "public"."courses" TO "authenticated";
GRANT ALL ON TABLE "public"."courses" TO "service_role";



GRANT ALL ON TABLE "public"."enrollments" TO "anon";
GRANT ALL ON TABLE "public"."enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."lesson_blocks" TO "anon";
GRANT ALL ON TABLE "public"."lesson_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."lesson_completions" TO "anon";
GRANT ALL ON TABLE "public"."lesson_completions" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson_completions" TO "service_role";



GRANT ALL ON TABLE "public"."lessons" TO "anon";
GRANT ALL ON TABLE "public"."lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."lessons" TO "service_role";



GRANT ALL ON TABLE "public"."modules" TO "anon";
GRANT ALL ON TABLE "public"."modules" TO "authenticated";
GRANT ALL ON TABLE "public"."modules" TO "service_role";



GRANT ALL ON TABLE "public"."options" TO "anon";
GRANT ALL ON TABLE "public"."options" TO "authenticated";
GRANT ALL ON TABLE "public"."options" TO "service_role";



GRANT ALL ON TABLE "public"."profile_secrets" TO "anon";
GRANT ALL ON TABLE "public"."profile_secrets" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_secrets" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT ALL ON TABLE "public"."student_attempts" TO "anon";
GRANT ALL ON TABLE "public"."student_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."student_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."support_messages" TO "anon";
GRANT ALL ON TABLE "public"."support_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."support_messages" TO "service_role";



GRANT ALL ON TABLE "public"."support_tickets" TO "anon";
GRANT ALL ON TABLE "public"."support_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."support_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."taxonomies" TO "anon";
GRANT ALL ON TABLE "public"."taxonomies" TO "authenticated";
GRANT ALL ON TABLE "public"."taxonomies" TO "service_role";



GRANT ALL ON TABLE "public"."tests" TO "anon";
GRANT ALL ON TABLE "public"."tests" TO "authenticated";
GRANT ALL ON TABLE "public"."tests" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































