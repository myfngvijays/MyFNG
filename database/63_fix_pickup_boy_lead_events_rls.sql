-- =====================================================
-- MIGRATION: Fix Pickup Boy RLS for lead_events table
-- Purpose: Allow Pickup Boys to insert events when verifying OTP
-- Date: 2025-12-05
-- =====================================================

-- Ensure RLS is enabled for lead_events table
ALTER TABLE IF EXISTS public.lead_events ENABLE ROW LEVEL SECURITY;

-- Drop existing pickup boy policies if they exist
DROP POLICY IF EXISTS "Pickup boys can insert events for assigned leads" ON public.lead_events;
DROP POLICY IF EXISTS "Pickup boys can view events for assigned leads" ON public.lead_events;

-- Policy: Pickup boys can insert events for leads assigned to them
CREATE POLICY "Pickup boys can insert events for assigned leads" ON public.lead_events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    WHERE sl.id = lead_events.lead_id
    AND sl.assigned_pickup_boy_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.pickup_tracking pt
    WHERE pt.lead_id = lead_events.lead_id
    AND (pt.pickup_assigned_to = auth.uid() OR pt.drop_assigned_to = auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- Policy: Pickup boys can view events for leads assigned to them
CREATE POLICY "Pickup boys can view events for assigned leads" ON public.lead_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    WHERE sl.id = lead_events.lead_id
    AND sl.assigned_pickup_boy_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.pickup_tracking pt
    WHERE pt.lead_id = lead_events.lead_id
    AND (pt.pickup_assigned_to = auth.uid() OR pt.drop_assigned_to = auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- Note: service_leads update policy already exists from migration 56
-- The existing policy "Pickup boys can update assigned leads" should allow OTP verification
-- No need to create a duplicate policy

DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies for Pickup Boy lead_events access fixed!';
    RAISE NOTICE 'ℹ️  Pickup Boys can now:';
    RAISE NOTICE '   - Insert events into lead_events for assigned leads';
    RAISE NOTICE '   - View events for assigned leads';
    RAISE NOTICE '   - Update service_leads for OTP verification';
END $$;

