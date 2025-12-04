/**
 * Auditor Audits API
 * GET /api/auditor/audits
 * 
 * List all audits assigned to the current auditor
 * Supports filtering by status, type, date range
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile and verify Auditor role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, full_name, roles!inner(role_code, role_name)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'AUDITOR') {
      return NextResponse.json({ error: 'Forbidden: Auditor role required' }, { status: 403 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status'); // PENDING, IN_PROGRESS, COMPLETED, etc.
    const auditType = searchParams.get('type'); // JOB_CARD, WORKSHOP_FACILITY, SURPRISE
    const date = searchParams.get('date'); // YYYY-MM-DD
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Build query for audits (job card audits)
    let auditsQuery = supabase
      .from('audits')
      .select(`
        *,
        lead:service_leads!lead_id(
          id,
          lead_number,
          customer_name,
          customer_phone,
          vehicle_number,
          status,
          workshop:workshops!workshop_id(id, name, city, address, phone)
        ),
        auditor:users_login!auditor_id(full_name, phone)
      `)
      .eq('auditor_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) {
      auditsQuery = auditsQuery.eq('status', status);
    }
    if (auditType) {
      auditsQuery = auditsQuery.eq('audit_type', auditType);
    }
    if (date) {
      auditsQuery = auditsQuery.eq('audit_date::date', date);
    }

    const { data: audits, error: auditsError } = await auditsQuery;

    if (auditsError) {
      console.error('Error fetching audits:', auditsError);
      return NextResponse.json({ error: 'Failed to fetch audits' }, { status: 500 });
    }

    // Build query for workshop audits
    let workshopAuditsQuery = supabase
      .from('workshop_audits')
      .select(`
        *,
        workshop:workshops!workshop_id(id, name, city, address, phone, audit_score)
      `)
      .eq('auditor_id', user.id)
      .order('scheduled_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      workshopAuditsQuery = workshopAuditsQuery.eq('audit_status', status);
    }
    if (auditType) {
      workshopAuditsQuery = workshopAuditsQuery.eq('audit_type', auditType);
    }
    if (date) {
      workshopAuditsQuery = workshopAuditsQuery.eq('scheduled_date', date);
    }

    const { data: workshopAudits, error: workshopAuditsError } = await workshopAuditsQuery;

    if (workshopAuditsError) {
      console.error('Error fetching workshop audits:', workshopAuditsError);
    }

    // Get counts for dashboard stats
    const { count: pendingCount } = await supabase
      .from('audits')
      .select('*', { count: 'exact', head: true })
      .eq('auditor_id', user.id)
      .eq('status', 'PENDING');

    const { count: inProgressCount } = await supabase
      .from('audits')
      .select('*', { count: 'exact', head: true })
      .eq('auditor_id', user.id)
      .eq('status', 'IN_PROGRESS');

    const { count: completedCount } = await supabase
      .from('audits')
      .select('*', { count: 'exact', head: true })
      .eq('auditor_id', user.id)
      .eq('status', 'COMPLETED');

    // Get SLA at risk/breached
    const { count: slaAtRiskCount } = await supabase
      .from('audits')
      .select('*', { count: 'exact', head: true })
      .eq('auditor_id', user.id)
      .in('status', ['PENDING', 'IN_PROGRESS'])
      .eq('sla_status', 'AT_RISK');

    const { count: slaBreachedCount } = await supabase
      .from('audits')
      .select('*', { count: 'exact', head: true })
      .eq('auditor_id', user.id)
      .in('status', ['PENDING', 'IN_PROGRESS'])
      .eq('sla_status', 'BREACHED');

    // Format response
    const formattedAudits = (audits || []).map((audit: any) => ({
      id: audit.id,
      type: 'JOB_CARD',
      audit_type: audit.audit_type,
      status: audit.status,
      audit_mode: audit.audit_mode || 'DIGITAL',
      lead: audit.lead,
      workshop: audit.lead?.workshop,
      sla_status: audit.sla_status,
      sla_deadline: audit.sla_deadline,
      score: audit.score,
      images_compliance_score: audit.images_compliance_score,
      fraud_detected: audit.fraud_detected,
      escalated: audit.escalated,
      created_at: audit.created_at,
      audit_date: audit.audit_date,
    }));

    const formattedWorkshopAudits = (workshopAudits || []).map((audit: any) => ({
      id: audit.id,
      type: 'WORKSHOP_FACILITY',
      audit_type: audit.audit_type,
      status: audit.audit_status,
      audit_mode: audit.audit_mode || 'ON_GROUND',
      workshop: audit.workshop,
      scheduled_date: audit.scheduled_date,
      scheduled_time: audit.scheduled_time,
      score_percentage: audit.score_percentage,
      audit_grade: audit.audit_grade,
      requires_follow_up: audit.requires_follow_up,
      created_at: audit.created_at,
    }));

    return NextResponse.json({
      audits: [...formattedAudits, ...formattedWorkshopAudits],
      stats: {
        pending: pendingCount || 0,
        in_progress: inProgressCount || 0,
        completed: completedCount || 0,
        sla_at_risk: slaAtRiskCount || 0,
        sla_breached: slaBreachedCount || 0,
      },
      pagination: {
        page,
        limit,
        total: (pendingCount || 0) + (inProgressCount || 0) + (completedCount || 0),
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/auditor/audits:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

