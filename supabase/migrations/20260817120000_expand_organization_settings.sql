-- Expand organization branding: rename platform_name, restructure socials_json

ALTER TABLE platform_settings
  RENAME COLUMN platform_name TO organization_name;

-- Migrate flat socials_json { vk, telegram, instagram, ... } -> nested shape
UPDATE platform_settings
SET socials_json = jsonb_build_object(
  'socials',
  jsonb_build_object(
    'vk', COALESCE(socials_json->>'vk', ''),
    'ok', COALESCE(socials_json->'socials'->>'ok', ''),
    'instagram', COALESCE(socials_json->>'instagram', socials_json->'socials'->>'instagram', ''),
    'youtube', COALESCE(socials_json->'socials'->>'youtube', ''),
    'facebook', COALESCE(socials_json->'socials'->>'facebook', ''),
    'twitter', COALESCE(socials_json->'socials'->>'twitter', '')
  ),
  'messengers',
  jsonb_build_object(
    'telegram', COALESCE(socials_json->>'telegram', socials_json->'messengers'->>'telegram', ''),
    'whatsapp', COALESCE(socials_json->'messengers'->>'whatsapp', ''),
    'viber', COALESCE(socials_json->'messengers'->>'viber', '')
  )
)
WHERE socials_json IS NOT NULL
  AND NOT (
    socials_json ? 'socials'
    AND socials_json ? 'messengers'
  );

ALTER TABLE platform_settings
  ALTER COLUMN socials_json SET DEFAULT jsonb_build_object(
    'socials',
    jsonb_build_object(
      'vk', '',
      'ok', '',
      'instagram', '',
      'youtube', '',
      'facebook', '',
      'twitter', ''
    ),
    'messengers',
    jsonb_build_object(
      'telegram', '',
      'whatsapp', '',
      'viber', ''
    )
  );
