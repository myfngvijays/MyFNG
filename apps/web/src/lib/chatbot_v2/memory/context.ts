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
    preferredLanguage:
      ctx.preferredLanguage === 'auto' || ctx.preferredLanguage === 'en' || ctx.preferredLanguage === 'hi' || ctx.preferredLanguage === 'hinglish'
        ? ctx.preferredLanguage
        : undefined,
    locationLabel: ctx.locationLabel ? normalize(ctx.locationLabel).slice(0, 80) : undefined,
    addressText: ctx.addressText ? normalize(ctx.addressText).slice(0, 160) : undefined,
    vehicleModel: ctx.vehicleModel ? normalize(ctx.vehicleModel).slice(0, 40) : undefined,
    carModelId: ctx.carModelId ? String(ctx.carModelId).slice(0, 64) : undefined,
    vehicleClass: ctx.vehicleClass ? String(ctx.vehicleClass).slice(0, 24) : undefined,
    vehicleNumber: ctx.vehicleNumber ? String(ctx.vehicleNumber).toUpperCase().replace(/\s+/g, '').slice(0, 16) : undefined,
    customerPhone: ctx.customerPhone ? String(ctx.customerPhone).replace(/\D/g, '').slice(-10) : undefined,
    locationConfirmed: typeof ctx.locationConfirmed === 'boolean' ? ctx.locationConfirmed : undefined,
    pickupPreference: ctx.pickupPreference === 'PICKUP' || ctx.pickupPreference === 'SELF_VISIT' ? ctx.pickupPreference : undefined,
    selectedServiceTypeId: ctx.selectedServiceTypeId ? String(ctx.selectedServiceTypeId).slice(0, 64) : undefined,
    selectedServiceTypeName: ctx.selectedServiceTypeName ? normalize(ctx.selectedServiceTypeName).slice(0, 80) : undefined,
    selectedCategoryUuid: ctx.selectedCategoryUuid ? String(ctx.selectedCategoryUuid).slice(0, 64) : undefined,
    selectedCategoryName: ctx.selectedCategoryName ? normalize(ctx.selectedCategoryName).slice(0, 80) : undefined,
    lastServiceDoneAt: ctx.lastServiceDoneAt ? normalize(ctx.lastServiceDoneAt).slice(0, 40) : undefined,
    flow: ctx.flow === 'BOOKING' || ctx.flow === 'PRICING' || ctx.flow === 'WORKSHOP' ? ctx.flow : undefined,
    greeted: typeof ctx.greeted === 'boolean' ? ctx.greeted : undefined,
    lastKbQuery: ctx.lastKbQuery ? normalize(ctx.lastKbQuery).slice(0, 200) : undefined,
    lastKbAnswerFacts: ctx.lastKbAnswerFacts ? normalize(ctx.lastKbAnswerFacts).slice(0, 1200) : undefined,
    lastKbAt: Number.isFinite(ctx.lastKbAt as number) ? Number(ctx.lastKbAt) : undefined,
    awaitingPaymentLinkConsent: typeof ctx.awaitingPaymentLinkConsent === 'boolean' ? ctx.awaitingPaymentLinkConsent : undefined,
    awaitingCarModelSelection: typeof ctx.awaitingCarModelSelection === 'boolean' ? ctx.awaitingCarModelSelection : undefined,
    awaitingSlotText: typeof ctx.awaitingSlotText === 'boolean' ? ctx.awaitingSlotText : undefined,
    preferredSlotText: ctx.preferredSlotText ? normalize(ctx.preferredSlotText).slice(0, 60) : undefined,
  };
}

export function mergeContext(base: ChatbotV2Context, patch: Partial<ChatbotV2Context>) {
  return normalizeContext({ ...(base || {}), ...(patch || {}) });
}

