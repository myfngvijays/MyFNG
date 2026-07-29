-- 294_push_campaigns_segments_schedule.sql
-- Saved segments, scheduled / A/B campaigns, and engagement events for Advance Push.

CREATE TABLE IF NOT EXISTS public.push_saved_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_saved_segments_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.push_scheduled_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ab_enabled BOOLEAN NOT NULL DEFAULT false,
  variant_b JSONB,
  result JSONB,
  error_message TEXT,
  notification_log_id UUID,
  created_by UUID REFERENCES public.users_login(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_scheduled_campaigns_due
  ON public.push_scheduled_campaigns (status, scheduled_at)
  WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS public.push_engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_log_id UUID,
  campaign_id UUID REFERENCES public.push_scheduled_campaigns(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('delivered', 'open', 'click')),
  variant TEXT,
  customer_id UUID,
  device_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_engagement_events_log
  ON public.push_engagement_events (notification_log_id, event_type);

CREATE INDEX IF NOT EXISTS idx_push_engagement_events_campaign
  ON public.push_engagement_events (campaign_id, event_type);

ALTER TABLE public.push_saved_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_scheduled_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_engagement_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_segments_admin_all" ON public.push_saved_segments;
CREATE POLICY "push_segments_admin_all"
  ON public.push_saved_segments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      INNER JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
        AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      INNER JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
        AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
    )
  );

DROP POLICY IF EXISTS "push_campaigns_admin_all" ON public.push_scheduled_campaigns;
CREATE POLICY "push_campaigns_admin_all"
  ON public.push_scheduled_campaigns
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      INNER JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
        AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_login ul
      INNER JOIN public.roles r ON r.id = ul.role_id
      WHERE ul.id = auth.uid()
        AND r.role_code IN ('SUPER_ADMIN', 'SUB_ADMIN')
    )
  );

DROP POLICY IF EXISTS "push_engagement_admin_select" ON public.push_engagement_events;
CREATE POLICY "push_engagement_admin_select"
  ON public.push_engagement_events
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_saved_segments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_scheduled_campaigns TO authenticated;
GRANT SELECT ON public.push_engagement_events TO authenticated;
GRANT ALL ON public.push_saved_segments TO service_role;
GRANT ALL ON public.push_scheduled_campaigns TO service_role;
GRANT ALL ON public.push_engagement_events TO service_role;

COMMENT ON TABLE public.push_saved_segments IS 'Reusable Advance Push audience filters';
COMMENT ON TABLE public.push_scheduled_campaigns IS 'Scheduled / A-B push campaigns processed by cron';
COMMENT ON TABLE public.push_engagement_events IS 'Open/click events from mobile for push analytics';
