import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { ADDITIONAL_JOB_KITS, kitForJobName, relatedPartsForJob } from '@/lib/workshop/additionalJobKits';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, workshop_id, roles!inner(role_code)';
    const { data: byEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };
    const { data: byPhone } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };
    const profile = byEmail || byPhone;
    const role = String((profile as any)?.roles?.role_code || '');
    if (!['WORKSHOP_MECHANIC', 'WORKSHOP_SUPERVISOR', 'WORKSHOP_ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const q = String(request.nextUrl.searchParams.get('q') || '').trim();
    const selected = String(request.nextUrl.searchParams.get('job') || '').trim();
    const { supabaseAdmin } = getSupabaseAdmin();
    const reader = supabaseAdmin || supabase;
    const workshopId = (profile as any)?.workshop_id || null;

    let query = reader
      .from('additional_jobs_master')
      .select('id, name, category, oem_price')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name')
      .limit(400);
    if (workshopId) query = query.or(`workshop_id.eq.${workshopId},workshop_id.is.null`);
    else query = query.is('workshop_id', null);
    const { data: master } = await query;
    const jobs = (master || []).map((row: any) => ({
      id: row.id,
      name: String(row.name || ''),
      category: String(row.category || ''),
    }));

    const filtered = q
      ? jobs.filter((j) => j.name.toLowerCase().includes(q.toLowerCase()) || j.category.toLowerCase().includes(q.toLowerCase()))
      : jobs.slice(0, 40);

    const jobName = selected || filtered[0]?.name || '';
    const masterNames = jobs.map((j) => j.name);
    const related = jobName ? relatedPartsForJob(jobName, masterNames) : [];
    const kit = jobName ? kitForJobName(jobName) : null;

    return NextResponse.json({
      success: true,
      kits: ADDITIONAL_JOB_KITS.map((k) => ({ key: k.key, title: k.title })),
      jobs: filtered,
      selected_job: jobName || null,
      kit_title: kit?.title || jobName || null,
      related_parts: related,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
