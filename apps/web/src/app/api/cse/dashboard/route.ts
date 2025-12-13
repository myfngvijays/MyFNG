/**
 * CSE Dashboard API
 * GET /api/cse/dashboard
 * 
 * Fetch dashboard stats for CSE
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

    // Verify CSE role
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    if (roleCode !== 'CUSTOMER_SERVICE_EXECUTIVE' && roleCode !== 'CSE') {
      return NextResponse.json({ error: 'Forbidden: CSE role required' }, { status: 403 });
    }

    // Get open complaints (tickets)
    const { count: openComplaints } = await supabase
      .from('customer_support_tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['OPEN', 'ACKNOWLEDGED']);

    // Get pending resolutions
    const { count: pendingResolutions } = await supabase
      .from('customer_support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'IN_PROGRESS');

    // Get pending callbacks (leads with follow_up_required)
    const { count: pendingCallbacks } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .eq('follow_up_required', true)
      .is('closed_at', null);

    // Get vehicle pickup issues
    const { count: vehiclePickupIssues } = await supabase
      .from('customer_support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('issue_category', 'PICKUP_DELAY')
      .in('status', ['OPEN', 'IN_PROGRESS']);

    // Get delivery issues
    const { count: deliveryIssues } = await supabase
      .from('customer_support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('issue_category', 'DROP_DELAY')
      .in('status', ['OPEN', 'IN_PROGRESS']);

    // Get repair complaints
    const { count: repairComplaints } = await supabase
      .from('customer_support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('issue_category', 'SERVICE_QUALITY_COMPLAINT')
      .in('status', ['OPEN', 'IN_PROGRESS']);

    // Get billing/invoice queries
    const { count: billingInvoiceQueries } = await supabase
      .from('customer_support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('issue_category', 'INVOICE_BILLING_ISSUE')
      .in('status', ['OPEN', 'IN_PROGRESS']);

    // Get customer ratings pending (completed leads without rating)
    const { count: customerRatingsPending } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .in('status', ['COMPLETED', 'DELIVERED_TO_CUSTOMER', 'DELIVERED', 'CLOSED'])
      .is('customer_satisfaction_score', null);

    return NextResponse.json({
      success: true,
      stats: {
        open_complaints: openComplaints || 0,
        pending_resolutions: pendingResolutions || 0,
        pending_callbacks: pendingCallbacks || 0,
        vehicle_pickup_issues: vehiclePickupIssues || 0,
        delivery_issues: deliveryIssues || 0,
        repair_complaints: repairComplaints || 0,
        billing_invoice_queries: billingInvoiceQueries || 0,
        customer_ratings_pending: customerRatingsPending || 0,
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in CSE dashboard API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

