-- Customer account status for admin deactivate / ban
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS account_status_reason TEXT,
  ADD COLUMN IF NOT EXISTS account_status_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_status_changed_by UUID;

COMMENT ON COLUMN public.customers.account_status IS 'ACTIVE, DEACTIVATED, or BANNED';

CREATE INDEX IF NOT EXISTS idx_customers_account_status ON public.customers(account_status);

UPDATE public.customers
SET account_status = CASE
  WHEN is_active = FALSE THEN 'DEACTIVATED'
  ELSE 'ACTIVE'
END
WHERE account_status IS NULL OR account_status = '';
