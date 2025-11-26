/**
 * Request Refund API
 * Phase 3 - Step 10: Handle Refunds / Disputes / Chargebacks
 * Purpose: Create refund request with evidence
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

    const body = await request.json();
    const {
      invoice_id,
      lead_id,
      refund_type, // FULL, PARTIAL, CANCELLATION, COMPLAINT, QUALITY_ISSUE
      refund_amount,
      reason,
      description,
      evidence, // Array of image URLs
      complaint_id,
    } = body;

    if (!invoice_id || !refund_type || !reason) {
      return NextResponse.json({
        error: 'Missing required fields: invoice_id, refund_type, reason',
      }, { status: 400 });
    }

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, lead:service_leads!lead_id(id, customer_name, customer_phone)')
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Validate refund amount
    const invoiceAmount = parseFloat(invoice.final_amount || '0');
    const requestedAmount = parseFloat(refund_amount || '0');

    if (refund_type === 'FULL' && requestedAmount !== invoiceAmount) {
      return NextResponse.json({
        error: 'Full refund amount must match invoice amount',
        invoice_amount: invoiceAmount,
        requested_amount: requestedAmount,
      }, { status: 400 });
    }

    if (refund_type === 'PARTIAL' && requestedAmount >= invoiceAmount) {
      return NextResponse.json({
        error: 'Partial refund amount must be less than invoice amount',
        invoice_amount: invoiceAmount,
        requested_amount: requestedAmount,
      }, { status: 400 });
    }

    // Check if refund already exists
    const { data: existingRefund } = await supabase
      .from('refund_requests')
      .select('id, status')
      .eq('invoice_id', invoice_id)
      .in('status', ['PENDING', 'APPROVED', 'PROCESSING'])
      .single();

    if (existingRefund) {
      return NextResponse.json({
        error: 'Refund request already exists',
        existing_refund: existingRefund,
      }, { status: 409 });
    }

    const now = new Date().toISOString();
    const refundNumber = `REF-${Date.now().toString().slice(-8)}`;

    // Create refund request
    const { data: refund, error: refundError } = await supabase
      .from('refund_requests')
      .insert({
        refund_number: refundNumber,
        invoice_id: invoice_id,
        lead_id: lead_id || invoice.lead_id,
        workshop_id: invoice.workshop_id,
        refund_type: refund_type,
        refund_amount: requestedAmount,
        reason: reason,
        description: description,
        status: 'PENDING',
        requested_by: userProfile.id,
        evidence: evidence || [],
        complaint_id: complaint_id,
        created_at: now,
      })
      .select()
      .single();

    if (refundError) {
      console.error('Error creating refund request:', refundError);
      return NextResponse.json({ error: 'Failed to create refund request' }, { status: 500 });
    }

    // Create support ticket if complaint
    if (complaint_id || refund_type === 'COMPLAINT' || refund_type === 'QUALITY_ISSUE') {
      const ticketNumber = `TKT-${Date.now().toString().slice(-8)}`;
      await supabase
        .from('support_tickets')
        .insert({
          ticket_number: ticketNumber,
          lead_id: lead_id || invoice.lead_id,
          invoice_id: invoice_id,
          ticket_type: 'REFUND_REQUEST',
          severity: requestedAmount > 10000 ? 'HIGH' : 'MEDIUM',
          title: `Refund Request: ${refundNumber}`,
          description: description || reason,
          status: 'OPEN',
          attachments: evidence || [],
          metadata: {
            refund_id: refund.id,
            refund_amount: requestedAmount,
            refund_type: refund_type,
          },
          created_by: userProfile.id,
        });
    }

    // Create finance event
    await createFinanceEvent({
      eventType: 'refund_requested',
      entityType: 'refund',
      entityId: refund.id,
      actorId: userProfile.id,
      actorRole: userProfile.role,
      actorName: userProfile.name,
      eventData: {
        refund_number: refundNumber,
        invoice_id: invoice_id,
        refund_type: refund_type,
        refund_amount: requestedAmount,
        reason: reason,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Refund request created successfully',
      refund: refund,
      next_step: 'Awaiting Accounts review and approval',
    }, { status: 201 });

  } catch (error) {
    console.error('Error in request refund API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

