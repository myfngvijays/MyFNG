import type { ChatbotContext } from './types';

/**
 * LLM-led dialog manager:
 * - Reads free text + current context
 * - Returns strict JSON telling us what the user wants, what to ask next, and how to sell
 * - We still use DB as source of truth for services/pricing/workshops
 */

export type DialogManagerPlan = {
  // High level: what the user likely wants
  goal: 'SERVICE_BOOKING' | 'RSA' | 'PRICE_ENQUIRY' | 'STATUS' | 'UNKNOWN';
  confidence: number; // 0..1

  // Extracted slots (best-effort)
  extracted: {
    customerName?: string | null;
    customerPhone?: string | null; // 10-digit, India
    vehicleNumber?: string | null; // e.g. MH12AB1234
    vehicleMakeModelText?: string | null; // e.g. "Tata Tigor"
    pickupRequired?: boolean | null;
    paymentMethod?: 'UPI' | 'CARD' | 'CASH' | 'PAY_LATER' | null;
    locationText?: string | null; // city/area/pincode/address
    problemDescription?: string | null; // user's issue in short
    budgetHint?: string | null; // e.g. "under 5k"
    urgencyHint?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  };

  // Sales/advisor guidance
  sales: {
    tone: 'soft' | 'confident' | 'urgent' | 'premium';
    keyBenefits: string[]; // 2-5 short bullets
    likelyObjections: string[]; // 0-3
  };

  // What to do next in conversation (one question)
  next: {
    // If present, ask this exact question next (in user's language)
    ask?: string | null;
    // What field we are trying to collect next (helps UI/debug, not shown)
    need?: 'CAR_MODEL' | 'PHONE' | 'ISSUE' | 'PICKUP' | 'PAYMENT' | 'VEHICLE_NUMBER' | 'LOCATION' | 'NONE';
  };
};

function stripCodeFences(s: string) {
  const t = String(s || '').trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : t;
}

export async function planNextStep(params: {
  userMessage: string;
  context: ChatbotContext;
}): Promise<DialogManagerPlan | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!apiKey) return null;

  const system = `
You are a senior automotive sales advisor for MyFNG (India).
You must understand the user's free-text message and produce STRICT JSON ONLY (no markdown).

Goals:
- Identify what the user wants (service booking / RSA / price enquiry / status).
- Extract any details present in the message (phone, vehicle number, car model text, location, pickup preference, payment preference).
- If info is missing, decide ONE best next question to ask (single question only).
- Provide 2-5 sales benefits relevant to the user's problem (short bullets) to help convince the user.

Hard rules:
- Output JSON ONLY with the exact schema. No extra keys.
- Never invent exact prices. BudgetHint can be extracted only from user text.
- customerPhone must be 10 digits if present, else null.
- vehicleNumber should be uppercase and without spaces if possible.
- pickupRequired: true/false/null only.
- paymentMethod must be one of: UPI, CARD, CASH, PAY_LATER, or null.
- confidence: 0..1.
`.trim();

  const userPayload = {
    userMessage: params.userMessage,
    existingContext: {
      customerName: params.context.customerName || null,
      customerPhone: params.context.customerPhone || null,
      vehicleNumber: params.context.vehicleNumber || null,
      vehicleModel: params.context.vehicleModel || null,
      pickupRequired: typeof params.context.pickupRequired === 'boolean' ? params.context.pickupRequired : null,
      paymentMethod: params.context.paymentMethod || null,
      addressText: params.context.addressText || null,
      conversationStage: params.context.conversationStage || null,
    },
  };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('DialogManager failed:', res.status, res.statusText, errText);
      return null;
    }

    const json = (await res.json()) as any;
    const content = json?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') return null;

    const parsed = JSON.parse(stripCodeFences(content)) as DialogManagerPlan;
    if (!parsed?.goal || !parsed?.extracted || !parsed?.sales || !parsed?.next) return null;
    return parsed;
  } catch (e) {
    console.error('DialogManager exception:', e);
    return null;
  }
}


