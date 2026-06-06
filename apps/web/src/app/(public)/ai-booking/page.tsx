'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Bot } from 'lucide-react';
import { createChatPaymentOrder, initializeRazorpayCheckout, loadRazorpayScript } from '@/lib/services/paymentService';

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

export default function AIBookingPage() {
  // Next.js requires useSearchParams() to be wrapped in Suspense.
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
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

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>(() => [
    {
      id: 'm0',
      role: 'assistant',
      text: "Hi! I'm MISA AI Assistant.\nAapko kya help chahiye — service, repair, cleaning, ya workshop location?",
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
  // This keeps pricing stable on /ai-booking even if GPS/reverse-geocode isn't available.
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
            body: JSON.stringify({ message: text, context: nextContext }),
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

  return (
    <div className={isEmbed ? 'h-full bg-gray-50' : 'min-h-screen bg-gray-50'}>
      {!isEmbed && (
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-brand-primary/10 p-2 rounded-xl">
              <Bot className="w-5 h-5 text-brand-primary" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-gray-900 truncate">Book via MISA AI</div>
              <div className="text-xs text-gray-500 truncate">
                {chatConnected ? 'AI Assistant • Online' : 'AI Assistant • Starting...'}
              </div>
              {String(chatContext?.locationLabel || '').trim() ? (
                <div className="text-[11px] text-gray-600 truncate">City: {String(chatContext.locationLabel)}</div>
              ) : null}
            </div>
          </div>
          <Link href="/" className="text-sm font-semibold text-brand-primary hover:underline">
            Back to Home
          </Link>
        </div>
      </header>
      )}

      <main className={isEmbed ? 'h-full p-0' : 'mx-auto max-w-4xl px-4 py-6'}>
        {suggestionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {typeof suggestionModal.optionNumber === 'number' && (
                    <div className="text-xs text-gray-500">Option {suggestionModal.optionNumber}</div>
                  )}
                  <div className="font-bold text-gray-900 truncate">{suggestionModal.name}</div>
                  {typeof suggestionModal.exactPrice === 'number' && suggestionModal.exactPrice > 0 && (
                    <div className="text-sm text-green-700 mt-1">
                      ₹{Math.round(suggestionModal.exactPrice).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSuggestionModal(null)}
                  className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
                >
                  Close
                </button>
              </div>
              <div className="p-4 max-h-[55vh] overflow-y-auto">
                {Array.isArray(suggestionModal.checklistItems) && suggestionModal.checklistItems.length > 0 ? (
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-2">Checkpoints</div>
                    <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1">
                      {suggestionModal.checklistItems.map((it, idx) => (
                        <li key={idx}>{it}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-sm text-gray-700">No detailed checklist available for this service.</div>
                )}
              </div>
              <div className="p-4 border-t flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const raw = `__select__ ${suggestionModal.kind} ${suggestionModal.id}`;
                    const shown = suggestionModal.name;
                    setSuggestionModal(null);
                    sendChatMessage(raw, shown);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover text-sm font-semibold"
                >
                  Choose this
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestionModal(null)}
                  className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <div className={isEmbed ? 'bg-white h-full overflow-hidden' : 'bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden'}>
          <div ref={chatScrollRef} className={isEmbed ? 'h-[430px] bg-gray-50 p-4 overflow-y-auto' : 'h-[65vh] bg-gray-50 p-4 overflow-y-auto'}>
            {chatMessages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div key={m.id} className={`mb-4 ${isUser ? 'flex justify-end' : 'flex'}`}>
                  {!isUser && (
                    <div className="w-8 h-8 bg-brand-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mr-2">
                      <Bot className="w-4 h-4 text-brand-primary" />
                    </div>
                  )}
                  <div className="max-w-[85%]">
                    <div
                      className={
                        isUser
                          ? 'bg-brand-primary p-3 rounded-2xl rounded-tr-none shadow-sm text-sm text-white'
                          : 'bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 text-sm text-gray-800'
                      }
                    >
                      {m.text.split('\n').map((line, idx) => {
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
                                className={isUser ? 'underline text-white' : 'underline text-brand-primary'}
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
                                className={isUser ? 'underline text-white' : 'underline text-brand-primary'}
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
                    {!isUser && m.ui?.kind === 'CATEGORY_CAROUSEL' && (
                      <div className="mt-2">
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {m.ui.items.map((it) => (
                            <button
                              key={it.id}
                              type="button"
                              onClick={() => sendChatMessage(it.id, it.label)}
                              className="min-w-[220px] text-left bg-white border border-gray-200 rounded-xl p-3 hover:bg-gray-50 flex-shrink-0"
                            >
                              <div className="font-semibold text-sm text-gray-900">{it.label}</div>
                              {it.subtitle && <div className="text-xs text-gray-500 mt-1">{it.subtitle}</div>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isUser && m.ui?.kind === 'DUAL_CAROUSEL' && (
                      <div className="mt-2 space-y-3">
                        {m.ui.packages.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-600 mb-1">Packages</div>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {m.ui.packages.map((s) => (
                                <button
                                  key={`${s.kind}:${s.id}`}
                                  type="button"
                                  onClick={() => setSuggestionModal(s)}
                                  className="min-w-[220px] text-left bg-white border border-gray-200 rounded-xl p-3 hover:bg-gray-50 flex-shrink-0"
                                >
                                  {typeof s.optionNumber === 'number' && <div className="text-xs text-gray-500">Option {s.optionNumber}</div>}
                                  <div className="font-semibold text-sm text-gray-900">{s.name}</div>
                                  {typeof s.exactPrice === 'number' && s.exactPrice > 0 && (
                                    <div className="text-sm text-green-700 mt-1">₹{Math.round(s.exactPrice).toLocaleString('en-IN')}</div>
                                  )}
                                  <div className="text-xs text-gray-500 mt-1">
                                    {Array.isArray(s.checklistItems) && s.checklistItems.length > 0 ? 'View details' : 'Tap to select'}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {m.ui.services.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-600 mb-1">Services</div>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {m.ui.services.map((s) => (
                                <button
                                  key={`${s.kind}:${s.id}`}
                                  type="button"
                                  onClick={() => setSuggestionModal(s)}
                                  className="min-w-[220px] text-left bg-white border border-gray-200 rounded-xl p-3 hover:bg-gray-50 flex-shrink-0"
                                >
                                  {typeof s.optionNumber === 'number' && <div className="text-xs text-gray-500">Option {s.optionNumber}</div>}
                                  <div className="font-semibold text-sm text-gray-900">{s.name}</div>
                                  {typeof s.exactPrice === 'number' && s.exactPrice > 0 && (
                                    <div className="text-sm text-green-700 mt-1">₹{Math.round(s.exactPrice).toLocaleString('en-IN')}</div>
                                  )}
                                  <div className="text-xs text-gray-500 mt-1">
                                    {Array.isArray(s.checklistItems) && s.checklistItems.length > 0 ? 'View checkpoints' : 'Tap to select'}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!isUser && m.ui?.kind === 'WORKSHOP_CAROUSEL' && (
                      <div className="mt-2">
                        {m.ui.title && <div className="text-xs font-semibold text-gray-600 mb-1">{m.ui.title}</div>}
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {m.ui.items.map((w) => (
                            <div
                              key={w.id}
                              className="min-w-[260px] bg-white border border-gray-200 rounded-xl overflow-hidden flex-shrink-0"
                            >
                              <div className="h-28 bg-gray-100">
                                {w.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={w.imageUrl} alt={w.name} className="w-full h-full object-cover" />
                                ) : null}
                              </div>
                              <div className="p-3">
                                <div className="font-semibold text-sm text-gray-900">{w.name}</div>
                                {w.subtitle && <div className="text-xs text-gray-500 mt-1">{w.subtitle}</div>}
                                {w.usp && <div className="text-[11px] text-gray-700 mt-1">• {w.usp}</div>}
                                {typeof w.rating === 'number' && (
                                  <div className="text-[11px] text-gray-700 mt-1">⭐ {Math.round(w.rating)}/100</div>
                                )}
                                <div className="text-xs text-gray-600 mt-2">
                                  {typeof w.km === 'number' ? `${w.km.toFixed(1)} km away` : 'Distance unavailable'}
                                </div>
                                <div className="mt-2 flex gap-2">
                                  {w.mapLink ? (
                                    <a
                                      href={w.mapLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center justify-center px-3 py-2 text-xs font-semibold rounded-lg bg-brand-primary text-white hover:opacity-95"
                                    >
                                      Directions
                                    </a>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => sendChatMessage(`workshop ${w.name}`)}
                                      className="inline-flex items-center justify-center px-3 py-2 text-xs font-semibold rounded-lg bg-gray-900 text-white hover:opacity-95"
                                    >
                                      Select
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => sendChatMessage('Pickup chahiye', 'Pickup chahiye')}
                                    className="inline-flex items-center justify-center px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50"
                                  >
                                    Pickup?
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isUser && !m.ui && Array.isArray(m.suggestions) && m.suggestions.length > 0 && (
                      <div className="mt-2">
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {m.suggestions.map((s) => (
                            <button
                              key={`${s.kind}:${s.id}:${s.optionNumber || 0}`}
                              type="button"
                              onClick={() => setSuggestionModal(s)}
                              className="min-w-[220px] text-left bg-white border border-gray-200 rounded-xl p-3 hover:bg-gray-50 flex-shrink-0"
                            >
                              {typeof s.optionNumber === 'number' && <div className="text-xs text-gray-500">Option {s.optionNumber}</div>}
                              <div className="font-semibold text-sm text-gray-900">{s.name}</div>
                              {typeof s.exactPrice === 'number' && s.exactPrice > 0 && (
                                <div className="text-sm text-green-700 mt-1">
                                  ₹{Math.round(s.exactPrice).toLocaleString('en-IN')}
                                </div>
                              )}
                              <div className="text-xs text-gray-500 mt-1">
                                {Array.isArray(s.checklistItems) && s.checklistItems.length > 0 ? 'View checkpoints' : 'Tap to select'}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {chatLoading && (
              <div className="flex gap-2 mb-4">
                <div className="w-8 h-8 bg-brand-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-brand-primary" />
                </div>
                <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 text-sm text-gray-700">
                  Typing...
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 bg-white">
            {chatContext?.showPayNow && chatContext?.leadId && (
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={payLoading || !razorpayReady}
                  onClick={() => payNow('BOOKING_TOKEN')}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 text-sm font-semibold"
                >
                  Pay Booking Token{typeof chatContext?.bookingTokenAmount === 'number' ? ` (₹${Math.round(chatContext.bookingTokenAmount).toLocaleString('en-IN')})` : ''}
                </button>
                <button
                  type="button"
                  disabled={payLoading || !razorpayReady}
                  onClick={() => payNow('INVOICE')}
                  className="px-4 py-2 rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover disabled:opacity-60 text-sm font-semibold"
                >
                  Pay Full Amount
                </button>
                <button
                  type="button"
                  disabled={payLoading}
                  onClick={() => setChatContext((prev: any) => ({ ...(prev || {}), showPayNow: false }))}
                  className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-60 text-sm"
                >
                  Not now
                </button>
              </div>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendChatMessage(chatDraft);
              }}
            >
              <input
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder={
                  stageNow === 'INITIAL'
                      ? 'Type your message...'
                    : 'Type your message...'
                }
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-brand-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendChatMessage(chatDraft);
                  }
                }}
              />
              <button
                type="submit"
                disabled={chatLoading}
                className="bg-brand-primary text-white p-2 rounded-full hover:bg-brand-primary-hover flex-shrink-0 disabled:opacity-60"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
            <div className="mt-2 text-xs text-gray-500">
              Tip: Describe your issue in simple words (e.g. “AC cooling kam”, “puncture”, “price”, “warranty”).
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
