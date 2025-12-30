-- =====================================================
-- MIGRATION: Create categories table + link to service_types
-- Purpose: Store category details and reference from service_types
-- =====================================================

-- Ensure UUID generator exists (used by uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. Categories master table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.categories (
  uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(150) NOT NULL,
  category_images TEXT[], -- array of image URLs/paths
  category_icon TEXT,     -- icon URL/path
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT categories_category_unique UNIQUE (category)
);

CREATE INDEX IF NOT EXISTS idx_categories_category ON public.categories(category);

-- =====================================================
-- 2. Add category UUID reference to service_types
-- =====================================================
ALTER TABLE IF EXISTS public.service_types
  ADD COLUMN IF NOT EXISTS category_uuid UUID;

-- Add FK constraint safely (Postgres doesn't support IF NOT EXISTS for constraints)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'service_types'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_schema = 'public'
      AND tc.table_name = 'service_types'
      AND tc.constraint_name = 'service_types_category_uuid_fkey'
  ) THEN
    ALTER TABLE public.service_types
      ADD CONSTRAINT service_types_category_uuid_fkey
      FOREIGN KEY (category_uuid)
      REFERENCES public.categories(uuid)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_types_category_uuid
  ON public.service_types(category_uuid);


