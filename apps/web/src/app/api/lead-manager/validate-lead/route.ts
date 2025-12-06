/**
 * ================================================================
 * LEAD MANAGER - VALIDATE LEAD API
 * ================================================================
 * Validates lead details and marks as VALIDATED
 * ================================================================
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
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
      .select('role_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('User fetch error:', userError);
      return NextResponse.json(
        { error: 'User not found', details: userError?.message },
        { status: 404 }
      );
    }

    // Get role details
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('role_code')
      .eq('id', userData.role_id)
      .single();

    if (roleError || !roleData) {
      console.error('Role fetch error:', roleError);
      return NextResponse.json(
        { error: 'Role not found', details: roleError?.message },
        { status: 404 }
      );
    }

    // Verify user is Lead Manager
    if (roleData.role_code !== 'LEAD_MANAGER') {
      return NextResponse.json(
        { error: 'Access denied. Only Lead Managers can validate leads.', roleCode: roleData.role_code },
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

    // Check if lead is in correct status for validation
    // Only NEW or INCOMPLETE leads can be validated
    const validStatusesForValidation = ['NEW', 'INCOMPLETE'];
    if (!validStatusesForValidation.includes(lead.status)) {
      console.error(`Lead status ${lead.status} is not valid for validation. Current status: ${lead.status}`);
      return NextResponse.json(
        { 
          error: `Cannot validate lead with status: ${lead.status}`,
          currentStatus: lead.status,
          allowedStatuses: validStatusesForValidation
        },
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
      // Clear incomplete flags when validating
      updateData.is_incomplete = false;
      updateData.incomplete_reason = null;
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
      console.error('Update error details:', {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code
      });
      return NextResponse.json(
        { 
          error: 'Failed to update lead', 
          details: updateError.message,
          code: updateError.code,
          hint: updateError.hint
        },
        { status: 500 }
      );
    }

    if (!updatedLead) {
      console.error('Update succeeded but no data returned');
      return NextResponse.json(
        { error: 'Lead updated but data not returned' },
        { status: 500 }
      );
    }

    // Log the activity (non-blocking)
    try {
    await supabase.from('lead_activities').insert({
      lead_id,
      user_id: user.id,
      activity_type: is_valid ? 'VALIDATED' : 'VALIDATION_FAILED',
      description: `Lead ${is_valid ? 'validated' : 'marked as incomplete'} by Lead Manager`,
      old_status: lead.status,
      new_status: updateData.status,
      metadata: { validation_notes }
    });
    } catch (activityError) {
      console.error('Failed to log activity:', activityError);
      // Don't fail the request if activity logging fails
    }

    // Log status history (non-blocking)
    try {
    await supabase.from('lead_status_history').insert({
      lead_id,
      old_status: lead.status,
      new_status: updateData.status,
      changed_by: user.id,
      reason: 'Lead Manager Validation',
      notes: validation_notes
    });
    } catch (historyError) {
      console.error('Failed to log status history:', historyError);
      // Don't fail the request if history logging fails
    }

    return NextResponse.json({
      success: true,
      message: is_valid ? 'Lead validated successfully' : 'Lead marked as incomplete',
      lead: updatedLead
    });

  } catch (error: any) {
    console.error('Validate lead error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message || 'Unknown error occurred' },
      { status: 500 }
    );
  }
}

