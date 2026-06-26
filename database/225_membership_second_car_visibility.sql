-- Per-plan control for 2nd Car Add-On on website vs mobile app
ALTER TABLE membership_plans
  ADD COLUMN IF NOT EXISTS show_second_car_addon_web BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS show_second_car_addon_app BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN membership_plans.show_second_car_addon_web IS 'Show 2nd car add-on checkbox on website membership value cards';
COMMENT ON COLUMN membership_plans.show_second_car_addon_app IS 'Show 2nd car add-on on mobile app membership value cards';

-- RSA plans: hidden on website by default (website RSA page does not show add-on)
UPDATE membership_plans
SET
  show_second_car_addon_web = FALSE,
  show_second_car_addon_app = COALESCE(show_second_car_addon_app, TRUE)
WHERE UPPER(COALESCE(membership_type, 'SERVICE')) = 'RSA';
