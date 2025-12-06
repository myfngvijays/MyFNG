-- Optimize supervisor jobs query with composite indexes
-- This significantly speeds up the supervisor jobs list page

-- Composite index for the main query filter
CREATE INDEX IF NOT EXISTS idx_service_leads_workshop_status_created 
ON public.service_leads(workshop_id, status, created_at DESC)
WHERE status NOT IN ('REJECTED', 'CANCELLED');

-- Index for mechanic assignment filter
CREATE INDEX IF NOT EXISTS idx_service_leads_workshop_mechanic 
ON public.service_leads(workshop_id, assigned_mechanic_id, status)
WHERE assigned_mechanic_id IS NOT NULL;

-- Index for pickup boy filter
CREATE INDEX IF NOT EXISTS idx_service_leads_workshop_pickup 
ON public.service_leads(workshop_id, assigned_pickup_boy_id, status)
WHERE assigned_pickup_boy_id IS NOT NULL;

-- Index for SLA status filter
CREATE INDEX IF NOT EXISTS idx_service_leads_workshop_sla 
ON public.service_leads(workshop_id, sla_status, created_at DESC)
WHERE sla_status IS NOT NULL;

-- Index for search queries (lead_number, customer_name, vehicle_number)
CREATE INDEX IF NOT EXISTS idx_service_leads_search 
ON public.service_leads(workshop_id, lead_number, customer_name, vehicle_number);

-- Index for mechanic_jobs lookup
CREATE INDEX IF NOT EXISTS idx_mechanic_jobs_lead_status 
ON public.mechanic_jobs(lead_id, mechanic_status);

-- Index for lead_extra_charges lookup
CREATE INDEX IF NOT EXISTS idx_lead_extra_charges_lead_status 
ON public.lead_extra_charges(lead_id, status);

-- Index for mechanic_media lookup
CREATE INDEX IF NOT EXISTS idx_mechanic_media_lead_category 
ON public.mechanic_media(lead_id, media_category);

-- Analyze tables to update statistics
ANALYZE public.service_leads;
ANALYZE public.mechanic_jobs;
ANALYZE public.lead_extra_charges;
ANALYZE public.mechanic_media;

DO $$ 
BEGIN 
  RAISE NOTICE '✅ Supervisor jobs query optimization indexes created!';
END $$;

