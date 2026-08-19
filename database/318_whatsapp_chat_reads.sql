-- Per-user WhatsApp inbox read receipts (clear unread after opening a chat)
CREATE TABLE IF NOT EXISTS public.whatsapp_chat_reads (
  phone text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users_login(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (phone, user_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_reads_user_id
  ON public.whatsapp_chat_reads(user_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_reads_user_read_at
  ON public.whatsapp_chat_reads(user_id, last_read_at DESC);

ALTER TABLE public.whatsapp_chat_reads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_chat_reads'
      AND policyname = 'whatsapp_chat_reads_select_own'
  ) THEN
    CREATE POLICY whatsapp_chat_reads_select_own
      ON public.whatsapp_chat_reads
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_chat_reads'
      AND policyname = 'whatsapp_chat_reads_upsert_own'
  ) THEN
    CREATE POLICY whatsapp_chat_reads_upsert_own
      ON public.whatsapp_chat_reads
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_chat_reads TO authenticated;
GRANT ALL ON public.whatsapp_chat_reads TO service_role;
