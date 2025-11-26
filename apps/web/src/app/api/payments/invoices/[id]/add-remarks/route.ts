/**
 * Add Payment Remarks API
 * Step 7: Add Payment Remarks - Internal payment tracking
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      .select('id, role, name, email')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user has billing permissions
    const allowedRoles = ['super_admin', 'sub_admin', 'workshop_admin', 'billing'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const invoiceId = params.id;

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const body = await request.json();
    const { payment_remarks, payment_received_by_name } = body;

    if (!payment_remarks) {
      return NextResponse.json({ 
        error: 'Payment remarks are required' 
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update invoice with payment remarks
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update({
        payment_remarks: payment_remarks,
        payment_received_by: payment_received_by_name ? null : userProfile.id, // If name provided, don't set user ID
        updated_at: now,
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating payment remarks:', updateError);
      return NextResponse.json({ error: 'Failed to update payment remarks' }, { status: 500 });
    }

    // Update payment transaction if exists
    const { data: paymentTransaction } = await supabase
      .from('payment_transactions')
      .select('id')
      .eq('invoice_id', invoiceId)
      .eq('status', 'SUCCESS')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (paymentTransaction) {
      await supabase
        .from('payment_transactions')
        .update({
          payment_remarks: payment_remarks,
          staff_name: payment_received_by_name || userProfile.name,
          updated_at: now,
        })
        .eq('id', paymentTransaction.id);
    }

    // Log activity
    if (invoice.lead_id) {
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: invoice.lead_id,
          user_id: userProfile.id,
          activity_type: 'PAYMENT_REMARKS_ADDED',
          description: 'Payment remarks added',
          old_status: invoice.lead_id ? 'PAID' : null,
          new_status: invoice.lead_id ? 'PAID' : null,
          metadata: {
            invoice_id: invoiceId,
            invoice_number: invoice.invoice_number,
            payment_remarks: payment_remarks,
            added_by: userProfile.id,
            added_at: now,
          },
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment remarks added successfully',
      invoice: updatedInvoice,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in add payment remarks API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

