/**
 * Accept Lead API Endpoint
 * POST /api/leads/{id}/accept
 * Task: WA-103
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createNotification, notifyTelecallerTeamlead, notifyWorkshopRoles } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const params = await paramsPromise;
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, workshop_id, full_name')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      console.error('User profile error:', profileError);
      return NextResponse.json(
        { success: false, error: 'User profile not found', details: profileError?.message },
        { status: 404 }
      );
    }

    // Get role details
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('role_code')
      .eq('id', userProfile.role_id)
      .single();

    if (roleError || !roleData) {
      console.error('Role fetch error:', roleError);
      return NextResponse.json(
        { success: false, error: 'Role not found', details: roleError?.message },
        { status: 404 }
      );
    }

    // 3. Verify user is WORKSHOP_ADMIN or WORKSHOP_SUPERVISOR
    const roleCode = roleData.role_code;
    if (roleCode !== 'WORKSHOP_ADMIN' && roleCode !== 'WORKSHOP_SUPERVISOR') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Only Workshop Admin can accept leads.', roleCode },
        { status: 403 }
      );
    }

    const workshopId = userProfile.workshop_id;
    if (!workshopId) {
      return NextResponse.json(
        { success: false, error: 'User not assigned to a workshop' },
        { status: 400 }
      );
    }

    // 4. Get the lead
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', params.id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    // 5. Validate lead belongs to workshop
    if (lead.workshop_id !== workshopId) {
      return NextResponse.json(
        { success: false, error: 'Lead does not belong to your workshop' },
        { status: 403 }
      );
    }

    // 6. Validate lead status
    if (lead.status !== 'ASSIGNED') {
      return NextResponse.json(
        { success: false, error: `Lead cannot be accepted. Current status: ${lead.status}` },
        { status: 400 }
      );
    }

    // 7. Check SLA status
    if (lead.sla_accept_deadline) {
      const deadline = new Date(lead.sla_accept_deadline);
      const now = new Date();
      
      if (now > deadline) {
        // SLA breached, but still allow acceptance with warning
        console.warn(`SLA breached for lead ${lead.id}`);
      }
    }

    // 8. Update lead status to ACCEPTED
    const now = new Date().toISOString();
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        status: 'ACCEPTED',
        accepted_at: now,
        updated_by_id: user.id,
        updated_at: now,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating lead:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to accept lead' },
        { status: 500 }
      );
    }

    // 9. Create event log
    const { error: eventError } = await supabase
      .from('lead_events')
      .insert({
        lead_id: params.id,
        event_type: 'LEAD_ACCEPTED',
        event_description: `Lead accepted by ${userProfile.full_name || 'Workshop Admin'}`,
        event_data: {
          accepted_by: user.id,
          workshop_id: workshopId,
          previous_status: lead.status,
        },
        created_by: user.id,
      });

    if (eventError) {
      console.error('Error creating event:', eventError);
    }

    // 10. Create audit log
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'ACCEPT_LEAD',
        table_name: 'service_leads',
        record_id: params.id,
        old_data: { status: lead.status },
        new_data: { status: 'ACCEPTED', accepted_at: now },
      });

    if (auditError) {
      console.error('Error creating audit log:', auditError);
    }

    // 11. In-app notifications (Phase A)
    try {
      const leadId = params.id;
      const leadNumber = (lead as any)?.lead_number || leadId;
      const actorName = userProfile.full_name || 'Workshop';
      const isSupervisor = roleCode === 'WORKSHOP_SUPERVISOR';
      const isWorkshopAdmin = roleCode === 'WORKSHOP_ADMIN';

      // If Supervisor (Advisor) accepts → Notify Owner (WORKSHOP_ADMIN) + Lead Manager
      if (isSupervisor) {
        // Notify all Workshop Admins (Owners) in the workshop
        if (workshopId) {
          await notifyWorkshopRoles({
            workshopId,
            roleCodes: ['WORKSHOP_ADMIN'],
            type: 'LEAD_ACCEPTED',
            title: 'Lead accepted by supervisor',
            message: `Lead ${leadNumber} was accepted by ${actorName} (Supervisor).`,
            priority: 'MEDIUM',
            leadId,
            leadNumber,
            actionUrl: `/dashboard/workshop_admin/leads/${leadId}`,
            metadata: {
              kind: 'LEAD_ACCEPTED_BY_SUPERVISOR',
              accepted_by: userProfile.id,
              accepted_by_name: actorName,
            },
          });
        }

        // Notify Lead Manager
        const leadManagerId = (lead as any)?.lead_manager_assigned_id;
        if (leadManagerId) {
          await createNotification({
            userId: leadManagerId,
            type: 'LEAD_ACCEPTED',
            title: 'Workshop accepted lead',
            message: `Lead ${leadNumber} was accepted by ${actorName} (Supervisor).`,
            priority: 'MEDIUM',
            leadId,
            leadNumber,
            relatedUserName: actorName,
            actionUrl: `/dashboard/lead_manager/leads/${leadId}`,
            metadata: {
              kind: 'LEAD_ACCEPTED_BY_SUPERVISOR',
              accepted_by_role: 'WORKSHOP_SUPERVISOR',
            },
          });
        }
      }

      // If Admin (Owner) accepts → Notify Lead Manager only
      if (isWorkshopAdmin) {
        // Notify Lead Manager
        const leadManagerId = (lead as any)?.lead_manager_assigned_id;
        if (leadManagerId) {
          await createNotification({
            userId: leadManagerId,
            type: 'LEAD_ACCEPTED',
            title: 'Workshop accepted lead',
            message: `Lead ${leadNumber} was accepted by ${actorName} (Owner).`,
            priority: 'MEDIUM',
            leadId,
            leadNumber,
            relatedUserName: actorName,
            actionUrl: `/dashboard/lead_manager/leads/${leadId}`,
            metadata: {
              kind: 'LEAD_ACCEPTED_BY_OWNER',
              accepted_by_role: 'WORKSHOP_ADMIN',
            },
          });
        }
      }

      // Notify Telecaller + Teamlead (if telecaller assigned) - for both cases
      const telecallerId = (lead as any)?.assigned_telecaller_id;
      if (telecallerId) {
        await createNotification({
          userId: telecallerId,
          type: 'LEAD_ACCEPTED',
          title: 'Workshop accepted lead',
          message: `Lead ${leadNumber} has been accepted by workshop.`,
          priority: 'MEDIUM',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/telecaller/leads/${leadId}`,
          metadata: { new_status: 'ACCEPTED' },
        });

        await notifyTelecallerTeamlead({
          telecallerId,
          leadId,
          leadNumber,
          type: 'LEAD_ACCEPTED',
          title: 'Workshop accepted lead',
          message: `Lead ${leadNumber} has been accepted by workshop.`,
          priority: 'MEDIUM',
          metadata: { new_status: 'ACCEPTED' },
        });
      }
    } catch (e: any) {
      console.error('[Accept Lead] Notification failed:', {
        error: e?.message,
        stack: e?.stack,
        details: e
      });
    }

    // 12. TODO: Send notification to customer (if needed)

    return NextResponse.json({
      success: true,
      message: 'Lead accepted successfully',
      lead: updatedLead,
    });

  } catch (error: any) {
    console.error('Error in accept lead API:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message || 'Unknown error occurred' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}

