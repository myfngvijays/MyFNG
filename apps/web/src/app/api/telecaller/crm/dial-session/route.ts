import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import {
  getActiveDialSessionForTelecaller,
  getDialSession,
  publicDialSessionPayload,
  refreshDialSessionFromSmartflo,
  resolveLeadForDialSession,
} from '@/lib/telecaller/smartfloDialSessions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/telecaller/crm/dial-session?id=<uuid>
 * GET /api/telecaller/crm/dial-session?active=1
 * Live Smartflo click-to-call status + lead (so telecaller knows who is ringing).
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
    const wantActive = request.nextUrl.searchParams.get('active') === '1';
    const profileId = String((profile as any)?.id || user.id || '');
    const isAdmin = roleCode === 'SUPER_ADMIN' || roleCode === 'SUB_ADMIN' || roleCode === 'LEAD_MANAGER';

    if (!id && !wantActive) {
      return NextResponse.json({ error: 'id or active=1 required' }, { status: 400 });
    }

    let row = id ? await getDialSession(id) : null;
    if (!row && wantActive && profileId) {
      row = await getActiveDialSessionForTelecaller(profileId);
    }
    if (!row) {
      if (id && !wantActive) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, session: null });
    }

    if (!isAdmin && row.telecaller_id && row.telecaller_id !== profileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const fresh = await refreshDialSessionFromSmartflo(row);
    const lead = await resolveLeadForDialSession(fresh);
    if (lead?.id && !fresh.lead_id) {
      try {
        const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
        const { supabaseAdmin } = getSupabaseAdmin();
        if (supabaseAdmin) {
          await supabaseAdmin
            .from('smartflo_dial_sessions')
            .update({ lead_id: lead.id, updated_at: new Date().toISOString() })
            .eq('id', fresh.id);
          fresh.lead_id = lead.id;
        }
      } catch {
        /* non-blocking */
      }
    }

    return NextResponse.json({
      success: true,
      session: publicDialSessionPayload(fresh, lead),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to load dial session' },
      { status: 500 },
    );
  }
}
