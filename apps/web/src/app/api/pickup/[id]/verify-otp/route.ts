import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { notifyPickupBoy, notifyWorkshopRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/pickup/[id]/verify-otp
 * Verify pickup OTP
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
    const { otp_code, otp_type } = body;

    if (!otp_code || !otp_type) {
      return NextResponse.json({ error: 'OTP code and type are required' }, { status: 400 });
    }

    // Fetch lead + tracking to enforce assignment + read-only guard
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, status, read_only')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.read_only) {
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
    }

    const { data: tracking, error: trackingError } = await supabase
      .from('pickup_tracking')
      .select('pickup_assigned_to, drop_assigned_to, pickup_required, drop_required')
      .eq('lead_id', leadId)
      .single();

    if (trackingError || !tracking) {
      return NextResponse.json({ error: 'Pickup tracking not found' }, { status: 404 });
    }

    if (otp_type === 'PICKUP') {
      if (!tracking.pickup_required) return NextResponse.json({ error: 'Pickup not required' }, { status: 400 });
      if (tracking.pickup_assigned_to !== user.id) return NextResponse.json({ error: 'Not assigned to this pickup' }, { status: 403 });
    } else if (otp_type === 'DROP') {
      if (!tracking.drop_required) return NextResponse.json({ error: 'Drop not required' }, { status: 400 });
      if (tracking.drop_assigned_to !== user.id) return NextResponse.json({ error: 'Not assigned to this drop' }, { status: 403 });
    } else {
      return NextResponse.json({ error: 'Invalid otp_type', valid: ['PICKUP', 'DROP'] }, { status: 400 });
    }

    // Verify OTP:
    // - Accept universal test OTP "123456" everywhere
    // - Otherwise verify via DB RPC function verify_pickup_otp
    const nowIso = new Date().toISOString();
    let isValid = false;

    if (otp_code === '123456') {
      isValid = true;

      // Ensure a verified pickup_otps record exists (so downstream checks don't fail)
      const { data: latestOtp } = await supabase
        .from('pickup_otps')
        .select('id')
        .eq('lead_id', leadId)
        .eq('otp_type', otp_type)
        .eq('is_verified', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestOtp?.id) {
        await supabase
          .from('pickup_otps')
          .update({
            is_verified: true,
            verified_at: nowIso,
            verified_by: user.id,
          })
          .eq('id', latestOtp.id);
      } else {
        // If no pending OTP exists, insert a verified one for audit trail
        await supabase
          .from('pickup_otps')
          .insert({
            lead_id: leadId,
            otp_type: otp_type,
            otp_code: otp_code,
            is_verified: true,
            verified_at: nowIso,
            verified_by: user.id,
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          });
      }
    } else {
      const { data: rpcValid, error: verifyError } = await supabase.rpc('verify_pickup_otp', {
        p_lead_id: leadId,
        p_otp_type: otp_type,
        p_otp_code: otp_code,
        p_verified_by: user.id,
      });

      if (verifyError) {
        return NextResponse.json({ error: 'Failed to verify OTP', details: verifyError.message }, { status: 500 });
      }

      isValid = !!rpcValid;
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
      }
    }

    // Update pickup tracking based on OTP type
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (otp_type === 'PICKUP') {
      updateData.pickup_status = 'OTP_VERIFIED';
      updateData.pickup_otp_verified_at = new Date().toISOString();
    } else if (otp_type === 'DROP') {
      // For drop, OTP verification confirms customer handover
      updateData.drop_status = 'ARRIVED_AT_CUSTOMER';
      updateData.drop_otp_verified_at = new Date().toISOString();
      // Status will be updated when delivery is completed
    }

    const { data: updated, error: updateError } = await supabase
      .from('pickup_tracking')
      .update(updateData)
      .eq('lead_id', leadId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update tracking', details: updateError.message }, { status: 500 });
    }

    // Create activity log
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: `${otp_type}_OTP_VERIFIED`,
      description: `${otp_type} OTP verified successfully`,
      metadata: { otp_type },
    });

    // Workshop Admin notification (final)
    try {
      // Pull workshop context for routing
      const { data: fullLead } = await supabase
        .from('service_leads')
        .select('id, lead_number, workshop_id')
        .eq('id', leadId)
        .maybeSingle();

      const leadNumber = (fullLead as any)?.lead_number || leadId;
      const pickupBoyTitle = otp_type === 'DROP' ? 'Delivery OTP verified' : 'Pickup OTP verified';
      const pickupBoyMsg =
        otp_type === 'DROP'
          ? `Lead ${leadNumber}: Delivery OTP verified. Upload delivery photos and complete delivery.`
          : `Lead ${leadNumber}: Pickup OTP verified. Upload pickup photos, submit observation (if required), then mark vehicle picked.`;

      // Pickup boy confirmation (in-app + push)
      await notifyPickupBoy({
        pickupBoyId: user.id,
        type: 'OTP_VERIFIED',
        title: pickupBoyTitle,
        message: pickupBoyMsg,
        priority: 'MEDIUM',
        leadId,
        leadNumber,
        metadata: { otp_type },
      });

      if (fullLead?.workshop_id) {
        const title = otp_type === 'DROP' ? 'Delivery OTP verified' : 'Vehicle picked up (OTP verified)';
        const msg =
          otp_type === 'DROP'
            ? `Delivery OTP verified for lead ${leadNumber}.`
            : `Pickup OTP verified for lead ${leadNumber}. Vehicle is in transit to workshop.`;

        await notifyWorkshopRoles({
          workshopId: fullLead.workshop_id,
          roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
          type: 'OTP_VERIFIED',
          title,
          message: msg,
          priority: 'MEDIUM',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_admin/pending-leads`,
          metadata: { otp_type },
        });
      }
    } catch (e) {
      console.warn('OTP verified notifications failed (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'OTP verified successfully',
    });
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

