import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createNotification, notifyWorkshopRoles } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const selectProfile = 'id, email, phone, full_name, workshop_id, role_id, roles!inner(role_code)';

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
    const body = await request.json().catch(() => ({}));
    const { notes } = body as any;

    const leadId = params.id;

    // Get lead details (minimal fields for fast start)
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, lead_number, workshop_id, assigned_mechanic_id, assigned_supervisor_id, status')
      .eq('id', leadId)
      .maybeSingle();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify lead is assigned to this mechanic
    if (lead.assigned_mechanic_id !== userProfile.id) {
      return NextResponse.json({ error: 'Job not assigned to you' }, { status: 403 });
    }

    // Verify lead is in correct status
    // Keep in sync with UI "canStart"
    const validStatuses = ['TEAM_ASSIGNED', 'DELIVERED', 'ACCEPTED', 'VEHICLE_DROPPED_AT_WORKSHOP', 'REWORK_REQUIRED'];
    if (!validStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: 'Job cannot be started in current status',
        current_status: lead.status,
        hint: 'Job must be in TEAM_ASSIGNED or DELIVERED status'
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update lead status to IN_PROGRESS (no need to return full row)
    const { error: updateError } = await supabase
      .from('service_leads')
      .update({
        status: 'IN_PROGRESS',
        mechanic_started_at: now,
        updated_at: now
      })
      .eq('id', leadId)
      .select('id')
      .maybeSingle();

    if (updateError) {
      console.error('Error starting job:', updateError);
      return NextResponse.json({ error: 'Failed to start job' }, { status: 500 });
    }

    // Log writes (best-effort) - run in parallel to reduce latency
    void Promise.allSettled([
      supabase.from('lead_status_history').insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'IN_PROGRESS',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Mechanic started working on the job',
        notes: notes || 'Job started',
      } as any),
      supabase.from('lead_activities').insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'JOB_STARTED',
        description: 'Mechanic started working on the job',
        old_status: lead.status,
        new_status: 'IN_PROGRESS',
        metadata: {
          mechanic_id: userProfile.id,
          started_at: now,
          notes,
        },
      } as any),
    ]);

    // In-app notifications (Phase A)
    try {
      const leadNumber = (lead as any)?.lead_number || leadId;
      const mechanicName = (userProfile as any)?.full_name || 'Mechanic';

      if ((lead as any)?.assigned_supervisor_id) {
        await createNotification({
          userId: (lead as any).assigned_supervisor_id,
          type: 'JOB_STARTED',
          title: 'Job started',
          message: `${mechanicName} started work on lead ${leadNumber}.`,
          priority: 'MEDIUM',
          leadId,
          leadNumber,
          relatedUserName: mechanicName,
          actionUrl: `/dashboard/workshop_supervisor/jobs/${leadId}`,
        });
      }

      if ((lead as any)?.workshop_id) {
        await notifyWorkshopRoles({
          workshopId: (lead as any).workshop_id,
          roleCodes: ['WORKSHOP_ADMIN'],
          type: 'JOB_STARTED',
          title: 'Job started',
          message: `${mechanicName} started work on lead ${leadNumber}.`,
          priority: 'LOW',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_admin/leads/pending`,
        });
      }
    } catch (e) {
      console.warn('Job started notifications failed (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      message: 'Job started successfully',
      lead: { id: leadId, status: 'IN_PROGRESS', mechanic_started_at: now },
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

