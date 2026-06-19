-- ============================================================
-- 157: Advanced coupon engine — atomic redemption + customer assignments
-- Run after 156_coupon_management_enhancements.sql
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_coupon_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  notes TEXT,
  expires_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_customer_coupon_assignment UNIQUE (customer_id, coupon_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_coupon_assignments_customer
  ON public.customer_coupon_assignments (customer_id);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_idempotency
  ON public.coupon_redemptions ((meta->>'idempotency_key'))
  WHERE (meta->>'idempotency_key') IS NOT NULL;

ALTER TABLE public.customer_coupon_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customer_coupon_assignments'
      AND policyname = 'Super admins manage customer_coupon_assignments'
  ) THEN
    CREATE POLICY "Super admins manage customer_coupon_assignments"
      ON public.customer_coupon_assignments FOR ALL
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

CREATE OR REPLACE FUNCTION public.redeem_coupon_atomic(
  p_coupon_id UUID,
  p_customer_phone TEXT DEFAULT NULL,
  p_discount_amount NUMERIC DEFAULT 0,
  p_applied_by_role TEXT DEFAULT 'CUSTOMER',
  p_applied_by_user_id UUID DEFAULT NULL,
  p_service_lead_id UUID DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL,
  p_meta JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon coupons%ROWTYPE;
  v_total_count INTEGER;
  v_customer_count INTEGER;
  v_phone TEXT;
  v_redemption_id UUID;
  v_meta JSONB;
BEGIN
  IF p_coupon_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'coupon_id is required');
  END IF;

  SELECT * INTO v_coupon FROM coupons WHERE id = p_coupon_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Coupon not found');
  END IF;

  IF NOT COALESCE(v_coupon.is_active, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Coupon is inactive');
  END IF;

  v_phone := RIGHT(regexp_replace(COALESCE(p_customer_phone, ''), '[^0-9]', '', 'g'), 10);

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    IF EXISTS (
      SELECT 1 FROM coupon_redemptions
      WHERE meta->>'idempotency_key' = p_idempotency_key
    ) THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true);
    END IF;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_total_count
  FROM coupon_redemptions
  WHERE coupon_id = p_coupon_id;

  IF v_coupon.usage_limit_total IS NOT NULL AND v_total_count >= v_coupon.usage_limit_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'Coupon usage limit reached');
  END IF;

  IF v_coupon.usage_limit_per_customer IS NOT NULL AND v_phone <> '' THEN
    SELECT COUNT(*)::INTEGER INTO v_customer_count
    FROM coupon_redemptions
    WHERE coupon_id = p_coupon_id
      AND meta->>'customer_phone' = v_phone;

    IF v_customer_count >= v_coupon.usage_limit_per_customer THEN
      RETURN jsonb_build_object('success', false, 'error', 'Coupon already used by customer');
    END IF;
  END IF;

  v_meta := COALESCE(p_meta, '{}'::jsonb);
  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    v_meta := v_meta || jsonb_build_object('idempotency_key', p_idempotency_key);
  END IF;
  IF v_phone <> '' THEN
    v_meta := v_meta || jsonb_build_object('customer_phone', v_phone);
  END IF;

  INSERT INTO coupon_redemptions (
    coupon_id,
    service_lead_id,
    invoice_id,
    applied_by_role,
    applied_by_user_id,
    discount_amount_applied,
    meta
  ) VALUES (
    p_coupon_id,
    p_service_lead_id,
    p_invoice_id,
    COALESCE(NULLIF(btrim(p_applied_by_role), ''), 'CUSTOMER'),
    p_applied_by_user_id,
    COALESCE(p_discount_amount, 0),
    v_meta
  )
  RETURNING id INTO v_redemption_id;

  IF v_phone <> '' THEN
    UPDATE customer_coupon_assignments
    SET redeemed_at = COALESCE(redeemed_at, now())
    WHERE coupon_id = p_coupon_id
      AND customer_id IN (
        SELECT id FROM customers WHERE RIGHT(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = v_phone
      );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'total_redemptions', v_total_count + 1
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ 157 applied: atomic coupon redemption + customer assignments';
END $$;
