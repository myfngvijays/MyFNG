import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { notifyTelecallerForLead } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pickup/tasks/[id]/observation
 * Save pickup observation text for a lead.
 *
 * Allowed roles:
 * - WORKSHOP_PICKUP_BOY (must be assigned to the lead)
 * - WORKSHOP_SUPERVISOR / WORKSHOP_ADMIN (must belong to the same workshop as the lead)
 * - SUPER_ADMIN / SUB_ADMIN (global)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClientFromRequest(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, workshop_id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();
    if (profileError || !userProfile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

    const roleCode = (userProfile.roles as any)?.role_code;
    const allowed = new Set([
      'WORKSHOP_PICKUP_BOY',
      'WORKSHOP_SUPERVISOR',
      'WORKSHOP_ADMIN',
      'SUPER_ADMIN',
      'SUB_ADMIN',
    ]);
    if (!allowed.has(String(roleCode || ''))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const observation = String(body?.observation ?? '').trim();
    if (!observation) return NextResponse.json({ error: 'observation is required' }, { status: 400 });

    const leadId = params.id;

    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, status, pickup_status, pickup_required, assigned_pickup_boy_id, workshop_id')
      .eq('id', leadId)
      .single();
    if (leadError || !lead) return NextResponse.json({ error: 'Pickup task not found' }, { status: 404 });

    const rc = String(roleCode || '');
    if (rc === 'WORKSHOP_PICKUP_BOY') {
      if (lead.assigned_pickup_boy_id !== userProfile.id) {
        return NextResponse.json({ error: 'Pickup task not assigned to you' }, { status: 403 });
      }
      if (!lead.pickup_required) {
        return NextResponse.json({ error: 'Pickup not required for this lead' }, { status: 400 });
      }
    } else if (rc === 'WORKSHOP_ADMIN' || rc === 'WORKSHOP_SUPERVISOR') {
      if (!userProfile.workshop_id || lead.workshop_id !== userProfile.workshop_id) {
        return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
      }
    } else {
      // SUPER_ADMIN / SUB_ADMIN allowed globally
    }

    // Prevent updating on closed leads
    const protectedStatuses = ['CLOSED', 'DELIVERED'];
    if (protectedStatuses.includes(String(lead.status || '').toUpperCase())) {
      return NextResponse.json({ error: 'Cannot update observation for closed/delivered lead' }, { status: 400 });
    }

    const now = new Date().toISOString();
    
    // Separate observations based on role
    let updateData: any = {
      updated_at: now,
    };

    if (rc === 'WORKSHOP_PICKUP_BOY') {
      // Pickup boy's observation (using existing pickup_observation field)
      updateData.pickup_observation = observation;
      updateData.pickup_observation_updated_at = now;
      updateData.pickup_observation_by = userProfile.id;
    } else {
      // Supervisor/Admin/Advisor observation (new separate field)
      updateData.supervisor_observation = observation;
      updateData.supervisor_observation_updated_at = now;
      updateData.supervisor_observation_by = userProfile.id;
    }

    const { error: updateError } = await supabase
      .from('service_leads')
      .update(updateData)
      .eq('id', leadId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save observation', details: updateError.message }, { status: 500 });
    }

    // Non-blocking activity log
    try {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'PICKUP_OBSERVATION',
        description: 'Pickup observation updated',
        metadata: { actor_role: rc, actor_id: userProfile.id },
      } as any);
    } catch {
      // ignore
    }

    // Notify telecaller about pickup observation
    try {
      const { data: leadForNotif } = await supabase
        .from('service_leads')
        .select('lead_number')
        .eq('id', leadId)
        .single();

      const leadNumber = (leadForNotif as any)?.lead_number || leadId;
      const observationPreview = observation.length > 100 
        ? observation.substring(0, 100) + '...' 
        : observation;

      await notifyTelecallerForLead({
        leadId,
        leadNumber,
        type: 'PICKUP_OBSERVATION_ADDED',
        title: 'Pickup observation added',
        message: `Pickup observation added for lead ${leadNumber}: ${observationPreview}`,
        priority: 'MEDIUM',
        metadata: { observation_length: observation.length },
      });
    } catch (e) {
      console.warn('Pickup observation notification failed (non-blocking):', e);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


