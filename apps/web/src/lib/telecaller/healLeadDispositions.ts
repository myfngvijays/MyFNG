/**
 * Heal service_leads status / coupon_meta from disposition stored in
 * coupon_meta, profile_history, or telecaller_call_logs.
 * Mutates `rows` in place and persists patches.
 */

import {
  DISPOSITION_LABEL,
  DISPOSITION_TO_LEAD_STATUS,
  parseCallDisposition,
} from '@/lib/telecaller/callDisposition';

const EARLY_STATUSES = new Set(['NEW', 'CONTACTED', 'INCOMPLETE', 'PENDING', 'ASSIGNED', 'VALIDATED']);

function latestDispositionFromMeta(meta: any): {
  result: string;
  label: string;
  lostReason: string | null;
} | null {
  const fromResult = String(meta?.last_call_result || '').toUpperCase();
  if (fromResult && fromResult !== 'RINGING') {
    const label =
      String(meta?.last_call_label || '').trim() ||
      DISPOSITION_LABEL[fromResult] ||
      fromResult;
    return {
      result: fromResult,
      label,
      lostReason: meta?.last_lost_reason ? String(meta.last_lost_reason) : null,
    };
  }

  const fromLabel = String(meta?.last_call_label || '').trim();
  if (fromLabel) {
    const disp = parseCallDisposition({ notes: `[${fromLabel}]` });
    if (disp && disp.result !== 'RINGING') {
      return {
        result: disp.result,
        label: disp.label,
        lostReason: disp.lostReason || (meta?.last_lost_reason ? String(meta.last_lost_reason) : null),
      };
    }
  }

  const hist = Array.isArray(meta?.profile_history) ? meta.profile_history : [];
  for (const entry of hist) {
    const s = String(entry?.status || '').toUpperCase();
    if (s && s !== 'RINGING' && DISPOSITION_LABEL[s]) {
      return {
        result: s,
        label:
          s === 'LOST' && entry?.remark
            ? `Lost · ${entry.remark}`
            : DISPOSITION_LABEL[s],
        lostReason: s === 'LOST' ? String(entry?.remark || meta?.last_lost_reason || '') || null : null,
      };
    }
    // summary like "Call: Lost · Not Interested" / "Updated Lost"
    const summary = String(entry?.summary || '');
    const fromSummary = parseCallDisposition({
      notes: summary.includes('[') ? summary : `[${summary.replace(/^Call:\s*/i, '').replace(/^Updated\s+/i, '')}]`,
    });
    if (fromSummary && fromSummary.result !== 'RINGING') {
      return {
        result: fromSummary.result,
        label: fromSummary.label,
        lostReason: fromSummary.lostReason,
      };
    }
  }

  return null;
}

function applyDispositionToRow(
  row: any,
  disp: { result: string; label: string; lostReason: string | null },
  callStatus?: string | null,
): Record<string, unknown> | null {
  const meta = row?.coupon_meta && typeof row.coupon_meta === 'object' ? { ...row.coupon_meta } : {};
  const current = String(row?.status || '').toUpperCase();
  const nextPipeline = DISPOSITION_TO_LEAD_STATUS[disp.result] || null;

  const already =
    String(meta.last_call_result || '').toUpperCase() === disp.result &&
    String(meta.last_call_label || '').trim() &&
    (!nextPipeline || current === nextPipeline);
  if (already) return null;

  const nextMeta = {
    ...meta,
    last_call_result: disp.result,
    last_call_label: disp.label,
    last_call_status: callStatus || meta.last_call_status || 'ANSWERED',
    last_call_at: meta.last_call_at || new Date().toISOString(),
    ...(disp.lostReason ? { last_lost_reason: disp.lostReason } : {}),
  };

  const patch: Record<string, unknown> = {
    coupon_meta: nextMeta,
    updated_at: new Date().toISOString(),
  };

  if (nextPipeline && current !== nextPipeline && EARLY_STATUSES.has(current)) {
    patch.status = nextPipeline;
    row.status = nextPipeline;
  }

  row.coupon_meta = nextMeta;
  return patch;
}

