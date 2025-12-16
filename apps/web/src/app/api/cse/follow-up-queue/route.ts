/**
 * CSE Follow-up Queue API
 * Phase 2 - Step 7: CSE Follow-up & Satisfaction Capture
 * Purpose: Get leads that need CSE follow-up
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
      .select('id, role')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is CSE
    if (userProfile.role !== 'cse') {
      return NextResponse.json({ error: 'Forbidden: CSE only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all'; // all, pending, completed
    const hoursWindow = parseInt(searchParams.get('hours') || '24'); // Default 24 hours

    // Calculate time window
    const now = new Date();
    const windowStart = new Date(now.getTime() - hoursWindow * 60 * 60 * 1000);

    let query = supabase
      .from('service_leads')
      .select(`
        id,
        lead_number,
        customer_name,
        customer_phone,
        customer_email,
        vehicle_number,
        status,
        delivered_at,
        cse_followup_due,
        cse_followup_due_at,
        cse_assigned_id,
        invoice:invoices!invoice_id(
          id,
          invoice_number,
          final_amount,
          payment_status
        ),
        cse_followups(
          id,
          followup_type,
          completed_at,
          satisfaction_score,
          resolution_status
        )
      `)
      .eq('cse_followup_due', true)
      // workflow-aligned delivery status
      .in('status', ['DELIVERED_TO_CUSTOMER', 'DELIVERED'])
      .gte('delivered_at', windowStart.toISOString())
      .order('delivered_at', { ascending: true });

    // Filter by completion status
    if (status === 'pending') {
      // Leads without completed follow-up
      query = query.is('cse_followups.completed_at', null);
    } else if (status === 'completed') {
      // Leads with completed follow-up
      query = query.not('cse_followups.completed_at', 'is', null);
    }

    const { data: leads, error: leadsError } = await query;

    if (leadsError) {
      console.error('Error fetching follow-up queue:', leadsError);
      return NextResponse.json({ error: 'Failed to fetch follow-up queue' }, { status: 500 });
    }

    // Process leads to add metadata
    const processedLeads = leads?.map((lead: any) => {
      const hasFollowUp = lead.cse_followups && lead.cse_followups.length > 0;
      const lastFollowUp = hasFollowUp 
        ? lead.cse_followups[lead.cse_followups.length - 1]
        : null;
      
      // Calculate hours since delivery
      const deliveredAt = new Date(lead.delivered_at);
      const hoursSinceDelivery = Math.floor((now.getTime() - deliveredAt.getTime()) / (1000 * 60 * 60));

      return {
        ...lead,
        has_followup: hasFollowUp,
        last_followup: lastFollowUp,
        hours_since_delivery: hoursSinceDelivery,
        is_overdue: hoursSinceDelivery > hoursWindow,
        priority: hoursSinceDelivery > 48 ? 'HIGH' : hoursSinceDelivery > 24 ? 'MEDIUM' : 'LOW',
      };
    }) || [];

    return NextResponse.json({
      success: true,
      leads: processedLeads,
      total: processedLeads.length,
      pending: processedLeads.filter((l: any) => !l.has_followup).length,
      completed: processedLeads.filter((l: any) => l.has_followup).length,
      overdue: processedLeads.filter((l: any) => l.is_overdue).length,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in CSE follow-up queue API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

