-- Add GST number column to workshops table
-- This migration adds the gst_number field to store workshop GST registration details

-- Add gst_number column (optional field, can be NULL)
ALTER TABLE public.workshops 
ADD COLUMN IF NOT EXISTS gst_number VARCHAR(20);

-- Add comment to document the column
COMMENT ON COLUMN public.workshops.gst_number IS 'GST registration number of the workshop (optional)';

-- Add index for faster lookups if needed
CREATE INDEX IF NOT EXISTS idx_workshops_gst_number ON public.workshops(gst_number) WHERE gst_number IS NOT NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'workshops' 
  AND column_name = 'gst_number';

