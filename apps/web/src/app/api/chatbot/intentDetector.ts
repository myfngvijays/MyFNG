import { INTENT_DETECTOR_SYSTEM_PROMPT, type LlmIntentJson } from './prompt';
import type {
  ChatbotIntent,
  ChatbotUrgency,
  ChatbotVehicleType,
  IntentDetectionResult,
} from './types';

const EMERGENCY_KEYWORDS = [
  'accident',
  'crash',
  'injury',
  'bleeding',
  'fire',
  'unconscious',
  'ambulance',
  'help me',
  'emergency',
];

const COMPLAINT_KEYWORDS = [
  'complaint',
  'refund',
  'scam',
  'fraud',
  'cheating',
  'harassment',
  'bad service',
  'worst',
  'angry',
  'gussa',
  'chutiya',
  'bakwaas',
];

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function includesAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w));
}

function guessVehicleType(text: string): ChatbotVehicleType {
  if (/(bike|motorcycle|scooter|activa|splendor)/i.test(text)) return 'BIKE';
  if (/(car|sedan|hatchback|suv|creta|swift|baleno|i10|i20|wagonr)/i.test(text)) return 'CAR';
  return 'UNKNOWN';
}

function guessUrgency(text: string): ChatbotUrgency {
  if (/(now|urgent|immediately|asap|stuck|stranded|breakdown|not starting|won't start|tow|towing)/i.test(text)) {
    return 'HIGH';
  }
  if (/(today|tomorrow|soon)/i.test(text)) return 'MEDIUM';
  return 'LOW';
}

function guessIntentHeuristic(text: string): ChatbotIntent {
  // RSA / breakdown oriented
  if (/(rsa|roadside|breakdown|stuck|stranded|towing|tow|puncture on road|flat tyre on road|jump start)/i.test(text)) {
    return 'RSA';
  }
  if (/(price|cost|kitna|charges|rate|estimate|budget)/i.test(text)) return 'PRICE_ENQUIRY';
  if (/(status|track|tracking|lead|booking id|order|progress)/i.test(text)) return 'STATUS';
  if (
    /(book|booking|schedule|service|repair|checkup|inspection|periodic|oil|ac|battery|brake|clutch|engine|noise|vibration|denting|painting|dent|scratch|body|bumper|panel|alignment|balancing|suspension|steering)/i.test(
      text
    )
  ) {
    return 'SERVICE_BOOKING';
  }
  return 'UNKNOWN';
}

async function detectViaOpenAi(message: string): Promise<IntentDetectionResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) return null;

  // Network is expected in production; in local dev this may be unavailable.
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: INTENT_DETECTOR_SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('OpenAI intent detector failed:', res.status, res.statusText, errText);
    return null;
  }
  const json = (await res.json()) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (!content) return null;

  let parsed: LlmIntentJson | null = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (!parsed || !parsed.intent || !parsed.urgency || !parsed.vehicle_type) return null;

  const symptoms = parsed.symptoms || [];
  const flags: IntentDetectionResult['flags'] = [];
  if (symptoms.some((s) => s.toUpperCase().includes('EMERGENCY'))) flags.push('EMERGENCY');
  if (symptoms.some((s) => s.toUpperCase().includes('COMPLAINT'))) flags.push('COMPLAINT');

  return {
    intent: parsed.intent,
    urgency: parsed.urgency,
    vehicle_type: parsed.vehicle_type,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.6,
    flags,
    extracted: {
      symptoms,
      locationText: parsed.locationText,
    },
  };
}

export async function detectIntent(message: string): Promise<IntentDetectionResult> {
  const text = normalize(message);

  // Hard safety pre-checks (must not be overridden by LLM).
  const emergency = includesAny(text, EMERGENCY_KEYWORDS);
  const complaint = includesAny(text, COMPLAINT_KEYWORDS);

  if (emergency) {
    return {
      intent: 'UNKNOWN',
      urgency: 'HIGH',
      vehicle_type: guessVehicleType(text),
      flags: ['EMERGENCY'],
      confidence: 1,
      extracted: { symptoms: ['EMERGENCY'] },
    };
  }

  if (complaint) {
    return {
      intent: 'UNKNOWN',
      urgency: 'MEDIUM',
      vehicle_type: guessVehicleType(text),
      flags: ['COMPLAINT'],
      confidence: 1,
      extracted: { symptoms: ['COMPLAINT'] },
    };
  }

  // Optional LLM extraction (only intent + phrasing allowed).
  try {
    const llm = await detectViaOpenAi(message);
    if (llm) {
      // Ensure we still apply our safety flags.
      return {
        ...llm,
        flags: llm.flags || [],
      };
    }
  } catch {
    // fall through to heuristic
  }

  return {
    intent: guessIntentHeuristic(text),
    urgency: guessUrgency(text),
    vehicle_type: guessVehicleType(text),
    flags: [],
    confidence: 0.55,
    extracted: {
      symptoms: [],
    },
  };
}
