-- Create platform_settings table
CREATE TABLE platform_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_name text NOT NULL,
  short_description text,
  logo_url text,
  contacts_json jsonb,
  footer_text text,
  -- Enforce single row
  is_singleton boolean DEFAULT true UNIQUE CHECK (is_singleton)
);

-- Insert default row
INSERT INTO platform_settings (
  platform_name,
  short_description,
  logo_url,
  contacts_json,
  footer_text
) VALUES (
  'My Platform',
  'Удобная LMS для вашего бизнеса',
  NULL,
  '{"phone": "+123456789", "email": "info@example.com", "address": "Минск, ул. Примерная"}',
  '© 2026 Все права защищены'
);

-- Enable RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for all (including anonymous)
CREATE POLICY "Allow SELECT for all" ON platform_settings
  FOR SELECT
  USING (true);

-- Allow UPDATE for admins only (we can use the existing isAdmin function if any, or just restrict to service_role)
-- The prompt says "allow UPDATE for admins only via service role".
-- So we don't need an explicit UPDATE policy for authenticated users if we use service_role from the server action.
-- But just in case, let's create a policy that allows nothing for normal users, so only service_role can update.
CREATE POLICY "Allow UPDATE for service role only" ON platform_settings
  FOR UPDATE
  USING (false);
