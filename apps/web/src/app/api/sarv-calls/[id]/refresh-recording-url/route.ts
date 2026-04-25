import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { fetchDeepcallRecordingUrl } from '@/lib/sarv/deepcall';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Refresh the saved DeepCall signed recording URL for a single sarv_calls row.
 * Naya panel webhook me sirf relative path bhejta hai aur har file ke liye
 * per-call signed URL chahiye hota hai. Webhook khud first attempt karta hai;
 * agar token expire ho jaye ya woh request fail ho gaya tha, to admin/UI yahan
 * se refresh kar sakta hai.
 *
 * Auth: SUPER_ADMIN / SUB_ADMIN. (Telecaller/RSA_MANAGER ke liye chahiye to
 * baad me allow kar denge — abhi simple admin-only.)
 */
async function assertAdmin(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }
  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) {
    return { ok: false as const, status: 403, error: 'Forbidden - Role check failed' };
  }
  const roleCode = String((userData as any).roles?.role_code || '');
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden - Not super admin' };
  }
  return { ok: true as const, user };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await assertAdmin(supabase);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const { id } = await context.params;
    const rowId = String(id || '').trim();
    if (!rowId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data: callRow, error: callErr } = await db
      .from('sarv_calls')
      .select('id, callid, recording_url')
      .eq('id', rowId)
      .single();
    if (callErr || !callRow?.id) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }
    if (!callRow.callid) {
      return NextResponse.json({ error: 'Call has no callid' }, { status: 400 });
    }

    const result = await fetchDeepcallRecordingUrl(String(callRow.callid));
    if (!result.url) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'DeepCall did not return a recording URL',
          rawRcrd: result.rawRcrd ?? null,
        },
        { status: 502 }
      );
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await db
      .from('sarv_calls')
      .update({ recording_url: result.url, updated_at: now })
      .eq('id', callRow.id);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      id: callRow.id,
      callid: callRow.callid,
      previous_url: callRow.recording_url || null,
      recording_url: result.url,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: e?.message },
      { status: 500 }
    );
  }
}
