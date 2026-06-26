-- Separate visibility for mobile app vs website on membership T&C bullet points
ALTER TABLE public.membership_terms
  ADD COLUMN IF NOT EXISTS visible_app BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_web BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.membership_terms.visible_app IS 'Show this term on Android/iOS app';
COMMENT ON COLUMN public.membership_terms.visible_web IS 'Show this term on website (RSA landing etc.)';

UPDATE public.membership_terms
SET
  visible_app = COALESCE(active, TRUE),
  visible_web = COALESCE(active, TRUE)
WHERE TRUE;
