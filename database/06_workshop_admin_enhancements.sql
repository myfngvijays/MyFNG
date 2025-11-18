-- ============================================
-- Workshop Admin Enhancements - Migration
-- Phase 1: MVP - Database Schema Changes
-- Task: WA-101
-- ============================================

-- Add SLA Status Enum
CREATE TYPE sla_status AS ENUM ('ON_TIME', 'AT_RISK', 'BREACHED');

-- ============================================
-- 1. Enhance service_leads table with SLA tracking and assignments
-- ============================================

-- Add SLA tracking columns
ALTER TABLE public.service_leads 
  ADD COLUMN IF NOT EXISTS sla_accept_deadline TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS sla_assign_deadline TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS sla_start_deadline TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS sla_status sla_status DEFAULT 'ON_TIME',
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejection_notes TEXT;

-- Add assignment tracking columns
ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS assigned_mechanic_id UUID REFERENCES public.users_login(id),
  ADD COLUMN IF NOT EXISTS assigned_pickup_boy_id UUID REFERENCES public.users_login(id),
  ADD COLUMN IF NOT EXISTS assigned_supervisor_id UUID REFERENCES public.users_login(id),
  ADD COLUMN IF NOT EXISTS mechanic_assigned_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS pickup_assigned_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS supervisor_assigned_at TIMESTAMP WITH TIME ZONE;

-- Add scheduling and pickup fields
ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS preferred_date DATE,
  ADD COLUMN IF NOT EXISTS preferred_time_slot VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pickup_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS pickup_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS pickup_longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS pickup_otp VARCHAR(6);

-- Add vehicle additional details
ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS vehicle_variant VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vehicle_vin VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vehicle_fuel_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS vehicle_odometer INTEGER;

-- Add customer communication preferences
ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS customer_alternate_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS customer_preferred_contact VARCHAR(20) DEFAULT 'PHONE',
  ADD COLUMN IF NOT EXISTS customer_special_notes TEXT;

-- Add payment and pricing fields
ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10,2);

-- Add job card reference
ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS job_card_number VARCHAR(50) UNIQUE;

-- Add distance tracking
ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS distance_from_workshop NUMERIC(10,2);

-- ============================================
-- 2. Create lead_events table for event tracking
-- ============================================

