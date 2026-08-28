-- Legal document bodies for public /privacy, /terms, and /offer pages.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS privacy_policy text,
  ADD COLUMN IF NOT EXISTS user_agreement text,
  ADD COLUMN IF NOT EXISTS public_offer text;

COMMENT ON COLUMN public.platform_settings.privacy_policy IS 'Политика конфиденциальности (Markdown), страница /privacy';
COMMENT ON COLUMN public.platform_settings.user_agreement IS 'Пользовательское соглашение (Markdown), страница /terms';
COMMENT ON COLUMN public.platform_settings.public_offer IS 'Публичная оферта (Markdown), страница /offer';
