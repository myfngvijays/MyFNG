'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { createClient } from '@/lib/supabase/client';
import BookingForm from '@/components/landing/BookingForm';
import LiveStats from '@/components/landing/LiveStats';
import AIFeatureBadge from '@/components/landing/AIFeatureBadge';
import DynamicFOMO from '@/components/landing/DynamicFOMO';
import ServiceExplorer, { type ServiceExplorerItem } from '@/components/landing/ServiceExplorer';
import { DEFAULT_SERVICES } from '@/lib/services/catalog';
import { 
  MessageSquare, 
  Zap, 
  CheckCircle, 
  Star, 
  ChevronRight, 
  Bot, 
  ArrowRight, 
  Shield, 
  Clock, 
  MapPin, 
  Activity, 
  Car,
  Users,
  Award,
  TrendingUp,
  Heart,
  Quote,
  Loader2,
  Sparkles,
  Cpu,
  Radio,
  AlertCircle,
  Droplets,
  Calendar,
  Wrench,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { appendUtmToHref } from '@/lib/utm';

function extractLatLngFromMapLink(mapLink?: string | null): { lat: number; lng: number } | null {
  if (!mapLink) return null;
  try {
    const raw = decodeURIComponent(mapLink);
    const at = raw.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (at) {
      const lat = Number(at[1]);
      const lng = Number(at[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    const qp = raw.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (qp) {
      const lat = Number(qp[1]);
      const lng = Number(qp[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    const center = raw.match(/[?&]center=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (center) {
      const lat = Number(center[1]);
      const lng = Number(center[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  } catch {
    // ignore
  }
  return null;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export default function HomePage() {
  const [activeCarType, setActiveCarType] = useState<'hatchback' | 'sedan' | 'suv'>('sedan');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0); // Added for How It Works section
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  type WhyIntent = 'instant' | 'save' | 'control' | 'trust';
  const [whyIntent, setWhyIntent] = useState<WhyIntent>('instant');
  const [headerAiQuery, setHeaderAiQuery] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [latestBlogs, setLatestBlogs] = useState<Array<{ title: string; excerpt: string; slug: string; readTime: string; tag: string; featuredImage?: string }>>([]);
  const heroServiceSlides = useMemo(
    () =>
      DEFAULT_SERVICES.map((service) => ({
        title: service.title,
        image: service.image,
      })).filter((service) => Boolean(service.image)),
    []
  );
  const [heroServiceSlideIdx, setHeroServiceSlideIdx] = useState(0);
  const [heroSlidesReady, setHeroSlidesReady] = useState(false);
  const activeHeroServiceSlide =
    heroServiceSlides.length > 0 ? heroServiceSlides[heroServiceSlideIdx % heroServiceSlides.length] : null;

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
    | { kind: 'DUAL_CAROUSEL'; title?: string; category: string; packages: UiSuggestion[]; services: UiSuggestion[] };
  type ChatMsg = {
    id: string;
    role: ChatRole;
    text: string;
    suggestions?: UiSuggestion[];
    ui?: UiPayload;
  };

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    {
      id: 'm0',
      role: 'assistant',
      text: `Hi! I'm MY FNG AI Assistant. Aap apni car problem simple words me batao — main service/RSA suggest kar dunga aur approx price range dikhा dunga.\n\nAapko kis type ka issue aa raha hai?`,
    },
  ]);

  // Homepage "From Our Blogs" should link to full blog pages.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/blogs/public?limit=4');
        if (!res.ok) return;
        const data = (await res.json()) as any;
        const blogs = Array.isArray(data?.blogs) ? data.blogs : [];
        const mapped = blogs
          .map((b: any, idx: number) => {
            const title = String(b?.title || '').trim();
            const slug = String(b?.slug || '').trim();
            const excerptRaw = String(b?.excerpt || '').replace(/\s+/g, ' ').trim();
            if (!title || !slug) return null;
            const readTime = `${Number(b?.read_time || 3)} min read`;
            const tag = String(b?.category?.name || b?.category?.[0]?.name || 'Blog').trim() || 'Blog';
            const excerpt =
              excerptRaw.length > 110 ? `${excerptRaw.slice(0, 107).trimEnd()}...` : excerptRaw;
            const featuredImage = String(b?.featured_image || '').trim() || undefined;
            return { title, slug, excerpt, readTime, tag, featuredImage };
          })
          .filter(Boolean) as Array<{ title: string; excerpt: string; slug: string; readTime: string; tag: string; featuredImage?: string }>;

        if (!cancelled) setLatestBlogs(mapped);
      } catch {
        // ignore: keep fallback static cards
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-rotate hero service creatives on homepage.
  useEffect(() => {
    if (heroServiceSlides.length === 0) {
      setHeroSlidesReady(true);
      return;
    }
    let cancelled = false;
    const preloadImages = async () => {
      await Promise.all(
        heroServiceSlides.map(
          (slide) =>
            new Promise<void>((resolve) => {
              const img = new window.Image();
              img.onload = () => resolve();
              img.onerror = () => resolve();
              img.src = slide.image;
            })
        )
      );
      if (!cancelled) setHeroSlidesReady(true);
    };
    void preloadImages();
    return () => {
      cancelled = true;
    };
  }, [heroServiceSlides]);

  // Start rotating only after images are preloaded to avoid blank flashes.
  useEffect(() => {
    if (!heroSlidesReady || heroServiceSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroServiceSlideIdx((prev) => (prev + 1) % heroServiceSlides.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [heroSlidesReady, heroServiceSlides.length]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatConnected, setChatConnected] = useState(false);
  const [chatContext, setChatContext] = useState<any>({}); // keep flexible (matches /api/chatbot context)
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const lastAppliedSyncAtRef = useRef<number>(0);
  // V1 homepage chat is disabled; keep this loose to avoid TS nullability issues during build.
  const [suggestionModal, setSuggestionModal] = useState<any>(null);

  const CHAT_STORAGE_KEY = 'myfng_ai_chat_state_v1';
  const CHAT_CHANNEL_NAME = 'myfng_ai_chat_channel_v1';

  const chatChannel = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return new BroadcastChannel(CHAT_CHANNEL_NAME);
    } catch {
      return null;
    }
  }, []);

  function safeParseJson<T>(raw: string | null): T | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  // Load persisted chat state on first mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = safeParseJson<any>(window.localStorage.getItem(CHAT_STORAGE_KEY));
    const incomingAt = typeof saved?.updatedAt === 'number' ? saved.updatedAt : 0;
    if (incomingAt) lastAppliedSyncAtRef.current = incomingAt;
    if (saved?.chatMessages?.length) setChatMessages(saved.chatMessages);
    if (saved?.chatContext) setChatContext(saved.chatContext);
  }, []);

  // Persist + broadcast whenever chat state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = { chatMessages, chatContext, updatedAt: Date.now() };
    lastAppliedSyncAtRef.current = payload.updatedAt;
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(payload));
    chatChannel?.postMessage({ type: 'SYNC', payload });
  }, [chatMessages, chatContext, chatChannel]);

  // Receive sync from full page / other tabs
  useEffect(() => {
    if (!chatChannel) return;
    const handler = (ev: MessageEvent) => {
      const msg = ev.data;
      if (msg?.type !== 'SYNC') return;
      const payload = msg.payload;
      const incomingAt = typeof payload?.updatedAt === 'number' ? payload.updatedAt : 0;
      if (!incomingAt) return;
      if (incomingAt <= lastAppliedSyncAtRef.current) return;
      lastAppliedSyncAtRef.current = incomingAt;
      if (payload?.chatMessages?.length) setChatMessages(payload.chatMessages);
      if (payload?.chatContext) setChatContext(payload.chatContext);
    };
    chatChannel.addEventListener('message', handler);
    return () => chatChannel.removeEventListener('message', handler);
  }, [chatChannel]);

  // Fallback sync via storage event
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CHAT_STORAGE_KEY) return;
      const payload = safeParseJson<any>(e.newValue);
      const incomingAt = typeof payload?.updatedAt === 'number' ? payload.updatedAt : 0;
      if (!incomingAt) return;
      if (incomingAt <= lastAppliedSyncAtRef.current) return;
      lastAppliedSyncAtRef.current = incomingAt;
      if (payload?.chatMessages?.length) setChatMessages(payload.chatMessages);
      if (payload?.chatContext) setChatContext(payload.chatContext);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const [nearestWorkshopKm, setNearestWorkshopKm] = useState<number | null>(null);
  const [nearestWorkshopName, setNearestWorkshopName] = useState<string | null>(null);
  const [nearestWorkshopLoading, setNearestWorkshopLoading] = useState(false);
  const [nearestWorkshopDenied, setNearestWorkshopDenied] = useState(false);

  // Pricing Data based on Car Type
  const pricingData = {
    hatchback: { basic: '₹1,999', premium: '₹3,999', comprehensive: '₹6,999' },
    sedan: { basic: '₹2,499', premium: '₹4,999', comprehensive: '₹8,999' },
    suv: { basic: '₹3,499', premium: '₹6,499', comprehensive: '₹10,999' }
  };

  // Brand Logos - Fetch from database
  const [brandLogos, setBrandLogos] = useState<Array<{ name: string; logo: string }>>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);

  useEffect(() => {
    async function fetchBrands() {
      try {
        const response = await fetch('/api/super_admin/car-brands?active_only=true');
        if (response.ok) {
          const result = await response.json();
          const brands = (result.data || []).map((brand: any) => ({
            name: brand.name,
            logo: brand.logo_url,
          }));
          setBrandLogos(brands);
        } else {
          // Fallback to empty array if API fails
          setBrandLogos([]);
        }
      } catch (error) {
        console.error('Error fetching brands:', error);
        setBrandLogos([]);
      } finally {
        setBrandsLoading(false);
      }
    }
    fetchBrands();
  }, []);

  useEffect(() => {
    let watchId: number | null = null;
    let cancelled = false;

    async function computeNearest(pos: GeolocationPosition) {
      try {
        setNearestWorkshopLoading(true);
        setNearestWorkshopDenied(false);
        const user = { lat: pos.coords.latitude, lng: pos.coords.longitude };

        const supabase = createClient();
        const { data, error } = await supabase
          .from('workshops')
          .select('id,name,workshop_name,latitude,longitude,map_link,is_verified')
          .eq('is_verified', true)
          .limit(500);
        if (error) throw error;
        if (cancelled) return;

        type Row = {
          id: string;
          name: string;
          workshop_name: string | null;
          latitude: number | null;
          longitude: number | null;
          map_link: string | null;
        };
        const rows = (data as unknown as Row[]) ?? [];

        let best: { km: number; name: string } | null = null;
        for (const w of rows) {
          let lat = w.latitude;
          let lng = w.longitude;
          if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            const fromLink = extractLatLngFromMapLink(w.map_link);
            if (fromLink) {
              lat = fromLink.lat;
              lng = fromLink.lng;
            }
          }
          if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const km = haversineKm(user, { lat, lng });
          if (!Number.isFinite(km)) continue;
          if (!best || km < best.km) best = { km, name: w.workshop_name || w.name };
        }

        setNearestWorkshopKm(best ? Math.max(0, best.km) : null);
        setNearestWorkshopName(best?.name ?? null);
      } catch (e) {
        console.error('Error computing nearest workshop:', e);
      } finally {
        if (!cancelled) setNearestWorkshopLoading(false);
      }
    }

    function onDenied() {
      if (cancelled) return;
      setNearestWorkshopDenied(true);
      setNearestWorkshopLoading(false);
      setNearestWorkshopKm(null);
      setNearestWorkshopName(null);
    }

    if (!('geolocation' in navigator)) return;

    setNearestWorkshopLoading(true);
    navigator.geolocation.getCurrentPosition(computeNearest, onDenied, {
      enableHighAccuracy: false,
      timeout: 7000,
      maximumAge: 5 * 60 * 1000,
    });

    // "Real-time": watch for changes while page is open (best-effort).
    watchId = navigator.geolocation.watchPosition(computeNearest, () => {}, {
      enableHighAccuracy: false,
      maximumAge: 60 * 1000,
      timeout: 10000,
    });

    return () => {
      cancelled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Keep chat scrolled to latest message
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages.length, isChatOpen, chatLoading]);

  // Best-effort: auto-capture location when chat opens (helps RSA booking without extra questions)
  useEffect(() => {
    if (!isChatOpen) return;
    if (chatContext?.addressText) return;
    if (!('geolocation' in navigator)) return;

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (cancelled) return;
          setChatContext((prev: any) => ({ ...(prev || {}), locationLat: lat, locationLng: lng }));
          // Reverse geocode (best-effort)
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
  }, [isChatOpen, chatContext?.addressText]);

  function extractPhoneFromText(text: string) {
    const digits = (text || '').replace(/\D/g, '');
    if (digits.length >= 10) return digits.slice(-10);
    return null;
  }

  function extractVehicleNumberFromText(text: string) {
    const m = (text || '')
      .toUpperCase()
      .match(/\b([A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,2}\s?\d{3,4})\b/);
    if (!m) return null;
    return m[1].replace(/\s+/g, '');
  }

  async function sendChatMessage(rawText: string, displayText?: string) {
    const text = (rawText || '').trim();
    const shown = (displayText || rawText || '').trim();
    if (!text) return;
    if (chatLoading) return;

    const userId = `u_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setChatMessages((prev) => [...prev, { id: userId, role: 'user', text: shown }]);
    setChatDraft('');
    setChatLoading(true);

    // Update context from user's message (best-effort)
    const phone = extractPhoneFromText(shown);
    const vehicle = extractVehicleNumberFromText(shown);
    const nextContext = {
      ...(chatContext || {}),
      ...(phone ? { customerPhone: phone } : {}),
      ...(vehicle ? { vehicleNumber: vehicle } : {}),
    };

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: nextContext,
        }),
      });

      const data: any = await res.json().catch(() => null);
      if (res.ok && data?.conversationId) setChatConnected(true);
      const assistantText =
        (typeof data?.assistantMessage === 'string' && data.assistantMessage.trim()) ||
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
        return undefined;
      })();

      const botId = `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setChatMessages((prev) => [
        ...prev,
        { id: botId, role: 'assistant', text: assistantText, suggestions: uiSuggestions, ui: uiPayload },
      ]);

      // Merge context patch from server
      if (data?.contextPatch) {
        // Ensure we don't lose locally-derived fields (like locationLat/Lng) when server returns partial patches
        setChatContext((prev: any) => ({ ...(prev || {}), ...(nextContext || {}), ...(data.contextPatch || {}) }));
      } else {
        setChatContext(nextContext);
      }
    } catch (e) {
      const botId = `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setChatMessages((prev) => [
        ...prev,
        { id: botId, role: 'assistant', text: 'Network issue. Please try again.' },
      ]);
      setChatConnected(false);
      setChatContext(nextContext);
    } finally {
      setChatLoading(false);
    }
  }

  const services = [
    {
      icon: Activity,
      title: 'Periodic Car Service',
      desc: 'Scheduled maintenance by A-Grade verified multi-brand workshops',
      slug: 'periodic-service',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      ring: 'ring-blue-200/60',
      priceFrom: '₹2,999',
      eta: '2–3 hrs',
      warranty: '1000 kms / 1 Month',
      highlights: ['Live Photos & Videos Updates', 'Same-Day Servicing', 'Free Pickup & Drop', 'Genuine OEM/OES Parts', 'Detailed Inspection Report', 'Car Delivery At Your Doorstep'],
    },
    {
      icon: Zap,
      title: 'Car Engine Service',
      desc: 'Complete engine inspection and repair by expert mechanics',
      slug: 'engine-service',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      ring: 'ring-orange-200/60',
      priceFrom: '₹2,499',
      eta: '1–3 hrs',
      warranty: 'NA',
      highlights: ['Live Photos & Videos Updates', 'Transparent Pricing', 'Free Pickup & Drop', 'Genuine OEM/OES Parts', 'Complete Engine Bay Check-Up', 'Performance Tuning'],
    },
    {
      icon: Shield,
      title: 'Car AC Service',
      desc: 'Inspection, Gas Refill, and AC Performance Service',
      slug: 'ac-service',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      ring: 'ring-emerald-200/60',
      priceFrom: '₹1,299',
      eta: '1–2 hrs',
      warranty: 'NA',
      highlights: ['Live Photos & Videos Updates', 'Transparent Pricing', 'Free Pickup & Drop', 'Genuine OEM/OES Parts', 'Cooling Check', 'Gas Top-Up/Refill'],
    },
    {
      icon: Zap,
      title: 'Car Battery Service',
      desc: 'Battery Testing, Battery Replacement, and Warranty Support',
      slug: 'battery-service',
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      ring: 'ring-yellow-200/60',
      priceFrom: '₹899',
      eta: '30–60 min',
      warranty: 'NA',
      highlights: ['Live Photos & Videos Updates', 'Transparent Pricing', 'Free Pickup & Drop', 'Genuine OEM/OES Parts', 'Jumpstart support', 'Warranty Registration'],
    },
    {
      icon: Shield,
      title: 'Brake Service',
      desc: 'Brake Inspection, Brake Pad Replacement, and Safety Checks',
      slug: 'brake-service',
      color: 'text-red-600',
      bg: 'bg-red-50',
      ring: 'ring-red-200/60',
      priceFrom: '₹1,499',
      eta: '1–2 hrs',
      warranty: 'NA',
      highlights: ['Live Photos & Videos Updates', 'Transparent Pricing', 'Free Pickup & Drop', 'Genuine OEM/OES Parts', 'Brake Pads Replacement', 'Safety Road Test'],
    },
    {
      icon: Car,
      title: 'Tyre & Wheel Care',
      desc: 'Wheel Alignment & Balancing, and Tyre Services',
      slug: 'tyre-wheel-care',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      ring: 'ring-purple-200/60',
      priceFrom: '₹699',
      eta: '45–90 min',
      warranty: 'NA',
      highlights: ['Live Photos & Videos Updates', 'Transparent Pricing', 'Free Pickup & Drop', 'Genuine OEM/OES Parts', 'Alignment & Balancing', 'Tyre Rotation'],
    },
    {
      icon: Activity,
      title: 'Detailing Service',
      desc: 'Interior & Exterior Detailing With Paint Protection Options',
      slug: 'detailing-service',
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
      ring: 'ring-cyan-200/60',
      priceFrom: '₹2,999',
      eta: '3–6 hrs',
      warranty: 'NA',
      highlights: ['Live Photos & Videos Updates', 'Transparent Pricing', 'Free Pickup & Drop', 'Genuine OEM/OES Parts', 'Interior Deep Clean', 'Exterior Polish'],
    },
    {
      icon: Car,
      title: 'Denting & Painting',
      desc: 'Precision Bodywork With Colour-Matched Painting',
      slug: 'denting-painting',
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      ring: 'ring-indigo-200/60',
      priceFrom: '₹3,999',
      eta: '1–3 days',
      warranty: 'Depends on Package',
      highlights: ['Live Photos & Videos Updates', 'Transparent Pricing', 'Free Pickup & Drop', 'Genuine OEM/OES Parts', 'Color Matching', 'Premium Finish'],
    },
  ] satisfies ServiceExplorerItem[];

  return (
    <div className="min-h-screen bg-white font-poppins text-text-body selection:bg-brand-primary/20">
      <Navbar />

      {/* Header AI Search Bar (full-width, under navbar) */}
      <div className="hidden w-full mt-16 sm:mt-20 md:mt-24 bg-white/70 backdrop-blur border-b border-gray-200/70">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = headerAiQuery.trim();
              if (!q) return;
              setChatDraft(q);
              window.location.href = appendUtmToHref('/ai-booking');
            }}
            className="w-full"
          >
            <div className="w-full rounded-2xl border border-white/60 bg-gradient-to-r from-blue-50/80 via-white/80 to-purple-50/80 backdrop-blur shadow-lg shadow-blue-900/10 p-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex items-center gap-3 flex-1 rounded-xl bg-white/70 border border-gray-200 px-4 py-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">
                      Ask MY FNG AI
                    </div>
                    <input
                      id="header-ai-query"
                      name="header-ai-query"
                      value={headerAiQuery}
                      onChange={(e) => setHeaderAiQuery(e.target.value)}
                      placeholder="Describe your issue (e.g. AC not cooling, brake noise, battery weak...)"
                      className="mt-0.5 w-full bg-transparent text-sm sm:text-base font-semibold text-gray-900 placeholder:text-gray-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-white font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition"
                >
                  Ask AI <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* 1. Hero Section: AI-Powered & Futuristic - Updated Clean Look */}
      <section className="relative pt-24 pb-8 sm:pt-24 sm:pb-10 lg:pt-24 lg:pb-12 lg:min-h-[calc(100vh-84px)] overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="absolute top-0 right-0 w-full lg:w-1/2 h-full bg-gradient-to-l from-blue-100/40 to-transparent transform skew-x-12 translate-x-1/4"></div>
        
        {/* Floating background blobs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-float" style={{animationDelay: '1.5s'}}></div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-6 sm:gap-8 lg:gap-10">
            
            {/* Left Content – higher z so buttons are never covered by right visual */}
            <div className="lg:col-span-6 text-center lg:text-left w-full relative z-20">
              {/* AI Badge */}
              <div className="mb-4 lg:mb-5 flex justify-center lg:justify-start">
                <AIFeatureBadge text="Powered by Advanced AI Technology" />
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-6xl font-bold mb-4 lg:mb-5 text-gray-900 leading-tight tracking-tight">
                India's First <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  AI-Powered Car
                </span> <br />
                Service Booking Platform
              </h1>
              
              <p className="text-base sm:text-lg lg:text-lg text-gray-600 mb-6 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
                Verified garages, photo & video updates, transparent pricing, genuine parts and warranty - all managed by MY FNG.
              </p>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
                <Link
                  href="/book-service"
                  className="btn inline-flex w-full sm:w-auto sm:min-w-[220px] items-center justify-center rounded-2xl px-6 py-3.5 text-base sm:text-lg font-semibold text-white bg-blue-600 shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  Book Service Now
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setChatDraft('I want to book a car service.');
                    window.location.href = appendUtmToHref('/ai-booking');
                  }}
                  className="btn inline-flex w-full sm:w-auto sm:min-w-[240px] items-center justify-center gap-2 rounded-2xl px-7 py-4 text-base sm:text-lg font-semibold text-blue-900 bg-white border border-blue-200 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <Bot className="w-5 h-5" />
                  Book via MY FNG AI
                </button>

                <Link
                  href="/workshops"
                  className="hidden btn inline-flex w-full sm:w-auto sm:min-w-[240px] items-center justify-center gap-2 rounded-2xl px-7 py-4 text-base sm:text-lg font-semibold text-gray-900 bg-white/70 backdrop-blur border border-gray-200 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:bg-white hover:text-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <MapPin className="w-5 h-5" />
                  Find Verified Workshops
                </Link>
              </div>

              {/* Dynamic FOMO - Live Indicator */}
              <div className="mt-4 lg:mt-5 flex justify-center lg:justify-start">
                <div className="max-w-xl">
                  <DynamicFOMO />
                </div>
              </div>

              {/* Trust tiles moved to full-width below hero (see below) */}
            </div>

            {/* Right Visual */}
            <div className="lg:col-span-6 relative w-full mt-3 sm:mt-4 lg:mt-0 min-w-0">
              <div className="relative z-10 perspective-1000">
                {/* Main Image - Using the clean futuristic car image */}
                <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/20 bg-white p-2 border border-white/50 backdrop-blur-sm">
                  <div className="rounded-2xl overflow-hidden relative bg-gradient-to-b from-gray-100 to-white">
                     {/* Using a placeholder car illustration or the existing image but styled cleaner */}
                     <img
                      src={
                        activeHeroServiceSlide?.image ||
                        'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=1000'
                      }
                      alt={activeHeroServiceSlide?.title || 'Featured service image'}
                      className="w-full object-cover h-[260px] sm:h-[340px] lg:h-[360px] mix-blend-multiply opacity-90 hover:opacity-100 transition-opacity duration-500"
                    />
                    {/* Gradient Overlay for better text visibility if needed */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent"></div>
                  </div>
                </div>
                
                {/* Floating Card 1: AI Recommendation – keep inside right column to avoid overlapping left */}
                <div className="hidden sm:block absolute -top-6 left-2 md:top-8 md:left-0 bg-white p-4 rounded-2xl shadow-xl shadow-blue-900/5 border border-blue-50 animate-float z-20 max-w-[240px]">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-600/20">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">AI Booking Suggestion</div>
                      <div className="font-bold text-gray-900 text-sm leading-tight">Recommended Service Package</div>
                    </div>
                  </div>
                </div>

                {/* Floating Card 2: Health Status */}
                <div className="hidden sm:block absolute top-1/3 -right-6 md:-right-12 bg-white p-4 rounded-2xl shadow-xl shadow-green-900/5 border border-green-50 animate-float z-20 max-w-[200px]" style={{animationDelay: '1s'}}>
                   <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-green-600 uppercase tracking-wider">Service Progress</div>
                      <div className="font-bold text-gray-900 text-sm">Live Updates Enabled</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                    <div className="bg-green-500 h-1.5 rounded-full" style={{width: '92%'}}></div>
                  </div>
                </div>

                {/* Floating Card 3: Nearest Workshop – keep inside right column */}
                <div className="hidden sm:block absolute -bottom-8 left-4 md:bottom-8 md:left-2 bg-white p-4 rounded-2xl shadow-xl shadow-purple-900/5 border border-purple-50 animate-float z-20" style={{animationDelay: '2s'}}>
                   <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-600/20">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Nearest Workshop</div>
                      <div className="font-bold text-gray-900 text-sm">
                        {nearestWorkshopLoading ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-gray-500" /> Finding…
                          </span>
                        ) : nearestWorkshopKm != null ? (
                          <>
                            {nearestWorkshopKm < 1 ? `${Math.round(nearestWorkshopKm * 1000)} m` : `${nearestWorkshopKm.toFixed(1)} km`} away
                          </>
                        ) : nearestWorkshopDenied ? (
                          'Enable location to see distance'
                        ) : (
                          'Distance unavailable'
                        )}
                      </div>
                      {nearestWorkshopName && !nearestWorkshopLoading ? (
                        <div className="mt-0.5 text-[11px] text-gray-500 truncate max-w-[180px]">{nearestWorkshopName}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust tiles (same style as TrustBadges) - Full width */}
          <div className="mt-6 lg:mt-8 animate-fade-in-up" style={{ animationDelay: '0.75s' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {[
                { icon: CheckCircle, title: 'Free Pickup & Drop', desc: 'Doorstep convenience included' },
                { icon: Cpu, title: '100+ Workshops', desc: 'Strong, growing partner network' },
                { icon: Shield, title: 'Service Warranty', desc: '1000 km or 1 month coverage' },
                { icon: MapPin, title: 'Same-Day Service', desc: 'Available for most services' },
              ].map((b, idx) => {
                const Icon = b.icon;
                return (
                  <div
                    key={b.title}
                    className="bg-white/50 backdrop-blur-sm rounded-xl p-3 sm:p-4 flex items-center gap-3 animate-fade-in"
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-white" />
          </div>
                    <div>
                      <div className="text-sm sm:text-[15px] font-bold text-gray-900 leading-snug">{b.title}</div>
                      <div className="text-xs text-gray-600">{b.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trust Badges removed (per requirement) */}
        </div>
      </section>

      {/* Live Stats Section */}
      <section className="py-8 sm:py-10 md:py-12 bg-gradient-to-br from-gray-50 to-white">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <AIFeatureBadge text="Live Platform Metrics" />
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-3 sm:mt-4 mb-3 sm:mb-4 text-brand-secondary">
              Trusted by Thousands of
              <br className="sm:hidden" /> Car Owners
            </h2>
            <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto px-2 sm:px-0">
              India&apos;s fast-growing AI-powered car service booking
              <br className="sm:hidden" /> platform.
            </p>
          </div>
          <LiveStats />
        </div>
      </section>

      {/* 2. Our Services - Option G: Filter Bar + Results (shop-like) */}
      <ServiceExplorer
        services={services}
        onAskAI={() => (window.location.href = appendUtmToHref('/ai-booking'))}
        onQuickBook={() => setIsBookingFormOpen(true)}
        popularSlugs={['periodic-service', 'ac-service', 'battery-service', 'brake-service', 'engine-service']}
      />

      {/* 3. Brands We Serve - Horizontal Scrolling */}
      <section className="py-8 sm:py-10 md:py-12 bg-gray-50">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <AIFeatureBadge text="Brands We Serve" />
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-brand-secondary">We Service All Major Car Brands</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-3 sm:mt-4 px-4">
              From Maruti to Mercedes, we've got you covered
            </p>
          </div>

          <div className="relative overflow-hidden py-2 sm:py-4">
            {brandsLoading ? (
              <div className="flex justify-center items-center py-8 sm:py-10 md:py-12">
                <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 animate-spin text-brand-primary" />
              </div>
            ) : brandLogos.length === 0 ? (
              <div className="text-center py-8 sm:py-10 md:py-12 text-gray-500">
                <Car className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 mx-auto mb-3 sm:mb-4 text-gray-400" />
                <p className="text-sm sm:text-base">No brands available. Please add brands from admin panel.</p>
              </div>
            ) : (
              <div className="flex gap-4 sm:gap-5 md:gap-6 animate-scroll-horizontal">
                {/* Brand logos with images */}
                {brandLogos.map((brand, idx) => (
                  <div key={`brand-1-${idx}`} className="flex items-center justify-center min-w-[120px] sm:min-w-[130px] md:min-w-[140px] h-20 sm:h-24 md:h-28 bg-white rounded-lg sm:rounded-xl shadow-md hover:shadow-xl transition-all p-3 sm:p-4 md:p-5 border border-gray-100 flex-shrink-0 group relative">
                    <img 
                      src={brand.logo} 
                      alt={brand.name} 
                      className="object-contain w-full h-full max-w-[120px] max-h-[70px] group-hover:scale-110 transition-transform"
                      loading="eager"
                      onError={(e) => {
                        // Fallback: show brand name if image fails
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.brand-fallback')) {
                          const fallback = document.createElement('span');
                          fallback.className = 'brand-fallback text-sm font-bold text-gray-700 text-center px-3';
                          fallback.textContent = brand.name;
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                    {/* Always show brand name below logo */}
                    <span className="absolute -bottom-6 left-0 right-0 text-xs font-semibold text-gray-600 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {brand.name}
                    </span>
                  </div>
                ))}
                {/* Duplicate for seamless loop */}
                {brandLogos.map((brand, idx) => (
                  <div key={`brand-2-${idx}`} className="flex items-center justify-center min-w-[140px] h-28 bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-5 border border-gray-100 flex-shrink-0 group relative">
                    <img 
                      src={brand.logo} 
                      alt={brand.name} 
                      className="object-contain w-full h-full max-w-[120px] max-h-[70px] group-hover:scale-110 transition-transform"
                      loading="eager"
                      onError={(e) => {
                        // Fallback: show brand name if image fails
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.brand-fallback')) {
                          const fallback = document.createElement('span');
                          fallback.className = 'brand-fallback text-sm font-bold text-gray-700 text-center px-3';
                          fallback.textContent = brand.name;
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                    {/* Always show brand name below logo */}
                    <span className="absolute -bottom-6 left-0 right-0 text-xs font-semibold text-gray-600 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {brand.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. How MY FNG Works - Interactive Split Screen */}
      <section className="py-8 sm:py-10 md:py-14 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <AIFeatureBadge text="How It Works" />
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold mt-3 mb-4 text-gray-900">
              How MY FNG Manages
              <br className="sm:hidden" /> Your Car Service
            </h2>
            <p className="text-[13px] leading-5 sm:text-lg sm:leading-7 text-gray-600 max-w-2xl mx-auto">
              From booking to delivery, every step is coordinated, documented, and supported by MY FNG.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 lg:gap-20 items-start max-w-6xl mx-auto">
            
            {/* Left Column: Interactive Steps List */}
            <div className="w-full lg:w-1/2 space-y-4">
              {[
                { 
                  icon: <MessageSquare className="w-5 h-5" />, 
                  title: "Book via MY FNG AI", 
                  desc: "Chat with our AI assistant to select your service and preferred time. No calls required." 
                },
                { 
                  icon: <Calendar className="w-5 h-5" />, 
                  title: "Pickup Scheduled", 
                  desc: "We confirm your slot and arrange doorstep pickup at your convenience." 
                },
                { 
                  icon: <MapPin className="w-5 h-5" />, 
                  title: "Tracking & Updates", 
                  desc: "Track your car's journey and receive photos & video updates during service." 
                },
                { 
                  icon: <CheckCircle className="w-5 h-5" />, 
                  title: "Quality Check", 
                  desc: "Service completion is verified as per MY FNG process before delivery." 
                },
                { 
                  icon: <Shield className="w-5 h-5" />, 
                  title: "Delivery & Warranty", 
                  desc: "Your car is delivered back with service documentation and warranty coverage." 
                }
              ].map((step, idx) => (
                <div 
                  key={idx}
                  onMouseEnter={() => setActiveStep(idx)}
                  className={`group p-4 sm:p-6 rounded-2xl cursor-pointer transition-all duration-300 border-2 ${
                    activeStep === idx 
                      ? 'bg-blue-50 border-blue-500 shadow-lg scale-[1.02]' 
                      : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-100'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                      activeStep === idx ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className={`text-base sm:text-lg font-bold mb-1 transition-colors ${activeStep === idx ? 'text-blue-900' : 'text-gray-900'}`}>
                        {step.title}
                      </h3>
                      <p className={`text-sm leading-relaxed transition-colors ${activeStep === idx ? 'text-blue-700' : 'text-gray-500'}`}>
                        {step.desc}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right Column: Sticky Visual Preview */}
            <div className="w-full lg:w-1/2 lg:sticky lg:top-32 hidden lg:block">
              <div className="relative aspect-square md:aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-10 flex flex-col items-center justify-center text-center transition-all duration-500">
                {/* Decorative Background Circles */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-60 h-60 bg-blue-400/20 rounded-full blur-3xl"></div>
                
                {/* Dynamic Content based on activeStep */}
                <div className="relative z-10 animate-fade-in-up" key={activeStep}>
                  <div className="w-24 h-24 mx-auto bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mb-8 shadow-xl border border-white/30">
                    {/* Render the active icon larger */}
                    {[
                      <MessageSquare className="w-12 h-12 text-white" key="0" />, 
                      <Calendar className="w-12 h-12 text-white" key="1" />,
                      <MapPin className="w-12 h-12 text-white" key="2" />,
                      <CheckCircle className="w-12 h-12 text-white" key="3" />,
                      <Shield className="w-12 h-12 text-white" key="4" />
                    ][activeStep]}
                  </div>
                  
                  <h3 className="text-3xl font-bold mb-4 text-white">
                    {[
                      "Smart Booking Assistant",
                      "Doorstep Pickup Confirmed",
                      "Real-Time Service Updates",
                      "Service Review & Approval",
                      "Delivered with Warranty"
                    ][activeStep]}
                  </h3>
                  
                  <p className="text-blue-100 text-lg max-w-xs mx-auto">
                    {[
                      "Book in Minutes. No Calls Needed.",
                      "Pickup Scheduled at Your Convenience",
                      "Track pickup, workshop progress, and view photos as work happens.",
                      "Work summary and documentation shared before delivery.",
                      "Car returned to you with service documentation and coverage."
                    ][activeStep]}
                  </p>

                  {/* Progress Indicator */}
                  <div className="flex gap-2 justify-center mt-10">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === activeStep ? 'w-8 bg-white' : 'w-2 bg-white/30'}`}></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Why Choose MY FNG */}
      <section className="py-8 sm:py-10 md:py-12 bg-gradient-to-br from-brand-primary/5 to-brand-secondary/5">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <AIFeatureBadge text="Why Choose Us" />
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-brand-secondary">Why Choose MY FNG?</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-3 sm:mt-4 max-w-2xl mx-auto px-4">
              India's most transparent, AI-powered car service platform - built for reliability, not guesswork.
            </p>
          </div>

          {(() => {
            type IntentMeta = {
              id: WhyIntent;
              title: string;
              desc: string;
              icon: any;
              pill: string;
              card: string;
              glow: string;
            };

            type WhyFeature = {
              id: string;
              title: string;
              desc: string;
              icon: any;
              color: string;
              bg: string;
              intents: WhyIntent[];
            };

            // Tiles remain static; no selection behavior.
            const intents: IntentMeta[] = [
              {
                id: 'instant' as const,
                title: 'AI-Powered Booking',
                desc: '60 Secs Booking. No Calls. No Follow-Ups.',
                icon: Bot,
                link: '/ai-booking',
                pill: 'bg-blue-600 text-white',
                card: 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white',
                glow: 'bg-blue-500/30',
              },
              {
                id: 'save' as const,
                title: 'Verified Workshops Only',
                desc: "We audit workshops. You don't have to.",
                icon: Shield,
                link: '/workshop-locator',
                pill: 'bg-blue-600 text-white',
                card: 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white',
                glow: 'bg-blue-500/30',
              },
              {
                id: 'control' as const,
                title: 'Free Pickup & Drop',
                desc: 'Doorstep convenience at no extra cost.',
                icon: Car,
                link: '/book-service',
                pill: 'bg-blue-600 text-white',
                card: 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white',
                glow: 'bg-blue-500/30',
              },
              {
                id: 'trust' as const,
                title: 'MY FNG Service Guarantee',
                desc: 'We own the experience, end to end.',
                icon: CheckCircle,
                link: '/book-service',
                pill: 'bg-blue-600 text-white',
                card: 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white',
                glow: 'bg-blue-500/30',
              },
            ];

            const features: WhyFeature[] = [
              {
                id: 'parts',
                title: 'Genuine / OEM / OES Spare Parts',
                desc: 'Only genuine, OEM, or OES-recommended parts used.',
                icon: Wrench,
                color: 'text-blue-600',
                bg: 'bg-blue-50',
                intents: ['trust'],
              },
              {
                id: 'same-day-service',
                title: 'Same-Day Service',
                desc: "Quick turnaround for most jobs with committed timelines. If there's a delay, you're informed in advance.",
                icon: Clock,
                color: 'text-green-600',
                bg: 'bg-green-50',
                intents: ['control'],
              },
              {
                id: 'pricing',
                title: 'Transparent Pricing',
                desc: 'No hidden charges.',
                icon: Shield,
                color: 'text-orange-600',
                bg: 'bg-orange-50',
                intents: ['save'],
              },
              {
                id: 'live-tracking',
                title: 'Live Service Tracking',
                desc: 'Get photo updates and track progress in real-time.',
                icon: TrendingUp,
                color: 'text-gray-900',
                bg: 'bg-gray-100',
                intents: ['control', 'trust'],
              },
              {
                id: 'quality-first',
                title: 'Quality-Checked Parts',
                desc: 'Every part is quality-checked before installation.',
                icon: Award,
                color: 'text-purple-600',
                bg: 'bg-purple-50',
                intents: ['trust'],
              },
              {
                id: 'expert-team',
                title: 'Expert Technicians',
                desc: 'Skilled professionals trained for modern car servicing.',
                icon: Users,
                color: 'text-red-600',
                bg: 'bg-red-50',
                intents: ['trust'],
              },
              {
                id: 'warranty',
                title: 'Service Warranty',
                desc: '1000km / 1 Month warranty included.',
                icon: CheckCircle,
                color: 'text-teal-600',
                bg: 'bg-teal-50',
                intents: ['trust', 'save'],
              },
              {
                id: 'support',
                title: '24/7 MY FNG Support',
                desc: 'We are always here to help you, anytime, anywhere.',
                icon: Heart,
                color: 'text-indigo-600',
                bg: 'bg-indigo-50',
                intents: ['trust'],
              },
            ];

            // Keep the section content stable (no "active" intent switching)
            const activeIntent = intents[0];
            // Requirement: only 2 content cards show here
            const filtered = features.filter((f) => f.id === 'parts' || f.id === 'same-day-service');
            const includedItems = [
              'Transparent Pricing (No hidden charges)',
              'Live Service Tracking',
              'Quality-Checked Parts',
              'Expert Technicians',
              'Service Warranty',
              '24/7 MY FNG Support',
            ];
            const HeroIcon = activeIntent.icon;

            return (
              <div className="mt-12 max-w-7xl mx-auto">
                {/* Intent tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {intents.map((i) => {
                    const Icon = i.icon;
                    return (
                      <button
                        key={i.id}
                        type="button"
                        // No click/hover behavior: content & color stay constant
                        className="group text-center rounded-2xl sm:rounded-3xl border transition-all duration-300 p-3 sm:p-5 border-white/60 bg-white/70 backdrop-blur hover:bg-white hover:border-gray-200 hover:shadow-lg"
                        aria-pressed={false}
                      >
                        <div className="flex items-start justify-center gap-3">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center ${i.pill}`}>
                            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                          </div>
                        </div>
                        <div className="mt-3 text-center">
                          <div className="text-[13px] sm:text-lg font-extrabold text-gray-900 leading-snug">{i.title}</div>
                          <div className="mt-1 text-[11px] sm:text-sm text-gray-600 leading-relaxed line-clamp-2">{i.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Intent result */}
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
                  {/* Hero */}
                  <div className="lg:col-span-5 lg:sticky lg:top-28">
                    <div className={`relative overflow-hidden rounded-3xl p-7 sm:p-8 shadow-2xl ${activeIntent.card}`}>
                      <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl ${activeIntent.glow}`} />
                      <div className="relative z-10">
                        <div className="flex items-start justify-between gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
                            <HeroIcon className="w-7 h-7 text-white" />
                          </div>
                          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/20 px-3 py-1.5 text-xs font-bold">
                            Your goal
                          </span>
                        </div>

                        <h3 className="mt-5 text-2xl sm:text-3xl font-extrabold leading-tight text-white">Complete Transparency</h3>
                        <p className="mt-3 text-white/85 text-sm sm:text-base leading-relaxed">
                          See what's happening with your car.
                          <br />
                          Photos, videos, estimates, and approvals shared at every stage of service.
                        </p>

                        <div className="mt-6 grid grid-cols-2 gap-3">
                          {/* Requirement: only 2 content boxes, and constant */}
                              <div className="rounded-2xl bg-white/10 border border-white/15 p-4">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-white/70">Real-time</div>
                                <div className="mt-1 font-extrabold">Photo & video updates</div>
                              </div>
                              <div className="rounded-2xl bg-white/10 border border-white/15 p-4">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-white/70">Approval-first</div>
                                <div className="mt-1 font-extrabold">No work without your go-ahead</div>
                              </div>
                              </div>
                              </div>
                    </div>
                  </div>

                  {/* Filtered cards */}
                  <div className="lg:col-span-7">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filtered.map((f) => {
                        const Icon = f.icon;
                        return (
                          <div
                            key={f.id}
                            className="group relative overflow-hidden rounded-3xl bg-white p-6 shadow-lg border border-gray-100 transition-all hover:-translate-y-1 hover:shadow-xl text-center flex flex-col items-center"
                          >
                            <div
                              className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${f.bg} ${f.color} transition-transform group-hover:scale-110 mx-auto`}
                            >
                              <Icon className="h-6 w-6" />
                            </div>
                            <h3 className="mb-2 text-lg font-extrabold text-gray-900 text-center">{f.title}</h3>
                            <p className="text-sm text-gray-500 leading-relaxed text-center max-w-[34ch] mx-auto">{f.desc}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Extra: show remaining benefits as small chips on large screens */}
                    <div className="mt-5 hidden lg:block">
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                        Also included with every service
                      </div>
                      <p className="text-sm text-gray-600 mb-3">Included as standard. Not add-ons.</p>
                      <div className="flex flex-wrap gap-2">
                        {includedItems.map((item, idx) => (
                            <span
                              key={`chip-${idx}`}
                              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-3 py-2 text-xs font-semibold text-gray-900"
                            >
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              {item}
                            </span>
                          ))}
                      </div>
                      <p className="mt-4 text-sm text-gray-600 leading-relaxed">
                        Thousands of car owners trust MY FNG because we don't just connect you to a workshop - we manage your car service like a professional operation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Emergency Roadside Assistance Section - High Impact */}
      <section className="relative py-10 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
        {/* Dramatic Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-orange-950 to-red-900"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
        
        {/* Animated Elements */}
        <div className="hidden md:block absolute top-0 left-0 w-64 md:w-80 lg:w-96 h-64 md:h-80 lg:h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="hidden md:block absolute bottom-0 right-0 w-64 md:w-80 lg:w-96 h-64 md:h-80 lg:h-96 bg-red-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>

        <div className="container mx-auto px-3 sm:px-4 md:px-6 relative z-10">
          <div className="max-w-6xl mx-auto">
            {/* Split layout (desktop): Left = copy/CTA, Right = services */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 lg:gap-10 items-start">
              {/* Left column */}
              <div className="lg:col-span-5">
            {/* Emergency Badge */}
                <div className="flex justify-center lg:justify-start mb-4 sm:mb-5">
                  <div className="inline-flex items-center gap-2 sm:gap-3 glass px-4 sm:px-5 py-2 sm:py-2.5 rounded-full border border-red-500/30 animate-pulse-glow">
                <div className="relative flex items-center">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full animate-pulse"></div>
                      <div className="absolute w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full animate-ping"></div>
                </div>
                <span className="text-white font-bold text-xs sm:text-sm">24/7 EMERGENCY SUPPORT</span>
              </div>
            </div>

                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center lg:text-left text-white mb-3 sm:mb-4 animate-fade-in-up px-2 sm:px-0">
                  Stuck on the Road? <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
                We're Just a Tap Away!
              </span>
            </h2>

                <p
                  className="text-sm sm:text-base md:text-lg text-gray-300 text-center lg:text-left mb-4 sm:mb-6 animate-fade-in-up"
                  style={{ animationDelay: '0.2s' }}
                >
                  Car breakdown? Flat tire? Battery dead? Our AI-powered roadside assistance reaches you in{' '}
                  <span className="text-white font-bold">under 30 minutes</span>. Available 24/7 across India.
            </p>

                {/* Quick chips */}
                <div className="flex flex-wrap justify-center lg:justify-start gap-2 sm:gap-2.5 mb-5 sm:mb-7 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white">
                    <Clock className="w-4 h-4 text-orange-300" />
                    Under 30 min
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white">
                    <Shield className="w-4 h-4 text-orange-300" />
                    Trusted help
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white">
                    <MapPin className="w-4 h-4 text-orange-300" />
                    Live tracking
                  </span>
                </div>

                {/* CTA */}
                <div className="flex flex-col items-center lg:items-start gap-3 animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
                  <Link
                    href="/car-roadside-assitance"
                    className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-orange-500 to-red-600 text-white text-sm sm:text-lg font-bold px-7 sm:px-10 py-3.5 sm:py-4 rounded-2xl shadow-2xl shadow-red-500/40 transition-all transform hover:-translate-y-0.5 animate-pulse"
                  >
                    <Radio className="w-5 h-5 animate-pulse" />
                    Request Emergency Help →
                  </Link>
                  <p className="text-gray-400 text-xs sm:text-sm text-center lg:text-left">
                    Available in 50+ cities across India • 24/7 Support
                  </p>
                </div>
              </div>

              {/* Right column: Services Grid */}
              <div className="lg:col-span-7">
                {/* Mobile: 2 columns + only 4 cards (page shorter). Desktop: show all 6. */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                  <div className="glass p-4 sm:p-6 rounded-2xl border border-white/10 hover:border-orange-500/50 transition animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                      <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                    <h3 className="text-white font-bold text-base sm:text-lg mb-1.5">Jump Start</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Battery dead? We'll get you started in minutes</p>
              </div>

                  <div className="glass p-4 sm:p-6 rounded-2xl border border-white/10 hover:border-orange-500/50 transition animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                      <Car className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                    <h3 className="text-white font-bold text-base sm:text-lg mb-1.5">Towing Service</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Vehicle won't start? We'll tow it to safety</p>
              </div>

                  <div className="glass p-4 sm:p-6 rounded-2xl border border-white/10 hover:border-orange-500/50 transition animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                      <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                    <h3 className="text-white font-bold text-base sm:text-lg mb-1.5">Flat Tire Fix</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Puncture? We'll change or repair on the spot</p>
              </div>

                  <div className="glass p-4 sm:p-6 rounded-2xl border border-white/10 hover:border-orange-500/50 transition animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                      <Droplets className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                    <h3 className="text-white font-bold text-base sm:text-lg mb-1.5">Fuel Delivery</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Out of fuel? Emergency fuel delivery</p>
              </div>

                  <div className="hidden sm:block glass p-4 sm:p-6 rounded-2xl border border-white/10 hover:border-orange-500/50 transition animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                      <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                    <h3 className="text-white font-bold text-base sm:text-lg mb-1.5">Live GPS Tracking</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Track our technician in real-time</p>
                  </div>

                  <div className="hidden sm:block glass p-4 sm:p-6 rounded-2xl border border-white/10 hover:border-orange-500/50 transition animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
                    <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                      <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <h3 className="text-white font-bold text-base sm:text-lg mb-1.5">Quick Response</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Average arrival time: 25 minutes</p>
              </div>
            </div>

                {/* Mobile only: compact “View all” */}
                <div className="sm:hidden mt-3 flex justify-center">
                  <Link href="/car-roadside-assitance" className="text-sm font-semibold text-orange-200 hover:text-white underline underline-offset-4">
                    View all roadside services →
              </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. From Our Blogs */}
      <section className="py-8 sm:py-10 md:py-12 bg-white">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <AIFeatureBadge text="Latest Updates" />
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-brand-secondary">From Our Blogs</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-3 sm:mt-4 px-4">
              Stay updated with car maintenance tips, industry news, and expert advice
            </p>
          </div>

          {(() => {
            const cards = (latestBlogs.length
              ? latestBlogs.map((b, idx) => {
                  const palette = [
                    { color: 'bg-blue-600', icon: <Sparkles className="w-10 h-10" /> },
                    { color: 'bg-green-500', icon: <TrendingUp className="w-10 h-10" /> },
                    { color: 'bg-purple-600', icon: <Calendar className="w-10 h-10" /> },
                  ];
                  const p = palette[idx % palette.length]!;
                  return (
                    <BlogCard
                      key={b.slug}
                      title={b.title}
                      excerpt={b.excerpt || 'Read the full article on MyFNG blog.'}
                      readTime={b.readTime}
                      tag={b.tag}
                      imageUrl={b.featuredImage}
                      color={p.color}
                      icon={p.icon}
                      href={`/blogs/${b.slug}`}
                    />
                  );
                })
              : [
                  <BlogCard
                    key="fallback-1"
                    title="How AI is Revolutionizing Car Maintenance"
                    excerpt="Discover how AI is transforming car care and making service smarter."
                    readTime="5 min read"
                    tag="AI Technology"
                    color="bg-blue-600"
                    icon={<Sparkles className="w-10 h-10" />}
                    href="/blogs"
                  />,
                  <BlogCard
                    key="fallback-2"
                    title="10 Ways to Save Money on Car Service"
                    excerpt="Practical tips to reduce maintenance costs without compromising quality."
                    readTime="4 min read"
                    tag="Cost Saving"
                    color="bg-green-500"
                    icon={<TrendingUp className="w-10 h-10" />}
                    href="/blogs"
                  />,
                  <BlogCard
                    key="fallback-3"
                    title="Understanding Your Car's Service Schedule"
                    excerpt="Know when and why your car needs servicing for long-term performance."
                    readTime="6 min read"
                    tag="Maintenance"
                    color="bg-purple-600"
                    icon={<Calendar className="w-10 h-10" />}
                    href="/blogs"
                  />,
                  <BlogCard
                    key="fallback-4"
                    title="Signs Your Car Needs Immediate Attention"
                    excerpt="Spot early warning signs and avoid bigger repair bills."
                    readTime="3 min read"
                    tag="Car Care"
                    color="bg-indigo-600"
                    icon={<Wrench className="w-10 h-10" />}
                    href="/blogs"
                  />,
                ]) as any[];

            return (
              <>
                <div className="md:hidden -mx-3 px-3 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2">
                  {cards.map((card, idx) => (
                    <div key={`mobile-blog-card-${idx}`} className="min-w-[86%] snap-center">
                      {card}
                    </div>
                  ))}
                </div>
                <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-8">
                  {cards}
                </div>
              </>
            );
          })()}

          <div className="text-center mt-8 sm:mt-10 md:mt-12">
            <Link href="/blogs" className="btn btn-outline text-sm sm:text-base md:text-lg px-6 sm:px-8 md:px-10 py-2.5 sm:py-3 md:py-4 rounded-xl">
              Read All Blogs <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* 7. What People Say - Testimonials */}
      <section className="py-8 sm:py-10 md:py-12 bg-gray-50">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <AIFeatureBadge text="Testimonials" />
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-brand-secondary">What People Say About Us</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-3 sm:mt-4 px-4">
              Real feedback from our satisfied customers
            </p>
          </div>

          {(() => {
            const reviews = [
              {
                name: 'Rajesh Kumar',
                location: 'Mumbai',
                rating: 5,
                vehicle: 'Honda City',
                text: 'Best car service experience! The AI chatbot made booking so easy. Transparent pricing and excellent service quality.',
              },
              {
                name: 'Priya Sharma',
                location: 'Navi Mumbai',
                rating: 5,
                vehicle: 'Maruti Swift',
                text: 'MY FNG saved me so much time. Real-time updates and professional service. Highly recommended!',
              },
              {
                name: 'Amit Patel',
                location: 'Thane',
                rating: 5,
                vehicle: 'Hyundai Creta',
                text: 'Amazing service! The AI-powered booking was seamless and the technicians were very professional.',
              },
              {
                name: 'Sandeep Singh',
                location: 'Pune',
                rating: 5,
                vehicle: 'Tata Nexon',
                text: 'Pricing was exactly as shown. No surprises. Great quality work and quick delivery.',
              },
              {
                name: 'Ananya Iyer',
                location: 'Bengaluru',
                rating: 5,
                vehicle: 'Toyota Glanza',
                text: 'Support team was super responsive and the service warranty is a big plus.',
              },
            ] as const;

            const featured = reviews[0];
            const rest = reviews.slice(1);
            const avgRating = '4.8';
            const totalReviews = '10,000+';
            const cities = '50+';
            const response = '25 min';

            return (
              <div className="max-w-7xl mx-auto">
                {/* Trust strip */}
                <div className="rounded-3xl border border-white/60 bg-white/75 backdrop-blur shadow-xl shadow-blue-900/10 p-4 sm:p-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    <div className="rounded-2xl bg-white border border-gray-100 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold uppercase tracking-wider text-black">Avg rating</div>
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      </div>
                      <div className="mt-1 text-2xl font-extrabold text-[#023d95]">{avgRating}</div>
                      <div className="mt-1 text-xs text-black">Trusted by customers</div>
                    </div>
                    <div className="rounded-2xl bg-white border border-gray-100 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold uppercase tracking-wider text-black">Reviews</div>
                        <Users className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="mt-1 text-2xl font-extrabold text-[#023d95]">{totalReviews}</div>
                      <div className="mt-1 text-xs text-black">Verified feedback</div>
                    </div>
                    <div className="rounded-2xl bg-white border border-gray-100 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold uppercase tracking-wider text-black">Cities</div>
                        <MapPin className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="mt-1 text-2xl font-extrabold text-[#023d95]">{cities}</div>
                      <div className="mt-1 text-xs text-black">Pan-India network</div>
                    </div>
                    <div className="rounded-2xl bg-white border border-gray-100 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold uppercase tracking-wider text-black">Support</div>
                        <Clock className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="mt-1 text-2xl font-extrabold text-[#023d95]">{response}</div>
                      <div className="mt-1 text-xs text-black">Average response</div>
                    </div>
                  </div>
                </div>

                {/* Reviews grid (with one featured) */}
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 md:gap-8">
                  <div className="sm:col-span-2 lg:col-span-2">
                    <TestimonialCard {...featured} featured />
                  </div>
                  {rest.map((r, idx) => (
                    <TestimonialCard key={`${r.name}-${idx}`} {...r} />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* 8. Frequently Asked Questions */}
      <section className="py-8 sm:py-10 md:py-12 bg-white">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <AIFeatureBadge text="FAQs" />
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-brand-secondary">Frequently Asked Questions</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-3 sm:mt-4 px-4">
              Got questions? We've got answers
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {[
              {
                question: 'How can I book a service appointment with My FNG?',
                answer:
                  'You can book service via MyFNG AI Booking Agent - https://myfng.in/ai-booking or online through our website www.myfng.in/book-service or by calling our customer support. We offer flexible scheduling to accommodate your convenience.',
              },
              {
                question: 'Is the pricing really transparent?',
                answer:
                  "Yes! Our AI shows you exactly what you'll pay upfront. No hidden charges, no surprises. You see the complete breakdown before booking.",
              },
              {
                question: 'How Long Will The Car Service Take?',
                answer:
                  'The time required for a periodic service depends on the work needed and your car’s condition. On average a standard service may take between 5 to 6 hours. We will provide you with an estimated time during the booking process.',
              },
              {
                question: 'Is there a Warranty On The Services Provided?',
                answer:
                  'Yes, all our services come with warranty. Labour warranty is typically 1 month or 1,000 km, and parts warranty varies by component.',
              },
              {
                question: 'Can I track my service in real-time?',
                answer:
                  'You’ll receive service updates, including photos and videos of car service, after the car service completed.',
              },
              {
                question: 'What car brands do you service?',
                answer:
                  'We service all major car brands including Maruti Suzuki, Hyundai, Tata, Mahindra, Honda, Toyota, Ford, Volkswagen, BMW, Mercedes-Benz, Audi, and many more.',
              },
            ].map((faq, idx) => (
              <FAQItem
                key={faq.question}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFaqIndex === idx}
                onToggle={() => setOpenFaqIndex((prev) => (prev === idx ? null : idx))}
              />
            ))}
          </div>
        </div>
      </section>



      {/* Floating Quick Book – above mobile bottom bar when visible (lg:hidden) */}
      {!isChatOpen && (
        <div className="fixed bottom-[5.25rem] right-3 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setIsBookingFormOpen(true)}
            className="bg-white/30 text-brand-primary px-4 py-2.5 rounded-full shadow-xl shadow-blue-500/15 transition-all transform hover:scale-105 flex items-center gap-2 group border border-white/70 backdrop-blur-lg hover:bg-white/40"
          >
            <Zap className="w-5 h-5 group-hover:rotate-12 transition-transform flex-shrink-0" />
            <span className="font-semibold text-sm">Quick Book</span>
            <ArrowRight className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        </div>
      )}

      {/* Floating AI button hidden for mobile by request */}

      {/* Chatbot Modal */}
      {false && (
        <div className="fixed bottom-40 sm:bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in-up">
          {suggestionModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
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
                        {suggestionModal.checklistItems.map((it: any, idx: number) => (
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
          <div className="bg-brand-primary p-3 sm:p-4 flex justify-between items-center gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <div className="bg-white/20 p-1 sm:p-1.5 rounded-lg flex-shrink-0">
                <Bot className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-xs sm:text-sm truncate">MY FNG AI Assistant</p>
                <p className="text-blue-100 text-[10px] sm:text-xs truncate">
                  MY FNG AI • Online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
            <Link
              href="/ai-booking"
              className="text-blue-100 hover:text-white text-[10px] sm:text-xs font-semibold whitespace-nowrap"
            >
                Open
            </Link>
              <Link
                href="/ai-booking"
                className="text-blue-100 hover:text-white text-[10px] sm:text-xs font-semibold whitespace-nowrap"
              >
                V2
              </Link>
            </div>
            <button
              onClick={() => {
                setSuggestionModal(null);
                setIsChatOpen(false);
              }}
              className="text-white/80 hover:text-white text-xl sm:text-2xl flex-shrink-0"
            >
              ×
            </button>
          </div>
          <div ref={chatScrollRef} className="h-64 sm:h-72 md:h-80 bg-gray-50 p-3 sm:p-4 overflow-y-auto">
            {chatMessages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div key={m.id} className={`mb-3 sm:mb-4 ${isUser ? 'flex justify-end' : 'flex'}`}>
                  {!isUser && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-brand-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mr-1.5 sm:mr-2">
                      <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%]`}>
                    <div
                      className={
                        isUser
                          ? 'bg-brand-primary p-2.5 sm:p-3 rounded-xl sm:rounded-2xl rounded-tr-none shadow-sm text-xs sm:text-sm text-white'
                          : 'bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl rounded-tl-none shadow-sm border border-gray-100 text-xs sm:text-sm text-gray-700'
                      }
                    >
                      {m.text.split('\n').map((line, idx) => {
                        const urlMatch = line.match(/(https?:\/\/[^\s]+)/i);
                        if (urlMatch?.[1]) {
                          const url = urlMatch[1];
                          const before = line.slice(0, urlMatch.index || 0);
                          const after = line.slice((urlMatch.index || 0) + url.length);
                          return (
                            <span key={idx}>
                              {before}
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className={isUser ? 'underline text-white' : 'underline text-brand-primary'}
                              >
                                {url}
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
                                  {typeof s.optionNumber === 'number' && (
                                    <div className="text-xs text-gray-500">Option {s.optionNumber}</div>
                                  )}
                                  <div className="font-semibold text-sm text-gray-900">{s.name}</div>
                                  {typeof s.exactPrice === 'number' && s.exactPrice > 0 && (
                                    <div className="text-sm text-green-700 mt-1">
                                      ₹{Math.round(s.exactPrice).toLocaleString('en-IN')}
                                    </div>
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
                                  {typeof s.optionNumber === 'number' && (
                                    <div className="text-xs text-gray-500">Option {s.optionNumber}</div>
                                  )}
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
              <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-brand-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-primary" />
                </div>
                <div className="bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl rounded-tl-none shadow-sm border border-gray-100 text-xs sm:text-sm text-gray-700">
                  Typing...
                </div>
              </div>
            )}
          </div>
          <div className="p-2.5 sm:p-3 border-t border-gray-100 bg-white">
            <div className="flex gap-1.5 sm:gap-2">
              <input
                id="chat-draft"
                name="chat-draft"
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:border-brand-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendChatMessage(chatDraft);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  sendChatMessage(chatDraft);
                }}
                disabled={chatLoading}
                className="bg-brand-primary text-white p-1.5 sm:p-2 rounded-full hover:bg-brand-primary-hover flex-shrink-0 disabled:opacity-60"
              >
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />

      {/* Booking Form Modal */}
      {isBookingFormOpen && (
        <BookingForm onClose={() => setIsBookingFormOpen(false)} />
      )}

    </div>
  );
}

// --- Sub Components ---

function StepCard({ number, title, desc }: { number: string; title: string; desc: string }) {
  return (
    <div className="bg-white p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-brand-primary/30 transition group">
      <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-100 group-hover:text-brand-primary/10 transition-colors mb-3 sm:mb-4">{number}</div>
      <h3 className="text-base sm:text-lg md:text-xl font-bold text-brand-secondary mb-2 sm:mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed text-xs sm:text-sm">{desc}</p>
    </div>
  );
}

function PricingCard({ title, price, save, time, features, isPremium, activeCar }: any) {
  return (
    <div className={`bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-xl border transition-all duration-300 ${
      isPremium ? 'border-brand-primary ring-2 sm:ring-4 ring-brand-primary/5 transform scale-[1.02] sm:scale-105 z-10' : 'border-gray-100 hover:border-brand-primary/30'
    }`}>
      <div className="flex justify-between items-start mb-3 sm:mb-4 gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg md:text-xl font-bold text-brand-secondary">{title}</h3>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">for {activeCar}</p>
        </div>
        {save && <span className="bg-green-100 text-green-700 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md flex-shrink-0">{save}</span>}
      </div>
      
      <div className="mb-4 sm:mb-5 md:mb-6">
        <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-brand-primary">{price}</span>
      </div>
      
      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500 mb-4 sm:mb-5 md:mb-6 bg-gray-50 p-1.5 sm:p-2 rounded-lg">
        <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" /> <span>{time}</span>
      </div>
      
      <ul className="space-y-2 sm:space-y-2.5 md:space-y-3 mb-6 sm:mb-7 md:mb-8">
        {features.map((item: string, i: number) => (
          <li key={i} className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600">
            <div className="mt-0.5 bg-brand-primary/10 p-0.5 rounded-full flex-shrink-0">
              <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-brand-primary" />
            </div>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      
      <button
        onClick={() => {
          window.location.href = appendUtmToHref('/book-service');
        }}
        className={`w-full py-2.5 sm:py-2.5 md:py-3 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base transition ${
          isPremium ? 'bg-brand-primary text-white hover:bg-brand-primary-hover shadow-lg shadow-brand-primary/30' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
        }`}
      >
        Book Now
      </button>
    </div>
  );
}

function TimelineItem({ time, title, desc, status }: any) {
  const getIcon = () => {
    if (status === 'completed') return <CheckCircle className="w-4 h-4 text-white" />;
    if (status === 'active') return <Activity className="w-4 h-4 text-white" />;
    return <Clock className="w-4 h-4 text-gray-500" />;
  };
  
  const getBg = () => {
    if (status === 'completed') return 'bg-green-500';
    if (status === 'active') return 'bg-brand-fng animate-pulse';
    return 'bg-gray-700';
  };

  return (
    <div className="relative group">
      <div className={`absolute -left-[41px] top-1 w-8 h-8 rounded-full border-4 border-gray-900 flex items-center justify-center z-10 ${getBg()}`}>
        {getIcon()}
      </div>
      <div className={`mb-1 ${status === 'active' ? 'text-brand-fng font-bold' : 'text-gray-400 font-medium'} text-sm`}>{time}</div>
      <h4 className={`text-lg font-bold mb-1 ${status === 'pending' ? 'text-gray-500' : 'text-white'}`}>{title}</h4>
      <p className="text-sm text-gray-400 pb-8">{desc}</p>
    </div>
  );
}

function LiveUpdateCard({ title, status, desc, color }: any) {
  const statusColors = {
    green: 'text-green-400 border-green-500/30 bg-green-500/10',
    yellow: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    gray: 'text-gray-400 border-gray-500/30 bg-gray-500/10',
  };
  
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-white">{title}</h4>
        <span className={`text-xs px-2 py-0.5 rounded border ${statusColors[color as keyof typeof statusColors]}`}>
          {status}
        </span>
      </div>
      <p className="text-xs text-gray-400">{desc}</p>
    </div>
  );
}

function WorkshopCard({ name, location, rating, services, image }: any) {
  return (
    <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-md hover:shadow-xl transition group">
      <div className="h-36 sm:h-40 md:h-48 rounded-lg sm:rounded-xl overflow-hidden relative mb-3 sm:mb-4">
        <Image src={image} alt={name} fill className="object-cover group-hover:scale-105 transition duration-500" />
        <div className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-white/90 backdrop-blur px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-0.5 sm:gap-1">
          <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-600 flex-shrink-0" /> <span className="hidden sm:inline">AI Verified</span><span className="sm:hidden">AI</span>
        </div>
      </div>
      <div className="flex justify-between items-start mb-1.5 sm:mb-2 gap-2">
        <div className="min-w-0 flex-1">
           <h3 className="font-bold text-base sm:text-lg text-brand-secondary truncate">{name}</h3>
           <p className="text-xs sm:text-sm text-gray-500 truncate">{location}</p>
        </div>
        <div className="bg-green-50 text-green-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg font-bold text-xs sm:text-sm flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          {rating} <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
        </div>
      </div>
      <div className="text-[10px] sm:text-xs text-gray-400 mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-gray-100">
        {services} • Certified Partner
      </div>
    </div>
  );
}

function StatBox({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-brand-primary mb-1 sm:mb-2">{number}</div>
      <div className="text-gray-500 font-medium text-xs sm:text-sm">{label}</div>
    </div>
  );
}

function RSAService({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 bg-white/10 p-4 rounded-xl backdrop-blur-sm hover:bg-white/20 transition group">
      <div className="text-brand-fng bg-white/20 p-2 rounded-lg group-hover:bg-brand-fng group-hover:text-white transition">
        {icon}
      </div>
      <span className="font-semibold">{title}</span>
    </div>
  );
}

function ServiceOption({
  icon,
  title,
  desc,
  color,
  bg,
  active,
  onSelect,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  bg: string;
  active: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onSelect}
      className={`group text-left w-full rounded-2xl border transition-all duration-200 ${
        active
          ? 'border-blue-200 bg-blue-50/60 shadow-md shadow-blue-900/5'
          : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
      } ${compact ? 'p-3' : 'p-4 sm:p-5'}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`${compact ? 'w-10 h-10 rounded-xl' : 'w-11 h-11 rounded-2xl'} ${bg} ${color} flex items-center justify-center ring-1 ring-black/5 transition-transform ${
            active ? 'scale-105' : 'group-hover:scale-105'
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h4 className={`${compact ? 'text-sm' : ''} font-bold text-gray-900 leading-tight`}>{title}</h4>
            <ArrowRight
              className={`w-4 h-4 mt-0.5 flex-shrink-0 transition-transform ${
                active ? 'translate-x-0 text-blue-600' : 'text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5'
              }`}
            />
          </div>
          <p
            className={`mt-1 ${compact ? 'text-xs' : 'text-sm'} leading-relaxed ${
              active ? 'text-blue-700' : 'text-gray-500'
            } line-clamp-1`}
          >
            {desc}
          </p>
        </div>
      </div>
    </button>
  );
}

function ServiceCarouselCard({
  icon,
  title,
  desc,
  tag,
  color,
  bg,
  active,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tag: string;
  color: string;
  bg: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`snap-start shrink-0 w-[280px] sm:w-[320px] rounded-3xl border text-left transition-all duration-200 overflow-hidden ${
        active ? 'border-blue-200 shadow-lg shadow-blue-900/10' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
      } bg-white`}
    >
      <div className={`h-28 ${bg} relative`}>
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-white/30 rounded-full blur-2xl"></div>
        <div className="p-5 flex items-start justify-between">
          <div className={`w-12 h-12 rounded-2xl bg-white/80 ${color} flex items-center justify-center ring-1 ring-black/5`}>
            {icon}
          </div>
          <span className="text-xs font-bold text-gray-600 bg-white/80 px-2.5 py-1 rounded-full border border-white/60">
            {tag}
          </span>
        </div>
      </div>
      <div className="p-6">
        <h4 className="text-lg font-bold text-gray-900">{title}</h4>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-2">{desc}</p>
        <div className={`mt-4 inline-flex items-center gap-2 text-sm font-bold ${active ? 'text-blue-600' : 'text-gray-900'} transition-colors`}>
          Preview <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
}

function WhyChooseItem({ icon, title, desc, index }: { icon: React.ReactNode; title: string; desc: string; index: number }) {
  return (
    <div className="group relative p-6 rounded-3xl bg-white border border-gray-100 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 overflow-hidden">
      {/* Hover Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      {/* Decorative Corner Blob */}
      <div className="absolute -top-10 -right-10 w-20 h-20 bg-blue-100 rounded-full blur-2xl group-hover:bg-blue-200 transition-colors duration-500"></div>

      <div className="relative z-10">
        {/* Icon Header */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:bg-blue-600 group-hover:text-white">
            {icon}
          </div>
          <h3 className="font-bold text-lg sm:text-xl text-gray-900 group-hover:text-blue-700 transition-colors leading-tight">
            {title}
          </h3>
        </div>
        
        {/* Description */}
        <p className="text-sm text-gray-500 leading-relaxed group-hover:text-gray-700 transition-colors pl-1">
          {desc}
        </p>
      </div>

      {/* Bottom Bar Indicator */}
      <div className="absolute bottom-0 left-0 w-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 group-hover:w-full"></div>
    </div>
  );
}

function BlogCard({ 
  title, 
  excerpt, 
  readTime, 
  tag, 
  imageUrl,
  color, 
  icon,
  href,
}: { 
  title: string; 
  excerpt: string; 
  readTime: string; 
  tag: string; 
  imageUrl?: string;
  color: string; 
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link href={href} className="bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 group flex flex-col h-full border border-gray-100">
      {/* Header Area */}
      <div className={`h-48 ${imageUrl ? 'bg-gray-100' : color} flex items-center justify-center relative overflow-hidden`}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <>
            {/* Decorative Circles */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            
            {/* Icon */}
            <div className="relative z-10 w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white shadow-lg border border-white/30 group-hover:scale-110 transition-transform duration-500">
              {icon}
            </div>
          </>
        )}
      </div>

      <div className="p-8 flex flex-col flex-1">
        {/* Tag & Read Time */}
        <div className="flex items-center gap-4 mb-4">
          <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600 uppercase tracking-wider">
            {tag}
          </span>
          <span className="text-gray-400 text-xs font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" /> {readTime}
          </span>
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors leading-tight">
          {title}
        </h3>
        
        <p className="text-gray-500 text-sm leading-relaxed mb-6 flex-1 line-clamp-2">
          {excerpt}
        </p>

        <div className="flex items-center text-blue-600 font-bold text-sm group-hover:gap-2 transition-all">
          Read More <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      </div>
    </Link>
  );
}

function TestimonialCard({
  name,
  location,
  rating,
  text,
  vehicle,
  featured = false,
}: {
  name: string;
  location: string;
  rating: number;
  text: string;
  vehicle: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-white shadow-lg border border-gray-100 ${
        featured
          ? 'p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl'
          : 'p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl'
      }`}
    >
      {featured ? (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="absolute inset-0 border-2 border-blue-200/40 rounded-3xl" />
        </div>
      ) : null}

      <div className="relative z-10">
        <div className="flex items-center justify-between gap-4 mb-3 sm:mb-4">
          <div className="flex items-center gap-0.5 sm:gap-1">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 text-yellow-400 fill-yellow-400" />
        ))}
          </div>
          {featured ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              Featured
            </span>
          ) : null}
      </div>

        <Quote
          className={`text-brand-primary/20 mb-3 sm:mb-4 ${
            featured ? 'w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10' : 'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8'
          }`}
        />
        <p className={`text-gray-700 mb-4 sm:mb-5 md:mb-6 italic ${featured ? 'text-sm sm:text-base md:text-lg' : 'text-xs sm:text-sm md:text-base'}`}>
          {text}
        </p>
        <div className="border-t border-gray-100 pt-3 sm:pt-4">
          <p className={`font-bold text-gray-900 ${featured ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`}>{name}</p>
          <p className="text-xs sm:text-sm text-gray-500">
            {location} • {vehicle}
          </p>
        </div>
      </div>
    </div>
  );
}

function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-md border border-gray-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 sm:p-5 md:p-6 flex items-center justify-between text-left hover:bg-gray-50 transition gap-2 sm:gap-4"
      >
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
          <span
            className="font-bold text-sm sm:text-base text-gray-900 whitespace-normal leading-snug overflow-hidden min-h-[2.6em] max-w-none [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]"
          >
            {question}
          </span>
        </div>
        <ChevronRight className={`w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-4 sm:px-5 md:px-6 pb-4 sm:pb-5 md:pb-6 pt-0 border-t border-gray-100">
          <p className="text-gray-600 mt-3 sm:mt-4 text-xs sm:text-sm md:text-base">{answer}</p>
        </div>
      )}
    </div>
  );
}
