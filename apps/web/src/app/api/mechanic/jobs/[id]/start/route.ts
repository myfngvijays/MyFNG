import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

    // Get user profile (users_login is mapped by email/phone; not always same as auth user.id)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, role_id, roles!inner(role_code)';

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

    // Get request body (optional notes)
    const body = await request.json();
    const { notes } = body;

    const leadId = params.id;

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify lead is assigned to this mechanic
    if (lead.assigned_mechanic_id !== userProfile.id) {
      return NextResponse.json({ error: 'Job not assigned to you' }, { status: 403 });
    }

    // Verify lead is in correct status
    const validStatuses = ['TEAM_ASSIGNED', 'DELIVERED', 'ACCEPTED'];
    if (!validStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: 'Job cannot be started in current status',
        current_status: lead.status,
        hint: 'Job must be in TEAM_ASSIGNED or DELIVERED status'
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update lead status to IN_PROGRESS
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        status: 'IN_PROGRESS',
        mechanic_started_at: now,
        updated_at: now
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error starting job:', updateError);
      return NextResponse.json({ error: 'Failed to start job' }, { status: 500 });
    }

    // Log status change in lead_status_history
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'IN_PROGRESS',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Mechanic started working on the job',
        notes: notes || 'Job started'
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'JOB_STARTED',
        description: 'Mechanic started working on the job',
        old_status: lead.status,
        new_status: 'IN_PROGRESS',
        metadata: {
          mechanic_id: userProfile.id,
          started_at: now,
          notes: notes
        }
      });

    // TODO: Send notification to supervisor
    // TODO: Send notification to customer

    return NextResponse.json({
      success: true,
      message: 'Job started successfully',
      lead: updatedLead,
      instructions: [
        'Upload before images if not already uploaded',
        'Update progress regularly',
        'Request additional job approval if needed',
        'Upload progress images',
        'Mark job complete when finished',
        'Upload after images'
      ]
    }, { status: 200 });

  } catch (error) {
    console.error('Error in start job API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

