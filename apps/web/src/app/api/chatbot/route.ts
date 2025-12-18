import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectIntent } from './intentDetector';
import { resolveServices, getServiceCategory } from './serviceResolver';
import { resolvePriceRanges } from './pricingResolver';
import { BookingValidationError, triggerBooking } from './bookingTrigger';
import { REPLY_COMPOSER_SYSTEM_PROMPT } from './prompt';
import type {
  ChatbotMessageRequest,
  ChatbotResponse,
  ChatbotContext,
  ServiceSuggestion,
  SuggestedOption,
} from './types';

export const dynamic = 'force-dynamic';

function newConversationId() {
  // Node 18+ has crypto.randomUUID
  return globalThis.crypto?.randomUUID?.() || `conv_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalize(text: string) {
  return (text || '').toLowerCase().trim();
}

type ReplyLanguageHint = 'en' | 'hi_latn' | 'hi_deva' | 'mr_deva' | 'gu_gujr' | 'mixed' | 'unknown';

function detectReplyLanguageHint(text: string): ReplyLanguageHint {
  const t = text || '';
  // Script-based detection
  if (/[\u0A80-\u0AFF]/.test(t)) return 'gu_gujr'; // Gujarati
  if (/[\u0900-\u097F]/.test(t)) {
    // Devanagari (Hindi/Marathi)
    if (/(आहे|नाही|काय|कसा|कशी|माझा|माझी|तुमचा|तुमची)/.test(t)) return 'mr_deva';
    return 'hi_deva';
  }

  // Latin-script: look for Hinglish/Marathi/Gujarati common tokens
  const low = t.toLowerCase();
  const hasEnglish = /[a-z]/.test(low);
  const hasHinglish = /\b(kya|kyu|kaise|kitna|karna|karao|chahiye|batao|pahle|pehle|pickup|workshop|gadi|gaadi)\b/.test(low);
  const hasMarathiLatn = /\b(kay|kasa|kashe|ahe|nahi|tumhi|mala|majha|majhi)\b/.test(low);
  const hasGujaratiLatn = /\b(shu|kem|chhe|nathi|tame|mane|mara|mari)\b/.test(low);

  const flags = [hasHinglish, hasMarathiLatn, hasGujaratiLatn].filter(Boolean).length;
  if (flags >= 2) return 'mixed';
  if (hasGujaratiLatn) return 'gu_gujr';
  if (hasMarathiLatn) return 'mr_deva';
  if (hasHinglish) return 'hi_latn';
  if (hasEnglish) return 'en';
  return 'unknown';
}

function isGreeting(text: string) {
  const t = normalize(text);
  return /^(hi|hello|hey|hii|hlo|namaste|hola)\b/.test(t);
}

function isOnlySmallTalk(text: string) {
  const t = normalize(text);
  if (!t) return true;
  if (isGreeting(t)) return t.length <= 12;
  return /^(ok|okay|thanks|thank you|thx|cool|nice)\b/.test(t) && t.length <= 16;
}

function extractPhoneFromText(text: string): string | null {
  const digits = (text || '').replace(/\D/g, '');
  // prefer last 10 digits (India)
  if (digits.length >= 10) return digits.slice(-10);
  return null;
}

function extractVehicleNumberFromText(text: string): string | null {
  // Rough Indian vehicle regex (best-effort)
  const m = (text || '')
    .toUpperCase()
    .match(/\b([A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,2}\s?\d{3,4})\b/);
  if (!m) return null;
  return m[1].replace(/\s+/g, '');
}

function extractNameFromText(text: string): string | null {
  const t = (text || '').trim();
  const m = t.match(/\b(?:my name is|i am|i'm|main|mera naam)\s+([A-Za-z][A-Za-z\s]{1,30})/i);
  if (m?.[1]) return m[1].trim().replace(/\s+/g, ' ').slice(0, 32);
  return null;
}

function extractPickupPreference(text: string): boolean | null {
  const t = normalize(text);
  if (/(pickup|pick up|home pickup|pick-up|doorstep)/i.test(t)) return true;
  if (/(self|i will come|i'll come|drop off|visit workshop|workshop aunga|main aunga)/i.test(t)) return false;
  return null;
}

function extractLatLngFromMapLink(mapLink?: string | null): { lat: number; lng: number } | null {
  if (!mapLink) return null;
  try {
    const raw = decodeURIComponent(mapLink);
    const at = raw.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (at) {
      const lat = Number(at[1]);
      const lng = Number(at[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    const qp = raw.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (qp) {
      const lat = Number(qp[1]);
      const lng = Number(qp[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    const center = raw.match(/[?&]center=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (center) {
      const lat = Number(center[1]);
      const lng = Number(center[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  } catch {
    // ignore
  }
  return null;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

async function getNearestWorkshops(supabase: any, lat: number, lng: number) {
  const { data } = await supabase
    .from('workshops')
    .select('id,name,latitude,longitude,map_link,is_verified')
    .eq('is_verified', true)
    .limit(500);

  type Row = {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    map_link: string | null;
  };

  const rows = (data as unknown as Row[]) ?? [];
  const user = { lat, lng };

  const scored: Array<{ id: string; name: string; km: number }> = [];
  for (const w of rows) {
    let wLat = w.latitude;
    let wLng = w.longitude;
    if (typeof wLat !== 'number' || typeof wLng !== 'number' || !Number.isFinite(wLat) || !Number.isFinite(wLng)) {
      const fromLink = extractLatLngFromMapLink(w.map_link);
      if (fromLink) {
        wLat = fromLink.lat;
        wLng = fromLink.lng;
      }
    }
    if (typeof wLat !== 'number' || typeof wLng !== 'number' || !Number.isFinite(wLat) || !Number.isFinite(wLng)) continue;
    const km = haversineKm(user, { lat: wLat, lng: wLng });
    if (!Number.isFinite(km)) continue;
    scored.push({ id: w.id, name: w.name, km: Math.max(0, km) });
  }

  scored.sort((a, b) => a.km - b.km);
  return scored.slice(0, 3);
}

async function inferCityZoneFromAddress(supabase: any, addressText?: string | null) {
  const raw = (addressText || '').trim();
  if (!raw) return null as null | { cityId: string; cityName: string; zoneId: string | null };

  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(-4);

  const tokens: string[] = [];
  for (const p of parts) {
    const cleaned = p.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length >= 3) tokens.push(cleaned);
  }

  const words = raw
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3)
    .sort((a, b) => b.length - a.length)
    .slice(0, 6);
  tokens.push(...words);

  const seen = new Set<string>();
  const uniq = tokens.filter((t) => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  for (const token of uniq) {
    const { data } = await supabase
      .from('cities')
      .select('id, name, zone_id, is_active')
      .eq('is_active', true)
      .ilike('name', `%${token}%`)
      .limit(1);
    const row = (data || [])[0] as any;
    if (row?.id && row?.name) {
      return { cityId: row.id as string, cityName: row.name as string, zoneId: (row.zone_id as string) || null };
    }
  }

  return null;
}

async function searchCarModelsForAutocomplete(supabase: any, query: string): Promise<Array<{ id: string; make: string; model: string; variant?: string; vehicleClass?: string }>> {
  if (query.length < 2) return [];
  try {
    console.log(`[searchCarModels] Searching for: "${query}"`);

    const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = q.split(' ').filter(Boolean);
    const makePart = parts[0] || q;
    const modelPart = parts.slice(1).join(' ').trim();

    // Strategy:
    // - If user typed "tata tigor", search make ~ tata AND model_name ~ tigor
    // - If single token "tata", search in make OR model_name
    // - Fallback: OR across tokens in both columns

    const run = async (useActiveFilter: boolean) => {
      let base = supabase.from('car_models').select('id, make, model_name, variant, class').order('make').order('model_name').limit(8);
      if (useActiveFilter) base = base.eq('is_active', true);

      if (parts.length >= 2 && makePart.length >= 2 && modelPart.length >= 2) {
        // AND match (best for "tata tigor")
        return await base.ilike('make', `%${makePart}%`).ilike('model_name', `%${modelPart}%`);
      }

      if (parts.length === 1) {
        // OR match single token
        return await base.or(`make.ilike.%${q}%,model_name.ilike.%${q}%`);
      }

      // fallback OR across all tokens and columns
      const orBits = parts.flatMap((tkn) => [`make.ilike.%${tkn}%`, `model_name.ilike.%${tkn}%`]).join(',');
      return await base.or(orBits);
    };

    let { data, error } = await run(true);
    console.log(`[searchCarModels] Active filter result:`, { error, count: data?.length || 0, makePart, modelPart });

    if (error) {
      console.error('[searchCarModels] Database error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('[searchCarModels] No results with is_active. Trying without filter...');
      const res2 = await run(false);
      data = res2.data;
      error = res2.error;
      console.log(`[searchCarModels] Without filter result:`, { error, count: data?.length || 0 });
      if (error) return [];
    }

    const rows = (data || []) as any[];
    return rows.map((c: any) => ({
      id: c.id,
      make: c.make,
      model: c.model_name,
      variant: c.variant || undefined,
      vehicleClass: c.class || undefined,
    }));
  } catch (e) {
    console.error('[searchCarModels] Exception:', e);
    return [];
  }
}

async function inferCarModelFromText(supabase: any, vehicleText?: string | null) {
  const raw = (vehicleText || '').trim();
  if (!raw) return null as null | { modelId: string; make: string; model: string; variant?: string | null; vehicleClass?: string | null };

  const t = raw.toLowerCase();
  const makeGuess = t.split(/\s+/)[0] || '';
  const modelGuess = t.split(/\s+/).slice(1).join(' ').trim() || t;

  let q = supabase
    .from('car_models')
    .select('id, make, model_name, variant, class, is_active')
    .eq('is_active', true)
    .limit(5);

  if (makeGuess.length >= 3) q = q.ilike('make', `%${makeGuess}%`);
  if (modelGuess.length >= 3) q = q.ilike('model_name', `%${modelGuess}%`);

  let { data } = await q;

  if (!data || data.length === 0) {
    const res = await supabase
      .from('car_models')
      .select('id, make, model_name, variant, class, is_active')
      .eq('is_active', true)
      .ilike('model_name', `%${modelGuess}%`)
      .limit(5);
    data = res.data || [];
  }

  const rows = (data || []) as any[];
  if (rows.length === 0) return null;

  rows.sort((a, b) => `${a.make} ${a.model_name}`.toLowerCase().localeCompare(`${b.make} ${b.model_name}`.toLowerCase()));
  const best = rows[0];

  return {
    modelId: best.id,
    make: best.make,
    model: best.model_name,
    variant: best.variant || null,
    vehicleClass: best.class || null,
  };
}

function isWorkshopQuery(text: string) {
  const t = normalize(text);
  return /(near( me)?\s*workshop|nearest\s*workshop|workshop\s*near|close(st)?\s*workshop|nearby\s*workshop|near workshop|nearest garage)/i.test(
    t
  );
}

function extractLanguagePreference(text: string): 'en' | 'hi' | 'mr' | 'gu' | null {
  const raw = text || '';
  const t = raw.toLowerCase();
  // English phrases (common typos included)
  if (/(reply|answer|tell|speak)\s+(me\s+)?(in)\s+guj(arati|rati|jrati)\b/.test(t)) return 'gu';
  if (/(reply|answer|tell|speak)\s+(me\s+)?(in)\s+marathi\b/.test(t)) return 'mr';
  if (/(reply|answer|tell|speak)\s+(me\s+)?(in)\s+hindi\b/.test(t)) return 'hi';
  if (/(reply|answer|tell|speak)\s+(me\s+)?(in)\s+english\b/.test(t)) return 'en';

  // Indic script keywords
  // Allow single-word commands like "gujrati", "gujarati'" etc.
  if (/^\s*(gujarati|gujrati)[^a-z]*\s*$/i.test(raw)) return 'gu';
  if (/^\s*(marathi)[^a-z]*\s*$/i.test(raw)) return 'mr';
  if (/^\s*(hindi)[^a-z]*\s*$/i.test(raw)) return 'hi';
  if (/^\s*(english)[^a-z]*\s*$/i.test(raw)) return 'en';

  if (/ગુજરાતી/.test(raw) || /\b(gujarati|gujrati)\b/.test(t)) {
    if (/\b(me|mein|ma)\b/.test(t) || /ગુજરાતી/.test(raw)) return 'gu';
  }
  if (/मराठी/.test(raw) || /\bmarathi\b/.test(t)) {
    if (/\b(me|mein|ma)\b/.test(t) || /मराठी/.test(raw)) return 'mr';
  }
  if (/हिंदी/.test(raw) || /\bhindi\b/.test(t)) {
    if (/\b(me|mein|ma)\b/.test(t) || /हिंदी/.test(raw)) return 'hi';
  }

  return null;
}

async function composeReply(params: {
  userMessage: string;
  context: ChatbotContext;
  stage?: string;
  deterministicFacts: any;
  fallback: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!apiKey) return params.fallback;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: REPLY_COMPOSER_SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              userMessage: params.userMessage,
              replyLanguageHint: detectReplyLanguageHint(params.userMessage),
              preferredLanguage: params.context.preferredLanguage || 'auto',
              stage: params.stage || params.context.conversationStage || 'UNKNOWN',
              knownContext: {
                customerName: params.context.customerName || null,
                customerPhone: params.context.customerPhone ? 'provided' : null,
                pickupRequired: typeof params.context.pickupRequired === 'boolean' ? params.context.pickupRequired : null,
                addressText: params.context.addressText ? 'provided' : null,
                workshopName: params.context.workshopName || null,
                vehicleNumber: params.context.vehicleNumber ? 'provided' : null,
                vehicleModel: params.context.vehicleModel || null,
              },
              deterministicFacts: params.deterministicFacts,
              fallback: params.fallback,
            }),
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('OpenAI reply composer failed:', res.status, res.statusText, errText);
      return params.fallback;
    }
    const json = (await res.json()) as any;
    const content = json?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') return params.fallback;
    return content.trim() || params.fallback;
  } catch {
    return params.fallback;
  }
}

function looksLikeConfirm(text: string) {
  const t = normalize(text);
  return (
    /^yes\b|^y\b|^haan\b|^ha\b|^ok\b|^okay\b|^confirm\b|^book\b|^proceed\b|^kar do\b|^kardo\b/.test(t) ||
    t.includes('book it') ||
    t.includes('go ahead') ||
    t.includes('proceed')
  );
}

function pickChoiceIndex(text: string) {
  const t = normalize(text);
  // Accept "1", "option 2", "#3"
  const m = t.match(/(?:option\s*)?#?(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n - 1;
}

function renderOptions(options: SuggestedOption[]) {
  const lines: string[] = [];
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const price = opt.priceRange?.label ? ` (${opt.priceRange.label})` : '';
    lines.push(`• Option ${i + 1}: ${opt.suggestion.name}${price}`);
  }
  return lines.join('\n');
}

function safetyEmergencyMessage() {
  return [
    "Ye emergency lag rahi hai (accident/fire/injury).",
    'Please call emergency services immediately (112/108) and move to a safe place if possible.',
    'Main yahan booking attempt nahi karunga.',
  ].join('\n');
}

function safetyComplaintMessage() {
  return [
    'Samajh gaya — aapko complaint/issue hai.',
    'Main abhi isko human support team ko escalate kar raha hoon.',
    'Please apna registered mobile number + lead/booking ID share kar dijiye (agar available ho).',
  ].join('\n');
}

async function bestEffortLog(supabase: any, payload: { conversationId: string; context: ChatbotContext; userText: string; botText: string; meta: any }) {
  // Logging is optional (tables may or may not exist). We do best-effort.
  try {
    await supabase.from('chatbot_conversations').upsert({
      id: payload.conversationId,
      customer_phone: payload.context.customerPhone || null,
      customer_name: payload.context.customerName || null,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // ignore
  }

  try {
    await supabase.from('chatbot_messages').insert([
      {
        conversation_id: payload.conversationId,
        role: 'user',
        message_text: payload.userText,
        created_at: new Date().toISOString(),
        metadata: payload.meta || null,
      },
      {
        conversation_id: payload.conversationId,
        role: 'assistant',
        message_text: payload.botText,
        created_at: new Date().toISOString(),
        metadata: payload.meta || null,
      },
    ]);
  } catch {
    // ignore
  }
}

function buildResponseText(params: {
  why?: string;
  options: SuggestedOption[];
  intentLabel?: string;
  needs: string[];
  selectedOptionName?: string;
}) {
  const out: string[] = [];

  if (params.why) {
    out.push(`Jo aapne bataya uske basis par, ${params.why}`);
    out.push('');
  }

  if (params.options.length > 0) {
    out.push('Recommended options (approx price range):');
    out.push(renderOptions(params.options));
    out.push('');
    out.push('Final cost vehicle model + inspection par depend karega.');
  }

  if (params.needs.length > 0) {
    // Ask only the most necessary follow-up first (avoid long checklist).
    const first = params.needs[0];
    out.push(`Ek chhota sa sawal: ${first}?`);
  }

  if (params.options.length > 0) {
    if (params.selectedOptionName) {
      out.push('');
      out.push(`Selected: ${params.selectedOptionName}`);
    }
    out.push('');
    out.push('Aap chahein to main booking create kar doon. (Reply: “Yes, book option 1”)');
  }

  return out.join('\n');
}

function extractPaymentMethodFromText(
  text: string,
  opts?: { allowOptionNumber?: boolean }
): 'UPI' | 'CARD' | 'CASH' | 'PAY_LATER' | null {
  const t = normalize(text);
  if (!t) return null;

  // Option numbers
  if (opts?.allowOptionNumber) {
    const m = t.match(/\b([1-4])\b/);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (n === 1) return 'UPI';
      if (n === 2) return 'CARD';
      if (n === 3) return 'CASH';
      if (n === 4) return 'PAY_LATER';
    }
  }

  if (/(upi|gpay|google pay|phonepe|paytm|online)/i.test(text)) return 'UPI';
  if (/(card|credit|debit|visa|master)/i.test(text)) return 'CARD';
  if (/(cash|cod|pay cash)/i.test(text)) return 'CASH';
  if (/(pay later|later|workshop me|at workshop)/i.test(text)) return 'PAY_LATER';
  return null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ChatbotMessageRequest | null;
  if (!body?.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const supabase = await createClient();

  const context: ChatbotContext = body.context || {};
  const conversationId = context.conversationId || newConversationId();

  // Detect intent + safety
  const intent = await detectIntent(body.message);

  // Best-effort: extract structured fields from free text so UI doesn't need forms.
  // (Still deterministic, no workflow bypass.)
  const hadPhone = Boolean(context.customerPhone);
  const extractedPhone = extractPhoneFromText(body.message);
  const capturedPhoneThisTurn = Boolean(extractedPhone) && !hadPhone;
  if (extractedPhone && !hadPhone) context.customerPhone = extractedPhone;

  const extractedName = extractNameFromText(body.message);
  if (extractedName && !context.customerName) context.customerName = extractedName;

  const extractedVehicle = extractVehicleNumberFromText(body.message);
  if (extractedVehicle && !context.vehicleNumber) context.vehicleNumber = extractedVehicle;

  const pickupPref = extractPickupPreference(body.message);
  if (pickupPref !== null && typeof context.pickupRequired !== 'boolean') context.pickupRequired = pickupPref;

  // Capture payment method if user is selecting it (chips or text).
  const extractedPayment = extractPaymentMethodFromText(body.message, { allowOptionNumber: context.conversationStage === 'NEED_PAYMENT' });
  if (extractedPayment && !context.paymentMethod) context.paymentMethod = extractedPayment;

  // If intent detector extracted a locationText, keep it as addressText.
  const locText = intent.extracted?.locationText;
  if (locText && !context.addressText) context.addressText = locText;

  // Explicit language preference should be handled immediately (even before funnel gating).
  const langPref = extractLanguagePreference(body.message);
  if (langPref) {
    context.preferredLanguage = langPref;
    const fallback =
      langPref === 'gu'
        ? 'ઠીક છે — હવે હું ગુજરાતીમાં જવાબ આપીસ.'
        : langPref === 'mr'
          ? 'ठीक आहे — आता मी मराठीत उत्तर देईन.'
          : langPref === 'hi'
            ? 'Theek hai — ab main Hindi me reply karunga.'
            : 'Sure — I will reply in English.';

    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'LANGUAGE_PREFERENCE_SET',
      deterministicFacts: { preferredLanguage: langPref },
      fallback,
    });

    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { conversationId, preferredLanguage: langPref },
    };
    await bestEffortLog(supabase, {
      conversationId,
      context,
      userText: body.message,
      botText: assistantMessage,
      meta: { intent, preferredLanguage: langPref },
    });
    return NextResponse.json(resp);
  }

  // Stage-aware capture
  if (!context.customerName) {
    const raw = (body.message || '').trim();
    if (/^[A-Za-z][A-Za-z\s]{1,30}$/.test(raw)) {
      context.customerName = raw.replace(/\s+/g, ' ').slice(0, 32);
    }
  }

  if (context.conversationStage === 'NEED_LOCATION' && !context.addressText) {
    const raw = (body.message || '').trim();
    if (raw.length >= 4 && !/^(pickup|self|ok|okay|yes|no)$/i.test(raw)) {
      context.addressText = raw.slice(0, 160);
    }
  }

  if (context.conversationStage === 'NEED_CAR_MODEL') {
    const choiceIdx = pickChoiceIndex(body.message);
    // Only set if user selected an option number from suggestions
    if (choiceIdx !== null && context.carModelSuggestions && context.carModelSuggestions[choiceIdx]) {
      const selected = context.carModelSuggestions[choiceIdx];
      context.modelId = selected.id;
      context.vehicleMake = selected.make;
      context.vehicleModel = `${selected.make} ${selected.model}`;
      context.vehicleVariant = selected.variant || undefined;
      context.vehicleClass = (selected as any).vehicleClass || undefined;
    }
    // If user is typing (not selecting), DON'T set vehicleModel yet - let autocomplete step handle it
  }

  // Capture service category selection (book-service style tabs)
  const categoryText = (body.message || '').trim().toUpperCase();
  const KNOWN_CATEGORIES = new Set([
    'PERIODIC SERVICE',
    'AC SERVICE',
    'BATTERY SERVICE',
    'BRAKE SERVICE',
    'CLUTCH SERVICE',
    'DENTING PAINTING',
    'TYRE & WHEEL CARE',
    'DETAILING SERVICE',
    'ENGINE SERVICE',
    'OTHER SERVICES',
  ]);
  if (KNOWN_CATEGORIES.has(categoryText)) {
    context.serviceCategory = categoryText;
    // Nudge issue text for resolver without polluting with generic "service" token
    if (!context.problemDescription) context.problemDescription = categoryText;
  }

  if (intent.flags.includes('EMERGENCY')) {
    const assistantMessage = safetyEmergencyMessage();
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { conversationId },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
    return NextResponse.json(resp);
  }

  if (intent.flags.includes('COMPLAINT')) {
    const assistantMessage = safetyComplaintMessage();
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { conversationId },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
    return NextResponse.json(resp);
  }

  // STATUS intent (read-only guidance)
  if (intent.intent === 'STATUS') {
    const assistantMessage =
      'Booking status check karne ke liye please apna Lead Number (example: L-12345678) share kar dijiye.';
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { conversationId },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
    return NextResponse.json(resp);
  }

  // Read-only: nearest workshop query should be answered even before phone verification.
  if (isWorkshopQuery(body.message)) {
    const hasCoords = Number.isFinite(context.locationLat as number) && Number.isFinite(context.locationLng as number);
    if (!hasCoords) {
      const fallback = 'Nearest workshop batane ke liye aap apna area/city share kar dijiye (ya location allow kar dijiye).';
      const assistantMessage = await composeReply({
        userMessage: body.message,
        context,
        stage: 'READONLY_WORKSHOP_QUERY',
        deterministicFacts: { need: 'location', note: 'cannot compute nearest without coords' },
        fallback,
      });
      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        contextPatch: { conversationId, conversationStage: context.conversationStage || 'NEED_PHONE' },
      };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
      return NextResponse.json(resp);
    }

    const nearest = await getNearestWorkshops(supabase, context.locationLat as number, context.locationLng as number);
    // If computed nearest is unrealistically far, treat location as missing/incorrect and ask again.
    if (nearest[0] && nearest[0].km > 200) {
      const fallback =
        'Mujhe aapki location clear nahi mil rahi (workshops bahut door show ho rahe hain). Aap apna area/city+pincode share kar dijiye ya location allow kar dijiye.';
      const assistantMessage = await composeReply({
        userMessage: body.message,
        context,
        stage: 'READONLY_WORKSHOP_QUERY',
        deterministicFacts: { need: 'better_location', note: 'nearest_too_far_km', km: Number(nearest[0].km.toFixed(1)) },
        fallback,
      });
      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        contextPatch: { conversationId, conversationStage: context.conversationStage || 'NEED_PHONE' },
      };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
      return NextResponse.json(resp);
    }
    const list = nearest.map((w, i) => ({ index: i + 1, name: w.name, km: Number(w.km.toFixed(1)) }));
    const fallback =
      nearest.length > 0
        ? ['Nearest workshops:', ...nearest.map((w, i) => `• Workshop ${i + 1}: ${w.name} (${w.km.toFixed(1)} km)`)].join('\n')
        : 'Is location ke aas-paas verified workshops nahi mil rahe.';

    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'READONLY_WORKSHOP_QUERY',
      deterministicFacts: { nearest: list },
      fallback,
    });

    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { conversationId, conversationStage: context.conversationStage || 'NEED_PHONE' },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, nearest: list } });
    return NextResponse.json(resp);
  }

  // ============================================
  // NEW 6-STEP FUNNEL (matches book-service page)
  // Order: Location → Car Model → Phone → Issue → Pickup → Payment
  // ============================================

  // Friendly greeting/small talk: respond naturally
  if (isOnlySmallTalk(body.message)) {
    const fallback =
      'Hi! Aapko kis cheez me help chahiye — RSA (roadside) ya car service? Aap 1–2 lines me problem bata dijiye.';
    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'SMALLTALK',
      deterministicFacts: { ask: 'problem_or_rsa' },
      fallback,
    });
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { conversationId, preferredLanguage: context.preferredLanguage || 'auto', conversationStage: 'INITIAL' },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
    return NextResponse.json(resp);
  }

  // STEP 1: LOCATION (usually pre-detected from browser, skip if available)
  // We skip this step as location is auto-detected on frontend
  
  // STEP 2: CAR MODEL (with autocomplete suggestions)
  if (!context.modelId) {
    // Try to extract car model query from user message
    const carQuery = body.message.trim();
    let carSuggestions: any[] = [];
    
    // Always provide autocomplete if user is typing a car name
    if (carQuery.length >= 2 && !/^(yes|no|ok|haan|nahi|ha|service|rsa)\b/i.test(carQuery)) {
      carSuggestions = await searchCarModelsForAutocomplete(supabase, carQuery);
      console.log(`[CHATBOT] Car search for "${carQuery}":`, carSuggestions.length, 'results');
    }

    // If user typed a full car name and we found exactly one strong match, auto-select and continue to phone.
    if (carSuggestions.length === 1 && /\s/.test(carQuery)) {
      const only = carSuggestions[0];
      context.modelId = only.id;
      context.vehicleMake = only.make;
      context.vehicleModel = `${only.make} ${only.model}${only.variant ? ` ${only.variant}` : ''}`.trim();
      context.vehicleVariant = only.variant || undefined;
      context.vehicleClass = (only as any).vehicleClass || undefined;
    }

    // If auto-selected, skip returning suggestions and go to phone step.
    if (context.modelId) {
      // continue
    } else {
    // UI now shows suggestions as chips above the input, so keep message short (no numbered list).
    const fallback = carSuggestions.length > 0
      ? 'Aapki car model? Neeche chips se select karein ya type karein — type karte hi suggestions aa jayenge.'
      : 'Aapki car model? (Example: Tata Tigor, Maruti Swift, Hyundai i20)\n\nType karein — suggestions chips me aa jayenge.';
    
    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'NEED_CAR_MODEL',
      deterministicFacts: { 
        ask: 'car_model',
        suggestions: carSuggestions.map((c, i) => ({
          index: i + 1,
          make: c.make,
          model: c.model,
          variant: c.variant || null,
        })),
        hint: 'Type your car name for autocomplete suggestions',
      },
      fallback,
    });
    
    const contextPatch: Partial<ChatbotContext> = { 
      conversationId, 
      conversationStage: 'NEED_CAR_MODEL', 
      carModelSuggestions: carSuggestions.length > 0 ? carSuggestions : undefined,
    };
    
    console.log('[CHATBOT] Returning car model suggestions:', contextPatch);
    
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch,
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, carSuggestions } });
    return NextResponse.json(resp);
    }
  }

  // STEP 3: MOBILE NUMBER (10 digits)
  if (!context.customerPhone) {
      const fallback = 'Ab booking ke liye aapka 10-digit mobile number chahiye. Please mobile number bhej dijiye.';
      const assistantMessage = await composeReply({
        userMessage: body.message,
        context,
        stage: 'NEED_PHONE',
        deterministicFacts: { ask: 'phone_number' },
        fallback,
      });
      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        contextPatch: { 
          conversationId, 
          conversationStage: 'NEED_PHONE',
          modelId: context.modelId,
          vehicleMake: context.vehicleMake,
          vehicleModel: context.vehicleModel,
        },
      };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
      return NextResponse.json(resp);
  }

  // If we captured phone in this message and user only sent the number, move to issue step
  if (capturedPhoneThisTurn) {
    const remainder = (body.message || '').replace(/[0-9\s()+-]/g, ' ').replace(/\s+/g, ' ').trim();
    const hasMeaningfulText = remainder.length >= 3 && /[a-zA-Z\u0900-\u097F\u0A80-\u0AFF]/.test(remainder);

    // If message included both phone + some text, treat text as issue description.
    if (!context.problemDescription && hasMeaningfulText) {
      context.problemDescription = remainder;
    }

    if (!context.problemDescription && !hasMeaningfulText) {
      const fallback = 'Thanks! Ab aapki car me kya issue hai? (Example: AC cooling kam, brake noise, denting/painting, general service)';
      const assistantMessage = await composeReply({
        userMessage: body.message,
        context,
        stage: 'NEED_ISSUE',
        deterministicFacts: {
          ask: 'car_issue',
          examples: ['AC cooling kam', 'Brake noise', 'Denting/Painting', 'General service', 'Battery issue', 'Tyre puncture'],
        },
        fallback,
      });
      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        contextPatch: {
          conversationId,
          conversationStage: 'NEED_ISSUE',
          customerPhone: context.customerPhone,
          modelId: context.modelId,
          vehicleMake: context.vehicleMake,
          vehicleModel: context.vehicleModel,
        },
      };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, capturedPhone: true } });
      return NextResponse.json(resp);
    }
  }

  // Requirement text is optional; if user already described issue/service, keep it
  if (!context.problemDescription) {
    const t = normalize(body.message);
    if (/(service|servicing|repair|issue|problem|ac|brake|battery|puncture|noise|vibration|rsa|roadside|stuck)/i.test(t)) {
      context.problemDescription = body.message;
    }
  }
  // If user switches topic with a strong keyword (e.g. denting/ac/brake), update the problemDescription.
  if (/(denting|painting|dent|scratch|body|bumper|panel|ac|brake|battery|puncture|alignment|balancing|suspension|steering|clutch|gear)/i.test(body.message)) {
    context.problemDescription = body.message;
  }

  // STEP 5: PICKUP PREFERENCE (after service plan is selected)
  if (context.selectedServiceTypeIds?.length && typeof context.pickupRequired !== 'boolean') {
    const fallback = 'Pickup chahiye ya aap workshop pe khud aayenge?\n\n1. Pickup Required\n2. Self Visit\n\nOption select karein.';
    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'NEED_PICKUP_PREF',
      deterministicFacts: {
        ask: 'pickup_preference',
        options: [
          { value: true, label: 'Pickup Required' },
          { value: false, label: 'Self Visit' },
        ],
      },
      fallback,
    });
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: {
        conversationId,
        conversationStage: 'NEED_PICKUP_PREF',
        selectedServiceTypeIds: context.selectedServiceTypeIds,
        selectedPackageId: context.selectedPackageId,
      },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'pickup_pref' } });
    return NextResponse.json(resp);
  }

  // STEP 6: PAYMENT METHOD (after pickup preference)
  if (context.selectedServiceTypeIds?.length && typeof context.pickupRequired === 'boolean' && !context.paymentMethod) {
    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'NEED_PAYMENT',
      deterministicFacts: {
        ask: 'payment_method',
        options: [
          { value: 'UPI', label: 'UPI/Online Payment' },
          { value: 'CARD', label: 'Credit/Debit Card' },
          { value: 'CASH', label: 'Cash on Service' },
          { value: 'PAY_LATER', label: 'Pay Later at Workshop' },
        ],
      },
      fallback: 'Payment method kaunsa prefer karenge?\n\n1. UPI/Online\n2. Credit/Debit Card\n3. Cash on Service\n4. Pay Later at Workshop\n\nOption number select karein.',
    });
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: {
        conversationId,
        conversationStage: 'NEED_PAYMENT',
        selectedServiceTypeIds: context.selectedServiceTypeIds,
        selectedPackageId: context.selectedPackageId,
        pickupRequired: context.pickupRequired,
      },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'payment' } });
    return NextResponse.json(resp);
  }

  // Resolve services deterministically (no LLM)
  // Important: include the latest user text so requests like “aur kuch service” / “aur koi plan” work.
  const resolverMessage = [context.problemDescription, body.message].filter(Boolean).join(' | ');
  const serviceResult = await resolveServices(supabase, { message: resolverMessage, intent: intent.intent, context });
  const suggestions = serviceResult.suggestions;

  // Resolve price ranges (read-only)
  // Improve pricing context using real DB: car model class + city zone + nearest workshop pricing (if coords available).
  const inferredCar = !context.modelId && context.vehicleModel ? await inferCarModelFromText(supabase, context.vehicleModel) : null;
  if (inferredCar) {
    context.modelId = context.modelId || inferredCar.modelId;
    context.vehicleMake = context.vehicleMake || inferredCar.make;
    context.vehicleModel = context.vehicleModel || inferredCar.model;
    context.vehicleVariant = context.vehicleVariant || inferredCar.variant || null;
    context.vehicleClass = context.vehicleClass || inferredCar.vehicleClass || null;
  }

  const inferredCity = !context.cityId && context.addressText ? await inferCityZoneFromAddress(supabase, context.addressText) : null;
  if (inferredCity) {
    context.cityId = context.cityId || inferredCity.cityId;
    context.cityName = context.cityName || inferredCity.cityName;
    context.zoneId = context.zoneId || inferredCity.zoneId;
  }

  // Pick a pricing workshop: chosen workshop OR nearest workshop (for localized ranges).
  let pricingWorkshopId: string | null = context.workshopId || null;
  let pricingWorkshopName: string | null = context.workshopName || null;
  const hasCoords = Number.isFinite(context.locationLat as number) && Number.isFinite(context.locationLng as number);
  if (!pricingWorkshopId && hasCoords) {
    const nearest = await getNearestWorkshops(supabase, context.locationLat as number, context.locationLng as number);
    if (nearest[0] && nearest[0].km <= 200) {
      pricingWorkshopId = nearest[0].id;
      pricingWorkshopName = nearest[0].name;
    }
  }

  const pricingCtx = { ...context, workshopId: pricingWorkshopId || undefined };
  const ranges = await resolvePriceRanges(supabase, { ctx: pricingCtx, suggestions });

  const options: SuggestedOption[] = suggestions.map((s) => {
    const opt: SuggestedOption = {
      suggestion: s,
      priceRange: ranges[`${s.kind}:${s.id}`],
    };

    // Add checklist details for "See Details" button
    if (s.kind === 'PACKAGE') {
      opt.checklistItems = serviceResult.packageToItemNames[s.id] || [];
      opt.category = 'Package';
    } else if (s.kind === 'SERVICE_TYPE') {
      const details = serviceResult.serviceTypeDetails[s.id];
      if (details?.description) {
        opt.checklistNote = details.description;
      }
      // Try to get category from service type name
      opt.category = getServiceCategory(s.name);
    }

    return opt;
  });

  // Determine chosen option
  const choiceIdx = pickChoiceIndex(body.message);
  let chosen: ServiceSuggestion | null = null;
  if (choiceIdx !== null && options[choiceIdx]) {
    chosen = options[choiceIdx].suggestion;
  } else if (context.selectedServiceTypeIds?.length && intent.intent !== 'RSA') {
    // If UI already pinned selected services, respect it.
    chosen = { kind: 'SERVICE_TYPE', id: context.selectedServiceTypeIds[0], name: 'Selected Service', why: '' };
  } else {
    chosen = options[0]?.suggestion || null;
  }

  const wantsBooking = looksLikeConfirm(body.message);
  const needs: string[] = [];

  if (!chosen) {
    const assistantMessage =
      'Main aapke issue ko map nahi kar paaya. Aap 1-2 lines me symptoms (noise/smell/leak/warning light) aur location share kar dijiye.';
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { conversationId },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
    return NextResponse.json(resp);
  }

  // STEP 6: PAYMENT METHOD (before final booking)
  if (wantsBooking && !context.paymentMethod) {
    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'NEED_PAYMENT',
      deterministicFacts: {
        ask: 'payment_method',
        options: [
          { value: 'UPI', label: 'UPI/Online Payment' },
          { value: 'CARD', label: 'Credit/Debit Card' },
          { value: 'CASH', label: 'Cash on Service' },
          { value: 'PAY_LATER', label: 'Pay Later at Workshop' },
        ],
        note: 'Please select your preferred payment method',
      },
      fallback: 'Payment method kaunsa prefer karenge?\n\n1. UPI/Online\n2. Credit/Debit Card\n3. Cash on Service\n4. Pay Later at Workshop\n\nOption number select karein.',
    });
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { 
        conversationId, 
        conversationStage: 'NEED_PAYMENT',
        // Keep selected service/workshop/pickup info
        selectedServiceTypeIds: context.selectedServiceTypeIds,
        selectedPackageId: context.selectedPackageId,
        pickupRequired: context.pickupRequired,
        workshopId: context.workshopId,
      },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
    return NextResponse.json(resp);
  }

  // If user picked payment method (after we asked), proceed with booking even if they didn't type "yes".
  const proceedBooking =
    wantsBooking ||
    (context.conversationStage === 'NEED_PAYMENT' && Boolean(context.paymentMethod)) ||
    (context.conversationStage === 'NEED_VEHICLE_NUMBER' && Boolean(context.paymentMethod) && Boolean(context.vehicleNumber));

  // Vehicle number is required by DB in many environments; collect before inserting lead.
  if (proceedBooking && !context.vehicleNumber) {
    const fallback = 'Booking complete karne ke liye vehicle number chahiye. Example: MH12AB1234';
    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'NEED_VEHICLE_NUMBER',
      deterministicFacts: { ask: 'vehicle_number', example: 'MH12AB1234' },
      fallback,
    });
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: {
        conversationId,
        conversationStage: 'NEED_VEHICLE_NUMBER',
        paymentMethod: context.paymentMethod,
        pickupRequired: context.pickupRequired,
        selectedServiceTypeIds: context.selectedServiceTypeIds,
        selectedPackageId: context.selectedPackageId,
      },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'vehicle_number' } });
    return NextResponse.json(resp);
  }

  if (proceedBooking) {
    try {
      const booking = await triggerBooking(supabase, {
        context: {
          ...context,
          conversationId,
          // If user didn't provide problemDescription earlier, store the current message
          problemDescription: context.problemDescription || body.message,
          // If user picked a package, keep it for logging
          selectedPackageId: chosen.kind === 'PACKAGE' ? chosen.id : context.selectedPackageId,
          // If chosen service type, store it
          selectedServiceTypeIds:
            chosen.kind === 'SERVICE_TYPE' || chosen.kind === 'RSA'
              ? [chosen.id]
              : serviceResult.packageToServiceTypeIds[chosen.id] || context.selectedServiceTypeIds,
        },
        intent,
        chosenSuggestion: chosen,
        packageServiceTypeIds: chosen.kind === 'PACKAGE' ? serviceResult.packageToServiceTypeIds[chosen.id] : undefined,
      });

      const assistantMessage = [
        'Done — aapki booking create ho gayi.',
        `Aapka Lead Number: ${booking.leadNumber}`,
        '',
        'Next step: Team availability ke hisaab se slot/workshop confirm karegi.',
      ].join('\n');

      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        booking,
        contextPatch: { conversationId },
      };

      await bestEffortLog(supabase, {
        conversationId,
        context,
        userText: body.message,
        botText: assistantMessage,
        meta: { intent, chosen, booking, priceRanges: ranges },
      });

      return NextResponse.json(resp);
    } catch (e: any) {
      const fallback =
        e instanceof BookingValidationError
          ? e.message
          : 'Booking create nahi ho paayi. Please details confirm karke try karein.';
      const assistantMessage = await composeReply({
        userMessage: body.message,
        context,
        stage: 'BOOKING_ERROR',
        deterministicFacts: { error: e?.message || 'unknown' },
        fallback,
      });

      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        contextPatch: { conversationId },
      };

      await bestEffortLog(supabase, {
        conversationId,
        context,
        userText: body.message,
        botText: assistantMessage,
        meta: { intent, chosen, error: e?.message },
      });

      return NextResponse.json(resp, { status: 400 });
    }
  }

  // Build normal advisory response
  const selectedOptionName = choiceIdx !== null && options[choiceIdx] ? options[choiceIdx].suggestion.name : undefined;
  const fallback = buildResponseText({
    why: chosen.why || undefined,
    options,
    needs,
    selectedOptionName,
  });
  const assistantMessage = await composeReply({
    userMessage: body.message,
    context,
    stage: 'READY_TO_SUGGEST',
    deterministicFacts: {
      why: chosen.why || null,
      options: options.map((o, idx) => ({
        index: idx + 1,
        name: o.suggestion.name,
        kind: o.suggestion.kind,
        priceRange: o.priceRange?.label || null,
        includes:
          o.suggestion.kind === 'PACKAGE'
            ? serviceResult.packageToItemNames?.[o.suggestion.id] || []
            : [],
        checklistNote:
          o.suggestion.kind === 'SERVICE_TYPE'
            ? serviceResult.serviceTypeDetails?.[o.suggestion.id]?.description || null
            : null,
      })),
      selectedOptionName: selectedOptionName || null,
      next: 'ask_for_option_or_confirm',
      notes: {
        pricingWorkshop: pricingWorkshopName || null,
        zoneId: pricingCtx.zoneId || null,
        vehicleClass: pricingCtx.vehicleClass || null,
      },
    },
    fallback,
  });

  const contextPatch: Partial<ChatbotContext> = {
    conversationId,
    conversationStage: 'NEED_ISSUE',
    // store last problem description for booking
    problemDescription: context.problemDescription || (context.conversationStage === 'NEED_VEHICLE_NUMBER' ? undefined : body.message),
    customerPhone: context.customerPhone,
    vehicleNumber: context.vehicleNumber,
    addressText: context.addressText,
  };

  // If user picked an option number (but not confirming yet), store selection.
  if (choiceIdx !== null && options[choiceIdx]) {
    const s = options[choiceIdx].suggestion;
    if (s.kind === 'PACKAGE') {
      contextPatch.selectedPackageId = s.id;
      contextPatch.selectedServiceTypeIds = serviceResult.packageToServiceTypeIds[s.id] || [];
    } else {
      contextPatch.selectedServiceTypeIds = [s.id];
      contextPatch.selectedPackageId = undefined;
    }
    // Next step after plan selection
    contextPatch.conversationStage = 'NEED_PICKUP_PREF';
  }

  const resp: ChatbotResponse = {
    conversationId,
    intent,
    suggestions: options,
    assistantMessage,
    contextPatch,
  };

  await bestEffortLog(supabase, {
    conversationId,
    context,
    userText: body.message,
    botText: assistantMessage,
    meta: { intent, suggestions, priceRanges: ranges },
  });

  return NextResponse.json(resp);
}
