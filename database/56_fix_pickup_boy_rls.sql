-- =====================================================
-- MIGRATION: Fix Pickup Boy RLS Policies
-- Purpose: Allow Pickup Boys to upload and view photos in lead_media,
--          access their assigned leads, and manage pickup-related data
-- Date: 2025-12-05
-- =====================================================

-- Ensure RLS is enabled for relevant tables
ALTER TABLE IF EXISTS public.lead_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pickup_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pickup_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicle_condition_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pickup_location_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pickup_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pickup_boy_metrics ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 1. LEAD_MEDIA TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Pickup boys can insert photos for assigned leads" ON public.lead_media;
DROP POLICY IF EXISTS "Pickup boys can view photos for assigned leads" ON public.lead_media;
DROP POLICY IF EXISTS "Pickup boys can update their own photos" ON public.lead_media;
DROP POLICY IF EXISTS "Pickup boys can delete their own photos" ON public.lead_media;

-- Policy: Pickup boys can insert photos for leads assigned to them
CREATE POLICY "Pickup boys can insert photos for assigned leads" ON public.lead_media
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.assigned_pickup_boy_id = ul.id
    JOIN public.roles r ON ul.role_id = r.id
    WHERE sl.id = lead_media.lead_id
    AND ul.id = auth.uid()
    AND r.role_code = 'WORKSHOP_PICKUP_BOY'
  )
);

-- Policy: Pickup boys can view photos for leads assigned to them
CREATE POLICY "Pickup boys can view photos for assigned leads" ON public.lead_media
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.assigned_pickup_boy_id = ul.id
    JOIN public.roles r ON ul.role_id = r.id
    WHERE sl.id = lead_media.lead_id
    AND ul.id = auth.uid()
    AND r.role_code = 'WORKSHOP_PICKUP_BOY'
  )
  OR
  -- Also allow if uploaded by the pickup boy
  uploaded_by = auth.uid()
);

-- Policy: Pickup boys can update their own photos
CREATE POLICY "Pickup boys can update their own photos" ON public.lead_media
FOR UPDATE
USING (
  uploaded_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.assigned_pickup_boy_id = ul.id
    JOIN public.roles r ON ul.role_id = r.id
    WHERE sl.id = lead_media.lead_id
    AND ul.id = auth.uid()
    AND r.role_code = 'WORKSHOP_PICKUP_BOY'
  )
)
WITH CHECK (
  uploaded_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.assigned_pickup_boy_id = ul.id
    JOIN public.roles r ON ul.role_id = r.id
    WHERE sl.id = lead_media.lead_id
    AND ul.id = auth.uid()
    AND r.role_code = 'WORKSHOP_PICKUP_BOY'
  )
);

-- Policy: Pickup boys can delete their own photos
CREATE POLICY "Pickup boys can delete their own photos" ON public.lead_media
FOR DELETE
USING (
  uploaded_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul ON sl.assigned_pickup_boy_id = ul.id
    JOIN public.roles r ON ul.role_id = r.id
    WHERE sl.id = lead_media.lead_id
    AND ul.id = auth.uid()
    AND r.role_code = 'WORKSHOP_PICKUP_BOY'
  )
);

-- =====================================================
-- 2. SERVICE_LEADS TABLE POLICIES (for pickup boy access)
-- =====================================================

-- Drop existing pickup boy policies if they exist
DROP POLICY IF EXISTS "Pickup boys can view assigned leads" ON public.service_leads;
DROP POLICY IF EXISTS "Pickup boys can update assigned leads" ON public.service_leads;

-- Policy: Pickup boys can view leads assigned to them
CREATE POLICY "Pickup boys can view assigned leads" ON public.service_leads
FOR SELECT
USING (
  -- Direct assignment check (primary case)
  assigned_pickup_boy_id = auth.uid()
);

-- Policy: Pickup boys can update leads assigned to them (for pickup status, OTP, etc.)
CREATE POLICY "Pickup boys can update assigned leads" ON public.service_leads
FOR UPDATE
USING (
  -- Direct assignment check (primary case)
  assigned_pickup_boy_id = auth.uid()
)
WITH CHECK (
  -- Direct assignment check (primary case)
  assigned_pickup_boy_id = auth.uid()
);

-- =====================================================
-- 3. LEAD_ACTIVITIES TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Pickup boys can insert activities for assigned leads" ON public.lead_activities;
DROP POLICY IF EXISTS "Pickup boys can view activities for assigned leads" ON public.lead_activities;

-- Policy: Pickup boys can insert activities for assigned leads
CREATE POLICY "Pickup boys can insert activities for assigned leads" ON public.lead_activities
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    WHERE sl.id = lead_activities.lead_id
    AND (
      sl.assigned_pickup_boy_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.pickup_tracking pt
        WHERE pt.lead_id = sl.id
        AND (pt.pickup_assigned_to = auth.uid() OR pt.drop_assigned_to = auth.uid())
      )
    )
  )
);

