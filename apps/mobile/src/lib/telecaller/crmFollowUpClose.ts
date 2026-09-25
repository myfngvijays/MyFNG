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

export function crmLeadClosedForFollowUp(lead: {
  status?: string | null;
  coupon_meta?: { last_call_result?: string | null } | null;
} | null | undefined): boolean {
  const st = String(lead?.status || '').toUpperCase();
  if ((CRM_FOLLOWUP_CLOSED_STATUSES as readonly string[]).includes(st)) return true;
  const result = String(lead?.coupon_meta?.last_call_result || '').toUpperCase();
  return (CRM_FOLLOWUP_CLOSED_RESULTS as readonly string[]).includes(result);
}

export async function closeLeadFollowUps(
  db: { from: (table: string) => any },
  leadId: string,
  opts?: { completedBy?: string | null; note?: string | null },
) {
  const now = new Date().toISOString();
  const note = String(opts?.note || 'Auto-closed — lead is In Service / Service Done / Lost').slice(0, 240);
  await db
    .from('service_leads')
    .update({
      follow_up_required: false,
      next_follow_up_at: null,
      updated_at: now,
    })
    .eq('id', leadId);
  await db
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
}
