-- =====================================================
-- MIGRATION: Update lead_media table
-- Purpose: Store all media attachments for leads
-- =====================================================

-- Add missing columns to existing lead_media table
DO $$ 
BEGIN
  -- Add category if missing (should exist)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_media' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.lead_media ADD COLUMN category VARCHAR(50);
  END IF;
  
  -- Add thumbnail_url if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_media' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE public.lead_media ADD COLUMN thumbnail_url TEXT;
  END IF;
  
  -- Add title if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_media' AND column_name = 'title'
  ) THEN
    ALTER TABLE public.lead_media ADD COLUMN title VARCHAR(200);
  END IF;
  
  -- Add description if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_media' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.lead_media ADD COLUMN description TEXT;
  END IF;
  
  -- Add GPS coordinates if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_media' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE public.lead_media ADD COLUMN latitude DECIMAL(10,7);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_media' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE public.lead_media ADD COLUMN longitude DECIMAL(10,7);
  END IF;
  
  -- Add is_deleted flag for soft delete
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_media' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE public.lead_media ADD COLUMN is_deleted BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Update existing columns if needed
ALTER TABLE public.lead_media
  ALTER COLUMN media_type TYPE VARCHAR(50);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lead_media_lead_id ON public.lead_media(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_media_category ON public.lead_media(category);
CREATE INDEX IF NOT EXISTS idx_lead_media_type ON public.lead_media(media_type);
CREATE INDEX IF NOT EXISTS idx_lead_media_uploaded_by ON public.lead_media(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_lead_media_created ON public.lead_media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_media_not_deleted ON public.lead_media(is_deleted) WHERE is_deleted = false;

-- Comments
COMMENT ON TABLE public.lead_media IS 'All media files (photos/videos/docs) related to leads';
COMMENT ON COLUMN public.lead_media.category IS 'Media category: customer_before, workshop_before, workshop_progress, workshop_after, audit, invoice, other';
COMMENT ON COLUMN public.lead_media.media_type IS 'MIME type or simple type: image, video, document, pdf, etc.';
COMMENT ON COLUMN public.lead_media.thumbnail_url IS 'Thumbnail URL for preview (especially for videos)';
COMMENT ON COLUMN public.lead_media.latitude IS 'GPS latitude where photo was taken';
COMMENT ON COLUMN public.lead_media.longitude IS 'GPS longitude where photo was taken';

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Lead media table updated successfully!';
END $$;

