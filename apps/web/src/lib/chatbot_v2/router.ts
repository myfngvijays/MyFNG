import type { ChatbotV2Context, ChatbotV2Response, ClassifiedIntent, MissingInfo, UserLang } from './types';
import {
  createBookingTokenPaymentLink,
  createServiceLead,
  fetchActiveCategories,
  fetchCategoryByNameLike,
  fetchCategoryByUuid,
  fetchCarModelById,
  fetchNearestWorkshops,
  fetchPeriodicServicePricing,
  fetchServiceTypeById,
  fetchServiceTypeChecklistTemplate,
  fetchServiceTypesByCategoryUuid,
  fetchWorkshopsByCityOrPincode,
  inferVehicleClassFromModelText,
  searchCarModels,
  fetchZoneWisePricesForServiceTypes,
  fetchZoneWisePeriodicServicePricing,
} from './db/supabase';
import { answerFromFaqOrKb } from './kb/retriever';
import { buildAnswerReply, buildEscalationReply, buildPricingReply, buildWorkshopReply } from './reply/builder';
import { expandAnswerPreservingFacts, rewritePreservingFacts } from './reply/language';

function wantsPaymentNow(msg: string) {
  return /(pay\s*now|payment\s*link|upi\s*link|pay link|pay online|booking token|advance)/i.test(msg || '');
}

function isGreeting(msg: string) {
  const t = String(msg || '').trim().toLowerCase();
  if (!t) return false;
  if (t.length > 18) return false;
  return /^(hi|hello|hey|hii|heyy|namaste|yo|hlo|hlw|helo|hola)\b/.test(t);
}

function wantsServicesList(msg: string) {
  return /(services?\s*(batao|बताओ|list|options?)|kya\s+services?|services?\s+kya\s+hai|what\s+services?|service\s+options?)/i.test(msg || '');
}

function asksHowServiceWorks(msg: string) {
  return /(how\s+.*service\s+works?|service\s+process|car\s+service\s+kaise|kaise\s+hota\s+hai|service\s+kaise\s+hot[ai])/i.test(msg || '');
}

function asksPickupAvailability(msg: string) {
  return /(pickup\s*(option|available|hai|nahi)|home\s*pickup|pickup\s*&\s*drop|pickup\s+drop|free\s+pickup)/i.test(msg || '');
}

function wantsPricing(msg: string) {
  return /(price|pricing|cost|charges|rate|kitna|kitne|fees|estimate|budget|quotation|quote)/i.test(msg || '');
}

function isAffirmative(msg: string) {
  const t = String(msg || '').trim().toLowerCase();
  return /^(yes|y|haan|ha|han|bilkul|ok|okay|sure)\b/.test(t) || /(i\s*want|chahiye|haan\s*chahiye|send\s*(link)?|link\s*send)/i.test(t);
}

function isNegative(msg: string) {
  const t = String(msg || '').trim().toLowerCase();
  return /^(no|nahi|nahin|na)\b/.test(t) || /(not\s*needed|later|abhi\s*nahi)/i.test(t);
}

function wantsPickupOrSelfVisit(msg: string) {
  return /(pickup|self\s*visit|self-visit|self\s*drop|walk\s*in)/i.test(msg || '');
}

function wantsCarServiceBroad(msg: string) {
  return /(car\s*service|gadi\s*ki\s*service|servicing|service\s*karana|service\s*karwana|service\s*karna|service\s*karani)/i.test(msg || '');
}

function isLanguageCommand(msg: string) {
  return /(hindi|हिंदी).*(baat|बात).*(karo|करो)|mujhse\s+hindi|hindi\s+me\s+baat|english\s+me\s+baat|mujhse\s+english|hinglish\s+me/i.test(msg || '');
}

function inferCategoryForIssue(msg: string): string | null {
  const t = String(msg || '').toLowerCase();
  if (/\bac\b|a\/c|cooling|blower|compressor|heat/.test(t)) return 'AC';
  if (/\bbrake\b|braking|pad|disc/.test(t)) return 'Brake';
  if (/\bbattery\b|jump|not\s+starting|start\s+nahi|self\s+start/.test(t)) return 'Battery';
  if (/\bclutch\b|gear|gears|slip/.test(t)) return 'Clutch';
  if (/\btyre\b|tire|wheel|alignment|balancing|puncture/.test(t)) return 'Tyre';
  if (/\bdent\b|paint|scratch|bumper|panel|body/.test(t)) return 'Denting';
  if (/\bclean\b|detailing|interior|exterior|polish|wax|spa/.test(t)) return 'Detailing';
  if (/\bengine\b|vibration|noise|mount|scan/.test(t)) return 'Engine';
  return null;
}

function wantsMoreDetails(msg: string) {
  return /(more\s+detail|more\s+details|tell\s+me\s+more|elaborate|explain\s+more|describe\s+more|thoda\s+aur|aur\s+batao|detail\s+me|details?\s+me)/i.test(
    msg || ''
  );
}

function isValidLatLng(lat: unknown, lng: unknown) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return false;
  // 0,0 is almost always "missing" from web geolocation fallbacks
  if (Math.abs(la) < 0.0001 && Math.abs(lo) < 0.0001) return false;
  return true;
}

function isLikelyIndiaLatLng(lat: unknown, lng: unknown) {
  const la = Number(lat);
  const lo = Number(lng);
  // Broad India-ish bounding box (prevents absurd distances when coords are wrong)
  return isValidLatLng(lat, lng) && la >= 6 && la <= 38 && lo >= 68 && lo <= 98;
}

