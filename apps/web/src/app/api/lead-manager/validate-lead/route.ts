/**
 * ================================================================
 * LEAD MANAGER - VALIDATE LEAD API
 * ================================================================
 * Validates lead details and marks as VALIDATED
 * ================================================================
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user details to verify role
    const { data: userData, error: userError } = await supabase
      .from('users_login')
      .select('role_id, roles(role_code)')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify user is Lead Manager
    const roleCode = (userData.roles as any)?.role_code;
    if (roleCode !== 'lead_manager') {
      return NextResponse.json(
        { error: 'Access denied. Only Lead Managers can validate leads.' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { lead_id, validation_notes, is_valid } = body;

    if (!lead_id) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    // Get the lead
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Check if lead is in correct status
    if (lead.status !== 'NEW' && lead.status !== 'INCOMPLETE') {
      return NextResponse.json(
        { error: `Cannot validate lead with status: ${lead.status}` },
        { status: 400 }
      );
    }

    // Update lead status
    const updateData: any = {
      validated_by_id: user.id,
      validated_at: new Date().toISOString(),
      validation_notes: validation_notes || null,
      updated_at: new Date().toISOString(),
    };

    if (is_valid) {
      updateData.status = 'VALIDATED';
    } else {
      // If not valid, mark as INCOMPLETE for telecaller to fix
      updateData.status = 'INCOMPLETE';
      updateData.is_incomplete = true;
      updateData.incomplete_reason = validation_notes || 'Validation failed';
    }

    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update(updateData)
      .eq('id', lead_id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update lead', details: updateError.message },
        { status: 500 }
      );
    }

    // Log the activity
    await supabase.from('lead_activities').insert({
      lead_id,
      user_id: user.id,
      activity_type: is_valid ? 'VALIDATED' : 'VALIDATION_FAILED',
      description: `Lead ${is_valid ? 'validated' : 'marked as incomplete'} by Lead Manager`,
      old_status: lead.status,
      new_status: updateData.status,
      metadata: { validation_notes }
    });

    // Log status history
    await supabase.from('lead_status_history').insert({
      lead_id,
      old_status: lead.status,
      new_status: updateData.status,
      changed_by: user.id,
      reason: 'Lead Manager Validation',
      notes: validation_notes
    });

    return NextResponse.json({
      success: true,
      message: is_valid ? 'Lead validated successfully' : 'Lead marked as incomplete',
      lead: updatedLead
    });

  } catch (error: any) {
    console.error('Validate lead error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

