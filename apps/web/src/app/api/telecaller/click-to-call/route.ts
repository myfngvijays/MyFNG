import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { initiateClickToCall, normalizePhone10 } from '@/lib/telecaller/initiateClickToCall';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/telecaller/click-to-call
 * Body: { to: string, from?: string, lead_id?: string }
 *
 * Hits the configured gateway URL (?from=&to=&did=&provider=) — same as Fresh auto-dial.
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const to = normalizePhone10(body?.to);
    const fromOverride = normalizePhone10(body?.from);
    const fromProfile = normalizePhone10((profile as any)?.phone);
    const from = fromOverride || fromProfile;
    const profileId = String((profile as any)?.id || user.id || '').trim();

    if (!to) {
      return NextResponse.json({ error: 'Customer phone (to) required' }, { status: 400 });
    }
    if (!from) {
      return NextResponse.json(
        {
          error:
            'Your calling number (from) is missing. Ask Lead Manager / Super Admin to set your phone on Click to Call setup.',
          code: 'MISSING_AGENT_PHONE',
        },
        { status: 400 },
      );
    }

    const result = await initiateClickToCall({
      to,
      from,
      telecallerId: profileId,
    });

    if (!result.ok) {
      const status =
        result.status === 503 ? 503 : result.status === 504 ? 504 : 502;
      return NextResponse.json(
        {
          error: result.error || 'Click-to-call failed',
          code:
            result.status === 503
              ? 'DISABLED'
              : result.status === 504
                ? 'GATEWAY_TIMEOUT'
                : undefined,
          from: result.from || from,
          to: result.to || to,
          did: result.did,
          provider: result.provider,
          via: result.via,
          gateway: result.upstream,
        },
        { status },
      );
    }

    const leadId = body?.lead_id ? String(body.lead_id).trim() : '';

    // Live dial session — dialer polls this; only Smartflo webhooks mark ANSWERED
    let sessionId: string | null = null;
    try {
      const { createDialSession } = await import('@/lib/telecaller/smartfloDialSessions');
      const session = await createDialSession({
        telecallerId: profileId,
        leadId: leadId || null,
        agentPhone: result.from || from,
        customerPhone: result.to || to,
        did: result.did,
        upstream: result.upstream,
      });
      sessionId = session?.id || null;
    } catch (sessErr) {
      console.warn('[click-to-call] dial session create failed:', sessErr);
    }

    // Lead match + RINGING log — do not block response
    void (async () => {
      try {
        let resolvedLeadId = leadId;
        const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
        const { supabaseAdmin } = getSupabaseAdmin();
        const db = supabaseAdmin ?? supabase;

        if (!resolvedLeadId && profileId) {
          const { data: hit } = await db
            .from('service_leads')
            .select('id')
            .or(
              `customer_phone.eq.${to},customer_phone.eq.91${to},customer_phone.eq.+91${to}`,
            )
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (hit?.id) resolvedLeadId = String(hit.id);
        }

        if (resolvedLeadId && profileId) {
          const { data: inserted } = await db
            .from('telecaller_call_logs')
            .insert({
              lead_id: resolvedLeadId,
              telecaller_id: profileId,
              call_type: 'OUTBOUND',
              call_status: 'RINGING',
              notes: leadId
                ? '[Click-to-call] Dial initiated — recording syncs after hangup'
                : '[Dialer] Number dial — recording syncs after hangup',
              phone_number: to,
              created_at: new Date().toISOString(),
            })
            .select('id')
            .maybeSingle();

          if (inserted?.id && sessionId) {
            const { getSupabaseAdmin: getAdmin } = await import('@/lib/push/supabaseAdmin');
            const { supabaseAdmin: admin } = getAdmin();
            if (admin) {
              await admin
                .from('smartflo_dial_sessions')
                .update({
                  lead_id: resolvedLeadId,
                  call_log_id: inserted.id,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', sessionId);
            }
          }
        }
      } catch (logErr) {
        console.warn('[click-to-call] background log failed:', logErr);
      }
    })();

    return NextResponse.json({
      success: true,
      message:
        'Call initiated — answer YOUR phone first; customer will connect after you pick up',
      from: result.from,
      to: result.to,
      did: result.did,
      provider: result.provider,
      via: result.via,
      gateway: result.upstream,
      lead_id: leadId || null,
      call_log_id: null,
      session_id: sessionId,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
