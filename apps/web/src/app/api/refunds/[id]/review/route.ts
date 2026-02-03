import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/refunds/[id]/review
 * Review refund request by Accounts team
 */
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    const allowedRoles = ['SUPER_ADMIN', 'FINANCE_MANAGER', 'BILLING_SPECIALIST'];
    
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const refundId = params.id;
    const body = await request.json();
    const { review_notes, recommend_approval = true } = body;

    // Get refund with all related data
    const { data: refund } = await supabase
      .from('refund_requests')
      .select(`
        *,
        lead:service_leads!inner(*),
        invoice:invoices(*),
        payments:payment_transactions(*)
      `)
      .eq('id', refundId)
      .single();

    if (!refund) {
      return NextResponse.json({ error: 'Refund not found' }, { status: 404 });
    }

    // Perform validation checks
    const validationResults: any = {
      invoice_exists: !!refund.invoice,
      payment_received: false,
      amount_valid: false,
      warranty_check: 'pending',
      duplicate_check: 'passed',
      fraud_indicators: []
    };

    // Check if payment was actually received
    const invoice = refund.invoice as any;
    if (invoice) {
      validationResults.payment_received = invoice.payment_status === 'PAID';
      validationResults.amount_valid = refund.amount <= refund.original_amount;
    }

    // Check for duplicate refund requests
    const { data: duplicates } = await supabase
      .from('refund_requests')
      .select('id')
      .eq('lead_id', refund.lead_id)
      .neq('id', refundId)
      .in('status', ['PENDING', 'APPROVED', 'PROCESSING']);

    if (duplicates && duplicates.length > 0) {
      validationResults.duplicate_check = 'failed';
      validationResults.fraud_indicators.push('Multiple refund requests for same lead');
    }

    // Auto-approve threshold
    const autoApproveLimit = 5000; // Can be configurable
    const canAutoApprove = refund.amount < autoApproveLimit && 
                           validationResults.payment_received &&
                           validationResults.amount_valid &&
                           validationResults.duplicate_check === 'passed';

    return NextResponse.json({
      success: true,
      refund,
      validation: validationResults,
      can_auto_approve: canAutoApprove,
      auto_approve_limit: autoApproveLimit,
      requires_finance_manager: refund.amount >= autoApproveLimit,
      recommendation: recommend_approval ? 'APPROVE' : 'REJECT',
      review_notes
    });

  } catch (error: any) {
    console.error('Error reviewing refund:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

