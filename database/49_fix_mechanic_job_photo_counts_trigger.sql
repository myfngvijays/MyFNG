-- =====================================================
-- FIX MECHANIC JOB PHOTO COUNTS TRIGGER
-- Purpose: Update trigger to correctly update photo counts in mechanic_jobs table
-- Date: 2025-12-02
-- =====================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_mechanic_job_photo_counts ON public.mechanic_job_photos;

-- Create or replace function to update photo counts from mechanic_job_photos table
CREATE OR REPLACE FUNCTION public.update_mechanic_job_photo_counts()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id uuid;
BEGIN
  -- Get job_id from NEW or OLD
  v_job_id := COALESCE(NEW.job_id, OLD.job_id);
  
  IF v_job_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Update photo counts for the job
  UPDATE public.mechanic_jobs
  SET
    before_images_count = (
      SELECT COUNT(*)::integer
      FROM public.mechanic_job_photos
      WHERE job_id = v_job_id
      AND photo_category = 'before'
    ),
    progress_images_count = (
      SELECT COUNT(*)::integer
      FROM public.mechanic_job_photos
      WHERE job_id = v_job_id
      AND photo_category = 'during'
    ),
    after_images_count = (
      SELECT COUNT(*)::integer
      FROM public.mechanic_job_photos
      WHERE job_id = v_job_id
      AND photo_category = 'after'
    ),
    updated_at = NOW()
  WHERE id = v_job_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update photo counts
CREATE TRIGGER trigger_update_mechanic_job_photo_counts
AFTER INSERT OR UPDATE OR DELETE ON public.mechanic_job_photos
FOR EACH ROW
EXECUTE FUNCTION public.update_mechanic_job_photo_counts();

-- Manually update counts for existing jobs
UPDATE public.mechanic_jobs mj
SET
  before_images_count = (
    SELECT COUNT(*)::integer
    FROM public.mechanic_job_photos mjp
    WHERE mjp.job_id = mj.id
    AND mjp.photo_category = 'before'
  ),
  progress_images_count = (
    SELECT COUNT(*)::integer
    FROM public.mechanic_job_photos mjp
    WHERE mjp.job_id = mj.id
    AND mjp.photo_category = 'during'
  ),
  after_images_count = (
    SELECT COUNT(*)::integer
    FROM public.mechanic_job_photos mjp
    WHERE mjp.job_id = mj.id
    AND mjp.photo_category = 'after'
  ),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM public.mechanic_job_photos mjp
  WHERE mjp.job_id = mj.id
);

DO $$
BEGIN
    RAISE NOTICE '✅ Mechanic Job Photo Counts Trigger Fixed!';
END $$;

