/**
 * Telecaller Sub Admin Lead Escalation API
 * POST /api/subadmin/telecaller/leads/[id]/escalate
 * Escalate lead to Lead Manager
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, department, full_name, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const department = userProfile.department;

    if (roleCode !== 'SUB_ADMIN' || department !== 'TELECALLER') {
      return NextResponse.json({ error: 'Forbidden: Telecaller Sub Admin role required' }, { status: 403 });
    }

    const leadId = params.id;
    const body = await request.json();
    const { escalation_reason, lead_manager_id } = body;

    if (!escalation_reason) {
      return NextResponse.json({ error: 'escalation_reason is required' }, { status: 400 });
    }

    // Get current lead
    const { data: currentLead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, status, assigned_telecaller_id')
      .eq('id', leadId)
      .single();

    if (leadError || !currentLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Find Lead Manager (if not provided)
    let targetLeadManagerId = lead_manager_id;
    
    if (!targetLeadManagerId) {
      const { data: leadManagers } = await supabase
        .from('users_login')
        .select('id')
        .eq('role_id', (await supabase.from('roles').select('id').eq('role_code', 'LEAD_MANAGER').single()).data?.id)
        .eq('is_active', true)
        .limit(1);

      if (leadManagers && leadManagers.length > 0) {
        targetLeadManagerId = leadManagers[0].id;
      }
    }

    if (!targetLeadManagerId) {
      return NextResponse.json({ error: 'No Lead Manager available' }, { status: 400 });
    }

    // Update lead - assign to Lead Manager
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        lead_manager_assigned_id: targetLeadManagerId,
        lead_manager_assigned_at: new Date().toISOString(),
        escalation: true,
        notes_internal: escalation_reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError || !updatedLead) {
      console.error('Error escalating lead:', updateError);
      return NextResponse.json(
        { error: 'Failed to escalate lead', details: updateError?.message },
        { status: 500 }
      );
    }

    // Create escalation record
    await supabase.from('escalations').insert({
      department: 'TELECALLER',
      escalation_type: 'LEAD_QUALITY',
      priority: 'HIGH',
      status: 'OPEN',
      lead_id: leadId,
      escalated_by: user.id,
      escalated_to: targetLeadManagerId,
      escalation_reason: escalation_reason,
    });

    // Log action
    await supabase.from('subadmin_actions').insert({
      subadmin_id: user.id,
      department: 'TELECALLER',
      action_type: 'ESCALATE_TO_LEAD_MANAGER',
      action_description: `Escalated lead ${leadId} to Lead Manager`,
      related_entity_type: 'LEAD',
      related_entity_id: leadId,
      old_status: currentLead.status,
      new_status: updatedLead.status,
      metadata: {
        escalation_reason: escalation_reason,
        lead_manager_id: targetLeadManagerId,
      },
    });

    // Log in lead activities
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'ESCALATED',
      description: `Escalated to Lead Manager: ${escalation_reason}`,
      metadata: {
        escalated_to: 'LEAD_MANAGER',
        escalation_reason: escalation_reason,
      },
    });

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      message: 'Lead escalated to Lead Manager successfully',
    });

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/telecaller/leads/[id]/escalate:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

