import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { notifyPickupBoy } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workshop/leads/[id]/pickup/observation-required
 * Toggle per-lead pickup observation requirement (admin/supervisor).
 */
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClientFromRequest(request);
    const params = await paramsPromise;

    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, workshop_id, roles!inner(role_code)')
      .eq('id', auth.user.id)
      .single();
    if (profileError || !userProfile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

    const roleCode = (userProfile.roles as any)?.role_code;
    if (!['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'].includes(String(roleCode || ''))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const leadId = params.id;
    const body = await request.json().catch(() => ({}));
    const required = !!body?.required;

    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, lead_number, workshop_id, assigned_pickup_boy_id')
      .eq('id', leadId)
      .single();
    if (leadError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    if (!userProfile.workshop_id || (lead as any).workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('service_leads')
      .update({
        pickup_observation_required: required,
        pickup_observation_required_set_by: userProfile.id,
        pickup_observation_required_set_at: now,
        updated_at: now,
      } as any)
      .eq('id', leadId);

    if (updateError) {
      const msg = String(updateError.message || '');
      if (msg.toLowerCase().includes('pickup_observation_required') && msg.toLowerCase().includes('does not exist')) {
        return NextResponse.json(
          { error: 'Missing DB columns for observation required flag', hint: 'Run migration: database/111_pickup_boy_notifications.sql' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Failed to update lead', details: updateError.message }, { status: 500 });
    }

    // Notify pickup boy if requirement was enabled
    try {
      const pickupBoyId = (lead as any)?.assigned_pickup_boy_id;
      if (required && pickupBoyId) {
        const leadNumber = (lead as any)?.lead_number || leadId;
        await notifyPickupBoy({
          pickupBoyId,
          type: 'PICKUP_OBSERVATION_REQUIRED',
          title: 'Observation required',
          message: `Lead ${leadNumber}: Observation report is mandatory. Submit it to continue pickup.`,
          priority: 'HIGH',
          leadId,
          leadNumber,
          metadata: { kind: 'PICKUP_OBSERVATION_REQUIRED' },
        });
      }
    } catch {
      // non-blocking
    }

    return NextResponse.json({ success: true, required }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