/**
 * Heal dispositions for a page of leads. Uses coupon_meta first, then call logs.
 */
export async function healLeadDispositions(db: any, rows: any[]): Promise<void> {
  if (!rows?.length) return;

  const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];

  for (const row of rows) {
    const meta = row?.coupon_meta && typeof row.coupon_meta === 'object' ? row.coupon_meta : {};
    const fromMeta = latestDispositionFromMeta(meta);
    if (!fromMeta) continue;
    const patch = applyDispositionToRow(row, fromMeta);
    if (patch) patches.push({ id: row.id, patch });
  }

  // Leads still showing as bare NEW with no disposition → inspect call logs
  const needLogs = rows.filter((row) => {
    const meta = row?.coupon_meta && typeof row.coupon_meta === 'object' ? row.coupon_meta : {};
    const has = Boolean(meta.last_call_result || meta.last_call_label);
    const status = String(row?.status || '').toUpperCase();
    return !has && ['NEW', 'CONTACTED', 'INCOMPLETE', 'PENDING', 'ASSIGNED'].includes(status);
  });

  if (needLogs.length > 0) {
    const ids = needLogs.map((r) => r.id).filter(Boolean);
    const [{ data: logs, error }, { data: followUps }] = await Promise.all([
      db
        .from('telecaller_call_logs')
        .select('lead_id, notes, outcome, call_status, created_at')
        .in('lead_id', ids)
        .order('created_at', { ascending: false })
        .limit(Math.min(ids.length * 5, 500)),
      db
        .from('telecaller_follow_ups')
        .select('lead_id, reason, created_at')
        .in('lead_id', ids)
        .order('created_at', { ascending: false })
        .limit(Math.min(ids.length * 3, 300)),
    ]);

    if (error) {
      console.warn('[healLeadDispositions] call logs fetch failed:', error.message);
    }

    const latestByLead = new Map<string, { disp: any; callStatus?: string | null; logCount: number }>();
    for (const log of logs || []) {
      const lid = String(log.lead_id || '');
      if (!lid || latestByLead.has(lid)) continue;
      const disp = parseCallDisposition({
        notes: log.notes,
        outcome: log.outcome,
        call_status: log.call_status,
      });
      if (!disp || disp.result === 'RINGING') continue;
      // Prefer notes-tagged dispositions; skip bare INFO_COLLECTED→INTERESTED noise
      const tag = String(log.notes || '').match(/^\[([^\]]+)\]/);
      const outcome = String(log.outcome || '').toUpperCase();
      if (!tag && outcome === 'INFO_COLLECTED' && !/^lost\b/i.test(String(log.notes || ''))) {
        continue;
      }
      latestByLead.set(lid, { disp, callStatus: log.call_status, logCount: 0 });
    }

    // Count logs per lead for total_calls heal
    const logCounts = new Map<string, number>();
    for (const log of logs || []) {
      const lid = String(log.lead_id || '');
      logCounts.set(lid, (logCounts.get(lid) || 0) + 1);
    }

    // Follow-up reason sometimes carries "[Lost · …]" when call meta was missing
    for (const fu of followUps || []) {
      const lid = String(fu.lead_id || '');
      if (!lid || latestByLead.has(lid)) continue;
      const disp = parseCallDisposition({ notes: fu.reason });
      if (!disp || disp.result === 'RINGING') continue;
      latestByLead.set(lid, { disp, callStatus: 'ANSWERED', logCount: 0 });
    }

    for (const row of needLogs) {
      const hit = latestByLead.get(String(row.id));
      if (!hit) continue;
      const patch = applyDispositionToRow(row, hit.disp, hit.callStatus);
      if (patch) {
        const total = Number(row.total_calls || 0);
        const logCount = logCounts.get(String(row.id)) || 0;
        if (logCount > total) {
          patch.total_calls = logCount;
          row.total_calls = logCount;
        }
        patches.push({ id: row.id, patch });
      }
    }
  }

  if (!patches.length) return;

  await Promise.allSettled(
    patches.map(({ id, patch }) =>
      db.from('service_leads').update(patch).eq('id', id),
    ),
  );
}
