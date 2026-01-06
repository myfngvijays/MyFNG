import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RoleCode = 'SUPER_ADMIN';
type ApplyMode = 'OVERWRITE' | 'FILL_MISSING';

async function getAuthedProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { profile: null as any, roleCode: null as string | null, error: 'Unauthorized' as const };

  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, workshop_id, roles!inner(role_code)';

  const { data: byEmail } = email
    ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null };
  const { data: byPhone } =
    !byEmail && phone ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle() : { data: null };
  const { data: byId } =
    !byEmail && !byPhone ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle() : { data: null };

  const profile = byEmail || byPhone || byId;
  const roleCode = (profile?.roles as any)?.role_code || null;
  return { profile, roleCode, error: profile ? null : ('User profile not found' as const) };
}

function isRoleAllowed(roleCode: string | null): roleCode is RoleCode {
  return roleCode === 'SUPER_ADMIN';
}

function normalizeFuelType(v: any): 'PETROL' | 'DIESEL' | 'CNG' {
  const s = String(v || '').trim().toUpperCase();
  if (s === 'DIESEL') return 'DIESEL';
  if (s === 'CNG') return 'CNG';
  return 'PETROL';
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { profile, roleCode, error } = await getAuthedProfile(supabase);

    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (!isRoleAllowed(roleCode)) return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const sourceId = String(body?.source_additional_job_id || '').trim();
    const zoneId = String(body?.zone_id || '').trim();
    const modeRaw = String(body?.mode || 'OVERWRITE').trim().toUpperCase();
    const mode: ApplyMode = modeRaw === 'FILL_MISSING' ? 'FILL_MISSING' : 'OVERWRITE';

    if (!sourceId) return NextResponse.json({ error: 'source_additional_job_id is required' }, { status: 400 });
    if (!zoneId) return NextResponse.json({ error: 'zone_id is required' }, { status: 400 });

    // Load source job (template)
    const { data: sourceJob, error: jobErr } = await supabase
      .from('additional_jobs_master')
      .select('id, name, description, category, hsn_sac_code, unit, tax_rate, oem_price, oes_price, labour_price, is_active, deleted_at')
      .eq('id', sourceId)
      .maybeSingle();
    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
    if (!sourceJob || (sourceJob as any).deleted_at) return NextResponse.json({ error: 'Source job not found' }, { status: 404 });

    // Load source matrix rates
    const { data: sourceRates, error: ratesErr } = await supabase
      .from('additional_jobs_master_labour_rates')
      .select('fuel_type, car_class, labour_price')
      .eq('additional_job_id', sourceId);
    if (ratesErr) return NextResponse.json({ error: ratesErr.message }, { status: 500 });

    const normalizedSourceRates = (sourceRates || [])
      .map((r: any) => ({
        fuel_type: normalizeFuelType(r?.fuel_type),
        car_class: String(r?.car_class || '').trim(),
        labour_price: Number(r?.labour_price ?? 0),
      }))
      .filter((r: any) => r.car_class);

    for (const r of normalizedSourceRates) {
      if (!Number.isFinite(r.labour_price) || r.labour_price < 0) {
        return NextResponse.json({ error: `Invalid source labour_price for ${r.fuel_type}/${r.car_class}` }, { status: 400 });
      }
    }

    // Fetch all workshops in zone
    // NOTE: some deployments may not have workshops.deleted_at. Do not filter on it here.
    const { data: workshops, error: wErr } = await supabase
      .from('workshops')
      .select('id, name, zone_id')
      .eq('zone_id', zoneId)
      .limit(5000);
    if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });

    const targetWorkshops = (workshops || []).filter((w: any) => w?.id);
    if (!targetWorkshops.length) {
      return NextResponse.json({ success: true, workshops_total: 0, note: 'No workshops found for zone' }, { status: 200 });
    }

    const name = String((sourceJob as any).name || '').trim();
    const now = new Date().toISOString();

    let createdJobCopies = 0;
    let workshopsProcessed = 0;
    let rateUpserts = 0;
    let rateInserts = 0;

    // Process sequentially to keep logic simple and predictable
    for (const w of targetWorkshops) {
      const workshopId = String((w as any).id || '').trim();
      if (!workshopId) continue;

      // Ensure a workshop copy exists (match by exact name case-insensitive within this workshop)
      // NOTE: Use limit(1) instead of maybeSingle() to avoid hard-failing if duplicates exist.
      const { data: existingJobs, error: exErr } = await supabase
        .from('additional_jobs_master')
        .select('id')
        .eq('workshop_id', workshopId)
        .is('deleted_at', null)
        .ilike('name', name)
        .order('created_at', { ascending: false })
        .limit(1);
      if (exErr) {
        console.error('apply-zone existing job lookup failed', { workshopId, name, error: exErr });
        return NextResponse.json({ error: exErr.message }, { status: 500 });
      }

      let targetJobId = (existingJobs as any)?.[0]?.id as string | undefined;

      if (!targetJobId) {
        const payload: any = {
          workshop_id: workshopId,
          name,
          description: (sourceJob as any).description ?? null,
          category: (sourceJob as any).category ?? null,
          hsn_sac_code: (sourceJob as any).hsn_sac_code ?? null,
          unit: (sourceJob as any).unit ?? 'job',
          // Copy prices too (so CSV-updated details propagate when creating workshop copies)
          oem_price: Number((sourceJob as any).oem_price ?? 0),
          oes_price: Number((sourceJob as any).oes_price ?? 0),
          labour_price: Number((sourceJob as any).labour_price ?? 0),
          tax_rate: Number((sourceJob as any).tax_rate ?? 18),
          is_active: (sourceJob as any).is_active === false ? false : true,
          created_by: profile.id,
          created_at: now,
          updated_at: now,
        };

        const { data: inserted, error: insErr } = await supabase
          .from('additional_jobs_master')
          .insert([payload])
          .select('id')
          .single();
        if (insErr) {
          console.error('apply-zone insert workshop copy failed', { workshopId, sourceId, name, error: insErr });
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
        targetJobId = (inserted as any)?.id;
        if (targetJobId) createdJobCopies += 1;
      }

      if (!targetJobId) continue;

      if (!normalizedSourceRates.length) {
        workshopsProcessed += 1;
        continue;
      }

      if (mode === 'OVERWRITE') {
        const upserts = normalizedSourceRates.map((r) => ({
          additional_job_id: targetJobId,
          fuel_type: r.fuel_type,
          car_class: r.car_class,
          labour_price: r.labour_price,
          created_by: profile.id,
          updated_at: now,
        }));

        const { error: upErr } = await supabase
          .from('additional_jobs_master_labour_rates')
          .upsert(upserts as any, { onConflict: 'additional_job_id,fuel_type,car_class' });
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
        rateUpserts += upserts.length;
      } else {
        const { data: existingRates, error: erErr } = await supabase
          .from('additional_jobs_master_labour_rates')
          .select('fuel_type, car_class')
          .eq('additional_job_id', targetJobId);
        if (erErr) return NextResponse.json({ error: erErr.message }, { status: 500 });

        const existingKeys = new Set(
          (existingRates || []).map(
            (r: any) => `${normalizeFuelType(r?.fuel_type)}::${String(r?.car_class || '').trim().toLowerCase()}`
          )
        );

        const inserts = normalizedSourceRates
          .filter((r) => !existingKeys.has(`${r.fuel_type}::${r.car_class.toLowerCase()}`))
          .map((r) => ({
            additional_job_id: targetJobId,
            fuel_type: r.fuel_type,
            car_class: r.car_class,
            labour_price: r.labour_price,
            created_by: profile.id,
            updated_at: now,
          }));

        if (inserts.length) {
          const { error: insErr } = await supabase.from('additional_jobs_master_labour_rates').insert(inserts as any);
          if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
          rateInserts += inserts.length;
        }
      }

      workshopsProcessed += 1;
    }

    return NextResponse.json(
      {
        success: true,
        source_additional_job_id: sourceId,
        zone_id: zoneId,
        mode,
        workshops_total: targetWorkshops.length,
        workshops_processed: workshopsProcessed,
        created_job_copies: createdJobCopies,
        rate_upserts: rateUpserts,
        rate_inserts: rateInserts,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message || String(e) }, { status: 500 });
  }
}


