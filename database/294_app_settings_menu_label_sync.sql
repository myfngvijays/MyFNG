-- Sync App Settings Menu labels with mobile Settings screen names

UPDATE public.app_settings_menu
SET label = 'FNG Wallet', updated_at = now()
WHERE menu_id = 'wallet' AND label IS DISTINCT FROM 'FNG Wallet';

UPDATE public.app_settings_menu
SET label = 'Offers & Coupons', updated_at = now()
WHERE menu_id = 'coupons' AND label IS DISTINCT FROM 'Offers & Coupons';

UPDATE public.app_settings_menu
SET label = 'Refer & Rise', icon = 'trophy', updated_at = now()
WHERE menu_id = 'referral'
  AND (label IS DISTINCT FROM 'Refer & Rise' OR icon IS DISTINCT FROM 'trophy');

INSERT INTO public.app_settings_menu (menu_id, label, icon, section, enabled, display_order, requires_login)
VALUES ('referral_rewards', 'Referral Rewards', 'gift-outline', 'main', true, 9, true)
ON CONFLICT (menu_id) DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  updated_at = now();

UPDATE public.app_settings_menu
SET display_order = 10, updated_at = now()
WHERE menu_id = 'notifications' AND display_order IS DISTINCT FROM 10;
