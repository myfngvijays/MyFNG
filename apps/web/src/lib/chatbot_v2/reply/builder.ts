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

function helpMenuCta(lang: UserLang) {
  if (lang === 'en') return 'What do you need — service, repair, cleaning, or workshop location?';
  if (lang === 'hi') return 'आपको क्या चाहिए — service, repair, cleaning, या workshop location?';
  return 'Aapko kya chahiye — service, repair, cleaning, ya workshop location?';
}

function followUpCta(lang: UserLang, intent: IntentCategory) {
  if (intent === 'RepairIssue') {
    if (lang === 'en') return 'What issue are you facing? Also share car model + area.';
    if (lang === 'hi') return 'कौन‑सा issue है? साथ में car model + area भी बता दीजिए।';
    return 'Kaunsa issue hai? Saath me car model + area bhi bata do.';
  }
  if (intent === 'CleaningDetailing') {
    if (lang === 'en') return 'Interior or exterior? Also share your area.';
    if (lang === 'hi') return 'Interior या exterior? और आपका area?';
    return 'Interior ya exterior? Aur aapka area?';
  }
  if (intent === 'WorkshopLocation') {
    if (lang === 'en') return 'Share your area/pincode, I’ll show nearest verified workshops.';
    if (lang === 'hi') return 'अपना area/pincode भेजिए, मैं nearest verified workshops दिखा दूँगा।';
    return 'Apna area/pincode bhejo, main nearest verified workshops dikha dunga.';
  }
  // For general FAQs and info, don't aggressively ask model+area.
  return helpMenuCta(lang);
}

export function buildWorkshopReply(params: { lang: UserLang; radiusKm: number; workshops: WorkshopHit[] }): ChatbotV2Response {
  const { lang, radiusKm, workshops } = params;
  if (workshops.length === 0) {
    const msg =
      lang === 'en'
        ? `No verified workshops found within ${radiusKm || 200} km. Location allow kar do ya area/pincode bhejo.`
        : lang === 'hi'
          ? `${radiusKm || 200} km के अंदर verified workshops नहीं मिले। Location allow कर दीजिए या area/pincode भेजिए।`
          : `${radiusKm || 200} km ke andar verified workshops nahi mile. Location allow kar do ya area/pincode bhejo.`;
    return { type: 'answer', message: joinShortLines([msg]), cta: followUpCta(lang, 'WorkshopLocation'), data: { radiusKm, workshops } };
  }
  const header =
    lang === 'en'
      ? radiusKm > 0
        ? `Nearest verified workshops (within ${radiusKm} km):`
        : `Verified workshops:`
      : lang === 'hi'
        ? radiusKm > 0
          ? `Nearest verified workshops (${radiusKm} km के अंदर):`
          : `Verified workshops:`
        : radiusKm > 0
          ? `Nearest verified workshops (within ${radiusKm} km):`
          : `Verified workshops:`;

  // Keep chat short (3–5 lines). Put full list in data for UI.
  const preview = workshops.slice(0, 2).map((w, i) => {
    const kmText = typeof w.km === 'number' ? `${w.km.toFixed(1)} km` : 'distance unknown';
    return `${i + 1}) ${w.name} (${kmText})`;
  });
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
    data: {
      radiusKm,
      workshops,
      ui: {
        kind: 'WORKSHOP_CAROUSEL',
        title: header,
        items: workshops.map((w: any) => ({
          id: String(w.id),
          name: String(w.name),
          subtitle: w.address ? String(w.address) : undefined,
          km: typeof w.km === 'number' ? w.km : null,
          imageUrl: w.imageUrl ? String(w.imageUrl) : null,
          mapLink: w.mapLink ? String(w.mapLink) : null,
        })),
      },
    },
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
  const { lang, answer, intent } = params;
  // Small variation without extra tokens (keeps it human, avoids same feel)
  const openers =
    lang === 'en'
      ? ['Got it.', 'Okay.', 'Sure.']
      : lang === 'hi'
        ? ['समझ गया।', 'ठीक है।', 'बिल्कुल।']
        : ['Samajh gaya.', 'Theek hai.', 'Bilkul.'];
  const intro = openers[Math.floor(Date.now() / 60000) % openers.length]!;

  const msg = answer ? joinShortLines([answer]) : joinShortLines([intro, lang === 'en' ? 'Aap apna sawal thoda clear kar do.' : lang === 'hi' ? 'अपना सवाल थोड़ा clear कर दीजिए।' : 'Apna sawal thoda clear kar do.']);

  return {
    type: 'answer',
    message: msg.trim() || intro,
    // If we don't have a KB answer, avoid spamming the main menu repeatedly.
    cta: answer
      ? followUpCta(lang, intent)
      : lang === 'en'
        ? 'What exactly do you want to know? (Example: pricing / booking / nearest workshop)'
        : lang === 'hi'
          ? 'आप exactly क्या जानना चाहते हैं? (pricing / booking / nearest workshop)'
          : 'Exactly kya jaan-na hai? (pricing / booking / nearest workshop)',
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


