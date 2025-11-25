-- Manually update the counts for now
UPDATE mechanic_jobs
SET 
  before_images_count = (
    SELECT COUNT(*) FROM mechanic_media 
    WHERE lead_id = mechanic_jobs.lead_id 
    AND media_category = 'BEFORE'
  ),
  progress_images_count = (
    SELECT COUNT(*) FROM mechanic_media 
    WHERE lead_id = mechanic_jobs.lead_id 
    AND media_category = 'PROGRESS'
  ),
  after_images_count = (
    SELECT COUNT(*) FROM mechanic_media 
    WHERE lead_id = mechanic_jobs.lead_id 
    AND media_category = 'AFTER'
  )
WHERE lead_id = '94b886e6-7054-4885-b163-cb3275c2f627';

-- Verify update
SELECT 
  lead_id,
  before_images_count,
  progress_images_count,
  after_images_count
FROM mechanic_jobs
WHERE lead_id = '94b886e6-7054-4885-b163-cb3275c2f627';

