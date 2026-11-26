/** WhatsApp bubble helpers for telecaller pricing_share_link(_btn) outbound messages. */

export const PRICING_SHARE_BTN_TEMPLATE = 'pricing_share_link_btn';
export const PRICING_SHARE_LINK_TEMPLATE = 'pricing_share_link';
export const PRICING_SHARE_BUTTON_LABEL = 'Pricing link';

type MsgLike = {
  template_name?: string | null;
  text_body?: string | null;
  meta?: Record<string, unknown> | null;
};

export function resolvePricingShareTemplateName(m: MsgLike): string {
  const top = String(m.template_name || '').trim().toLowerCase();
  if (top) return top;
  const meta = m.meta && typeof m.meta === 'object' ? m.meta : {};
  return String(meta.template_name || '').trim().toLowerCase();
}

export function isPricingShareButtonMessage(m: MsgLike): boolean {
  const tpl = resolvePricingShareTemplateName(m);
  if (tpl === PRICING_SHARE_BTN_TEMPLATE) return true;
  const meta = m.meta && typeof m.meta === 'object' ? m.meta : {};
  return Boolean(meta.button_slug) && tpl !== PRICING_SHARE_LINK_TEMPLATE;
}

export function stripRawPricingUrlFromBody(text: string): string {
  const lines = String(text || '')
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^https?:\/\//i.test(t)) return false;
      if (/myfng\.in\/(pricing|p)\//i.test(t)) return false;
      return true;
    });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function formatPricingShareBubbleBody(m: MsgLike): string {
  const raw = String(m.text_body || '').trim();
  if (isPricingShareButtonMessage(m)) {
    const stripped = stripRawPricingUrlFromBody(raw);
    if (stripped) return stripped;
  }
  return raw;
}