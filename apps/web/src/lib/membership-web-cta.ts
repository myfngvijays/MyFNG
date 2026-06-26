import type { PublicMembershipPlan } from '@/lib/public-membership-plan';

export type WebCtaAction = 'whatsapp' | 'cart' | 'link';

export type WebCtaVars = {
  planName: string;
  price: number;
  priceInr: string;
};

export type ResolvedWebCta =
  | { kind: 'link'; href: string; label: string; external?: boolean }
  | { kind: 'cart'; label: string };

export function formatInr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export function normalizeWhatsappPhone(raw: string) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '919167779696';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function applyWebCtaTemplate(template: string, vars: WebCtaVars) {
  return String(template || '')
    .replace(/\{plan_name\}/gi, vars.planName)
    .replace(/\{price_inr\}/gi, vars.priceInr)
    .replace(/\{price\}/gi, vars.priceInr);
}

export function resolveMembershipWebCta(plan: PublicMembershipPlan, totalPay: number): ResolvedWebCta {
  const vars: WebCtaVars = {
    planName: String(plan.name || '').trim() || 'RSA',
    price: totalPay,
    priceInr: formatInr(totalPay),
  };
  const label = applyWebCtaTemplate(plan.webCtaLabel || 'Add to Cart — {price} →', vars);
  const action = (plan.webCtaAction || 'whatsapp') as WebCtaAction;

  if (action === 'cart') {
    return { kind: 'cart', label };
  }

  if (action === 'link') {
    const href = String(plan.webCtaUrl || '').trim() || '#';
    return { kind: 'link', href, label, external: /^https?:\/\//i.test(href) };
  }

  const phone = normalizeWhatsappPhone(plan.webCtaWhatsappPhone || '919167779696');
  const message = applyWebCtaTemplate(
    plan.webCtaWhatsappMessage || 'Hi I am interested in RSA Membership {plan_name} Plan',
    vars,
  );
  return {
    kind: 'link',
    href: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
    label,
    external: true,
  };
}

export const DEFAULT_WEB_CTA_LABEL = 'Add to Cart — {price} →';
export const DEFAULT_WEB_CTA_WHATSAPP_PHONE = '919167779696';
export const DEFAULT_WEB_CTA_WHATSAPP_MESSAGE = 'Hi I am interested in RSA Membership {plan_name} Plan';
