import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Get parts for a job
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leadId = params.id;

    // Get parts
    const { data: parts, error: partsError } = await supabase
      .from('mechanic_parts_usage')
      .select('*')
      .eq('lead_id', leadId)
      .order('issued_at', { ascending: false });

    if (partsError) {
      console.error('Error fetching parts:', partsError);
      return NextResponse.json({ error: 'Failed to fetch parts' }, { status: 500 });
    }

    // Calculate summary
    const summary = {
      total_issued: parts?.length || 0,
      total_used: parts?.filter(p => p.usage_status === 'USED').length || 0,
      total_not_needed: parts?.filter(p => p.usage_status === 'NOT_NEEDED').length || 0,
      additional_required: parts?.filter(p => p.usage_status === 'ADDITIONAL_REQUIRED').length || 0
    };

    return NextResponse.json({
      success: true,
      parts: parts || [],
      summary
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get parts API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update part usage
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      console.error('Profile error:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is mechanic
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_MECHANIC') {
      return NextResponse.json({ error: 'Forbidden: Mechanic only' }, { status: 403 });
    }

    const leadId = params.id;

    // Get request body
    const body = await request.json();
    const { 
      part_id, 
      quantity_used, 
      usage_status, 
      part_notes, 
      additional_quantity_requested 
    } = body;

    if (!part_id) {
      return NextResponse.json({ error: 'Part ID is required' }, { status: 400 });
    }

    // Validate usage status
    const validStatuses = ['ISSUED', 'USED', 'NOT_NEEDED', 'ADDITIONAL_REQUIRED', 'DAMAGED', 'RETURNED'];
    if (usage_status && !validStatuses.includes(usage_status)) {
      return NextResponse.json({ 
        error: 'Invalid usage status',
        valid_statuses: validStatuses
      }, { status: 400 });
    }

    // Get current part
    const { data: currentPart, error: partError } = await supabase
      .from('mechanic_parts_usage')
      .select('*')
      .eq('id', part_id)
      .eq('lead_id', leadId)
      .single();

    if (partError || !currentPart) {
      return NextResponse.json({ error: 'Part not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updates: any = {
      updated_at: now
    };

    // Add fields to update
    if (quantity_used !== undefined) {
      updates.quantity_used = quantity_used;
    }
    if (usage_status) {
      updates.usage_status = usage_status;
      if (usage_status === 'USED') {
        updates.used_at = now;
      }
    }
    if (part_notes) {
      updates.part_notes = part_notes;
    }
    if (additional_quantity_requested !== undefined) {
      updates.additional_quantity_requested = additional_quantity_requested;
    }

    // Update part
    const { data: updatedPart, error: updateError } = await supabase
      .from('mechanic_parts_usage')
      .update(updates)
      .eq('id', part_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating part:', updateError);
      return NextResponse.json({ error: 'Failed to update part' }, { status: 500 });
    }

    // Create activity log
    await supabase
      .from('mechanic_actions_log')
      .insert({
        lead_id: leadId,
        mechanic_id: userProfile.id,
        action_type: 'PARTS_UPDATED',
        action_description: `Updated part usage: ${currentPart.part_name}`,
        metadata: {
          part_id,
          part_name: currentPart.part_name,
          old_status: currentPart.usage_status,
          new_status: usage_status || currentPart.usage_status,
          quantity_used: quantity_used || currentPart.quantity_used
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Part updated successfully',
      part: updatedPart
    }, { status: 200 });

  } catch (error) {
    console.error('Error in update part API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Add a new part to the job
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const leadId = params.id;

    // Get request body
    const body = await request.json();
    const { 
      part_name, 
      part_code, 
      quantity_issued, 
      part_notes 
    } = body;

    if (!part_name) {
      return NextResponse.json({ error: 'Part name is required' }, { status: 400 });
    }

    // Create part record
    const { data: newPart, error: createError } = await supabase
      .from('mechanic_parts_usage')
      .insert({
        lead_id: leadId,
        mechanic_id: userProfile.id,
        part_name,
        part_code,
        quantity_issued: quantity_issued || 1,
        quantity_used: 0,
        usage_status: 'ISSUED',
        part_notes
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating part:', createError);
      return NextResponse.json({ error: 'Failed to create part record' }, { status: 500 });
    }

    // Create activity log
    await supabase
      .from('mechanic_actions_log')
      .insert({
        lead_id: leadId,
        mechanic_id: userProfile.id,
        action_type: 'PART_ADDED',
        action_description: `Added new part: ${part_name}`,
        metadata: {
          part_id: newPart.id,
          part_name,
          quantity_issued: quantity_issued || 1
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Part added successfully',
      part: newPart
    }, { status: 201 });

  } catch (error) {
    console.error('Error in add part API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

