-- Wallet welcome bonus: ₹1000 on first app login, 90-day expiry
UPDATE public.wallet_rules
SET
  title = 'Welcome Bonus',
  description = '₹1000 welcome bonus for new app install and login',
  credit_amount = 1000,
  min_order_amount = 0,
  expires_in_days = 90,
  active = TRUE
WHERE code = 'WELCOME_100';

INSERT INTO public.wallet_rules (code, title, description, credit_amount, min_order_amount, expires_in_days, active)
VALUES
  ('WELCOME_1000', 'Welcome Bonus', '₹1000 welcome bonus for new app install and login', 1000, 0, 90, TRUE)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  credit_amount = EXCLUDED.credit_amount,
  expires_in_days = EXCLUDED.expires_in_days,
  active = EXCLUDED.active;
