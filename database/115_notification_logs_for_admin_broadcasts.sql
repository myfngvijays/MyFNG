-- 115_notification_logs_for_admin_broadcasts.sql
-- History/audit log for manual push notifications sent by Super Admin / Sub Admin.

CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SENT',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_type_sent_at
  ON public.notification_logs(type, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_logs_status
  ON public.notification_logs(status);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_logs_admin_select" ON public.notification_logs;
CREATE POLICY "notification_logs_admin_select"
  ON public.notification_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      INNER JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
        AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
    )
  );

DROP POLICY IF EXISTS "notification_logs_admin_insert" ON public.notification_logs;
CREATE POLICY "notification_logs_admin_insert"
  ON public.notification_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      INNER JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
        AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
    )
  );

GRANT SELECT, INSERT ON public.notification_logs TO authenticated;
