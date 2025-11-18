-- =====================================================
-- MASTER MIGRATION: Complete Lead Management System
-- Purpose: Run all lead-related migrations in correct order
-- =====================================================
-- 
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Copy and paste this ENTIRE file
-- 3. Click "Run" (or press Ctrl+Enter)
-- 4. Wait for success messages
-- 
-- This will:
-- - Update service_leads table with new columns
-- - Create lead_pricing_items table
-- - Update lead_events table
-- - Update lead_media table
-- - Update lead_extra_charges table
-- =====================================================

BEGIN;

-- =====================================================
-- Step 1: Update service_leads table
-- =====================================================
DO $$ BEGIN RAISE NOTICE 'Step 1/5: Updating service_leads table...'; END $$;

ALTER TABLE public.service_leads
  ADD COLUMN IF NOT EXISTS created_from VARCHAR(50) DEFAULT 'WEB',
  ADD COLUMN IF NOT EXISTS lead_priority VARCHAR(20) DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS city_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS model_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.users_login(id),
  ADD COLUMN IF NOT EXISTS customer_alternate_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS customer_address TEXT,
  ADD COLUMN IF NOT EXISTS customer_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS customer_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS contact_method VARCHAR(20) DEFAULT 'CALL',
  ADD COLUMN IF NOT EXISTS vehicle_variant VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vehicle_vin VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vehicle_fuel_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS odometer_km INTEGER,
  ADD COLUMN IF NOT EXISTS service_type_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subservice_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS problem_description TEXT,
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS pickup_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS pickup_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS pickup_otp VARCHAR(10),
  ADD COLUMN IF NOT EXISTS assigned_pickup_id UUID REFERENCES public.users_login(id),
  ADD COLUMN IF NOT EXISTS pickup_status VARCHAR(30) DEFAULT 'NOT_ASSIGNED',
  ADD COLUMN IF NOT EXISTS preferred_slot_start TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS preferred_slot_end TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS payment_txn_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS invoice_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS audit_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS audit_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS audit_remarks TEXT,
  ADD COLUMN IF NOT EXISTS sla_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS sla_state VARCHAR(20) DEFAULT 'ON_TIME',
  ADD COLUMN IF NOT EXISTS reopen_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalation BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes_internal TEXT,
  ADD COLUMN IF NOT EXISTS attachments JSONB,
  ADD COLUMN IF NOT EXISTS meta JSONB,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_created_from ON public.service_leads(created_from);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON public.service_leads(lead_priority);
CREATE INDEX IF NOT EXISTS idx_leads_city_id ON public.service_leads(city_id);
CREATE INDEX IF NOT EXISTS idx_leads_model_id ON public.service_leads(model_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_by ON public.service_leads(assigned_by);
CREATE INDEX IF NOT EXISTS idx_leads_pickup_status ON public.service_leads(pickup_status);
CREATE INDEX IF NOT EXISTS idx_leads_sla_state ON public.service_leads(sla_state);
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.service_leads(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_service_types_gin ON public.service_leads USING gin(service_type_ids);
CREATE INDEX IF NOT EXISTS idx_leads_subservices_gin ON public.service_leads USING gin(subservice_ids);

-- =====================================================
-- Step 2: Create lead_pricing_items table
-- =====================================================
DO $$ BEGIN RAISE NOTICE 'Step 2/5: Creating lead_pricing_items table...'; END $$;

CREATE TABLE IF NOT EXISTS public.lead_pricing_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  service_type_id INTEGER NULL,
  subservice_id INTEGER NULL,
  item_name VARCHAR(200) NOT NULL,
  item_description TEXT,
  base_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  final_price DECIMAL(12,2) NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  tax_percentage DECIMAL(5,2) DEFAULT 0,
  is_addon BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  added_by UUID REFERENCES public.users_login(id),
  locked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_items_lead_id ON public.lead_pricing_items(lead_id);
CREATE INDEX IF NOT EXISTS idx_pricing_items_status ON public.lead_pricing_items(status);

-- =====================================================
-- Step 3: Update lead_events table (if exists, otherwise create)
-- =====================================================
DO $$ BEGIN RAISE NOTICE 'Step 3/5: Updating lead_events table...'; END $$;

CREATE TABLE IF NOT EXISTS public.lead_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(50),
  actor VARCHAR(100),
  actor_name VARCHAR(200),
  actor_role VARCHAR(50),
  event_description TEXT,
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON public.lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_type ON public.lead_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lead_events_created ON public.lead_events(created_at DESC);

-- =====================================================
-- Step 4: Update lead_media table
-- =====================================================
DO $$ BEGIN RAISE NOTICE 'Step 4/5: Updating lead_media table...'; END $$;

ALTER TABLE public.lead_media
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS title VARCHAR(200),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_lead_media_category ON public.lead_media(category);
CREATE INDEX IF NOT EXISTS idx_lead_media_not_deleted ON public.lead_media(is_deleted) WHERE is_deleted = false;

-- =====================================================
-- Step 5: Update lead_extra_charges table
-- =====================================================
DO $$ BEGIN RAISE NOTICE 'Step 5/5: Updating lead_extra_charges table...'; END $$;

ALTER TABLE public.lead_extra_charges
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS customer_approved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_extra_charges_category ON public.lead_extra_charges(category);
CREATE INDEX IF NOT EXISTS idx_extra_charges_urgent ON public.lead_extra_charges(is_urgent) WHERE is_urgent = true;

COMMIT;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ All lead management migrations completed successfully!';
  RAISE NOTICE '📋 Tables updated: service_leads, lead_pricing_items, lead_events, lead_media, lead_extra_charges';
END $$;

