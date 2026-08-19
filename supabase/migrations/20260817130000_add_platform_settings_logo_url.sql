-- Ensure client logo URL column exists on platform_settings (idempotent)

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN platform_settings.logo_url IS 'Public URL of the organization logo for auth portal branding';
