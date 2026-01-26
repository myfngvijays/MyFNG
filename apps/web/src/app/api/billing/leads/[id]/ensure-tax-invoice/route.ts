import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { generateSeriesDocumentNumber } from '@/lib/utils/invoiceUtils';

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const leadId = params.id;

    // Fetch lead (for workshop scoping + series fallback)
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('service_leads')
      .select('id, workshop_id, invoice_series_year, invoice_series_month, invoice_series_seq, customer_gstin, customer_legal_name, customer_billing_address, customer_billing_state_code')
      .eq('id', leadId)
      .maybeSingle();
    if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    if (['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'].includes(roleCode)) {
      if (!profile.workshop_id || profile.workshop_id !== (lead as any).workshop_id) {
        return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
      }
    }

    // Fetch latest CI
    const { data: ci } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('lead_id', leadId)
      .eq('invoice_type', 'CUSTOMER_INVOICE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ci?.id) {
      return NextResponse.json({ error: 'Customer Invoice not found' }, { status: 404 });
    }

    const toNum = (v: any) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
      return Number.isFinite(n) ? n : 0;
    };

    // Accept "paid" if either status says PAID OR paid_amount >= final_amount (tolerant of stale payment_status).
    let payable = toNum((ci as any).final_amount) || toNum((ci as any).total_amount);
    const paidStored = toNum((ci as any).paid_amount);

    // If payable looks like pre-discount subtotal (and coupon/discount exists), derive net payable.
    const subTotalPreDiscount = toNum((ci as any).sub_total) || toNum((ci as any).subtotal);
    let discount = toNum((ci as any).discount_amount);
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

    const payableLooksPreDiscount = payable > 0 && subTotalPreDiscount > 0 && Math.abs(payable - subTotalPreDiscount) < 0.5;
    const derivedPayable = subTotalPreDiscount > 0 ? Math.max(0, subTotalPreDiscount - (discount || 0)) : 0;
    if (payableLooksPreDiscount && derivedPayable > 0 && derivedPayable < payable) {
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
    const ciPaid =
      String((ci as any).payment_status || '').toUpperCase() === 'PAID' ||
      String((ci as any).status || '').toUpperCase() === 'PAID' ||
      (payable > 0 && paidEffective + 0.01 >= payable);

    if (!ciPaid) {
      return NextResponse.json(
        {
          error: 'Customer Invoice is not PAID yet',
          payable,
          paid_amount: paidStored,
          paid_by_transactions: paidByTxns,
        },
        { status: 400 }
      );
    }

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


