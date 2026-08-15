-- 1. Update the profile_role enum to include 'head_teacher'
ALTER TYPE public.profile_role ADD VALUE IF NOT EXISTS 'head_teacher';
