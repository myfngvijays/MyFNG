import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function digits10(input: unknown) {
  const raw = String(input ?? '');
  const d = raw.replace(/\D/g, '');
  return d.length <= 10 ? d : d.slice(-10);
}

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
      .select('id, registered_by_id, contact_number, alternate_number, lead_registered_at, requested_at')
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

    if (calls.length > 0) {
      return NextResponse.json({ success: true, calls }, { status: 200 });
    }

    // Fallback: for older/unlinked records, match by lead phone numbers directly.
    const phones = Array.from(
      new Set(
        [digits10((lead as any)?.contact_number), digits10((lead as any)?.alternate_number)].filter(Boolean)
      )
    );
    if (phones.length === 0) {
      return NextResponse.json({ success: true, calls: [] }, { status: 200 });
    }

    const leadStart = (lead as any)?.lead_registered_at || (lead as any)?.requested_at || null;
    let fallbackQuery = db
      .from('sarv_calls')
      .select(
        `
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
      `
      )
      .order('created_at', { ascending: false })
      .limit(100);

    if (leadStart) {
      // Keep a small back window to include pre-registration call attempts.
      const start = new Date(leadStart);
      if (!Number.isNaN(start.getTime())) {
        start.setDate(start.getDate() - 2);
        fallbackQuery = fallbackQuery.gte('created_at', start.toISOString());
      }
    }

    const phoneOr = phones.map((p) => `cnumber.ilike.%${p}`).join(',');
    const { data: fallbackCalls, error: fallbackError } = await fallbackQuery.or(phoneOr);
    if (fallbackError) {
      return NextResponse.json({ error: 'Failed to fetch SARV calls' }, { status: 500 });
    }

    const normalizedSet = new Set(phones);
    const deduped = Array.from(
      new Map(
        (fallbackCalls || [])
          .filter((row: any) => normalizedSet.has(digits10(row?.cnumber)))
          .map((row: any) => [String(row?.id || row?.callid || Math.random()), row])
      ).values()
    );

    return NextResponse.json({ success: true, calls: deduped }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
