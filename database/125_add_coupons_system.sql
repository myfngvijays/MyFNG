-- ============================================================
-- 125: Coupons system (master + redemptions + lead/invoice meta)
-- Purpose:
--  - Add coupons master table for admin management
--  - Track redemptions for audit/reporting
--  - Store applied coupon snapshots on leads/invoices
-- ============================================================

BEGIN;

-- ============================================================
-- Coupons master table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL,
  coupon_kind VARCHAR(30) NOT NULL, -- TOTAL_DISCOUNT | FREE_SERVICE
  discount_mode VARCHAR(20), -- AMOUNT | PERCENT (only for TOTAL_DISCOUNT)
  discount_value NUMERIC(12,2),
  min_order_value NUMERIC(12,2),

  target_service_type_id UUID,
  target_subservice_id UUID,
  target_custom_label TEXT,

  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  usage_limit_total INTEGER,
  usage_limit_per_customer INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,

  applicable_city_ids JSONB,
  applicable_workshop_ids JSONB,
  applicable_service_type_ids JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT coupons_kind_chk CHECK (coupon_kind IN ('TOTAL_DISCOUNT', 'FREE_SERVICE')),
  CONSTRAINT coupons_discount_mode_chk CHECK (discount_mode IS NULL OR discount_mode IN ('AMOUNT', 'PERCENT'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_coupons_code_lower
  ON public.coupons (LOWER(code));

CREATE INDEX IF NOT EXISTS idx_coupons_active
  ON public.coupons (is_active);

-- ============================================================
-- Coupon redemptions audit table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  service_lead_id UUID REFERENCES public.service_leads(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  applied_by_role VARCHAR(30) NOT NULL, -- CUSTOMER | TELECALLER | BILLING | SUPER_ADMIN
  applied_by_user_id UUID REFERENCES public.users_login(id),
  discount_amount_applied NUMERIC(12,2) DEFAULT 0,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon
  ON public.coupon_redemptions (coupon_id);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_lead
  ON public.coupon_redemptions (service_lead_id);

-- ============================================================
-- Lead + Invoice snapshot metadata
-- ============================================================
ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS coupon_meta JSONB;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS coupon_meta JSONB;

-- ============================================================
-- Updated_at triggers (best-effort)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_coupons_updated_at ON public.coupons;
    CREATE TRIGGER trg_coupons_updated_at
      BEFORE UPDATE ON public.coupons
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Super Admin: full access to coupons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='coupons'
      AND policyname='Super admins can manage coupons'
  ) THEN
    CREATE POLICY "Super admins can manage coupons"
      ON public.coupons
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

-- Super Admin: full access to coupon_redemptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='coupon_redemptions'
      AND policyname='Super admins can manage coupon_redemptions'
  ) THEN
    CREATE POLICY "Super admins can manage coupon_redemptions"
      ON public.coupon_redemptions
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
  RAISE NOTICE '✅ 125 applied: coupons master + redemptions + coupon_meta columns';
END $$;
