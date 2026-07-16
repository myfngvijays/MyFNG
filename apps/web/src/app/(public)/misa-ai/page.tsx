'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Bot, Menu, X } from 'lucide-react';
import { createChatPaymentOrder, initializeRazorpayCheckout, loadRazorpayScript } from '@/lib/services/paymentService';
import {
  assistantMessageShowsServiceList,
  MisaCategoryCards,
  MisaPrimePanel,
  MisaServiceGrid,
} from './components/MisaServicePicker';
import { assistantNeedsMobileVerification, MisaVerificationPanel } from './components/MisaVerificationPanel';
import { assistantAsksForCar, MisaCarPicker } from './components/MisaCarPicker';
import {
  extractPricingTitle,
  MisaPricingPicker,
  parsePricingPlansFromText,
} from './components/MisaPricingPicker';
import {
  assistantAsksForPickupDate,
  assistantAsksForPickupTime,
  extractPickupDatePrompt,
  extractPickupTimePrompt,
  MisaPickupDatePicker,
  MisaPickupTimePicker,
} from './components/MisaDateTimePicker';
import { assistantAsksForVehicleNumber, MisaVehicleNumberInput } from './components/MisaVehicleNumberInput';
import { assistantAsksForPincode, MisaPincodeInput } from './components/MisaPincodeInput';
import { assistantAsksForName, MisaNameInput } from './components/MisaNameInput';
import {
  assistantShowsBookingSummary,
  extractBookingSummaryPrompt,
  MisaBookingSummaryCard,
  parseBookingSummary,
} from './components/MisaBookingSummaryCard';

type ChatRole = 'user' | 'assistant';
type UiSuggestion = {
  optionNumber?: number;
  kind: 'SERVICE_TYPE' | 'PACKAGE' | 'RSA';
  id: string;
  name: string;
  exactPrice?: number | null;
  checklistItems?: string[];
  checklistNote?: string | null;
};
type UiPayload =
  | { kind: 'CATEGORY_CAROUSEL'; title?: string; items: Array<{ id: string; label: string; subtitle?: string }> }
  | { kind: 'DUAL_CAROUSEL'; title?: string; category: string; packages: UiSuggestion[]; services: UiSuggestion[] }
  | {
      kind: 'WORKSHOP_CAROUSEL';
      title?: string;
      items: Array<{
        id: string;
        name: string;
        subtitle?: string;
        km?: number | null;
        imageUrl?: string | null;
        mapLink?: string | null;
        rating?: number | null;
        usp?: string | null;
      }>;
    };
type ChatMsg = {
  id: string;
  role: ChatRole;
  text: string;
  suggestions?: UiSuggestion[];
  ui?: UiPayload;
};

const STORAGE_KEY = 'myfng_ai_chat_state_v2';
const CHANNEL_NAME = 'myfng_ai_chat_channel_v2';
const REQUEST_TIMEOUT_MS = 45000;
const LOCATION_TTL_MS = 15 * 60 * 1000; // refresh location every 15 min to keep "near workshop" accurate
const DETECTED_CITY_KEY = 'detected_city';
const DETECTED_CITY_TS_KEY = 'detected_city_timestamp';

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const QUICK_PROMPTS = [
  'Car service book karni hai',
  'Periodic service price batao',
  'AC cooling kam hai',
  'Nearest workshop dikhao',
];

function MisaAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-secondary to-brand-primary shadow-sm shadow-brand-primary/25`}
    >
      <Bot className={`${icon} text-white`} />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="mb-6 flex items-start gap-2.5">
      <MisaAvatar size="sm" />
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-brand-primary/15 bg-gradient-to-br from-brand-primary/5 to-white px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-brand-primary [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-brand-primary [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-brand-primary [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export default function AIBookingPage() {
  // Next.js requires useSearchParams() to be wrapped in Suspense.
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <AIBookingPageInner />
    </Suspense>
  );
}

function AIBookingPageInner() {
  // V2 is now the only chatbot experience.
  const CHAT_API = '/api/chatbot/v2';
  const searchParams = useSearchParams();
  const isEmbed = searchParams.get('embed') === '1';

  const [chatDraft, setChatDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatConnected, setChatConnected] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [suggestionModal, setSuggestionModal] = useState<UiSuggestion | null>(null);
  const [showPrimeInChat, setShowPrimeInChat] = useState(false);
  const [showOtherServices, setShowOtherServices] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [dismissedSummaryIds, setDismissedSummaryIds] = useState<Set<string>>(() => new Set());

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>(() => [
    {
      id: 'm0',
      role: 'assistant',
      text: "Hi! I'm MISA — MyFNG Instant Service Assistant.\nAapko kya help chahiye — service, repair, cleaning, ya workshop location?",
    },
  ]);

  // Use full booking workflow (exact pricing + lead creation + paynow button),
  // while keeping doc-mode available for other channels if enabled.
  const [chatContext, setChatContext] = useState<any>({ docMode: false });
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const lastAppliedSyncAtRef = useRef<number>(0);

  const stageNow: string = chatContext?.conversationStage || 'INITIAL';

  const channel = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return null;
    }
  }, [CHANNEL_NAME]);

  // Load persisted state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = safeParseJson<any>(window.localStorage.getItem(STORAGE_KEY));
    const incomingAt = typeof saved?.updatedAt === 'number' ? saved.updatedAt : 0;
    if (incomingAt) lastAppliedSyncAtRef.current = incomingAt;
    if (saved?.chatMessages?.length) setChatMessages(saved.chatMessages);
    if (saved?.chatContext) {
      const ctx = { ...(saved.chatContext || {}), docMode: false };
      // Always re-capture current location on page open.
      // (Prevents stale Mumbai coords when user is actually in Delhi.)
      delete (ctx as any).locationLat;
      delete (ctx as any).locationLng;
      delete (ctx as any).locationLabel;
      delete (ctx as any).addressText;
      delete (ctx as any).locationCapturedAt;

      // IMPORTANT: avoid leaking previous user's sensitive fields into a fresh chat.
      // This also prevents "price without asking mobile" if customerPhone was stored from an older session.
      const isFreshChat = !Array.isArray(saved?.chatMessages) || saved.chatMessages.length <= 1;
      if (isFreshChat) {
        delete (ctx as any).customerPhone;
        delete (ctx as any).vehicleNumber;
        delete (ctx as any).leadId;
        delete (ctx as any).invoiceId;
        delete (ctx as any).invoiceNumber;
        delete (ctx as any).paymentLink;
        delete (ctx as any).awaitingPaymentLinkConsent;
      }
      setChatContext(ctx);
    }
  }, []);

  // Fallback: use selected city from the main navbar (stored in localStorage).
  // This keeps pricing stable on /misa-ai even if GPS/reverse-geocode isn't available.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const existing = String(chatContext?.locationLabel || '').trim();
    if (existing) return;
    const storedCity = String(window.localStorage.getItem(DETECTED_CITY_KEY) || '').trim();
    if (!storedCity) return;
    const ts = Number(window.localStorage.getItem(DETECTED_CITY_TS_KEY) || 0);
    const isFresh = !Number.isFinite(ts) || ts <= 0 ? true : Date.now() - ts < 30 * 24 * 60 * 60 * 1000;
    if (!isFresh) return;
    setChatContext((prev: any) => ({
      ...(prev || {}),
      locationLabel: prev?.locationLabel || storedCity,
    }));
  }, [chatContext?.locationLabel]);

  // Load Razorpay checkout script
  useEffect(() => {
    loadRazorpayScript().then((ok) => setRazorpayReady(ok));
  }, []);

  // Persist + broadcast
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      chatMessages,
      chatContext,
      updatedAt: Date.now(),
    };
    lastAppliedSyncAtRef.current = payload.updatedAt;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    channel?.postMessage({ type: 'SYNC', payload });
  }, [chatMessages, chatContext, channel]);

  // Receive sync
  useEffect(() => {
    if (!channel) return;
    const handler = (ev: MessageEvent) => {
      const msg = ev.data;
      if (msg?.type !== 'SYNC') return;
      const payload = msg.payload;
      const incomingAt = typeof payload?.updatedAt === 'number' ? payload.updatedAt : 0;
      // Ignore payloads without monotonic timestamp to prevent accidental overwrites.
      if (!incomingAt) return;
      if (incomingAt <= lastAppliedSyncAtRef.current) return;
      lastAppliedSyncAtRef.current = incomingAt;
      if (payload?.chatMessages?.length) setChatMessages(payload.chatMessages);
      if (payload?.chatContext) setChatContext({ ...(payload.chatContext || {}), docMode: false });
    };
    channel.addEventListener('message', handler);
    return () => channel.removeEventListener('message', handler);
  }, [channel]);

  // Sync across tabs via storage event
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const payload = safeParseJson<any>(e.newValue);
      const incomingAt = typeof payload?.updatedAt === 'number' ? payload.updatedAt : 0;
      if (!incomingAt) return;
      if (incomingAt <= lastAppliedSyncAtRef.current) return;
      lastAppliedSyncAtRef.current = incomingAt;
      if (payload?.chatMessages?.length) setChatMessages(payload.chatMessages);
      if (payload?.chatContext) setChatContext({ ...(payload.chatContext || {}), docMode: false });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Autoscroll
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages.length, chatLoading]);

  // Best-effort: capture coords + address (same as homepage widget)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('geolocation' in navigator)) return;

    const lastAt = typeof chatContext?.locationCapturedAt === 'number' ? chatContext.locationCapturedAt : 0;
    const hasCoords = Number.isFinite(chatContext?.locationLat) && Number.isFinite(chatContext?.locationLng);
    const isFresh = lastAt && Date.now() - lastAt < LOCATION_TTL_MS;
    if (hasCoords && isFresh) return;

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (cancelled) return;
          setChatContext((prev: any) => ({
            ...(prev || {}),
            locationLat: lat,
            locationLng: lng,
            locationCapturedAt: Date.now(),
          }));

          const res = await fetch(`/api/location/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`);
          if (!res.ok) return;
          const data: any = await res.json();
          const display = String(data?.displayName || '').trim();
          if (!display) return;
          if (cancelled) return;
          const shortLabel = String(data?.shortLabel || '').trim();
          setChatContext((prev: any) => ({
            ...(prev || {}),
            addressText: display,
            locationLabel: shortLabel || prev?.locationLabel,
            locationLat: lat,
            locationLng: lng,
            locationCapturedAt: Date.now(),
          }));
        } catch {
          // ignore
        }
      },
      () => {},
      // maxAge=0 ensures we don't reuse very old cached GPS for "near workshop"
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );

    return () => {
      cancelled = true;
    };
  }, [chatContext?.locationCapturedAt, chatContext?.locationLat, chatContext?.locationLng]);

  async function sendChatMessage(rawText: string, displayText?: string) {
    const text = (rawText || '').trim();
    const shown = (displayText || rawText || '').trim();
    if (!text || chatLoading) return;

    const userId = `u_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setShowPrimeInChat(false);
    setShowOtherServices(false);
    setChatMessages((prev) => [...prev, { id: userId, role: 'user', text: shown }]);
    setChatDraft('');
    setChatLoading(true);

    const nextContext = { ...(chatContext || {}) };
    // Ensure city is available even before GPS reverse-geocode finishes.
    if (!String(nextContext?.locationLabel || '').trim() && typeof window !== 'undefined') {
      const storedCity = String(window.localStorage.getItem(DETECTED_CITY_KEY) || '').trim();
      if (storedCity) nextContext.locationLabel = storedCity;
    }

    try {
      const requestOnce = async () => {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          const res = await fetch(CHAT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: text,
              context: nextContext,
              session_id: String(nextContext?.conversationId || chatContext?.conversationId || '').trim() || undefined,
            }),
            signal: controller.signal,
          });
          const data: any = await res.json().catch(() => null);
          return { res, data };
        } finally {
          clearTimeout(t);
        }
      };

      let res: Response;
      let data: any;
      try {
        ({ res, data } = await requestOnce());
      } catch (firstErr: any) {
        // One silent retry helps during hot-reload/cold-start hiccups.
        if (firstErr?.name === 'AbortError') throw firstErr;
        ({ res, data } = await requestOnce());
      }
      const v2ConversationId = data?.data?.conversationId;
      if (res.ok && (data?.conversationId || v2ConversationId)) setChatConnected(true);

      const v2Msg = typeof data?.message === 'string' ? data.message.trim() : '';
      const v2Cta = typeof data?.cta === 'string' ? data.cta.trim() : '';

      const assistantText =
        (typeof data?.assistantMessage === 'string' && data.assistantMessage.trim()) ||
        (typeof data?.response === 'string' && data.response.trim()) ||
        (v2Msg ? [v2Msg, v2Cta].filter(Boolean).join('\n') : '') ||
        (typeof data?.error === 'string' && data.error.trim()) ||
        'Sorry, kuch issue aa gaya. Please try again.';

      const uiSuggestions: UiSuggestion[] | undefined = Array.isArray(data?.suggestions)
        ? data.suggestions
            .map((s: any, idx: number) => ({
              optionNumber: idx + 1,
              kind: String(s?.suggestion?.kind || 'SERVICE_TYPE').toUpperCase(),
              id: String(s?.suggestion?.id || ''),
              name: String(s?.suggestion?.name || '').trim(),
              exactPrice:
                typeof s?.exactPrice?.amount === 'number'
                  ? s.exactPrice.amount
                  : typeof s?.exactPrice === 'number'
                    ? s.exactPrice
                    : null,
              checklistItems: Array.isArray(s?.checklistItems) ? s.checklistItems.map((x: any) => String(x)) : undefined,
              checklistNote: typeof s?.checklistNote === 'string' ? s.checklistNote : null,
            }))
            .filter((x: UiSuggestion) => Boolean(x.name) && Boolean(x.id))
        : undefined;

      const uiPayload: UiPayload | undefined = (() => {
        const ui = data?.ui;
        if (!ui || typeof ui !== 'object') return undefined;
        if (ui.kind === 'CATEGORY_CAROUSEL' && Array.isArray(ui.items)) {
          return {
            kind: 'CATEGORY_CAROUSEL',
            title: typeof ui.title === 'string' ? ui.title : undefined,
            items: ui.items
              .map((it: any) => ({
                id: String(it?.id || ''),
                label: String(it?.label || '').trim(),
                subtitle: typeof it?.subtitle === 'string' ? it.subtitle : undefined,
              }))
              .filter((it: any) => it.id && it.label),
          };
        }
        if (ui.kind === 'DUAL_CAROUSEL' && Array.isArray(ui.packages) && Array.isArray(ui.services)) {
          const mapOpt = (o: any, optionNumber?: number): UiSuggestion | null => {
            const s = o?.suggestion;
            const kind = String(s?.kind || '').toUpperCase();
            const id = String(s?.id || '');
            const name = String(s?.name || '').trim();
            if (!id || !name || !kind) return null;
            return {
              optionNumber,
              kind: kind as any,
              id,
              name,
              exactPrice: typeof o?.exactPrice?.amount === 'number' ? o.exactPrice.amount : null,
              checklistItems: Array.isArray(o?.checklistItems) ? o.checklistItems.map((x: any) => String(x)) : undefined,
              checklistNote: typeof o?.checklistNote === 'string' ? o.checklistNote : null,
            };
          };
          const pkg = ui.packages.map((o: any, i: number) => mapOpt(o, i + 1)).filter(Boolean) as UiSuggestion[];
          const svc = ui.services
            .map((o: any, i: number) => mapOpt(o, pkg.length + i + 1))
            .filter(Boolean) as UiSuggestion[];
          return {
            kind: 'DUAL_CAROUSEL',
            title: typeof ui.title === 'string' ? ui.title : undefined,
            category: String(ui.category || '').trim(),
            packages: pkg,
            services: svc,
          };
        }
        if (ui.kind === 'WORKSHOP_CAROUSEL' && Array.isArray(ui.items)) {
          return {
            kind: 'WORKSHOP_CAROUSEL',
            title: typeof ui.title === 'string' ? ui.title : undefined,
            items: ui.items
              .map((it: any) => ({
                id: String(it?.id || ''),
                name: String(it?.name || '').trim(),
                subtitle: typeof it?.subtitle === 'string' ? it.subtitle : undefined,
                km: typeof it?.km === 'number' ? it.km : null,
                imageUrl: typeof it?.imageUrl === 'string' ? it.imageUrl : null,
                mapLink: typeof it?.mapLink === 'string' ? it.mapLink : null,
                rating: typeof it?.rating === 'number' ? it.rating : null,
                usp: typeof it?.usp === 'string' ? it.usp : null,
              }))
              .filter((it: any) => it.id && it.name),
          };
        }
        return undefined;
      })();

      const ctxPatch = (data?.contextPatch && typeof data.contextPatch === 'object'
        ? data.contextPatch
        : data?.data?.contextPatch && typeof data.data.contextPatch === 'object'
          ? data.data.contextPatch
          : null) as any;

      const carModels = ctxPatch?.carModelSuggestions || [];
      const stage = ctxPatch?.conversationStage || '';

      console.log('[AI-BOOKING DEBUG]', { stage, carModels });

      const botId = `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setChatMessages((prev) => [...prev, { id: botId, role: 'assistant', text: assistantText, suggestions: uiSuggestions, ui: uiPayload }]);

      if (ctxPatch) setChatContext((prev: any) => ({ ...(prev || {}), ...(nextContext || {}), ...(ctxPatch || {}) }));
      else setChatContext(nextContext);

      // If backend returned model suggestions (user typed a make like "tata"), treat make as selected
      // Pure chat mode: no UI suggestions
    } catch (e: any) {
      setChatConnected(false);
      const botId = `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const msg =
        e?.name === 'AbortError'
          ? 'Response timeout. Please try again.'
          : 'Network issue. Please try again.';
      setChatMessages((prev) => [...prev, { id: botId, role: 'assistant', text: msg }]);
      setChatContext(nextContext);
    } finally {
      setChatLoading(false);
    }
  }

  async function payNow(paymentType: 'BOOKING_TOKEN' | 'ADVANCE' | 'INVOICE') {
    if (payLoading) return;
    if (!razorpayReady) {
      const botId = `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setChatMessages((prev) => [...prev, { id: botId, role: 'assistant', text: 'Payment gateway is loading. Please try again in a moment.' }]);
      return;
    }

    const leadId = chatContext?.leadId || null;
    const invoiceId = chatContext?.invoiceId || null;

    if (!leadId) {
      const botId = `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setChatMessages((prev) => [...prev, { id: botId, role: 'assistant', text: 'Payment link/tab open karne se pehle booking create karni hogi. Please continue chat to create lead.' }]);
      return;
    }

    let amountOverride: number | null = null;
    if (paymentType === 'ADVANCE') {
      const raw = typeof window !== 'undefined' ? window.prompt('Advance amount (INR)') : null;
      const n = raw ? Number(String(raw).replace(/[^\d.]/g, '')) : 0;
      if (!Number.isFinite(n) || n <= 0) return;
      amountOverride = n;
    }

    // Allow full payment even if invoiceId is not present yet.
    // Server will create/fetch invoice when creating the payment order.

    setPayLoading(true);
    try {
      const resp = await createChatPaymentOrder({ leadId, invoiceId, paymentType, amountOverride });
      if (!resp) {
        const botId = `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        setChatMessages((prev) => [...prev, { id: botId, role: 'assistant', text: 'Payment order create nahi ho paaya. Please try again.' }]);
        return;
      }
      if ((resp as any).success === false) {
        const botId = `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const msg = typeof (resp as any)?.error === 'string' ? `Payment setup failed: ${(resp as any).error}` : 'Payment order create nahi ho paaya. Please try again.';
        setChatMessages((prev) => [...prev, { id: botId, role: 'assistant', text: msg }]);
        return;
      }
      if (!(resp as any)?.order?.orderId) {
        const botId = `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        setChatMessages((prev) => [...prev, { id: botId, role: 'assistant', text: 'Payment order create nahi ho paaya. Please try again.' }]);
        return;
      }

      const ok = resp as any;

      // Keep invoice context (useful for later invoice pay button)
      if (ok.payment_intent?.invoice_id) {
        setChatContext((prev: any) => ({
          ...(prev || {}),
          leadId,
          invoiceId: ok.payment_intent.invoice_id,
          invoiceNumber: ok.payment_intent.invoice_number,
        }));
      }

      const customerName = ok.customer?.name || 'Customer';
      const customerEmail = ok.customer?.email || '';
      const customerPhone = ok.customer?.phone || '';

      initializeRazorpayCheckout(
        ok.order,
        customerName,
        customerEmail,
        customerPhone,
        async (rzpResp: any) => {
          // Verify on server quickly (webhook will also update eventually)
          try {
            const invId = ok.payment_intent?.invoice_id || invoiceId;
            if (invId) {
              await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderId: rzpResp.razorpay_order_id,
                  paymentId: rzpResp.razorpay_payment_id,
                  signature: rzpResp.razorpay_signature,
                  invoiceId: invId,
                }),
              });
            }
          } catch {
            // ignore
          }

          const botId = `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
          setChatMessages((prev) => [...prev, { id: botId, role: 'assistant', text: 'Payment successful. Thank you!\nOur service expert will call you shortly to confirm pickup & plan.' }]);
          setPayLoading(false);
        },
        (err: any) => {
          const botId = `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
          const rawMsg = String(err?.message || err?.description || err?.error?.description || '').toLowerCase();
          const isUserCancelled =
            rawMsg.includes('cancel') ||
            rawMsg.includes('dismiss') ||
            rawMsg.includes('closed') ||
            rawMsg.includes('user') ||
            err?.code === 'PAYMENT_CANCELLED';

          const text = isUserCancelled
            ? 'Payment cancelled. Koi baat nahi — aap Pay Booking Token / Pay Full Amount se dubara try kar sakte ho, ya “Pay Later” choose kar sakte ho.'
            : err?.message
              ? `Payment failed: ${err.message}`
              : 'Payment failed. Please try again.';

          setChatMessages((prev) => [...prev, { id: botId, role: 'assistant', text }]);
          setPayLoading(false);
        }
      );
    } finally {
      // If user closes the modal, onFailure handler will reset; this is just a safety net.
      setTimeout(() => setPayLoading(false), 5000);
    }
  }

  const lastAssistantMessage = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
      if (chatMessages[i]?.role === 'assistant') return chatMessages[i];
    }
    return null;
  }, [chatMessages]);

  const latestSummaryMessageId = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
      const msg = chatMessages[i];
      if (msg?.role === 'assistant' && assistantShowsBookingSummary(msg.text)) {
        return msg.id;
      }
    }
    return null;
  }, [chatMessages]);

  const showCategoryPicker =
    !chatLoading &&
    !showPrimeInChat &&
    !showOtherServices &&
    (chatMessages.length <= 1 ||
      Boolean(lastAssistantMessage && assistantMessageShowsServiceList(lastAssistantMessage.text)));

  const hasUserStarted = chatMessages.some((m) => m.role === 'user');
  const hasPincodeInChat = chatMessages.some((m) => m.role === 'user' && /\b\d{6}\b/.test(m.text));
  const assistantWantsMobile = Boolean(
    lastAssistantMessage && assistantNeedsMobileVerification(lastAssistantMessage.text),
  );

  const lastMsg = chatMessages[chatMessages.length - 1];
  const showCarPicker =
    !chatLoading &&
    !showPrimeInChat &&
    !showOtherServices &&
    lastMsg?.role === 'assistant' &&
    assistantAsksForCar(lastMsg.text);

  const showPincodeInput =
    !chatLoading &&
    !showPrimeInChat &&
    !showOtherServices &&
    lastMsg?.role === 'assistant' &&
    assistantAsksForPincode(lastMsg.text);

  const showNameInput =
    !chatLoading &&
    !showPrimeInChat &&
    !showOtherServices &&
    lastMsg?.role === 'assistant' &&
    assistantAsksForName(lastMsg.text);

  const showPickupDatePicker =
    !chatLoading &&
    !showPrimeInChat &&
    !showOtherServices &&
    lastMsg?.role === 'assistant' &&
    assistantAsksForPickupDate(lastMsg.text) &&
    !assistantAsksForVehicleNumber(lastMsg.text);

  const showPickupTimePicker =
    !chatLoading &&
    !showPrimeInChat &&
    !showOtherServices &&
    lastMsg?.role === 'assistant' &&
    assistantAsksForPickupTime(lastMsg.text) &&
    !assistantAsksForVehicleNumber(lastMsg.text);

  const showVehicleNumberInput =
    !chatLoading &&
    !showPrimeInChat &&
    !showOtherServices &&
    lastMsg?.role === 'assistant' &&
    assistantAsksForVehicleNumber(lastMsg.text);

  const showVerificationPanel =
    !chatLoading &&
    !showPrimeInChat &&
    !showOtherServices &&
    !chatContext?.pricingEligible &&
    !chatContext?.phoneVerified &&
    Boolean(chatContext?.conversationId) &&
    hasUserStarted &&
    (hasPincodeInChat || assistantWantsMobile);

  const showQuickPrompts =
    chatMessages.length <= 1 &&
    !chatLoading &&
    !showPrimeInChat &&
    !showOtherServices &&
    !showCategoryPicker &&
    chatMessages.every((m) => m.role === 'assistant');

  return (
    <div
      className={
        isEmbed
          ? 'flex h-full flex-col bg-[radial-gradient(ellipse_at_top,_#e8f4fd_0%,_#ffffff_48%)]'
          : 'flex min-h-[100dvh] flex-col bg-[radial-gradient(ellipse_at_top,_#e8f4fd_0%,_#ffffff_48%)]'
      }
    >
      {!isEmbed && (
        <header className="sticky top-0 z-40 border-b border-brand-primary/10 bg-white/85 backdrop-blur-md">
          <div className="relative mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setShowMobileMenu((v) => !v)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 lg:hidden"
                aria-label="Open menu"
              >
                {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <MisaAvatar />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-brand-secondary">MISA AI</div>
                  <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-primary">
                    AI Assistant
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${chatConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}
                  />
                  {chatConnected ? 'Online · ready to help' : 'Connecting…'}
                  {String(chatContext?.locationLabel || '').trim()
                    ? ` · ${String(chatContext.locationLabel)}`
                    : ''}
                </div>
              </div>
            </div>
            <Link href="/" className="hidden text-xs font-medium text-gray-500 hover:text-brand-primary sm:inline">
              Home
            </Link>

            {showMobileMenu && (
              <div className="absolute left-4 right-4 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white py-2 shadow-xl lg:hidden">
                {[
                  { label: 'Home', href: '/' },
                  { label: 'Services', href: '/services' },
                  { label: 'Roadside', href: '/car-roadside-assitance' },
                  { label: 'Contact', href: '/contact' },
                  { label: 'Book Service', href: '/book-service' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMobileMenu(false)}
                    className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-brand-primary/5 hover:text-brand-primary"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </header>
      )}

      <main className={isEmbed ? 'flex h-full min-h-0 flex-1 flex-col' : 'mx-auto flex w-full max-w-2xl flex-1 flex-col min-h-0'}>
        {suggestionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4">
                <div className="min-w-0">
                  {typeof suggestionModal.optionNumber === 'number' && (
                    <div className="text-xs text-gray-400">Option {suggestionModal.optionNumber}</div>
                  )}
                  <div className="truncate font-medium text-gray-900">{suggestionModal.name}</div>
                  {typeof suggestionModal.exactPrice === 'number' && suggestionModal.exactPrice > 0 && (
                    <div className="mt-1 text-sm text-gray-700">
                      ₹{Math.round(suggestionModal.exactPrice).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSuggestionModal(null)}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[55vh] overflow-y-auto p-4">
                {Array.isArray(suggestionModal.checklistItems) && suggestionModal.checklistItems.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                    {suggestionModal.checklistItems.map((it, idx) => (
                      <li key={idx}>{it}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-500">No detailed checklist available.</div>
                )}
              </div>
              <div className="flex gap-2 border-t border-gray-100 p-4">
                <button
                  type="button"
                  onClick={() => {
                    const raw = `__select__ ${suggestionModal.kind} ${suggestionModal.id}`;
                    const shown = suggestionModal.name;
                    setSuggestionModal(null);
                    sendChatMessage(raw, shown);
                  }}
                  className="flex-1 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Choose
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestionModal(null)}
                  className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <div className={isEmbed ? 'flex h-full min-h-0 flex-1 flex-col bg-white' : 'flex min-h-0 flex-1 flex-col bg-white'}>
          <div
            ref={chatScrollRef}
            className={
              isEmbed
                ? 'min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6'
                : 'min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6'
            }
          >
            {chatMessages.map((m, msgIndex) => {
              const isUser = m.role === 'user';
              const isFirstAssistant = !isUser && msgIndex === 0;
              const pricingPlans = !isUser ? parsePricingPlansFromText(m.text) : [];
              const showPricingPicker = pricingPlans.length >= 2;
              const bookingSummary = !isUser ? parseBookingSummary(m.text) : null;
              const isActiveSummary =
                Boolean(bookingSummary) &&
                m.id === latestSummaryMessageId &&
                !dismissedSummaryIds.has(m.id);
              const isStaleSummary = Boolean(bookingSummary) && !isActiveSummary;
              const showSummaryCard = isActiveSummary;
              const pickerActiveOnThisMsg =
                !isUser &&
                lastMsg?.id === m.id &&
                (showPickupDatePicker || showPickupTimePicker || showNameInput || showPincodeInput);
              const hideServiceListBody =
                !isUser &&
                !showPricingPicker &&
                showCategoryPicker &&
                lastAssistantMessage?.id === m.id &&
                assistantMessageShowsServiceList(m.text);
              const displayText = showSummaryCard
                ? extractBookingSummaryPrompt(m.text)
                : isStaleSummary
                  ? '📋 Previous booking summary'
                  : !isUser && lastMsg?.id === m.id && showPickupTimePicker
                    ? extractPickupTimePrompt(m.text)
                    : !isUser && lastMsg?.id === m.id && showPickupDatePicker
                      ? extractPickupDatePrompt(m.text)
                      : showPricingPicker
                ? extractPricingTitle(m.text)
                : hideServiceListBody
                  ? m.text
                      .split('\n')
                      .filter((line) => {
                        const t = line.trim();
                        return t && !/^[-•*]\s/.test(t) && !/^\d+[.)]\s/.test(t);
                      })
                      .join('\n')
                      .trim() || 'Yeh services available hain — neeche se choose karein:'
                  : m.text;
              return (
                <div key={m.id} className={`mb-5 ${isUser ? 'flex justify-end' : 'flex items-start gap-2.5'}`}>
                  {!isUser && <MisaAvatar size={isFirstAssistant ? 'md' : 'sm'} />}
                  <div className={isUser ? 'max-w-[82%] sm:max-w-[75%]' : 'min-w-0 max-w-[92%] sm:max-w-[85%]'}>
                    {!isUser && (
                      <div className="mb-1 text-[11px] font-medium text-brand-primary/80">MISA</div>
                    )}
                    {(displayText || isUser) && (
                    <div
                      className={
                        isUser
                          ? 'rounded-2xl rounded-tr-md bg-brand-primary px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm shadow-brand-primary/20'
                          : `rounded-2xl rounded-tl-md border border-brand-primary/15 bg-gradient-to-br from-brand-primary/[0.06] to-white px-4 text-sm leading-relaxed text-gray-800 shadow-sm shadow-brand-primary/10 ${
                              showSummaryCard || pickerActiveOnThisMsg ? 'py-2' : 'py-3'
                            }`
                      }
                    >
                      {displayText.split('\n').map((line, idx) => {
                        const mdLinkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i);
                        if (mdLinkMatch?.[1] && mdLinkMatch?.[2]) {
                          const full = mdLinkMatch[0];
                          const label = mdLinkMatch[1];
                          const url = mdLinkMatch[2];
                          const start = line.indexOf(full);
                          const before = start >= 0 ? line.slice(0, start) : '';
                          const after = start >= 0 ? line.slice(start + full.length) : '';
                          return (
                            <span key={idx}>
                              {before}
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className={isUser ? 'underline text-white/90' : 'underline text-brand-primary'}
                              >
                                {label}
                              </a>
                              {after}
                              <br />
                            </span>
                          );
                        }

                        const urlMatch = line.match(/(https?:\/\/[^\s]+)/i);
                        if (urlMatch?.[1]) {
                          // Chat text often contains markdown "(url)" and regex captures trailing ")".
                          // Strip only trailing punctuation from href and keep it in visible text.
                          const rawUrl = urlMatch[1];
                          const cleanUrl = rawUrl.replace(/[)\],.]+$/g, '');
                          const trailingJunk = rawUrl.slice(cleanUrl.length);
                          const before = line.slice(0, urlMatch.index || 0);
                          const after = (trailingJunk + line.slice((urlMatch.index || 0) + rawUrl.length)).replace(/^\)/, '');
                          return (
                            <span key={idx}>
                              {before}
                              <a
                                href={cleanUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={isUser ? 'underline text-white/90' : 'underline text-brand-primary'}
                              >
                                {cleanUrl}
                              </a>
                              {after}
                              <br />
                            </span>
                          );
                        }
                        return (
                          <span key={idx}>
                            {line}
                            <br />
                          </span>
                        );
                      })}
                    </div>
                    )}
                    {!isUser && showPricingPicker && (
                      <MisaPricingPicker
                        plans={pricingPlans}
                        title={extractPricingTitle(m.text)}
                        onSelect={(plan) =>
                          sendChatMessage(
                            `I want to book ${plan.name} at ₹${plan.price}`,
                            `${plan.tier} Service · ₹${plan.price.toLocaleString('en-IN')}`,
                          )
                        }
                      />
                    )}
                    {!isUser && showSummaryCard && bookingSummary && (
                      <MisaBookingSummaryCard
                        summary={bookingSummary}
                        onConfirm={() => {
                          setDismissedSummaryIds((prev) => new Set(prev).add(m.id));
                          sendChatMessage('Yes', 'Yes, confirm booking');
                        }}
                        onReject={() => {
                          setDismissedSummaryIds((prev) => new Set(prev).add(m.id));
                          sendChatMessage('No', 'No, I need to edit');
                        }}
                      />
                    )}
                    {!isUser && m.ui?.kind === 'CATEGORY_CAROUSEL' && (
                      <MisaCategoryCards
                        onPrime={() => setShowPrimeInChat(true)}
                        onPeriodic={() => sendChatMessage('Car Periodic Service', 'Periodic Service')}
                        onOther={() => setShowOtherServices(true)}
                      />
                    )}

                    {!isUser && m.ui?.kind === 'DUAL_CAROUSEL' && (
                      <div className="mt-3 space-y-3">
                        {m.ui.packages.length > 0 && (
                          <div>
                            <div className="mb-1.5 text-xs text-gray-400">Packages</div>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {m.ui.packages.map((s) => (
                                <button
                                  key={`${s.kind}:${s.id}`}
                                  type="button"
                                  onClick={() => setSuggestionModal(s)}
                                  className="min-w-[180px] flex-shrink-0 rounded-xl border border-brand-primary/15 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-brand-primary/40 hover:shadow-md"
                                >
                                  <div className="text-sm font-medium text-gray-900">{s.name}</div>
                                  {typeof s.exactPrice === 'number' && s.exactPrice > 0 && (
                                    <div className="mt-0.5 text-sm text-gray-700">₹{Math.round(s.exactPrice).toLocaleString('en-IN')}</div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {m.ui.services.length > 0 && (
                          <div>
                            <div className="mb-1.5 text-xs text-gray-400">Services</div>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {m.ui.services.map((s) => (
                                <button
                                  key={`${s.kind}:${s.id}`}
                                  type="button"
                                  onClick={() => setSuggestionModal(s)}
                                  className="min-w-[180px] flex-shrink-0 rounded-xl border border-brand-primary/15 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-brand-primary/40 hover:shadow-md"
                                >
                                  <div className="text-sm font-medium text-gray-900">{s.name}</div>
                                  {typeof s.exactPrice === 'number' && s.exactPrice > 0 && (
                                    <div className="mt-0.5 text-sm text-gray-700">₹{Math.round(s.exactPrice).toLocaleString('en-IN')}</div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!isUser && m.ui?.kind === 'WORKSHOP_CAROUSEL' && (
                      <div className="mt-3">
                        {m.ui.title && <div className="mb-1.5 text-xs text-gray-400">{m.ui.title}</div>}
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {m.ui.items.map((w) => (
                            <div
                              key={w.id}
                              className="min-w-[220px] flex-shrink-0 rounded-xl border border-brand-primary/15 bg-white p-3 shadow-sm"
                            >
                              <div className="text-sm font-medium text-gray-900">{w.name}</div>
                              {w.subtitle && <div className="mt-0.5 text-xs text-gray-500">{w.subtitle}</div>}
                              <div className="mt-2 text-xs text-gray-500">
                                {typeof w.km === 'number' ? `${w.km.toFixed(1)} km away` : ''}
                              </div>
                              <div className="mt-2 flex gap-2">
                                {w.mapLink ? (
                                  <a
                                    href={w.mapLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
                                  >
                                    Directions
                                  </a>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => sendChatMessage(`workshop ${w.name}`)}
                                    className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
                                  >
                                    Select
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isUser && !m.ui && Array.isArray(m.suggestions) && m.suggestions.length > 0 && (
                      <div className="mt-3">
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {m.suggestions.map((s) => (
                            <button
                              key={`${s.kind}:${s.id}:${s.optionNumber || 0}`}
                              type="button"
                              onClick={() => setSuggestionModal(s)}
                              className="min-w-[180px] flex-shrink-0 rounded-xl border border-brand-primary/15 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-brand-primary/40 hover:shadow-md"
                            >
                              <div className="text-sm font-medium text-gray-900">{s.name}</div>
                              {typeof s.exactPrice === 'number' && s.exactPrice > 0 && (
                                <div className="mt-0.5 text-sm text-gray-700">
                                  ₹{Math.round(s.exactPrice).toLocaleString('en-IN')}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {showCategoryPicker && (
              <div className="mb-4 pl-10">
                <MisaCategoryCards
                  onPrime={() => setShowPrimeInChat(true)}
                  onPeriodic={() => sendChatMessage('Car Periodic Service', 'Periodic Service')}
                  onOther={() => setShowOtherServices(true)}
                />
              </div>
            )}

            {showPrimeInChat && (
              <div className="mb-4 pl-10">
                <MisaPrimePanel onBack={() => setShowPrimeInChat(false)} />
              </div>
            )}

            {showOtherServices && (
              <div className="mb-4 pl-10">
                <MisaServiceGrid
                  onBack={() => setShowOtherServices(false)}
                  onSelect={(message, label) => sendChatMessage(message, label)}
                />
              </div>
            )}

            {showCarPicker && (
              <MisaCarPicker onSelect={(message, label) => sendChatMessage(message, label)} />
            )}

            {showPincodeInput && (
              <div className="mb-4 pl-10">
                <MisaPincodeInput onSubmit={(pin) => sendChatMessage(pin, pin)} />
              </div>
            )}

            {showNameInput && (
              <div className="mb-4 pl-10">
                <MisaNameInput onSubmit={(name) => sendChatMessage(name, name)} />
              </div>
            )}

            {showPickupDatePicker && (
              <div className="mb-4 pl-10">
                <MisaPickupDatePicker
                  onConfirm={(_iso, label) => {
                    setChatContext((prev: any) => ({ ...(prev || {}), pickupDate: _iso }));
                    sendChatMessage(label, label);
                  }}
                />
              </div>
            )}

            {showPickupTimePicker && (
              <div className="mb-4 pl-10">
                <MisaPickupTimePicker
                  preferredDate={chatContext?.pickupDate}
                  onConfirm={(timeLabel) => sendChatMessage(timeLabel, timeLabel)}
                />
              </div>
            )}

            {showVehicleNumberInput && (
              <div className="mb-4 pl-10">
                <MisaVehicleNumberInput
                  sessionId={String(chatContext?.conversationId || '').trim() || undefined}
                  onContextPatch={(patch) => setChatContext((prev: any) => ({ ...(prev || {}), ...patch }))}
                  onSave={(vehicle) => sendChatMessage(vehicle, vehicle)}
                />
              </div>
            )}

            {showVerificationPanel && (
              <MisaVerificationPanel
                chatContext={chatContext}
                onContextPatch={(patch) => setChatContext((prev: any) => ({ ...(prev || {}), ...patch }))}
                onVerified={(phone) => {
                  setChatContext((prev: any) => ({
                    ...(prev || {}),
                    customerPhone: phone,
                    phoneVerified: true,
                    pricingEligible: true,
                  }));
                  sendChatMessage(
                    `My mobile ${phone} is already OTP verified on WhatsApp. Please show service pricing now. Do not ask for mobile again.`,
                    'Verified ✓',
                  );
                }}
              />
            )}

            {showQuickPrompts && (
              <div className="mb-4 pl-10">
                <div className="mb-2 text-xs font-medium text-gray-500">Try asking</div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendChatMessage(prompt)}
                      className="rounded-full border border-brand-primary/25 bg-white px-3 py-1.5 text-xs font-medium text-brand-secondary shadow-sm transition hover:border-brand-primary hover:bg-brand-primary/5"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatLoading && <TypingIndicator />}
          </div>

          <div className="sticky bottom-0 z-30 border-t border-brand-primary/10 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:px-6">
            {chatContext?.showPayNow && chatContext?.leadId && (
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={payLoading || !razorpayReady}
                  onClick={() => payNow('BOOKING_TOKEN')}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  Pay token{typeof chatContext?.bookingTokenAmount === 'number' ? ` · ₹${Math.round(chatContext.bookingTokenAmount).toLocaleString('en-IN')}` : ''}
                </button>
                <button
                  type="button"
                  disabled={payLoading || !razorpayReady}
                  onClick={() => payNow('INVOICE')}
                  className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  Pay full amount
                </button>
                <button
                  type="button"
                  disabled={payLoading}
                  onClick={() => setChatContext((prev: any) => ({ ...(prev || {}), showPayNow: false }))}
                  className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 disabled:opacity-50"
                >
                  Later
                </button>
              </div>
            )}
            <form
              className="flex items-center gap-2 rounded-2xl border border-brand-primary/20 bg-white px-3 py-2 shadow-lg shadow-brand-primary/10 transition focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20"
              onSubmit={(e) => {
                e.preventDefault();
                sendChatMessage(chatDraft);
              }}
            >
              <Bot className="h-4 w-4 shrink-0 text-brand-primary" />
              <input
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder="Ask MISA about service, price, booking…"
                className="flex-1 bg-transparent text-base text-gray-900 placeholder:text-gray-400 focus:outline-none sm:text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendChatMessage(chatDraft);
                  }
                }}
              />
              <button
                type="submit"
                disabled={chatLoading || !chatDraft.trim()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white shadow-sm transition hover:bg-brand-primary-hover disabled:opacity-30"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-gray-400">
              Powered by MyFNG AI · Instant quotes · Book in chat
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
