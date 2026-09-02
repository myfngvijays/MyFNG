-- Per-customer override for membership claim buttons in the app.
-- AUTO = existing unlock rules (after first completed service).
-- SHOW = always show claim buttons (booking glitch / admin force).
-- HIDE = hide claim buttons even if unlocked.

ALTER TABLE public.customer_memberships
  ADD COLUMN IF NOT EXISTS claims_button_override TEXT NOT NULL DEFAULT 'AUTO';

ALTER TABLE public.customer_memberships
  DROP CONSTRAINT IF EXISTS customer_memberships_claims_button_override_chk;

ALTER TABLE public.customer_memberships
  ADD CONSTRAINT customer_memberships_claims_button_override_chk
  CHECK (claims_button_override IN ('AUTO', 'SHOW', 'HIDE'));

COMMENT ON COLUMN public.customer_memberships.claims_button_override IS
  'Admin override for in-app membership claim buttons: AUTO, SHOW, or HIDE.';
