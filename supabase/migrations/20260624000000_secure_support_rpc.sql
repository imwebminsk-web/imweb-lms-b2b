-- Phase 363: support RPC только через service_role (server actions + admin client).
-- Прямой вызов из браузера с JWT authenticated больше невозможен.

REVOKE EXECUTE ON FUNCTION public.mark_support_ticket_read(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_support_ticket_read(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_support_ticket_read(uuid, text) FROM anon;

REVOKE EXECUTE ON FUNCTION public.touch_support_ticket(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_support_ticket(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_support_ticket(uuid, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.mark_support_ticket_read(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_support_ticket(uuid, text) TO service_role;
