import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import {
  getDialSession,
  publicDialSessionPayload,
  refreshDialSessionFromSmartflo,
} from '@/lib/telecaller/smartfloDialSessions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/telecaller/crm/dial-session?id=<uuid>
 * Live Smartflo click-to-call status for dialer overlay (poll every ~2s).
 * Also refreshes from Smartflo live_calls so UI advances without webhooks.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    const roleCode = String((profile?.roles as any)?.role_code || '')
      .trim()
      .toUpperCase();
    const allowed = new Set(['TELECALLER', 'LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const id = String(request.nextUrl.searchParams.get('id') || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const row = await getDialSession(id);
    if (!row) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const profileId = String((profile as any)?.id || user.id || '');
    const isAdmin = roleCode === 'SUPER_ADMIN' || roleCode === 'SUB_ADMIN' || roleCode === 'LEAD_MANAGER';
    if (!isAdmin && row.telecaller_id && row.telecaller_id !== profileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const fresh = await refreshDialSessionFromSmartflo(row);

    return NextResponse.json({
      success: true,
      session: publicDialSessionPayload(fresh),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to load dial session' },
      { status: 500 },
    );
  }
}
