-- =====================================================
-- MIGRATION: Telecaller Tables & Functions
-- Purpose: Complete telecaller role functionality
-- =====================================================

-- =====================================================
-- Table 1: telecaller_call_logs
-- Purpose: Track all customer calls made by telecallers
-- =====================================================
CREATE TABLE IF NOT EXISTS public.telecaller_call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Lead & User info
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  telecaller_id UUID NOT NULL REFERENCES public.users_login(id),
  
  -- Call details
  call_type VARCHAR(20) NOT NULL, -- OUTBOUND, INBOUND, FOLLOW_UP, RETRY
  call_status VARCHAR(30) NOT NULL, -- ANSWERED, NO_ANSWER, BUSY, SWITCHED_OFF, WRONG_NUMBER, COMPLETED
  call_duration INTEGER, -- seconds
  
  -- Call outcome
  outcome VARCHAR(50), -- INFO_COLLECTED, LEAD_CREATED, FOLLOW_UP_SET, CUSTOMER_REJECTED, ESCALATED
  customer_response TEXT, -- Customer's verbal response
  notes TEXT, -- Telecaller notes
  
  -- Next action
  next_action VARCHAR(50), -- CALL_BACK, SEND_SMS, SEND_WHATSAPP, CREATE_LEAD, ESCALATE, CLOSE
  next_action_time TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  phone_number VARCHAR(20), -- Phone called
  call_recording_url TEXT, -- Optional call recording
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON public.telecaller_call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_telecaller_id ON public.telecaller_call_logs(telecaller_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON public.telecaller_call_logs(call_status);
CREATE INDEX IF NOT EXISTS idx_call_logs_created ON public.telecaller_call_logs(created_at DESC);

COMMENT ON TABLE public.telecaller_call_logs IS 'All calls made by telecallers to customers';


-- =====================================================
-- Table 2: telecaller_follow_ups
-- Purpose: Manage follow-up reminders for telecallers
-- =====================================================
CREATE TABLE IF NOT EXISTS public.telecaller_follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Lead & User info
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  telecaller_id UUID NOT NULL REFERENCES public.users_login(id),
  
  -- Follow-up details
  follow_up_type VARCHAR(30) NOT NULL, -- CALLBACK, PRICE_CONFIRMATION, INFO_PENDING, SLOT_CONFIRMATION, GENERAL
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  priority VARCHAR(20) DEFAULT 'NORMAL', -- LOW, NORMAL, HIGH, URGENT
  
  -- Reason & context
  reason TEXT NOT NULL, -- Why follow-up needed
  context_notes TEXT, -- Previous conversation summary
  
  -- Status
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, COMPLETED, CANCELLED, MISSED
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES public.users_login(id),
  completion_notes TEXT,
  
  -- Reminders
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON public.telecaller_follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_telecaller_id ON public.telecaller_follow_ups(telecaller_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON public.telecaller_follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON public.telecaller_follow_ups(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_follow_ups_pending ON public.telecaller_follow_ups(status, scheduled_time) 
  WHERE status = 'PENDING';

COMMENT ON TABLE public.telecaller_follow_ups IS 'Follow-up reminders for telecallers';


-- =====================================================
-- Table 3: telecaller_scripts
-- Purpose: Store call scripts & templates for telecallers
-- =====================================================
CREATE TABLE IF NOT EXISTS public.telecaller_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Script details
  script_type VARCHAR(50) NOT NULL, -- OPENING, PICKUP_CONFIRMATION, SLOT_SUGGESTION, CLOSING, FOLLOW_UP, REJECTION_HANDLING
  script_title VARCHAR(200) NOT NULL,
  script_content TEXT NOT NULL,
  
  -- Categorization
  language VARCHAR(10) DEFAULT 'en', -- en, hi, etc.
  category VARCHAR(50), -- GREETING, INFORMATION_GATHERING, OBJECTION_HANDLING, CLOSING
  
  -- Usage
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scripts_type ON public.telecaller_scripts(script_type);
CREATE INDEX IF NOT EXISTS idx_scripts_active ON public.telecaller_scripts(is_active) WHERE is_active = true;

COMMENT ON TABLE public.telecaller_scripts IS 'Pre-defined call scripts for telecallers';


-- =====================================================
-- Table 4: telecaller_performance_metrics
-- Purpose: Track telecaller KPIs and performance
-- =====================================================
CREATE TABLE IF NOT EXISTS public.telecaller_performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telecaller_id UUID NOT NULL REFERENCES public.users_login(id),
  
  -- Date tracking
  date DATE NOT NULL,
  
  -- Call metrics
  total_calls INTEGER DEFAULT 0,
  answered_calls INTEGER DEFAULT 0,
  missed_calls INTEGER DEFAULT 0,
  call_duration_total INTEGER DEFAULT 0, -- seconds
  avg_call_duration NUMERIC,
  
  -- Lead metrics
  leads_created INTEGER DEFAULT 0,
  leads_completed INTEGER DEFAULT 0,
  leads_followed_up INTEGER DEFAULT 0,
  incomplete_leads_converted INTEGER DEFAULT 0,
  
  -- Conversion metrics
  call_to_lead_conversion_rate NUMERIC DEFAULT 0,
  follow_up_success_rate NUMERIC DEFAULT 0,
  
  -- Quality metrics
  duplicate_leads_created INTEGER DEFAULT 0,
  missed_follow_ups INTEGER DEFAULT 0,
  customer_complaints INTEGER DEFAULT 0,
  accuracy_score NUMERIC DEFAULT 0, -- Lead information accuracy
  
  -- Customer response
  customer_rejected INTEGER DEFAULT 0,
  customer_not_responding INTEGER DEFAULT 0,
  wrong_numbers INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(telecaller_id, date)
);

CREATE INDEX IF NOT EXISTS idx_perf_metrics_telecaller ON public.telecaller_performance_metrics(telecaller_id);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_date ON public.telecaller_performance_metrics(date DESC);

COMMENT ON TABLE public.telecaller_performance_metrics IS 'Daily performance tracking for telecallers';


-- =====================================================
-- Table 5: lead_sources (if not exists)
-- Purpose: Track where leads came from
-- =====================================================
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_code VARCHAR(50) NOT NULL UNIQUE, -- GMB, WHATSAPP, WEBSITE, PARTNER, MISSED_CALL, MANUAL
  source_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default sources
INSERT INTO public.lead_sources (source_code, source_name, description) VALUES
  ('APP', 'Mobile App', 'Customer booking via mobile app'),
  ('WEB', 'Website', 'Website booking form'),
  ('GMB', 'Google My Business', 'Google Business listing inquiry'),
  ('WHATSAPP', 'WhatsApp', 'WhatsApp bot or manual chat'),
  ('PARTNER', 'Partner Portal', 'Partner workshop referral'),
  ('TELECALLER', 'Telecaller', 'Manual lead creation by telecaller'),
  ('MISSED_CALL', 'Missed Call', 'Customer missed call service'),
  ('WALK_IN', 'Walk-In', 'Direct workshop walk-in'),
  ('IMPORT', 'Bulk Import', 'Imported from external system')
ON CONFLICT (source_code) DO NOTHING;

COMMENT ON TABLE public.lead_sources IS 'Master list of lead sources';


-- =====================================================
-- Add telecaller-specific columns to service_leads
-- =====================================================
ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS assigned_telecaller_id UUID REFERENCES public.users_login(id),
  ADD COLUMN IF NOT EXISTS telecaller_assigned_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS is_incomplete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS incomplete_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_call_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS total_calls INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follow_up_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMP WITH TIME ZONE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_telecaller ON public.service_leads(assigned_telecaller_id);
CREATE INDEX IF NOT EXISTS idx_leads_incomplete ON public.service_leads(is_incomplete) WHERE is_incomplete = true;
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON public.service_leads(follow_up_required) WHERE follow_up_required = true;
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON public.service_leads(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;


-- =====================================================
-- Function: Auto-update telecaller metrics
-- =====================================================
CREATE OR REPLACE FUNCTION update_telecaller_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update daily metrics when call log is created
  INSERT INTO telecaller_performance_metrics (
    telecaller_id,
    date,
    total_calls,
    answered_calls,
    call_duration_total
  ) VALUES (
    NEW.telecaller_id,
    CURRENT_DATE,
    1,
    CASE WHEN NEW.call_status = 'ANSWERED' THEN 1 ELSE 0 END,
    COALESCE(NEW.call_duration, 0)
  )
  ON CONFLICT (telecaller_id, date) DO UPDATE SET
    total_calls = telecaller_performance_metrics.total_calls + 1,
    answered_calls = telecaller_performance_metrics.answered_calls + 
      CASE WHEN NEW.call_status = 'ANSWERED' THEN 1 ELSE 0 END,
    call_duration_total = telecaller_performance_metrics.call_duration_total + 
      COALESCE(NEW.call_duration, 0),
    avg_call_duration = 
      (telecaller_performance_metrics.call_duration_total + COALESCE(NEW.call_duration, 0)) / 
      (telecaller_performance_metrics.total_calls + 1),
    updated_at = now();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for call logs
DROP TRIGGER IF EXISTS trg_update_telecaller_metrics ON telecaller_call_logs;
CREATE TRIGGER trg_update_telecaller_metrics
  AFTER INSERT ON telecaller_call_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_telecaller_metrics();


-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Telecaller tables created successfully!';
  RAISE NOTICE '📋 Tables: call_logs, follow_ups, scripts, performance_metrics, lead_sources';
END $$;

