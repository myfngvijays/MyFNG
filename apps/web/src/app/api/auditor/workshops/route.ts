/**
 * Auditor Workshops API
 * GET /api/auditor/workshops
 * 
 * Fetch workshops with audit scores and compliance status
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
    const search = searchParams.get('search');
    const city = searchParams.get('city');
    const minScore = searchParams.get('min_score');
    const sortBy = searchParams.get('sort_by') || 'audit_score'; // audit_score, name, last_audit_date

    // Build query
    let query = supabase
      .from('workshops')
      .select(`
        *,
        latest_audit:workshop_audits!workshop_audits_workshop_id_fkey(
          id,
          audit_status,
          audit_grade,
          score_percentage,
          scheduled_date,
          completed_at
        ),
        audit_count:workshop_audits(count),
        open_action_items:audit_action_items(count)
      `)
      .order('name', { ascending: true });

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,address.ilike.%${search}%`);
    }
    if (city) {
      query = query.eq('city', city);
    }
    if (minScore) {
      query = query.gte('audit_score', parseFloat(minScore));
    }

    const { data: workshops, error: workshopsError } = await query;

    if (workshopsError) {
      console.error('Error fetching workshops:', workshopsError);
      return NextResponse.json({ error: 'Failed to fetch workshops' }, { status: 500 });
    }

    // Get unique cities for filter
    const { data: citiesData } = await supabase
      .from('workshops')
      .select('city')
      .not('city', 'is', null);

    const cities = [...new Set((citiesData || []).map((w: any) => w.city))].sort();

    // Format response
    const formattedWorkshops = (workshops || []).map((workshop: any) => {
      const latestAudit = Array.isArray(workshop.latest_audit) 
        ? workshop.latest_audit[0] 
        : workshop.latest_audit;
      
      return {
        id: workshop.id,
        name: workshop.name,
        city: workshop.city,
        address: workshop.address,
        phone: workshop.phone,
        email: workshop.email,
        audit_score: workshop.audit_score || 0,
        audit_grade: latestAudit?.audit_grade || null,
        last_audit_date: latestAudit?.completed_at || latestAudit?.scheduled_date || null,
        last_audit_score: latestAudit?.score_percentage || null,
        total_audits: workshop.audit_count?.[0]?.count || 0,
        open_action_items: workshop.open_action_items?.[0]?.count || 0,
        compliance_status: workshop.audit_score >= 4 ? 'COMPLIANT' : workshop.audit_score >= 3 ? 'AT_RISK' : 'NON_COMPLIANT',
      };
    });

    // Sort workshops
    if (sortBy === 'audit_score') {
      formattedWorkshops.sort((a, b) => (b.audit_score || 0) - (a.audit_score || 0));
    } else if (sortBy === 'last_audit_date') {
      formattedWorkshops.sort((a, b) => {
        const dateA = a.last_audit_date ? new Date(a.last_audit_date).getTime() : 0;
        const dateB = b.last_audit_date ? new Date(b.last_audit_date).getTime() : 0;
        return dateB - dateA;
      });
    }

    return NextResponse.json({
      workshops: formattedWorkshops,
      cities,
      stats: {
        total: formattedWorkshops.length,
        compliant: formattedWorkshops.filter(w => w.compliance_status === 'COMPLIANT').length,
        at_risk: formattedWorkshops.filter(w => w.compliance_status === 'AT_RISK').length,
        non_compliant: formattedWorkshops.filter(w => w.compliance_status === 'NON_COMPLIANT').length,
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in auditor workshops API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

