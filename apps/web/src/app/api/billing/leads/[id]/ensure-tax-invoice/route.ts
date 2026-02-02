import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { generateSeriesDocumentNumber } from '@/lib/utils/invoiceUtils';
import { resolveWorkshopServicePrice } from '@/lib/utils/workshopServicePricing';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceRoleKey) return { supabaseAdmin: null as any, error: 'SUPABASE_SERVICE_ROLE_KEY not set' };
  const supabaseAdmin = createSupabaseAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { supabaseAdmin, error: null as any };
}

function parseSeriesFromNumber(num: any) {
  const s = String(num || '').trim().toUpperCase();
  const m = s.match(/^(OS|CI|TI)-(\d{4})-(\d{2})-(\d{1,})$/);
  if (!m) return null;
  return { year: parseInt(m[2], 10), month: parseInt(m[3], 10), seq: parseInt(m[4], 10) };
}

function normalizeDiscountMode(mode: any): 'AMOUNT' | 'PERCENT' | null {
  const m = String(mode ?? '').trim().toUpperCase();
  if (!m) return null;
  if (m === 'AMOUNT' || m === 'FLAT' || m === 'FIXED' || m === 'VALUE') return 'AMOUNT';
  if (m === 'PERCENT' || m === 'PERCENTAGE' || m === 'PCT') return 'PERCENT';
  return null;
}

function parseDiscountFromDescription(desc: any): { mode: 'AMOUNT' | 'PERCENT' | null; value: number | null } {
  const s = String(desc ?? '').trim();
  if (!s) return { mode: null, value: null };
  const percentMatch = s.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    const v = Number(percentMatch[1]);
    return { mode: 'PERCENT', value: Number.isFinite(v) ? v : null };
  }
  const numMatch = s.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    const v = Number(numMatch[1]);
    return { mode: 'AMOUNT', value: Number.isFinite(v) ? v : null };
  }
  return { mode: null, value: null };
}

