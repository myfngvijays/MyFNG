import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pickup/tasks/[id]/drop/arrived
 * Mark that pickup boy arrived at customer location for delivery.
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
      .select('id, status, read_only, assigned_pickup_boy_id')
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

    const { data: tracking } = await supabase
      .from('pickup_tracking')
      .select('lead_id, drop_assigned_to, drop_required')
      .eq('lead_id', leadId)
      .maybeSingle();

    const canAct =
      lead.assigned_pickup_boy_id === userProfile.id || (tracking as any)?.drop_assigned_to === userProfile.id;
    if (!canAct) return NextResponse.json({ error: 'Not assigned to this delivery' }, { status: 403 });

    const now = new Date().toISOString();
    await supabase
      .from('pickup_tracking')
      .upsert(
        {
          lead_id: leadId,
          drop_required: true,
          drop_assigned_to: userProfile.id,
          drop_status: 'ARRIVED_AT_CUSTOMER',
          drop_arrived_at: now,
          updated_at: now,
        } as any,
        { onConflict: 'lead_id' }
      );

    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: userProfile.id,
      activity_type: 'ARRIVED_AT_CUSTOMER_DELIVERY',
      description: 'Arrived at customer for delivery',
    } as any);

    return NextResponse.json({ success: true, message: 'Arrived at customer for delivery' }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


