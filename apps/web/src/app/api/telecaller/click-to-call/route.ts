import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getClickToCallConfig, resolveDidForTelecaller } from '@/lib/telecaller/clickToCallConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function digitsOnly(raw: unknown): string {
  return String(raw || '').replace(/\D/g, '');
}

/** India-friendly: return last 10 digits when possible. */
function normalizePhone10(raw: unknown): string | null {
  const d = digitsOnly(raw);
  if (!d) return null;
  if (d.length >= 10) return d.slice(-10);
  if (d.length >= 8) return d; // allow shorter agent IDs if configured that way
  return null;
}

/**
 * POST /api/telecaller/click-to-call
 * Body: { to: string, from?: string, lead_id?: string }
 * Uses logged-in telecaller phone as `from` unless overridden.
 * Proxies to Smartflo click-to-call gateway (Supabase edge function).
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

    const cfg = await getClickToCallConfig();
    if (!cfg.enabled) {
      return NextResponse.json(
        { error: 'Click-to-call is disabled. Enable it in Super Admin → Click to Call.', code: 'DISABLED' },
        { status: 503 },
      );
    }

    const gatewayBase = cfg.gateway_url;
    const profileId = String((profile as any)?.id || user.id || '').trim();
    const did = resolveDidForTelecaller(cfg, profileId);
    const provider = cfg.provider;

    const url = new URL(gatewayBase);
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    url.searchParams.set('did', did);
    url.searchParams.set('provider', provider);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (cfg.gateway_key) {
      headers.Authorization = `Bearer ${cfg.gateway_key}`;
    }

    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const text = await upstream.text().catch(() => '');
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error:
            (json && (json.error || json.message)) ||
            text ||
            `Click-to-call failed (${upstream.status})`,
          status: upstream.status,
          from,
          to,
          did,
          provider,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Call initiated — answer your phone, then customer will be connected',
      from,
      to,
      did,
      provider,
      gateway: json || { raw: text || 'ok' },
      lead_id: body?.lead_id ? String(body.lead_id) : null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