CREATE TABLE IF NOT EXISTS public.lead_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_description TEXT,
  event_data JSONB,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  created_by UUID REFERENCES public.users_login(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE public.lead_events IS 'Event tracking for leads - all status changes and actions';

-- ============================================
-- 3. Create lead_media table for photos and documents
-- ============================================

CREATE TABLE IF NOT EXISTS public.lead_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  media_type VARCHAR(20) NOT NULL, -- 'BEFORE', 'AFTER', 'PROGRESS', 'DOCUMENT', 'INSPECTION'
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES public.users_login(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.lead_media IS 'Photos and documents for leads (before/after/progress)';

-- ============================================
-- 4. Create lead_extra_charges table
-- ============================================

CREATE TABLE IF NOT EXISTS public.lead_extra_charges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT,
  image_url TEXT,
  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
  requested_by UUID REFERENCES public.users_login(id),
  approved_by UUID REFERENCES public.users_login(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.lead_extra_charges IS 'Additional charges requested during service';

-- ============================================
-- 5. Create job_cards table
-- ============================================

CREATE TABLE IF NOT EXISTS public.job_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL UNIQUE REFERENCES public.service_leads(id) ON DELETE CASCADE,
  job_card_number VARCHAR(50) UNIQUE NOT NULL,
  labor_charges NUMERIC(10,2) DEFAULT 0,
  additional_work TEXT,
  mechanic_notes TEXT,
  created_by UUID REFERENCES public.users_login(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.job_cards IS 'Job cards for tracking work and parts';

-- ============================================
-- 6. Create job_card_parts table
-- ============================================

CREATE TABLE IF NOT EXISTS public.job_card_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_card_id UUID NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  part_name VARCHAR(255) NOT NULL,
  part_number VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.job_card_parts IS 'Parts used in job cards';

-- ============================================
-- 7. Create invoices table
-- ============================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL UNIQUE REFERENCES public.service_leads(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  base_amount NUMERIC(10,2) NOT NULL,
  extra_charges NUMERIC(10,2) DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'PENDING',
  payment_mode VARCHAR(50),
  payment_reference VARCHAR(100),
  generated_by UUID REFERENCES public.users_login(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.invoices IS 'Generated invoices for completed services';

-- ============================================
-- 8. Create audits table
-- ============================================

CREATE TABLE IF NOT EXISTS public.audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  auditor_id UUID REFERENCES public.users_login(id),
  audit_type VARCHAR(50) DEFAULT 'QUALITY', -- 'QUALITY', 'COMPLIANCE', 'CUSTOMER_SATISFACTION'
  score NUMERIC(3,2) CHECK (score >= 0 AND score <= 5),
  remarks TEXT,
  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'COMPLETED', 'FAILED'
  audit_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.audits IS 'Quality audits for completed services';

-- ============================================
-- 9. Create audit_checklist table
-- ============================================

CREATE TABLE IF NOT EXISTS public.audit_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  checklist_item VARCHAR(255) NOT NULL,
  checked BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.audit_checklist IS 'Audit checklist items';

-- ============================================
-- 10. Create indexes for performance
-- ============================================

-- SLA and status indexes
CREATE INDEX IF NOT EXISTS idx_service_leads_sla_status ON public.service_leads(sla_status);
CREATE INDEX IF NOT EXISTS idx_service_leads_sla_accept_deadline ON public.service_leads(sla_accept_deadline);
CREATE INDEX IF NOT EXISTS idx_service_leads_workshop_status ON public.service_leads(workshop_id, status);

-- Assignment indexes
CREATE INDEX IF NOT EXISTS idx_service_leads_assigned_mechanic ON public.service_leads(assigned_mechanic_id);
CREATE INDEX IF NOT EXISTS idx_service_leads_assigned_pickup ON public.service_leads(assigned_pickup_boy_id);
CREATE INDEX IF NOT EXISTS idx_service_leads_assigned_supervisor ON public.service_leads(assigned_supervisor_id);

-- Event tracking indexes
CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON public.lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_created_at ON public.lead_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_events_event_type ON public.lead_events(event_type);

-- Media indexes
CREATE INDEX IF NOT EXISTS idx_lead_media_lead_id ON public.lead_media(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_media_type ON public.lead_media(media_type);

-- Extra charges indexes
CREATE INDEX IF NOT EXISTS idx_lead_extra_charges_lead_id ON public.lead_extra_charges(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_extra_charges_status ON public.lead_extra_charges(status);

-- Job card indexes
CREATE INDEX IF NOT EXISTS idx_job_cards_lead_id ON public.job_cards(lead_id);
CREATE INDEX IF NOT EXISTS idx_job_card_parts_job_card_id ON public.job_card_parts(job_card_id);

-- Invoice indexes
CREATE INDEX IF NOT EXISTS idx_invoices_lead_id ON public.invoices(lead_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_audits_lead_id ON public.audits(lead_id);
CREATE INDEX IF NOT EXISTS idx_audits_auditor_id ON public.audits(auditor_id);
CREATE INDEX IF NOT EXISTS idx_audits_status ON public.audits(status);

-- ============================================
-- 11. Create function to automatically calculate SLA deadlines
-- ============================================

CREATE OR REPLACE FUNCTION calculate_sla_deadlines()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate SLA deadlines based on lead creation
  -- Accept deadline: 20 minutes from assignment
  IF NEW.status = 'ASSIGNED' AND NEW.assigned_at IS NOT NULL THEN
    NEW.sla_accept_deadline := NEW.assigned_at + INTERVAL '20 minutes';
  END IF;
  
  -- Assign mechanic deadline: 30 minutes from acceptance
  IF NEW.status = 'ACCEPTED' AND NEW.accepted_at IS NOT NULL THEN
    NEW.sla_assign_deadline := NEW.accepted_at + INTERVAL '30 minutes';
  END IF;
  
  -- Start repair deadline: 2 hours from acceptance
  IF NEW.status = 'ACCEPTED' AND NEW.accepted_at IS NOT NULL THEN
    NEW.sla_start_deadline := NEW.accepted_at + INTERVAL '2 hours';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate SLA deadlines
DROP TRIGGER IF EXISTS trigger_calculate_sla_deadlines ON public.service_leads;
CREATE TRIGGER trigger_calculate_sla_deadlines
  BEFORE INSERT OR UPDATE ON public.service_leads
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sla_deadlines();

-- ============================================
-- 12. Create function to log lead events automatically
-- ============================================

CREATE OR REPLACE FUNCTION log_lead_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.lead_events (
      lead_id,
      event_type,
      event_description,
      old_status,
      new_status,
      created_by
    ) VALUES (
      NEW.id,
      'STATUS_CHANGE',
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      OLD.status::VARCHAR,
      NEW.status::VARCHAR,
      NEW.updated_by_id
    );
  END IF;
  
  -- Log acceptance
  IF (TG_OP = 'UPDATE' AND OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL) THEN
    INSERT INTO public.lead_events (
      lead_id,
      event_type,
      event_description,
      created_by
    ) VALUES (
      NEW.id,
      'LEAD_ACCEPTED',
      'Lead accepted by workshop admin',
      NEW.updated_by_id
    );
  END IF;
  
  -- Log rejection
  IF (TG_OP = 'UPDATE' AND OLD.rejected_at IS NULL AND NEW.rejected_at IS NOT NULL) THEN
    INSERT INTO public.lead_events (
      lead_id,
      event_type,
      event_description,
      event_data,
      created_by
    ) VALUES (
      NEW.id,
      'LEAD_REJECTED',
      'Lead rejected: ' || COALESCE(NEW.rejected_reason, 'No reason provided'),
      jsonb_build_object('reason', NEW.rejected_reason, 'notes', NEW.rejection_notes),
      NEW.updated_by_id
    );
  END IF;
  
  -- Log mechanic assignment
  IF (TG_OP = 'UPDATE' AND OLD.assigned_mechanic_id IS DISTINCT FROM NEW.assigned_mechanic_id AND NEW.assigned_mechanic_id IS NOT NULL) THEN
    INSERT INTO public.lead_events (
      lead_id,
      event_type,
      event_description,
      event_data,
      created_by
    ) VALUES (
      NEW.id,
      'MECHANIC_ASSIGNED',
      'Mechanic assigned to lead',
      jsonb_build_object('mechanic_id', NEW.assigned_mechanic_id),
      NEW.updated_by_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-log events
DROP TRIGGER IF EXISTS trigger_log_lead_event ON public.service_leads;
CREATE TRIGGER trigger_log_lead_event
  AFTER INSERT OR UPDATE ON public.service_leads
  FOR EACH ROW
  EXECUTE FUNCTION log_lead_event();

-- ============================================
-- 13. Grant permissions (adjust as needed)
-- ============================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.service_leads TO authenticated;
GRANT SELECT, INSERT ON public.lead_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_media TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lead_extra_charges TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.job_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.job_card_parts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.audits TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.audit_checklist TO authenticated;

-- ============================================
-- Migration Complete!
-- ============================================

-- To verify the migration:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name LIKE 'sla%';
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('lead_events', 'lead_media', 'lead_extra_charges', 'job_cards', 'invoices', 'audits');

