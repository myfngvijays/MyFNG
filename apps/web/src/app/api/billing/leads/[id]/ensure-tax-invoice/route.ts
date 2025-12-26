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
      .select('id, workshop_id, invoice_series_year, invoice_series_month, invoice_series_seq')
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

    const ciPaid = String((ci as any).payment_status || '').toUpperCase() === 'PAID' || String((ci as any).status || '').toUpperCase() === 'PAID';
    if (!ciPaid) {
      return NextResponse.json({ error: 'Customer Invoice is not PAID yet' }, { status: 400 });
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
    const invoiceAmount = parseFloat(String((ci as any).final_amount || '0')) || 0;

    const tiPayload: any = {
      invoice_number: tiNumber,
      lead_id: leadId,
      workshop_id: (ci as any).workshop_id,
      base_amount: (ci as any).base_amount || 0,
      parts_cost: (ci as any).parts_cost || 0,
      extra_charges: (ci as any).extra_charges || 0,
      labour_cost: (ci as any).labour_cost || 0,
      sub_total: (ci as any).sub_total || (ci as any).subtotal || 0,
      discount_amount: (ci as any).discount_amount || 0,
      cgst_percentage: (ci as any).cgst_percentage || 0,
      cgst_amount: (ci as any).cgst_amount || 0,
      sgst_percentage: (ci as any).sgst_percentage || 0,
      sgst_amount: (ci as any).sgst_amount || 0,
      igst_percentage: (ci as any).igst_percentage || 0,
      igst_amount: (ci as any).igst_amount || 0,
      total_tax: (ci as any).total_tax || 0,
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

    return NextResponse.json({ success: true, tax_invoice: createdTI }, { status: 200 });
  } catch (e: any) {
    console.error('ensure-tax-invoice error:', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


