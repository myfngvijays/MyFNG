import type { ChatbotV2Context, MissingInfo } from '../types';

function normalize(text: string) {
  return String(text || '').trim();
}

export function ensureConversationId(ctx: ChatbotV2Context) {
  const existing = String(ctx?.conversationId || '').trim();
  if (existing) return existing;
  const webUuid = (globalThis as any)?.crypto?.randomUUID?.();
  if (typeof webUuid === 'string' && webUuid.length >= 32) return webUuid;
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeContext(ctx: ChatbotV2Context): ChatbotV2Context {
  return {
    ...ctx,
    conversationId: ctx.conversationId ? String(ctx.conversationId) : undefined,
    locationLabel: ctx.locationLabel ? normalize(ctx.locationLabel).slice(0, 80) : undefined,
    addressText: ctx.addressText ? normalize(ctx.addressText).slice(0, 160) : undefined,
    vehicleModel: ctx.vehicleModel ? normalize(ctx.vehicleModel).slice(0, 40) : undefined,
    vehicleNumber: ctx.vehicleNumber ? String(ctx.vehicleNumber).toUpperCase().replace(/\s+/g, '').slice(0, 16) : undefined,
    customerPhone: ctx.customerPhone ? String(ctx.customerPhone).replace(/\D/g, '').slice(-10) : undefined,
    locationConfirmed: typeof ctx.locationConfirmed === 'boolean' ? ctx.locationConfirmed : undefined,
    pickupPreference: ctx.pickupPreference === 'PICKUP' || ctx.pickupPreference === 'SELF_VISIT' ? ctx.pickupPreference : undefined,
    flow: ctx.flow === 'BOOKING' || ctx.flow === 'PRICING' ? ctx.flow : undefined,
  };
}

export function mergeContext(base: ChatbotV2Context, patch: Partial<ChatbotV2Context>) {
  return normalizeContext({ ...(base || {}), ...(patch || {}) });
}

export function detectMissingInfo(ctx: ChatbotV2Context): MissingInfo {
  const hasModel = Boolean(ctx.vehicleModel && ctx.vehicleModel.length >= 2);
  const hasLocation = Number.isFinite(ctx.locationLat as number) && Number.isFinite(ctx.locationLng as number);
  const hasLocationLabel = Boolean(ctx.locationLabel && ctx.locationLabel.length >= 3);
  const hasPickupPref = Boolean(ctx.pickupPreference);
  const hasPhone = Boolean(ctx.customerPhone && String(ctx.customerPhone).replace(/\D/g, '').length === 10);

  return {
    needsVehicleModel: !hasModel,
    // If frontend provided a label, confirm it once (unless already confirmed).
    needsLocationConfirm: Boolean(hasLocationLabel && !ctx.locationConfirmed) || !(hasLocation || hasLocationLabel),
    needsPickupPreference: !hasPickupPref,
    needsPhone: !hasPhone,
  };
}

export function extractContextPatchFromUserText(userText: string): Partial<ChatbotV2Context> {
  const patch: Partial<ChatbotV2Context> = {};
  const text = String(userText || '');

  // phone (India)
  const digits = text.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) patch.customerPhone = last10;
  }

  // vehicle number (best-effort Indian format)
  const m = text
    .toUpperCase()
    .match(/\b([A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4})\b/);
  if (m?.[1]) patch.vehicleNumber = m[1].replace(/\s+/g, '');

  // pickup preference
  if (/(self\s*visit|self\s*drop|khud|walk\s*in)/i.test(text)) patch.pickupPreference = 'SELF_VISIT';
  if (/(pickup|pick\s*up|home\s*pickup|free\s*pickup)/i.test(text)) patch.pickupPreference = 'PICKUP';

  // car model (best-effort): treat short make+model strings as vehicleModel
  const carLine = text.trim();
  if (carLine.length >= 3 && carLine.length <= 40) {
    const low = carLine.toLowerCase();
    const hasMake = /\b(tata|maruti|suzuki|hyundai|mahindra|honda|toyota|kia|mg|renault|nissan|ford|skoda|volkswagen|vw|bmw|audi|mercedes)\b/.test(
      low
    );
    const looksLikeSentence = /\b(please|price|cost|workshop|address|book|booking|warranty|issue|problem)\b/.test(low);
    if (hasMake && !looksLikeSentence) patch.vehicleModel = carLine;
  }

  // location confirmation
  if (/(yes|haan|ha|sahi|correct|ok|okay|bilkul)/i.test(text)) patch.locationConfirmed = true;
  if (/(change|galat|wrong|nahi|nahin|no)/i.test(text)) patch.locationConfirmed = false;

  return patch;
}

export function extractLikelyQuestion(text: string) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 4) return raw;

  // Prefer the last question-like line
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const l = lines[i]!;
    if (/\?/.test(l) || /^(what|why|how|which|where|when|are|is|do|does|can)\b/i.test(l)) return l;
  }
  return lines[lines.length - 1] || raw;
}


