import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { requireRoleCodes } from '@/lib/super-admin-auth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { DATA_RIGHTS_TYPES } from '@/lib/dpdp/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUSES = ['PENDING', 'IN_PROGRESS', 'DONE', 'REJECTED'] as const;
const TYPE_LABEL = Object.fromEntries(DATA_RIGHTS_TYPES.map((t) => [t.id, t.label]));

async function requireInboxAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  return requireRoleCodes(supabase, ['SUPER_ADMIN', 'SUB_ADMIN']);
}

export async function GET(request: NextRequest) {
  const auth = await requireInboxAdmin(request);
  if (!auth.ok) return auth.res;

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const search = String(searchParams.get('search') || '').trim();
  const status = String(searchParams.get('status') || 'ALL').trim().toUpperCase();
  const type = String(searchParams.get('type') || 'ALL').trim().toLowerCase();

  let query = supabaseAdmin
    .from('data_rights_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(400);

  if (STATUSES.includes(status as (typeof STATUSES)[number])) {
    query = query.eq('status', status);
  }
  if (type !== 'all' && TYPE_LABEL[type]) {
    query = query.eq('request_type', type);
  }
  if (search) {
    const safe = search.replace(/,/g, ' ');
    query = query.or(
      `full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%,details.ilike.%${safe}%`,
    );
  }

  const [{ data, error }, { data: allRows }] = await Promise.all([
    query,
    supabaseAdmin.from('data_rights_requests').select('status').limit(2000),
  ]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data || [];
  const list = allRows || [];
  const counts = {
    all: list.length,
    pending: list.filter((r) => String(r.status).toUpperCase() === 'PENDING').length,
    in_progress: list.filter((r) => String(r.status).toUpperCase() === 'IN_PROGRESS').length,
    done: list.filter((r) => String(r.status).toUpperCase() === 'DONE').length,
    rejected: list.filter((r) => String(r.status).toUpperCase() === 'REJECTED').length,
  };

  return NextResponse.json({
    ok: true,
    requests: rows.map((r) => ({
      ...r,
      request_type_label: TYPE_LABEL[String(r.request_type)] || r.request_type,
    })),
    counts,
    types: DATA_RIGHTS_TYPES,
    statuses: STATUSES,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireInboxAdmin(request);
  if (!auth.ok) return auth.res;

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  const status = String(body.status || '').trim().toUpperCase();
  const notes = body.notes != null ? String(body.notes).slice(0, 4000) : undefined;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { status };
  if (notes !== undefined) patch.notes = notes;
  if (status === 'DONE' || status === 'REJECTED') {
    patch.processed_at = new Date().toISOString();
  } else {
    patch.processed_at = null;
  }

  const { data, error } = await supabaseAdmin
    .from('data_rights_requests')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    request: {
      ...data,
      request_type_label: TYPE_LABEL[String(data?.request_type)] || data?.request_type,
    },
  });
}
