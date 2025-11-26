/**
 * Chargeback Handling API
 * Phase 3 - Step 10: Handle Refunds / Disputes / Chargebacks
 * Purpose: Handle payment gateway chargebacks
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';

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

    // Verify user has finance permissions
    const allowedRoles = ['super_admin', 'sub_admin', 'finance_manager', 'accounts'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      payment_id,
      invoice_id,
      chargeback_id, // From payment gateway
      chargeback_reason,
      chargeback_amount,
      chargeback_date,
      evidence, // Array of evidence URLs
      response_deadline,
    } = body;

    if (!payment_id || !chargeback_id || !chargeback_reason) {
      return NextResponse.json({
        error: 'Missing required fields: payment_id, chargeback_id, chargeback_reason',
      }, { status: 400 });
    }

    // Get payment details
    const { data: payment, error: paymentError } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        invoice:invoices!invoice_id(
          id,
          invoice_number,
          final_amount,
          lead_id
        )
      `)
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const chargebackNumber = `CB-${Date.now().toString().slice(-8)}`;

    // Create chargeback record (using refund_requests table with special type)
    const { data: chargeback, error: chargebackError } = await supabase
      .from('refund_requests')
      .insert({
        refund_number: chargebackNumber,
        invoice_id: invoice_id || payment.invoice?.id,
        lead_id: payment.invoice?.lead_id || payment.lead_id,
        workshop_id: payment.invoice?.workshop_id,
        refund_type: 'CHARGEBACK',
        refund_amount: chargeback_amount || parseFloat(payment.amount || '0'),
        reason: `Chargeback: ${chargeback_reason}`,
        description: `Payment gateway chargeback - ID: ${chargeback_id}`,
        status: 'PENDING',
        requested_by: userProfile.id,
        evidence: evidence || [],
        metadata: {
          chargeback_id: chargeback_id,
          chargeback_date: chargeback_date,
          response_deadline: response_deadline,
          payment_gateway: payment.payment_gateway,
          gateway_payment_id: payment.gateway_payment_id,
        },
        created_at: now,
      })
      .select()
      .single();

    if (chargebackError) {
      console.error('Error creating chargeback:', chargebackError);
      return NextResponse.json({ error: 'Failed to create chargeback record' }, { status: 500 });
    }

    // Update payment transaction
    await supabase
      .from('payment_transactions')
      .update({
        chargeback_id: chargeback_id,
        chargeback_status: 'PENDING',
        chargeback_amount: chargeback_amount || parseFloat(payment.amount || '0'),
        chargeback_date: chargeback_date || now,
        updated_at: now,
      })
      .eq('id', payment_id);

    // Create support ticket for chargeback
    const ticketNumber = `TKT-CB-${Date.now().toString().slice(-8)}`;
    await supabase
      .from('support_tickets')
      .insert({
        ticket_number: ticketNumber,
        lead_id: payment.invoice?.lead_id || payment.lead_id,
        invoice_id: invoice_id || payment.invoice?.id,
        ticket_type: 'CHARGEBACK',
        severity: 'CRITICAL',
        title: `Chargeback: ${chargebackNumber}`,
        description: `Payment gateway chargeback received. Reason: ${chargeback_reason}. Response deadline: ${response_deadline || 'ASAP'}`,
        status: 'OPEN',
        assigned_to: userProfile.id, // Assign to finance team
        attachments: evidence || [],
        metadata: {
          chargeback_id: chargeback_id,
          chargeback_number: chargebackNumber,
          response_deadline: response_deadline,
        },
        created_by: userProfile.id,
      });

    // Create finance event
    await createFinanceEvent({
      eventType: 'chargeback_received',
      entityType: 'payment',
      entityId: payment_id,
      actorId: userProfile.id,
      actorRole: userProfile.role,
      actorName: userProfile.name,
      eventData: {
        chargeback_id: chargeback_id,
        chargeback_number: chargebackNumber,
        chargeback_amount: chargeback_amount || parseFloat(payment.amount || '0'),
        chargeback_reason: chargeback_reason,
        response_deadline: response_deadline,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Chargeback recorded successfully',
      chargeback: chargeback,
      ticket_number: ticketNumber,
      next_step: 'Collect evidence and respond to payment gateway within deadline',
    }, { status: 201 });

  } catch (error) {
    console.error('Error in chargeback API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

