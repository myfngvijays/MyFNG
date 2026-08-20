import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getEnabledSystemAlertWhatsAppNumbers } from '@/lib/services/systemAlertWhatsAppNumbers';
import { sendTelecallerLeadsShiftReportMessage } from '@/lib/services/telecallerLeadsShiftSummaryTemplate';

/** Office shift: yesterday 7:00 PM IST → today 7:00 PM IST (exclusive end). */
export const TELECALLER_LEADS_SHIFT_HOUR_IST = 19;

function partsInIst(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
  };
}

/** Convert IST wall-clock to UTC Date. */
function istWallToUtc(y: number, m: number, d: number, hour: number, minute = 0): Date {
  // Asia/Kolkata is always UTC+05:30 (no DST)
  const utcMs = Date.UTC(y, m - 1, d, hour, minute, 0, 0) - (5 * 60 + 30) * 60 * 1000;
  return new Date(utcMs);
}

function addIstDays(y: number, m: number, d: number, delta: number) {
  const utc = istWallToUtc(y, m, d, 12, 0);
  utc.setUTCDate(utc.getUTCDate() + delta);
  const p = partsInIst(utc);
  return { year: p.year, month: p.month, day: p.day };
}

/**
 * Shift ending at the most recent 7pm IST boundary (or "now" if force mid-shift preview).
 * When cron runs at ~7pm IST, window = previous 7pm → this 7pm.
 */
export function getTelecallerLeadsShiftBounds(now = new Date()): {
  startUtc: Date;
  endUtc: Date;
  startLabel: string;
  endLabel: string;
  shiftKey: string;
} {
  const p = partsInIst(now);
  let endY = p.year;
  let endM = p.month;
  let endD = p.day;

  // If before today's 7pm IST, the open shift still ends today 7pm — for cron at 7pm we use today 7pm.
  // If after 7pm, current shift already closed at today's 7pm (next shift started).
  // Cron at 19:00 should use end = today 19:00.
  if (p.hour < TELECALLER_LEADS_SHIFT_HOUR_IST) {
    // Mid-shift (e.g. 3pm): report previous closed shift ending yesterday 7pm? Or current open?
    // For forced preview mid-day, show current open window: yesterday 7pm → today 7pm (partial).
    // Keep end as today 7pm (future end of open shift) for labeling; count until now when mid-shift.
  }

  const endUtc = istWallToUtc(endY, endM, endD, TELECALLER_LEADS_SHIFT_HOUR_IST, 0);
  const startDay = addIstDays(endY, endM, endD, -1);
  const startUtc = istWallToUtc(
    startDay.year,
    startDay.month,
    startDay.day,
    TELECALLER_LEADS_SHIFT_HOUR_IST,
    0,
  );

  const labelFmt = (dt: Date) =>
    dt.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

  const shiftKey = `${startDay.year}-${String(startDay.month).padStart(2, '0')}-${String(startDay.day).padStart(2, '0')}_to_${endY}-${String(endM).padStart(2, '0')}-${String(endD).padStart(2, '0')}`;

  return {
    startUtc,
    endUtc,
    startLabel: labelFmt(startUtc),
    endLabel: labelFmt(endUtc),
    shiftKey,
  };
}

export type TelecallerLeadShiftRow = {
  telecaller_id: string | null;
  name: string;
  leads: number;
};

export type TelecallerLeadsShiftSummary = {
  shiftKey: string;
  startIso: string;
  endIso: string;
  startLabel: string;
  endLabel: string;
  rows: TelecallerLeadShiftRow[];
  totalAssigned: number;
  unassigned: number;
  textMessage: string;
};

function istHourNow(now = new Date()): number {
  return partsInIst(now).hour;
}

