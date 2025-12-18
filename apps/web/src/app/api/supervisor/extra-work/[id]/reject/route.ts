import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ADMIN_KEY;

    // Prefer service-role client (bypasses RLS), but allow fallback to user client.
    const supabaseAdmin =
      supabaseUrl && serviceRoleKey
        ? createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with role (users_login is mapped by email/phone; not always same as auth user.id)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, role_id, roles!inner(role_code)';

    const { data: userProfileByEmail, error: profileErrorByEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileByPhone, error: profileErrorByPhone } = !userProfileByEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null, error: null };

    // Legacy fallback if some envs map users_login.id == auth user.id
    const { data: userProfileById, error: profileErrorById } = !userProfileByEmail && !userProfileByPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null, error: null };

    const userProfile = userProfileByEmail || userProfileByPhone || userProfileById;

    if (!userProfile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          hint: 'No matching users_login row for this session user (email/phone/id)',
          user_email: email || null,
          user_phone: phone || null,
          profile_lookup_errors: [profileErrorByEmail?.message, profileErrorByPhone?.message, profileErrorById?.message].filter(Boolean),
        },
        { status: 404 }
      );
    }

    // Verify user is supervisor
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_SUPERVISOR') {
      return NextResponse.json({ error: 'Forbidden: Supervisor only' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { reason, notes } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    const extraWorkId = params.id;

    // Get additional job request details
    const { data: extraWork, error: extraWorkError } = await supabase
      .from('lead_extra_charges')
      .select('*, service_leads!inner(workshop_id, assigned_mechanic_id)')
      .eq('id', extraWorkId)
      .single();

    if (extraWorkError || !extraWork) {
      return NextResponse.json({ error: 'Additional job request not found' }, { status: 404 });
    }

    // Verify additional job is from this workshop
    if (extraWork.service_leads.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Additional job request not in your workshop' }, { status: 403 });
    }

    // Verify status is PENDING
    if (extraWork.status !== 'PENDING') {
      return NextResponse.json({ 
        error: 'Additional job request is not pending',
        current_status: extraWork.status
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Reject additional job request
    // Use service-role client so DB triggers (supervisor_actions) aren't blocked by RLS
    const updater = supabaseAdmin ?? supabase;
    const { data: updatedExtraWork, error: updateError } = await updater
      .from('lead_extra_charges')
      // NOTE: Cast to `any` because generated DB types can be incomplete in some environments.
      .update({
        status: 'REJECTED',
        approved_by: userProfile.id,
        supervisor_approved_by: userProfile.id,
        approval_responded_at: now,
        rejection_reason: reason,
        supervisor_approval_notes: notes || reason
      } as any)
      .eq('id', extraWorkId)
      .select()
      .single();

    if (updateError) {
      console.error('Error rejecting additional job:', updateError);
      const msg = (updateError as any)?.message || '';
      const code = (updateError as any)?.code || null;
      const isRls =
        code === '42501' ||
        /row-level security|violates row level security|permission denied/i.test(msg);
      return NextResponse.json(
        {
          error: 'Failed to reject additional job',
          details: msg,
          code,
          env: {
            hasSupabaseUrl: Boolean(supabaseUrl),
            hasServiceRoleKey: Boolean(serviceRoleKey),
            serviceKeySource: process.env.SUPABASE_SERVICE_ROLE_KEY
              ? 'SUPABASE_SERVICE_ROLE_KEY'
              : process.env.SUPABASE_SERVICE_KEY
                ? 'SUPABASE_SERVICE_KEY'
                : process.env.SUPABASE_ADMIN_KEY
                  ? 'SUPABASE_ADMIN_KEY'
                : null,
          },
          hint:
            !supabaseAdmin
              ? 'Server is missing a Supabase service key (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY) or Supabase URL (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL). Without service role, RLS must allow supervisors to update lead_extra_charges.'
              : isRls
                ? 'RLS is blocking this update. Use service role key on server or update Supabase RLS policy for supervisor approval.'
                : null,
        },
        { status: isRls ? 403 : 500 }
      );
    }

    // Create activity log
    await (supabaseAdmin ?? supabase)
      .from('lead_activities')
      .insert({
        lead_id: extraWork.lead_id,
        user_id: userProfile.id,
        activity_type: 'EXTRA_WORK_REJECTED',
        description: `Supervisor rejected additional job: ${reason}`,
        metadata: {
          supervisor_id: userProfile.id,
          extra_work_id: extraWorkId,
          requested_amount: extraWork.amount,
          rejection_reason: reason,
          rejected_at: now,
          notes: notes
        }
      } as any);

    // NOTE: supervisor_actions is auto-logged by a DB trigger on lead_extra_charges updates.
    // We intentionally avoid inserting here to prevent duplicates and RLS errors.

    // TODO: Send notification to mechanic (rejection notice)
    // TODO: Send notification to workshop admin

    return NextResponse.json({
      success: true,
      message: 'Extra work rejected',
      extra_work: updatedExtraWork,
      rejection_reason: reason,
      next_step: 'Mechanic has been notified of the rejection'
    }, { status: 200 });

  } catch (error) {
    console.error('Error in reject additional job API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as any)?.message || String(error) },
      { status: 500 }
    );
  }
}

