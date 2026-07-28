-- Dedupe log for automatic welcome-bonus expiry push reminders.
-- reminder_key: d15 (once at 15 days left), d7..d0 (daily in last 7 days + expiry day)

CREATE TABLE IF NOT EXISTS public.wallet_expiry_push_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  credit_txn_id UUID NOT NULL,
  reminder_key TEXT NOT NULL,
  amount NUMERIC(12, 2),
  expires_at TIMESTAMPTZ,
  delivered INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wallet_expiry_push_sent_unique UNIQUE (credit_txn_id, reminder_key)
);

CREATE INDEX IF NOT EXISTS idx_wallet_expiry_push_sent_customer
  ON public.wallet_expiry_push_sent (customer_id, created_at DESC);

-- Speeds daily cron scan for WELCOME_BONUS credits by expires_at window
CREATE INDEX IF NOT EXISTS idx_wallet_tx_welcome_expires
  ON public.wallet_transactions (expires_at)
  WHERE transaction_type = 'CREDIT' AND source = 'WELCOME_BONUS' AND expires_at IS NOT NULL;

COMMENT ON TABLE public.wallet_expiry_push_sent IS
  'Tracks welcome-bonus expiry push sends so d15 is once and d7–d0 are once per day.';
