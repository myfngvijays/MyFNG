-- Chat assignment tracking for WhatsApp conversations.
CREATE TABLE IF NOT EXISTS public.whatsapp_chat_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  assigned_to_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  assigned_by uuid NULL REFERENCES public.users_login(id) ON DELETE SET NULL,
  assigned_note text NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_chat_assignments_max_two_assignees
    CHECK (array_length(assigned_to_ids, 1) IS NULL OR array_length(assigned_to_ids, 1) <= 2)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_assignments_assigned_to_ids
  ON public.whatsapp_chat_assignments USING GIN(assigned_to_ids);

CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_assignments_assigned_at
  ON public.whatsapp_chat_assignments(assigned_at DESC);

ALTER TABLE public.whatsapp_chat_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_chat_assignments'
      AND policyname = 'whatsapp_chat_assignments_select_authenticated'
  ) THEN
    CREATE POLICY whatsapp_chat_assignments_select_authenticated
      ON public.whatsapp_chat_assignments
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_chat_assignments'
      AND policyname = 'whatsapp_chat_assignments_insert_authenticated'
  ) THEN
    CREATE POLICY whatsapp_chat_assignments_insert_authenticated
      ON public.whatsapp_chat_assignments
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_chat_assignments'
      AND policyname = 'whatsapp_chat_assignments_update_authenticated'
  ) THEN
    CREATE POLICY whatsapp_chat_assignments_update_authenticated
      ON public.whatsapp_chat_assignments
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
