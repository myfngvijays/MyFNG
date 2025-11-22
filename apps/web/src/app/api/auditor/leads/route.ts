/**
 * Auditor Leads API
 * GET /api/auditor/leads
 * 
 * Fetch leads requiring audit or flagged for review
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, full_name, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify Auditor role
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'AUDITOR' && roleCode !== 'QC_AUDITOR') {
      return NextResponse.json({ error: 'Forbidden: Auditor role required' }, { status: 403 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter') || 'pending'; // pending, approved, flagged, all
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');

    // Build query
    let query = supabase
      .from('service_leads')
      .select(`
        *,
        workshop:workshops!workshop_id(name, phone, audit_score),
        mechanic:users_login!assigned_mechanic_id(full_name),
        supervisor:users_login!assigned_supervisor_id(full_name),
        auditor:users_login!audit_performed_by(full_name)
      `)
      .eq('audit_required', true)
      .order('updated_at', { ascending: false });

    // Apply filters
    if (filter === 'pending') {
      query = query.in('audit_status', ['PENDING', 'AUDIT_PENDING', null]);
    } else if (filter === 'approved') {
      query = query.eq('audit_status', 'AUDIT_APPROVED');
    } else if (filter === 'flagged') {
      query = query.eq('audit_status', 'AUDIT_FLAGGED');
    } else if (filter === 'high_value') {
      // High value leads (amount > 10000)
      query = query.gte('final_amount', 10000);
    }

    // Apply priority filter
    if (priority) {
      query = query.eq('priority', priority);
    }

    // Apply search
    if (search) {
      query = query.or(
        `lead_number.ilike.%${search}%,customer_name.ilike.%${search}%,vehicle_number.ilike.%${search}%`
      );
    }

    // Limit results
    query = query.limit(100);

    const { data: leads, error: leadsError } = await query;

    if (leadsError) {
      console.error('Error fetching auditor leads:', leadsError);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    // Calculate stats
    const stats = {
      total: leads?.length || 0,
      pending: leads?.filter(l => !l.audit_status || l.audit_status === 'PENDING' || l.audit_status === 'AUDIT_PENDING').length || 0,
      approved: leads?.filter(l => l.audit_status === 'AUDIT_APPROVED').length || 0,
      flagged: leads?.filter(l => l.audit_status === 'AUDIT_FLAGGED').length || 0,
      highValue: leads?.filter(l => l.final_amount && l.final_amount > 10000).length || 0,
      avgAuditTime: 0, // TODO: Calculate from audit_performed_at - created_at
    };

    return NextResponse.json({
      success: true,
      leads: leads || [],
      stats,
      filter,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in auditor leads API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

