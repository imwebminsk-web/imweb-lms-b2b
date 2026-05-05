-- Phase 33: запись по PIN (SECURITY DEFINER RPC)

GRANT INSERT, UPDATE ON public.enrollments TO authenticated;

-- Удаляем старые политики, если они были (защита от конфликтов)
DROP POLICY IF EXISTS enrollments_insert_own ON public.enrollments;
DROP POLICY IF EXISTS enrollments_update_own ON public.enrollments;

CREATE POLICY enrollments_insert_own
ON public.enrollments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY enrollments_update_own
ON public.enrollments FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Сносим старую функцию перед обновлением
DROP FUNCTION IF EXISTS public.join_cohort_by_pin(text);

CREATE OR REPLACE FUNCTION public.join_cohort_by_pin(p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.join_cohort_by_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_cohort_by_pin(text) TO authenticated;

COMMENT ON FUNCTION public.join_cohort_by_pin(text) IS
  'Запись пользователя в группу по PIN-коду.';
