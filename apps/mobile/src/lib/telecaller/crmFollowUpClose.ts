/** Pipeline / CRM statuses that should not stay on the Follow-up list. */
export const CRM_FOLLOWUP_CLOSED_STATUSES = [
  'IN_PROGRESS',
  'COMPLETED',
  'READY_FOR_DELIVERY',
  'DELIVERED',
  'CLOSED',
  'CANCELLED',
  'REJECTED',
] as const;

export const CRM_FOLLOWUP_CLOSED_RESULTS = ['IN_SERVICE', 'SERVICE_DONE', 'LOST'] as const;

function closedLabel(raw: string) {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, ' ');
  if (!s) return false;
  if (s.includes('IN SERVICE')) return true;
  if (s.includes('SERVICE DONE')) return true;
  if (s.startsWith('LOST')) return true;
  if (s === 'COMPLETED') return true;
  return false;
}

export function crmLeadClosedForFollowUp(lead: {
  status?: string | null;
  coupon_meta?: { last_call_result?: string | null; last_call_label?: string | null } | null;
} | null | undefined): boolean {
  if (!lead) return false;
  const st = String(lead.status || '').toUpperCase();
  if ((CRM_FOLLOWUP_CLOSED_STATUSES as readonly string[]).includes(st)) return true;
  const meta = lead.coupon_meta || {};
  const result = String(meta.last_call_result || '').toUpperCase();
  if ((CRM_FOLLOWUP_CLOSED_RESULTS as readonly string[]).includes(result)) return true;
  if (closedLabel(result) || closedLabel(String(meta.last_call_label || ''))) return true;
  return false;
}

export async function closeLeadFollowUps(
  db: { from: (table: string) => any },
  leadId: string,
  opts?: { completedBy?: string | null; note?: string | null },
) {
  if (!leadId) return;
  const now = new Date().toISOString();
  const note = String(opts?.note || 'Auto-closed — lead is In Service / Service Done / Lost').slice(0, 240);

  const leadRes = await db
    .from('service_leads')
    .update({
      follow_up_required: false,
      next_follow_up_at: null,
      updated_at: now,
    })
    .eq('id', leadId);
  if (leadRes?.error) {
    await db.from('service_leads').update({ follow_up_required: false, updated_at: now }).eq('id', leadId);
  }

  const full = await db
    .from('telecaller_follow_ups')
    .update({
      status: 'COMPLETED',
      completed_at: now,
      completed_by: opts?.completedBy || null,
      completion_notes: note,
      updated_at: now,
    })
    .eq('lead_id', leadId)
    .eq('status', 'PENDING');
  if (full?.error) {
    await db
      .from('telecaller_follow_ups')
      .update({ status: 'COMPLETED', completed_at: now, updated_at: now })
      .eq('lead_id', leadId)
      .eq('status', 'PENDING');
  }
}
