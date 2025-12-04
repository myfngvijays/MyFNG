/**
 * Auditor Escalations API
 * GET /api/auditor/escalations
 * 
 * Fetch escalations related to audits
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

    // Verify Auditor role
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    if (roleCode !== 'AUDITOR') {
      return NextResponse.json({ error: 'Forbidden: Auditor role required' }, { status: 403 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status'); // OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED
    const priority = searchParams.get('priority'); // LOW, MEDIUM, HIGH, URGENT, CRITICAL
    const type = searchParams.get('type'); // CUSTOMER, WORKSHOP, TEAM_MEMBER, SLA_BREACH

    // Build query for audit escalations
    let query = supabase
      .from('audit_escalations')
      .select(`
        *,
        audit:audits!audit_id(
          id,
          lead:service_leads!lead_id(
            id,
            lead_number,
            customer_name,
            vehicle_number,
            workshop:workshops!workshop_id(id, name, city)
          )
        ),
        escalated_by_user:users_login!escalated_by(full_name, phone),
        resolved_by_user:users_login!resolved_by(full_name)
      `)
      .eq('escalated_by', user.id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }
    if (type) {
      query = query.eq('escalation_type', type);
    }

    const { data: escalations, error: escalationsError } = await query;

    if (escalationsError) {
      console.error('Error fetching escalations:', escalationsError);
      return NextResponse.json({ error: 'Failed to fetch escalations' }, { status: 500 });
    }

    // Get counts for stats
    const { count: openCount } = await supabase
      .from('audit_escalations')
      .select('*', { count: 'exact', head: true })
      .eq('escalated_by', user.id)
      .eq('status', 'OPEN');

    const { count: inProgressCount } = await supabase
      .from('audit_escalations')
      .select('*', { count: 'exact', head: true })
      .eq('escalated_by', user.id)
      .eq('status', 'IN_PROGRESS');

    const { count: resolvedCount } = await supabase
      .from('audit_escalations')
      .select('*', { count: 'exact', head: true })
      .eq('escalated_by', user.id)
      .eq('status', 'RESOLVED');

    const { count: criticalCount } = await supabase
      .from('audit_escalations')
      .select('*', { count: 'exact', head: true })
      .eq('escalated_by', user.id)
      .eq('priority', 'CRITICAL')
      .in('status', ['OPEN', 'IN_PROGRESS']);

    // Format response
    const formattedEscalations = (escalations || []).map((escalation: any) => ({
      id: escalation.id,
      escalation_number: escalation.escalation_number,
      audit_id: escalation.audit_id,
      lead: escalation.audit?.lead,
      escalation_type: escalation.escalation_type,
      priority: escalation.priority,
      status: escalation.status,
      reason: escalation.reason,
      description: escalation.description,
      escalated_by: escalation.escalated_by_user?.full_name || 'Unknown',
      resolved_by: escalation.resolved_by_user?.full_name || null,
      resolved_at: escalation.resolved_at,
      resolution_notes: escalation.resolution_notes,
      created_at: escalation.created_at,
    }));

    return NextResponse.json({
      escalations: formattedEscalations,
      stats: {
        open: openCount || 0,
        in_progress: inProgressCount || 0,
        resolved: resolvedCount || 0,
        critical: criticalCount || 0,
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in auditor escalations API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

