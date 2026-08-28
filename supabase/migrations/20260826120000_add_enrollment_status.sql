-- Waitlist / suspension: cohort approval flag, enrollment status, RLS, PIN join.

ALTER TABLE public.cohorts
  ADD COLUMN requires_approval boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN public.cohorts.requires_approval IS
  'Если true, вход по PIN создаёт заявку (enrollments.status = pending), а не сразу активную запись.';

ALTER TABLE public.enrollments
  ADD COLUMN status text DEFAULT 'active' NOT NULL
    CHECK (status IN ('active', 'pending', 'suspended'));

COMMENT ON COLUMN public.enrollments.status IS
  'active — доступ к курсу; pending — лист ожидания; suspended — доступ приостановлен.';

CREATE OR REPLACE FUNCTION private.is_enrolled_in_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments AS e
    WHERE e.course_id = p_course_id
      AND e.user_id = (SELECT auth.uid())
      AND e.status = 'active'
  );
$$;

COMMENT ON FUNCTION private.is_enrolled_in_course(uuid) IS
  'true, если у текущего пользователя есть активная запись (enrollments.status = active) на курс.';

CREATE OR REPLACE FUNCTION "public"."join_cohort_by_pin"("p_pin" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO "public"
    AS $_$
DECLARE
  jwt_uid uuid;
  caller_role public.profile_role;
  norm_pin text;
  pick jsonb;
  enroll_pick jsonb;
BEGIN
  jwt_uid := auth.uid();
  IF jwt_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthorized');
  END IF;

  SELECT p.role
  INTO caller_role
  FROM public.profiles AS p
  WHERE p.id = auth.uid();

  IF caller_role IS DISTINCT FROM 'student'::public.profile_role THEN
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
      'sl', crs.slug,
      'ra', ch.requires_approval
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

  -- Не раскрываем, что PIN существует, если курс ещё не опубликован.
  IF (pick->>'st') IS DISTINCT FROM 'published' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  enroll_pick := (
    SELECT jsonb_build_array(e.course_id::text, e.cohort_id::text, e.status)
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

  IF enroll_pick IS NOT NULL AND (enroll_pick->>2) = 'suspended' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'suspended');
  END IF;

  IF enroll_pick IS NULL THEN
    INSERT INTO public.enrollments (user_id, course_id, cohort_id, status)
    SELECT
      auth.uid(),
      ch.course_id,
      ch.id,
      CASE
        WHEN ch.requires_approval THEN 'pending'
        ELSE 'active'
      END
    FROM public.cohorts AS ch
    INNER JOIN public.courses AS crs ON ch.course_id = crs.id
    WHERE ch.pin_code = upper(trim(both from coalesce(p_pin, '')))
      AND ch.is_active = true
    LIMIT 1;

    IF (pick->>'ra') = 'true' THEN
      RETURN jsonb_build_object('ok', true, 'code', 'pending_approval');
    END IF;

    RETURN jsonb_build_object('ok', true, 'slug', pick->>'sl');
  END IF;

  IF (enroll_pick->>1) IS NOT DISTINCT FROM (pick->>'cid') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_same');
  END IF;

  IF enroll_pick->>1 IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_other_cohort');
  END IF;

  UPDATE public.enrollments AS e
  SET
    cohort_id = src.cohort_id,
    status = src.enroll_status
  FROM (
    SELECT
      ch.id AS cohort_id,
      ch.course_id,
      CASE
        WHEN ch.requires_approval THEN 'pending'
        ELSE 'active'
      END AS enroll_status
    FROM public.cohorts AS ch
    INNER JOIN public.courses AS crs ON ch.course_id = crs.id
    WHERE ch.pin_code = upper(trim(both from coalesce(p_pin, '')))
      AND ch.is_active = true
    LIMIT 1
  ) AS src
  WHERE e.user_id = auth.uid()
    AND e.course_id = src.course_id
    AND e.cohort_id IS NULL
    AND e.status IS DISTINCT FROM 'suspended';

  IF (pick->>'ra') = 'true' THEN
    RETURN jsonb_build_object('ok', true, 'code', 'pending_approval');
  END IF;

  RETURN jsonb_build_object('ok', true, 'slug', pick->>'sl');
END;
$_$;

COMMENT ON FUNCTION "public"."join_cohort_by_pin"("p_pin" "text") IS
  'Запись ученика в группу по PIN. Только role=student. requires_approval → pending_approval. suspended блокирует вход. Неопубликованный курс возвращает not_found.';
