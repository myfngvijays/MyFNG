-- ============================================================
-- 119_create_razorpay_direct_pay_rsa.sql
-- Purpose: Store Pay Now (direct) Razorpay payments
-- ============================================================

BEGIN;

-- Rename old table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Razorpay Direct pay RSA'
  ) THEN
    ALTER TABLE public."Razorpay Direct pay RSA" RENAME TO "Razorpay_Direct_pay_RSA";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."Razorpay_Direct_pay_RSA" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT NOT NULL UNIQUE,
  payment_id TEXT,
  signature TEXT,
  amount NUMERIC(12,2) NOT NULL,
  amount_paise INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(20) NOT NULL DEFAULT 'CREATED', -- CREATED | SUCCESS | FAILED

  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(160),
  customer_phone VARCHAR(20) NOT NULL,

  notes JSONB DEFAULT '{}'::jsonb,
  razorpay_payload JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_direct_pay_status
  ON public."Razorpay_Direct_pay_RSA"(status);
CREATE INDEX IF NOT EXISTS idx_direct_pay_created_at
  ON public."Razorpay_Direct_pay_RSA"(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_pay_customer_phone
  ON public."Razorpay_Direct_pay_RSA"(customer_phone);

-- Updated_at trigger (best-effort)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_direct_pay_updated_at ON public."Razorpay_Direct_pay_RSA";
    CREATE TRIGGER trg_direct_pay_updated_at
      BEFORE UPDATE ON public."Razorpay_Direct_pay_RSA"
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE public."Razorpay_Direct_pay_RSA" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='Razorpay_Direct_pay_RSA'
      AND policyname='Super admins can manage direct pay'
  ) THEN
    CREATE POLICY "Super admins can manage direct pay"
      ON public."Razorpay_Direct_pay_RSA"
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code = 'SUPER_ADMIN'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid()
          AND r.role_code = 'SUPER_ADMIN'
        )
      );
  END IF;
END $$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ Razorpay Direct pay RSA table created/updated successfully!';
END $$;

