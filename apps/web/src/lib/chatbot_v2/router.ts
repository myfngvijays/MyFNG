import type { ChatbotV2Context, ChatbotV2Response, ClassifiedIntent, MissingInfo, UserLang } from './types';
import { createBookingTokenPaymentLink, createServiceLead, fetchNearestWorkshops, fetchPeriodicServicePricing } from './db/supabase';
import { answerFromFaqOrKb } from './kb/retriever';
import { buildAnswerReply, buildEscalationReply, buildPricingReply, buildWorkshopReply } from './reply/builder';
import { rewritePreservingFacts } from './reply/language';

function wantsPaymentNow(msg: string) {
  return /(pay\s*now|payment\s*link|upi\s*link|pay link|pay online|booking token|advance)/i.test(msg || '');
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

  // Payment link is a booking-side action; handle it before pricing routing.
  if (wantsPaymentNow(userText)) {
    // Force booking flow for payment link requests.
    ctxPatch.flow = 'BOOKING';
  }

  // Workshop location intent (live DB)
  if (intent.intent === 'WorkshopLocation') {
    if (!Number.isFinite(context.locationLat as number) || !Number.isFinite(context.locationLng as number)) {
      const msg =
        lang === 'en'
          ? 'Nearest workshop dikhane ke liye location allow kar do ya area/pincode bhejo.'
          : lang === 'hi'
            ? 'Nearest workshop दिखाने के लिए location allow कर दीजिए या area/pincode भेज दीजिए।'
            : 'Nearest workshop dikhane ke liye location allow kar do ya area/pincode bhejo.';
      return { response: { type: 'answer', message: msg, cta: 'Aapka area/pincode kya hai?', data: {} }, contextPatch: ctxPatch };
    }

    const { radiusKm, workshops } = await fetchNearestWorkshops({
      lat: context.locationLat as number,
      lng: context.locationLng as number,
      radiiKm: [15, 50, 100, 200],
      limit: 5,
    });
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

    const items = await fetchPeriodicServicePricing();
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


