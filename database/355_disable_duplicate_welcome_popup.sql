-- Home already shows the native WelcomeBonusGuestModal.
-- The 242 seed copied that same "Login to get ₹1,000" offer into app_popups,
-- so guests saw it again after tapping Maybe later.

BEGIN;

UPDATE public.app_popups
SET is_active = false,
    updated_at = now()
WHERE is_active = true
  AND show_for = 'GUEST_ONLY'
  AND primary_button_action = 'LOGIN'
  AND (
    title ILIKE 'Login to get%'
    OR COALESCE(body, '') ILIKE '%Welcome Bonus on your first login%'
  );

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '355 applied: deactivated duplicate guest welcome bonus app_popups';
END $$;
