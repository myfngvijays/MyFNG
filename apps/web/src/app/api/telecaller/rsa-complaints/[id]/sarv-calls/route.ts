import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user || null;
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = String((profile.roles as any)?.role_code || '');
    const allowed = new Set(['TELECALLER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden: Telecaller only' }, { status: 403 });
    }

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;

    const { data: lead } = await db
      .from('rsa_leads')
      .select('id, registered_by_id')
      .eq('id', leadId)
      .maybeSingle();

    if (!lead?.id) {
      return NextResponse.json({ error: 'RSA complaint not found' }, { status: 404 });
    }

    if (roleCode === 'TELECALLER' && String(lead.registered_by_id) !== String(profile.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: links, error: linksError } = await db
      .from('sarv_call_rsa_links')
      .select(
        `
        id,
        matched_phone,
        sarv_calls: sarv_calls (
          id,
          callid,
          cnumber,
          callstatus,
          ctype,
          ivrstime,
          ivretime,
          ivrduration,
          talkduration,
          agentoncallduration,
          custanswerstime,
          custansweretime,
          custanswerduration,
          recording_url,
          transcription,
          summary,
          disposition,
          disposition_category,
          disposition_note,
          disposition_updated_at,
          sarv_created_at,
          created_at
        )
      `
      )
      .eq('rsa_lead_id', leadId)
      .order('created_at', { ascending: false });

    if (linksError) {
      return NextResponse.json({ error: 'Failed to fetch SARV calls' }, { status: 500 });
    }

    const calls = (links || [])
      .map((link: any) => ({
        link_id: link.id,
        matched_phone: link.matched_phone,
        ...(link.sarv_calls || {}),
      }))
      .filter((row: any) => row.callid);

    return NextResponse.json({ success: true, calls }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
