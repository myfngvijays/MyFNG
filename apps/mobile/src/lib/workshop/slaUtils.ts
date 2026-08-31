const TERMINAL = new Set(['COMPLETED', 'CLOSED', 'CANCELLED', 'REJECTED', 'DELIVERED']);

/** Default workshop SLA window when no explicit deadline on the lead. */
const DEFAULT_SLA_HOURS = 24;

export function computeSlaRemainingMinutes(lead: {
  sla_expires_at?: string | null;
  sla_deadline?: string | null;
  created_at?: string | null;
}) {
  const raw = lead.sla_expires_at || lead.sla_deadline;
  let deadlineMs: number;
  if (raw) {
    deadlineMs = new Date(raw).getTime();
  } else if (lead.created_at) {
    deadlineMs = new Date(lead.created_at).getTime() + DEFAULT_SLA_HOURS * 60 * 60 * 1000;
  } else {
    return null;
  }
  return Math.floor((deadlineMs - Date.now()) / (1000 * 60));
}

/** Overdue = past SLA while job is still open and mechanic work has started or been assigned. */
export function isWorkshopJobOverdue(lead: {
  sla_expires_at?: string | null;
  sla_deadline?: string | null;
  created_at?: string | null;
  assigned_mechanic_id?: string | null;
  status?: string | null;
}) {
  const remaining = computeSlaRemainingMinutes(lead);
  if (remaining == null || remaining >= 0) return false;
  const status = String(lead.status || '').toUpperCase();
  if (TERMINAL.has(status)) return false;
  if (!lead.assigned_mechanic_id) return false;
  return true;
}
