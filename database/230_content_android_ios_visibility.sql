-- Split mobile app visibility into Android vs iOS (membership T&C + public FAQs)
ALTER TABLE public.membership_terms
  ADD COLUMN IF NOT EXISTS visible_android BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_ios BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.public_faqs
  ADD COLUMN IF NOT EXISTS visible_android BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_ios BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.membership_terms.visible_android IS 'Show this term on Android app';
COMMENT ON COLUMN public.membership_terms.visible_ios IS 'Show this term on iOS app';
COMMENT ON COLUMN public.public_faqs.visible_android IS 'Show this FAQ on Android app';
COMMENT ON COLUMN public.public_faqs.visible_ios IS 'Show this FAQ on iOS app';

UPDATE public.membership_terms
SET
  visible_android = COALESCE(visible_app, active, TRUE),
  visible_ios = COALESCE(visible_app, active, TRUE)
WHERE TRUE;

UPDATE public.public_faqs
SET
  visible_android = COALESCE(visible_app, active, TRUE),
  visible_ios = COALESCE(visible_app, active, TRUE)
WHERE TRUE;

-- Keep legacy visible_app in sync for older clients
UPDATE public.membership_terms
SET visible_app = (visible_android OR visible_ios)
WHERE TRUE;

UPDATE public.public_faqs
SET visible_app = (visible_android OR visible_ios)
WHERE TRUE;
