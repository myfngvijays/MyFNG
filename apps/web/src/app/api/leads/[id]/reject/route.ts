/**
 * Reject Lead API Endpoint
 * POST /api/leads/{id}/reject
 * Task: WA-103
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RejectLeadRequest {
  reason: string;
  notes?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body: RejectLeadRequest = await request.json();
    
    if (!body.reason || body.reason.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason is required (minimum 10 characters)' },
        { status: 400 }
      );
    }

    // 3. Get user profile and role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, full_name, role_id, workshop_id, roles!role_id(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    // 4. Verify user is WORKSHOP_ADMIN
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Only Workshop Admin can reject leads.' },
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

    // 5. Get the lead
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

    // 6. Validate lead belongs to workshop
    if (lead.workshop_id !== workshopId) {
      return NextResponse.json(
        { success: false, error: 'Lead does not belong to your workshop' },
        { status: 403 }
      );
    }

    // 7. Validate lead status
    if (lead.status !== 'ASSIGNED') {
      return NextResponse.json(
        { success: false, error: `Lead cannot be rejected. Current status: ${lead.status}` },
        { status: 400 }
      );
    }

    // 8. Update lead status to REJECTED
    const now = new Date().toISOString();
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        status: 'REJECTED',
        rejected_at: now,
        rejected_reason: body.reason.trim(),
        rejection_notes: body.notes?.trim() || null,
        updated_by_id: user.id,
        updated_at: now,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating lead:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to reject lead' },
        { status: 500 }
      );
    }

    // 9. Create event log
    const { error: eventError } = await supabase
      .from('lead_events')
      .insert({
        lead_id: params.id,
        event_type: 'LEAD_REJECTED',
        event_description: `Lead rejected by ${userProfile.full_name || 'Workshop Admin'}: ${body.reason}`,
        event_data: {
          rejected_by: user.id,
          workshop_id: workshopId,
          reason: body.reason,
          notes: body.notes,
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
        action: 'REJECT_LEAD',
        table_name: 'service_leads',
        record_id: params.id,
        old_data: { status: lead.status },
        new_data: { 
          status: 'REJECTED', 
          rejected_at: now,
          rejected_reason: body.reason 
        },
      });

    if (auditError) {
      console.error('Error creating audit log:', auditError);
    }

    // 11. TODO: Send notification to Lead Manager
    // 12. TODO: Send notification to customer (if needed)

    return NextResponse.json({
      success: true,
      message: 'Lead rejected successfully',
      lead: updatedLead,
    });

  } catch (error) {
    console.error('Error in reject lead API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
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

