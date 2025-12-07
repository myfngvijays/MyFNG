import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/invoices/pending-review
 * Get all invoices pending review
 * Roles: BILLING_SPECIALIST, FINANCE_MANAGER, SUPER_ADMIN
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, workshop_id, roles!inner(role_code, role_name)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;

    // Verify user has review permissions
    const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'BILLING_SPECIALIST', 'FINANCE_MANAGER'];
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ 
        error: 'Forbidden: Insufficient permissions',
        required_roles: allowedRoles,
        current_role: roleCode
      }, { status: 403 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'GENERATED,PENDING';
    const workshopId = searchParams.get('workshop_id');
    const requiresSecondApproval = searchParams.get('requires_second_approval');
    const minAmount = searchParams.get('min_amount');
    const maxAmount = searchParams.get('max_amount');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('invoices')
      .select(`
        *,
        lead:service_leads!inner(
          id, lead_number, customer_name, customer_phone, 
          customer_email, workshop_id, status
        ),
        workshop:workshops(
          id, name, city, state
        ),
        approved_by_user:users_login!invoice_approved_by(
          id, full_name, email
        ),
        second_approver:users_login!second_approver_id(
          id, full_name, email
        )
      `, { count: 'exact' });

    // Filter by status
    const statusArray = status.split(',');
    query = query.in('status', statusArray);

    // Filter by workshop if specified
    if (workshopId) {
      query = query.eq('lead.workshop_id', workshopId);
    }

    // Filter by second approval requirement
    if (requiresSecondApproval === 'true') {
      query = query.eq('requires_second_approval', true);
    } else if (requiresSecondApproval === 'false') {
      query = query.eq('requires_second_approval', false);
    }

    // Filter by amount range
    if (minAmount) {
      query = query.gte('total_amount', parseFloat(minAmount));
    }
    if (maxAmount) {
      query = query.lte('total_amount', parseFloat(maxAmount));
    }

    // Pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: invoices, error: invoicesError, count } = await query;

    if (invoicesError) {
      console.error('Error fetching pending invoices:', invoicesError);
      return NextResponse.json({ 
        error: 'Failed to fetch invoices',
        details: invoicesError.message
      }, { status: 500 });
    }

    // Get review history for each invoice
    const invoiceIds = (invoices || []).map(inv => inv.id);
    const { data: reviews } = await supabase
      .from('invoice_reviews')
      .select(`
        *,
        reviewer:users_login!reviewed_by(
          id, full_name, email,
          role:roles(role_code, role_name)
        )
      `)
      .in('invoice_id', invoiceIds)
      .order('reviewed_at', { ascending: false });

    // Group reviews by invoice_id
    const reviewsByInvoice: Record<string, any[]> = {};
    (reviews || []).forEach(review => {
      if (!reviewsByInvoice[review.invoice_id]) {
        reviewsByInvoice[review.invoice_id] = [];
      }
      reviewsByInvoice[review.invoice_id].push(review);
    });

    // Enhance invoices with review data
    const enhancedInvoices = (invoices || []).map(invoice => ({
      ...invoice,
      reviews: reviewsByInvoice[invoice.id] || [],
      latest_review: reviewsByInvoice[invoice.id]?.[0] || null,
      review_count: (reviewsByInvoice[invoice.id] || []).length
    }));

    // Calculate summary stats
    const summary = {
      total_pending: count || 0,
      requires_first_approval: enhancedInvoices.filter(inv => 
        !inv.invoice_approved && inv.status === 'GENERATED'
      ).length,
      requires_second_approval: enhancedInvoices.filter(inv => 
        inv.invoice_approved && 
        inv.requires_second_approval && 
        !inv.second_approved_at
      ).length,
      rejected_count: enhancedInvoices.filter(inv => 
        inv.status === 'DRAFT'
      ).length,
      total_amount: enhancedInvoices.reduce((sum, inv) => 
        sum + (parseFloat(inv.total_amount) || 0), 0
      ),
      high_value_count: enhancedInvoices.filter(inv => 
        parseFloat(inv.total_amount) > 50000
      ).length
    };

    return NextResponse.json({
      success: true,
      invoices: enhancedInvoices,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      },
      summary,
      filters_applied: {
        status: statusArray,
        workshop_id: workshopId,
        requires_second_approval: requiresSecondApproval,
        min_amount: minAmount,
        max_amount: maxAmount
      }
    });

  } catch (error: any) {
    console.error('Error fetching pending invoices:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

