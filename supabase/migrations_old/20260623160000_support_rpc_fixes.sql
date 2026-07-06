-- Phase 349: RPC для обновления флагов непрочитанных без UPDATE-политики для студентов.

CREATE OR REPLACE FUNCTION public.mark_support_ticket_read(p_ticket_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.touch_support_ticket(p_ticket_id uuid, p_sender_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.mark_support_ticket_read(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.touch_support_ticket(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.mark_support_ticket_read IS
  'Сбрасывает флаг непрочитанного для ученика или преподавателя (SECURITY DEFINER).';

COMMENT ON FUNCTION public.touch_support_ticket IS
  'Обновляет updated_at и флаги непрочитанных при новом сообщении (SECURITY DEFINER).';
