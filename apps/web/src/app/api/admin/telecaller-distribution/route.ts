import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { fetchMessageTriggers, saveMessageTriggers } from '@/lib/enquiry/assignment';
import { normalizeMessageTriggers } from '@/lib/enquiry/messageTriggers';
import { normalizeAllowedPincodes, normalizePincodeMode, pincodePayloadFromMode } from '@/lib/enquiry/pincodeAllocation';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const, userId: user.id };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    // Only active allocation rows. Removed rows are soft-deactivated on Save and must
    // not reappear in the admin UI (re-add via "+ Add Row" reactivates the same telecaller).
    const { data: allocations, error: allocErr } = await supabaseAdmin
      .from('enquiry_hub')
      .select(
        'id, telecaller_id, allocation_percent, allocation_status, daily_limit, is_active, meta, telecaller:users_login!telecaller_id(id, full_name, email, phone, is_active)'
      )
      .eq('kind', 'ALLOCATION')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (allocErr) throw allocErr;

    const { data: telecallers, error: tcErr } = await supabaseAdmin
      .from('users_login')
      .select('id, full_name, email, phone, is_active, roles!role_id(role_code)')
      .order('full_name', { ascending: true });

    if (tcErr) throw tcErr;

    const onlyTelecallers = (telecallers || []).filter(
      (t: any) => String((t?.roles as any)?.role_code || '').toUpperCase() === 'TELECALLER'
    );

    let messageTriggers: Awaited<ReturnType<typeof fetchMessageTriggers>> = [];
    try {
      messageTriggers = await fetchMessageTriggers();
    } catch {
      messageTriggers = [];
    }

    return NextResponse.json({
      allocations: allocations || [],
      telecallers: onlyTelecallers,
      message_triggers: messageTriggers,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const rows = Array.isArray(body?.allocations) ? body.allocations : [];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'allocations array is required' }, { status: 400 });
    }

    const cleaned = rows
      .map((r: any) => {
        // null/omitted = all channels; [] = none; [...] = only those
        const hasAllowlist = Array.isArray(r.allowed_channels);
        const channels = hasAllowlist
          ? r.allowed_channels.map((c: any) => String(c || '').trim().toUpperCase()).filter(Boolean)
          : null;
        const hasPinlist = Array.isArray(r.allowed_pincodes);
        const pincodes = hasPinlist ? normalizeAllowedPincodes(r.allowed_pincodes) : null;
        const pincodeMode = normalizePincodeMode(r.pincode_mode, pincodes);
        const pincodePayload = pincodePayloadFromMode(
          pincodeMode,
          pincodeMode === 'mapped' ? pincodes || [] : pincodes,
        );
        return {
          telecaller_id: String(r.telecaller_id || '').trim(),
          allocation_percent: Number(r.allocation_percent ?? 0),
          allocation_status: String(r.allocation_status || 'ACTIVE').toUpperCase(),
          daily_limit: r.daily_limit === null || r.daily_limit === '' ? null : Number(r.daily_limit),
          meta: {
            ...(r.meta && typeof r.meta === 'object' ? r.meta : {}),
            allowed_channels: hasAllowlist ? channels : null,
            allowed_pincodes: pincodePayload.allowed_pincodes,
            pincode_mode: pincodePayload.pincode_mode,
          },
        };
      })
      .filter((r: any) => r.telecaller_id);

    const activeSum = cleaned
      .filter((r: any) => r.allocation_status === 'ACTIVE')
      .reduce((sum: number, r: any) => sum + Number(r.allocation_percent || 0), 0);

    if (Math.abs(activeSum - 100) > 0.001) {
      return NextResponse.json({ error: '% total must be 100 for ACTIVE telecallers', total: activeSum }, { status: 400 });
    }

    // Upsert by primary key to avoid requiring a unique constraint on telecaller_id.
    const { data: existingAllocations, error: existingErr } = await supabaseAdmin
      .from('enquiry_hub')
      .select('id, telecaller_id')
      .eq('kind', 'ALLOCATION');

    if (existingErr) throw existingErr;

    const idByTelecaller = new Map(
      (existingAllocations || []).map((row: any) => [String(row.telecaller_id), String(row.id)])
    );

    const nowIso = new Date().toISOString();
    const toUpdate = cleaned.filter((r: any) => idByTelecaller.has(r.telecaller_id));
    const toInsert = cleaned.filter((r: any) => !idByTelecaller.has(r.telecaller_id));

    if (toUpdate.length > 0) {
      const updatePayload = toUpdate.map((r: any) => ({
        id: idByTelecaller.get(r.telecaller_id),
        kind: 'ALLOCATION',
        telecaller_id: r.telecaller_id,
        allocation_percent: r.allocation_percent,
        allocation_status: r.allocation_status,
        daily_limit: r.daily_limit,
        meta: r.meta,
        is_active: true,
        updated_at: nowIso,
      }));

      const { error: upErr } = await supabaseAdmin
        .from('enquiry_hub')
        .upsert(updatePayload, { onConflict: 'id' });

      if (upErr) throw upErr;
    }

    if (toInsert.length > 0) {
      const insertPayload = toInsert.map((r: any) => ({
        kind: 'ALLOCATION',
        telecaller_id: r.telecaller_id,
        allocation_percent: r.allocation_percent,
        allocation_status: r.allocation_status,
        daily_limit: r.daily_limit,
        meta: r.meta,
        is_active: true,
        updated_at: nowIso,
      }));

      const { error: insertErr } = await supabaseAdmin
        .from('enquiry_hub')
        .insert(insertPayload);

      if (insertErr) throw insertErr;
    }

    // Soft-deactivate allocations removed from the Save payload.
    const keptIds = cleaned.map((r: any) => r.telecaller_id).filter(Boolean);
    const removedIds = (existingAllocations || [])
      .map((row: any) => String(row.telecaller_id))
      .filter((id: string) => id && !keptIds.includes(id));

    if (removedIds.length > 0) {
      const { error: deactivateErr } = await supabaseAdmin
        .from('enquiry_hub')
        .update({
          is_active: false,
          allocation_status: 'INACTIVE',
          updated_at: new Date().toISOString(),
        })
        .eq('kind', 'ALLOCATION')
        .in('telecaller_id', removedIds);

      if (deactivateErr) throw deactivateErr;
    }

    if (Array.isArray(body?.message_triggers)) {
      const triggers = normalizeMessageTriggers(body.message_triggers);
      const emptyPhrase = triggers.find((t) => !t.phrase.trim());
      if (emptyPhrase) {
        return NextResponse.json({ error: 'Each message trigger needs a phrase' }, { status: 400 });
      }
      const emptyTc = triggers.find((t) => !t.telecaller_id);
      if (emptyTc) {
        return NextResponse.json(
          { error: 'Each message trigger needs a telecaller' },
          { status: 400 },
        );
      }
      await saveMessageTriggers(triggers);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

