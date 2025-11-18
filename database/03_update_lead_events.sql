-- =====================================================
-- MIGRATION: Update/Create lead_events table
-- Purpose: Activity log and event sourcing for leads
-- =====================================================

-- Create lead_events table if not exists
CREATE TABLE IF NOT EXISTS public.lead_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  
  -- Event details
  event_type VARCHAR(100) NOT NULL,  
  -- Examples: lead_created, lead_accepted, lead_rejected, lead_assigned, 
  -- status_changed, mechanic_assigned, pickup_scheduled, payment_received,
  -- sla_breached, escalated, reopened, audit_completed, etc.
  
  event_category VARCHAR(50),  -- LEAD, ASSIGNMENT, STATUS, PAYMENT, SLA, AUDIT
  
  -- Actor information
  actor VARCHAR(100),  -- user:UUID, system, customer, partner:ID
  actor_name VARCHAR(200),  -- Human readable name for display
  actor_role VARCHAR(50),   -- Role of the actor
  
  -- Event data
  event_description TEXT,    -- Human readable description
  metadata JSONB,            -- Flexible event data (old_value, new_value, etc.)
  
  -- Additional tracking
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add missing columns if table already exists
DO $$ 
BEGIN
  -- Add event_category if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_events' AND column_name = 'event_category'
  ) THEN
    ALTER TABLE public.lead_events ADD COLUMN event_category VARCHAR(50);
  END IF;
  
  -- Add actor_name if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_events' AND column_name = 'actor_name'
  ) THEN
    ALTER TABLE public.lead_events ADD COLUMN actor_name VARCHAR(200);
  END IF;
  
  -- Add actor_role if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_events' AND column_name = 'actor_role'
  ) THEN
    ALTER TABLE public.lead_events ADD COLUMN actor_role VARCHAR(50);
  END IF;
  
  -- Add event_description if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_events' AND column_name = 'event_description'
  ) THEN
    ALTER TABLE public.lead_events ADD COLUMN event_description TEXT;
  END IF;
  
  -- Add ip_address if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_events' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE public.lead_events ADD COLUMN ip_address VARCHAR(45);
  END IF;
  
  -- Add user_agent if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_events' AND column_name = 'user_agent'
  ) THEN
    ALTER TABLE public.lead_events ADD COLUMN user_agent TEXT;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON public.lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_type ON public.lead_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lead_events_category ON public.lead_events(event_category);
CREATE INDEX IF NOT EXISTS idx_lead_events_created ON public.lead_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_events_actor ON public.lead_events(actor);

-- GIN index for metadata JSONB
CREATE INDEX IF NOT EXISTS idx_lead_events_metadata_gin ON public.lead_events USING gin(metadata);

-- Comments
COMMENT ON TABLE public.lead_events IS 'Event sourcing and activity log for all lead activities';
COMMENT ON COLUMN public.lead_events.event_type IS 'Specific event type (e.g., lead_created, status_changed, sla_breached)';
COMMENT ON COLUMN public.lead_events.event_category IS 'Broad category: LEAD, ASSIGNMENT, STATUS, PAYMENT, SLA, AUDIT';
COMMENT ON COLUMN public.lead_events.actor IS 'Who triggered the event: user:UUID, system, customer, partner:ID';
COMMENT ON COLUMN public.lead_events.metadata IS 'Flexible JSONB for event-specific data (old_value, new_value, etc.)';

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Lead events table updated successfully!';
END $$;

