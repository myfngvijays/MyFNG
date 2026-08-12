-- WELCOME_CI1000: remove fixed coupon end_at.
-- Per-user 3-month expiry lives on customer_coupon_assignments.expires_at
-- (set at login/assign from welcome_expiry_days, default 90).

UPDATE public.coupons
SET
  end_at = NULL,
  updated_at = now()
WHERE LOWER(code) = LOWER('WELCOME_CI1000');
