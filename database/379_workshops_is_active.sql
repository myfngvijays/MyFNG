-- Workshop listing on/off (customer app, website locator, telecaller pincode).
-- Does not delete workshops. Default ON so existing rows stay visible.

ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.workshops.is_active IS
  'Show in customer app, website locator, and telecaller pincode lists. False hides without deleting.';

CREATE INDEX IF NOT EXISTS idx_workshops_is_active_listed
  ON public.workshops (id)
  WHERE is_active = true;

NOTIFY pgrst, 'reload schema';
