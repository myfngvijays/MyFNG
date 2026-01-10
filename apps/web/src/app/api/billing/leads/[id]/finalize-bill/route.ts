import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { calculateTaxes, generateSeriesDocumentNumber, getPlaceOfSupply, numberToWords, roundOff } from '@/lib/utils/invoiceUtils';
import { getEffectivePricingItemAmount, getEffectiveQty } from '@/lib/utils/pricing';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/leads/[id]/finalize-bill
 *
 * Billing/System finalizes billable items + applies rule-based GST.
 * Output is used for Customer Invoice (no GST visible) and Tax Invoice generation post-payment.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // users_login is mapped by email/phone; not always auth user.id
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, role_id, workshop_id, roles!inner(role_code)';

    const { data: userProfileByEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };
    const { data: userProfileByPhone } = !userProfileByEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };

    const userProfile = userProfileByEmail || userProfileByPhone;
    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'BILLING'];
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden: Billing access required', role: roleCode }, { status: 403 });
    }

    const leadId = params.id;

    // Best-effort payload: allow billing adjustments / checklist notes later.
    let payload: any = {};
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }

    // Fetch lead
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.read_only) {
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
    }

    // Workshop scoping for workshop staff
    if (['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'].includes(roleCode)) {
      if (!userProfile.workshop_id || userProfile.workshop_id !== lead.workshop_id) {
        return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
      }
    }

    // Ensure lead has series suffix
    let seriesYear = (lead as any).invoice_series_year as number | null;
    let seriesMonth = (lead as any).invoice_series_month as number | null;
    let seriesSeq = (lead as any).invoice_series_seq as number | null;

    if (!seriesYear || !seriesMonth || !seriesSeq) {
      const d = new Date();
      seriesYear = d.getFullYear();
      seriesMonth = d.getMonth() + 1;

      const { data: seqData, error: seqError } = await supabase.rpc('next_invoice_series_seq', {
        p_year: seriesYear,
        p_month: seriesMonth,
      });

      if (seqError) {
        return NextResponse.json(
          { error: 'Failed to allocate invoice series sequence', details: seqError.message },
          { status: 500 }
        );
      }

      seriesSeq = typeof seqData === 'number' ? seqData : parseInt(String(seqData || '0'), 10);

      await supabase
        .from('service_leads')
        .update({
          invoice_series_year: seriesYear,
          invoice_series_month: seriesMonth,
          invoice_series_seq: seriesSeq,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);
    }

    // Fetch workshop (for GST state)
    const { data: workshop } = await supabase
      .from('workshops')
      .select('id, state, state_code, gst_number')
      .eq('id', lead.workshop_id)
      .maybeSingle();

    const customerState = (lead as any).customer_state || lead.state || '';
    const customerStateCode = (lead as any).customer_state_code || (lead as any).state_code || '';
    const workshopState = workshop?.state || '';
    const workshopStateCode = workshop?.state_code || '';
    const place = getPlaceOfSupply(customerState, customerStateCode, workshopState, workshopStateCode);

    const parseIdList = (raw: any): string[] => {
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
    };

    // Build billable items snapshot
    const [{ data: pricingItems }, { data: extraChargesRaw }, { data: jobCard }] = await Promise.all([
      // NOTE: schema uses item_name + qty; keep fallback handling in mapping below.
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
    ]);

    // Extra work approvals: schema varies across installs (status values + customer_approved flag).
    // We filter in JS to avoid schema-specific query operators.
    const isApprovedExtra = (row: any) => {
      const s = String(row?.status || '').trim().toUpperCase();
      const customerApproved = row?.customer_approved === true;
      return (
        customerApproved ||
        s === 'APPROVED' ||
        s === 'CUSTOMER_APPROVED' ||
        s === 'APPROVED_BY_CUSTOMER' ||
        s === 'ACCEPTED'
      );
    };

    // Optional: load additional job master prices (workshop-specific first, then global) as a fallback
    const normalizeName = (s: string) =>
      String(s || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const masterByName = new Map<string, { oem: number; oes: number; labour: number }>();
    try {
      const { data: masterJobs } = await supabase
        .from('additional_jobs_master')
        .select('name, oem_price, oes_price, labour_price, workshop_id, is_active, deleted_at')
        .or(`workshop_id.eq.${lead.workshop_id},workshop_id.is.null`)
        .eq('is_active', true);

      for (const it of masterJobs || []) {
        if ((it as any)?.deleted_at) continue;
        const key = normalizeName(String((it as any).name || ''));
        if (!key) continue;
        const oem = Number((it as any).oem_price);
        const oes = Number((it as any).oes_price);
        const labour = Number((it as any).labour_price);
        const row = { oem: Number.isFinite(oem) ? oem : 0, oes: Number.isFinite(oes) ? oes : 0, labour: Number.isFinite(labour) ? labour : 0 };
        // Prefer workshop-specific entry over global
        if ((it as any).workshop_id === lead.workshop_id) {
          masterByName.set(key, row);
        } else if (!masterByName.has(key)) {
          masterByName.set(key, row);
        }
      }
    } catch {
      // ignore if table/columns missing
    }

    const computeExtraAmount = (row: any) => {
      const legacy = Number(row?.amount ?? 0) || 0;
      if (legacy > 0) return legacy;
      const partType = String(row?.part_price_type || 'OEM').toUpperCase();
      const part = partType === 'OES' ? Number(row?.oes_price ?? 0) || 0 : Number(row?.oem_price ?? 0) || 0;
      const labour = Number(row?.labour_price ?? 0) || 0;
      const computed = part + labour;
      if (computed > 0) return computed;
      // Fallback: if breakdown not saved yet, use additional_jobs_master by description
      const descKey = normalizeName(String(row?.description || row?.reason || ''));
      const master = masterByName.get(descKey);
      if (master) {
        const masterPart = partType === 'OES' ? master.oes : master.oem;
        return (Number(masterPart) || 0) + (Number(master.labour) || 0);
      }
      return 0;
    };

    const extraCharges = (Array.isArray(extraChargesRaw) ? extraChargesRaw : []).filter(isApprovedExtra);

    const serviceLines = (pricingItems || []).map((it: any) => {
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

    // Fallback: if lead_pricing_items is empty, derive pricing from service_types/service_addons + workshop pricing tables.
    let fallbackServiceLines: any[] = [];
    try {
      if ((serviceLines?.length || 0) === 0 && lead?.workshop_id) {
        const serviceTypeIds = parseIdList((lead as any).service_type_ids);
        const addonIds = parseIdList((lead as any).subservice_ids);

        if (serviceTypeIds.length > 0) {
          // service_types base price (if column exists) + workshop override
          let serviceTypes: any[] = [];
          const { data: serviceTypesData, error: stErr } = await supabase
            .from('service_types')
            .select('id, name, base_price')
            .in('id', serviceTypeIds);
          if (!stErr && serviceTypesData) {
            serviceTypes = serviceTypesData as any[];
          } else {
            const { data: stAlt } = await supabase
              .from('service_types')
              .select('id, name')
              .in('id', serviceTypeIds);
            serviceTypes = (stAlt || []) as any[];
          }

          const { data: wsp } = await supabase
            .from('workshop_service_pricing')
            .select('service_type_id, custom_price')
            .eq('workshop_id', lead.workshop_id)
            .in('service_type_id', serviceTypeIds)
            .eq('is_active', true);

          const priceByServiceType: Record<string, number> = {};
          for (const row of wsp || []) {
            const id = String((row as any).service_type_id || '');
            const p = parseFloat(String((row as any).custom_price || '0')) || 0;
            if (id) priceByServiceType[id] = p;
          }

          for (const st of serviceTypes) {
            const id = String(st?.id || '');
            const base = parseFloat(String((st as any).base_price || '0')) || 0;
            const custom = priceByServiceType[id] || 0;
            const amount = custom > 0 ? custom : base;
            fallbackServiceLines.push({
              description: st?.name || 'Service',
              qty: 1,
              rate: amount,
              amount,
              category: 'SERVICE',
            });
          }
        }

        if (addonIds.length > 0) {
          const { data: addons } = await supabase
            .from('service_addons')
            .select('id, name, price')
            .in('id', addonIds);

          const { data: wap } = await supabase
            .from('workshop_service_addons_pricing')
            .select('service_addon_id, custom_price')
            .eq('workshop_id', lead.workshop_id)
            .in('service_addon_id', addonIds)
            .eq('is_active', true);

          const priceByAddon: Record<string, number> = {};
          for (const row of wap || []) {
            const id = String((row as any).service_addon_id || '');
            const p = parseFloat(String((row as any).custom_price || '0')) || 0;
            if (id) priceByAddon[id] = p;
          }

          for (const a of addons || []) {
            const id = String((a as any).id || '');
            const base = parseFloat(String((a as any).price || '0')) || 0;
            const custom = priceByAddon[id] || 0;
            const amount = custom > 0 ? custom : base;
            fallbackServiceLines.push({
              description: (a as any).name || 'Addon',
              qty: 1,
              rate: amount,
              amount,
              category: 'ADDON',
            });
          }
        }
      }
    } catch {
      // ignore fallback errors; keep 0 if no sources available
    }

    const effectiveServiceLines = (serviceLines?.length || 0) > 0 ? serviceLines : fallbackServiceLines;

    const partLines = (jobCard?.job_card_parts || []).map((p: any) => ({
      description: `${p.part_name || 'Part'}${p.part_number ? ` (${p.part_number})` : ''}`,
      qty: p.quantity || 1,
      rate: p.unit_price || 0,
      amount: p.total_price || 0,
      category: 'PART',
    }));

    const extraLines = (extraCharges || []).map((c: any) => ({
      description: c.description || c.reason || 'Additional Request',
      qty: 1,
      rate: computeExtraAmount(c),
      amount: computeExtraAmount(c),
      category: 'EXTRA',
    }));

    const baseAmount = effectiveServiceLines.reduce((sum: number, l: any) => sum + (l.amount || 0), 0);
    const partsCost = partLines.reduce((sum: number, l: any) => sum + (l.amount || 0), 0);
    const extraChargesAmount = extraLines.reduce((sum: number, l: any) => sum + (l.amount || 0), 0);
    const subTotal = Math.max(0, baseAmount + partsCost + extraChargesAmount);

    const discountAmount =
      payload?.discount_amount !== undefined && payload?.discount_amount !== null
        ? Number(payload.discount_amount) || 0
        : parseFloat((lead as any).discount_amount || '0') || 0;

    const netTaxable = Math.max(0, subTotal - discountAmount);
    const taxes = calculateTaxes(netTaxable, place.useIGST);
    const preRoundTotal = netTaxable + taxes.totalTax;
    const roundedTotal = roundOff(preRoundTotal);
    const roundOffAmount = parseFloat((roundedTotal - preRoundTotal).toFixed(2));

    const finalAmount = roundedTotal;
    const amountInWords = numberToWords(finalAmount);

    const ciNumber = generateSeriesDocumentNumber('CI', seriesYear!, seriesMonth!, seriesSeq!);
    const now = new Date().toISOString();

    // Upsert CUSTOMER_INVOICE record (internal finalized; not public until customer confirms)
    const { data: existingCI } = await supabase
      .from('invoices')
      .select('id, payment_status')
      .eq('lead_id', leadId)
      .eq('invoice_type', 'CUSTOMER_INVOICE')
      .maybeSingle();

    if (existingCI?.payment_status === 'PAID') {
      return NextResponse.json(
        { error: 'Customer invoice already paid; cannot re-finalize', invoice_id: existingCI.id },
        { status: 400 }
      );
    }

    const invoicePayload: any = {
      invoice_number: ciNumber,
      lead_id: leadId,
      workshop_id: lead.workshop_id,
      base_amount: baseAmount,
      parts_cost: partsCost,
      extra_charges: extraChargesAmount,
      labour_cost: 0,
      sub_total: subTotal,
      discount_amount: discountAmount,
      cgst_percentage: place.useIGST ? 0 : 9,
      cgst_amount: taxes.cgstAmount,
      sgst_percentage: place.useIGST ? 0 : 9,
      sgst_amount: taxes.sgstAmount,
      igst_percentage: place.useIGST ? 18 : 0,
      igst_amount: taxes.igstAmount,
      total_tax: taxes.totalTax,
      round_off_amount: roundOffAmount,
      final_amount: finalAmount,
      amount_in_words: amountInWords,
      place_of_supply: place.placeOfSupply,
      place_of_supply_state_code: place.stateCode,
      status: 'APPROVED', // billing finalized
      payment_status: 'PENDING',
      generated_by: userProfile.id,
      invoice_type: 'CUSTOMER_INVOICE',
      series_year: seriesYear,
      series_month: seriesMonth,
      series_seq: seriesSeq,
      visible_to_customer: false, // becomes true after customer confirms
      show_gst_breakup: false, // never show GST on customer invoice
      line_items: [...effectiveServiceLines, ...partLines, ...extraLines],
    };

    let ciInvoice: any = null;
    if (existingCI?.id) {
      const { data: updated, error: updErr } = await supabase
        .from('invoices')
        .update({ ...invoicePayload, updated_at: now })
        .eq('id', existingCI.id)
        .select('*')
        .single();

      if (updErr) {
        return NextResponse.json({ error: 'Failed to update customer invoice', details: updErr.message }, { status: 500 });
      }
      ciInvoice = updated;
    } else {
      const { data: created, error: insErr } = await supabase
        .from('invoices')
        .insert({ ...invoicePayload, created_at: now, updated_at: now })
        .select('*')
        .single();

      if (insErr) {
        const msg = String(insErr.message || '');
        const isDuplicate =
          insErr.code === '23505' ||
          /duplicate key/i.test(msg) ||
          /invoices_lead_id_unique/i.test(msg);

        if (isDuplicate) {
          // Legacy schema: UNIQUE(lead_id) on invoices prevents OS+CI+TI multi-document flow.
          return NextResponse.json(
            {
              error: 'Failed to create customer invoice',
              details:
                'Legacy schema blocks multiple invoices per lead. Run migration: database/102_drop_any_invoices_lead_unique.sql (or database/101_drop_invoices_lead_unique.sql if applicable).',
              code: insErr.code,
              hint: insErr.hint,
              action: {
                migration_file: 'database/102_drop_any_invoices_lead_unique.sql',
                reason: 'Remove UNIQUE(lead_id) from invoices so OS/CI/TI can coexist for a single lead.',
              },
            },
            { status: 409 }
          );
        }

        return NextResponse.json(
          { error: 'Failed to create customer invoice', details: insErr.message, code: insErr.code, hint: insErr.hint },
          { status: 500 }
        );
      }
      ciInvoice = created;
    }

    // Keep lead in PAYMENT_AWAITING (awaiting payment/confirmation) and lock edits.
    const leadUpdatePayload = {
      status: lead.status === 'PAYMENT_AWAITING' ? lead.status : 'PAYMENT_AWAITING',
      billing_locked_at: (lead as any).billing_locked_at || now,
      invoice_id: ciInvoice.id, // payable doc is CI
      invoice_number: ciInvoice.invoice_number,
      invoice_generated_at: now,
      invoice_generated_by: userProfile.id,
      updated_at: now,
    };

    const tryUpdateLead = async (client: any) =>
      client
        .from('service_leads')
        .update(leadUpdatePayload)
        .eq('id', leadId)
        .select('id, status, invoice_id')
        .maybeSingle();

    let leadUpdate = await tryUpdateLead(supabase);
    if (leadUpdate.error) {
      const msg = String(leadUpdate.error?.message || leadUpdate.error);
      const code = (leadUpdate.error as any)?.code;
      const isRls =
        code === '42501' ||
        /row-level security|violates row level security|permission denied/i.test(msg);

      // Retry with service role if available (still gated by our role checks above)
      if (isRls && supabaseAdmin) {
        leadUpdate = await tryUpdateLead(supabaseAdmin);
      }
    }

    if (leadUpdate.error) {
      return NextResponse.json(
        {
          error: 'Failed to update lead status after bill finalization',
          details: (leadUpdate.error as any)?.message || String(leadUpdate.error),
          code: (leadUpdate.error as any)?.code,
          hint: supabaseAdmin
            ? null
            : 'Server is missing SUPABASE_SERVICE_ROLE_KEY; if RLS blocks this update, configure it or adjust policies.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Bill finalized successfully',
      lead_id: leadId,
      invoice: ciInvoice,
      snapshot: {
        place_of_supply: place,
        totals: {
          base_amount: baseAmount,
          parts_cost: partsCost,
          extra_charges: extraChargesAmount,
          sub_total: subTotal,
          discount_amount: discountAmount,
          taxes,
          round_off_amount: roundOffAmount,
          final_amount: finalAmount,
        },
      },
    });
  } catch (error: any) {
    console.error('Finalize bill error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}


