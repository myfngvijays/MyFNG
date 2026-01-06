import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { notifyWorkshopRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pickup/tasks/[id]/drop/start
 * Start delivery (drop) for a lead that is READY_FOR_DELIVERY / COD_PENDING.
 * Cookie-auth (server client) so pickup boy UI can call it without passing bearer token.
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
        { error: 'Lead is not ready for delivery', current_status: lead.status, allowed_statuses: allowedLeadStatuses },
        { status: 400 }
      );
    }

    // Ensure tracking exists and that this pickup boy is allowed:
    // - either lead is assigned to him OR pickup_tracking.drop_assigned_to is him (separate delivery assignment).
    const { data: tracking } = await supabase
      .from('pickup_tracking')
      .select('lead_id, drop_assigned_to, drop_required')
      .eq('lead_id', leadId)
      .maybeSingle();

    const canAct =
      lead.assigned_pickup_boy_id === userProfile.id || (tracking as any)?.drop_assigned_to === userProfile.id;
    if (!canAct) return NextResponse.json({ error: 'Not assigned to this delivery' }, { status: 403 });

    const now = new Date().toISOString();

    // Generate DROP OTP via RPC (if available)
    let otp: string | null = null;
    try {
      const { data: otpData, error: otpError } = await supabase.rpc('generate_pickup_otp', {
        p_lead_id: leadId,
        p_otp_type: 'DROP',
      });
      if (!otpError) otp = (otpData as any) || null;
    } catch {
      // ignore, fallback below
    }
    if (!otp) {
      otp = '123456'; // test fallback
      await supabase.from('pickup_otps').insert({
        lead_id: leadId,
        otp_type: 'DROP',
        otp_code: otp,
        is_verified: false,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        created_at: now,
        created_by: userProfile.id,
      } as any);
    }

    // Upsert tracking for drop
    await supabase.from('pickup_tracking').upsert(
      {
        lead_id: leadId,
        drop_required: true,
        drop_assigned_to: userProfile.id,
        drop_status: 'OUT_FOR_DELIVERY',
        drop_start_time: now,
        drop_out_for_delivery_at: now,
        drop_otp: otp,
        updated_at: now,
      } as any,
      { onConflict: 'lead_id' }
    );

    // Activity log (best effort)
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: userProfile.id,
      activity_type: 'DROP_STARTED',
      description: 'Delivery started (out for delivery)',
      metadata: { otp_generated: true },
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
          title: 'Vehicle out for delivery',
          message: `Delivery started for lead ${leadNumber}.`,
          priority: 'LOW',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_supervisor/pickup-delivery`,
          metadata: { kind: 'DELIVERY_OUT_FOR_DELIVERY' },
        });
      }
    } catch (e) {
      console.warn('Delivery started notification failed (non-blocking):', e);
    }

    return NextResponse.json(
      { success: true, message: 'Delivery started successfully', otp }, // otp returned for testing
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


