import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { fetchMessageTriggers } from '@/lib/enquiry/assignment';
import { findMatchingMessageTrigger } from '@/lib/enquiry/messageTriggers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OPEN_STATUSES = [
  'NEW',
  'VALIDATED',
  'HOLD',
  'ACCEPTED',
  'IN_PROGRESS',
  'ASSIGNED',
];

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const, userId: user.id };
}

/** Pull matchable WhatsApp / enquiry text from a service lead row. */
function extractLeadMessageCandidates(lead: Record<string, any>): string[] {
  const meta =
    lead.coupon_meta && typeof lead.coupon_meta === 'object'
      ? (lead.coupon_meta as Record<string, unknown>)
      : {};
  const out: string[] = [];
  const push = (v: unknown) => {
    const s = String(v || '').trim();
    if (s && !out.includes(s)) out.push(s);
  };

  push(meta.last_inbound_message);
  push(meta.first_message);
  push(lead.problem_description);

  const description = String(lead.description || '').trim();
  if (description) {
    push(description);
    const msgPart = description.match(/(?:^|·)\s*Msg:\s*(.+)$/i);
    if (msgPart?.[1]) push(msgPart[1]);
    const triggerPart = description.match(/Trigger:\s*([^·]+)/i);
    if (triggerPart?.[1]) push(triggerPart[1]);
  }

  return out;
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin unavailable' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body?.days) || 30, 1), 90);
    const limit = Math.min(Math.max(Number(body?.limit) || 300, 1), 1000);
    const onlyUnassigned = Boolean(body?.only_unassigned);
    const dryRun = Boolean(body?.dry_run);

    const triggers = await fetchMessageTriggers();
    const activeTriggers = triggers.filter((t) => t.is_active);
    if (activeTriggers.length === 0) {
      return NextResponse.json({
        success: true,
        scanned: 0,
        matched: 0,
        assigned: 0,
        reassigned: 0,
        unchanged: 0,
        skipped: 0,
        message: 'No active message triggers configured. Save triggers first.',
        samples: [],
      });
    }

    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    let query = supabaseAdmin
      .from('service_leads')
      .select(
        'id, lead_number, status, customer_phone, customer_name, assigned_telecaller_id, problem_description, description, coupon_meta, lead_source, created_from',
      )
      .in('status', OPEN_STATUSES)
      .gte('created_at', sinceIso)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (onlyUnassigned) {
      query = query.is('assigned_telecaller_id', null);
    }

    const { data: leads, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let matched = 0;
    let assigned = 0;
    let reassigned = 0;
    let unchanged = 0;
    let skipped = 0;
    const samples: Array<Record<string, unknown>> = [];

    for (const lead of leads || []) {
      const candidates = extractLeadMessageCandidates(lead as any);
      if (candidates.length === 0) {
        skipped += 1;
        continue;
      }

      let best: ReturnType<typeof findMatchingMessageTrigger> = null;
      let matchedText = '';
      for (const text of candidates) {
        const hit = findMatchingMessageTrigger(text, activeTriggers);
        if (!hit) continue;
        if (!best || hit.score > best.score) {
          best = hit;
          matchedText = text;
        }
      }

      if (!best) {
        skipped += 1;
        continue;
      }

      matched += 1;
      const prev = lead.assigned_telecaller_id ? String(lead.assigned_telecaller_id) : null;
      const next = String(best.telecaller_id);

      if (prev === next) {
        unchanged += 1;
        if (samples.length < 15) {
          samples.push({
            lead_number: lead.lead_number,
            action: 'unchanged',
            trigger: best.label || best.phrase,
            message: matchedText.slice(0, 120),
          });
        }
        continue;
      }

      if (dryRun) {
        if (prev) reassigned += 1;
        else assigned += 1;
        if (samples.length < 15) {
          samples.push({
            lead_number: lead.lead_number,
            action: prev ? 'would_reassign' : 'would_assign',
            from: prev,
            to: next,
            trigger: best.label || best.phrase,
            message: matchedText.slice(0, 120),
          });
        }
        continue;
      }

      const nowIso = new Date().toISOString();
      const prevMeta =
        lead.coupon_meta && typeof lead.coupon_meta === 'object'
          ? (lead.coupon_meta as Record<string, unknown>)
          : {};

      const patch: Record<string, unknown> = {
        assigned_telecaller_id: next,
        assigned_at: nowIso,
        updated_at: nowIso,
        coupon_meta: {
          ...prevMeta,
          message_trigger_id: best.id,
          message_trigger_label: best.label || best.phrase,
          assignment_mode: 'MESSAGE_TRIGGER',
          applied_by_admin_scan: true,
          applied_at: nowIso,
          ...(prev && prev !== next
            ? { previous_assigned_telecaller_id: prev, reassigned_by_trigger: true }
            : {}),
        },
      };

      if (best.mark_as_meta) {
        patch.created_from = 'WHATSAPP_META';
        patch.lead_source = best.label
          ? `Meta Ads · ${best.label}`
          : 'Meta Ads';
      }

      const { error: upErr } = await supabaseAdmin
        .from('service_leads')
        .update(patch)
        .eq('id', lead.id);

      if (upErr) {
        skipped += 1;
        continue;
      }

      if (prev) reassigned += 1;
      else assigned += 1;

      if (samples.length < 15) {
        samples.push({
          lead_number: lead.lead_number,
          action: prev ? 'reassigned' : 'assigned',
          from: prev,
          to: next,
          trigger: best.label || best.phrase,
          message: matchedText.slice(0, 120),
        });
      }
    }

    return NextResponse.json({
      success: true,
      scanned: (leads || []).length,
      matched,
      assigned,
      reassigned,
      unchanged,
      skipped,
      dry_run: dryRun,
      days,
      triggers: activeTriggers.length,
      samples,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