export function detectMissingInfo(ctx: ChatbotV2Context): MissingInfo {
  const hasModel = Boolean(ctx.vehicleModel && ctx.vehicleModel.length >= 2);
  const lat = Number(ctx.locationLat);
  const lng = Number(ctx.locationLng);
  const hasLocation =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001);
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
  const low = text.toLowerCase();

  // language preference commands
  if (/(hindi|हिंदी).*(baat|बात).*(karo|करो)|mujhse\s+hindi|hindi\s+me\s+baat/i.test(text)) patch.preferredLanguage = 'hi';
  if (/(english).*(baat).*(karo)|mujhse\s+english|english\s+me\s+baat/i.test(text)) patch.preferredLanguage = 'en';
  if (/(hinglish).*(baat).*(karo)|hinglish\s+me/i.test(text)) patch.preferredLanguage = 'hinglish';

  // selected service type from UI (category carousel / buttons)
  // Format: "__select__ SERVICE_TYPE <id>"
  if (/^__select__\s+SERVICE_TYPE\s+/i.test(text.trim())) {
    const parts = text.trim().split(/\s+/);
    const id = parts[2] || parts[3]; // tolerate extra spacing
    if (id) patch.selectedServiceTypeId = String(id).trim();
  }

  // selected category from UI
  // Format: "__select__ CATEGORY <uuid>"
  if (/^__select__\s+CATEGORY\s+/i.test(text.trim())) {
    const parts = text.trim().split(/\s+/);
    const id = parts[2] || parts[3];
    if (id) patch.selectedCategoryUuid = String(id).trim();
  }

  // selected car model from UI
  // Format: "__select__ CAR_MODEL <id>"
  if (/^__select__\s+CAR_MODEL\s+/i.test(text.trim())) {
    const parts = text.trim().split(/\s+/);
    const id = parts[2] || parts[3];
    if (id) patch.carModelId = String(id).trim();
  }

  // last service done (month/year or relative)
  {
    const t = text.trim();
    const isMonthYear =
      /^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s*\d{4}$/i.test(
        t
      ) ||
      /^(0?[1-9]|1[0-2])[\s\/-]\d{4}$/i.test(t) ||
      /^\d{4}$/.test(t) ||
      /^(\d+)\s*(months?|years?)\s*ago$/i.test(t) ||
      /^(\d+)\s*(mahine|saal)\s*(pehle)?$/i.test(t);
    const isPromptedOrExplicit = /(last\s+service|pichli\s+service|last\s+car\s+service|last\s+servicing)/i.test(text) || /(month|year|महिना|साल|months|years)/i.test(text);
    if ((isMonthYear || isPromptedOrExplicit) && t.length >= 3 && t.length <= 40) patch.lastServiceDoneAt = t;
  }

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
    const hasMake = /\b(tata|maruti|suzuki|hyundai|mahindra|honda|toyota|kia|mg|renault|nissan|ford|skoda|volkswagen|vw|bmw|audi|mercedes)\b/.test(
      low
    );
    const looksLikeSentence = /\b(please|price|cost|workshop|address|book|booking|warranty|issue|problem)\b/.test(low);
    if (hasMake && !looksLikeSentence) patch.vehicleModel = carLine;
  }

  // very small city/area capture (conservative) to reduce "car+area" loops
  // NOTE: keep it simple to avoid false positives and keep token cost low.
  const cityAliases: Array<{ re: RegExp; label: string }> = [
    { re: /\b(mumbai|bombay)\b/i, label: 'Mumbai' },
    { re: /\b(thane)\b/i, label: 'Thane' },
    { re: /\b(navi\s*mumbai)\b/i, label: 'Navi Mumbai' },
    { re: /\b(palghar)\b/i, label: 'Palghar' },
    { re: /\b(delhi|dlhi|dilli)\b/i, label: 'Delhi' },
    { re: /\b(noida)\b/i, label: 'Noida' },
    { re: /\b(gurgaon|gurugram)\b/i, label: 'Gurgaon' },
  ];
  for (const c of cityAliases) {
    if (c.re.test(text)) {
      patch.locationLabel = patch.locationLabel || c.label;
      break;
    }
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


