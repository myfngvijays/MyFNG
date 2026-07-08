-- Refer & Rise: Milestone Claims Table
-- Run this in Supabase SQL Editor to create the milestone claims tracking table.

CREATE TABLE IF NOT EXISTS referral_milestone_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  milestone_count INTEGER NOT NULL,
  chosen_family TEXT NOT NULL,
  reward_text TEXT DEFAULT '',
  status TEXT DEFAULT 'CLAIMED' CHECK (status IN ('CLAIMED', 'DELIVERED', 'CANCELLED')),
  claimed_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(customer_id, milestone_count)
);

CREATE INDEX idx_milestone_claims_customer ON referral_milestone_claims(customer_id);
CREATE INDEX idx_milestone_claims_status ON referral_milestone_claims(status);

-- Enable RLS
ALTER TABLE referral_milestone_claims ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON referral_milestone_claims
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE referral_milestone_claims IS 'Tracks reward selections at each Refer & Rise milestone';
