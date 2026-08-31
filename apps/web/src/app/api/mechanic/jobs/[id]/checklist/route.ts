import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

// GET - Get checklist for a job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClientFromRequest(request);
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    }

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClientFromRequest(request);
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile (users_login is mapped by email/phone; not always same as auth user.id)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, roles!inner(role_code)';

    const { data: userProfileByEmail, error: profileErrorByEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileByPhone, error: profileErrorByPhone } = !userProfileByEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileById, error: profileErrorById } = !userProfileByEmail && !userProfileByPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null, error: null };

    const userProfile = userProfileByEmail || userProfileByPhone || userProfileById;

    if (!userProfile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          user_email: email || null,
          user_phone: phone || null,
          profile_lookup_errors: [profileErrorByEmail?.message, profileErrorByPhone?.message, profileErrorById?.message].filter(Boolean),
        },
        { status: 404 }
      );
    }

    // Verify user is mechanic
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_MECHANIC') {
      return NextResponse.json({ error: 'Forbidden: Mechanic only' }, { status: 403 });
    }

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    }

    // Get request body
    const body = await request.json();
    const { item_id, status, notes, remark } = body;

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
    // Create a new array to avoid mutation issues
    const checklistItems = JSON.parse(JSON.stringify(currentChecklist.checklist_items || []));
    const itemIndex = checklistItems.findIndex((item: any) => item.id === item_id);

    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const currentItem = checklistItems[itemIndex];

    // Update item - preserve all existing fields and update only what's provided
    checklistItems[itemIndex] = {
      id: currentItem.id,
      name: currentItem.name,
      status: status,
      mandatory: currentItem.mandatory !== undefined ? currentItem.mandatory : true,
      category: currentItem.category || null,
      notes: notes !== undefined ? notes : (currentItem.notes || ''),
      remark: remark !== undefined ? remark : (currentItem.remark || ''),
      completed_at: status === 'COMPLETED' ? now : (currentItem.completed_at || null)
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
      console.error('Update details:', {
        leadId,
        checklistItems: JSON.stringify(checklistItems),
        totalItems,
        completedItems,
        completionPercentage,
        allMandatoryCompleted
      });
      return NextResponse.json({ 
        error: 'Failed to update checklist', 
        details: updateError.message,
        code: updateError.code,
        hint: updateError.hint
      }, { status: 500 });
    }

    // Update mechanic_jobs checklist + auto IN_PROGRESS when work started
    const { supabaseAdmin } = getSupabaseAdmin();
    const jobClient = supabaseAdmin || supabase;
    const { data: currentJob } = await jobClient
      .from('mechanic_jobs')
      .select('started_at, mechanic_status')
      .eq('lead_id', leadId)
      .maybeSingle();

    const jobUpdates: Record<string, unknown> = {
      checklist_completed: allMandatoryCompleted,
      checklist_completed_at: allMandatoryCompleted ? now : null,
      updated_at: now,
    };
    if (completedItems > 0 && completedItems < totalItems) {
      jobUpdates.mechanic_status = 'IN_PROGRESS';
      if (!currentJob?.started_at) {
        jobUpdates.started_at = now;
      }
    }

    await jobClient.from('mechanic_jobs').update(jobUpdates).eq('lead_id', leadId);

    if (completedItems > 0 && supabaseAdmin) {
      await supabaseAdmin
        .from('service_leads')
        .update({ status: 'IN_PROGRESS', updated_at: now })
        .eq('id', leadId)
        .in('status', ['ACCEPTED', 'ASSIGNED', 'ASSIGNED_TO_WORKSHOP', 'TEAM_ASSIGNED']);
    }

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClientFromRequest(request);
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile (users_login is mapped by email/phone; not always same as auth user.id)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, role_id, roles!inner(role_code)';

    const { data: userProfileByEmail, error: profileErrorByEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileByPhone, error: profileErrorByPhone } = !userProfileByEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileById, error: profileErrorById } = !userProfileByEmail && !userProfileByPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null, error: null };

    const userProfile = userProfileByEmail || userProfileByPhone || userProfileById;

    if (!userProfile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          user_email: email || null,
          user_phone: phone || null,
          profile_lookup_errors: [profileErrorByEmail?.message, profileErrorByPhone?.message, profileErrorById?.message].filter(Boolean),
        },
        { status: 404 }
      );
    }

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    }

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

