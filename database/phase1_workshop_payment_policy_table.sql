-- ============================================
-- PHASE 1.3: WORKSHOP PAYMENT POLICY TABLE
-- Purpose: Define payment methods allowed per workshop
-- Date: November 26, 2025
-- ============================================

CREATE TABLE IF NOT EXISTS workshop_payment_policy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Workshop Reference
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  
  -- Payment Methods Configuration
  allow_online_payment BOOLEAN DEFAULT true,
  allow_cash BOOLEAN DEFAULT true,
  allow_pos BOOLEAN DEFAULT true,
  allow_cod BOOLEAN DEFAULT false,
  allow_credit BOOLEAN DEFAULT false,
  allow_partial_payment BOOLEAN DEFAULT false,
  
  -- Online Payment Methods
  allowed_online_methods JSONB DEFAULT '["UPI", "CARD", "NETBANKING", "WALLET"]'::jsonb,
  
  -- Customer Type Rules
  corporate_allowed_methods JSONB DEFAULT '["UPI", "CARD", "NETBANKING", "CREDIT"]'::jsonb,
  retail_allowed_methods JSONB DEFAULT '["UPI", "CARD", "WALLET", "CASH", "POS"]'::jsonb,
  
  -- Limits & Rules
  min_online_amount DECIMAL(10,2) DEFAULT 0,
  max_cash_amount DECIMAL(10,2) DEFAULT 50000.00,
  cod_max_amount DECIMAL(10,2) DEFAULT 0,
  cod_allowed_days INTEGER DEFAULT 0,
  
  -- Split Payment
  allow_split_payment BOOLEAN DEFAULT false,
  max_split_count INTEGER DEFAULT 1,
  
  -- QR Code Settings
  generate_qr_code BOOLEAN DEFAULT true,
  qr_code_provider VARCHAR(50) DEFAULT 'RAZORPAY', -- RAZORPAY, PHONEPE, PAYTM
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users_login(id),
  updated_by UUID REFERENCES users_login(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workshop_payment_policy_workshop_id ON workshop_payment_policy(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_payment_policy_active ON workshop_payment_policy(is_active);

-- Comments
COMMENT ON TABLE workshop_payment_policy IS 'Payment policy configuration per workshop';
COMMENT ON COLUMN workshop_payment_policy.corporate_allowed_methods IS 'Payment methods allowed for corporate/B2B customers';
COMMENT ON COLUMN workshop_payment_policy.retail_allowed_methods IS 'Payment methods allowed for retail customers';