export async function buildTelecallerLeadsShiftSummary(
  now = new Date(),
  opts?: { countUntilNow?: boolean },
): Promise<TelecallerLeadsShiftSummary | { error: string }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { error: 'Admin client unavailable' };

  const bounds = getTelecallerLeadsShiftBounds(now);
  const startIso = bounds.startUtc.toISOString();
  // Mid-shift force run: count only up to now (not future end).
  const endCutoff =
    opts?.countUntilNow && now.getTime() < bounds.endUtc.getTime() ? now : bounds.endUtc;
  const endIso = endCutoff.toISOString();

  const { data: roleRow } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('role_code', 'TELECALLER')
    .maybeSingle();

  if (!roleRow?.id) return { error: 'TELECALLER role not found' };

  let activeTcs: any[] = [];
  const { data: telecallers, error: tcErr } = await supabaseAdmin
    .from('users_login')
    .select('id, full_name, phone, is_active')
    .eq('role_id', roleRow.id)
    .order('full_name', { ascending: true });

  if (tcErr && /is_active/i.test(String(tcErr.message || ''))) {
    const retry = await supabaseAdmin
      .from('users_login')
      .select('id, full_name, phone')
      .eq('role_id', roleRow.id)
      .order('full_name', { ascending: true });
    if (retry.error) return { error: retry.error.message || 'Failed to load telecallers' };
    activeTcs = retry.data || [];
  } else if (tcErr) {
    return { error: tcErr.message || 'Failed to load telecallers' };
  } else {
    activeTcs = (telecallers || []).filter((t: any) => t.is_active !== false);
  }
  const countById = new Map<string, number>();
  for (const tc of activeTcs) countById.set(String(tc.id), 0);

  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  const { data: assignedRows, error: assignedErr } = await supabaseAdmin
    .from('service_leads')
    .select('id, assigned_telecaller_id, assigned_at, created_at')
    .not('assigned_telecaller_id', 'is', null)
    .gte('assigned_at', startIso)
    .lt('assigned_at', endIso);

  let leads: any[] = [];
  if (assignedErr && /assigned_at/i.test(String(assignedErr.message || ''))) {
    // Older schema without assigned_at — fall back to created_at
    const retry = await supabaseAdmin
      .from('service_leads')
      .select('id, assigned_telecaller_id, created_at')
      .not('assigned_telecaller_id', 'is', null)
      .gte('created_at', startIso)
      .lt('created_at', endIso);
    if (retry.error) return { error: retry.error.message || 'Failed to load leads' };
    leads = retry.data || [];
  } else if (assignedErr) {
    return { error: assignedErr.message || 'Failed to load leads' };
  } else {
    leads = assignedRows || [];
    // Also count rows assigned in window but assigned_at null (use created_at)
    const { data: nullAssignedAt } = await supabaseAdmin
      .from('service_leads')
      .select('id, assigned_telecaller_id, assigned_at, created_at')
      .not('assigned_telecaller_id', 'is', null)
      .is('assigned_at', null)
      .gte('created_at', startIso)
      .lt('created_at', endIso);
    if (nullAssignedAt?.length) leads = [...leads, ...nullAssignedAt];
  }

  let unassigned = 0;
  const unassignedRes = await supabaseAdmin
    .from('service_leads')
    .select('id', { count: 'exact', head: true })
    .is('assigned_telecaller_id', null)
    .gte('created_at', startIso)
    .lt('created_at', endIso);
  unassigned = Number(unassignedRes.count || 0);

  for (const row of leads) {
    const tid = row.assigned_telecaller_id ? String(row.assigned_telecaller_id) : '';
    if (!tid) continue;
    const ts = new Date(row.assigned_at || row.created_at || 0).getTime();
    if (!Number.isFinite(ts) || ts < startMs || ts >= endMs) continue;
    countById.set(tid, (countById.get(tid) || 0) + 1);
  }

  const nameById = new Map<string, string>();
  for (const tc of activeTcs) {
    nameById.set(String(tc.id), String(tc.full_name || tc.phone || 'Telecaller').trim() || 'Telecaller');
  }

  const rows: TelecallerLeadShiftRow[] = [...countById.entries()]
    .map(([telecaller_id, leadsCount]) => ({
      telecaller_id,
      name: nameById.get(telecaller_id) || `TC ${telecaller_id.slice(0, 8)}`,
      leads: leadsCount,
    }))
    .sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name));

  const totalAssigned = rows.reduce((s, r) => s + r.leads, 0);
  const lines = [
    '*MyFNG Telecaller Leads*',
    `Shift: ${bounds.startLabel} → ${bounds.endLabel} IST`,
    '',
    ...rows.map((r) => `${r.name} - ${r.leads}`),
  ];
  if (unassigned > 0) {
    lines.push(`Unassigned - ${unassigned}`);
  }

  return {
    shiftKey: bounds.shiftKey,
    startIso,
    endIso,
    startLabel: bounds.startLabel,
    endLabel: bounds.endLabel,
    rows,
    totalAssigned,
    unassigned,
    textMessage: lines.join('\n'),
  };
}

export async function runTelecallerLeadsShiftSummaryJob(force = false) {
  const now = new Date();
  const hour = istHourNow(now);

  // Fire around 7pm IST (allow 19–20 hour window for cron drift)
  if (!force && hour !== TELECALLER_LEADS_SHIFT_HOUR_IST && hour !== TELECALLER_LEADS_SHIFT_HOUR_IST + 1) {
    return {
      sent: 0,
      skipped: true,
      reason: 'outside_7pm_ist_window',
      istHour: hour,
    };
  }

  const recipients = await getEnabledSystemAlertWhatsAppNumbers();
  if (recipients.length === 0) {
    return { sent: 0, error: 'No enabled system alert WhatsApp numbers' };
  }

  const summary = await buildTelecallerLeadsShiftSummary(now, {
    countUntilNow: force && hour !== TELECALLER_LEADS_SHIFT_HOUR_IST,
  });
  if ('error' in summary) {
    return { sent: 0, error: summary.error };
  }

  let sent = 0;
  let viaTemplate = 0;
  let viaText = 0;
  const errors: string[] = [];
  for (const phone of recipients) {
    const result = await sendTelecallerLeadsShiftReportMessage(phone, summary);
    if (result.success) {
      sent += 1;
      if (result.via === 'template') viaTemplate += 1;
      else viaText += 1;
    } else {
      errors.push(`${phone}: ${result.error || 'send failed'}`);
    }
  }

  return {
    sent,
    viaTemplate,
    viaText,
    recipients: recipients.length,
    shiftKey: summary.shiftKey,
    startLabel: summary.startLabel,
    endLabel: summary.endLabel,
    totalAssigned: summary.totalAssigned,
    unassigned: summary.unassigned,
    rows: summary.rows,
    templateName: 'telecaller_leads_shift_report',
    errors: errors.length ? errors : undefined,
  };
}
