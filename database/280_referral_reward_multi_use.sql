-- Multi-use referral rewards (e.g. Free Pickup & Drop (3) + Free Brake Service)
ALTER TABLE referral_milestone_claims
  ADD COLUMN IF NOT EXISTS uses_total INTEGER,
  ADD COLUMN IF NOT EXISTS uses_remaining INTEGER,
  ADD COLUMN IF NOT EXISTS reward_components JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_used_lead_id UUID,
  ADD COLUMN IF NOT EXISTS membership_id UUID;

COMMENT ON COLUMN referral_milestone_claims.reward_components IS 'Per-benefit usage tracking: [{key,label,uses_total,uses_remaining}]';
COMMENT ON COLUMN referral_milestone_claims.membership_id IS 'Set when reward_type=membership and Prime/Elite activated on claim';
