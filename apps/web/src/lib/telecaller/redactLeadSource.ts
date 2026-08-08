/**
 * Telecallers must not see marketing / booking attribution
 * (Meta Ads, website, app, UTM, CTWA referral, etc.).
 */

/** Pull customer text from packed inbound descriptions like:
 * `WhatsApp (9167779696) · Trigger: D · Msg: I'm looking for...`
 */
export function extractInboundCustomerMessage(raw: string | null | undefined): string {
  const text = String(raw || '').trim();
  if (!text) return '';

  const msgMatch = text.match(/(?:^|[·|])\s*Msg:\s*(.+)$/i);
  if (msgMatch?.[1]) return msgMatch[1].trim();

  let cleaned = text
    .replace(/^WhatsApp\s*\([^)]*\)\s*[·|]?\s*/i, '')
    .replace(/^WhatsApp\s+inbound\s*[·|]?\s*/i, '')
    .replace(/^Meta\s+[^\n·|]*\s*[·|]?\s*/i, '')
    .replace(/Ad:\s*[^·|]+\s*[·|]?\s*/gi, '')
    .replace(/Trigger:\s*[^·|]+\s*[·|]?\s*/gi, '')
    .replace(/^Msg:\s*/i, '')
    .replace(/^[·|\s]+/, '')
    .trim();

  // Drop leftover attribution-only leftovers
  if (/^(whatsapp|meta|trigger|ad)\b/i.test(cleaned) && cleaned.length < 48) {
    return '';
  }
  return cleaned;
}

const SOURCE_KEYS = [
  'created_from',
  'lead_source',
  'lead_source_other_note',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'source',
  'source_note',
] as const;

const COUPON_META_SOURCE_KEYS = [
  'meta_referral',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'tracking',
  'ad_id',
  'adset_id',
  'campaign_id',
  'ctwa_clid',
] as const;

export function redactCouponMetaForTelecaller(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const next = { ...(meta as Record<string, unknown>) };
  for (const key of COUPON_META_SOURCE_KEYS) {
    delete next[key];
  }
  return next;
}

export function redactLeadSourceForTelecaller<T extends Record<string, any>>(lead: T): T {
  const next: Record<string, any> = { ...lead };
  for (const key of SOURCE_KEYS) {
    if (key in next) next[key] = null;
  }
  if ('coupon_meta' in next) {
    const meta = redactCouponMetaForTelecaller(next.coupon_meta);
    if (meta) {
      for (const key of ['first_message', 'last_inbound_message', 'inbound_message'] as const) {
        if (key in meta) {
          meta[key] = extractInboundCustomerMessage(meta[key] as string) || null;
        }
      }
    }
    next.coupon_meta = meta;
  }
  if ('meta' in next && next.meta && typeof next.meta === 'object' && !Array.isArray(next.meta)) {
    const meta = { ...(next.meta as Record<string, unknown>) };
    for (const key of [
      ...SOURCE_KEYS,
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'tracking',
      'meta_referral',
    ]) {
      delete meta[key];
    }
    next.meta = meta;
  }
  if ('is_whatsapp_lead' in next) {
    // Keep only if derived from inbound WhatsApp flag after redaction — force false from source strings
    const inbound = Boolean(next.coupon_meta?.whatsapp_inbound);
    next.is_whatsapp_lead = inbound;
  }

  // Strip WhatsApp / Trigger / Meta wrappers from telecaller-visible text fields
  const cleanProblem = extractInboundCustomerMessage(next.problem_description);
  const cleanDescription = extractInboundCustomerMessage(next.description);
  const customerMessage = cleanProblem || cleanDescription || String(next.problem_description || '').trim();
  if ('problem_description' in next || customerMessage) {
    next.problem_description = customerMessage || null;
  }
  if ('description' in next) {
    // Never expose packed "WhatsApp · Trigger · Msg" blob to telecallers
    next.description = customerMessage || null;
  }
  if ('message_preview' in next) {
    next.message_preview =
      extractInboundCustomerMessage(next.message_preview) || customerMessage || null;
  }

  return next as T;
}

export function redactLeadSourceListForTelecaller<T extends Record<string, any>>(rows: T[]): T[] {
  return (rows || []).map((row) => redactLeadSourceForTelecaller(row));
}
