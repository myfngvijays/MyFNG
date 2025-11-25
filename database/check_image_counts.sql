-- Check mechanic_jobs table columns for image counts
SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'mechanic_jobs' 
  AND column_name LIKE '%image%'
ORDER BY column_name;

-- Check if counts are being updated
SELECT 
  lead_id,
  before_images_count,
  progress_images_count,
  after_images_count,
  min_before_images,
  min_progress_images,
  min_after_images
FROM mechanic_jobs
WHERE lead_id = '94b886e6-7054-4885-b163-cb3275c2f627';

-- Check actual media uploaded
SELECT 
  media_category,
  COUNT(*) as count
FROM mechanic_media
WHERE lead_id = '94b886e6-7054-4885-b163-cb3275c2f627'
GROUP BY media_category;

