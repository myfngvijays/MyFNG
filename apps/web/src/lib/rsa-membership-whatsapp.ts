export {
  DEFAULT_WEB_CTA_WHATSAPP_MESSAGE,
  DEFAULT_WEB_CTA_WHATSAPP_PHONE,
  applyWebCtaTemplate,
  normalizeWhatsappPhone,
} from '@/lib/membership-web-cta';

import { applyWebCtaTemplate, DEFAULT_WEB_CTA_WHATSAPP_PHONE, normalizeWhatsappPhone } from '@/lib/membership-web-cta';

/** @deprecated Use resolveMembershipWebCta(plan, totalPay) instead */
export const RSA_MEMBERSHIP_WHATSAPP = DEFAULT_WEB_CTA_WHATSAPP_PHONE;

/** @deprecated Use plan.webCtaWhatsappMessage from admin */
export function rsaMembershipWhatsappMessage(planName: string) {
  return applyWebCtaTemplate('Hi I am interested in RSA Membership {plan_name} Plan', {
    planName: String(planName || 'RSA').trim(),
    price: 0,
    priceInr: '₹0',
  });
}

/** @deprecated Use resolveMembershipWebCta(plan, totalPay) instead */
export function rsaMembershipWhatsappUrl(planName: string, phone = DEFAULT_WEB_CTA_WHATSAPP_PHONE) {
  const msg = encodeURIComponent(rsaMembershipWhatsappMessage(planName));
  return `https://wa.me/${normalizeWhatsappPhone(phone)}?text=${msg}`;
}
