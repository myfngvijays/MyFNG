-- Prevent welcome bonus from auto-crediting again after admin clears wallet history.
ALTER TABLE public.wallet_accounts
  ADD COLUMN IF NOT EXISTS welcome_bonus_suppressed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.wallet_accounts.welcome_bonus_suppressed IS
  'When true, welcome bonus backfill is skipped for this customer.';
