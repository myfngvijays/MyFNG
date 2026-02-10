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

function normalizeDateInput(value: string): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function fiscalYearLabel(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1; // 1-12
  const startYear = m >= 4 ? y : y - 1;
  const endYear = startYear + 1;
  const yy = (n: number) => String(n % 100).padStart(2, '0');
  return `${yy(startYear)}-${yy(endYear)}`;
}

function extractSeqFor(prefix: string, fy: string, invoiceNumber: string): number {
  const s = String(invoiceNumber || '').trim();
  if (!s) return -1;
  const re = new RegExp(`^${prefix}-?(\\d+)\\s*/\\s*${fy.replace('-', '\\-')}$`, 'i');
  const m = s.match(re);
  if (!m?.[1]) return -1;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : -1;
}

async function computeNextInvoiceNumber(supabaseAdmin: any, opts: { prefix: string; invoiceDate: string | null }) {
  const prefix = String(opts.prefix || 'RA').trim().toUpperCase();
  const baseDate = opts.invoiceDate ? new Date(`${opts.invoiceDate}T00:00:00.000Z`) : new Date();
  const fy = fiscalYearLabel(baseDate);

  const take = 1000;
  let maxSeq = 0;
  for (let offset = 0; offset < 200000; offset += take) {
    const { data, error } = await supabaseAdmin
      .from('manual_create_invoice')
      .select('invoice_number')
      .order('created_at', { ascending: false })
      .range(offset, offset + take - 1);
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    for (const r of rows) {
      const seq = extractSeqFor(prefix, fy, String((r as any)?.invoice_number || ''));
      if (seq > maxSeq) maxSeq = seq;
    }
    if (rows.length < take) break;
  }

  return `${prefix}-${maxSeq + 1}/${fy}`;
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const invoiceDate = normalizeDateInput(body?.invoice_date) || null;
    const userInvoiceNumber = String(body?.invoice_number || '').trim();
    const customerName = String(body?.customer_name || '').trim();
    const customerPhone = String(body?.customer_phone || '').trim();
    const lineItems = Array.isArray(body?.line_items) ? body.line_items : [];

    if (!customerName || !customerPhone || lineItems.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const items: Array<{
      item_name: string;
      item_description: string;
      hsn_sac_code?: string | null;
      qty: number;
      unit_price: number;
      tax_percent: number;
      discount: number;
    }> = lineItems.map((it: any) => ({
      item_name: String(it?.item_name || '').trim(),
      item_description: String(it?.item_description || '').trim(),
      hsn_sac_code: String(it?.hsn_sac_code || '').trim() || null,
      qty: Number(it?.qty || 0),
      unit_price: Number(it?.unit_price || 0),
      tax_percent: Number(it?.tax_percent || 0),
      discount: Number(it?.discount || 0),
    }));

    const baseAmount = items.reduce((sum: number, it) => sum + it.qty * it.unit_price, 0);
    const discount = items.reduce((sum: number, it) => sum + (it.discount || 0), 0);
    const taxable = Math.max(0, baseAmount - discount);
    const taxAmount = items.reduce((sum: number, it) => sum + (taxable * (it.tax_percent || 0)) / 100, 0);
    const totalAmount = Math.max(0, taxable + taxAmount);

    const nowIso = new Date().toISOString();
    const dueDate = normalizeDateInput(body?.due_date) || null;

    // Insert with best-effort uniqueness for auto numbers.
    const wantsAuto = !userInvoiceNumber;
    const looksAutoPattern = /^RA-\d+\/\d{2}-\d{2}$/i.test(userInvoiceNumber);
    const allowAutoRetry = wantsAuto || looksAutoPattern;

    let lastErr: any = null;
    let usedInvoiceNumber = userInvoiceNumber;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!usedInvoiceNumber) {
        usedInvoiceNumber = await computeNextInvoiceNumber(supabaseAdmin as any, { prefix: 'RA', invoiceDate });
      }

      const { error: insErr } = await supabaseAdmin
        .from('manual_create_invoice')
        .insert({
          invoice_number: usedInvoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: body?.customer_email || null,
          customer_address: body?.customer_address || null,
          customer_city: body?.customer_city || null,
          customer_state: body?.customer_state || null,
          customer_pincode: body?.customer_pincode || null,
          customer_gstin: body?.customer_gstin || null,
          customer_tax_type: body?.customer_tax_type || null,
          place_of_supply: body?.place_of_supply || null,
          car_number: body?.car_number || null,
          car_model: body?.car_model || null,
          line_items: items,
          base_amount: baseAmount,
          discount: discount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          currency: 'INR',
          status: 'PAID',
          paid_amount: totalAmount,
          paid_at: nowIso,
          payment_mode: body?.payment_mode || null,
          payment_reference: body?.payment_reference || null,
          payment_notes: body?.payment_notes || null,
          created_by: gate.userId,
          created_at: nowIso,
          updated_at: nowIso,
        });

      if (!insErr) {
        return NextResponse.json({ success: true, invoice_number: usedInvoiceNumber });
      }

      lastErr = insErr;
      const code = String((insErr as any)?.code || '');
      const msg = String((insErr as any)?.message || '').toLowerCase();
      const isDuplicate = code === '23505' || msg.includes('duplicate') || msg.includes('unique');

      if (!isDuplicate || !allowAutoRetry) break;
      // Force regenerate next number and retry
      usedInvoiceNumber = '';
    }

    if (lastErr) {
      const code = String((lastErr as any)?.code || '');
      const msg = String((lastErr as any)?.message || '');
      const status = code === '23505' ? 409 : 500;
      return NextResponse.json({ error: msg || 'Failed to create invoice' }, { status });
    }
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

