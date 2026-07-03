-- ============================================================
-- 239: Allow coupon assignment to unregistered phone numbers
-- Adds pending_phone column, makes customer_id nullable,
-- and adds resolution function for when customers register.
-- ============================================================

BEGIN;

-- 1. Add pending_phone column for pre-registration assignments
ALTER TABLE public.customer_coupon_assignments
  ADD COLUMN IF NOT EXISTS pending_phone TEXT;

-- 2. Make customer_id nullable (was NOT NULL)
ALTER TABLE public.customer_coupon_assignments
  ALTER COLUMN customer_id DROP NOT NULL;

-- 3. Ensure at least one identifier is present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_customer_or_phone'
      AND conrelid = 'public.customer_coupon_assignments'::regclass
  ) THEN
    ALTER TABLE public.customer_coupon_assignments
      ADD CONSTRAINT chk_customer_or_phone
      CHECK (customer_id IS NOT NULL OR pending_phone IS NOT NULL);
  END IF;
END $$;

-- 4. Unique constraint for phone-based (pending) assignments
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_phone_coupon
  ON public.customer_coupon_assignments (pending_phone, coupon_id)
  WHERE pending_phone IS NOT NULL AND customer_id IS NULL;

-- 5. Index for fast lookup by pending_phone
CREATE INDEX IF NOT EXISTS idx_cca_pending_phone
  ON public.customer_coupon_assignments (pending_phone)
  WHERE pending_phone IS NOT NULL;

-- 6. Function to resolve pending assignments when a customer registers/logs in
CREATE OR REPLACE FUNCTION public.resolve_pending_coupon_assignments(
  p_customer_id UUID,
  p_phone TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_resolved INTEGER := 0;
BEGIN
  v_phone := RIGHT(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), 10);
  IF v_phone = '' OR length(v_phone) < 10 THEN
    RETURN 0;
  END IF;

  -- Link pending assignments to the now-registered customer
  WITH resolved AS (
    UPDATE customer_coupon_assignments
    SET customer_id = p_customer_id,
        pending_phone = NULL
    WHERE pending_phone = v_phone
      AND customer_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM customer_coupon_assignments existing
        WHERE existing.customer_id = p_customer_id
          AND existing.coupon_id = customer_coupon_assignments.coupon_id
      )
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_resolved FROM resolved;

  -- Delete any leftover duplicates that couldn't be resolved
  DELETE FROM customer_coupon_assignments
  WHERE pending_phone = v_phone
    AND customer_id IS NULL;

  RETURN v_resolved;
END;
$$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ 239 applied: coupon pending phone assignments support';
END $$;
