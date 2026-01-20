import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

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

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    if (row.length === 1 && row[0].trim() === '') {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      pushField();
    } else if (c === '\n') {
      pushField();
      pushRow();
    } else if (c === '\r') {
      // ignore
    } else {
      field += c;
    }
  }
  pushField();
  if (row.length) pushRow();
  return rows;
}

function toNumber(value: string, fallback = 0) {
  const v = Number(String(value || '').trim());
  return Number.isFinite(v) ? v : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const csvText = String(body?.csv || '');
    if (!csvText.trim()) return NextResponse.json({ error: 'CSV is required' }, { status: 400 });

    const rows = parseCsv(csvText);
    if (rows.length < 2) return NextResponse.json({ error: 'CSV has no data rows' }, { status: 400 });

    const header = rows[0].map((h) => h.trim());
    const required = [
      'invoice_number',
      'invoice_date',
      'due_date',
      'customer_name',
      'customer_phone',
      'customer_email',
      'customer_address',
      'customer_city',
      'customer_state',
      'customer_pincode',
      'item_name',
      'item_description',
      'qty',
      'unit_price',
      'tax_percent',
      'discount',
    ];
    const missing = required.filter((r) => !header.includes(r));
    if (missing.length) {
      return NextResponse.json({ error: `Missing headers: ${missing.join(', ')}` }, { status: 400 });
    }

    const indexOf = (key: string) => header.indexOf(key);
    const has = (key: string) => header.includes(key);
    const groups = new Map<string, any>();

    rows.slice(1).forEach((cols) => {
      const get = (key: string) => cols[indexOf(key)] ?? '';
      const invoiceNumber = String(get('invoice_number') || '').trim();
      if (!invoiceNumber) return;

      const item = {
        item_name: String(get('item_name') || '').trim(),
        item_description: String(get('item_description') || '').trim(),
        qty: toNumber(get('qty'), 1),
        unit_price: toNumber(get('unit_price'), 0),
        tax_percent: toNumber(get('tax_percent'), 0),
        discount: toNumber(get('discount'), 0),
      };

      if (!groups.has(invoiceNumber)) {
        groups.set(invoiceNumber, {
          invoice_number: invoiceNumber,
          invoice_date: get('invoice_date') || null,
          due_date: get('due_date') || null,
          customer_name: String(get('customer_name') || '').trim(),
          customer_phone: String(get('customer_phone') || '').trim(),
          customer_email: String(get('customer_email') || '').trim() || null,
          customer_address: String(get('customer_address') || '').trim() || null,
          customer_city: String(get('customer_city') || '').trim() || null,
          customer_state: String(get('customer_state') || '').trim() || null,
          customer_pincode: String(get('customer_pincode') || '').trim() || null,
          payment_mode: has('payment_mode') ? String(get('payment_mode') || '').trim() || null : null,
          payment_reference: has('payment_reference') ? String(get('payment_reference') || '').trim() || null : null,
          payment_notes: has('payment_notes') ? String(get('payment_notes') || '').trim() || null : null,
          paid_at: has('paid_at') ? String(get('paid_at') || '').trim() || null : null,
          line_items: [],
        });
      }

      groups.get(invoiceNumber).line_items.push(item);
    });

    const payload: any[] = [];
    for (const inv of groups.values()) {
      const items = inv.line_items as any[];
      const baseAmount = items.reduce((sum, it) => sum + it.qty * it.unit_price, 0);
      const discount = items.reduce((sum, it) => sum + (it.discount || 0), 0);
      const taxable = Math.max(0, baseAmount - discount);
      const taxAmount = items.reduce((sum, it) => sum + (taxable * (it.tax_percent || 0)) / 100, 0);
      const totalAmount = Math.max(0, taxable + taxAmount);

      const nowIso = new Date().toISOString();
      payload.push({
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date || null,
        due_date: inv.due_date || null,
        customer_name: inv.customer_name,
        customer_phone: inv.customer_phone,
        customer_email: inv.customer_email,
        customer_address: inv.customer_address,
        customer_city: inv.customer_city,
        customer_state: inv.customer_state,
        customer_pincode: inv.customer_pincode,
        line_items: items,
        base_amount: baseAmount,
        discount: discount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        currency: 'INR',
        status: 'PAID',
        paid_amount: totalAmount,
        paid_at: inv.paid_at || nowIso,
        payment_mode: inv.payment_mode,
        payment_reference: inv.payment_reference,
        payment_notes: inv.payment_notes,
        created_by: gate.userId,
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    if (payload.length === 0) return NextResponse.json({ error: 'No valid invoices in CSV' }, { status: 400 });

    const { error: insErr } = await supabaseAdmin
      .from('manual_create_invoice')
      .insert(payload);
    if (insErr) throw insErr;

    return NextResponse.json({ success: true, count: payload.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