-- Policy: Pickup boys can view activities for assigned leads
CREATE POLICY "Pickup boys can view activities for assigned leads" ON public.lead_activities
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    WHERE sl.id = lead_activities.lead_id
    AND (
      sl.assigned_pickup_boy_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.pickup_tracking pt
        WHERE pt.lead_id = sl.id
        AND (pt.pickup_assigned_to = auth.uid() OR pt.drop_assigned_to = auth.uid())
      )
    )
  )
);

-- =====================================================
-- 4. PICKUP_TRACKING TABLE POLICIES (ensure pickup boy access)
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Pickup boys can manage their own tracking" ON public.pickup_tracking;

-- Policy: Pickup boys can manage their own pickup tracking
CREATE POLICY "Pickup boys can manage their own tracking" ON public.pickup_tracking
FOR ALL
USING (
  pickup_assigned_to = auth.uid() OR drop_assigned_to = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
)
WITH CHECK (
  pickup_assigned_to = auth.uid() OR drop_assigned_to = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- =====================================================
-- 5. PICKUP_OTPS TABLE POLICIES (ensure pickup boy access)
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Pickup boys can manage OTPs for assigned leads" ON public.pickup_otps;

-- Policy: Pickup boys can manage OTPs for assigned leads
CREATE POLICY "Pickup boys can manage OTPs for assigned leads" ON public.pickup_otps
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.pickup_tracking pt
    WHERE pt.lead_id = pickup_otps.lead_id
    AND (pt.pickup_assigned_to = auth.uid() OR pt.drop_assigned_to = auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    WHERE sl.id = pickup_otps.lead_id
    AND sl.assigned_pickup_boy_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pickup_tracking pt
    WHERE pt.lead_id = pickup_otps.lead_id
    AND (pt.pickup_assigned_to = auth.uid() OR pt.drop_assigned_to = auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    WHERE sl.id = pickup_otps.lead_id
    AND sl.assigned_pickup_boy_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- =====================================================
-- 6. VEHICLE_CONDITION_PHOTOS TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Pickup boys can manage vehicle photos for assigned leads" ON public.vehicle_condition_photos;

-- Policy: Pickup boys can manage vehicle photos for assigned leads
CREATE POLICY "Pickup boys can manage vehicle photos for assigned leads" ON public.vehicle_condition_photos
FOR ALL
USING (
  uploaded_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    WHERE sl.id = vehicle_condition_photos.lead_id
    AND (
      sl.assigned_pickup_boy_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.pickup_tracking pt
        WHERE pt.lead_id = sl.id
        AND (pt.pickup_assigned_to = auth.uid() OR pt.drop_assigned_to = auth.uid())
      )
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
)
WITH CHECK (
  uploaded_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    WHERE sl.id = vehicle_condition_photos.lead_id
    AND (
      sl.assigned_pickup_boy_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.pickup_tracking pt
        WHERE pt.lead_id = sl.id
        AND (pt.pickup_assigned_to = auth.uid() OR pt.drop_assigned_to = auth.uid())
      )
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- =====================================================
-- 7. PICKUP_LOCATION_TRACKING TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Pickup boys can manage their location tracking" ON public.pickup_location_tracking;

-- Policy: Pickup boys can manage their own location tracking
CREATE POLICY "Pickup boys can manage their location tracking" ON public.pickup_location_tracking
FOR ALL
USING (
  pickup_boy_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
)
WITH CHECK (
  pickup_boy_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- =====================================================
-- 8. PICKUP_INCIDENTS TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Pickup boys can manage incidents for assigned leads" ON public.pickup_incidents;

-- Policy: Pickup boys can manage incidents for assigned leads
CREATE POLICY "Pickup boys can manage incidents for assigned leads" ON public.pickup_incidents
FOR ALL
USING (
  reported_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    WHERE sl.id = pickup_incidents.lead_id
    AND (
      sl.assigned_pickup_boy_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.pickup_tracking pt
        WHERE pt.lead_id = sl.id
        AND (pt.pickup_assigned_to = auth.uid() OR pt.drop_assigned_to = auth.uid())
      )
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
)
WITH CHECK (
  reported_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    WHERE sl.id = pickup_incidents.lead_id
    AND (
      sl.assigned_pickup_boy_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.pickup_tracking pt
        WHERE pt.lead_id = sl.id
        AND (pt.pickup_assigned_to = auth.uid() OR pt.drop_assigned_to = auth.uid())
      )
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

-- =====================================================
-- 9. PICKUP_BOY_METRICS TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Pickup boys can view their own metrics" ON public.pickup_boy_metrics;

-- Policy: Pickup boys can view their own metrics
CREATE POLICY "Pickup boys can view their own metrics" ON public.pickup_boy_metrics
FOR SELECT
USING (
  pickup_boy_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.users_login ul
    JOIN public.roles r ON ul.role_id = r.id
    WHERE ul.id = auth.uid()
    AND r.role_code IN ('SUPER_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR')
  )
);

DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies for Pickup Boy role fixed!';
    RAISE NOTICE 'ℹ️  Pickup Boys can now:';
    RAISE NOTICE '   - Upload and view photos in lead_media for assigned leads';
    RAISE NOTICE '   - View and update assigned leads';
    RAISE NOTICE '   - Manage pickup tracking, OTPs, and location tracking';
    RAISE NOTICE '   - Report incidents and view their own metrics';
END $$;

