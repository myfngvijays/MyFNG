-- ============================================
-- WhatsApp RLS hardening + realtime readiness
-- ============================================

-- Enable RLS on all WhatsApp tables
ALTER TABLE IF EXISTS public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

-- -----------------------------
-- whatsapp_messages policies
-- -----------------------------
DROP POLICY IF EXISTS whatsapp_messages_select_ops ON public.whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_messages_insert_ops ON public.whatsapp_messages;

CREATE POLICY whatsapp_messages_select_ops
ON public.whatsapp_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN (
        'SUPER_ADMIN',
        'SUB_ADMIN',
        'RSA_MANAGER',
        'TELECALLER',
        'CUSTOMER_SERVICE_EXECUTIVE',
        'WORKSHOP_ADMIN',
        'WORKSHOP_SUPERVISOR',
        'BILLING_SPECIALIST'
      )
  )
);

CREATE POLICY whatsapp_messages_insert_ops
ON public.whatsapp_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN (
        'SUPER_ADMIN',
        'SUB_ADMIN',
        'RSA_MANAGER',
        'TELECALLER',
        'CUSTOMER_SERVICE_EXECUTIVE',
        'WORKSHOP_ADMIN',
        'WORKSHOP_SUPERVISOR',
        'BILLING_SPECIALIST'
      )
  )
  AND (
    created_by IS NULL
    OR created_by = auth.uid()
  )
);

-- -----------------------------
-- whatsapp_templates policies
-- -----------------------------
DROP POLICY IF EXISTS whatsapp_templates_select_ops ON public.whatsapp_templates;
DROP POLICY IF EXISTS whatsapp_templates_insert_admin ON public.whatsapp_templates;
DROP POLICY IF EXISTS whatsapp_templates_update_admin ON public.whatsapp_templates;
DROP POLICY IF EXISTS whatsapp_templates_delete_admin ON public.whatsapp_templates;

CREATE POLICY whatsapp_templates_select_ops
ON public.whatsapp_templates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN (
        'SUPER_ADMIN',
        'SUB_ADMIN',
        'RSA_MANAGER',
        'TELECALLER',
        'CUSTOMER_SERVICE_EXECUTIVE',
        'WORKSHOP_ADMIN',
        'WORKSHOP_SUPERVISOR',
        'BILLING_SPECIALIST'
      )
  )
);

CREATE POLICY whatsapp_templates_insert_admin
ON public.whatsapp_templates
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
  AND (
    created_by IS NULL
    OR created_by = auth.uid()
  )
);

CREATE POLICY whatsapp_templates_update_admin
ON public.whatsapp_templates
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

CREATE POLICY whatsapp_templates_delete_admin
ON public.whatsapp_templates
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

-- -----------------------------------
-- whatsapp_webhook_events policies
-- -----------------------------------
-- No INSERT policy intentionally: webhook writes should happen via service-role key only.
DROP POLICY IF EXISTS whatsapp_webhook_events_select_admin ON public.whatsapp_webhook_events;

CREATE POLICY whatsapp_webhook_events_select_admin
ON public.whatsapp_webhook_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users_login ul
    JOIN public.roles r ON r.id = ul.role_id
    WHERE ul.id = auth.uid()
      AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
  )
);

-- Realtime publication for whatsapp_messages (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  END IF;
END $$;
