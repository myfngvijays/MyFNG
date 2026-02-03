import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { notifyPickupBoy, notifyWorkshopRoles, notifyTelecallerForLead } from '@/lib/notifications';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/pickup/[id]/drop/complete
 * Complete drop process
 */
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const params = await paramsPromise;
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const leadId = params.id;
    const body = await request.json();
    const { 
      notes, 
      latitude, 
      longitude,
      payment_mode,
      payment_amount,
      payment_proof_url,
      odometer_reading,        // ✨ NEW: Odometer reading at delivery
      final_remarks,           // ✨ NEW: Customer issues reported at delivery
      invoice_paid,            // ✨ NEW: Invoice payment verification
      invoice_id               // ✨ NEW: Reference to invoice
    } = body;

    // Fetch lead for read-only protection + payment/state checks
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, status, read_only, invoice_id')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.read_only) {
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
    }

    // Validate tracking + assignment
    const { data: tracking, error: trackingError } = await supabase
      .from('pickup_tracking')
      .select('drop_required, drop_assigned_to, drop_status, drop_otp_verified_at')
      .eq('lead_id', leadId)
      .single();

    if (trackingError || !tracking) {
      return NextResponse.json({ error: 'Pickup tracking not found' }, { status: 404 });
    }

    if (!tracking.drop_required) {
      return NextResponse.json({ error: 'Drop not required for this lead' }, { status: 400 });
    }

    if (tracking.drop_assigned_to !== user.id) {
      return NextResponse.json({ error: 'Not assigned to this drop' }, { status: 403 });
    }

    // Ensure lead is in correct state for delivery completion
    const allowedLeadStatuses = ['READY_FOR_DELIVERY', 'COD_PENDING'];
    if (!allowedLeadStatuses.includes(lead.status)) {
      return NextResponse.json({
        error: 'Lead is not ready for delivery completion',
        current_status: lead.status,
        allowed_statuses: allowedLeadStatuses
      }, { status: 400 });
    }

    // Require DROP OTP verification before completing delivery
    if (!tracking.drop_otp_verified_at) {
      return NextResponse.json({
        error: 'Delivery OTP must be verified before completing drop',
        hint: 'Verify DROP OTP first'
      }, { status: 400 });
    }

    // Verify invoice payment status (PAID or COD_PENDING) if invoice exists
    const effectiveInvoiceId = invoice_id || lead.invoice_id;
    if (effectiveInvoiceId) {
      const { data: inv, error: invError } = await supabase
        .from('invoices')
        .select('id, payment_status, status, final_amount, balance_due')
        .eq('id', effectiveInvoiceId)
        .single();

      if (invError || !inv) {
        return NextResponse.json({ error: 'Invoice not found for lead' }, { status: 404 });
      }

      const okPayment = inv.payment_status === 'PAID' || inv.payment_status === 'COD_PENDING';
      if (!okPayment && invoice_paid !== true) {
        return NextResponse.json({
          error: 'Payment required before delivery',
          payment_status: inv.payment_status,
          balance_due: inv.balance_due ?? inv.final_amount,
        }, { status: 400 });
      }
    }

    // Check if minimum drop photos are uploaded
    const { count: photoCount, error: photoCountError } = await supabase
      .from('vehicle_condition_photos')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .like('photo_type', 'DROP_%');

    if (photoCountError) {
      return NextResponse.json({ error: 'Failed to check photos' }, { status: 500 });
    }

    if ((photoCount || 0) < 3) {
      return NextResponse.json({ 
        error: 'Minimum 3 drop photos required',
        required_photos: ['DROP_FRONT', 'DROP_INTERIOR', 'AFTER_WORK']
      }, { status: 400 });
    }

    // NEW: Require receiver/handover proof photo so we know who received the vehicle.
    const { count: handoverCount, error: handoverErr } = await supabase
      .from('vehicle_condition_photos')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .eq('photo_type', 'DROP_HANDOVER');

    if (handoverErr) {
      return NextResponse.json({ error: 'Failed to check handover photo' }, { status: 500 });
    }

    if ((handoverCount || 0) < 1) {
      return NextResponse.json(
        {
          error: 'Receiver photo (handover proof) required',
          required_photos: ['DROP_HANDOVER'],
          hint: 'Upload receiver photo from Delivery Photos screen, then complete delivery',
        },
        { status: 400 }
      );
    }

    // Update drop tracking with all new fields
    const updateData: any = {
      drop_status: 'DELIVERED',
      drop_completed_time: new Date().toISOString(),
      drop_odometer_reading: odometer_reading || null, // ✨ NEW: Odometer reading at delivery
      drop_final_remarks: final_remarks || null,        // ✨ NEW: Customer issues reported at delivery
      drop_notes: notes,
      updated_at: new Date().toISOString(),
    };
    
    // Add invoice verification if provided
    if (invoice_paid !== undefined) {
      updateData.invoice_paid = invoice_paid;
      if (invoice_paid) {
        updateData.invoice_paid_at = new Date().toISOString();
        updateData.invoice_paid_by = user.id;
      }
      if (invoice_id) {
        updateData.invoice_id = invoice_id;
      }
    }

    // Add payment info if COD
    if (payment_mode === 'COD' && payment_amount) {
      updateData.payment_mode = payment_mode;
      updateData.payment_amount = payment_amount;
      updateData.payment_collected_at = new Date().toISOString();
      if (payment_proof_url) {
        updateData.payment_proof_url = payment_proof_url;
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('pickup_tracking')
      .update(updateData)
      .eq('lead_id', leadId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to complete drop', details: updateError.message }, { status: 500 });
    }

    // Log location
    if (latitude && longitude) {
      await supabase.from('pickup_location_tracking').insert({
        lead_id: leadId,
        pickup_boy_id: user.id,
        latitude,
        longitude,
        status: 'AT_DROP',
      });
    }

    // Update lead status to DELIVERED (trigger allows READY_FOR_DELIVERY -> DELIVERED)
    // NOTE: some installs don't have delivered_at / delivered_by columns; keep this minimal.
    const deliveredAt = new Date().toISOString();
    await supabase
      .from('service_leads')
      .update({
        status: 'DELIVERED',
        pickup_status: 'DELIVERED',
        // Mark CSE follow-up as due (24 hours after delivery) if columns exist; best-effort for older schemas.
        cse_followup_due: true,
        cse_followup_due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        updated_at: deliveredAt,
        read_only: true // Lock lead after delivery (post-job workflow)
      } as any)
      .eq('id', leadId);

    // Log status change
    await supabase.from('lead_status_history').insert({
      lead_id: leadId,
      old_status: lead.status,
      new_status: 'DELIVERED',
      changed_by: user.id,
      changed_at: deliveredAt,
      reason: 'Vehicle delivered to customer (drop completed)',
      notes: notes || 'Drop completed'
    });

    // Lead event for analytics/audit
    await supabase.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'DELIVERED',
      event_description: 'Vehicle delivered to customer (pickup/drop flow)',
      event_data: {
        delivered_by: user.id,
        drop_status: 'DELIVERED',
        odometer_reading,
      },
      created_by: user.id,
      created_at: deliveredAt,
    });

    // Create activity log
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'DROP_COMPLETED',
      description: 'Vehicle delivered to customer',
      metadata: { notes, latitude, longitude, payment_mode, payment_amount },
    });

    // Notifications (final)
    try {
      const { data: fullLead } = await supabase
        .from('service_leads')
        .select('id, lead_number, workshop_id')
        .eq('id', leadId)
        .maybeSingle();

      const leadNumber = (fullLead as any)?.lead_number || leadId;

      await notifyPickupBoy({
        pickupBoyId: user.id,
        type: 'DELIVERY_COMPLETED',
        title: 'Delivery completed',
        message: `Lead ${leadNumber}: Delivery completed successfully.`,
        priority: 'MEDIUM',
        leadId,
        leadNumber,
        metadata: { kind: 'DELIVERY_COMPLETED' },
      });

      if ((fullLead as any)?.workshop_id) {
        await notifyWorkshopRoles({
          workshopId: (fullLead as any).workshop_id,
          roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
          type: 'DELIVERY_COMPLETED',
          title: 'Vehicle delivered to customer',
          message: `Lead ${leadNumber}: Delivery completed by pickup boy.`,
          priority: 'LOW',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_supervisor/pickup-delivery`,
          metadata: { kind: 'DELIVERY_COMPLETED' },
        });
      }

      // Notify telecaller that vehicle has been delivered
      await notifyTelecallerForLead({
        leadId,
        leadNumber,
        type: 'DELIVERY_COMPLETED',
        title: 'Vehicle delivered to customer',
        message: `Lead ${leadNumber} has been successfully delivered to the customer.`,
        priority: 'MEDIUM',
        metadata: { kind: 'VEHICLE_DELIVERED', delivered_at: deliveredAt },
      });
    } catch (e) {
      console.warn('Delivery completed notifications failed (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Drop completed successfully',
    });
  } catch (error: any) {
    console.error('Error completing drop:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

