import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PUT - Update work notes
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
    const { work_notes, mechanic_observations, technical_notes } = body;

    const now = new Date().toISOString();
    const updates: any = {
      updated_at: now
    };

    if (work_notes !== undefined) updates.work_notes = work_notes;
    if (mechanic_observations !== undefined) updates.mechanic_observations = mechanic_observations;
    if (technical_notes !== undefined) updates.technical_notes = technical_notes;

    // Update mechanic_jobs
    const { data: updatedJob, error: updateError } = await supabase
      .from('mechanic_jobs')
      .update(updates)
      .eq('lead_id', leadId)
      .eq('mechanic_id', userProfile.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating notes:', updateError);
      return NextResponse.json({ error: 'Failed to update notes' }, { status: 500 });
    }

    // Create activity log
    await supabase
      .from('mechanic_actions_log')
      .insert({
        lead_id: leadId,
        mechanic_id: userProfile.id,
        action_type: 'NOTES_UPDATED',
        action_description: 'Updated work notes',
        metadata: {
          has_work_notes: !!work_notes,
          has_observations: !!mechanic_observations,
          has_technical_notes: !!technical_notes
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Notes updated successfully',
      work_notes: updatedJob.work_notes,
      mechanic_observations: updatedJob.mechanic_observations,
      technical_notes: updatedJob.technical_notes
    }, { status: 200 });

  } catch (error) {
    console.error('Error in update notes API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get work notes
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

    // Get notes
    const { data: job, error: jobError } = await supabase
      .from('mechanic_jobs')
      .select('work_notes, mechanic_observations, technical_notes, issues_found, hidden_damage_notes, repair_complications')
      .eq('lead_id', leadId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      notes: job
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get notes API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

