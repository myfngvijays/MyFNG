-- Plan header circle icon (top-right badge on membership value cards)

ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS header_icon VARCHAR(50),
  ADD COLUMN IF NOT EXISTS header_icon_url TEXT,
  ADD COLUMN IF NOT EXISTS header_icon_class TEXT;

COMMENT ON COLUMN public.membership_plans.header_icon IS 'Ionicons / MaterialCommunityIcons name for plan header badge';
COMMENT ON COLUMN public.membership_plans.header_icon_url IS 'Image URL for plan header badge (best for mobile)';
COMMENT ON COLUMN public.membership_plans.header_icon_class IS 'Flaticon CSS class for web admin preview';

UPDATE public.membership_plans
SET header_icon = 'lifebuoy'
WHERE membership_type = 'RSA'
  AND (header_icon IS NULL OR header_icon = '');

UPDATE public.membership_plans
SET header_icon = 'ribbon'
WHERE COALESCE(membership_type, 'SERVICE') = 'SERVICE'
  AND code = 'PRIME'
  AND (header_icon IS NULL OR header_icon = '');
