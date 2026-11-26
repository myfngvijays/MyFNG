/** Which whatsapp_messages rows end the telecaller "Pending" inbox streak (human replied). */

export function isHumanOutboundArchiveSource(source: string | null | undefined): boolean {
  const s = String(source || '').trim().toLowerCase();
  if (!s) return false;
  if (s.startsWith('telecaller_')) return true;
  return false;
}

function rowArchiveSource(row: any): string {
  const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
  return String(meta.source || payload.source || '').trim();
}

/**
 * Bot / MISA / booking-agent rows do not clear Pending.
 * Telecaller pricing + dashboard sends do count as a human reply.
 */
export function isWhatsAppInboxAutoReplyRow(row: any): boolean {
  const direction = String(row?.direction || '').toUpperCase();
  if (direction !== 'INBOUND' && direction !== 'OUTBOUND') return true;
  if (direction === 'INBOUND') return false;

  const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};
  if (meta.human_outbound === true) return false;
  if (meta.actor_id || meta.role_code) return false;

  const source = rowArchiveSource(row);
  if (isHumanOutboundArchiveSource(source)) return false;

  return Boolean(meta.brain_auto_reply || meta.agent_auto_reply);
}

function touchTs(value: unknown): number {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export type WaInboxLeadTouchFields = {
  last_call_at?: string | null;
  updated_at?: string | null;
  total_calls?: number | null;
  coupon_meta?: Record<string, unknown> | null;
};

/** Latest telecaller / CRM touch on the lead (call, save, pricing, disposition history). */
export function leadTelecallerTouchMs(lead: WaInboxLeadTouchFields | null | undefined): number {
  if (!lead) return 0;
  const meta = lead.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
  let profileMax = 0;
  const history = Array.isArray(meta.profile_history) ? meta.profile_history : [];
  for (const row of history) {
    if (!row || typeof row !== 'object') continue;
    profileMax = Math.max(profileMax, touchTs((row as { at?: string }).at));
  }
  const explicit = Math.max(
    touchTs(lead.last_call_at),
    touchTs(meta.last_call_at),
    touchTs(meta.pricing_whatsapp_sent_at),
    touchTs((meta.pricing_share as { sent_at?: string } | undefined)?.sent_at),
    touchTs(meta.priority_booking_acked_at),
    touchTs(meta.last_transfer_at),
    profileMax,
  );
  if (explicit > 0) return Math.max(explicit, touchTs(lead.updated_at));
  if (Number(lead.total_calls || 0) > 0) {
    return Math.max(touchTs(lead.last_call_at), touchTs(meta.last_call_at), touchTs(lead.updated_at));
  }
  const result = String(meta.last_call_result || '').trim().toUpperCase();
  if (result && result !== 'FRESH') {
    return Math.max(touchTs(meta.last_call_at), touchTs(lead.updated_at));
  }
  return 0;
}

/** Lead had call, save, or pricing after the customer's last WhatsApp inbound → not Pending. */
export function crmActivityClearsWaPending(
  lead: WaInboxLeadTouchFields | null | undefined,
  waLastInboundAt: string | null | undefined,
): boolean {
  const inboundMs = touchTs(waLastInboundAt);
  if (inboundMs <= 0) return false;
  const touchMs = leadTelecallerTouchMs(lead);
  return touchMs > inboundMs;
}

export function resolveWhatsAppInboxPending(input: {
  awaitingFromThread?: boolean;
  lead?: WaInboxLeadTouchFields | null;
  waLastInboundAt?: string | null;
}): boolean {
  if (!input.awaitingFromThread) return false;
  if (crmActivityClearsWaPending(input.lead, input.waLastInboundAt)) return false;
  return true;
}