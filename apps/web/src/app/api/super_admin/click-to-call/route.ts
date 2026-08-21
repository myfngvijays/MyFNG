import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getClickToCallConfig,
  publicClickToCallConfig,
  resolveDidForTelecaller,
  saveClickToCallConfig,
  type DidAssignment,
} from '@/lib/telecaller/clickToCallConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('users_login')
    .select('id, full_name, phone, roles!role_id(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = String((profile as any)?.roles?.role_code || '')
    .trim()
    .toUpperCase();
  if (!['SUPER_ADMIN', 'LEAD_MANAGER', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return {
    ok: true as const,
    roleCode,
    userId: String((profile as any)?.id || user.id),
    phone: (profile as any)?.phone ? String((profile as any).phone) : null,
  };
}

/** GET — config + telecaller from-numbers */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const cfg = await getClickToCallConfig();
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 });
  }

  const { data: users } = await supabaseAdmin
    .from('users_login')
    .select('id, full_name, phone, email, is_active, roles!role_id(role_code)')
    .order('full_name', { ascending: true });

  const telecallers = (users || [])
    .filter((u: any) => String(u?.roles?.role_code || '').toUpperCase() === 'TELECALLER')
    .map((u: any) => {
      const id = String(u.id);
      const assigned = cfg.did_assignments.find((a) => a.telecaller_id === id);
      return {
        id,
        full_name: u.full_name ? String(u.full_name) : null,
        phone: u.phone ? String(u.phone) : null,
        email: u.email ? String(u.email) : null,
        is_active: Boolean(u.is_active),
        missing_from: !String(u.phone || '').replace(/\D/g, ''),
        assigned_did: assigned?.did || null,
      };
    });

  return NextResponse.json({
    config: publicClickToCallConfig(cfg),
    telecallers,
    defaults: {
      gateway_url: cfg.gateway_url,
      did: cfg.did,
      provider: cfg.provider,
      dids: cfg.dids,
    },
  });
}

/**
 * POST actions:
 * - save_config
 * - save_did_assignments { did_assignments, dids?, did? }
 * - update_telecaller_phone
 * - test_call { from, to, telecaller_id? }
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '').trim();

  if (action === 'save_config') {
    const canEditSecrets = gate.roleCode === 'SUPER_ADMIN' || gate.roleCode === 'SUB_ADMIN';
    try {
      const saved = await saveClickToCallConfig({
        enabled: body.enabled,
        gateway_url: body.gateway_url,
        did: body.did,
        provider: body.provider,
        dids: body.dids,
        did_assignments: body.did_assignments,
        gateway_key: canEditSecrets ? body.gateway_key : undefined,
        clear_gateway_key: canEditSecrets ? Boolean(body.clear_gateway_key) : false,
      });
      return NextResponse.json({
        success: true,
        config: publicClickToCallConfig(saved),
        message: 'Click-to-call settings saved',
      });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Save failed' }, { status: 500 });
    }
  }

  if (action === 'save_did_assignments') {
    try {
      const assignments = Array.isArray(body.did_assignments)
        ? (body.did_assignments as DidAssignment[])
        : undefined;
      if (!assignments) {
        return NextResponse.json({ error: 'did_assignments required' }, { status: 400 });
      }
      const saved = await saveClickToCallConfig({
        dids: body.dids,
        did: body.did,
        did_assignments: assignments,
      });
      return NextResponse.json({
        success: true,
        config: publicClickToCallConfig(saved),
        message: 'DID assignments saved',
      });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Save failed' }, { status: 500 });
    }
  }

  if (action === 'update_telecaller_phone') {
    const telecallerId = String(body.telecaller_id || '').trim();
    const phoneRaw = String(body.phone || '').replace(/\D/g, '');
    if (!telecallerId) {
      return NextResponse.json({ error: 'telecaller_id required' }, { status: 400 });
    }
    if (phoneRaw && phoneRaw.length < 10) {
      return NextResponse.json({ error: 'Phone needs at least 10 digits (or clear it)' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 });
    }

    const { data: telecaller, error: findErr } = await supabaseAdmin
      .from('users_login')
      .select('id, roles!role_id(role_code)')
      .eq('id', telecallerId)
      .maybeSingle();
    if (findErr || !telecaller) {
      return NextResponse.json({ error: 'Telecaller not found' }, { status: 404 });
    }
    const roleCode = String((telecaller as any)?.roles?.role_code || '').toUpperCase();
    if (roleCode !== 'TELECALLER') {
      return NextResponse.json({ error: 'User is not a TELECALLER' }, { status: 400 });
    }

    const { error: updErr } = await supabaseAdmin
      .from('users_login')
      .update({ phone: phoneRaw || null, updated_at: new Date().toISOString() })
      .eq('id', telecallerId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message || 'Update failed' }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      message: phoneRaw ? `Saved from number ${phoneRaw.slice(-10)}` : 'Cleared phone',
      phone: phoneRaw || null,
    });
  }

  if (action === 'test_call') {
    const from = String(body.from || gate.phone || '').replace(/\D/g, '');
    const to = String(body.to || '').replace(/\D/g, '');
    const from10 = from.length >= 10 ? from.slice(-10) : from;
    const to10 = to.length >= 10 ? to.slice(-10) : to;
    if (!from10 || from10.length < 8) {
      return NextResponse.json({ error: 'from number required' }, { status: 400 });
    }
    if (!to10 || to10.length < 10) {
      return NextResponse.json({ error: 'to (customer) number required' }, { status: 400 });
    }

    const cfg = await getClickToCallConfig();
    if (!cfg.enabled) {
      return NextResponse.json({ error: 'Click-to-call is disabled in settings' }, { status: 400 });
    }

    const telecallerId = String(body.telecaller_id || '').trim() || null;
    const didOverride = String(body.did || '').replace(/\D/g, '');
    const did =
      didOverride ||
      resolveDidForTelecaller(cfg, telecallerId) ||
      cfg.did;

    const url = new URL(cfg.gateway_url);
    url.searchParams.set('from', from10);
    url.searchParams.set('to', to10);
    url.searchParams.set('did', did);
    url.searchParams.set('provider', cfg.provider);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (cfg.gateway_key) headers.Authorization = `Bearer ${cfg.gateway_key}`;

    const upstream = await fetch(url.toString(), { method: 'GET', headers, cache: 'no-store' });
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
          error: (json && (json.error || json.message)) || text || `Gateway ${upstream.status}`,
          from: from10,
          to: to10,
          did,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Test call initiated — answer the from phone first',
      from: from10,
      to: to10,
      did,
      gateway: json || { raw: text || 'ok' },
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
