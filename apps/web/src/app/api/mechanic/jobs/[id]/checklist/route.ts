import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Get checklist for a job
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

    // Get checklist
    const { data: checklist, error: checklistError } = await supabase
      .from('service_checklists')
      .select('*')
      .eq('lead_id', leadId)
      .single();

    if (checklistError || !checklist) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      checklist
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get checklist API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update checklist item
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
    const { item_id, status, notes } = body;

    // Validate status
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'NOT_APPLICABLE'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status',
        valid_statuses: validStatuses
      }, { status: 400 });
    }

    // Get current checklist
    const { data: currentChecklist, error: checklistError } = await supabase
      .from('service_checklists')
      .select('*')
      .eq('lead_id', leadId)
      .single();

    if (checklistError || !currentChecklist) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    // Update the specific item in the JSONB array
    const checklistItems = currentChecklist.checklist_items || [];
    const itemIndex = checklistItems.findIndex((item: any) => item.id === item_id);

    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Update item
    checklistItems[itemIndex] = {
      ...checklistItems[itemIndex],
      status,
      notes: notes || checklistItems[itemIndex].notes,
      completed_at: status === 'COMPLETED' ? now : checklistItems[itemIndex].completed_at
    };

    // Calculate completion stats
    const totalItems = checklistItems.length;
    const completedItems = checklistItems.filter((item: any) => item.status === 'COMPLETED').length;
    const completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    const mandatoryItems = checklistItems.filter((item: any) => item.mandatory);
    const completedMandatoryItems = mandatoryItems.filter((item: any) => item.status === 'COMPLETED');
    const allMandatoryCompleted = mandatoryItems.length === completedMandatoryItems.length;

    // Update checklist
    const { data: updatedChecklist, error: updateError } = await supabase
      .from('service_checklists')
      .update({
        checklist_items: checklistItems,
        total_items: totalItems,
        completed_items: completedItems,
        completion_percentage: completionPercentage,
        all_mandatory_completed: allMandatoryCompleted,
        updated_at: now
      })
      .eq('lead_id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating checklist:', updateError);
      return NextResponse.json({ error: 'Failed to update checklist' }, { status: 500 });
    }

    // Update mechanic_jobs checklist_completed flag
    await supabase
      .from('mechanic_jobs')
      .update({
        checklist_completed: allMandatoryCompleted,
        checklist_completed_at: allMandatoryCompleted ? now : null,
        updated_at: now
      })
      .eq('lead_id', leadId);

    // Create activity log
    await supabase
      .from('mechanic_actions_log')
      .insert({
        lead_id: leadId,
        mechanic_id: userProfile.id,
        action_type: 'CHECKLIST_UPDATED',
        action_description: `Updated checklist item: ${checklistItems[itemIndex].name}`,
        metadata: {
          item_id,
          item_name: checklistItems[itemIndex].name,
          old_status: currentChecklist.checklist_items[itemIndex].status,
          new_status: status,
          completion_percentage: completionPercentage
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Checklist item updated successfully',
      checklist: updatedChecklist,
      stats: {
        total_items: totalItems,
        completed_items: completedItems,
        completion_percentage: completionPercentage,
        all_mandatory_completed: allMandatoryCompleted
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in update checklist API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new checklist for a job
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
    const { service_type } = body;

    // Check if checklist already exists
    const { data: existingChecklist } = await supabase
      .from('service_checklists')
      .select('id')
      .eq('lead_id', leadId)
      .single();

    if (existingChecklist) {
      return NextResponse.json({ 
        error: 'Checklist already exists for this job' 
      }, { status: 400 });
    }

    // Generate checklist items based on service type
    const checklistTemplates: { [key: string]: any[] } = {
      'FULL_SERVICE': [
        { id: 'item1', name: 'Engine oil drained', status: 'PENDING', mandatory: true },
        { id: 'item2', name: 'Oil filter replaced', status: 'PENDING', mandatory: true },
        { id: 'item3', name: 'Air filter inspected', status: 'PENDING', mandatory: true },
        { id: 'item4', name: 'Brake pads checked', status: 'PENDING', mandatory: true },
        { id: 'item5', name: 'Tire pressure checked', status: 'PENDING', mandatory: false },
        { id: 'item6', name: 'Battery terminals cleaned', status: 'PENDING', mandatory: false },
        { id: 'item7', name: 'Coolant level checked', status: 'PENDING', mandatory: true },
        { id: 'item8', name: 'Brake fluid checked', status: 'PENDING', mandatory: true },
        { id: 'item9', name: 'Wheel alignment checked', status: 'PENDING', mandatory: false },
        { id: 'item10', name: 'Test drive completed', status: 'PENDING', mandatory: true }
      ],
      'AC_SERVICE': [
        { id: 'ac1', name: 'AC gas pressure checked', status: 'PENDING', mandatory: true },
        { id: 'ac2', name: 'AC filter cleaned/replaced', status: 'PENDING', mandatory: true },
        { id: 'ac3', name: 'AC cooling tested', status: 'PENDING', mandatory: true },
        { id: 'ac4', name: 'AC vents cleaned', status: 'PENDING', mandatory: false },
        { id: 'ac5', name: 'Compressor checked', status: 'PENDING', mandatory: true }
      ],
      'BRAKE_SERVICE': [
        { id: 'brake1', name: 'Brake pads inspected', status: 'PENDING', mandatory: true },
        { id: 'brake2', name: 'Brake discs/drums checked', status: 'PENDING', mandatory: true },
        { id: 'brake3', name: 'Brake fluid checked/replaced', status: 'PENDING', mandatory: true },
        { id: 'brake4', name: 'Brake lines inspected', status: 'PENDING', mandatory: true },
        { id: 'brake5', name: 'Test drive brake performance', status: 'PENDING', mandatory: true }
      ],
      'GENERAL': [
        { id: 'gen1', name: 'Visual inspection completed', status: 'PENDING', mandatory: true },
        { id: 'gen2', name: 'Issue diagnosed', status: 'PENDING', mandatory: true },
        { id: 'gen3', name: 'Repair completed', status: 'PENDING', mandatory: true }
      ]
    };

    const checklistItems = checklistTemplates[service_type] || checklistTemplates['GENERAL'];

    // Create checklist
    const { data: newChecklist, error: createError } = await supabase
      .from('service_checklists')
      .insert({
        lead_id: leadId,
        mechanic_id: userProfile.id,
        service_type,
        checklist_items: checklistItems,
        total_items: checklistItems.length,
        completed_items: 0,
        completion_percentage: 0,
        all_mandatory_completed: false
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating checklist:', createError);
      return NextResponse.json({ error: 'Failed to create checklist' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Checklist created successfully',
      checklist: newChecklist
    }, { status: 201 });

  } catch (error) {
    console.error('Error in create checklist API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

