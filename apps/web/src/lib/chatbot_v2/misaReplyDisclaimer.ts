import type { MisaBookingChannel } from './misaLeadSource';
import { formatWhatsAppReply } from '@/lib/whatsappBotFlow/formatReply';

export type MisaDisclaimerHint = {
  inboundMessage?: string;
  hasPricing?: boolean;
  hasWorkshops?: boolean;
  hasChecklist?: boolean;
  /** Skip disclaimer (e.g. short system fallback). */
  skip?: boolean;
};

const DISCLAIMER_SNIPPET = 'misa ai can make mistakes';

export function replyAlreadyHasMisaDisclaimer(text: string): boolean {
  return new RegExp(DISCLAIMER_SNIPPET, 'i').test(String(text || ''));
}

/** Pricing, booking, packages, workshops, OTP, RSA, warranty, etc. */
export function misaReplyIsMajorTopic(text: string, hints: MisaDisclaimerHint = {}): boolean {
  if (hints.skip) return false;
  if (hints.hasPricing || hints.hasWorkshops || hints.hasChecklist) return true;

  const body = String(text || '').trim();
  if (!body) return false;

  const trimmed = body.replace(/\s+/g, ' ');
  if (trimmed.length <= 48) {
    if (/^(hi|hello|hey|hii|namaste|ok|okay|thanks|thank you|yes|no|👍)\b/i.test(trimmed)) {
      return false;
    }
  }

  const combined = `${body}\n${hints.inboundMessage || ''}`.toLowerCase();

  const majorPatterns = [
    /₹|rs\.?\s*[\d,]+|inr\s*[\d,]+/,
    /\bpric(e|ing)\b/,
    /\bbook(ing)?\b/,
    /booking\s+summary|confirm.*booking|everything\s+correct/,
    /\bchecklist\b|\bcheck\s*points?\b|\bpoints\b/,
    /\bincluded\b|what'?s\s+included|kya\s+included/,
    /\bwarrant(y|ies)\b/,
    /\bpickup\b|\bdrop\b/,
    /\broadside\b|\brsa\b|\btowing\b|\bbreakdown\b/,
    /\botp\b|\bverif(y|ied|ication)\b/,
    /map\s*link:/i,
    /\bworkshop\b/,
    /semi\s+synthetic|fully\s+synthetic/,
    /\b(basic|general|premium|platinum)\s+service\b/,
    /\b\d+\s*(points|checkpoints)\b/,
    /total\s*price/,
    /91523\s*07030/,
  ];

  return majorPatterns.some((p) => p.test(combined));
}

export function appendMisaDisclaimerForWhatsApp(
  text: string,
  hints: MisaDisclaimerHint = {},
): string {
  const body = String(text || '').trim();
  if (!body || replyAlreadyHasMisaDisclaimer(body) || !misaReplyIsMajorTopic(body, hints)) {
    return body;
  }
  return `${body}\n\n────────\n_Note: MISA AI can make mistakes. For pricing, booking & service details, please confirm with our team at 91523 07030._`;
}

export function appendMisaDisclaimerForWeb(text: string, hints: MisaDisclaimerHint = {}): string {
  const body = String(text || '').trim();
  if (!body || replyAlreadyHasMisaDisclaimer(body) || !misaReplyIsMajorTopic(body, hints)) {
    return body;
  }
  return `${body}\n\n—\nMISA AI can make mistakes. For pricing, booking & service details, please confirm with our team at +91 91523 07030.`;
}

export function finalizeMisaCustomerReply(
  text: string,
  channel: MisaBookingChannel | string | undefined,
  hints: MisaDisclaimerHint = {},
): string {
  const ch = String(channel || 'WEBSITE').toUpperCase();
  if (ch === 'WHATSAPP') {
    return appendMisaDisclaimerForWhatsApp(text, hints);
  }
  return appendMisaDisclaimerForWeb(text, hints);
}

export function formatMisaWhatsAppOutbound(
  text: string,
  hints: MisaDisclaimerHint = {},
  maxLen = 3900,
): string {
  let out = appendMisaDisclaimerForWhatsApp(formatWhatsAppReply(text), hints);
  if (out.length > maxLen) {
    out = `${out.slice(0, maxLen - 3).trim()}...`;
  }
  return out;
}