-- Add part_id column to mechanic_job_photos
-- This links photos to specific parts used in the job

-- Add column if not exists
ALTER TABLE mechanic_job_photos
  ADD COLUMN IF NOT EXISTS part_id UUID;

-- Add foreign key constraint to mechanic_parts_usage table
ALTER TABLE mechanic_job_photos
  DROP CONSTRAINT IF EXISTS mechanic_job_photos_part_id_fkey;

ALTER TABLE mechanic_job_photos
  ADD CONSTRAINT mechanic_job_photos_part_id_fkey
  FOREIGN KEY (part_id) 
  REFERENCES mechanic_parts_usage(id) 
  ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_mechanic_job_photos_part_id 
  ON mechanic_job_photos(part_id);

-- Add comment
COMMENT ON COLUMN mechanic_job_photos.part_id IS 
  'Optional link to specific part - used for part-specific photos (old/new part photos)';

-- Verify
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'mechanic_job_photos'
  AND column_name = 'part_id';

