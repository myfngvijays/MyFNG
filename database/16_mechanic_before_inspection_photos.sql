-- =====================================================
-- Mechanic Before Inspection Photo System
-- =====================================================
-- This script creates the necessary tables and functions
-- for mandatory BEFORE inspection photo capture system
-- for Workshop Mechanic role
-- =====================================================

-- 1. Create mechanic_job_photos table
CREATE TABLE IF NOT EXISTS public.mechanic_job_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.mechanic_jobs(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.service_leads(id) ON DELETE CASCADE,
  photo_type text NOT NULL CHECK (photo_type IN (
    -- BEFORE INSPECTION
    'BEFORE_FRONT', 'BEFORE_REAR', 'BEFORE_LEFT', 'BEFORE_RIGHT',
    'BEFORE_DASHBOARD', 'BEFORE_ENGINE_BAY', 'BEFORE_DAMAGE', 'BEFORE_TYRE',
    -- DURING SERVICE
    'DURING_OIL_DRAIN', 'DURING_OIL_POUR', 'DURING_FILTER_OLD', 'DURING_FILTER_NEW',
    'DURING_BRAKE_BEFORE', 'DURING_BRAKE_AFTER', 'DURING_AC_BEFORE', 'DURING_AC_AFTER',
    'DURING_PART_REMOVAL', 'DURING_PART_INSTALL',
    -- AFTER SERVICE
    'AFTER_FRONT', 'AFTER_REAR', 'AFTER_LEFT', 'AFTER_RIGHT',
    'AFTER_ENGINE_BAY', 'AFTER_OLD_PARTS', 'AFTER_NEW_PARTS', 'AFTER_ODOMETER'
  )),
  photo_category text NOT NULL CHECK (photo_category IN ('before', 'during', 'after')),
  photo_url text NOT NULL,
  thumbnail_url text,
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  timestamp timestamp with time zone DEFAULT now(),
  exif_data jsonb, -- Store full EXIF data
  annotations jsonb, -- Store annotation data (marks, notes on photo)
  notes text,
  odometer_reading numeric, -- For dashboard/odometer photos
  uploaded_by uuid NOT NULL REFERENCES public.users_login(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mechanic_job_photos_job_id ON public.mechanic_job_photos(job_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_job_photos_lead_id ON public.mechanic_job_photos(lead_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_job_photos_photo_category ON public.mechanic_job_photos(photo_category);
CREATE INDEX IF NOT EXISTS idx_mechanic_job_photos_photo_type ON public.mechanic_job_photos(photo_type);
CREATE INDEX IF NOT EXISTS idx_mechanic_job_photos_uploaded_by ON public.mechanic_job_photos(uploaded_by);

-- 2. Update mechanic_jobs table with new columns
ALTER TABLE public.mechanic_jobs
ADD COLUMN IF NOT EXISTS before_inspection_complete boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS before_photos_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS during_photos_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS after_photos_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS initial_odometer_reading numeric,
ADD COLUMN IF NOT EXISTS final_odometer_reading numeric,
ADD COLUMN IF NOT EXISTS min_before_photos integer DEFAULT 6,
ADD COLUMN IF NOT EXISTS min_after_photos integer DEFAULT 6;

-- 3. Function to update photo counts
CREATE OR REPLACE FUNCTION public.update_mechanic_job_photo_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update photo counts for the job
  UPDATE public.mechanic_jobs
  SET
    before_photos_count = (
      SELECT COUNT(*) FROM public.mechanic_job_photos
      WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
      AND photo_category = 'before'
    ),
    during_photos_count = (
      SELECT COUNT(*) FROM public.mechanic_job_photos
      WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
      AND photo_category = 'during'
    ),
    after_photos_count = (
      SELECT COUNT(*) FROM public.mechanic_job_photos
      WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
      AND photo_category = 'after'
    ),
    before_inspection_complete = (
      SELECT COUNT(*) >= COALESCE(
        (SELECT min_before_photos FROM public.mechanic_jobs WHERE id = COALESCE(NEW.job_id, OLD.job_id)),
        6
      )
      FROM public.mechanic_job_photos
      WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
      AND photo_category = 'before'
      AND photo_type IN ('BEFORE_FRONT', 'BEFORE_REAR', 'BEFORE_LEFT', 'BEFORE_RIGHT', 'BEFORE_DASHBOARD', 'BEFORE_ENGINE_BAY')
    )
  WHERE id = COALESCE(NEW.job_id, OLD.job_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update photo counts
DROP TRIGGER IF EXISTS trigger_update_mechanic_job_photo_counts ON public.mechanic_job_photos;
CREATE TRIGGER trigger_update_mechanic_job_photo_counts
AFTER INSERT OR UPDATE OR DELETE ON public.mechanic_job_photos
FOR EACH ROW
EXECUTE FUNCTION public.update_mechanic_job_photo_counts();

-- 4. Function to validate before inspection completion
CREATE OR REPLACE FUNCTION public.validate_before_inspection(job_id_param uuid)
RETURNS jsonb AS $$
DECLARE
  required_photos text[] := ARRAY['BEFORE_FRONT', 'BEFORE_REAR', 'BEFORE_LEFT', 'BEFORE_RIGHT', 'BEFORE_DASHBOARD', 'BEFORE_ENGINE_BAY'];
  missing_photos text[];
  photo_count integer;
  min_required integer;
BEGIN
  -- Get minimum required photos
  SELECT COALESCE(min_before_photos, 6) INTO min_required
  FROM public.mechanic_jobs
  WHERE id = job_id_param;
  
  -- Count uploaded photos
  SELECT COUNT(*) INTO photo_count
  FROM public.mechanic_job_photos
  WHERE job_id = job_id_param
  AND photo_category = 'before';
  
  -- Check for missing required photo types
  SELECT ARRAY_AGG(required_type) INTO missing_photos
  FROM unnest(required_photos) AS required_type
  WHERE NOT EXISTS (
    SELECT 1 FROM public.mechanic_job_photos
    WHERE job_id = job_id_param
    AND photo_type = required_type
  );
  
  RETURN jsonb_build_object(
    'is_valid', photo_count >= min_required AND (missing_photos IS NULL OR array_length(missing_photos, 1) = 0),
    'photo_count', photo_count,
    'min_required', min_required,
    'missing_photos', COALESCE(missing_photos, ARRAY[]::text[]),
    'has_gps', EXISTS (
      SELECT 1 FROM public.mechanic_job_photos
      WHERE job_id = job_id_param
      AND photo_category = 'before'
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
    )
  );
END;
$$ LANGUAGE plpgsql;

-- 5. Function to validate after service completion
CREATE OR REPLACE FUNCTION public.validate_after_service_completion(job_id_param uuid)
RETURNS jsonb AS $$
DECLARE
  required_photos text[] := ARRAY['AFTER_FRONT', 'AFTER_REAR', 'AFTER_LEFT', 'AFTER_RIGHT', 'AFTER_ENGINE_BAY', 'AFTER_OLD_PARTS'];
  missing_photos text[];
  photo_count integer;
  min_required integer;
  has_checklist boolean;
  has_parts boolean;
  has_notes boolean;
BEGIN
  -- Get minimum required photos
  SELECT COALESCE(min_after_photos, 6) INTO min_required
  FROM public.mechanic_jobs
  WHERE id = job_id_param;
  
  -- Count uploaded photos
  SELECT COUNT(*) INTO photo_count
  FROM public.mechanic_job_photos
  WHERE job_id = job_id_param
  AND photo_category = 'after';
  
  -- Check for missing required photo types
  SELECT ARRAY_AGG(required_type) INTO missing_photos
  FROM unnest(required_photos) AS required_type
  WHERE NOT EXISTS (
    SELECT 1 FROM public.mechanic_job_photos
    WHERE job_id = job_id_param
    AND photo_type = required_type
  );
  
  -- Check checklist completion
  SELECT checklist_completed INTO has_checklist
  FROM public.mechanic_jobs
  WHERE id = job_id_param;
  
  -- Check parts usage
  SELECT EXISTS (
    SELECT 1 FROM public.mechanic_parts_usage
    WHERE lead_id = (SELECT lead_id FROM public.mechanic_jobs WHERE id = job_id_param)
  ) INTO has_parts;
  
  -- Check if notes exist
  SELECT EXISTS (
    SELECT 1 FROM public.mechanic_jobs
    WHERE id = job_id_param
    AND (work_notes IS NOT NULL AND work_notes != '')
  ) INTO has_notes;
  
  RETURN jsonb_build_object(
    'is_valid', 
      photo_count >= min_required 
      AND (missing_photos IS NULL OR array_length(missing_photos, 1) = 0)
      AND COALESCE(has_checklist, false)
      AND has_notes,
    'photo_count', photo_count,
    'min_required', min_required,
    'missing_photos', COALESCE(missing_photos, ARRAY[]::text[]),
    'checklist_completed', COALESCE(has_checklist, false),
    'parts_recorded', has_parts,
    'notes_entered', has_notes
  );
END;
$$ LANGUAGE plpgsql;

-- 6. RLS Policies
ALTER TABLE public.mechanic_job_photos ENABLE ROW LEVEL SECURITY;

-- Policy: Mechanics can view their own job photos
CREATE POLICY "Mechanics can view their job photos"
ON public.mechanic_job_photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    JOIN public.users_login ul ON mj.mechanic_id = ul.id
    WHERE mj.id = mechanic_job_photos.job_id
    AND ul.id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.service_leads sl
    JOIN public.users_login ul2 ON ul2.workshop_id = sl.workshop_id
    JOIN public.roles r ON r.id = ul2.role_id
    WHERE sl.id = mechanic_job_photos.lead_id
    AND ul2.id = auth.uid()
    AND r.role_code IN ('WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'SUPER_ADMIN')
  )
);

-- Policy: Mechanics can insert their own job photos
CREATE POLICY "Mechanics can insert their job photos"
ON public.mechanic_job_photos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    JOIN public.users_login ul ON mj.mechanic_id = ul.id
    WHERE mj.id = mechanic_job_photos.job_id
    AND ul.id = auth.uid()
  )
  AND uploaded_by = auth.uid()
);

-- Policy: Mechanics can update their own job photos
CREATE POLICY "Mechanics can update their job photos"
ON public.mechanic_job_photos
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    JOIN public.users_login ul ON mj.mechanic_id = ul.id
    WHERE mj.id = mechanic_job_photos.job_id
    AND ul.id = auth.uid()
  )
  AND uploaded_by = auth.uid()
);

