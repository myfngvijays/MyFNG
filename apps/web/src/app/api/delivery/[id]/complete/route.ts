/**
 * Complete Delivery API
 * Phase 2 - Step 6: Delivery / Vehicle Handover
 * Purpose: Complete vehicle delivery with payment verification and damage reporting
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';

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
      .select('id, role, name')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const leadId = params.id;
    const body = await request.json();
    const {
      delivery_otp,
      delivery_photos,
      customer_signature_url,
      damage_reported,
      damage_description,
      damage_images,
      notes,
    } = body;

    // Get lead with invoice details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select(`
        *,
        invoice:invoices!invoice_id(
          id,
          invoice_number,
          payment_status,
          final_amount,
          paid_amount,
          balance_due,
          cod_due_date
        )
      `)
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Verify payment status before delivery
    if (lead.invoice) {
      const invoice = lead.invoice;
      
      // Check if payment is required
      if (invoice.payment_status !== 'PAID' && invoice.payment_status !== 'COD_PENDING') {
        // Check COD policy
        if (invoice.payment_status === 'PENDING' || invoice.payment_status === 'PARTIAL') {
          return NextResponse.json({
            error: 'Payment required before delivery',
            payment_status: invoice.payment_status,
            balance_due: invoice.balance_due || invoice.final_amount,
            hint: 'Full payment or COD approval required',
          }, { status: 400 });
        }
      }

      // Check COD due date if COD
      if (invoice.payment_status === 'COD_PENDING' && invoice.cod_due_date) {
        const dueDate = new Date(invoice.cod_due_date);
        const today = new Date();
        if (today > dueDate) {
          return NextResponse.json({
            error: 'COD payment overdue',
            cod_due_date: invoice.cod_due_date,
            hint: 'Please collect COD payment before delivery',
          }, { status: 400 });
        }
      }
    }

    // Verify delivery OTP
    if (delivery_otp) {
      // OTP verification logic (simplified - use actual OTP service)
      const expectedOTP = lead.delivery_otp || '123456'; // Default for now
      if (delivery_otp !== expectedOTP) {
        return NextResponse.json({
          error: 'Invalid delivery OTP',
          hint: 'Please verify the OTP with customer',
        }, { status: 400 });
      }
    }

    const now = new Date().toISOString();

    // Handle damage reporting
    let supportTicketId: string | null = null;
    if (damage_reported && damage_description) {
      // Generate ticket number
      const ticketNumber = `TKT-${Date.now().toString().slice(-8)}`;

      // Create support ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          ticket_number: ticketNumber,
          lead_id: leadId,
          invoice_id: lead.invoice_id,
          ticket_type: 'DELIVERY_DAMAGE',
          severity: 'HIGH',
          title: 'Delivery Damage Reported',
          description: damage_description,
          status: 'OPEN',
          assigned_to: lead.workshop_admin_id || null,
          attachments: damage_images || [],
          metadata: {
            reported_at: now,
            reported_by: userProfile.id,
            delivery_location: notes,
          },
          created_by: userProfile.id,
        })
        .select('id')
        .single();

      if (!ticketError && ticket) {
        supportTicketId = ticket.id;
      }
    }

    // Update lead with delivery completion
    const updateData: any = {
      status: 'DELIVERED',
      delivered_at: now,
      delivered_by: userProfile.id,
      updated_at: now,
    };

    if (damage_reported) {
      updateData.delivery_damage_reported = true;
      updateData.delivery_damage_description = damage_description;
      updateData.delivery_damage_images = damage_images || [];
      updateData.delivery_support_ticket_id = supportTicketId;
    }

    // Mark CSE follow-up as due (24 hours after delivery)
    const followUpDueDate = new Date();
    followUpDueDate.setHours(followUpDueDate.getHours() + 24);
    updateData.cse_followup_due = true;
    updateData.cse_followup_due_at = followUpDueDate.toISOString();

    await supabase
      .from('service_leads')
      .update(updateData)
      .eq('id', leadId);

    // Log status change
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'DELIVERED',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Vehicle delivered to customer',
        notes: damage_reported ? `Damage reported: ${damage_description}` : notes,
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'VEHICLE_DELIVERED',
        description: 'Vehicle delivered to customer',
        old_status: lead.status,
        new_status: 'DELIVERED',
        metadata: {
          delivery_otp_verified: !!delivery_otp,
          damage_reported: damage_reported || false,
          support_ticket_id: supportTicketId,
          delivered_by: userProfile.id,
        },
      });

    // Create finance event
    await createFinanceEvent({
      eventType: 'delivery_completed',
      entityType: 'invoice',
      entityId: lead.invoice_id || leadId,
      actorId: userProfile.id,
      actorRole: userProfile.role,
      actorName: userProfile.name,
      eventData: {
        lead_id: leadId,
        invoice_number: lead.invoice?.invoice_number,
        damage_reported: damage_reported || false,
        support_ticket_id: supportTicketId,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // Send delivery confirmation to customer
    // TODO: Send SMS/Email/WhatsApp notification

    return NextResponse.json({
      success: true,
      message: damage_reported 
        ? 'Vehicle delivered. Damage reported and support ticket created.' 
        : 'Vehicle delivered successfully',
      lead_id: leadId,
      status: 'DELIVERED',
      support_ticket_id: supportTicketId,
      cse_followup_due: true,
      next_step: 'CSE will follow up within 24 hours',
    }, { status: 200 });

  } catch (error) {
    console.error('Error in complete delivery API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

