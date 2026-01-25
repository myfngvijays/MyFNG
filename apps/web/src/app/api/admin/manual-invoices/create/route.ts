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

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const invoiceNumber = String(body?.invoice_number || '').trim();
    const customerName = String(body?.customer_name || '').trim();
    const customerPhone = String(body?.customer_phone || '').trim();
    const lineItems = Array.isArray(body?.line_items) ? body.line_items : [];

    if (!invoiceNumber || !customerName || !customerPhone || lineItems.length === 0) {
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
    const { error: insErr } = await supabaseAdmin
      .from('manual_create_invoice')
      .insert({
        invoice_number: invoiceNumber,
        invoice_date: normalizeDateInput(body?.invoice_date) || null,
        due_date: normalizeDateInput(body?.due_date) || null,
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

    if (insErr) throw insErr;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

