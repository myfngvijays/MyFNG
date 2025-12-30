import type { ChatbotV2Response, IntentCategory, PricingHit, UserLang, WorkshopHit } from '../types';
import { clampLines } from './language';

function joinShortLines(lines: string[]) {
  return clampLines(
    lines
      .map((l) => String(l || '').trim())
      .filter(Boolean)
      .join('\n'),
    5
  );
}

function defaultCta(lang: UserLang) {
  if (lang === 'en') return 'What car do you drive, and which area are you in?';
  if (lang === 'hi') return 'आप कौन‑सी कार चलाते हैं और आपका एरिया कौन‑सा है?';
  return 'Aap kaunsi car chalate ho aur aapka area kaunsa hai?';
}

export function buildWorkshopReply(params: { lang: UserLang; radiusKm: number; workshops: WorkshopHit[] }): ChatbotV2Response {
  const { lang, radiusKm, workshops } = params;
  const header =
    lang === 'en'
      ? `Nearest verified workshops (within ${radiusKm} km):`
      : lang === 'hi'
        ? `Nearest verified workshops (${radiusKm} km के अंदर):`
        : `Nearest verified workshops (within ${radiusKm} km):`;

  // Keep chat short (3–5 lines). Put full list in data for UI.
  const preview = workshops.slice(0, 2).map((w, i) => `${i + 1}) ${w.name} (${w.km.toFixed(1)} km)`);
  const more = workshops.length > 2 ? (lang === 'hi' ? `+${workshops.length - 2} और options` : `+${workshops.length - 2} more`) : '';

  const cta =
    lang === 'en'
      ? 'Pickup chahiye ya aap self-visit karoge?'
      : lang === 'hi'
        ? 'Pickup चाहिए या आप self-visit करेंगे?'
        : 'Pickup chahiye ya aap self-visit karoge?';

  return {
    type: 'answer',
    message: joinShortLines([header, ...preview, more]),
    cta,
    data: { radiusKm, workshops },
  };
}

export function buildPricingReply(params: { lang: UserLang; items: PricingHit[] }): ChatbotV2Response {
  const { lang, items } = params;
  const top = items.slice(0, 3);
  if (top.length === 0) {
    const msg =
      lang === 'en'
        ? 'Exact pricing depends on car model + inspection. I can share a close estimate once you confirm model + area.'
        : lang === 'hi'
          ? 'Exact pricing car model + inspection pe depend karti hai. Model + area confirm kar do, main close estimate bata dunga.'
          : 'Exact pricing car model + inspection pe depend karti hai. Model + area confirm kar do, main close estimate bata dunga.';
    const cta =
      lang === 'en'
        ? 'What car model do you drive, and which area are you in?'
        : lang === 'hi'
          ? 'आपकी कार का मॉडल और एरिया क्या है?'
          : 'Aapki car model aur area kya hai?';
    return { type: 'pricing', message: joinShortLines([msg]), cta, data: { items } };
  }

  const header =
    lang === 'en'
      ? 'Periodic service pricing (starting):'
      : lang === 'hi'
        ? 'Periodic service pricing (starting):'
        : 'Periodic service pricing (starting):';

  const lines = top.map((p) => {
    const price = p.price != null && Number.isFinite(p.price) ? `₹${Math.round(p.price)}` : 'On inspection';
    return `${p.name}: ${price}`;
  });

  const cta =
    lang === 'en'
      ? 'Your car model + area share kar do, main exact suggest kar dunga.'
      : lang === 'hi'
        ? 'अपनी कार का मॉडल और एरिया शेयर कर दीजिए, मैं सही option suggest कर दूँगा।'
        : 'Car model + area share kar do, main exact suggest kar dunga.';

  return {
    type: 'pricing',
    message: joinShortLines([header, ...lines]),
    cta,
    data: { items },
  };
}

export function buildAnswerReply(params: { lang: UserLang; intent: IntentCategory; answer: string | null }): ChatbotV2Response {
  const { lang, answer } = params;
  // Small variation without extra tokens (keeps it human, avoids same feel)
  const openers =
    lang === 'en'
      ? ['Got it.', 'Okay.', 'Sure.']
      : lang === 'hi'
        ? ['समझ गया।', 'ठीक है।', 'बिल्कुल।']
        : ['Samajh gaya.', 'Theek hai.', 'Bilkul.'];
  const intro = openers[Math.floor(Date.now() / 60000) % openers.length]!;

  const msg = answer ? joinShortLines([answer]) : joinShortLines([intro, '']);

  return {
    type: 'answer',
    message: msg.trim() || intro,
    cta: defaultCta(lang),
    data: {},
  };
}

export function buildEscalationReply(params: { lang: UserLang }): ChatbotV2Response {
  const { lang } = params;
  const message =
    lang === 'en'
      ? 'Sure — I’ll connect you with our expert.'
      : lang === 'hi'
        ? 'ठीक है — मैं आपको हमारे एक्सपर्ट से connect करा देता हूँ।'
        : 'Theek hai — main aapko expert se connect kara deta hoon.';
  const cta = lang === 'en' ? 'Please share your name + number for callback.' : lang === 'hi' ? 'कॉलबैक के लिए नाम + नंबर शेयर कर दीजिए।' : 'Callback ke liye name + number share kar do.';

  return { type: 'escalation', message, cta, data: {} };
}


