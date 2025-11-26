-- ============================================
-- PHASE 1.2: SHORT URLS TABLE
-- Purpose: Store short URLs for invoice/payment links
-- Date: November 26, 2025
-- ============================================

CREATE TABLE IF NOT EXISTS short_urls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Short URL Details
  short_code VARCHAR(20) UNIQUE NOT NULL,
  long_url TEXT NOT NULL,
  
  -- Entity Reference
  entity_type VARCHAR(50) NOT NULL, -- invoice, payment, receipt
  entity_id UUID NOT NULL,
  
  -- Analytics
  clicks INTEGER DEFAULT 0,
  last_clicked_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
  deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_short_urls_short_code ON short_urls(short_code);
CREATE INDEX IF NOT EXISTS idx_short_urls_entity ON short_urls(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_short_urls_created_at ON short_urls(created_at DESC);

-- Comments
COMMENT ON TABLE short_urls IS 'Short URLs for invoice, payment, and receipt links';
COMMENT ON COLUMN short_urls.short_code IS '8-character short code for URL';
COMMENT ON COLUMN short_urls.clicks IS 'Number of times the short URL was clicked';

