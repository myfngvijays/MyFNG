import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { generateSeriesDocumentNumber } from '@/lib/utils/invoiceUtils';
import { getEffectivePricingItemAmount, getEffectiveQty } from '@/lib/utils/pricing';
import { resolveWorkshopServicePrice } from '@/lib/utils/workshopServicePricing';

export const dynamic = 'force-dynamic';

function parseIdList(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === 'string') {
    const txt = raw.trim();
    if (!txt) return [];
    try {
      const parsed = JSON.parse(txt);
      if (Array.isArray(parsed)) return parsed.map(String).map((s) => s.trim()).filter(Boolean);
    } catch {
      // ignore
    }
    return txt.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function isApprovedExtra(row: any) {
  const s = String(row?.status || '').trim().toUpperCase();
  const customerApproved = row?.customer_approved === true;
  return (
    customerApproved ||
    s === 'APPROVED' ||
    s === 'CUSTOMER_APPROVED' ||
    s === 'APPROVED_BY_CUSTOMER' ||
    s === 'ACCEPTED'
  );
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();

  // Optional service-role client for write operations when RLS blocks (best-effort).
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

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // AuthZ: billing-capable roles
  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, workshop_id, roles!inner(role_code)';
  const { data: byEmail } = email ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle() : { data: null };
  const { data: byPhone } = !byEmail && phone ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle() : { data: null };
  const { data: byId } = !byEmail && !byPhone ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle() : { data: null };
  const userProfile: any = byEmail || byPhone || byId;
  if (!userProfile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

  const roleCode = String(userProfile?.roles?.role_code || '');
  const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'];
  if (!allowedRoles.includes(roleCode)) return NextResponse.json({ error: 'Forbidden', role: roleCode }, { status: 403 });

  const { id: leadId } = await params;
  const { data: lead, error: leadError } = await supabase.from('service_leads').select('*').eq('id', leadId).single();
  if (leadError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  if ((lead as any).read_only) {
    return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
  }

  // Workshop scoping for workshop staff
  if (roleCode.startsWith('WORKSHOP_')) {
    const myWid = String(userProfile?.workshop_id || '');
    const leadWid = String((lead as any)?.workshop_id || '');
    if (myWid && leadWid && myWid !== leadWid) {
      return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
    }
  }

  // Guard: if TI exists, do not allow OS regeneration (CI/TI must remain consistent after TI)
  const { data: ti } = await supabase
    .from('invoices')
    .select('id')
    .eq('lead_id', leadId)
    .eq('invoice_type', 'TAX_INVOICE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ti?.id) {
    return NextResponse.json(
      { error: 'Tax Invoice already generated; OS regeneration is locked', hint: 'Once TI is generated, OS cannot be regenerated' },
      { status: 400 }
    );
  }

  // Load latest OS (create if missing)
  const { data: osExisting } = await supabase
    .from('invoices')
    .select('*')
    .eq('lead_id', leadId)
    .eq('invoice_type', 'ORDER_SUMMARY')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Preserve any included_items overrides per service_type_id (so “Edit rates” doesn’t get lost)
  const includedOverridesByServiceType = new Map<string, any[]>();
  try {
    const li = Array.isArray((osExisting as any)?.line_items) ? (osExisting as any).line_items : [];
    for (const row of li) {
      const cat = String(row?.category || '').toUpperCase();
      if (cat !== 'SERVICE') continue;
      const sid = String(row?.service_type_id || '').trim();
      const inc = Array.isArray(row?.included_items) ? row.included_items : [];
      if (sid && inc.length) includedOverridesByServiceType.set(sid, inc);
    }
  } catch {
    // ignore
  }

  // Latest billable sources
  const [{ data: pricingItems }, { data: extraChargesRaw }, { data: jobCard }, { data: workshop }] = await Promise.all([
    supabase
      .from('lead_pricing_items')
      .select('id, item_name, item_description, base_price, final_price, qty, is_addon, status')
      .eq('lead_id', leadId)
      .eq('status', 'ACTIVE'),
    supabase
      .from('lead_extra_charges')
      .select('*')
      .eq('lead_id', leadId),
    supabase
      .from('job_cards')
      .select('id, jobcard_number, job_card_parts(part_name, part_number, quantity, unit_price, total_price)')
      .eq('lead_id', leadId)
      .maybeSingle(),
    (lead as any)?.workshop_id
      ? supabase.from('workshops').select('id, zone_id').eq('id', (lead as any).workshop_id).maybeSingle()
      : Promise.resolve({ data: null as any }),
  ]);

  const extraCharges = (Array.isArray(extraChargesRaw) ? extraChargesRaw : []).filter(isApprovedExtra);

  // Service lines
  const serviceLinesFromPricingItems = (pricingItems || []).map((it: any) => {
    const qty = getEffectiveQty(it, 1);
    const amount = getEffectivePricingItemAmount(it);
    return {
      description: it.name || it.item_name || 'Service',
      qty,
      rate: qty ? amount / qty : amount,
      amount,
      category: it.item_type || (it.is_addon ? 'ADDON' : 'SERVICE'),
    };
  });

  // Fallback (when lead_pricing_items empty): use workshop pricing tables for service_type_ids/subservice_ids
  let workshopServiceLines: any[] = [];
  let fallbackAddonsOnly: any[] = [];
  try {
    const serviceTypeIds = parseIdList((lead as any)?.service_type_ids);
    const addonIds = parseIdList((lead as any)?.subservice_ids);
    const leadCityId = String((lead as any)?.city_id || '').trim() || null;
    const leadCityName = String((lead as any)?.city || '').trim() || null;
    const workshopZoneId = String((workshop as any)?.zone_id || '').trim() || null;

    let vehicleClass: string | null = null;
    try {
      const modelId = String((lead as any)?.model_id || '').trim();
      if (modelId) {
        const { data: cm } = await supabase.from('car_models').select('class').eq('id', modelId).maybeSingle();
        vehicleClass = (cm as any)?.class || null;
      }
    } catch {
      // ignore
    }

    if (serviceTypeIds.length > 0 && (lead as any)?.workshop_id) {
      // schema-tolerant service_types (base_price optional)
      let serviceTypes: any[] = [];
      const { data: st1, error: stErr } = await supabase.from('service_types').select('id, name, base_price').in('id', serviceTypeIds);
      if (!stErr && st1) serviceTypes = st1 as any[];
      else {
        const { data: st2 } = await supabase.from('service_types').select('id, name').in('id', serviceTypeIds);
        serviceTypes = (st2 || []) as any[];
      }

      for (const st of serviceTypes) {
        const sid = String((st as any)?.id || '').trim();
        if (!sid) continue;
        let price = 0;
        try {
          price = await resolveWorkshopServicePrice({
            supabase,
            workshopId: String((lead as any).workshop_id),
            serviceTypeId: sid,
            cityId: leadCityId,
            cityName: leadCityName,
            workshopZoneId,
            vehicleClass,
          });
        } catch {
          price = 0;
        }
        const base = parseFloat(String((st as any)?.base_price || '0')) || 0;
        const amount = price > 0 ? price : base;
        const inc = includedOverridesByServiceType.get(sid);
        workshopServiceLines.push({
          description: (st as any)?.name || 'Service',
          qty: 1,
          rate: amount,
          amount,
          category: 'SERVICE',
          service_type_id: sid,
          ...(inc && inc.length ? { included_items: inc } : null),
        });
      }
    }

    if (addonIds.length > 0 && (lead as any)?.workshop_id) {
      // Prefer workshop addon pricing, fallback to service_addons.price
      const { data: wap } = await supabase
        .from('workshop_service_addons_pricing')
        .select('service_addon_id, custom_price, addon:service_addons(id, name, price)')
        .eq('workshop_id', (lead as any).workshop_id)
        .in('service_addon_id', addonIds)
        .eq('is_active', true);
      if (wap && wap.length > 0) {
        for (const row of wap) {
          const amt = parseFloat(String((row as any).custom_price || '0')) || 0;
          fallbackAddonsOnly.push({
            description: (row as any)?.addon?.name || 'Addon',
            qty: 1,
            rate: amt,
            amount: amt,
            category: 'ADDON',
          });
        }
      } else {
        const { data: addons } = await supabase.from('service_addons').select('id, name, price').in('id', addonIds).eq('is_active', true);
        for (const a of addons || []) {
          const amt = parseFloat(String((a as any).price || '0')) || 0;
          fallbackAddonsOnly.push({
            description: (a as any).name || 'Addon',
            qty: 1,
            rate: amt,
            amount: amt,
            category: 'ADDON',
          });
        }
      }
    }
  } catch {
    workshopServiceLines = [];
    fallbackAddonsOnly = [];
  }

  const serviceLines =
    (workshopServiceLines.length > 0 ? workshopServiceLines : serviceLinesFromPricingItems).concat(
      workshopServiceLines.length > 0 ? fallbackAddonsOnly : []
    );

  // Parts + extras
  const partLines = (jobCard as any)?.job_card_parts?.map((p: any) => ({
    description: `${p.part_name || 'Part'}${p.part_number ? ` (${p.part_number})` : ''}`,
    qty: p.quantity || 1,
    rate: Number(p.unit_price || 0) || 0,
    amount: Number(p.total_price || 0) || 0,
    category: 'PART',
  })) || [];

  const extraLines = (extraCharges || []).map((c: any) => {
    const amt = Number(c?.amount || 0) || 0;
    return {
      description: c.description || c.reason || 'Additional Request',
      qty: 1,
      rate: amt,
      amount: amt,
      category: 'EXTRA',
    };
  });

  const lineItems = [...serviceLines, ...partLines, ...extraLines];
  const sumCat = (cats: string[]) =>
    lineItems
      .filter((x: any) => cats.includes(String(x?.category || '').toUpperCase()))
      .reduce((s: number, x: any) => s + (Number(x?.amount || 0) || 0), 0);
  const base_amount = sumCat(['SERVICE', 'ADDON', 'ADD_ON', 'ADD-ON', 'LABOUR', 'LABOR']);
  const parts_cost = sumCat(['PART', 'PARTS']);
  const extra_charges = sumCat(['EXTRA']);
  const sub_total = Math.max(0, base_amount + parts_cost + extra_charges);
  const discount_amount = parseFloat(String((lead as any)?.discount_amount || '0')) || 0;
  const final_amount = Math.max(0, sub_total - discount_amount);

  const now = new Date().toISOString();

  const updateInvoice = async (client: any, id: string, payload: any) =>
    client.from('invoices').update(payload).eq('id', id).select('*').maybeSingle();
  const insertInvoice = async (client: any, payload: any) =>
    client.from('invoices').insert(payload).select('*').single();

  const payload: any = {
    invoice_type: 'ORDER_SUMMARY',
    lead_id: leadId,
    workshop_id: (lead as any)?.workshop_id || null,
    base_amount,
    parts_cost,
    extra_charges,
    sub_total,
    discount_amount,
    final_amount,
    total_amount: final_amount,
    line_items: lineItems,
    show_gst_breakup: false,
    updated_at: now,
  };

  // Ensure OS invoice_number exists if we have to create
  if (!osExisting?.id) {
    const seriesYear = (lead as any)?.invoice_series_year as number | null;
    const seriesMonth = (lead as any)?.invoice_series_month as number | null;
    const seriesSeq = (lead as any)?.invoice_series_seq as number | null;
    if (seriesYear && seriesMonth && seriesSeq) {
      payload.invoice_number = generateSeriesDocumentNumber('OS', seriesYear, seriesMonth, seriesSeq);
      payload.series_year = seriesYear;
      payload.series_month = seriesMonth;
      payload.series_seq = seriesSeq;
    } else {
      payload.invoice_number = `OS-${String(leadId).slice(0, 8)}`;
    }
    payload.created_at = now;
    payload.status = 'GENERATED';
    payload.payment_status = 'PENDING';
  }

  let saved: any = null;
  if (osExisting?.id) {
    let upd = await updateInvoice(supabase, osExisting.id, payload);
    if (upd.error && supabaseAdmin) upd = await updateInvoice(supabaseAdmin, osExisting.id, payload);
    if (upd.error) {
      return NextResponse.json({ error: 'Failed to update OS invoice', details: upd.error.message, code: upd.error.code }, { status: 500 });
    }
    saved = upd.data;
  } else {
    let ins = await insertInvoice(supabase, payload);
    if (ins.error && supabaseAdmin) ins = await insertInvoice(supabaseAdmin, payload);
    if (ins.error) {
      return NextResponse.json({ error: 'Failed to create OS invoice', details: ins.error.message, code: ins.error.code }, { status: 500 });
    }
    saved = ins.data;
  }

  return NextResponse.json({ success: true, invoice: saved }, { status: 200 });
}

