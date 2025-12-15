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

    const { data: byEmail, error: byEmailError } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null, error: null };

    const { data: byPhone, error: byPhoneError } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null, error: null };

    const userProfile = byEmail || byPhone;

    if (!userProfile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          user_email: email || null,
          user_phone: phone || null,
          profile_lookup_errors: [byEmailError?.message, byPhoneError?.message].filter(Boolean),
        },
        { status: 404 }
      );
    }

    // Verify user is mechanic
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_MECHANIC') {
      return NextResponse.json({ error: 'Forbidden: Mechanic only' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { description, reason, estimated_cost, category, attachment_url, is_urgent } = body;

    if (!description || !reason) {
      return NextResponse.json({ 
        error: 'Description and reason are required' 
      }, { status: 400 });
    }

    if (!estimated_cost || estimated_cost <= 0) {
      return NextResponse.json({ 
        error: 'Valid estimated cost is required' 
      }, { status: 400 });
    }

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

    // Prevent edits after archival/closure
    if (lead.read_only) {
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
    }

    // Verify lead is assigned to this mechanic
    if (lead.assigned_mechanic_id !== userProfile.id) {
      return NextResponse.json({ error: 'Job not assigned to you' }, { status: 403 });
    }

    // Verify lead is IN_PROGRESS
    if (lead.status !== 'IN_PROGRESS') {
      return NextResponse.json({ 
        error: 'Job must be in IN_PROGRESS status to request extra work',
        current_status: lead.status
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Create extra work request
    const { data: extraWorkRequest, error: insertError } = await supabase
      .from('lead_extra_charges')
      .insert({
        lead_id: leadId,
        description: description,
        reason: reason,
        amount: estimated_cost,
        category: category || 'EXTRA_WORK',
        attachment_url: attachment_url,
        is_urgent: is_urgent || false,
        status: 'PENDING',
        requested_by: userProfile.id,
        approval_requested_at: now,
        created_at: now
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating extra work request:', insertError);
      return NextResponse.json({ error: 'Failed to create extra work request' }, { status: 500 });
    }

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'EXTRA_WORK_REQUESTED',
        description: `Mechanic requested extra work: ${description}`,
        metadata: {
          mechanic_id: userProfile.id,
          extra_work_id: extraWorkRequest.id,
          description: description,
          reason: reason,
          estimated_cost: estimated_cost,
          category: category,
          is_urgent: is_urgent,
          requested_at: now
        }
      });

    // TODO: Send notification to supervisor (if assigned)
    // TODO: Send notification to workshop admin
    // TODO: If urgent, send SMS/WhatsApp alert

    return NextResponse.json({
      success: true,
      message: 'Extra work request submitted successfully',
      extra_work_request: extraWorkRequest,
      next_step: lead.assigned_supervisor_id 
        ? 'Supervisor will review and approve/reject your request'
        : 'Workshop Admin will review and approve/reject your request',
      status: 'PENDING_APPROVAL'
    }, { status: 201 });

  } catch (error) {
    console.error('Error in request extra work API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

