import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getClickToCallConfig,
  publicClickToCallConfig,
  saveClickToCallConfig,
  type DidAssignment,
} from '@/lib/telecaller/clickToCallConfig';
import { evaluateAutoDialWindow } from '@/lib/telecaller/clickToCallHours';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 90;

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
      const hoursCheck = evaluateAutoDialWindow(cfg, id);
      return {
        id,
        full_name: u.full_name ? String(u.full_name) : null,
        phone: u.phone ? String(u.phone) : null,
        email: u.email ? String(u.email) : null,
        is_active: Boolean(u.is_active),
        missing_from: !String(u.phone || '').replace(/\D/g, ''),
        assigned_did: assigned?.did || null,
        dial_hours: hoursCheck.window,
        dial_open_now: hoursCheck.allowed,
        on_leave: hoursCheck.reason.startsWith('on_leave'),
        auto_dial_enabled: hoursCheck.window.auto_dial_enabled !== false,
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
        dial_mode: body.dial_mode,
        auto_dial_on_fresh_assign: body.auto_dial_on_fresh_assign,
        auto_dial_hours_enabled: body.auto_dial_hours_enabled,
        auto_dial_start: body.auto_dial_start,
        auto_dial_end: body.auto_dial_end,
        auto_dial_days: body.auto_dial_days,
        telecaller_hours: body.telecaller_hours,
        gateway_key: canEditSecrets ? body.gateway_key : undefined,
        clear_gateway_key: canEditSecrets ? Boolean(body.clear_gateway_key) : false,
        smartflo_api_token: canEditSecrets ? body.smartflo_api_token : undefined,
        clear_smartflo_api_token: canEditSecrets
          ? Boolean(body.clear_smartflo_api_token)
          : false,
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

  if (action === 'save_telecaller_hours') {
    const telecallerId = String(body.telecaller_id || '').trim();
    if (!telecallerId) {
      return NextResponse.json({ error: 'telecaller_id required' }, { status: 400 });
    }
    try {
      const current = await getClickToCallConfig();
      const nextHours = { ...(current.telecaller_hours || {}) };
      if (body.clear) {
        delete nextHours[telecallerId];
      } else {
        nextHours[telecallerId] = {
          start: String(body.start || current.auto_dial_start),
          end: String(body.end || current.auto_dial_end),
          days: Array.isArray(body.days) ? body.days : nextHours[telecallerId]?.days || current.auto_dial_days,
          leave_from: String(body.leave_from || '').trim() || null,
          leave_to: String(body.leave_to || '').trim() || null,
          on_leave: Boolean(body.on_leave),
          auto_dial_enabled: body.auto_dial_enabled === undefined ? true : Boolean(body.auto_dial_enabled),
        };
      }
      const saved = await saveClickToCallConfig({ telecaller_hours: nextHours });
      return NextResponse.json({
        success: true,
        config: publicClickToCallConfig(saved),
        message: 'Telecaller hours saved',
      });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Hours save failed' }, { status: 500 });
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

    const telecallerId = String(body.telecaller_id || '').trim() || null;
    const didOverride = String(body.did || '').replace(/\D/g, '') || null;

    const { initiateClickToCall } = await import('@/lib/telecaller/initiateClickToCall');
    const result = await initiateClickToCall({
      from: from10,
      to: to10,
      telecallerId,
      did: didOverride,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error || 'Test call failed',
          from: result.from || from10,
          to: result.to || to10,
          did: result.did,
          via: result.via,
        },
        { status: result.status === 403 ? 403 : 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        'Test call initiated — answer the FROM (telecaller) phone first; customer connects after pickup',
      from: result.from,
      to: result.to,
      did: result.did,
      via: result.via,
      gateway: result.upstream,
    });
  }

  if (action === 'sync_recordings') {
    const hoursBack = Number(body.hours_back ?? body.hours ?? 6);
    const maxPages = Number(body.max_pages ?? 6);
    const { syncSmartfloRecordings } = await import('@/lib/telecaller/smartfloCdr');
    const result = await syncSmartfloRecordings({
      hoursBack: Number.isFinite(hoursBack) ? hoursBack : 6,
      maxPages: Number.isFinite(maxPages) ? maxPages : 6,
      timeBudgetMs: 55_000,
      concurrency: 6,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Sync failed', ...result },
        { status: 502 },
      );
    }
    const truncNote = result.truncated
      ? ' (partial — Smartflo slow; cron will continue)'
      : '';
    return NextResponse.json({
      success: true,
      message: `Synced ${result.with_recording} recording(s) from ${result.fetched} CDR row(s) in ${Math.round((result.elapsed_ms || 0) / 1000)}s${truncNote}`,
      ...result,
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
