import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeExtraWorkPartLines,
  splitExtraWorkPartTotals,
  supabaseWriteDropUnknownColumns,
} from '@/lib/workshop/extraWorkParts';

export const dynamic = 'force-dynamic';

async function getSupervisorProfile(supabase: Awaited<ReturnType<typeof createClientFromRequest>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { profile: null as any, error: 'Unauthorized' as const };

  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, full_name, workshop_id, role_id, roles!inner(role_code)';

  const { data: byEmail } = email
    ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null };
  const { data: byPhone } = !byEmail && phone
    ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null };
  const { data: byId } = !byEmail && !byPhone
    ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
    : { data: null };

  const profile = byEmail || byPhone || byId;
  const roleCode = String((profile?.roles as any)?.role_code || '').toUpperCase();
  const allowed = [
    'WORKSHOP_SUPERVISOR',
    'WORKSHOP_ADVISOR',
    'WORKSHOP_ADVISER',
    'WORKSHOP_ADMIN',
    'SUPER_ADMIN',
    'WORKSHOP_MECHANIC',
  ];
  if (!profile) return { profile: null as any, error: 'User profile not found' as const };
  if (!allowed.includes(roleCode)) return { profile: null as any, error: 'Forbidden' as const };
  return { profile, error: null as const, roleCode };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClientFromRequest(request);
    const { profile, error, roleCode } = await getSupervisorProfile(supabase);
    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (error === 'Forbidden') return NextResponse.json({ error }, { status: 403 });
    if (!profile) return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const extraId = String(id || '').trim();
    if (!extraId) return NextResponse.json({ error: 'Missing extra work id' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const lines = normalizeExtraWorkPartLines(body?.parts_breakdown ?? body?.parts ?? body?.items);
    const isMechanic = String(roleCode || '').toUpperCase() === 'WORKSHOP_MECHANIC';
    const pricedLines = isMechanic
      ? lines.map((row) => ({ ...row, unit_price: 0, amount: 0 }))
      : lines;
    const totals = splitExtraWorkPartTotals(pricedLines);
    const part_price_type =
      String(body?.part_price_type || 'OEM').toUpperCase() === 'OES' ? 'OES' : 'OEM';
    const nextDescription = String(body?.description || '').trim();

    const { data: row, error: loadErr } = await supabase
      .from('lead_extra_charges')
      .select('id, lead_id, description, status')
      .eq('id', extraId)
      .maybeSingle();
    if (loadErr || !row) {
      return NextResponse.json({ error: loadErr?.message || 'Extra work not found' }, { status: 404 });
    }

    if (isMechanic) {
      const { data: lead } = await supabase
        .from('service_leads')
        .select('id, assigned_mechanic_id')
        .eq('id', row.lead_id)
        .maybeSingle();
      if (String((lead as any)?.assigned_mechanic_id || '') !== String(profile.id)) {
        return NextResponse.json({ error: 'Forbidden: Job not assigned to you' }, { status: 403 });
      }
    } else if (profile.workshop_id) {
      const { data: lead } = await supabase
        .from('service_leads')
        .select('id, workshop_id')
        .eq('id', row.lead_id)
        .maybeSingle();
      if (lead && String((lead as any).workshop_id) !== String(profile.workshop_id)) {
        return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
      }
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      parts_breakdown: pricedLines,
      part_price_type,
    };
    if (nextDescription && !isMechanic) updatePayload.description = nextDescription;
    if (!isMechanic) {
      updatePayload.amount = totals.total;
      updatePayload.updated_at = now;
      if (part_price_type === 'OES') {
        updatePayload.oes_price = totals.parts;
        updatePayload.oem_price = 0;
      } else {
        updatePayload.oem_price = totals.parts;
        updatePayload.oes_price = 0;
      }
      updatePayload.labour_price = totals.labour;
    }

    const { data: updated, error: updErr } = await supabaseWriteDropUnknownColumns(
      supabase,
      'lead_extra_charges',
      'update',
      updatePayload,
      {
        eq: { column: 'id', value: extraId },
        select:
          'id, description, amount, oem_price, oes_price, labour_price, part_price_type, parts_breakdown, status',
      },
    );

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // Best-effort: sync OS EXTRA line included_items for transparent bill.
    try {
      const { data: osInv } = await supabase
        .from('invoices')
        .select('id, line_items')
        .eq('lead_id', row.lead_id)
        .eq('invoice_type', 'ORDER_SUMMARY')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (osInv?.id) {
        const li = Array.isArray((osInv as any).line_items) ? [...(osInv as any).line_items] : [];
        const targetName = String(row.description || '').trim().toLowerCase();
        const billName = String((updated as any)?.description || row.description || '').trim();
        const next = li.map((item: any) => {
          const cat = String(item?.category || '').toUpperCase();
          if (cat !== 'EXTRA') return item;
          const desc = String(item?.description || '').trim().toLowerCase();
          const sameId = String(item?.extra_charge_id || '') === extraId;
          if (!sameId && targetName && desc !== targetName) return item;
          return {
            ...item,
            extra_charge_id: extraId,
            description: billName || item.description,
            amount: isMechanic ? item.amount : totals.total,
            rate: isMechanic ? item.rate : totals.total,
            qty: 1,
            included_items: pricedLines.map((p) => ({
              name: p.name,
              quantity: p.qty,
              unit_price: p.unit_price,
              amount: p.amount,
              kind: p.kind,
            })),
          };
        });
        await supabase
          .from('invoices')
          .update({
            line_items: next,
            extra_charges: next
              .filter((x: any) => String(x?.category || '').toUpperCase() === 'EXTRA')
              .reduce((s: number, x: any) => s + (Number(x?.amount) || 0), 0),
            updated_at: now,
          })
          .eq('id', osInv.id);
      }
    } catch {
      // ignore OS sync failures
    }

    return NextResponse.json({ success: true, extra_work: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