-- Policy: Mechanics can delete their own job photos (before completion)
CREATE POLICY "Mechanics can delete their job photos"
ON public.mechanic_job_photos
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.mechanic_jobs mj
    JOIN public.users_login ul ON mj.mechanic_id = ul.id
    WHERE mj.id = mechanic_job_photos.job_id
    AND ul.id = auth.uid()
    AND mj.mechanic_status != 'COMPLETED'
  )
  AND uploaded_by = auth.uid()
);

-- 7. Comments
COMMENT ON TABLE public.mechanic_job_photos IS 'Photos captured by mechanics during before inspection, during service, and after completion';
COMMENT ON COLUMN public.mechanic_job_photos.photo_type IS 'Type of photo: BEFORE_*, DURING_*, AFTER_*';
COMMENT ON COLUMN public.mechanic_job_photos.photo_category IS 'Category: before, during, or after';
COMMENT ON COLUMN public.mechanic_job_photos.exif_data IS 'Full EXIF metadata including GPS, timestamp, camera info';
COMMENT ON COLUMN public.mechanic_job_photos.annotations IS 'JSON object storing annotation marks on photo (scratches, dents)';
COMMENT ON COLUMN public.mechanic_job_photos.latitude IS 'GPS latitude from EXIF data';
COMMENT ON COLUMN public.mechanic_job_photos.longitude IS 'GPS longitude from EXIF data';

COMMENT ON COLUMN public.mechanic_jobs.before_inspection_complete IS 'Whether minimum required before photos are uploaded';
COMMENT ON COLUMN public.mechanic_jobs.initial_odometer_reading IS 'Odometer reading from BEFORE_DASHBOARD photo';
COMMENT ON COLUMN public.mechanic_jobs.final_odometer_reading IS 'Final odometer reading from AFTER_ODOMETER photo';

-- 8. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mechanic_job_photos TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_before_inspection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_after_service_completion(uuid) TO authenticated;

