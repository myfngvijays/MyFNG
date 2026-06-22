-- Text color on accent backgrounds (header, price hero, CTA buttons)
-- Run in Supabase SQL editor after membership_plans.accent_color exists.

ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS accent_text_color VARCHAR(20);

COMMENT ON COLUMN public.membership_plans.accent_text_color IS
  'Hex text color on accent backgrounds. App defaults to #FFFFFF when null.';
