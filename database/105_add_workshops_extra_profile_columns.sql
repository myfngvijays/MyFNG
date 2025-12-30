-- =====================================================
-- MIGRATION: Add extra workshop profile columns (admin/import sheet)
-- Purpose: Add additional metadata columns to public.workshops
-- =====================================================

ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS ro_mumbai TEXT,
  ADD COLUMN IF NOT EXISTS system TEXT,
  ADD COLUMN IF NOT EXISTS category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS workshop_area VARCHAR(255),
  ADD COLUMN IF NOT EXISTS workshop_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS landmark TEXT,
  ADD COLUMN IF NOT EXISTS distance NUMERIC,
  ADD COLUMN IF NOT EXISTS near_famous_area TEXT,
  ADD COLUMN IF NOT EXISTS near_area_google_map TEXT,
  ADD COLUMN IF NOT EXISTS manager_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS manager_mobile VARCHAR(20),
  ADD COLUMN IF NOT EXISTS manager_name2 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS manager_mobile2 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS manager_name3 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS manager_mobile3 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS creadit_card_swap BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS engine_oil BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS insurance_claim BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS service_pincode VARCHAR(10),
  ADD COLUMN IF NOT EXISTS notification_mobile VARCHAR(20),
  ADD COLUMN IF NOT EXISTS active_date DATE,
  ADD COLUMN IF NOT EXISTS retainer_fee NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS prepaid_postpaid VARCHAR(20),
  ADD COLUMN IF NOT EXISTS mou BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS board BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gmb BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_group_id TEXT,
  ADD COLUMN IF NOT EXISTS service_panel_issue BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS short_address TEXT;


