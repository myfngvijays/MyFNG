import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { fetchDeepcallRecordingUrl } from '@/lib/sarv/deepcall';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * On-demand DeepCall recording stream.
 *
 * Problem: DeepCall `/directstream/<token>/...` tokens expire in ~5 days,
 * so any signed URL we save in DB silently breaks. Instead of storing a
 * signed URL, the frontend points `<audio src>` at THIS endpoint for each
 * call row. We fetch a fresh signed URL from DeepCall on every play and
 * 302-redirect the browser to it — URLs are never stale, DB stays clean.
 *
 * Auth: any logged-in user with role TELECALLER/RSA_MANAGER/SUPER_ADMIN/SUB_ADMIN.
 * Non-admin roles are further restricted to calls assigned to them. Admins
 * can access every call.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user || null;
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: roleError } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();
    if (roleError || !userData) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const roleCode = String((userData as any).roles?.role_code || '');
    const allowed = new Set(['TELECALLER', 'RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const { id } = await context.params;
    const identifier = String(id || '').trim();
    if (!identifier) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    // `:id` param accepts BOTH the sarv_calls row UUID and the Sarv `callid`.
    // UUID v4 has 32 hex chars + 4 dashes; if the shape matches we look up
    // by id, otherwise by callid. This lets previous-disposition recording
    // links (which only carry the external callid) still work.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const lookupColumn = isUuid ? 'id' : 'callid';

    const { data: callRow, error: callErr } = await db
      .from('sarv_calls')
      .select('id, callid, assigned_user_id, telecaller_id, recording_url')
      .eq(lookupColumn, identifier)
      .maybeSingle();
    if (callErr) {
      return NextResponse.json({ error: callErr.message }, { status: 500 });
    }
    if (!callRow?.id) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    const isAdmin = roleCode === 'SUPER_ADMIN' || roleCode === 'SUB_ADMIN';
    if (!isAdmin) {
      const ownsCall =
        String(callRow.assigned_user_id || '') === user.id ||
        String(callRow.telecaller_id || '') === user.id;
      if (!ownsCall) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (!callRow.callid) {
      return NextResponse.json({ error: 'Call has no callid' }, { status: 400 });
    }

    const result = await fetchDeepcallRecordingUrl(String(callRow.callid));
    if (!result.url) {
      // DeepCall couldn't give us a URL. If we already have a previously-saved
      // recording_url in DB, fall back to that (may be stale) so user at least
      // gets a chance. Otherwise surface a proper error.
      if (callRow.recording_url) {
        return NextResponse.redirect(callRow.recording_url, 302);
      }
      return NextResponse.json(
        {
          error: 'No recording available',
          details: result.error || 'DeepCall did not return a URL',
        },
        { status: 502 }
      );
    }

    // Opportunistically cache the fresh URL in DB so other parts of the app
    // (email links, reports etc.) that still read recording_url get a URL
    // that at least works for a few days. Failure to update is non-fatal —
    // we swallow the error and still redirect.
    if (result.url !== callRow.recording_url) {
      try {
        await db
          .from('sarv_calls')
          .update({ recording_url: result.url, updated_at: new Date().toISOString() })
          .eq('id', callRow.id);
      } catch {
        // ignore
      }
    }

    return NextResponse.redirect(result.url, 302);
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: e?.message },
      { status: 500 }
    );
  }
}
