import type { ChatbotV2Context, ChatbotV2Response, ClassifiedIntent, MissingInfo, UserLang } from './types';
import {
  createBookingTokenPaymentLink,
  createServiceLead,
  fetchNearestWorkshops,
  fetchPeriodicServicePricing,
  fetchWorkshopsByCityOrPincode,
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
    intent.intent === 'RepairIssue' ||
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
    // Avoid asking phone aggressively; ask model+area first.
    if (missing.needsVehicleModel) {
      const cta = lang === 'hi' ? 'आपकी कार का मॉडल क्या है? (Example: Hyundai i20)' : lang === 'en' ? 'What is your car model? (Example: Hyundai i20)' : 'Aapki car model kya hai? (Example: Hyundai i20)';
      const msg =
        lang === 'hi'
          ? 'Pricing car model ke hisaab se change hoti hai.'
          : lang === 'en'
            ? 'Pricing depends on your car model.'
            : 'Pricing car model ke hisaab se change hoti hai.';
      return { response: { type: 'pricing', message: msg, cta, data: {} }, contextPatch: ctxPatch };
    }
    if (missing.needsLocationConfirm) {
      const msg =
        lang === 'hi'
          ? 'Area/city ke hisaab se bhi pricing thodi change hoti hai.'
          : lang === 'en'
            ? 'Pricing can vary slightly by area/city.'
            : 'Area/city ke hisaab se bhi pricing thodi change hoti hai.';
      const cta = lang === 'hi' ? 'आपका area/city कौन‑सा है?' : lang === 'en' ? 'Which area/city are you in?' : 'Aapka area/city kaunsa hai?';
      return { response: { type: 'pricing', message: msg, cta, data: {} }, contextPatch: ctxPatch };
    }

    // Zone-wise pricing (city -> zone) if we have a usable location text
    const locText = context.locationLabel || context.addressText || null;
    let items = await fetchPeriodicServicePricing();
    try {
      if (locText) {
        const zoneItems = await fetchZoneWisePeriodicServicePricing({ locationText: locText, vehicleClass: null });
        // If we got real prices, prefer them
        if (zoneItems.some((x) => typeof x.price === 'number')) items = zoneItems;
      }
    } catch {
      // ignore, keep default pricing
    }
    return { response: buildPricingReply({ lang, items }), contextPatch: ctxPatch };
  }

  // Booking request (sales) + optional payment link
  if (intent.intent === 'BookingRequest' || wantsPaymentNow(userText)) {
    ctxPatch.flow = 'BOOKING';
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
          serviceTypeLabel: intent.intent === 'BookingRequest' ? 'Service Booking' : 'Payment Request',
          pickupRequired: context.pickupPreference !== 'SELF_VISIT',
          addressText: context.locationLabel || context.addressText || null,
          lat: (context.locationLat as number) || null,
          lng: (context.locationLng as number) || null,
          problemDescription: userText.slice(0, 220),
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
    }

    const base =
      lang === 'en'
        ? 'Done — booking request noted.'
        : lang === 'hi'
          ? 'हो गया — booking request note कर लिया।'
          : 'Done — booking request note kar li.';
    const msg = paymentLink ? `${base}\nPayment link: ${paymentLink}` : base;
    const cta = lang === 'en' ? 'Pickup chahiye ya self-visit?' : lang === 'hi' ? 'Pickup चाहिए या self-visit?' : 'Pickup chahiye ya self-visit?';

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


