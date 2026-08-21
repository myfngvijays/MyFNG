import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_STATUSES = new Set([
  'NEW',
  'ASSIGNED',
  'ACCEPTED',
  'REJECTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'HOLD',
  'READY_FOR_DELIVERY',
]);

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('users_login')
    .select('id, roles!role_id(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '')
    .trim()
    .toUpperCase();

  if (!['SUPER_ADMIN', 'LEAD_MANAGER', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const, userId: String((profile as { id?: string } | null)?.id || user.id) };
}

/**
 * POST /api/super_admin/leads/bulk-status
 * Body: { lead_ids: string[], status: string }
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await request.json().catch(() => ({}));
    const leadIds = Array.isArray(body?.lead_ids)
      ? body.lead_ids.map((x: unknown) => String(x || '').trim()).filter(Boolean)
      : [];
    const status = String(body?.status || '')
      .trim()
      .toUpperCase();

    if (!leadIds.length) {
      return NextResponse.json({ error: 'lead_ids required' }, { status: 400 });
    }
    if (leadIds.length > 200) {
      return NextResponse.json({ error: 'Max 200 leads per bulk status update' }, { status: 400 });
    }
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from('service_leads')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', leadIds)
      .is('deleted_at', null)
      .select('id, status');

    if (error) {
      return NextResponse.json({ error: error.message || 'Bulk status update failed' }, { status: 500 });
    }

    const updated = Array.isArray(data) ? data.length : 0;
    return NextResponse.json({
      success: true,
      updated,
      status,
      message: `Updated status to ${status} for ${updated} lead${updated === 1 ? '' : 's'}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
