import type { ChatbotV2Context, ClassifiedIntent, IntentCategory } from '../types';
import { pickUserLang } from '../reply/language';

function normalize(text: string) {
  return String(text || '').toLowerCase().trim();
}

function firstMatchIntent(text: string): IntentCategory {
  const t = normalize(text);
  if (!t) return 'GeneralInfo';

  if (/(human|agent|call me|talk to human|representative|manager|callback|escalate|complaint agent)/i.test(text)) return 'HumanEscalation';
  if (/(warranty|guarantee|support|complaint|complain|issue after service|post service)/i.test(text)) return 'WarrantySupport';
  // Workshop/location: keep strict. Hindi "kaha/kahan" alone is too ambiguous (e.g. "aap kaha service karaoge")
  // so require workshop-ish keywords OR a clear "where is your workshop" phrasing.
  if (/(near|nearby|closest|nearest|workshop|service\s*center|service\s*centre|location|map|google maps|direction|navigate)/i.test(text))
    return 'WorkshopLocation';
  if (/(kaha|kahan).*(workshop|address|location|map|service\s*center|service\s*centre)/i.test(text)) return 'WorkshopLocation';
  // Booking intent: do NOT trigger on informational pickup/drop questions like "pickup ke baad kya hoga".
  // Require booking/scheduling language, or explicit "pickup chahiye".
  if (
    /(book|booking|schedule|appointment|confirm booking|service karna hai|book karna|kal|today|tomorrow|pickup\s*(chahiye|chahie|chaiye|needed))/i.test(
      text
    )
  )
    return 'BookingRequest';
  if (/(price|cost|charges|rate|kitna|kitne|fees|estimate|budget|quotation|quote)/i.test(text)) return 'PriceEnquiry';
  if (/(periodic|regular|service due|maintenance|engine oil|oil change|general service|servicing)/i.test(text)) return 'PeriodicService';
  // NOTE: keep word boundaries for short tokens like AC to avoid matching words like "exactly".
  if (
    /(repair|issue|problem|noise|vibration|\bac\b|\ba\/c\b|cooling|\bbrake\b|\bbattery\b|\bclutch\b|\bengine\b|\bscan\b|starting|not starting|kharab|awaaz|awaj)/i.test(
      text
    )
  )
    return 'RepairIssue';
  if (/(clean|cleaning|wash|detailing|interior|exterior|polish|wax|spa|dry clean|deep clean|saaf|safai|dhulai)/i.test(text))
    return 'CleaningDetailing';
  return 'GeneralInfo';
}

export async function classifyIntent(params: { message: string; context: ChatbotV2Context }): Promise<ClassifiedIntent> {
  const msg = String(params.message || '').trim();
  const intent = firstMatchIntent(msg);

  // Mostly deterministic to keep token costs low. If UNKNOWN-like: still map to GeneralInfo.
  const confidence =
    intent === 'GeneralInfo' && msg.length >= 8 && /\?/.test(msg) ? 0.6 : intent === 'GeneralInfo' ? 0.5 : 0.85;

  // lightweight entities
  const entities = {
    wantsPaymentLink: /(pay\s*now|payment\s*link|upi\s*link|pay link|pay online)/i.test(msg),
    mentionedWorkshop: /(workshop|nearest|nearby|location|address|map)/i.test(msg),
    mentionedPrice: /(price|cost|charges|rate|kitna|fees)/i.test(msg),
  };

  // Ensure language preference doesn't leak into intent (but keep it computed here if needed later)
  pickUserLang(params.context, msg);

  // Low-token fallback: if our regex says "GeneralInfo" but message looks specific, use a tiny LLM classifier.
  // This runs rarely to keep token cost low.
  const apiKey = process.env.OPENAI_API_KEY;
  const needsLlm =
    Boolean(apiKey) &&
    intent === 'GeneralInfo' &&
    msg.length >= 10 &&
    (/\?/.test(msg) || /(price|cost|workshop|book|booking|warranty|complaint|repair|clean)/i.test(msg));

  if (needsLlm) {
    try {
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const sys =
        'Classify the user message into EXACTLY one intent. Output ONLY the intent string.\n' +
        'Allowed intents: GeneralInfo, PriceEnquiry, PeriodicService, RepairIssue, CleaningDetailing, WorkshopLocation, BookingRequest, WarrantySupport, HumanEscalation.';
      const user = `Message: ${msg}`;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: user },
          ],
        }),
      });
      if (res.ok) {
        const json = (await res.json().catch(() => null)) as any;
        const out = String(json?.choices?.[0]?.message?.content || '').trim() as IntentCategory;
        const allowed: IntentCategory[] = [
          'GeneralInfo',
          'PriceEnquiry',
          'PeriodicService',
          'RepairIssue',
          'CleaningDetailing',
          'WorkshopLocation',
          'BookingRequest',
          'WarrantySupport',
          'HumanEscalation',
        ];
        if (allowed.includes(out)) return { intent: out, confidence: 0.75, entities };
      }
    } catch {
      // ignore
    }
  }

  return { intent, confidence, entities };
}


