-- =====================================================
-- MIGRATION: Pickup Boy Notifications (Observation flag + indexes)
-- Purpose:
--  - Add per-lead observation requirement flag for pickup flow
--  - Add helper indexes for pickup SLA cron queries
-- Date: 2026-01-06
-- =====================================================

-- 1) Per-lead observation requirement flag (pickup test drive / observation)
ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS pickup_observation_required boolean DEFAULT false;

ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS pickup_observation_required_set_by uuid REFERENCES public.users_login(id);

ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS pickup_observation_required_set_at timestamp with time zone;

-- 2) Indexes for SLA + assignment queries (non-destructive)
CREATE INDEX IF NOT EXISTS idx_service_leads_pickup_assigned_at
  ON public.service_leads (pickup_assigned_at);

CREATE INDEX IF NOT EXISTS idx_service_leads_assigned_pickup_boy_id
  ON public.service_leads (assigned_pickup_boy_id);

CREATE INDEX IF NOT EXISTS idx_service_leads_pickup_status
  ON public.service_leads (pickup_status);

-- Composite index commonly used by cron: "assigned to pickup boy + still ASSIGNED"
CREATE INDEX IF NOT EXISTS idx_service_leads_pickup_boy_status_assigned_at
  ON public.service_leads (assigned_pickup_boy_id, pickup_status, pickup_assigned_at);


