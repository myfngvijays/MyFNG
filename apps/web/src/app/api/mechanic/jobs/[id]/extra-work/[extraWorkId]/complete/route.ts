import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; extraWorkId: string } }
) {
  try {
    const supabase = await createClientFromRequest(request);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ADMIN_KEY;

    const supabaseAdmin =
      supabaseUrl && serviceRoleKey
        ? createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;

    // Auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Profile lookup (email/phone)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, full_name, workshop_id, role_id, roles!inner(role_code)';

    const { data: byEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };
    const { data: byPhone } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };

    const profile = byEmail || byPhone;
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

    const roleCode = (profile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_MECHANIC') {
      return NextResponse.json({ error: 'Forbidden: Mechanic only' }, { status: 403 });
    }

    const leadId = String(params.id || '').trim();
    const extraWorkId = String(params.extraWorkId || '').trim();
    if (!leadId || !extraWorkId) {
      return NextResponse.json({ error: 'Invalid id/extraWorkId' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const remark = typeof body?.remark === 'string' ? body.remark.trim() : '';

    // Gate: lead must be assigned to this mechanic
    const { data: lead, error: leadErr } = await supabase
      .from('service_leads')
      .select('id, assigned_mechanic_id, status, read_only, billing_locked_at')
      .eq('id', leadId)
      .maybeSingle();
    if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    if ((lead as any).read_only) return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
    if ((lead as any).billing_locked_at) {
      return NextResponse.json(
        { error: 'Edits are locked after QC approval', billing_locked_at: (lead as any).billing_locked_at },
        { status: 400 }
      );
    }
    if (String((lead as any).assigned_mechanic_id || '') !== String(profile.id)) {
      return NextResponse.json({ error: 'Job not assigned to you' }, { status: 403 });
    }

    const updater = supabaseAdmin ?? supabase;
    if (!supabaseAdmin) {
      // RLS may block mechanics from updating lead_extra_charges; prefer service role.
      // We fail loudly so server owners can set SUPABASE_SERVICE_ROLE_KEY.
      return NextResponse.json(
        {
          error: 'Server missing Supabase service role key for completion update',
          hint: 'Set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) on server to allow mechanic completion updates.',
        },
        { status: 500 }
      );
    }

    const { data: row, error: rowErr } = await updater
      .from('lead_extra_charges')
      .select('id, lead_id, status, work_completed, work_completed_at')
      .eq('id', extraWorkId)
      .maybeSingle();
    if (rowErr || !row) return NextResponse.json({ error: 'Additional job not found' }, { status: 404 });
    if (String((row as any).lead_id) !== leadId) {
      return NextResponse.json({ error: 'Additional job does not belong to this lead' }, { status: 400 });
    }

    const status = String((row as any).status || '').toUpperCase();
    if (status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only approved additional jobs can be marked completed', current_status: (row as any).status },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Idempotent: if already completed, just update remark (if provided)
    const payload: any = {
      work_completed: true,
      work_completed_at: (row as any).work_completed_at || now,
      work_completed_by: profile.id,
      work_completion_remark: remark || null,
    };

    const { error: updErr } = await updater.from('lead_extra_charges').update(payload).eq('id', extraWorkId);
    if (updErr) {
      return NextResponse.json({ error: (updErr as any)?.message || 'Failed to mark completed' }, { status: 500 });
    }

    // Best-effort lead event
    try {
      await updater.from('lead_events').insert({
        lead_id: leadId,
        event_type: 'MECHANIC_EXTRA_WORK_COMPLETED',
        event_description: `Mechanic marked additional work completed${remark ? ` • Remark: ${remark}` : ''}`,
        created_at: now,
      } as any);
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message || String(e) }, { status: 500 });
  }
}

