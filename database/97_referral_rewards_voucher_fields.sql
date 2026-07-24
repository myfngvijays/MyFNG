-- Referral milestone claims: voucher metadata + wallet exclusion flag
ALTER TABLE referral_milestone_claims
  ADD COLUMN IF NOT EXISTS reward_type TEXT DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS voucher_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS blocks_wallet BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS redeemed_lead_id UUID;

COMMENT ON COLUMN referral_milestone_claims.reward_type IS 'voucher | discount | service | membership | benefit';
COMMENT ON COLUMN referral_milestone_claims.blocks_wallet IS 'When true, this reward cannot be combined with wallet balance on the same booking';

-- New settings menu item: Referral Rewards (claim screen)
INSERT INTO public.app_settings_menu (menu_id, label, icon, section, enabled, display_order, requires_login)
VALUES ('referral_rewards', 'Referral Rewards', 'gift-outline', 'main', true, 9, true)
ON CONFLICT (menu_id) DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  enabled = EXCLUDED.enabled,
  display_order = EXCLUDED.display_order,
  requires_login = EXCLUDED.requires_login,
  updated_at = now();

-- Bump notifications down
UPDATE public.app_settings_menu SET display_order = 10 WHERE menu_id = 'notifications';