function parseIdList(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).map((s) => s.trim()).filter(Boolean);
    } catch {
      // ignore
    }
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { supabaseAdmin, error: adminError } = getAdminClient();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Robust profile lookup (email/phone/id) + role_code
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, full_name, roles!inner(role_code)';

    const { data: byEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };
    const { data: byPhone } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };
    const { data: byId } = !byEmail && !byPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null };

    const profile: any = byEmail || byPhone || byId;
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

    const roleCode = (profile.roles as any)?.role_code;
    const allowed = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'];
    if (!allowed.includes(roleCode)) return NextResponse.json({ error: 'Forbidden', role: roleCode }, { status: 403 });

    const { id: leadId } = await params;

    // Fetch lead (for workshop scoping + series fallback)
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('service_leads')
      .select('id, workshop_id, invoice_series_year, invoice_series_month, invoice_series_seq, customer_gstin, customer_legal_name, customer_billing_address, customer_billing_state_code, city_id, city, model_id, vehicle_model, service_type_ids')
      .eq('id', leadId)
      .maybeSingle();
    if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    if (['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'].includes(roleCode)) {
      if (!profile.workshop_id || profile.workshop_id !== (lead as any).workshop_id) {
        return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
      }
    }

    // Fetch recent CIs (some flows may create multiple CI rows; pick the PAID one)
    const { data: ciList, error: ciErr } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('lead_id', leadId)
      .eq('invoice_type', 'CUSTOMER_INVOICE')
      .order('created_at', { ascending: false })
      .limit(5);

    if (ciErr) return NextResponse.json({ error: 'Failed to load Customer Invoice', details: ciErr.message }, { status: 500 });
    const candidates = Array.isArray(ciList) ? ciList : [];
    if (candidates.length === 0) {
      return NextResponse.json({ error: 'Customer Invoice not found' }, { status: 404 });
    }

    const toNum = (v: any) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
      return Number.isFinite(n) ? n : 0;
    };

    const isPaidStatus = (inv: any) =>
      String(inv?.payment_status || '').toUpperCase() === 'PAID' || String(inv?.status || '').toUpperCase() === 'PAID';

    const resolveServicePriceMaps = async (ci: any) => {
      const li = Array.isArray((ci as any).line_items) ? ((ci as any).line_items as any[]) : [];
      const idsFromLines = Array.from(
        new Set(
          li
            .map((x: any) => String(x?.service_type_id || '').trim())
            .filter(Boolean)
        )
      );
      const leadIds = parseIdList((lead as any)?.service_type_ids);
      const ids = Array.from(new Set([...(idsFromLines || []), ...(leadIds || [])]));
      const priceById = new Map<string, number>();
      const priceByName = new Map<string, number>();
      if (ids.length === 0) return { priceById, priceByName };

      const workshopId = String((lead as any)?.workshop_id || '').trim();
      let vehicleClass: string | null = null;
      let workshopZoneId: string | null = null;
      try {
        const modelId = String((lead as any)?.model_id || '').trim();
        if (modelId) {
          const { data: cm } = await supabaseAdmin
            .from('car_models')
            .select('class')
            .eq('id', modelId)
            .maybeSingle();
          vehicleClass = (cm as any)?.class || null;
        } else if ((lead as any)?.vehicle_model) {
          const { data: cm } = await supabaseAdmin
            .from('car_models')
            .select('class')
            .eq('model_name', (lead as any).vehicle_model)
            .maybeSingle();
          vehicleClass = (cm as any)?.class || null;
        }
      } catch {
        vehicleClass = null;
      }
      try {
        if (workshopId) {
          const { data: w } = await supabaseAdmin
            .from('workshops')
            .select('zone_id')
            .eq('id', workshopId)
            .maybeSingle();
          workshopZoneId = (w as any)?.zone_id || null;
        }
      } catch {
        workshopZoneId = null;
      }

      const nameById = new Map<string, string>();
      if (ids.length > 0) {
        try {
          const { data: st } = await supabaseAdmin
            .from('service_types')
            .select('id, name')
            .in('id', ids);
          for (const row of st || []) {
            const id = String((row as any)?.id || '').trim();
            const name = String((row as any)?.name || '').trim();
            if (id && name) nameById.set(id, name);
          }
        } catch {
          // ignore
        }
      }

      for (const id of ids) {
        try {
          const price = await resolveWorkshopServicePrice({
            supabase: supabaseAdmin,
            workshopId,
            serviceTypeId: id,
            cityId: String((lead as any)?.city_id || '').trim() || null,
            cityName: String((lead as any)?.city || '').trim() || null,
            workshopZoneId,
            vehicleClass,
          });
          if (Number.isFinite(price) && price > 0) {
            const p = Number(price);
            priceById.set(id, p);
            const name = nameById.get(id);
            if (name) priceByName.set(name.toLowerCase(), p);
          }
        } catch {
          // ignore
        }
      }

      return { priceById, priceByName };
    };

    const computePaidSnapshot = async (ci: any) => {
      const paidStored = toNum((ci as any).paid_amount);
      const balanceDueStored = toNum((ci as any).balance_due);
      const paymentTxnId = String((ci as any).payment_txn_id || '').trim();
      const hasPaymentRef = Boolean(paymentTxnId);

      // Prefer final_amount/total_amount; fallback to (sub_total/subtotal - discount) for older rows.
      let payable = toNum((ci as any).final_amount) || toNum((ci as any).total_amount);

      const li = Array.isArray((ci as any).line_items) ? ((ci as any).line_items as any[]) : [];
      const { priceById, priceByName } = await resolveServicePriceMaps(ci);
      const lineItemsTotal = li.reduce((s: number, x: any) => {
        const qty = toNum(x?.qty ?? 1) || 1;
        const baseAmt = toNum(x?.amount);
        const baseRate = toNum(x?.rate);
        const baseLineTotal = baseAmt > 0 ? baseAmt : baseRate * qty;
        const cat = String(x?.category || '').toUpperCase();
        if (cat === 'SERVICE') {
          const sid = String(x?.service_type_id || '').trim();
          const svcPrice = sid ? priceById.get(sid) : null;
          if (svcPrice && svcPrice > 0) {
            return s + svcPrice * qty;
          }
          const nameKey = String(x?.description || '').trim().toLowerCase();
          const byName = nameKey ? priceByName.get(nameKey) : null;
          if (byName && byName > 0) {
            return s + byName * qty;
          }
        }
        return s + baseLineTotal;
      }, 0);

      const storedSubTotal = toNum((ci as any).sub_total) || toNum((ci as any).subtotal);
      const subTotalPreDiscount =
        lineItemsTotal > 0 && Math.abs(lineItemsTotal - storedSubTotal) > 0.5
          ? lineItemsTotal
          : (storedSubTotal || lineItemsTotal);
      const couponMeta: any = (ci as any).coupon_meta || null;
      const couponMetaDiscount = couponMeta && typeof couponMeta === 'object' ? toNum(couponMeta.discount_amount) : 0;
      // Some installs store coupon discount in alternate fields; treat all as "discount_amount".
      const altDiscount =
        toNum((ci as any).coupon_discount_amount) ||
        toNum((ci as any).coupon_discount) ||
        toNum((ci as any).total_discount) ||
        toNum((ci as any).discount) ||
        toNum((ci as any).discount_value);

      let discount = Math.max(toNum((ci as any).discount_amount), couponMetaDiscount, altDiscount);
      const couponCode = String((ci as any).coupon_code || '').trim();

      if (couponCode && discount <= 0 && subTotalPreDiscount > 0) {
        try {
          const { data: coupon } = await supabaseAdmin
            .from('coupons')
            .select('*')
            .ilike('code', couponCode.toUpperCase())
            .eq('is_active', true)
            .maybeSingle();
          if (coupon && String((coupon as any).coupon_kind || '').toUpperCase() === 'TOTAL_DISCOUNT') {
            const derived = parseDiscountFromDescription((coupon as any).description);
            const mode =
              normalizeDiscountMode((coupon as any).discount_mode) ||
              normalizeDiscountMode((coupon as any).mode) ||
              normalizeDiscountMode((coupon as any).discount_type) ||
              derived.mode;
            const valueRaw =
              (coupon as any).discount_value ??
              (coupon as any).value ??
              (coupon as any).amount ??
              (coupon as any).discount ??
              (coupon as any).amount_off ??
              (coupon as any).percent_off ??
              derived.value;
            const value = Number(valueRaw);
            const minOrder = Number((coupon as any).min_order_value || 0) || 0;
            if (!(minOrder > 0 && subTotalPreDiscount < minOrder) && mode && Number.isFinite(value) && value > 0) {
              discount = mode === 'AMOUNT' ? Math.min(value, subTotalPreDiscount) : (subTotalPreDiscount * value) / 100;
            }
          }
        } catch {
          // ignore
        }
      }

      const payableLooksPreDiscount =
        payable > 0 && subTotalPreDiscount > 0 && Math.abs(payable - subTotalPreDiscount) < 0.5;
      const derivedPayable = subTotalPreDiscount > 0 ? Math.max(0, subTotalPreDiscount - (discount || 0)) : 0;
      if (payableLooksPreDiscount && derivedPayable > 0 && derivedPayable < payable) {
        payable = derivedPayable;
      }
      if (payable <= 0 && derivedPayable > 0) {
        payable = derivedPayable;
      }

      let paidByTxns = 0;
      try {
        const { data: txns } = await supabaseAdmin
          .from('payment_transactions')
          .select('amount, status')
          .eq('invoice_id', (ci as any).id)
          .order('created_at', { ascending: false })
          .limit(200);
        paidByTxns = (txns || []).reduce((s: number, t: any) => {
          const st = String(t?.status || '').toUpperCase();
          if (st !== 'SUCCESS' && st !== 'COD_PENDING') return s;
          return s + toNum(t?.amount);
        }, 0);
      } catch {
        paidByTxns = 0;
      }

      const paidEffective = Math.max(paidStored, paidByTxns);

      // If discount wasn't persisted but payment reflects discounted total,
      // infer discount from payable vs paidEffective (only for reasonable discount ranges).
      if (couponCode && payable > 0 && paidEffective > 0 && discount <= 0) {
        const inferred = payable - paidEffective;
        const ratio = inferred / payable;
        // Guardrails: discount must be > ₹1 and between 1% and 60% to avoid misclassifying partial payments.
        if (inferred > 1 && ratio >= 0.01 && ratio <= 0.6) {
          discount = inferred;
          payable = Math.max(0, payable - discount);
        }
      }

      // Treat as paid if:
      // - status says PAID, OR
      // - balance_due is 0 (many flows update balance_due before flipping payment_status), OR
      // - paid_amount / transactions cover payable, OR
      // - payable is missing/0 but payment exists (safer than blocking TI generation indefinitely).
      const ciPaid =
        isPaidStatus(ci) ||
        (balanceDueStored <= 0.01 && (paidStored > 0 || hasPaymentRef || paidByTxns > 0)) ||
        (payable > 0 && paidEffective + 0.01 >= payable) ||
        (payable <= 0 && paidEffective > 0 && (hasPaymentRef || paidByTxns > 0));

      return {
        payable,
        paidStored,
        paidByTxns,
        paidEffective,
        ciPaid,
        subTotalPreDiscount,
        discount,
        balanceDueStored,
        paymentTxnId,
      };
    };

    // Prefer an explicitly PAID CI, else the most recent CI that has payment txns.
    let ci: any = candidates.find((x: any) => isPaidStatus(x)) || candidates[0];
    if (!isPaidStatus(ci)) {
      for (const cand of candidates) {
        const snap = await computePaidSnapshot(cand);
        if (snap.paidEffective > 0) {
          ci = cand;
          break;
        }
      }
    }

    const ciSnap = await computePaidSnapshot(ci);
    if (!ciSnap.ciPaid) {
      return NextResponse.json(
        {
          error: 'Customer Invoice is not PAID yet',
          details: `payable=${ciSnap.payable.toFixed(2)} paid=${ciSnap.paidEffective.toFixed(2)} discount=${Number(ciSnap.discount || 0).toFixed(2)} balance_due=${Number(ciSnap.balanceDueStored || 0).toFixed(2)}`,
          payable: ciSnap.payable,
          paid_amount: ciSnap.paidStored,
          paid_by_transactions: ciSnap.paidByTxns,
          balance_due: ciSnap.balanceDueStored,
          payment_txn_id: ciSnap.paymentTxnId || null,
          checked_customer_invoices: candidates.map((x: any) => ({
            id: x.id,
            invoice_number: x.invoice_number,
            payment_status: x.payment_status,
            status: x.status,
            paid_amount: x.paid_amount,
            balance_due: (x as any).balance_due,
            payment_txn_id: (x as any).payment_txn_id,
            final_amount: x.final_amount,
            total_amount: x.total_amount,
            created_at: x.created_at,
          })),
        },
        { status: 400 }
      );
    }

    // Keep names used below
    let payable = ciSnap.payable;
    const subTotalPreDiscount = ciSnap.subTotalPreDiscount;
    const discount = ciSnap.discount;

    // If TI already exists, return it
    const { data: existingTI } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('lead_id', leadId)
      .eq('invoice_type', 'TAX_INVOICE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingTI?.id) {
      return NextResponse.json({ success: true, tax_invoice: existingTI }, { status: 200 });
    }

    // Resolve shared series
    let year = (ci as any).series_year || (lead as any).invoice_series_year || null;
    let month = (ci as any).series_month || (lead as any).invoice_series_month || null;
    let seq = (ci as any).series_seq || (lead as any).invoice_series_seq || null;
    if (!year || !month || !seq) {
      const parsed = parseSeriesFromNumber((ci as any).invoice_number);
      if (parsed) {
        year = year || parsed.year;
        month = month || parsed.month;
        seq = seq || parsed.seq;
      }
    }
    if (!year || !month || !seq) {
      return NextResponse.json({ error: 'Missing shared invoice series (year/month/seq) for lead' }, { status: 500 });
    }

    const now = new Date().toISOString();
    const tiNumber = generateSeriesDocumentNumber('TI', year, month, seq);
    // Use derived payable (post-discount) if CI stored amount is pre-discount
    const invoiceAmount = payable || parseFloat(String((ci as any).final_amount || '0')) || 0;

    let useIGST = false;
    try {
      const workshopId = String((ci as any).workshop_id || '').trim();
      const customerStateCode = String((ci as any).place_of_supply_state_code || '').trim();
      if (workshopId && customerStateCode) {
        const { data: ws } = await supabaseAdmin
          .from('workshops')
          .select('state_code')
          .eq('id', workshopId)
          .maybeSingle();
        const workshopStateCode = String((ws as any)?.state_code || '').trim();
        if (workshopStateCode && workshopStateCode !== customerStateCode) {
          useIGST = true;
        }
      }
    } catch {
      // fallback below
    }
    if (!useIGST) {
      const ciIgst = Number((ci as any).igst_percentage || 0) || 0;
      useIGST = ciIgst > 0;
    }

    const totalTaxRaw = invoiceAmount > 0 ? (invoiceAmount * 18) / 118 : 0;
    const totalTax = parseFloat(totalTaxRaw.toFixed(2));
    const taxableValue = parseFloat((invoiceAmount - totalTax).toFixed(2));
    const cgstAmount = useIGST ? 0 : parseFloat((totalTax / 2).toFixed(2));
    const sgstAmount = useIGST ? 0 : parseFloat((totalTax / 2).toFixed(2));
    const igstAmount = useIGST ? totalTax : 0;

    const tiPayload: any = {
      invoice_number: tiNumber,
      lead_id: leadId,
      workshop_id: (ci as any).workshop_id,
      customer_gstin: (lead as any)?.customer_gstin || null,
      customer_legal_name: (lead as any)?.customer_legal_name || null,
      customer_billing_address: (lead as any)?.customer_billing_address || null,
      customer_billing_state_code: (lead as any)?.customer_billing_state_code || null,
      base_amount: (ci as any).base_amount || 0,
      parts_cost: (ci as any).parts_cost || 0,
      extra_charges: (ci as any).extra_charges || 0,
      labour_cost: (ci as any).labour_cost || 0,
      sub_total: subTotalPreDiscount || (ci as any).sub_total || (ci as any).subtotal || 0,
      discount_amount: discount || (ci as any).discount_amount || 0,
      discount_percentage: (ci as any).discount_percentage || 0,
      coupon_code: (ci as any).coupon_code || null,
      coupon_meta: (ci as any).coupon_meta || null,
      cgst_percentage: useIGST ? 0 : 9,
      cgst_amount: cgstAmount,
      sgst_percentage: useIGST ? 0 : 9,
      sgst_amount: sgstAmount,
      igst_percentage: useIGST ? 18 : 0,
      igst_amount: igstAmount,
      total_tax: totalTax,
      round_off_amount: (ci as any).round_off_amount || 0,
      final_amount: invoiceAmount,
      amount_in_words: (ci as any).amount_in_words || null,
      place_of_supply: (ci as any).place_of_supply || null,
      place_of_supply_state_code: (ci as any).place_of_supply_state_code || null,
      status: 'PAID',
      payment_status: 'PAID',
      paid_amount: invoiceAmount,
      payment_mode: (ci as any).payment_mode || null,
      payment_txn_id: (ci as any).payment_txn_id || null,
      paid_at: (ci as any).paid_at || now,
      generated_by: profile.id,
      invoice_type: 'TAX_INVOICE',
      series_year: year,
      series_month: month,
      series_seq: seq,
      visible_to_customer: true,
      show_gst_breakup: true,
      line_items: (ci as any).line_items || [],
      created_at: now,
      updated_at: now,
    };

    const { data: createdTI, error: tiErr } = await supabaseAdmin
      .from('invoices')
      .insert(tiPayload)
      .select('*')
      .single();

    if (tiErr || !createdTI) {
      console.error('[ensure-tax-invoice] TI insert failed:', {
        message: tiErr?.message,
        code: tiErr?.code,
        hint: tiErr?.hint,
        tiNumber,
        series: { year, month, seq },
      });
      return NextResponse.json(
        {
          error: 'Failed to create Tax Invoice',
          details: tiErr?.message,
          code: tiErr?.code,
          hint: tiErr?.hint,
          ti_number: tiNumber,
          series: { year, month, seq },
        },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from('service_leads')
      .update({ invoice_id: createdTI.id, invoice_number: createdTI.invoice_number, updated_at: now })
      .eq('id', leadId);

    // Best-effort: link coupon redemption rows to this Tax Invoice
    try {
      const couponId = (createdTI as any)?.coupon_meta?.coupon_id || (ci as any)?.coupon_meta?.coupon_id || null;
      let q = supabaseAdmin
        .from('coupon_redemptions')
        .update({ invoice_id: createdTI.id })
        .eq('service_lead_id', leadId)
        .is('invoice_id', null);
      if (couponId) q = q.eq('coupon_id', couponId);
      await q;
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, tax_invoice: createdTI }, { status: 200 });
  } catch (e: any) {
    console.error('ensure-tax-invoice error:', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


