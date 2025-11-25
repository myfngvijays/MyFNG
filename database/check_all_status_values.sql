-- Check all possible status values in the database
SELECT DISTINCT status, COUNT(*) as count
FROM service_leads
GROUP BY status
ORDER BY count DESC;

-- This will show you ALL status values used in your system
-- Add any missing ones to the filter dropdown

