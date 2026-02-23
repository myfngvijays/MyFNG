-- ============================================
-- Customer profile & auth (Firebase OTP + session)
-- Tables: customers, customer_sessions
-- ============================================

-- Customers: app users identified by phone (Firebase UID or phone)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) NOT NULL,
  firebase_uid VARCHAR(128) UNIQUE,
  email VARCHAR(255),
  full_name VARCHAR(255),
  profile_image TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT customers_phone_unique UNIQUE (phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_firebase_uid ON customers(firebase_uid);

-- Customer sessions: cookie-based session after Firebase OTP verify
CREATE TABLE IF NOT EXISTS public.customer_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_customer_sessions_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_token ON customer_sessions(token);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_id ON customer_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires_at ON customer_sessions(expires_at);

-- Allow existing code that expects customers.id = auth user id (Supabase)
-- New flow: customers.id is our UUID; link to Supabase auth optional later
COMMENT ON TABLE public.customers IS 'Customer accounts; phone primary, optional Firebase UID and Supabase link';
COMMENT ON TABLE public.customer_sessions IS 'Session tokens for customer after Firebase OTP verify';
