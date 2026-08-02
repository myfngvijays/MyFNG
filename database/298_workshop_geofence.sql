-- Workshop geofence: track when app users enter near partner service centers
BEGIN;

ALTER TABLE public.customer_notification_preferences
  ADD COLUMN IF NOT EXISTS workshop_proximity_alerts BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.workshop_proximity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL DEFAULT 'enter',
  source VARCHAR(30) NOT NULL DEFAULT 'geofence',
  distance_m NUMERIC(10,2),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  had_active_booking BOOLEAN DEFAULT FALSE,
  ops_alert_sent BOOLEAN DEFAULT FALSE,
  customer_nudge_sent BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workshop_proximity_events_created
  ON public.workshop_proximity_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workshop_proximity_events_customer_workshop
  ON public.workshop_proximity_events(customer_id, workshop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workshop_proximity_events_ops
  ON public.workshop_proximity_events(ops_alert_sent, had_active_booking, created_at DESC);

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable)
VALUES (
  'workshop_geofence_radius_m',
  '750',
  'NUMBER',
  'MOBILE',
  'Geofence radius in meters for workshop proximity alerts',
  '750',
  true
)
ON CONFLICT (setting_key) DO NOTHING;

COMMIT;
