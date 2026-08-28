-- Soft-delete flag for profiles: false = deactivated, cannot log in.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;
