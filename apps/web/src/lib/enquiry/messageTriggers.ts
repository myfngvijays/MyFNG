/**
 * Meta / WhatsApp prefill message → telecaller routing.
 * Example: "Hi! I am interested in service!" → Campaign A → Telecaller X
 */

export type MessageTriggerMatch = 'exact' | 'contains' | 'starts_with';

export type MessageTrigger = {
  id: string;
  /** Campaign / tracking label shown in admin */
  label: string;
  /** Prefill message text from Meta ad */
  phrase: string;
  match: MessageTriggerMatch;
  telecaller_id: string;
  /** When matched, treat lead as Meta Ads (WHATSAPP_META) even without referral payload */
  mark_as_meta: boolean;
  /** Exact lead_source to save. Blank is treated as Meta Ads. */
  lead_source: string;
  /** Extra crm_lead_tags id. Blank still tags the campaign label itself. */
  lead_tag_id: string;
  is_active: boolean;
};

export const TRIGGER_LEAD_SOURCE_OPTIONS = [
  'Google Ads',
  'Instagram Ads',
  'Meta Ads',
  'WhatsApp',
  'WhatsApp Enquiry',
  'Website',
  'App Booking',
  'Incoming Sarv Call',
  'Reference',
  'Partner',
  'Other',
] as const;

/** Chosen source wins. Blank Meta triggers save as "Meta Ads" — the campaign name is the lead tag. */
export function resolvedTriggerLeadSource(
  trigger: Pick<MessageTrigger, 'lead_source' | 'mark_as_meta' | 'label'>,
  fallback: string,
): string {
  const custom = String(trigger.lead_source || '').trim();
  if (custom) return custom;
  if (trigger.mark_as_meta) return 'Meta Ads';
  return fallback;
}

export function normalizeTriggerPhrase(raw: string): string {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function newTriggerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeMessageTriggers(raw: unknown): MessageTrigger[] {
  if (!Array.isArray(raw)) return [];
  const out: MessageTrigger[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const phrase = String(r.phrase || '').trim();
    const telecallerId = String(r.telecaller_id || '').trim();
    if (!phrase || !telecallerId) continue;
    const matchRaw = String(r.match || 'exact').toLowerCase();
    const match: MessageTriggerMatch =
      matchRaw === 'contains' || matchRaw === 'starts_with' ? matchRaw : 'exact';
    out.push({
      id: String(r.id || newTriggerId()),
      label: String(r.label || '').trim() || phrase.slice(0, 40),
      phrase,
      match,
      telecaller_id: telecallerId,
      mark_as_meta: r.mark_as_meta !== false,
      lead_source: String(r.lead_source || 'Meta Ads').trim().slice(0, 80) || 'Meta Ads',
      lead_tag_id:
        String(r.lead_tag_id || '').trim() === '__campaign_label__'
          ? ''
          : String(r.lead_tag_id || '').trim(),
      is_active: r.is_active !== false,
    });
  }
  return out;
}

export function messageMatchesTrigger(messageText: string, trigger: MessageTrigger): boolean {
  if (!trigger.is_active) return false;
  const msg = normalizeTriggerPhrase(messageText);
  const phrase = normalizeTriggerPhrase(trigger.phrase);
  if (!msg || !phrase) return false;
  if (trigger.match === 'exact') return msg === phrase;
  if (trigger.match === 'starts_with') return msg.startsWith(phrase);
  return msg.includes(phrase);
}

export type MatchedMessageTrigger = MessageTrigger & { score: number };

/** Prefer longer / more specific phrases when multiple match. */
export function findMatchingMessageTrigger(
  messageText: string | null | undefined,
  triggers: MessageTrigger[],
): MatchedMessageTrigger | null {
  const msg = String(messageText || '').trim();
  if (!msg || triggers.length === 0) return null;

  let best: MatchedMessageTrigger | null = null;
  for (const t of triggers) {
    if (!messageMatchesTrigger(msg, t)) continue;
    const score =
      normalizeTriggerPhrase(t.phrase).length +
      (t.match === 'exact' ? 1000 : t.match === 'starts_with' ? 500 : 0);
    if (!best || score > best.score) {
      best = { ...t, score };
    }
  }
  return best;
}
