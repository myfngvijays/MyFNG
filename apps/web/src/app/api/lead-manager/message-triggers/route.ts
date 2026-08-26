import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { fetchMessageTriggers } from '@/lib/enquiry/assignment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireBookingsUser(request: NextRequest) {
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

  if (!['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN', 'APP_OPERATIONS', 'TELECALLER'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const };
}

/** Read-only list of Meta/WhatsApp message triggers (same catalog as Telecaller Distribution). */
export async function GET(request: NextRequest) {
  const gate = await requireBookingsUser(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const triggers = await fetchMessageTriggers();
    return NextResponse.json({
      triggers: triggers.map((t) => ({
        id: t.id,
        label: t.label,
        phrase: t.phrase,
        match: t.match,
        is_active: t.is_active,
        mark_as_meta: t.mark_as_meta,
        telecaller_id: t.telecaller_id,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ triggers: [], warning: err?.message || 'Could not load triggers' });
  }
}
