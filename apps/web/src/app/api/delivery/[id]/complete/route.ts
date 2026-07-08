/**
 * Complete Delivery API
 * Phase 2 - Step 6: Delivery / Vehicle Handover
 * Purpose: Complete vehicle delivery with payment verification and damage reporting
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';
import { notifyWorkshopRoles } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const params = await paramsPromise;
    
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

    // Prevent edits after archival/closure
    if (lead.read_only) {
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
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

    // Canonical delivery OTP: use pickup_otps + pickup_tracking (DROP) for ALL deliveries.
    // (This keeps /api/delivery/* consistent with pickup/drop workflow.)
    if (!delivery_otp) {
      return NextResponse.json({
        error: 'Delivery OTP required',
        hint: 'Use the DROP OTP. For testing you can enter 123456'
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Ensure pickup_tracking exists (canonical tracking record)
    const { data: tracking } = await supabase
      .from('pickup_tracking')
      .select('id, drop_otp_verified_at, drop_status, drop_required')
      .eq('lead_id', leadId)
      .maybeSingle();

    if (!tracking) {
      // Create minimal tracking row so delivery is fully auditable
      await supabase.from('pickup_tracking').insert({
        lead_id: leadId,
        pickup_required: false,
        drop_required: true,
        drop_status: 'OUT_FOR_DELIVERY',
        invoice_id: lead.invoice_id || null,
        invoice_paid: lead.invoice?.payment_status === 'PAID' || lead.invoice?.payment_status === 'COD_PENDING',
        invoice_paid_at: (lead.invoice?.payment_status === 'PAID' || lead.invoice?.payment_status === 'COD_PENDING') ? now : null,
        invoice_paid_by: userProfile.id,
        created_at: now,
        updated_at: now,
      });
    }

    // Verify DROP OTP against pickup_otps (also allow universal test OTP 123456)
    const { data: otpRecord } = await supabase
      .from('pickup_otps')
      .select('id, otp_code, otp_type, is_verified, expires_at')
      .eq('lead_id', leadId)
      .eq('otp_type', 'DROP')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const validOTP = otpRecord?.otp_code;
    if (validOTP && delivery_otp !== validOTP && delivery_otp !== '123456') {
      return NextResponse.json({
        error: 'Invalid delivery OTP',
        hint: 'Please verify the DROP OTP with customer (or use 123456 in test mode)',
      }, { status: 400 });
    }
    if (!validOTP && delivery_otp !== '123456') {
      return NextResponse.json({
        error: 'Delivery OTP not generated for this lead',
        hint: 'Start delivery (generate DROP OTP) or use 123456 in test mode',
      }, { status: 400 });
    }

    // Mark OTP as verified (ensure record exists even for test OTP)
    if (otpRecord) {
      if (!otpRecord.is_verified) {
        await supabase
          .from('pickup_otps')
          .update({
            is_verified: true,
            verified_at: now,
            verified_by: userProfile.id,
          })
          .eq('id', otpRecord.id);
      }
    } else if (delivery_otp === '123456') {
      await supabase.from('pickup_otps').insert({
        lead_id: leadId,
        otp_code: '123456',
        otp_type: 'DROP',
        is_verified: true,
        verified_at: now,
        verified_by: userProfile.id,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        created_at: now,
      });
    }

    // Update pickup_tracking drop OTP verification + completion markers
    await supabase
      .from('pickup_tracking')
      .update({
        drop_required: true,
        drop_status: 'DELIVERED',
        drop_otp_verified_at: now,
        drop_completed_time: now,
        drop_final_remarks: notes || (damage_reported ? `Damage: ${damage_description}` : null),
        invoice_id: lead.invoice_id || null,
        invoice_paid: lead.invoice?.payment_status === 'PAID' || lead.invoice?.payment_status === 'COD_PENDING',
        invoice_paid_at: (lead.invoice?.payment_status === 'PAID' || lead.invoice?.payment_status === 'COD_PENDING') ? now : null,
        invoice_paid_by: userProfile.id,
        updated_at: now,
      })
      .eq('lead_id', leadId);

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

    // Update lead with delivery completion (workflow-aligned)
    const updateData: any = {
      // IMPORTANT: DB trigger allows READY_FOR_DELIVERY -> DELIVERED (not DELIVERED_TO_CUSTOMER)
      status: 'DELIVERED',
      pickup_status: 'DELIVERED',
      delivered_at: now,
      delivered_by: userProfile.id,
      updated_at: now,
      read_only: true, // Lock lead after delivery (post-job workflow)
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

    const { error: updateLeadError } = await supabase
      .from('service_leads')
      .update(updateData)
      .eq('id', leadId);

    if (updateLeadError) {
      console.error('Error updating lead status to DELIVERED_TO_CUSTOMER:', updateLeadError);
      return NextResponse.json({ error: 'Failed to update lead status', details: updateLeadError.message }, { status: 500 });
    }

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
          otp_source: 'pickup_otps(DROP)',
          delivery_photos: delivery_photos || null,
          customer_signature_url: customer_signature_url || null,
          damage_reported: damage_reported || false,
          support_ticket_id: supportTicketId,
          delivered_by: userProfile.id,
        },
      });

    // Lead event for analytics/audit
    await supabase.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'DELIVERED',
      event_description: 'Vehicle delivered to customer (delivery API)',
      event_data: {
        delivered_by: userProfile.id,
        source: 'delivery_api',
        support_ticket_id: supportTicketId,
        damage_reported: damage_reported || false,
      },
      created_by: userProfile.id,
      created_at: now,
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

    // Auto-reward referrer on delivery completion
    try {
      const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
      const { maybeRewardReferrer } = await import('@/lib/referral-reward');
      const { supabaseAdmin } = getSupabaseAdmin();
      const customerId = (lead as any).customer_id;
      if (supabaseAdmin && customerId) {
        await maybeRewardReferrer(supabaseAdmin, customerId);
      }
    } catch {}

    // Workshop Admin notification (final)
    try {
      if ((lead as any)?.workshop_id) {
        const leadNumber = (lead as any)?.lead_number || leadId;
        const title = damage_reported ? 'Delivered (damage reported)' : 'Vehicle delivered successfully';
        const msg = damage_reported
          ? `Lead ${leadNumber} delivered. Damage reported; ticket created.`
          : `Lead ${leadNumber} delivered successfully.`;

        await notifyWorkshopRoles({
          workshopId: (lead as any).workshop_id,
          roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
          type: 'SYSTEM_ALERT',
          title,
          message: msg,
          priority: damage_reported ? 'HIGH' : 'LOW',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_supervisor/pickup-delivery`,
          metadata: { kind: 'DELIVERY_COMPLETED', damage_reported: Boolean(damage_reported), support_ticket_id: supportTicketId },
        });
      }
    } catch (e) {
      console.warn('Delivery API notification failed (non-blocking):', e);
    }

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

