-- Tag bot flows / workflows with the WhatsApp number they belong to.
-- Empty account_phone means the original settings number (+91 95949 96161).

ALTER TABLE public.bot_flows
  ADD COLUMN IF NOT EXISTS account_phone text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_bot_flows_account_phone ON public.bot_flows(account_phone);
