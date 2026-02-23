-- ============================================
-- Customer profile modules (wallet, referral, cart, vehicles, membership, preferences)
-- Safe: idempotent
-- ============================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- OTP audit trail for customer auth
CREATE TABLE IF NOT EXISTS public.otp_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) NOT NULL,
  channel VARCHAR(20) DEFAULT 'SMS',
  provider VARCHAR(50) DEFAULT 'FIREBASE',
  status VARCHAR(30) NOT NULL, -- SENT, VERIFIED, FAILED, EXPIRED
  ip_address VARCHAR(64),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_requests_phone_created ON public.otp_requests(phone, created_at DESC);

-- Optional profile details split from customers
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  gender VARCHAR(20),
  dob DATE,
  alt_phone VARCHAR(20),
  default_vehicle_id UUID,
  default_address_id UUID,
  loyalty_tier VARCHAR(20) DEFAULT 'BRONZE',
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label VARCHAR(50) DEFAULT 'Home',
  line1 TEXT NOT NULL,
  line2 TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(20),
  latitude NUMERIC,
  longitude NUMERIC,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON public.customer_addresses(customer_id);

-- Wallet
CREATE TABLE IF NOT EXISTS public.wallet_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  lifetime_credited NUMERIC(12,2) NOT NULL DEFAULT 0,
  lifetime_debited NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wallet_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  credit_amount NUMERIC(12,2) DEFAULT 0,
  min_order_amount NUMERIC(12,2) DEFAULT 0,
  expires_in_days INTEGER,
  active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.wallet_rules (code, title, description, credit_amount, min_order_amount, expires_in_days, active)
VALUES
  ('WELCOME_100', 'Welcome Bonus', 'New customer welcome bonus', 100, 0, 90, TRUE),
  ('REFERRAL_REWARD', 'Referral Reward', 'Reward for successful referral', 150, 0, 180, TRUE),
  ('OFFER_CASHBACK', 'Offer Cashback', 'Campaign cashback credits', 0, 0, 60, TRUE)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_account_id UUID NOT NULL REFERENCES public.wallet_accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL, -- CREDIT, DEBIT, HOLD, RELEASE, EXPIRE
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(12,2) NOT NULL,
  source VARCHAR(50) NOT NULL, -- OFFER, REFERRAL, ORDER_REDEEM, MANUAL_ADMIN, MEMBERSHIP
  source_ref_id UUID,
  idempotency_key VARCHAR(120),
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT wallet_transactions_idempotency_unique UNIQUE (customer_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_customer_created ON public.wallet_transactions(customer_id, created_at DESC);

-- Referral
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,
  active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  max_usage INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referral_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  referee_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING, QUALIFIED, REWARDED, REJECTED
  first_order_lead_id UUID REFERENCES public.service_leads(id) ON DELETE SET NULL,
  anti_fraud_flags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT referral_unique_pair UNIQUE (referrer_customer_id, referee_customer_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON public.referral_events(referrer_customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_event_id UUID NOT NULL REFERENCES public.referral_events(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  reward_type VARCHAR(20) NOT NULL DEFAULT 'WALLET_CREDIT',
  reward_amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, CREDITED, REVERSED
  wallet_transaction_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification preferences (customer specific)
CREATE TABLE IF NOT EXISTS public.customer_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  push_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT TRUE,
  order_updates BOOLEAN DEFAULT TRUE,
  offers BOOLEAN DEFAULT TRUE,
  wallet_credits BOOLEAN DEFAULT TRUE,
  referral_updates BOOLEAN DEFAULT TRUE,
  support_updates BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cart
CREATE TABLE IF NOT EXISTS public.carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, CHECKED_OUT, ABANDONED
  vehicle_id UUID,
  coupon_code VARCHAR(50),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  wallet_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  item_type VARCHAR(30) NOT NULL DEFAULT 'SERVICE',
  service_type VARCHAR(120) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON public.cart_items(cart_id);

-- Vehicle management
CREATE TABLE IF NOT EXISTS public.customer_vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  vehicle_number VARCHAR(30) NOT NULL,
  make VARCHAR(100),
  model VARCHAR(100),
  year INTEGER,
  variant VARCHAR(100),
  fuel_type VARCHAR(30),
  vin VARCHAR(60),
  odometer_km INTEGER,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_vehicle_per_customer UNIQUE (customer_id, vehicle_number)
);
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_customer ON public.customer_vehicles(customer_id, updated_at DESC);

-- Membership
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 365,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.membership_plans (code, name, description, price, duration_days, active)
VALUES
  ('BRONZE', 'Bronze', 'Starter membership', 499, 365, TRUE),
  ('SILVER', 'Silver', 'Priority support and wallet cashback boost', 1499, 365, TRUE),
  ('GOLD', 'Gold', 'Highest priority support and premium benefits', 2999, 365, TRUE)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.membership_benefits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES public.membership_plans(id) ON DELETE CASCADE,
  benefit_code VARCHAR(50) NOT NULL,
  title VARCHAR(120) NOT NULL,
  value NUMERIC(12,2),
  max_usage INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.membership_plans(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, CANCELLED
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  auto_renew BOOLEAN DEFAULT FALSE,
  source VARCHAR(30) DEFAULT 'PURCHASE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_memberships_customer ON public.customer_memberships(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.membership_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_membership_id UUID NOT NULL REFERENCES public.customer_memberships(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  benefit_code VARCHAR(50) NOT NULL,
  used_value NUMERIC(12,2),
  reference_type VARCHAR(50),
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics + feature flags + monitoring
CREATE TABLE IF NOT EXISTS public.customer_analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID,
  event_name VARCHAR(120) NOT NULL,
  event_group VARCHAR(60),
  properties JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_events_customer_created ON public.customer_analytics_events(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flag_key VARCHAR(80) NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT FALSE,
  rollout_percent INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.feature_flags (flag_key, enabled, rollout_percent, config)
VALUES
  ('customer_wallet', TRUE, 100, '{}'::jsonb),
  ('customer_referral', TRUE, 100, '{}'::jsonb),
  ('customer_membership', TRUE, 100, '{}'::jsonb),
  ('customer_cart', TRUE, 100, '{}'::jsonb)
ON CONFLICT (flag_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.customer_monitoring_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level VARCHAR(20) NOT NULL DEFAULT 'INFO',
  module VARCHAR(80) NOT NULL,
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMIT;

