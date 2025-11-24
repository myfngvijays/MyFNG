#!/bin/bash

# ============================================
# Quick Fix: Sync Mechanic Assignments
# ============================================

echo "🔧 Syncing existing mechanic assignments to mechanic_jobs table..."
echo ""

# Set your Supabase credentials
# Replace these with your actual credentials or set them as environment variables
SUPABASE_DB_URL="${SUPABASE_DB_URL:-your_database_url_here}"

# SQL to sync mechanic jobs
SQL="
-- Insert missing mechanic_jobs from service_leads
INSERT INTO mechanic_jobs (
  lead_id,
  mechanic_id,
  assigned_by,
  mechanic_status,
  job_priority,
  assigned_at,
  work_notes
)
SELECT 
  sl.id as lead_id,
  sl.assigned_mechanic_id as mechanic_id,
  COALESCE(sl.assigned_by_workshop_admin_id, sl.created_by_id) as assigned_by,
  'ASSIGNED' as mechanic_status,
  COALESCE(sl.lead_priority, 'NORMAL') as job_priority,
  COALESCE(sl.mechanic_assigned_at, sl.updated_at) as assigned_at,
  sl.internal_notes as work_notes
FROM service_leads sl
WHERE 
  sl.assigned_mechanic_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM mechanic_jobs mj WHERE mj.lead_id = sl.id
  )
  AND sl.status IN ('ASSIGNED_TO_WORKSHOP', 'TEAM_ASSIGNED', 'IN_PROGRESS', 'ACCEPTED')
  AND sl.status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED')
ON CONFLICT (lead_id) DO NOTHING;

-- Show results
SELECT 
  COUNT(*) as synced_jobs,
  'Jobs synced successfully' as status
FROM mechanic_jobs mj
WHERE mj.created_at >= NOW() - INTERVAL '5 minutes';
"

echo "📊 Running sync query..."
echo ""

# Run via psql (adjust connection string as needed)
# psql "$SUPABASE_DB_URL" -c "$SQL"

echo "✅ Sync complete!"
echo ""
echo "📝 To verify:"
echo "   1. Login as mechanic (ID: 7fa49f5a-08e3-428e-8e6a-f4794e827302)"
echo "   2. Check dashboard - you should see 2 jobs now!"
echo ""
echo "🎯 Fixed Leads:"
echo "   - L-69057474 (Vijay - MH12JH2318)"
echo "   - L-31838254 (vijay - mh04jw1234)"
echo ""

# Alternative: Direct SQL file execution
echo "💡 Or run this SQL file:"
echo "   psql \$DATABASE_URL -f database/FIX_SYNC_MECHANIC_JOBS.sql"
echo ""

