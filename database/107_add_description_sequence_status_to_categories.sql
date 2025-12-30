-- =====================================================
-- MIGRATION: Add description/sequence/status columns to categories
-- =====================================================

ALTER TABLE IF EXISTS public.categories
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS sequence INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status BOOLEAN NOT NULL DEFAULT true;

-- Helpful indexes for filtering/sorting
CREATE INDEX IF NOT EXISTS idx_categories_status ON public.categories(status);
CREATE INDEX IF NOT EXISTS idx_categories_sequence ON public.categories(sequence);


