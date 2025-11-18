-- =====================================================
-- MIGRATION: Update service_leads table structure
-- Purpose: Align with new lead management flow
-- =====================================================

-- Add new columns that are missing from current structure
ALTER TABLE public.service_leads
  -- Lead identification and tracking
  ADD COLUMN IF NOT EXISTS created_from VARCHAR(50) DEFAULT 'WEB',
  ADD COLUMN IF NOT EXISTS lead_priority VARCHAR(20) DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS city_id INTEGER NULL,  -- FK to cities table (if normalized)
  ADD COLUMN IF NOT EXISTS model_id INTEGER NULL,  -- FK to car_models table (if normalized)
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.users_login(id),  -- Who assigned the lead
  
  -- Enhanced customer fields
  ADD COLUMN IF NOT EXISTS customer_alternate_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS customer_address TEXT,
  ADD COLUMN IF NOT EXISTS customer_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS customer_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS contact_method VARCHAR(20) DEFAULT 'CALL',
  
  -- Vehicle details (additional fields)
  ADD COLUMN IF NOT EXISTS vehicle_variant VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vehicle_vin VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vehicle_fuel_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS odometer_km INTEGER,
  
  -- Service selection (JSONB arrays for flexibility)
  ADD COLUMN IF NOT EXISTS service_type_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subservice_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS problem_description TEXT,
  
  -- Pickup/delivery tracking
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS pickup_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS pickup_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS pickup_otp VARCHAR(10),
  ADD COLUMN IF NOT EXISTS assigned_pickup_id UUID REFERENCES public.users_login(id),
  ADD COLUMN IF NOT EXISTS pickup_status VARCHAR(30) DEFAULT 'NOT_ASSIGNED',
  
  -- Scheduling
  ADD COLUMN IF NOT EXISTS preferred_slot_start TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS preferred_slot_end TIMESTAMP WITH TIME ZONE,
  
  -- Payment details
  ADD COLUMN IF NOT EXISTS payment_txn_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS invoice_amount DECIMAL(12,2),
  
  -- Audit tracking
  ADD COLUMN IF NOT EXISTS audit_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS audit_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS audit_remarks TEXT,
  
  -- SLA tracking
  ADD COLUMN IF NOT EXISTS sla_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS sla_state VARCHAR(20) DEFAULT 'ON_TIME',
  
  -- Escalation & reopening
  ADD COLUMN IF NOT EXISTS reopen_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalation BOOLEAN DEFAULT false,
  
  -- Internal notes
  ADD COLUMN IF NOT EXISTS notes_internal TEXT,
  
  -- Metadata & attachments (flexible JSONB)
  ADD COLUMN IF NOT EXISTS attachments JSONB,
  ADD COLUMN IF NOT EXISTS meta JSONB,
  
  -- Soft delete
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Update existing columns to match new structure
ALTER TABLE public.service_leads
  ALTER COLUMN lead_type TYPE VARCHAR(20),
  ALTER COLUMN status TYPE VARCHAR(30);

-- Add column comments for documentation
COMMENT ON COLUMN public.service_leads.created_from IS 'Source channel: APP, WEB, TELECALLER, GMB, WHATSAPP, PARTNER, IMPORT';
COMMENT ON COLUMN public.service_leads.lead_priority IS 'Priority: LOW, NORMAL, HIGH, URGENT';
COMMENT ON COLUMN public.service_leads.service_type_ids IS 'Array of service type IDs (JSONB)';
COMMENT ON COLUMN public.service_leads.subservice_ids IS 'Array of subservice IDs (JSONB)';
COMMENT ON COLUMN public.service_leads.pickup_status IS 'Pickup status: NOT_ASSIGNED, PENDING, PICKED, IN_TRANSIT, DROPPED';
COMMENT ON COLUMN public.service_leads.sla_state IS 'SLA state: ON_TIME, AT_RISK, BREACHED';
COMMENT ON COLUMN public.service_leads.meta IS 'Flexible metadata: utm params, device info, raw payload';
COMMENT ON COLUMN public.service_leads.attachments IS 'Media attachments metadata';
COMMENT ON COLUMN public.service_leads.deleted_at IS 'Soft delete timestamp';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_created_from ON public.service_leads(created_from);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON public.service_leads(lead_priority);
CREATE INDEX IF NOT EXISTS idx_leads_city_id ON public.service_leads(city_id);
CREATE INDEX IF NOT EXISTS idx_leads_model_id ON public.service_leads(model_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_by ON public.service_leads(assigned_by);
CREATE INDEX IF NOT EXISTS idx_leads_pickup_status ON public.service_leads(pickup_status);
CREATE INDEX IF NOT EXISTS idx_leads_sla_state ON public.service_leads(sla_state);
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.service_leads(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_audit_required ON public.service_leads(audit_required) WHERE audit_required = true;
CREATE INDEX IF NOT EXISTS idx_leads_escalation ON public.service_leads(escalation) WHERE escalation = true;

-- Create GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_leads_service_types_gin ON public.service_leads USING gin(service_type_ids);
CREATE INDEX IF NOT EXISTS idx_leads_subservices_gin ON public.service_leads USING gin(subservice_ids);
CREATE INDEX IF NOT EXISTS idx_leads_meta_gin ON public.service_leads USING gin(meta);

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Service leads table updated successfully!';
END $$;

