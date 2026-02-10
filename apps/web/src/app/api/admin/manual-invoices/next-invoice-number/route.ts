import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

function fiscalYearLabel(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1; // 1-12
  const startYear = m >= 4 ? y : y - 1;
  const endYear = startYear + 1;
  const yy = (n: number) => String(n % 100).padStart(2, '0');
  return `${yy(startYear)}-${yy(endYear)}`;
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

function extractSeqFor(prefix: string, fy: string, invoiceNumber: string): number {
  const s = String(invoiceNumber || '').trim();
  if (!s) return -1;
  const re = new RegExp(`^${prefix}-?(\\d+)\\s*/\\s*${fy.replace('-', '\\-')}$`, 'i');
  const m = s.match(re);
  if (!m?.[1]) return -1;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : -1;
}

async function computeNextInvoiceNumber(supabaseAdmin: any, opts: { prefix: string; fy: string }) {
  const prefix = String(opts.prefix || 'RA').trim().toUpperCase();
  const fy = String(opts.fy || '').trim();

  // Fetch all invoice_number values (paged) and compute max seq for this FY.
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

/**
 * GET /api/admin/manual-invoices/next-invoice-number?invoice_date=YYYY-MM-DD&prefix=RA
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const url = new URL(request.url);
    const prefix = (url.searchParams.get('prefix') || 'RA').trim().toUpperCase();
    const invoiceDate = normalizeDateInput(url.searchParams.get('invoice_date') || '') || null;
    const baseDate = invoiceDate ? new Date(`${invoiceDate}T00:00:00.000Z`) : new Date();
    const fy = fiscalYearLabel(baseDate);

    const invoice_number = await computeNextInvoiceNumber(supabaseAdmin as any, { prefix, fy });
    return NextResponse.json({ invoice_number, prefix, fy }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

