-- ============================================================
-- 156: Coupon management enhancements (campaigns, channels, audit)
-- Run after 125_add_coupons_system.sql
-- ============================================================

BEGIN;

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS campaign_name TEXT,
  ADD COLUMN IF NOT EXISTS applicable_channels JSONB DEFAULT '["ALL"]'::jsonb,
  ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS first_order_only BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS batch_id UUID,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.coupon_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_name TEXT NOT NULL,
  code_prefix TEXT,
  code_count INTEGER NOT NULL DEFAULT 0,
  coupon_kind VARCHAR(30) NOT NULL,
  discount_mode VARCHAR(20),
  discount_value NUMERIC(12,2),
  min_order_value NUMERIC(12,2),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  usage_limit_total INTEGER,
  usage_limit_per_customer INTEGER,
  applicable_channels JSONB DEFAULT '["ALL"]'::jsonb,
  applicable_city_ids JSONB,
  applicable_workshop_ids JSONB,
  applicable_service_type_ids JSONB,
  max_discount_amount NUMERIC(12,2),
  first_order_only BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupons_batch_id ON public.coupons (batch_id);
CREATE INDEX IF NOT EXISTS idx_coupons_campaign_name ON public.coupons (campaign_name);
CREATE INDEX IF NOT EXISTS idx_coupon_batches_created_at ON public.coupon_batches (created_at DESC);

CREATE TABLE IF NOT EXISTS public.coupon_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES public.coupon_batches(id) ON DELETE SET NULL,
  action VARCHAR(40) NOT NULL,
  actor_user_id UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupon_audit_log_coupon ON public.coupon_audit_log (coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_audit_log_created_at ON public.coupon_audit_log (created_at DESC);

ALTER TABLE public.coupon_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coupon_batches'
      AND policyname = 'Super admins can manage coupon_batches'
  ) THEN
    CREATE POLICY "Super admins can manage coupon_batches"
      ON public.coupon_batches FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coupon_audit_log'
      AND policyname = 'Super admins can manage coupon_audit_log'
  ) THEN
    CREATE POLICY "Super admins can manage coupon_audit_log"
      ON public.coupon_audit_log FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users_login ul
          JOIN roles r ON ul.role_id = r.id
          WHERE ul.id = auth.uid() AND r.role_code = 'SUPER_ADMIN'
        )
      );
  END IF;
END $$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ 156 applied: coupon campaigns, channels, batches, audit log';
END $$;
