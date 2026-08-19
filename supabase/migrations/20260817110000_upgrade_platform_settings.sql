-- Upgrade platform_settings for B2B white-labeling

ALTER TABLE platform_settings DROP COLUMN IF EXISTS footer_text;

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS socials_json jsonb DEFAULT '{}'::jsonb;

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS legal_info text;

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS hero_image_url text;

-- Migrate legacy contacts_json { phone, email, address } -> array shape
UPDATE platform_settings
SET contacts_json = jsonb_build_object(
  'phones',
  CASE
    WHEN contacts_json ? 'phones' THEN contacts_json->'phones'
    WHEN COALESCE(contacts_json->>'phone', '') <> '' THEN jsonb_build_array(contacts_json->>'phone')
    ELSE '[]'::jsonb
  END,
  'emails',
  CASE
    WHEN contacts_json ? 'emails' THEN contacts_json->'emails'
    WHEN COALESCE(contacts_json->>'email', '') <> '' THEN jsonb_build_array(contacts_json->>'email')
    ELSE '[]'::jsonb
  END,
  'addresses',
  CASE
    WHEN contacts_json ? 'addresses' THEN contacts_json->'addresses'
    WHEN COALESCE(contacts_json->>'address', '') <> '' THEN jsonb_build_array(contacts_json->>'address')
    ELSE '[]'::jsonb
  END
)
WHERE contacts_json IS NOT NULL;
