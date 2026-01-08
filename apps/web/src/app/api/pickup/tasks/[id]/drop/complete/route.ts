import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { notifyWorkshopRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pickup/tasks/[id]/drop/complete
 * Complete delivery (drop). Requires DROP OTP already verified.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClientFromRequest(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_PICKUP_BOY') return NextResponse.json({ error: 'Forbidden: Pickup Boy only' }, { status: 403 });

    const leadId = params.id;
    const body = await request.json().catch(() => ({}));
    const notes = String(body?.notes || '').trim() || null;

    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, status, read_only, assigned_pickup_boy_id, invoice_id')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (lead.read_only) return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });

    const allowedLeadStatuses = ['READY_FOR_DELIVERY', 'COD_PENDING'];
    if (!allowedLeadStatuses.includes(lead.status)) {
      return NextResponse.json(
        { error: 'Lead is not ready for delivery completion', current_status: lead.status, allowed_statuses: allowedLeadStatuses },
        { status: 400 }
      );
    }

    // Payment guard (if invoice exists)
    if (lead.invoice_id) {
      const { data: inv } = await supabase
        .from('invoices')
        .select('payment_status, balance_due, final_amount')
        .eq('id', lead.invoice_id)
        .maybeSingle();
      if (inv) {
        const ok = inv.payment_status === 'PAID' || inv.payment_status === 'COD_PENDING';
        if (!ok) {
          return NextResponse.json(
            { error: 'Payment required before delivery', payment_status: inv.payment_status, balance_due: inv.balance_due ?? inv.final_amount },
            { status: 400 }
          );
        }
      }
    }

    // pickup_tracking may not exist if delivery assignment started outside tracking flow.
    // We'll accept DROP OTP verification as source of truth and auto-create tracking if missing.
    const { data: tracking, error: trackingError } = await supabase
      .from('pickup_tracking')
      .select('lead_id, drop_required, drop_assigned_to, drop_otp_verified_at')
      .eq('lead_id', leadId)
      .maybeSingle();

    if (trackingError) {
      return NextResponse.json({ error: 'Failed to load pickup tracking', details: trackingError.message }, { status: 500 });
    }

    const canAct = lead.assigned_pickup_boy_id === userProfile.id || (tracking as any)?.drop_assigned_to === userProfile.id;
    if (!canAct) return NextResponse.json({ error: 'Not assigned to this delivery' }, { status: 403 });

    // Check OTP verification (either on tracking or pickup_otps)
    const hasTrackingOtpVerified = !!(tracking as any)?.drop_otp_verified_at;
    const { data: otpRecord } = await supabase
      .from('pickup_otps')
      .select('id, is_verified, verified_at')
      .eq('lead_id', leadId)
      .eq('otp_type', 'DROP')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const hasOtpVerified = hasTrackingOtpVerified || !!otpRecord?.is_verified;
    if (!hasOtpVerified) {
      return NextResponse.json({ error: 'Delivery OTP must be verified before completing delivery' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Ensure tracking exists and is delivery-enabled
    if (!tracking) {
      await supabase.from('pickup_tracking').insert({
        lead_id: leadId,
        drop_required: true,
        drop_assigned_to: userProfile.id,
        drop_status: 'ARRIVED_AT_CUSTOMER',
        drop_otp_verified_at: otpRecord?.verified_at || now,
        updated_at: now,
        created_at: now,
      } as any);
    } else {
      if (!(tracking as any).drop_required) {
        await supabase
          .from('pickup_tracking')
          .update({ drop_required: true, drop_assigned_to: (tracking as any).drop_assigned_to || userProfile.id, updated_at: now } as any)
          .eq('lead_id', leadId);
      }
      if (!(tracking as any).drop_otp_verified_at && (otpRecord?.verified_at || now)) {
        await supabase
          .from('pickup_tracking')
          .update({ drop_otp_verified_at: otpRecord?.verified_at || now, updated_at: now } as any)
          .eq('lead_id', leadId);
      }
    }

    await supabase
      .from('pickup_tracking')
      .update({
        drop_status: 'DELIVERED',
        drop_completed_time: now,
        drop_notes: notes,
        updated_at: now,
      } as any)
      .eq('lead_id', leadId);

    // Update lead to delivered
    const { error: updateLeadError } = await supabase
      .from('service_leads')
      .update({
        status: 'DELIVERED_TO_CUSTOMER',
        pickup_status: 'DELIVERED',
        delivered_at: now,
        delivered_by: userProfile.id,
        read_only: true,
        updated_at: now,
      } as any)
      .eq('id', leadId);

    if (updateLeadError) {
      console.error('Error updating lead status to DELIVERED_TO_CUSTOMER:', updateLeadError);
      return NextResponse.json({ error: 'Failed to update lead status', details: updateLeadError.message }, { status: 500 });
    }

    await supabase.from('lead_status_history').insert({
      lead_id: leadId,
      old_status: lead.status,
      new_status: 'DELIVERED_TO_CUSTOMER',
      changed_by: userProfile.id,
      changed_at: now,
      reason: 'Vehicle delivered to customer (pickup boy)',
      notes: notes || 'Drop completed',
    } as any);

    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: userProfile.id,
      activity_type: 'DROP_COMPLETED',
      description: 'Vehicle delivered to customer',
      metadata: { notes },
    } as any);

    // Workshop Admin notification (final)
    try {
      const { data: fullLead } = await supabase
        .from('service_leads')
        .select('id, lead_number, workshop_id')
        .eq('id', leadId)
        .maybeSingle();

      if (fullLead?.workshop_id) {
        const leadNumber = (fullLead as any)?.lead_number || leadId;
        await notifyWorkshopRoles({
          workshopId: fullLead.workshop_id,
          roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
          type: 'SYSTEM_ALERT',
          title: 'Vehicle delivered successfully',
          message: `Delivery completed for lead ${leadNumber}.`,
          priority: 'LOW',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_supervisor/pickup-delivery`,
          metadata: { kind: 'DELIVERY_COMPLETED' },
        });
      }
    } catch (e) {
      console.warn('Delivery completed notification failed (non-blocking):', e);
    }

    return NextResponse.json({ success: true, message: 'Delivery completed successfully' }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


