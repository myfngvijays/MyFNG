import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

function extractInvoiceSequence(invoiceNumber: string | null | undefined): number {
  const s = String(invoiceNumber || '').trim();
  if (!s) return -1;

  // Prefer number just before first "/" (e.g. "RA-549/25-26" -> 549)
  const m1 = s.match(/(\d+)\s*(?=\/)/);
  if (m1?.[1]) return Number(m1[1]) || -1;

  // Fallback: first number group in the string
  const m2 = s.match(/(\d+)/);
  if (m2?.[1]) return Number(m2[1]) || -1;

  return -1;
}

function normalizeDigits(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '');
}

function matchesSearch(row: any, q: string) {
  const raw = String(q || '').trim();
  if (!raw) return true;
  const qLower = raw.toLowerCase();
  const qDigits = normalizeDigits(raw);

  const inv = String(row?.invoice_number || '').toLowerCase();
  const name = String(row?.customer_name || '').toLowerCase();
  const phone = String(row?.customer_phone || '');
  const phoneDigits = normalizeDigits(phone);

  // If user typed a full 10-digit number, treat it as mobile search only.
  if (/^\d{10}$/.test(qDigits)) {
    return phoneDigits.includes(qDigits);
  }

  // If user typed a short number (e.g. 610), treat it as invoice sequence match.
  if (qDigits && /^\d{1,6}$/.test(qDigits) && !/[a-z]/i.test(raw)) {
    const seq = extractInvoiceSequence(row?.invoice_number);
    return seq === Number(qDigits);
  }

  // Otherwise: general search (invoice number / name / partial phone)
  if (inv.includes(qLower)) return true;
  if (name.includes(qLower)) return true;
  if (qDigits && phoneDigits.includes(qDigits)) return true;
  return false;
}

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

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(String(url.searchParams.get('page') || '1'), 10) || 1);
    const pageSize = Math.min(500, Math.max(10, parseInt(String(url.searchParams.get('pageSize') || '25'), 10) || 25));
    const fromDate = url.searchParams.get('fromDate')?.trim() || null;
    const toDate = url.searchParams.get('toDate')?.trim() || null;
    const q = url.searchParams.get('q')?.trim() || '';

    const from = fromDate || null;
    const to = toDate || null;

    // Fetch all matching invoices (then sort by invoice_number sequence desc).
    // We do this because invoice_number is a string like "RA-549/25-26" and we want 614, 613, 612... at top,
    // which is not reliably achievable with a plain text order in PostgREST.
    const take = 1000; // PostgREST default page cap
    const all: any[] = [];
    let total: number | null = null;

    for (let offset = 0; offset < 100000; offset += take) {
      let query = supabaseAdmin
        .from('manual_create_invoice')
        .select(
          'id, invoice_number, invoice_date, customer_name, customer_phone, total_amount, currency, status, created_at, payment_mode, payment_reference, paid_at, customer_gstin, car_number, car_model',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + take - 1);

      if (from) query = query.gte('invoice_date', from);
      if (to) query = query.lte('invoice_date', to);

      const { data, error, count } = await query;
      if (error) throw error;
      if (total == null && typeof count === 'number') total = count;

      const rows = Array.isArray(data) ? data : [];
      all.push(...rows);
      if (rows.length < take) break;
    }

    const sorted = all.sort((a, b) => {
      const sa = extractInvoiceSequence(a?.invoice_number);
      const sb = extractInvoiceSequence(b?.invoice_number);
      if (sa !== sb) return sb - sa;
      const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

    const searched = q ? sorted.filter((r) => matchesSearch(r, q)) : sorted;
    const effectiveTotal = q ? searched.length : (total ?? searched.length);
    const sliceOffset = (page - 1) * pageSize;
    const pageRows = searched.slice(sliceOffset, sliceOffset + pageSize);

    return NextResponse.json({
      invoices: pageRows,
      total: effectiveTotal,
      page,
      pageSize,
      totalPages: Math.ceil(effectiveTotal / pageSize) || 1,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

