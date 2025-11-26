/**
 * Reconciliation Exceptions API
 * Phase 3 - Step 8: Accounts Reconciliation
 * Purpose: Get and resolve reconciliation exceptions
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

    // Verify user has accounts permissions
    const allowedRoles = ['super_admin', 'sub_admin', 'accounts', 'finance_manager'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const exception_type = searchParams.get('type');

    let query = supabase
      .from('recon_exceptions')
      .select(`
        *,
        payment:payment_transactions(id, transaction_id, amount, payment_method),
        invoice:invoices(id, invoice_number, final_amount),
        lead:service_leads(id, lead_number, customer_name)
      `)
      .eq('status', status);

    if (exception_type) {
      query = query.eq('exception_type', exception_type);
    }

    query = query.order('created_at', { ascending: false });

    const { data: exceptions, error: exceptionsError } = await query;

    if (exceptionsError) {
      console.error('Error fetching exceptions:', exceptionsError);
      return NextResponse.json({ error: 'Failed to fetch exceptions' }, { status: 500 });
    }

    // Group by type
    const grouped = exceptions?.reduce((acc: any, exc: any) => {
      const type = exc.exception_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(exc);
      return acc;
    }, {}) || {};

    return NextResponse.json({
      success: true,
      exceptions: exceptions || [],
      grouped: grouped,
      summary: {
        total: exceptions?.length || 0,
        by_type: Object.keys(grouped).reduce((acc: any, key) => {
          acc[key] = grouped[key].length;
          return acc;
        }, {}),
      },
    }, { status: 200 });

  } catch (error) {
    console.error('Error in reconciliation exceptions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Resolve Exception
 */
export async function POST(request: NextRequest) {
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
      .select('id, role, name')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user has accounts permissions
    const allowedRoles = ['super_admin', 'sub_admin', 'accounts', 'finance_manager'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { exception_id, resolution_action, resolution_notes, payment_id, invoice_id } = body;

    if (!exception_id || !resolution_action) {
      return NextResponse.json({
        error: 'Missing required fields: exception_id, resolution_action',
      }, { status: 400 });
    }

    // Get exception
    const { data: exception, error: exceptionError } = await supabase
      .from('recon_exceptions')
      .select('*')
      .eq('id', exception_id)
      .single();

    if (exceptionError || !exception) {
      return NextResponse.json({ error: 'Exception not found' }, { status: 404 });
    }

    if (exception.status !== 'PENDING') {
      return NextResponse.json({
        error: 'Exception already resolved',
        current_status: exception.status,
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Handle resolution based on action
    if (resolution_action === 'MATCH_PAYMENT' && payment_id) {
      // Manually match with payment
      await supabase
        .from('payment_transactions')
        .update({
          reconciled: true,
          reconciled_at: now,
          reconciled_by: userProfile.id,
        })
        .eq('id', payment_id);
    } else if (resolution_action === 'IGNORE') {
      // Mark as ignored
    } else if (resolution_action === 'ESCALATE') {
      // Escalate to Finance Manager
    }

    // Update exception
    const { data: updatedException, error: updateError } = await supabase
      .from('recon_exceptions')
      .update({
        status: resolution_action === 'ESCALATE' ? 'ESCALATED' : 'RESOLVED',
        resolved_by: userProfile.id,
        resolved_at: now,
        resolution_notes: resolution_notes,
        updated_at: now,
      })
      .eq('id', exception_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error resolving exception:', updateError);
      return NextResponse.json({ error: 'Failed to resolve exception' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Exception resolved successfully',
      exception: updatedException,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in resolve exception API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

