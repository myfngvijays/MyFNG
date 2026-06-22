-- Track whether customer primarily uses Android or iOS app
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS app_platform VARCHAR(10);

COMMENT ON COLUMN public.customers.app_platform IS 'Primary app platform: ANDROID or IOS';

CREATE INDEX IF NOT EXISTS idx_customers_app_platform ON public.customers(app_platform);
