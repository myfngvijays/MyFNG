import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const ALLOWED_ROLES = [
  'SUPER_ADMIN',
  'SUB_ADMIN',
  'WORKSHOP_ADMIN',
  'WORKSHOP_SUPERVISOR',
  'WORKSHOP_ADVISOR',
];

const sumByCategories = (rows: any[], cats: string[]) =>
  rows
    .filter((x: any) => cats.includes(String(x?.category || '').toUpperCase()))
    .reduce((s: number, x: any) => s + (Number(x?.amount || 0) || 0), 0);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: invoiceId } = await params;
    if (!invoiceId || !isUuid(String(invoiceId))) {
      return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const rawLineItems = Array.isArray(body?.line_items) ? body.line_items : null;

    if (!rawLineItems || rawLineItems.length === 0) {
      return NextResponse.json({ error: 'line_items is required' }, { status: 400 });
    }

    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, workshop_id, roles!inner(role_code)')
      .eq('id', user.id)
      .maybeSingle();

    const roleCode = String((userProfile as any)?.roles?.role_code || '');
    if (!ALLOWED_ROLES.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isRlsError = (e: any) => {
      const msg = String(e?.message || e || '');
      const code = String(e?.code || '');
      return code === '42501' || /row-level security|violates row level security|permission denied/i.test(msg);
    };

    const fetchInvoice = async (client: any) =>
      client
        .from('invoices')
        .select('id, lead_id, workshop_id, invoice_type, discount_amount, line_items')
        .eq('id', invoiceId)
        .maybeSingle();

    let invRes = await fetchInvoice(supabase);
    if (invRes.error && isRlsError(invRes.error) && supabaseAdmin) {
      invRes = await fetchInvoice(supabaseAdmin);
    }
    const invoice = invRes.data;
    if (invRes.error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const invoiceType = String((invoice as any)?.invoice_type || '').toUpperCase();
    if (invoiceType !== 'ORDER_SUMMARY') {
      return NextResponse.json({ error: 'Only Order Summary can be edited' }, { status: 400 });
    }

    if (roleCode.startsWith('WORKSHOP_')) {
      const myWid = String((userProfile as any)?.workshop_id || '');
      const invWid = String((invoice as any)?.workshop_id || '');
      if (myWid && invWid && myWid !== invWid) {
        return NextResponse.json({ error: 'Forbidden: invoice not in your workshop' }, { status: 403 });
      }
    }

    const leadId = String((invoice as any)?.lead_id || '').trim();
    if (leadId) {
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
          { error: 'Tax Invoice already generated; OS edits are locked' },
          { status: 400 }
        );
      }
    }

    const normalizedLineItems = rawLineItems.map((row: any) => {
      const qtyRaw = Number(row?.qty ?? row?.quantity ?? 1);
      const qty = Number.isFinite(qtyRaw) && qtyRaw >= 0 ? qtyRaw : 0;
      const rateFallback =
        Number.isFinite(Number(row?.amount)) && qty ? Number(row.amount) / qty : 0;
      const rateRaw = Number(row?.rate ?? row?.unit_price ?? rateFallback);
      const rate = Number.isFinite(rateRaw) && rateRaw >= 0 ? rateRaw : 0;
      const amount = qty * rate;
      return {
        ...row,
        qty,
        rate,
        amount,
        os_edited: true,
      };
    });

    const base_amount = sumByCategories(normalizedLineItems, [
      'SERVICE',
      'ADDON',
      'ADD_ON',
      'ADD-ON',
      'LABOUR',
      'LABOR',
    ]);
    const parts_cost = sumByCategories(normalizedLineItems, ['PART', 'PARTS']);
    const extra_charges = sumByCategories(normalizedLineItems, ['EXTRA']);
    const sub_total = Math.max(0, base_amount + parts_cost + extra_charges);
    const discount_amount = Number((invoice as any)?.discount_amount || 0) || 0;
    const final_amount = Math.max(0, sub_total - discount_amount);

    const tryUpdate = async (payload: any) => {
      const res = await supabase.from('invoices').update(payload).eq('id', invoiceId).select('id').maybeSingle();
      if (res.error && isRlsError(res.error) && supabaseAdmin) {
        return supabaseAdmin.from('invoices').update(payload).eq('id', invoiceId).select('id').maybeSingle();
      }
      return res;
    };

    const isMissingCol = (e: any) => {
      const msg = String(e?.message || e || '');
      const code = String(e?.code || '');
      return (
        code === '42703' ||
        code === 'PGRST204' ||
        /column .* does not exist/i.test(msg) ||
        /could not find the '.*' column of '.*' in the schema cache/i.test(msg)
      );
    };

    let upd = await tryUpdate({
      line_items: normalizedLineItems,
      base_amount,
      parts_cost,
      extra_charges,
      sub_total,
      total_amount: final_amount,
      final_amount,
      updated_at: new Date().toISOString(),
    });

    if (upd.error && isMissingCol(upd.error)) {
      upd = await tryUpdate({
        line_items: normalizedLineItems,
        base_amount,
        parts_cost,
        extra_charges,
        sub_total,
        total_amount: final_amount,
        final_amount,
      });
    }

    if (upd.error && isMissingCol(upd.error)) {
      upd = await tryUpdate({ line_items: normalizedLineItems });
    }

    if (upd.error) {
      return NextResponse.json(
        { error: 'Failed to update invoice', details: upd.error.message, code: upd.error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    console.error('[update-line-items] error:', e);
    return NextResponse.json(
      { error: 'Internal server error', details: e?.message || String(e), code: e?.code },
      { status: 500 }
    );
  }
}
