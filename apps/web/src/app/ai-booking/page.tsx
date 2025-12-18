'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot } from 'lucide-react';

type ChatRole = 'user' | 'assistant';
type ChatMsg = {
  id: string;
  role: ChatRole;
  text: string;
  suggestions?: Array<{ 
    label: string; 
    optionIndex: number; 
    bookable: boolean;
    type?: 'CAR_MODEL' | 'SERVICE' | 'PAYMENT' | 'GENERIC' | 'MORE';
    price?: string;
    category?: string;
    hasDetails?: boolean;
    checklistItems?: string[];
    checklistNote?: string | null;
  }>;
};

const STORAGE_KEY = 'myfng_ai_chat_state_v1';
const CHANNEL_NAME = 'myfng_ai_chat_channel_v1';

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default function AIBookingPage() {
  const [chatDraft, setChatDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatConnected, setChatConnected] = useState(false);
  const [selectedMake, setSelectedMake] = useState<string | null>(null);
  const [makeChips, setMakeChips] = useState<string[]>([]);
  const [modelChips, setModelChips] = useState<Array<{ id: string; make: string; model: string; variant?: string | null }>>([]);
  const [chipsLoading, setChipsLoading] = useState(false);
  const [quickChips, setQuickChips] = useState<Array<{ label: string; send: string }>>([]);
  const [planChips, setPlanChips] = useState<Array<{ label: string; send: string }>>([]);

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    {
      id: 'm0',
      role: 'assistant',
      text: "Hi! I'm MY FNG AI Assistant. Aap apni car problem simple words me batao — main service/RSA suggest kar dunga aur approx price range dikhा dunga. Aapko kis type ka issue aa raha hai?",
    },
  ]);

  const [chatContext, setChatContext] = useState<any>({});
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chipsAbortRef = useRef<AbortController | null>(null);
  const chipsDebounceRef = useRef<any>(null);

  const stageNow: string = chatContext?.conversationStage || 'INITIAL';

  // Static chips per stage (always visible even if user doesn't type)
  useEffect(() => {
    const base: Array<{ label: string; send: string }> = [];
    if (stageNow === 'INITIAL') {
      base.push(
        { label: 'Car Service', send: 'service' },
        { label: 'RSA (Roadside)', send: 'rsa' },
        { label: 'Price Enquiry', send: 'price' },
        { label: 'Nearest Workshop', send: 'near workshop' },
        { label: 'Track Booking', send: 'status' }
      );
    } else if (stageNow === 'NEED_PHONE') {
      base.push(
        { label: 'Why mobile number?', send: 'why need mobile number' },
        { label: 'Skip', send: 'skip' }
      );
    } else if (stageNow === 'NEED_ISSUE') {
      base.push(
        { label: 'PERIODIC SERVICE', send: 'PERIODIC SERVICE' },
        { label: 'AC SERVICE', send: 'AC SERVICE' },
        { label: 'BATTERY SERVICE', send: 'BATTERY SERVICE' },
        { label: 'BRAKE SERVICE', send: 'BRAKE SERVICE' },
        { label: 'CLUTCH SERVICE', send: 'CLUTCH SERVICE' },
        { label: 'DENTING PAINTING', send: 'DENTING PAINTING' },
        { label: 'TYRE & WHEEL CARE', send: 'TYRE & WHEEL CARE' },
        { label: 'DETAILING SERVICE', send: 'DETAILING SERVICE' }
      );
    } else if (stageNow === 'NEED_VEHICLE_NUMBER') {
      base.push(
        { label: 'Example: MH12AB1234', send: 'MH12AB1234' }
      );
    } else if (stageNow === 'NEED_PICKUP_PREF') {
      base.push(
        { label: 'Pickup Required', send: 'pickup' },
        { label: 'Self Visit', send: 'self' }
      );
    } else if (stageNow === 'NEED_PAYMENT') {
      base.push(
        { label: 'UPI', send: 'UPI' },
        { label: 'Card', send: 'CARD' },
        { label: 'Cash', send: 'CASH' },
        { label: 'Pay Later', send: 'PAY_LATER' }
      );
    }

    const q = (chatDraft || '').toLowerCase().trim();
    const filtered = q ? base.filter((c) => c.label.toLowerCase().includes(q) || c.send.toLowerCase().includes(q)) : base;
    setQuickChips(filtered);
    // When user types, we don't clear planChips; they are filtered separately below.
  }, [stageNow, chatDraft]);

  // Live chips suggestions for car model flow (Make -> Model)
  useEffect(() => {
    // Reset chips if we are not in car model stage or model already selected
    if (stageNow !== 'NEED_CAR_MODEL' || chatContext?.modelId) {
      setMakeChips([]);
      setModelChips([]);
      setSelectedMake(null);
      setChipsLoading(false);
      return;
    }

    // cancel any in-flight request
    chipsAbortRef.current?.abort();
    const ac = new AbortController();
    chipsAbortRef.current = ac;

    if (chipsDebounceRef.current) clearTimeout(chipsDebounceRef.current);
    chipsDebounceRef.current = setTimeout(async () => {
      try {
        setChipsLoading(true);
        const q = (chatDraft || '').trim();

        if (!selectedMake) {
          // Make suggestions (endpoint returns popular makes even when q is empty/short)
          const res = await fetch(`/api/car-models/search?mode=make&q=${encodeURIComponent(q)}`, { signal: ac.signal });
          const data: any = await res.json().catch(() => null);
          const makes = Array.isArray(data?.makes) ? data.makes : [];
          setMakeChips(makes);
          setModelChips([]);
        } else {
          // Model suggestions scoped by make
          const query = q ? `${selectedMake} ${q}` : selectedMake;
          const res = await fetch(`/api/car-models/search?q=${encodeURIComponent(query)}`, { signal: ac.signal });
          const data: any = await res.json().catch(() => null);
          const models = Array.isArray(data?.models) ? data.models : [];
          setModelChips(models);
          setMakeChips([]);
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          setMakeChips([]);
          setModelChips([]);
        }
      } finally {
        setChipsLoading(false);
      }
    }, 250);

    return () => {
      ac.abort();
      if (chipsDebounceRef.current) clearTimeout(chipsDebounceRef.current);
    };
  }, [stageNow, chatContext?.modelId, chatDraft, selectedMake]);

  const channel = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return null;
    }
  }, []);

  // Load persisted state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = safeParseJson<any>(window.localStorage.getItem(STORAGE_KEY));
    if (saved?.chatMessages?.length) setChatMessages(saved.chatMessages);
    if (saved?.chatContext) setChatContext(saved.chatContext);
  }, []);

  // Persist + broadcast
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      chatMessages,
      chatContext,
      updatedAt: Date.now(),
    };
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
      if (payload?.chatMessages?.length) setChatMessages(payload.chatMessages);
      if (payload?.chatContext) setChatContext(payload.chatContext);
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
      if (payload?.chatMessages?.length) setChatMessages(payload.chatMessages);
      if (payload?.chatContext) setChatContext(payload.chatContext);
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
    if (chatContext?.addressText && Number.isFinite(chatContext?.locationLat) && Number.isFinite(chatContext?.locationLng)) return;
    if (!('geolocation' in navigator)) return;

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (cancelled) return;
          setChatContext((prev: any) => ({ ...(prev || {}), locationLat: lat, locationLng: lng }));

          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`
          );
          if (!res.ok) return;
          const data: any = await res.json();
          const display = data?.display_name || '';
          if (!display) return;
          if (cancelled) return;
          setChatContext((prev: any) => ({ ...(prev || {}), addressText: display, locationLat: lat, locationLng: lng }));
        } catch {
          // ignore
        }
      },
      () => {},
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 5 * 60 * 1000 }
    );

    return () => {
      cancelled = true;
    };
  }, [chatContext?.addressText, chatContext?.locationLat, chatContext?.locationLng]);

  async function sendChatMessage(rawText: string) {
    const text = (rawText || '').trim();
    if (!text || chatLoading) return;

    const userId = `u_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setChatMessages((prev) => [...prev, { id: userId, role: 'user', text }]);
    setChatDraft('');
    setChatLoading(true);

    const nextContext = { ...(chatContext || {}) };

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, context: nextContext }),
      });

      const data: any = await res.json().catch(() => null);
      if (res.ok && data?.conversationId) setChatConnected(true);

      const assistantText = data?.assistantMessage || 'Sorry, kuch issue aa gaya. Please try again.';

      const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
      const carModels = data?.contextPatch?.carModelSuggestions || [];
      const stage = data?.contextPatch?.conversationStage || '';

      console.log('[AI-BOOKING DEBUG]', { stage, carModels, suggestions });

      let suggestionButtons: any[] | undefined = undefined;

      // Service Plans with "See Details"
      if (suggestions.length > 0 && stage === 'NEED_ISSUE') {
        // Also build plan chips above input (Option 1/2/3...)
        const q = (chatDraft || '').toLowerCase().trim();
        const chips = suggestions.slice(0, 8).map((s: any, idx: number) => {
          const name = s?.suggestion?.name || `Option ${idx + 1}`;
          return { label: `${idx + 1}. ${name}`, send: `Option ${idx + 1}` };
        });
        setPlanChips(q ? chips.filter((c: { label: string; send: string }) => c.label.toLowerCase().includes(q)) : chips);

        suggestionButtons = suggestions.slice(0, 6).map((s: any, idx: number) => {
          const name = s?.suggestion?.name || `Option ${idx + 1}`;
          const range = s?.priceRange?.label || '';
          const hasDetails = (s?.checklistItems && s.checklistItems.length > 0) || s?.checklistNote;
          return {
            label: `${idx + 1}. ${name}`,
            price: range,
            optionIndex: idx,
            bookable: false,
            type: 'SERVICE',
            hasDetails,
            checklistItems: s?.checklistItems || [],
            checklistNote: s?.checklistNote || null,
            category: s?.category || null,
          };
        });
      }
      // Payment Options
      else if (stage === 'NEED_PAYMENT') {
        suggestionButtons = [
          { label: '1. UPI/Online Payment', optionIndex: 0, bookable: false, type: 'PAYMENT' },
          { label: '2. Credit/Debit Card', optionIndex: 1, bookable: false, type: 'PAYMENT' },
          { label: '3. Cash on Service', optionIndex: 2, bookable: false, type: 'PAYMENT' },
          { label: '4. Pay Later at Workshop', optionIndex: 3, bookable: false, type: 'PAYMENT' },
        ];
      }
      // Generic (fallback)
      else if (suggestions.length > 0) {
        suggestionButtons = suggestions.slice(0, 6).map((s: any, idx: number) => {
          const name = s?.suggestion?.name || `Option ${idx + 1}`;
          const range = s?.priceRange?.label ? ` ${s.priceRange.label}` : '';
          return {
            label: `Option ${idx + 1}: ${name}${range ? ` (${range})` : ''}`,
            optionIndex: idx,
            bookable: true,
            type: 'GENERIC',
          };
        });
      }

      const extendedButtons =
        suggestionButtons && suggestions.length > 6 && stage === 'NEED_ISSUE'
          ? [...suggestionButtons, { label: 'Show more plans', optionIndex: -1, bookable: false, type: 'MORE' }]
          : suggestionButtons;

      const botId = `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setChatMessages((prev) => [...prev, { id: botId, role: 'assistant', text: assistantText, suggestions: extendedButtons }]);

      if (data?.contextPatch) {
        setChatContext((prev: any) => ({ ...(prev || {}), ...(nextContext || {}), ...(data.contextPatch || {}) }));
      } else {
        setChatContext(nextContext);
      }

      // If backend returned model suggestions (user typed a make like "tata"), treat make as selected
      if (stage === 'NEED_CAR_MODEL' && Array.isArray(carModels) && carModels.length > 0) {
        const uniqMakes = Array.from(new Set(carModels.map((c: any) => c?.make).filter(Boolean)));
        if (uniqMakes.length === 1) setSelectedMake(String(uniqMakes[0]));
        setModelChips(carModels);
        setMakeChips([]);
      }
      if (stage !== 'NEED_CAR_MODEL') {
        setMakeChips([]);
        setModelChips([]);
        setSelectedMake(null);
      }
      if (stage !== 'NEED_ISSUE') {
        setPlanChips([]);
      }
    } catch {
      setChatConnected(false);
      const botId = `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setChatMessages((prev) => [...prev, { id: botId, role: 'assistant', text: 'Network issue. Please try again.' }]);
      setChatContext(nextContext);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-brand-primary/10 p-2 rounded-xl">
              <Bot className="w-5 h-5 text-brand-primary" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-gray-900 truncate">Book via MY FNG AI</div>
              <div className="text-xs text-gray-500 truncate">
                {chatConnected ? 'API: /api/chatbot • Connected' : 'API: /api/chatbot • Connecting...'}
              </div>
            </div>
          </div>
          <Link href="/" className="text-sm font-semibold text-brand-primary hover:underline">
            Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div ref={chatScrollRef} className="h-[65vh] bg-gray-50 p-4 overflow-y-auto">
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
                      {m.text.split('\n').map((line, idx) => (
                        <span key={idx}>
                          {line}
                          <br />
                        </span>
                      ))}
                    </div>

                    {!isUser && m.suggestions && m.suggestions.length > 0 && (
                      <div className="mt-2 flex flex-col gap-2">
                        {m.suggestions.map((s) => {
                          // Car model suggestions are shown as chips above the input now
                          if (s.type === 'CAR_MODEL') return null;

                          // Service Plans with "See Details"
                          if (s.type === 'SERVICE' && s.optionIndex >= 0) {
                            return (
                              <div key={`${m.id}_${s.optionIndex}`} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="p-3">
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <span className="font-semibold text-sm text-gray-900">{s.label}</span>
                                    {s.category && (
                                      <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium whitespace-nowrap">
                                        {s.category}
                                      </span>
                                    )}
                                  </div>
                                  {s.price && (
                                    <p className="text-brand-primary font-bold text-sm mb-2">{s.price}</p>
                                  )}
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => sendChatMessage(`Option ${s.optionIndex + 1}`)}
                                      className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition"
                                    >
                                      Select Plan
                                    </button>
                                    {s.hasDetails && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          alert(`What's Included:\n\n${s.checklistNote || s.checklistItems?.join('\n• ') || 'Details coming soon'}`);
                                        }}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition whitespace-nowrap"
                                      >
                                        See Details
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // Payment Options
                          if (s.type === 'PAYMENT') {
                            return (
                              <button
                                key={`${m.id}_${s.optionIndex}`}
                                type="button"
                                onClick={() => sendChatMessage(`Option ${s.optionIndex + 1}`)}
                                className="w-full text-left bg-white border border-gray-200 hover:border-green-400 hover:bg-green-50 rounded-xl px-3 py-2 text-xs text-gray-700 shadow-sm transition flex items-center gap-2"
                              >
                                💳 {s.label}
                              </button>
                            );
                          }

                          // "Show more plans"
                          if (s.optionIndex === -1) {
                            return (
                              <button
                                key={`${m.id}_more`}
                                type="button"
                                onClick={() => sendChatMessage('aur koi plan')}
                                className="w-full text-center bg-blue-50 border border-blue-200 hover:border-blue-400 rounded-xl px-3 py-2 text-xs text-blue-700 font-semibold shadow-sm transition"
                              >
                                {s.label}
                              </button>
                            );
                          }

                          // Generic (fallback)
                          return (
                            <div key={`${m.id}_${s.optionIndex}`} className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => sendChatMessage(`Option ${s.optionIndex + 1}`)}
                                className="flex-1 text-left bg-white border border-gray-200 hover:border-brand-primary/40 rounded-xl px-3 py-2 text-xs text-gray-700 shadow-sm"
                              >
                                {s.label}
                              </button>
                              {s.bookable && (
                                <button
                                  type="button"
                                  onClick={() => sendChatMessage(`Yes, book option ${s.optionIndex + 1}`)}
                                  className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl px-3 py-2 text-xs font-semibold shadow-sm whitespace-nowrap"
                                >
                                  Book
                                </button>
                              )}
                            </div>
                          );
                        })}
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
            {/* Chips (shown above input) */}
            {(stageNow === 'NEED_CAR_MODEL' || stageNow === 'INITIAL' || stageNow === 'NEED_ISSUE' || stageNow === 'NEED_PHONE' || stageNow === 'NEED_VEHICLE_NUMBER' || stageNow === 'NEED_PICKUP_PREF' || stageNow === 'NEED_PAYMENT') && (
              <div className="mb-3">
                {/* INITIAL/ISSUE/PHONE/PICKUP/PAYMENT chips */}
                {stageNow !== 'NEED_CAR_MODEL' && quickChips.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {quickChips.map((c) => (
                      <button
                        key={`${stageNow}_${c.label}`}
                        type="button"
                        onClick={() => sendChatMessage(c.send)}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-800 hover:border-brand-primary/40 hover:bg-blue-50"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Plan chips (when plans are available in NEED_ISSUE) */}
                {stageNow === 'NEED_ISSUE' && planChips.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {planChips.map((c) => (
                      <button
                        key={`plan_${c.label}`}
                        type="button"
                        onClick={() => sendChatMessage(c.send)}
                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 hover:border-blue-400"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Car model chips */}
                {stageNow === 'NEED_CAR_MODEL' && !chatContext?.modelId && (
                  <>
                {selectedMake && (
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMake(null);
                        setModelChips([]);
                        setMakeChips([]);
                        setChatDraft('');
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-brand-primary/30 bg-brand-primary/5 px-3 py-1 text-xs font-semibold text-brand-primary hover:bg-brand-primary/10"
                      title="Change make"
                    >
                      {selectedMake} <span className="text-xs">✕</span>
                    </button>
                    {chipsLoading && <span className="text-xs text-gray-500">Loading…</span>}
                  </div>
                )}

                {!selectedMake && makeChips.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {makeChips.map((mk) => (
                      <button
                        key={mk}
                        type="button"
                        onClick={() => {
                          setSelectedMake(mk);
                          setMakeChips([]);
                          setChatDraft('');
                        }}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-800 hover:border-brand-primary/40 hover:bg-blue-50"
                      >
                        {mk}
                      </button>
                    ))}
                  </div>
                )}

                {selectedMake && modelChips.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {modelChips.map((car) => {
                      const label = `${car.model}${car.variant ? ` ${car.variant}` : ''}`.trim();
                      return (
                        <button
                          key={car.id}
                          type="button"
                          onClick={() => sendChatMessage(`${selectedMake} ${label}`)}
                          className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-800 hover:border-brand-primary/40 hover:bg-blue-50"
                          title={`${selectedMake} ${label}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
                  </>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder={
                  stageNow === 'NEED_CAR_MODEL'
                    ? selectedMake
                      ? 'Type car model (e.g. Tigor)'
                      : 'Type car make (e.g. Tata)'
                    : stageNow === 'INITIAL'
                      ? 'Select a chip or type...'
                    : 'Type your message...'
                }
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-brand-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const composed =
                      stageNow === 'NEED_CAR_MODEL' && selectedMake
                        ? `${selectedMake} ${(chatDraft || '').trim()}`.trim()
                        : chatDraft;
                    sendChatMessage(composed);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const composed =
                    stageNow === 'NEED_CAR_MODEL' && selectedMake
                      ? `${selectedMake} ${(chatDraft || '').trim()}`.trim()
                      : chatDraft;
                  sendChatMessage(composed);
                }}
                disabled={chatLoading}
                className="bg-brand-primary text-white p-2 rounded-full hover:bg-brand-primary-hover flex-shrink-0 disabled:opacity-60"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Tip: “near workshop”, “price”, “denting”, “ac issue”, or “Yes, book option 1”.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