export async function routeMessage(params: {
  userText: string;
  lang: UserLang;
  intent: ClassifiedIntent;
  context: ChatbotV2Context;
  missing: MissingInfo;
}): Promise<{ response: ChatbotV2Response; contextPatch: Partial<ChatbotV2Context> }> {
  const { userText, lang, intent, context, missing } = params;
  const ctxPatch: Partial<ChatbotV2Context> = {};

  // Language preference command: acknowledge and persist, don't fall into "clear question".
  if (isLanguageCommand(userText)) {
    if (context.preferredLanguage === 'hi') {
      return {
        response: { type: 'answer', message: 'ठीक है, मैं हिंदी में बात करूंगा।', cta: 'आपको क्या चाहिए — service, repair, cleaning, या workshop location?', data: {} },
        contextPatch: ctxPatch,
      };
    }
    if (context.preferredLanguage === 'en') {
      return { response: { type: 'answer', message: 'Sure — I’ll reply in English.', cta: 'What do you need — service, repair, cleaning, or workshop location?', data: {} }, contextPatch: ctxPatch };
    }
    if (context.preferredLanguage === 'hinglish') {
      return { response: { type: 'answer', message: 'Theek hai — main Hinglish me reply karunga.', cta: 'Aapko kya chahiye — service, repair, cleaning, ya workshop location?', data: {} }, contextPatch: ctxPatch };
    }
    // If command didn't parse into a language, ask once.
    return { response: { type: 'answer', message: 'Theek hai. Aap Hindi / English / Hinglish me kis me chahte ho?', cta: '', data: {} }, contextPatch: ctxPatch };
  }

  // Safety-net: if user clearly wants "car service" but intent got classified as GeneralInfo,
  // still start the mandatory service-intent selection flow (category carousel).
  if (intent.intent === 'GeneralInfo' && wantsCarServiceBroad(userText) && !context.selectedServiceTypeId) {
    ctxPatch.flow = 'PRICING';
    let cats: Array<{ uuid: string; category: string; description: string | null }> = [];
    try {
      cats = (await fetchActiveCategories()).slice(0, 9);
    } catch {
      cats = [];
    }
    const msg =
      lang === 'en'
        ? 'Sure, I can help you with car service pricing and nearby workshops.\nMay I know what service you are looking for today?'
        : lang === 'hi'
          ? 'ठीक है — मैं pricing aur nearby workshops में help कर दूँगा।\nआज आपको कौन‑सी service चाहिए?'
          : 'Theek hai — main pricing aur nearby workshops me help kar dunga.\nAaj aapko kaunsi service chahiye?';
    return {
      response: {
        type: 'pricing',
        message: msg,
        cta: '',
        data: {
          ui: {
            kind: 'CATEGORY_CAROUSEL',
            title: lang === 'hi' ? 'Service categories' : 'Service categories',
            items: cats.map((c) => ({
              id: `__select__ CATEGORY ${c.uuid}`,
              label: c.category,
              subtitle: c.description ? c.description.slice(0, 60) : undefined,
            })),
          },
        },
      },
      contextPatch: ctxPatch,
    };
  }

  // UI selection handler: "__select__ SERVICE_TYPE <id>"
  if (/^__select__\s+SERVICE_TYPE\s+/i.test(userText.trim())) {
    const parts = userText.trim().split(/\s+/);
    const sid = parts[2] || parts[3] || '';
    if (sid) {
      ctxPatch.selectedServiceTypeId = sid;
      try {
        const st = await fetchServiceTypeById(sid);
        if (st?.name) ctxPatch.selectedServiceTypeName = st.name;
      } catch {
        // ignore
      }
      // IMPORTANT: Selecting a service is step-1 for pricing. Next ask car model (not pickup).
      ctxPatch.flow = 'PRICING';
      ctxPatch.awaitingCarModelSelection = true;
      const msg =
        lang === 'hi'
          ? `Done — ${ctxPatch.selectedServiceTypeName || 'service'} note kar li.`
          : lang === 'en'
            ? `Done — noted ${ctxPatch.selectedServiceTypeName || 'the service'}.`
            : `Done — ${ctxPatch.selectedServiceTypeName || 'service'} note kar li.`;
      const cta =
        lang === 'hi'
          ? 'Ab aapki car model kya hai?'
          : lang === 'en'
            ? 'What is your car model?'
            : 'Ab aapki car model kya hai?';
      return { response: { type: 'pricing', message: msg, cta, data: {} }, contextPatch: ctxPatch };
    }
  }

  // UI selection handler: "__select__ CATEGORY <uuid>" -> show service types
  if (/^__select__\s+CATEGORY\s+/i.test(userText.trim())) {
    const parts = userText.trim().split(/\s+/);
    const cid = parts[2] || parts[3] || '';
    if (cid) {
      ctxPatch.selectedCategoryUuid = cid;
      try {
        const cat = await fetchCategoryByUuid(cid);
        if (cat?.category) ctxPatch.selectedCategoryName = cat.category;
      } catch {
        // ignore
      }
      try {
        const st = await fetchServiceTypesByCategoryUuid(cid);
        if (st.length > 0) {
          return {
            response: {
              type: 'answer',
              message: lang === 'hi' ? 'Kaunsa service chahiye?' : lang === 'en' ? 'Which service do you need?' : 'Kaunsa service chahiye?',
              cta: '',
              data: {
                ui: {
                  kind: 'CATEGORY_CAROUSEL',
                  title: ctxPatch.selectedCategoryName || 'Options',
                  items: st.slice(0, 10).map((x) => ({
                    id: `__select__ SERVICE_TYPE ${x.id}`,
                    label: x.name,
                    subtitle: x.description ? x.description.slice(0, 60) : undefined,
                  })),
                },
              },
            },
            contextPatch: ctxPatch,
          };
        }
      } catch {
        // ignore
      }
    }
  }

  // Common general info (deterministic) so we don't rely on KB/LLM for basic process questions.
  if (asksHowServiceWorks(userText)) {
    const msg =
      lang === 'en'
        ? 'Service ka flow simple hai:\n1) Pickup (ya self-visit)\n2) Inspection + estimate\n3) Approval ke baad kaam\n4) Photo/video updates\n5) Delivery + support/warranty (as applicable)'
        : lang === 'hi'
          ? 'Service ka flow simple hai:\n1) Pickup (ya self-visit)\n2) Inspection + estimate\n3) Approval ke baad kaam\n4) Photo/video updates\n5) Delivery + support/warranty (as applicable)'
          : 'Service ka flow simple hai:\n1) Pickup (ya self-visit)\n2) Inspection + estimate\n3) Approval ke baad kaam\n4) Photo/video updates\n5) Delivery + support/warranty (as applicable)';
    const cta =
      lang === 'en'
        ? 'Aapko service chahiye ya repair? Aur aapka area/pincode?'
        : lang === 'hi'
          ? 'Aapko service chahiye ya repair? Aur aapka area/pincode?'
          : 'Aapko service chahiye ya repair? Aur aapka area/pincode?';
    return { response: { type: 'answer', message: msg, cta, data: {} }, contextPatch: ctxPatch };
  }

  if (asksPickupAvailability(userText)) {
    const msg =
      lang === 'en'
        ? 'Haan, pickup & drop available hai (service area ke hisaab se).'
        : lang === 'hi'
          ? 'Haan, pickup & drop available hai (service area ke hisaab se).'
          : 'Haan, pickup & drop available hai (service area ke hisaab se).';
    const cta =
      lang === 'en'
        ? 'Aapka area/pincode kya hai? Main pickup availability confirm kar deta hoon.'
        : lang === 'hi'
          ? 'Aapka area/pincode kya hai? Main pickup availability confirm kar deta hoon.'
          : 'Aapka area/pincode kya hai? Main pickup availability confirm kar deta hoon.';
    return { response: { type: 'answer', message: msg, cta, data: {} }, contextPatch: ctxPatch };
  }

  // Repair issue: auto-detect category and show its service types (DB-driven carousel).
  if (intent.intent === 'RepairIssue') {
    const key = inferCategoryForIssue(userText);
    const like =
      key === 'AC'
        ? 'AC'
        : key === 'Brake'
          ? 'Brake'
          : key === 'Battery'
            ? 'Battery'
            : key === 'Clutch'
              ? 'Clutch'
              : key === 'Tyre'
                ? 'Tyre'
                : key === 'Denting'
                  ? 'Denting'
                  : key === 'Detailing'
                    ? 'Detailing'
                    : key === 'Engine'
                      ? 'Engine'
                      : null;
    try {
      if (like) {
        const cat = await fetchCategoryByNameLike(like);
        if (cat?.uuid) {
          const serviceTypes = await fetchServiceTypesByCategoryUuid(cat.uuid);
          if (serviceTypes.length > 0) {
            const title = lang === 'hi' ? `${cat.category} options:` : `${cat.category} options:`;
            const msg =
              lang === 'hi'
                ? 'Issue samajh gaya. In options me se kya chahiye?'
                : lang === 'en'
                  ? 'Got it. Pick an option:'
                  : 'Samajh gaya. In options me se kya chahiye?';
            return {
              response: {
                type: 'answer',
                message: msg,
                cta: '',
                data: {
                  ui: {
                    kind: 'CATEGORY_CAROUSEL',
                    title,
                    items: serviceTypes.slice(0, 8).map((s) => ({
                      id: `__select__ SERVICE_TYPE ${s.id}`,
                      label: s.name,
                      subtitle: s.description ? s.description.slice(0, 60) : undefined,
                    })),
                  },
                },
              },
              contextPatch: ctxPatch,
            };
          }
        }
      }
    } catch {
      // ignore
    }

    // Fallback: ask one clarifying question, no menu spam
    const msg =
      lang === 'hi'
        ? 'ठीक है — issue note कर लिया। ये कब से हो रहा है?'
        : lang === 'en'
          ? 'Got it. Since when is this happening?'
          : 'Theek hai — issue note kar liya. Ye kab se ho raha hai?';
    return { response: { type: 'answer', message: msg, cta: '', data: {} }, contextPatch: ctxPatch };
  }

  // Follow-up: "tell me more / thoda aur details" -> expand last KB answer instead of rerouting to booking.
  if (wantsMoreDetails(userText) && context.lastKbAnswerFacts && context.lastKbAnswerFacts.length >= 40) {
    const expanded = await expandAnswerPreservingFacts({ userText, answerFacts: context.lastKbAnswerFacts, lang });
    // Keep last KB memory fresh
    ctxPatch.lastKbAt = Date.now();
    return { response: { type: 'answer', message: expanded, cta: '', data: {} }, contextPatch: ctxPatch };
  }

  // Quick greeting / services handling (avoid forcing model+area on "hello")
  if (isGreeting(userText) && !context.greeted) {
    const msg =
      lang === 'en'
        ? "Hi! I'm MY FNG AI Assistant. How can I help — service, repair, cleaning, or workshop location?"
        : lang === 'hi'
          ? 'नमस्ते! मैं MY FNG AI Assistant हूँ। आपको क्या चाहिए — service, repair, cleaning, या workshop location?'
          : 'Hi! Main MY FNG AI Assistant hoon. Aapko kya chahiye — service, repair, cleaning, ya workshop location?';
    const cta =
      lang === 'en'
        ? 'Tell me what you want (service/repair/cleaning/location).'
        : lang === 'hi'
          ? 'बताइए आपको क्या चाहिए (service/repair/cleaning/location).'
          : 'Batao aapko kya chahiye (service/repair/cleaning/location).';
    ctxPatch.greeted = true;
    return { response: { type: 'answer', message: msg, cta, data: {} }, contextPatch: ctxPatch };
  }

  if (wantsServicesList(userText)) {
    const msg =
      lang === 'en'
        ? 'We can help with:\n- Periodic service\n- Repairs (AC, brakes, battery, etc.)\n- Cleaning/Detailing\n- Workshop location + booking'
        : lang === 'hi'
          ? 'हम इसमें help करते हैं:\n- Periodic service\n- Repairs (AC, brakes, battery वगैरह)\n- Cleaning/Detailing\n- Workshop location + booking'
          : 'Hum isme help karte hain:\n- Periodic service\n- Repairs (AC, brakes, battery, etc.)\n- Cleaning/Detailing\n- Workshop location + booking';
    const cta =
      lang === 'en'
        ? 'Which one do you need?'
        : lang === 'hi'
          ? 'आपको कौन‑सा चाहिए?'
          : 'Aapko kaunsa chahiye?';
    return { response: { type: 'answer', message: msg, cta, data: {} }, contextPatch: ctxPatch };
  }

  // CRITICAL: KB-first for informational questions.
  // If KB answer exists, return it directly (NO menu CTA, NO flow reset).
  const kbEligible =
    intent.intent === 'GeneralInfo' ||
    intent.intent === 'WarrantySupport' ||
    intent.intent === 'CleaningDetailing';
  if (kbEligible) {
    const raw = await answerFromFaqOrKb({ userText, lang });
    if (raw) {
      const answer = await rewritePreservingFacts({ userText, answerFacts: raw, lang });
      ctxPatch.lastKbQuery = userText.slice(0, 200);
      ctxPatch.lastKbAnswerFacts = raw.slice(0, 1200);
      ctxPatch.lastKbAt = Date.now();
      return { response: { type: 'answer', message: answer, cta: '', data: {} }, contextPatch: ctxPatch };
    }
  }

  // Payment link is a booking-side action; handle it before pricing routing.
  if (wantsPaymentNow(userText)) {
    // Force booking flow for payment link requests.
    ctxPatch.flow = 'BOOKING';
  }

  // Workshop location intent (live DB)
  if (intent.intent === 'WorkshopLocation') {
    // Guard against 0,0 and other bogus coords that pass Number.isFinite()
    if (!isValidLatLng(context.locationLat, context.locationLng) || !isLikelyIndiaLatLng(context.locationLat, context.locationLng)) {
      // City/area fallback: if user gave a city label, show verified workshops in that city (distance unknown).
      if (context.locationLabel && context.locationLabel.length >= 3) {
        try {
          const list = await fetchWorkshopsByCityOrPincode({ cityOrArea: context.locationLabel, limit: 5 });
          if (list.length > 0) {
            ctxPatch.flow = undefined;
            return { response: buildWorkshopReply({ lang, radiusKm: 0, workshops: list }), contextPatch: ctxPatch };
          }
        } catch {
          // ignore
        }
      }

      const msg =
        lang === 'en'
          ? 'Nearest workshop dikhane ke liye location allow kar do ya area/pincode bhejo.'
          : lang === 'hi'
            ? 'Nearest workshop दिखाने के लिए location allow कर दीजिए या area/pincode भेज दीजिए।'
            : 'Nearest workshop dikhane ke liye location allow kar do ya area/pincode bhejo.';
      ctxPatch.flow = 'WORKSHOP';
      return { response: { type: 'answer', message: msg, cta: 'Aapka area/pincode kya hai?', data: {} }, contextPatch: ctxPatch };
    }

    const { radiusKm, workshops } = await fetchNearestWorkshops({
      lat: context.locationLat as number,
      lng: context.locationLng as number,
      radiiKm: [15, 50, 100, 200],
      limit: 5,
    });
    // If nothing is within 200km, fall back to city/pincode list (distance unknown).
    if (!workshops || workshops.length === 0) {
      const pin = (() => {
        const raw = String(context.addressText || context.locationLabel || '');
        const m = raw.match(/\b(\d{6})\b/);
        return m?.[1] || null;
      })();
      const city = context.locationLabel || null;
      try {
        const list = await fetchWorkshopsByCityOrPincode({ cityOrArea: city, pincode: pin, limit: 5 });
        if (list.length > 0) return { response: buildWorkshopReply({ lang, radiusKm: 0, workshops: list }), contextPatch: ctxPatch };
      } catch {
        // ignore
      }
    }
    ctxPatch.flow = undefined;
    return { response: buildWorkshopReply({ lang, radiusKm, workshops }), contextPatch: ctxPatch };
  }

  // Pricing intent (DB-driven)
  if (!wantsPaymentNow(userText) && (intent.intent === 'PriceEnquiry' || intent.intent === 'PeriodicService')) {
    ctxPatch.flow = 'PRICING';
    // 1) Mandatory: service intent (service type) before asking pricing questions.
    if (!context.selectedServiceTypeId) {
      const msg =
        lang === 'en'
          ? 'Sure, I can help with pricing + nearby workshops.\nWhat service are you looking for today?'
          : lang === 'hi'
            ? 'ठीक है — मैं pricing + nearby workshops में help कर दूँगा।\nआज आपको कौन‑सी service चाहिए?'
            : 'Theek hai — main pricing + nearby workshops me help kar dunga.\nAaj aapko kaunsi service chahiye?';
      let cats: Array<{ uuid: string; category: string; description: string | null }> = [];
      try {
        cats = (await fetchActiveCategories()).slice(0, 9);
      } catch {
        cats = [];
      }
      return {
        response: {
          type: 'pricing',
          message: msg,
          cta: '',
          data: {
            ui: {
              kind: 'CATEGORY_CAROUSEL',
              title: lang === 'hi' ? 'Service categories' : 'Service categories',
              items: cats.map((c) => ({
                id: `__select__ CATEGORY ${c.uuid}`,
                label: c.category,
                subtitle: c.description ? c.description.slice(0, 60) : undefined,
              })),
            },
          },
        },
        contextPatch: ctxPatch,
      };
    }

    // Avoid asking phone aggressively; ask model+area first.
    if (missing.needsVehicleModel) {
      // If user clicked a car model suggestion, hydrate it from DB and proceed.
      if (context.carModelId) {
        try {
          const cm = await fetchCarModelById(context.carModelId);
          if (cm?.id) {
            ctxPatch.vehicleModel = `${cm.make} ${cm.model_name}`.trim();
            ctxPatch.vehicleClass = cm.class || undefined;
            ctxPatch.awaitingCarModelSelection = false;
            const locLabel = String(context.locationLabel || context.addressText || '').trim();
            const cta = locLabel
              ? lang === 'hi'
                ? `आपका area "${locLabel}" सही है? (हाँ / बदलना है)`
                : lang === 'en'
                  ? `Your area looks like "${locLabel}" — is that correct? (Yes / Change)`
                  : `Aapka area "${locLabel}" sahi hai? (Haan / Change)`
              : lang === 'hi'
                ? 'Aapka area/city ya pincode?'
                : lang === 'en'
                  ? 'Your area/city or pincode?'
                  : 'Aapka area/city ya pincode?';
            return {
              response: {
                type: 'pricing',
                message: lang === 'hi' ? `Done — ${ctxPatch.vehicleModel} noted.` : lang === 'en' ? `Done — noted ${ctxPatch.vehicleModel}.` : `Done — ${ctxPatch.vehicleModel} noted.`,
                cta,
                data: {},
              },
              contextPatch: ctxPatch,
            };
          }
        } catch {
          // ignore; fall through to prompt again
        }
      }

      // Try to match the typed model to DB; only accept if confident, otherwise show suggestions.
      const q = String(userText || '').trim();
      const candidates = q.length >= 2 ? await searchCarModels({ query: q, limit: 6 }) : [];
      const best = candidates[0] || null;
      const second = candidates[1] || null;
      const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const qn = norm(q);
      const bn = best ? norm(`${best.make} ${best.model_name}`) : '';
      const sn = second ? norm(`${second.make} ${second.model_name}`) : '';
      const confident =
        Boolean(best?.id) &&
        (bn === qn || bn.includes(qn) || qn.includes(bn)) &&
        // if second is almost the same, force user to choose
        !(sn && (sn === qn || sn.includes(qn)) && sn.length === bn.length);

      if (confident && best) {
        ctxPatch.carModelId = best.id;
        ctxPatch.vehicleModel = `${best.make} ${best.model_name}`.trim();
        ctxPatch.vehicleClass = best.class || undefined;
        ctxPatch.awaitingCarModelSelection = false;
        const locLabel = String(context.locationLabel || context.addressText || '').trim();
        const cta = locLabel
          ? lang === 'hi'
            ? `आपका area "${locLabel}" सही है? (हाँ / बदलना है)`
            : lang === 'en'
              ? `Your area looks like "${locLabel}" — is that correct? (Yes / Change)`
              : `Aapka area "${locLabel}" sahi hai? (Haan / Change)`
          : lang === 'hi'
            ? 'Aapka area/city ya pincode?'
            : lang === 'en'
              ? 'Your area/city or pincode?'
              : 'Aapka area/city ya pincode?';
        return {
          response: {
            type: 'pricing',
            message: lang === 'hi' ? `Done — ${ctxPatch.vehicleModel} noted.` : lang === 'en' ? `Done — noted ${ctxPatch.vehicleModel}.` : `Done — ${ctxPatch.vehicleModel} noted.`,
            cta,
            data: {},
          },
          contextPatch: ctxPatch,
        };
      }

      // Not confident: show suggestions (clickable)
      ctxPatch.awaitingCarModelSelection = true;
      const msg =
        lang === 'hi'
          ? 'Car model match clear nahi hua. Inme se select kar lo:'
          : lang === 'en'
            ? 'I couldn’t match the exact car model. Please select one:'
            : 'Car model match clear nahi hua. Inme se select kar lo:';
      const cta = lang === 'hi' ? 'Aapki car kaunsa hai?' : lang === 'en' ? 'Which car do you drive?' : 'Aapki car kaunsi hai?';
      return {
        response: {
          type: 'pricing',
          message: msg,
          cta: candidates.length ? '' : cta,
          data: candidates.length
            ? {
                ui: {
                  kind: 'CATEGORY_CAROUSEL',
                  title: 'Car model suggestions',
                  items: candidates.map((c) => ({
                    id: `__select__ CAR_MODEL ${c.id}`,
                    label: `${c.make} ${c.model_name}`.trim(),
                    // Keep class hidden from user; we store it internally after selection for correct pricing.
                    subtitle: undefined,
                  })),
                },
              }
            : {},
        },
        contextPatch: ctxPatch,
      };
    }

    // 2) Location confirm (already present from website) before last service + pricing
    if (context.locationLabel && missing.needsLocationConfirm) {
      const msg =
        lang === 'hi'
          ? `आपका area "${context.locationLabel}" है — सही है?`
          : lang === 'en'
            ? `Your area looks like "${context.locationLabel}" — is that correct?`
            : `Aapka area "${context.locationLabel}" hai — sahi hai?`;
      const cta = lang === 'hi' ? 'हाँ / बदलना है' : lang === 'en' ? 'Yes / Change' : 'Haan / Change';
      return { response: { type: 'pricing', message: msg, cta, data: {} }, contextPatch: ctxPatch };
    }
    if (!context.locationLabel && missing.needsLocationConfirm) {
      const msg =
        lang === 'hi'
          ? 'Pricing check ke liye area/city chahiye.'
          : lang === 'en'
            ? 'To check pricing, I need your area/city.'
            : 'Pricing check ke liye area/city chahiye.';
      const cta = lang === 'hi' ? 'आपका area/city कौन‑सा है?' : lang === 'en' ? 'Which area/city are you in?' : 'Aapka area/city kaunsa hai?';
      return { response: { type: 'pricing', message: msg, cta, data: {} }, contextPatch: ctxPatch };
    }

    // 3) Mandatory: last service done month/year (before showing any price)
    if (!context.lastServiceDoneAt) {
      const msg =
        lang === 'en'
          ? 'One quick question before I share pricing:\nWhen was your last car service done? (month/year is fine)'
          : lang === 'hi'
            ? 'Pricing share karne se pehle ek quick question:\nAapki last service kab hui thi? (month/year chalega)'
            : 'Pricing share karne se pehle ek quick question:\nAapki last service kab hui thi? (month/year chalega)';
      const cta = lang === 'en' ? 'Example: Sep 2025 / 3 months ago' : lang === 'hi' ? 'Example: Sep 2025 / 3 mahine pehle' : 'Example: Sep 2025 / 3 mahine pehle';
      return { response: { type: 'pricing', message: msg, cta, data: {} }, contextPatch: ctxPatch };
    }

    // 4) Ask mobile for exact price (after service selection + model + last service date).
    // Show service checklist without price.
    if (!context.customerPhone) {
      let checklist: { title?: string; points?: number; items: string[] } | null = null;
      try {
        if (context.selectedServiceTypeId) checklist = await fetchServiceTypeChecklistTemplate(context.selectedServiceTypeId);
      } catch {
        checklist = null;
      }
      const head =
        lang === 'hi'
          ? `Selected: ${context.selectedServiceTypeName || 'Service'}`
          : lang === 'en'
            ? `Selected: ${context.selectedServiceTypeName || 'Service'}`
            : `Selected: ${context.selectedServiceTypeName || 'Service'}`;
      const short = checklist?.items?.length
        ? checklist.items.slice(0, 3).map((x) => `- ${x}`).join('\n') + (checklist.items.length > 3 ? `\n+${checklist.items.length - 3} more` : '')
        : '';
      const msg =
        lang === 'en'
          ? `${head}\n${short}\nExact price share karne se pehle mobile number chahiye (confirmation ke liye).`
          : lang === 'hi'
            ? `${head}\n${short}\nExact price share karne se pehle mobile number chahiye (confirmation ke liye).`
            : `${head}\n${short}\nExact price share karne se pehle mobile number chahiye (confirmation ke liye).`;
      const cta = lang === 'en' ? 'Share your 10-digit mobile number' : lang === 'hi' ? '10-digit mobile number bhej दीजिए' : '10-digit mobile number bhej do';
      return {
        response: {
          type: 'pricing',
          message: msg,
          cta,
          data: checklist
            ? {
                ui: {
                  kind: 'DUAL_CAROUSEL',
                  title: 'Selected service',
                  category: context.selectedCategoryName || 'Service',
                  packages: [],
                  services: [
                    {
                      suggestion: { kind: 'SERVICE_TYPE', id: context.selectedServiceTypeId, name: context.selectedServiceTypeName || 'Service' },
                      exactPrice: null,
                      checklistItems: checklist.items,
                      checklistNote: checklist.title || null,
                    },
                  ],
                },
              }
            : {},
        },
        contextPatch: ctxPatch,
      };
    }

    // 5) Now show price for ONLY the selected service type (zone-wise)
    const locText = context.locationLabel || context.addressText || null;
    if (!locText) {
      const msg =
        lang === 'hi'
          ? 'Sahi city/location ke bina exact price match nahi ho paayega.'
          : lang === 'en'
            ? 'I need your area/city to match the correct price.'
            : 'Sahi city/location ke bina exact price match nahi ho paayega.';
      const cta = lang === 'hi' ? 'Aapka area/city ya pincode?' : lang === 'en' ? 'Your area/city or pincode?' : 'Aapka area/city ya pincode?';
      return { response: { type: 'pricing', message: msg, cta, data: {} }, contextPatch: ctxPatch };
    }
    try {
      const sid = context.selectedServiceTypeId;
      const name = context.selectedServiceTypeName || 'Service';
      if (!sid) return { response: { type: 'pricing', message: 'Service select kar lo please.', cta: '', data: {} }, contextPatch: ctxPatch };

      const vehicleClass = context.vehicleClass || (context.vehicleModel ? await inferVehicleClassFromModelText(context.vehicleModel) : null);
      const priceMap = await fetchZoneWisePricesForServiceTypes({ serviceTypeIds: [sid], locationText: locText, vehicleClass });
      const price = priceMap[sid] ?? null;
      const checklist = await fetchServiceTypeChecklistTemplate(sid);

      if (price == null) {
        const msg =
          lang === 'hi'
            ? 'Is location ke liye exact price match nahi ho paaya. Aap apna area/pincode share kar do, main city-wise price dikha deta hoon.'
            : lang === 'en'
              ? 'I couldn’t match the exact price for your location. Share your area/pincode and I’ll show the correct city-wise price.'
              : 'Exact price match nahi ho paaya. Area/pincode share kar do, main correct price dikha deta hoon.';
        const cta = lang === 'hi' ? 'Area/pincode?' : lang === 'en' ? 'Area/pincode?' : 'Area/pincode?';
        return { response: { type: 'pricing', message: msg, cta, data: {} }, contextPatch: ctxPatch };
      }

      const msg =
        lang === 'hi'
          ? `Price for ${name}: ${typeof price === 'number' ? `₹${Math.round(price)}` : 'On inspection'}`
          : lang === 'en'
            ? `Price for ${name}: ${typeof price === 'number' ? `₹${Math.round(price)}` : 'On inspection'}`
            : `Price for ${name}: ${typeof price === 'number' ? `₹${Math.round(price)}` : 'On inspection'}`;

      const cta =
        lang === 'hi'
          ? 'Book karna hai? (pickup / self-visit)'
          : lang === 'en'
            ? 'Do you want to book? (pickup / self-visit)'
            : 'Book karna hai? (pickup / self-visit)';

      return {
        response: {
          type: 'pricing',
          message: msg,
          cta,
          data: checklist
            ? {
                ui: {
                  kind: 'DUAL_CAROUSEL',
                  title: 'Selected service',
                  category: context.selectedCategoryName || 'Service',
                  packages: [],
                  services: [
                    {
                      suggestion: { kind: 'SERVICE_TYPE', id: sid, name },
                      exactPrice: typeof price === 'number' ? price : null,
                      checklistItems: checklist.items,
                      checklistNote: checklist.title || null,
                    },
                  ],
                },
              }
            : {},
        },
        contextPatch: ctxPatch,
      };
    } catch {
      // ignore
    }
    return { response: { type: 'pricing', message: 'Price fetch nahi ho paaya. Please try again.', cta: '', data: {} }, contextPatch: ctxPatch };
  }

  // Booking request (sales) + optional payment link
  if (intent.intent === 'BookingRequest' || wantsPaymentNow(userText)) {
    ctxPatch.flow = 'BOOKING';

    // If coming from PRICING and user chose pickup/self-visit, capture it and ask preferred slot time.
    if (context.flow === 'PRICING' && wantsPickupOrSelfVisit(userText)) {
      ctxPatch.pickupPreference = /(self\s*visit|self-visit|self\s*drop|walk\s*in)/i.test(userText) ? 'SELF_VISIT' : 'PICKUP';
      ctxPatch.awaitingSlotText = true;
      const msg =
        lang === 'hi'
          ? 'Perfect. Preferred date & time bata do (Example: कल 11 AM).'
          : lang === 'en'
            ? 'Perfect. Share your preferred date & time (Example: tomorrow 11 AM).'
            : 'Perfect. Preferred date & time bata do (Example: kal 11 AM).';
      return { response: { type: 'booking', message: msg, cta: '', data: {} }, contextPatch: ctxPatch };
    }

    // If we asked for preferred slot, capture it.
    if (context.awaitingSlotText && !context.preferredSlotText) {
      const t = String(userText || '').trim();
      if (t && t.length >= 3 && t.length <= 60) {
        ctxPatch.preferredSlotText = t;
        ctxPatch.awaitingSlotText = false;
      }
    }

    // Require slot before creating lead (pickup/self-visit appointment time)
    if (!context.preferredSlotText && !ctxPatch.preferredSlotText) {
      // if the user already said pickup/self-visit but we didn't capture slot yet
      if (context.pickupPreference || ctxPatch.pickupPreference) {
        ctxPatch.awaitingSlotText = true;
        const msg =
          lang === 'hi'
            ? 'Preferred date & time bata do (Example: कल 11 AM).'
            : lang === 'en'
              ? 'Share your preferred date & time (Example: tomorrow 11 AM).'
              : 'Preferred date & time bata do (Example: kal 11 AM).';
        return { response: { type: 'booking', message: msg, cta: '', data: {} }, contextPatch: ctxPatch };
      }
    }

    // Booking MUST know which service is being booked.
    if (!context.selectedServiceTypeId) {
      const msg =
        lang === 'en'
          ? 'Sure — booking ke liye pehle service select karni hogi.'
          : lang === 'hi'
            ? 'ठीक है — booking के लिए पहले service select करनी होगी।'
            : 'Theek hai — booking ke liye pehle service select karni hogi.';
      let cats: Array<{ uuid: string; category: string; description: string | null }> = [];
      try {
        cats = (await fetchActiveCategories()).slice(0, 9);
      } catch {
        cats = [];
      }
      return {
        response: {
          type: 'booking',
          message: msg,
          cta: '',
          data: {
            ui: {
              kind: 'CATEGORY_CAROUSEL',
              title: lang === 'hi' ? 'Service categories' : 'Service categories',
              items: cats.map((c) => ({
                id: `__select__ CATEGORY ${c.uuid}`,
                label: c.category,
                subtitle: c.description ? c.description.slice(0, 60) : undefined,
              })),
            },
          },
        },
        contextPatch: ctxPatch,
      };
    }

    // If we were waiting for payment-link consent, handle "yes/no" here (no loops, no KB).
    if (context.awaitingPaymentLinkConsent && context.leadId && !wantsPaymentNow(userText)) {
      if (isAffirmative(userText)) {
        const pay = await createBookingTokenPaymentLink(context.leadId);
        ctxPatch.awaitingPaymentLinkConsent = false;
        ctxPatch.invoiceId = pay.invoiceId;
        ctxPatch.invoiceNumber = pay.invoiceNumber;
        ctxPatch.paymentLink = pay.paymentLink;
        ctxPatch.flow = undefined;
        const msg =
          lang === 'hi'
            ? `Done — payment link ready.\n${pay.paymentLink}`
            : lang === 'en'
              ? `Done — here is your payment link:\n${pay.paymentLink}`
              : `Done — payment link ready.\n${pay.paymentLink}`;
        return { response: { type: 'booking', message: msg, cta: '', data: { leadId: context.leadId, paymentLink: pay.paymentLink } }, contextPatch: ctxPatch };
      }
      if (isNegative(userText)) {
        ctxPatch.awaitingPaymentLinkConsent = false;
        ctxPatch.flow = undefined;
        const msg =
          lang === 'hi'
            ? 'Theek hai — aap jab chaho tab “payment link” bol dena.'
            : lang === 'en'
              ? 'No worries — whenever you want, just type “payment link”.'
              : 'Theek hai — jab chaho “payment link” bol dena.';
        return { response: { type: 'booking', message: msg, cta: '', data: { leadId: context.leadId } }, contextPatch: ctxPatch };
      }
      // If unclear, ask once again (but keep it short)
      const cta = lang === 'hi' ? 'Payment link chahiye? (yes/no)' : lang === 'en' ? 'Do you want a payment link? (yes/no)' : 'Payment link chahiye? (yes/no)';
      return { response: { type: 'booking', message: '', cta, data: { leadId: context.leadId } }, contextPatch: ctxPatch };
    }

    // If lead already exists, don't loop booking questions (pickup/self, etc).
    // Only allow payment-link flow after lead exists.
    if (context.leadId && !wantsPaymentNow(userText)) {
      ctxPatch.flow = undefined;
      ctxPatch.awaitingPaymentLinkConsent = true;
      const msg =
        lang === 'hi'
          ? 'Done — aapki booking request already note ho chuki hai. Expert aapko call karke time confirm kar dega.'
          : lang === 'en'
            ? 'Done — your booking request is already noted. Our expert will call to confirm the time.'
            : 'Done — aapki booking request already note ho chuki hai. Expert call karke time confirm kar dega.';
      const cta =
        lang === 'hi'
          ? 'Payment link chahiye? (yes/no)'
          : lang === 'en'
            ? 'Do you want a payment link? (yes/no)'
            : 'Payment link chahiye? (yes/no)';
      return { response: { type: 'booking', message: msg, cta, data: { leadId: context.leadId } }, contextPatch: ctxPatch };
    }

    // If payment link requested but no lead yet, run booking capture first.
    // Minimal booking requirements: model + area + pickup/self + phone (only when booking).
    if (missing.needsVehicleModel) {
      const cta = lang === 'hi' ? 'आपकी कार का मॉडल क्या है? (Example: Hyundai i20)' : lang === 'en' ? 'What is your car model?' : 'Aapki car model kya hai?';
      const msg =
        lang === 'hi' ? 'Booking start karne ke liye car model chahiye.' : lang === 'en' ? 'To start booking, I need your car model.' : 'Booking start karne ke liye car model chahiye.';
      return { response: { type: 'booking', message: msg, cta, data: {} }, contextPatch: ctxPatch };
    }
    if (!context.locationLabel && missing.needsLocationConfirm) {
      const msg =
        lang === 'hi'
          ? 'Booking ke liye area/city chahiye.'
          : lang === 'en'
            ? 'To book, I need your area/city.'
            : 'Booking ke liye area/city chahiye.';
      const cta = lang === 'hi' ? 'आपका area/city कौन‑सा है?' : lang === 'en' ? 'Which area/city are you in?' : 'Aapka area/city kaunsa hai?';
      return { response: { type: 'booking', message: msg, cta, data: {} }, contextPatch: ctxPatch };
    }
    // If we have a label but not confirmed yet, ask once.
    if (context.locationLabel && missing.needsLocationConfirm) {
      const msg =
        lang === 'hi'
          ? `आपका एरिया "${context.locationLabel}" है — सही है?`
          : lang === 'en'
            ? `Your area looks like "${context.locationLabel}" — is that correct?`
            : `Aapka area "${context.locationLabel}" hai — sahi hai?`;
      const cta = lang === 'hi' ? 'हाँ / बदलना है' : lang === 'en' ? 'Yes / Change' : 'Haan / Change';
      return { response: { type: 'booking', message: msg, cta, data: {} }, contextPatch: ctxPatch };
    }
    if (missing.needsPickupPreference) {
      const msg =
        lang === 'hi'
          ? 'Pickup & drop free hai 🚗'
          : lang === 'en'
            ? 'Pickup & drop is free 🚗'
            : 'Pickup & drop free hai 🚗';
      const cta = lang === 'hi' ? 'Pickup chahiye ya self-visit?' : lang === 'en' ? 'Pickup or self-visit?' : 'Pickup chahiye ya self-visit?';
      return { response: { type: 'booking', message: msg, cta, data: {} }, contextPatch: ctxPatch };
    }
    if (missing.needsPhone) {
      const msg =
        lang === 'hi'
          ? 'Confirm booking ke liye callback number chahiye.'
          : lang === 'en'
            ? 'To confirm booking, I need a callback number.'
            : 'Confirm booking ke liye callback number chahiye.';
      const cta = lang === 'hi' ? 'कॉलबैक के लिए 10-digit नंबर शेयर कर दीजिए।' : lang === 'en' ? 'Share your 10-digit mobile number.' : '10-digit mobile number share kar do.';
      return { response: { type: 'booking', message: msg, cta, data: {} }, contextPatch: ctxPatch };
    }
    if (!context.vehicleNumber) {
      const msg =
        lang === 'hi'
          ? 'Booking confirm karne ke liye vehicle number chahiye.'
          : lang === 'en'
            ? 'To confirm booking, I need the vehicle number.'
            : 'Booking confirm karne ke liye vehicle number chahiye.';
      const cta = lang === 'hi' ? 'Vehicle number bhej do (Example: MH12AB1234)' : lang === 'en' ? 'Share vehicle number (Example: MH12AB1234)' : 'Vehicle number bhej do (Example: MH12AB1234)';
      return { response: { type: 'booking', message: msg, cta, data: {} }, contextPatch: ctxPatch };
    }

    // Create a lead in DB (schema requires phone + vehicle number + service_type).
    const lead = context.leadId
      ? { leadId: context.leadId, leadNumber: '' }
      : await createServiceLead({
          customerName: 'Customer',
          customerPhone: context.customerPhone as string,
          vehicleNumber: context.vehicleNumber as string,
          vehicleModel: context.vehicleModel || null,
          serviceTypeLabel: context.selectedServiceTypeName || context.selectedCategoryName || (intent.intent === 'BookingRequest' ? 'Service Booking' : 'Payment Request'),
          pickupRequired: context.pickupPreference !== 'SELF_VISIT',
          addressText: context.locationLabel || context.addressText || null,
          lat: (context.locationLat as number) || null,
          lng: (context.locationLng as number) || null,
          problemDescription: `${userText.slice(0, 160)}${context.preferredSlotText ? ` | Preferred: ${context.preferredSlotText}` : ''}`.slice(0, 240),
        });

    ctxPatch.leadId = lead.leadId;
    ctxPatch.flow = undefined;

    // Payment link (invoice flow) if asked
    let paymentLink: string | null = null;
    if (wantsPaymentNow(userText)) {
      const pay = await createBookingTokenPaymentLink(lead.leadId);
      paymentLink = pay.paymentLink;
      ctxPatch.invoiceId = pay.invoiceId;
      ctxPatch.invoiceNumber = pay.invoiceNumber;
      ctxPatch.paymentLink = pay.paymentLink;
      ctxPatch.awaitingPaymentLinkConsent = false;
    }

    const base =
      lang === 'en'
        ? 'Done — booking request created. Our expert will call to confirm.'
        : lang === 'hi'
          ? 'Done — booking create ho gayi. Expert call karke confirm kar dega.'
          : 'Done — booking create ho gayi. Expert call karke confirm kar dega.';
    const msg = paymentLink ? `${base}\nPayment link: ${paymentLink}` : base;
    const cta =
      paymentLink
        ? ''
        : lang === 'en'
          ? 'Do you want a payment link? (yes/no)'
          : lang === 'hi'
            ? 'Payment link chahiye? (yes/no)'
            : 'Payment link chahiye? (yes/no)';

    if (!paymentLink) ctxPatch.awaitingPaymentLinkConsent = true;
    return { response: { type: 'booking', message: msg, cta, data: { leadId: lead.leadId, paymentLink } }, contextPatch: ctxPatch };
  }

  if (intent.intent === 'HumanEscalation') {
    return { response: buildEscalationReply({ lang }), contextPatch: ctxPatch };
  }

  // General info / warranty / repairs / cleaning: prefer KB answer (facts preserved), then rewrite.
  const raw = await answerFromFaqOrKb({ userText, lang });
  const answer = raw ? await rewritePreservingFacts({ userText, answerFacts: raw, lang }) : null;
  const base = buildAnswerReply({ lang, intent: intent.intent, answer });

  // Location confirm CTA (website sends locationLabel). Ask once, without hijacking the answer.
  if (context.locationLabel && missing.needsLocationConfirm) {
    const cta =
      lang === 'hi'
        ? `आपका एरिया "${context.locationLabel}" सही है? (हाँ / बदलना है)`
        : lang === 'en'
          ? `Your area looks like "${context.locationLabel}" — correct? (Yes / Change)`
          : `Aapka area "${context.locationLabel}" sahi hai? (Haan / Change)`;
    return { response: { ...base, cta, data: { ...base.data, locationLabel: context.locationLabel } }, contextPatch: ctxPatch };
  }

  return { response: base, contextPatch: ctxPatch };
}


