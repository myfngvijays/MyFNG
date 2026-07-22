import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Dimensions,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { ENV } from '../config/environment';
import { apiFetch } from '../lib/api';
import { trackEvent } from '../lib/trackEvent';
import { buildMobileAuthHeaders } from '../lib/serviceBooking';
import BotFace from '../components/BotFace';
import { MISA } from '../components/misa/misaTheme';
import { MisaPricingCards } from '../components/misa/MisaPricingCards';
import {
  MisaAddressPicker,
  MisaBookingSummaryPanel,
  MisaCarPicker,
  MisaCheckoutExtras,
  MisaDateTimePanel,
  MisaGuestOtpPanel,
  MisaNamePanel,
  MisaOtherServicesGrid,
  MisaPincodePanel,
  MisaProfileCarPicker,
  MisaServiceCategories,
  MisaVehicleNumberPanel,
} from '../components/misa/MisaChatPanels';
import {
  assistantAsksForAddress,
  assistantAsksForCar,
  assistantAsksForName,
  assistantAsksForPickupDate,
  assistantAsksForPickupTime,
  assistantAsksForPincode,
  assistantAsksForVehicleNumber,
  assistantMessageShowsServiceList,
  assistantNeedsMobileVerification,
  assistantShowsBookingSummary,
  parseBookingSummary,
} from '../lib/misa/misaDetectors';
import {
  buildPricingPlansFromApi,
  extractPricingTitle,
  parsePricingPlansFromText,
  resolveMessagePricingPlans,
  type MisaPricingPlan,
} from '../lib/misa/misaPricing';
import {
  loadMisaCustomerContext,
  syncTrustedCustomerSession,
  type MisaCustomerContext,
} from '../lib/misa/misaCustomerContext';

const stripEmojis = (text: string) =>
  text
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{2700}-\u{27BF}\u{2B50}\u{2B55}\u{231A}-\u{23F3}\u{23E9}-\u{23EF}\u{25AA}-\u{25FE}\u{2934}-\u{2935}\u{3030}\u{303D}\u{3297}\u{3299}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

type Props = { navigation: any; route: any };
type ChatRole = 'assistant' | 'user';

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
        phone?: string;
        address?: string;
        rating?: number | null;
        usp?: string | null;
      }>;
    };

type ChatMsg = {
  id: string;
  role: ChatRole;
  text: string;
  ui?: UiPayload;
  pricingPlans?: MisaPricingPlan[];
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function navigateToMembership(navigation: any, isLoggedIn: boolean) {
  if (isLoggedIn) {
    navigation.navigate('Dashboard', { screen: 'CustomerMembership' });
    return;
  }
  navigation.navigate('Settings', { subPage: 'Membership' });
}

export default function AIBookingScreen({ navigation, route }: Props) {
  const city: string | undefined = route?.params?.city;
  const prefill: string | undefined = route?.params?.prefill;
  const fullScreen: boolean = route?.params?.fullScreen === true;

  const initial = useMemo<ChatMsg[]>(
    () => [
      {
        id: uid(),
        role: 'assistant',
        text: `Hi! I'm MISA — your MyFNG AI assistant.\nTell me what you need — periodic service, repair, AC, battery, or nearest workshop.\nI'll guide you step-by-step and book in chat.`,
      },
      ...(prefill ? [{ id: uid(), role: 'user' as const, text: prefill }] : []),
    ],
    [prefill],
  );

  const [messages, setMessages] = useState<ChatMsg[]>(initial);
  const [draft, setDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [customerCtx, setCustomerCtx] = useState<MisaCustomerContext>({
    isLoggedIn: false,
    vehicles: [],
    addresses: [],
    walletBalance: 0,
    hasActiveMembership: false,
  });
  const [chatContext, setChatContext] = useState<any>({
    preferredLanguage: 'auto',
    locationLabel: city || undefined,
    locationConfirmed: Boolean(city),
  });
  const [showOtherServices, setShowOtherServices] = useState(false);
  const [forceFreeTextCar, setForceFreeTextCar] = useState(false);
  const [forceNewAddress, setForceNewAddress] = useState(false);
  const [dismissedPricingIds, setDismissedPricingIds] = useState<Set<string>>(() => new Set());
  const [dismissedSummaryIds, setDismissedSummaryIds] = useState<Set<string>>(() => new Set());
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMeta, setCouponMeta] = useState<any>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [includeMembership, setIncludeMembership] = useState(false);
  const [selectedPlanPrice, setSelectedPlanPrice] = useState<number | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [chatConnected, setChatConnected] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const autoHandledRef = useRef<Set<string>>(new Set());
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'assistant') return messages[i];
    }
    return null;
  }, [messages]);

  const latestSummaryId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m?.role === 'assistant' && assistantShowsBookingSummary(m.text)) return m.id;
    }
    return null;
  }, [messages]);

  const showCategoryPicker =
    !chatLoading &&
    !showOtherServices &&
    (messages.length <= 1 || Boolean(lastAssistant && assistantMessageShowsServiceList(lastAssistant.text)));

  const showGuestOtp =
    !chatLoading &&
    !customerCtx.isLoggedIn &&
    !chatContext?.phoneVerified &&
    !chatContext?.skipMobilePrompt &&
    !chatContext?.pricingEligible &&
    Boolean(chatContext?.conversationId) &&
    Boolean(lastAssistant && assistantNeedsMobileVerification(lastAssistant.text));

  const assistantWantsLocation =
    lastAssistant?.role === 'assistant' &&
    (assistantAsksForPincode(lastAssistant.text) || assistantAsksForAddress(lastAssistant.text));

  const showAddressPicker =
    profileLoaded &&
    !chatLoading &&
    !forceNewAddress &&
    customerCtx.isLoggedIn &&
    customerCtx.addresses.length > 0 &&
    assistantWantsLocation;

  const showPincodePanel =
    profileLoaded &&
    !chatLoading &&
    lastAssistant?.role === 'assistant' &&
    assistantAsksForPincode(lastAssistant.text) &&
    !(customerCtx.isLoggedIn && customerCtx.addresses.length > 0 && !forceNewAddress);

  const showProfileCarPicker =
    !chatLoading &&
    !forceFreeTextCar &&
    customerCtx.isLoggedIn &&
    customerCtx.vehicles.length > 0 &&
    lastAssistant?.role === 'assistant' &&
    assistantAsksForCar(lastAssistant.text);

  const showGuestCarPicker =
    !chatLoading &&
    !showOtherServices &&
    lastAssistant?.role === 'assistant' &&
    assistantAsksForCar(lastAssistant.text) &&
    !showProfileCarPicker;

  const estimatedTotal = useMemo(() => {
    const base = selectedPlanPrice || 0;
    let total = base;
    if (includeMembership && !customerCtx.hasActiveMembership) total += 999;
    total -= couponDiscount || 0;
    if (useWallet && customerCtx.walletBalance > 0) total = Math.max(0, total - customerCtx.walletBalance);
    return total > 0 ? total : base || undefined;
  }, [selectedPlanPrice, includeMembership, customerCtx, couponDiscount, useWallet]);

  useEffect(() => {
    trackEvent('misa_opened');
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      setKeyboardVisible(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    void (async () => {
      const ctx = await loadMisaCustomerContext();
      setCustomerCtx(ctx);
      if (ctx.isLoggedIn) {
        setChatContext((prev: any) => ({
          ...prev,
          customerName: ctx.name,
          customerPhone: ctx.phone,
          customerVehicles: ctx.vehicles,
          customerAddresses: ctx.addresses,
          isLoggedInCustomer: true,
          skipNamePrompt: Boolean(ctx.name),
          skipMobilePrompt: true,
          phoneVerified: Boolean(ctx.phone),
          pricingEligible: Boolean(ctx.phone),
        }));
        const sessionId = String(chatContext?.conversationId || '').trim();
        if (sessionId) {
          const trusted = await syncTrustedCustomerSession(sessionId);
          if (trusted) {
            setChatContext((prev: any) => ({ ...(prev || {}), ...(trusted || {}) }));
          }
        }
      }
      setProfileLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profileLoaded || chatLoading || !lastAssistant || lastAssistant.role !== 'assistant') return;
    if (autoHandledRef.current.has(lastAssistant.id)) return;

    const text = lastAssistant.text;
    let autoMessage: string | null = null;
    let autoLabel: string | null = null;

    if (customerCtx.isLoggedIn && customerCtx.name && assistantAsksForName(text)) {
      autoMessage = customerCtx.name;
      autoLabel = customerCtx.name;
    } else if (
      customerCtx.isLoggedIn &&
      customerCtx.phone &&
      (chatContext?.skipMobilePrompt || chatContext?.phoneVerified) &&
      assistantNeedsMobileVerification(text) &&
      !/(otp|verify|verification code|whatsapp otp)/i.test(text)
    ) {
      autoMessage = `My registered mobile number is ${customerCtx.phone}. I am logged in on the app — no OTP needed.`;
      autoLabel = `+91 ${customerCtx.phone}`;
    } else if (
      customerCtx.isLoggedIn &&
      customerCtx.addresses.length > 0 &&
      !forceNewAddress &&
      assistantWantsLocation &&
      assistantAsksForAddress(text)
    ) {
      const addr = customerCtx.addresses.find((a) => a.pincode) || customerCtx.addresses[0];
      const parts = [addr.line1, addr.line2, addr.city, addr.pincode].filter(Boolean);
      autoMessage = `Use my saved address: ${parts.join(', ')}`;
      autoLabel = addr.label || 'Saved address';
    }

    if (!autoMessage) return;
    autoHandledRef.current.add(lastAssistant.id);
    push({ id: uid(), role: 'user', text: autoLabel || autoMessage });
    void sendChatMessage(autoMessage, autoLabel || autoMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAssistant, customerCtx, chatLoading, profileLoaded, chatContext?.skipMobilePrompt, chatContext?.phoneVerified, forceNewAddress, assistantWantsLocation]);

  useEffect(() => {
    if (prefill) void sendChatMessage(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const push = (msg: ChatMsg) => {
    setMessages((m) => [...m, msg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  function buildCheckoutHint(): string {
    const parts: string[] = [];
    if (couponMeta?.code) parts.push(`Apply coupon ${couponMeta.code}`);
    if (useWallet && customerCtx.walletBalance > 0) parts.push('Use my wallet balance');
    if (includeMembership && !customerCtx.hasActiveMembership) parts.push('Add Prime membership with this booking');
    return parts.length ? ` ${parts.join('. ')}.` : '';
  }

  async function sendChatMessage(rawText: string, displayText?: string) {
    if (chatLoading) return;
    let text = (rawText || '').trim();
    const shown = (displayText || rawText || '').trim();
    if (!text) return;

    if (/change service|different service|service badlo/i.test(text)) {
      setDismissedPricingIds((prev) => {
        const next = new Set(prev);
        messages.forEach((msg) => {
          if (msg.role === 'assistant' && (msg.pricingPlans?.length || parsePricingPlansFromText(msg.text).length)) {
            next.add(msg.id);
          }
        });
        return next;
      });
    }

    setShowOtherServices(false);
    setForceFreeTextCar(false);
    setForceNewAddress(false);
    setChatLoading(true);

    try {
      const headers = await buildMobileAuthHeaders();
      const sessionId = String(chatContext?.conversationId || '').trim() || undefined;
      const payload = {
        message: text,
        session_id: sessionId,
        context: {
          ...chatContext,
          locationLabel: chatContext?.locationLabel || city || undefined,
          customerName: customerCtx.name || chatContext?.customerName,
          customerPhone: customerCtx.phone || chatContext?.customerPhone,
          customerAddresses: customerCtx.addresses,
          savedAddressPincode: customerCtx.addresses?.[0]?.pincode || chatContext?.savedAddressPincode,
          isLoggedInCustomer: customerCtx.isLoggedIn,
          skipNamePrompt: customerCtx.isLoggedIn && Boolean(customerCtx.name),
          skipMobilePrompt: customerCtx.isLoggedIn,
          couponCode: couponMeta?.code || undefined,
          useWallet: useWallet || undefined,
          includeMembership: includeMembership || undefined,
        },
      };

      const res = await fetch(`${ENV.API_URL}/api/chatbot/v2`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const raw = await res.text().catch(() => '');
      const data: any = (() => {
        try {
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })();

      if (!res.ok) {
        push({
          id: uid(),
          role: 'assistant',
          text: `Sorry, kuch issue aa gaya.\nAPI error: ${res.status}\nPlease try again.`,
        });
        return;
      }

      const assistantText =
        (typeof data?.assistantMessage === 'string' && data.assistantMessage.trim()) ||
        (typeof data?.response === 'string' && data.response.trim()) ||
        (typeof data?.message === 'string' && data.message.trim()) ||
        'Sorry, kuch issue aa gaya. Please try again.';

      const apiPricing = Array.isArray(data?.pricing) ? data.pricing : [];
      const pricingPlans = apiPricing.length ? buildPricingPlansFromApi(apiPricing) : undefined;

      const ui: UiPayload | undefined = parseUiPayload(data);

      push({ id: uid(), role: 'assistant', text: assistantText, ui, pricingPlans });
      trackEvent('misa_message_received');
      setChatConnected(true);

      const ctxPatch = data?.contextPatch || data?.data?.contextPatch || null;
      const conversationId = String(ctxPatch?.conversationId || data?.conversationId || sessionId || '').trim();

      if (conversationId) {
        if (customerCtx.isLoggedIn && !ctxPatch?.phoneVerified) {
          const trusted = await syncTrustedCustomerSession(conversationId);
          if (trusted) {
            setChatContext((prev: any) => ({ ...(prev || {}), ...(trusted || {}), conversationId }));
          } else if (ctxPatch) {
            setChatContext((prev: any) => ({ ...(prev || {}), ...(ctxPatch || {}), conversationId }));
          } else {
            setChatContext((prev: any) => ({ ...(prev || {}), conversationId }));
          }
        } else if (ctxPatch) {
          setChatContext((prev: any) => ({ ...(prev || {}), ...(ctxPatch || {}), conversationId }));
        } else {
          setChatContext((prev: any) => ({ ...(prev || {}), conversationId }));
        }
      } else if (ctxPatch) {
        setChatContext((prev: any) => ({ ...(prev || {}), ...(ctxPatch || {}) }));
      }
    } catch {
      trackEvent('misa_chat_error');
      push({ id: uid(), role: 'assistant', text: 'Network issue. Please try again.' });
    } finally {
      setChatLoading(false);
    }
  }

  function parseUiPayload(data: any): UiPayload | undefined {
    const u = data?.ui || data?.data?.ui;
    if (!u || typeof u !== 'object') return undefined;
    if (u.kind === 'CATEGORY_CAROUSEL' && Array.isArray(u.items)) {
      return {
        kind: 'CATEGORY_CAROUSEL',
        title: typeof u.title === 'string' ? u.title : undefined,
        items: u.items
          .map((it: any) => ({
            id: String(it?.id || ''),
            label: String(it?.label || '').trim(),
            subtitle: typeof it?.subtitle === 'string' ? it.subtitle : undefined,
          }))
          .filter((it: any) => it.id && it.label),
      };
    }
    if (u.kind === 'DUAL_CAROUSEL' && Array.isArray(u.packages) && Array.isArray(u.services)) {
      const mapOpt = (o: any, optionNumber?: number): UiSuggestion | null => {
        const s = o?.suggestion;
        const kind = String(s?.kind || '').toUpperCase();
        const id = String(s?.id || '');
        const name = String(s?.name || '').trim();
        if (!id || !name || !kind) return null;
        return {
          optionNumber,
          kind: kind as UiSuggestion['kind'],
          id,
          name,
          exactPrice:
            typeof o?.exactPrice === 'number'
              ? o.exactPrice
              : typeof o?.exactPrice?.amount === 'number'
                ? o.exactPrice.amount
                : null,
          checklistItems: Array.isArray(o?.checklistItems) ? o.checklistItems.map((x: any) => String(x)) : undefined,
          checklistNote: typeof o?.checklistNote === 'string' ? o.checklistNote : null,
        };
      };
      return {
        kind: 'DUAL_CAROUSEL',
        title: typeof u.title === 'string' ? u.title : undefined,
        category: String(u.category || ''),
        packages: (u.packages || []).map((x: any, idx: number) => mapOpt(x, idx + 1)).filter(Boolean) as UiSuggestion[],
        services: (u.services || []).map((x: any, idx: number) => mapOpt(x, idx + 1)).filter(Boolean) as UiSuggestion[],
      };
    }
    if (u.kind === 'WORKSHOP_CAROUSEL' && Array.isArray(u.items)) {
      return {
        kind: 'WORKSHOP_CAROUSEL',
        title: typeof u.title === 'string' ? u.title : undefined,
        items: u.items
          .map((it: any) => ({
            id: String(it?.id || ''),
            name: String(it?.name || '').trim(),
            subtitle: typeof it?.subtitle === 'string' ? it.subtitle : undefined,
            address: typeof it?.address === 'string' ? it.address : undefined,
            phone: typeof it?.phone === 'string' ? it.phone : undefined,
            km: typeof it?.km === 'number' ? it.km : null,
            imageUrl: typeof it?.imageUrl === 'string' ? it.imageUrl : null,
            mapLink: typeof it?.mapLink === 'string' ? it.mapLink : typeof it?.map_link === 'string' ? it.map_link : null,
            rating: typeof it?.rating === 'number' ? it.rating : null,
            usp: typeof it?.usp === 'string' ? it.usp : null,
          }))
          .filter((it: any) => it.id && it.name),
      };
    }
    if (Array.isArray(data?.workshops) && data.workshops.length > 0) {
      return {
        kind: 'WORKSHOP_CAROUSEL',
        title: 'Nearest workshops',
        items: data.workshops
          .map((it: any, index: number) => ({
            id: String(it?.id || `workshop-${index}`),
            name: String(it?.name || '').trim(),
            subtitle: typeof it?.address === 'string' ? it.address : undefined,
            address: typeof it?.address === 'string' ? it.address : undefined,
            phone: typeof it?.phone === 'string' ? it.phone : '9152307030',
            mapLink: typeof it?.map_link === 'string' ? it.map_link : null,
          }))
          .filter((it: any) => it.id && it.name),
      };
    }
    return undefined;
  }

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setCouponApplying(true);
    setCouponError(null);
    try {
      const subtotal = selectedPlanPrice || 1000;
      const json = await apiFetch<any>('/api/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({
          code,
          lead_context: {
            subtotal,
            customer_phone: customerCtx.phone,
            customer_id: customerCtx.customerId,
            channel: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
          },
        }),
      });
      if (!json?.valid) throw new Error(json?.error || 'Invalid coupon');
      setCouponDiscount(Number(json.discount_amount || 0));
      setCouponMeta(json.coupon || { code });
    } catch (e: any) {
      setCouponDiscount(0);
      setCouponMeta(null);
      setCouponError(e?.message || 'Coupon failed');
    } finally {
      setCouponApplying(false);
    }
  }

  const onSend = () => {
    const text = draft.trim();
    if (!text) return;
    trackEvent('misa_message_sent');
    setDraft('');
    push({ id: uid(), role: 'user', text });
    void sendChatMessage(text);
  };

  const submitFromPanel = (raw: string, label?: string) => {
    push({ id: uid(), role: 'user', text: label || raw });
    void sendChatMessage(raw, label || raw);
  };

  return (
    <View style={[fullScreen ? styles.fullRoot : styles.drawerRoot, styles.darkRoot]}>
      {!fullScreen && (
        <TouchableOpacity style={styles.drawerBackdrop} activeOpacity={1} onPress={() => navigation.goBack()} />
      )}
      <View style={styles.bgOrbTop} pointerEvents="none" />
      <View style={styles.bgOrbRight} pointerEvents="none" />
      <SafeAreaView style={fullScreen ? styles.fullSheet : styles.drawerSheet} edges={fullScreen ? ['top', 'bottom'] : ['bottom']}>
        {!fullScreen && <View style={styles.drawerHandle} />}
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? (fullScreen ? 50 : Math.round(Dimensions.get('window').height * 0.2)) : 0}
        >
          <View style={styles.webHeader}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
              <Ionicons name="arrow-back" size={18} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerBotAvatar}>
              <BotFace size={36} scale={0.55} surface="blue" />
            </View>
            <View style={styles.headerTextWrap}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerTitle}>MISA AI</Text>
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={10} color={MISA.cyan} />
                  <Text style={styles.aiBadgeText}>AI ASSISTANT</Text>
                </View>
              </View>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, chatConnected ? styles.statusDotOnline : styles.statusDotConnecting]} />
                <Text style={styles.headerSub}>
                  {chatConnected ? 'Online · ready to help' : 'Connecting…'}
                  {city ? ` · ${city}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.homeLink}>
              <Text style={styles.homeLinkText}>Home</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.tagline}>
            <Text style={styles.taglineAccent}>Instant AI booking</Text>
            {' · Smart quotes · Verified workshops'}
          </Text>

          <View style={styles.chatCard}>
          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chat}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {messages.map((m, msgIndex) => {
              const isUser = m.role === 'user';
              const isFirstAssistant = !isUser && msgIndex === 0;
              const pricingPlans = !isUser ? resolveMessagePricingPlans(m.pricingPlans, m.text) : [];
              const userRepliedAfter = messages.slice(msgIndex + 1).some((x) => x.role === 'user');
              const isActivePricing =
                pricingPlans.length >= 1 && !userRepliedAfter && !dismissedPricingIds.has(m.id);
              const summary = !isUser ? parseBookingSummary(m.text) : null;
              const isActiveSummary =
                Boolean(summary) && m.id === latestSummaryId && !dismissedSummaryIds.has(m.id);
              const displayText =
                isActivePricing || (pricingPlans.length >= 1 && userRepliedAfter)
                  ? extractPricingTitle(m.text)
                  : isActiveSummary
                    ? 'Please review your booking details below'
                    : m.text;

              return (
                <View key={m.id} style={styles.msgBlock}>
                  <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>
                    {!isUser ? (
                      <View style={styles.msgAvatarSmall}>
                        <BotFace size={isFirstAssistant ? 32 : 28} scale={0.5} surface="blue" />
                      </View>
                    ) : null}
                    <View style={[styles.msgContent, isUser ? styles.msgContentUser : null]}>
                      {!isUser ? (
                        <View style={styles.botLabelRow}>
                          <Ionicons name="sparkles" size={12} color={MISA.cyan} />
                          <Text style={styles.botLabel}>MISA</Text>
                        </View>
                      ) : null}
                      <View
                        style={[
                          styles.bubble,
                          isUser ? styles.bubbleUser : isFirstAssistant ? styles.bubbleBotFirst : styles.bubbleBot,
                        ]}
                      >
                        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : null]}>{displayText}</Text>
                      </View>
                    </View>
                  </View>

                  {!isUser && isActivePricing && (
                    <MisaPricingCards
                      plans={pricingPlans}
                      title={extractPricingTitle(m.text)}
                      onSelect={(plan) => {
                        setSelectedPlanPrice(plan.price);
                        setDismissedPricingIds((prev) => new Set(prev).add(m.id));
                        submitFromPanel(
                          `I want to book ${plan.name} at ₹${plan.price}${buildCheckoutHint()}`,
                          `${plan.tier} · ₹${plan.price.toLocaleString('en-IN')}`,
                        );
                      }}
                    />
                  )}

                  {!isUser && isActiveSummary && summary && (
                    <>
                      <MisaCheckoutExtras
                        walletBalance={customerCtx.walletBalance}
                        hasActiveMembership={customerCtx.hasActiveMembership}
                        membershipPlanName={customerCtx.membershipPlanName}
                        couponCode={couponCode}
                        couponDiscount={couponDiscount}
                        couponError={couponError}
                        couponApplying={couponApplying}
                        useWallet={useWallet}
                        includeMembership={includeMembership}
                        onCouponChange={setCouponCode}
                        onApplyCoupon={() => void applyCoupon()}
                        onToggleWallet={() => setUseWallet((v) => !v)}
                        onToggleMembership={() => setIncludeMembership((v) => !v)}
                        onNavigateToMembership={() => navigateToMembership(navigation, customerCtx.isLoggedIn)}
                        estimatedTotal={estimatedTotal}
                      />
                      <MisaBookingSummaryPanel
                        summary={summary}
                        onConfirm={() => {
                          setDismissedSummaryIds((prev) => new Set(prev).add(m.id));
                          submitFromPanel(`Yes, confirm booking${buildCheckoutHint()}`, 'Yes, confirm booking');
                        }}
                        onReject={() => {
                          setDismissedSummaryIds((prev) => new Set(prev).add(m.id));
                          submitFromPanel('No, I need to edit', 'No, edit details');
                        }}
                      />
                    </>
                  )}

                  {!isUser && m.ui?.kind === 'WORKSHOP_CAROUSEL' ? (
                    <View style={styles.workshopPanel}>
                      {m.ui.title ? <Text style={styles.workshopPanelTitle}>{m.ui.title}</Text> : null}
                      <View style={styles.workshopGrid}>
                        {m.ui.items.map((w) => (
                          <View key={w.id} style={styles.workshopCard}>
                            <Text style={styles.workshopName} numberOfLines={2}>
                              {stripEmojis(w.name)}
                            </Text>
                            {(w.address || w.subtitle) ? (
                              <Text style={styles.workshopSub} numberOfLines={3}>
                                {stripEmojis(w.address || w.subtitle || '')}
                              </Text>
                            ) : null}
                            <View style={styles.workshopBtnCol}>
                              {w.mapLink ? (
                                <TouchableOpacity
                                  style={styles.workshopBtnDirections}
                                  onPress={() => Linking.openURL(w.mapLink as string).catch(() => null)}
                                >
                                  <Text style={styles.workshopBtnDirectionsText}>Directions</Text>
                                </TouchableOpacity>
                              ) : null}
                              <TouchableOpacity
                                style={styles.workshopBtnCall}
                                onPress={() =>
                                  Linking.openURL(`tel:+91${String(w.phone || '9152307030').replace(/\D/g, '').slice(-10)}`).catch(() => null)
                                }
                              >
                                <Text style={styles.workshopBtnCallText}>Call Now</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.workshopBtnBook}
                                onPress={() =>
                                  submitFromPanel(`I want to book car service at ${w.name}`, `Book at ${w.name}`)
                                }
                              >
                                <Text style={styles.workshopBtnBookText}>Book Now</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}

            {showCategoryPicker && (
              <MisaServiceCategories
                onPrime={() => navigateToMembership(navigation, customerCtx.isLoggedIn)}
                onPeriodic={() => submitFromPanel('Car Periodic Service', 'Periodic Service')}
                onOther={() => setShowOtherServices(true)}
              />
            )}

            {showOtherServices && (
              <MisaOtherServicesGrid
                onSelect={(message, label) => submitFromPanel(message, label)}
                onBack={() => setShowOtherServices(false)}
              />
            )}

            {showGuestCarPicker && (
              <MisaCarPicker onSelect={(message, label) => submitFromPanel(message, label)} />
            )}

            {showProfileCarPicker && (
              <MisaProfileCarPicker
                vehicles={customerCtx.vehicles}
                onSelect={(message, label) => submitFromPanel(message, label)}
                onDifferentCar={() => setForceFreeTextCar(true)}
              />
            )}

            {showAddressPicker && (
              <MisaAddressPicker
                addresses={customerCtx.addresses}
                onSelect={(message, label) => submitFromPanel(message, label)}
                onAddNew={() => setForceNewAddress(true)}
              />
            )}

            {showGuestOtp && (
              <MisaGuestOtpPanel
                sessionId={chatContext?.conversationId}
                onVerified={({ phone, contextPatch, isReturningCustomer }) => {
                  setChatContext((prev: any) => ({
                    ...(prev || {}),
                    ...(contextPatch || {}),
                    customerPhone: phone,
                    phoneVerified: true,
                    pricingEligible: true,
                  }));
                  if (isReturningCustomer) {
                    void loadMisaCustomerContext().then(setCustomerCtx);
                  }
                  submitFromPanel(
                    `My mobile ${phone} is OTP verified. Please show service pricing now.`,
                    'Verified ✓',
                  );
                }}
              />
            )}

            {lastAssistant?.role === 'assistant' && assistantAsksForVehicleNumber(lastAssistant.text) && (
              <MisaVehicleNumberPanel
                sessionId={chatContext?.conversationId}
                savedVehicles={customerCtx.vehicles}
                onSubmit={(plate) => submitFromPanel(`My vehicle number is ${plate}`, plate)}
              />
            )}

            {showPincodePanel && <MisaPincodePanel onSubmit={(pin) => submitFromPanel(pin, pin)} />}

            {forceNewAddress && assistantWantsLocation && (
              <MisaPincodePanel
                onSubmit={(pin) => {
                  setForceNewAddress(false);
                  submitFromPanel(`My new address pincode is ${pin}. I will share full address in chat.`, pin);
                }}
              />
            )}

            {lastAssistant?.role === 'assistant' &&
              assistantAsksForName(lastAssistant.text) &&
              !(customerCtx.isLoggedIn && customerCtx.name) &&
              !chatContext?.skipNamePrompt && (
                <MisaNamePanel onSubmit={(name) => submitFromPanel(name, name)} />
              )}

            {lastAssistant?.role === 'assistant' &&
              assistantAsksForPickupDate(lastAssistant.text) &&
              !assistantAsksForVehicleNumber(lastAssistant.text) && (
              <MisaDateTimePanel
                mode="date"
                preferredDate={chatContext?.pickupDate}
                onSubmit={(label, isoDate) => {
                  setChatContext((prev: any) => ({ ...(prev || {}), pickupDate: isoDate || label }));
                  submitFromPanel(label, label);
                }}
              />
            )}

            {lastAssistant?.role === 'assistant' &&
              assistantAsksForPickupTime(lastAssistant.text) &&
              !assistantAsksForVehicleNumber(lastAssistant.text) && (
              <MisaDateTimePanel mode="time" preferredDate={chatContext?.pickupDate} onSubmit={(label) => submitFromPanel(label, label)} />
            )}

            {chatLoading ? (
              <View style={styles.typingRow}>
                <View style={styles.typingDot} />
                <View style={styles.typingDot} />
                <View style={styles.typingDot} />
              </View>
            ) : null}
          </ScrollView>

          {keyboardVisible && messages.length <= 3 && !draft.trim() && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickChipsRow} keyboardShouldPersistTaps="always">
              {[
                { label: 'Periodic', msg: 'Car Periodic Service' },
                { label: 'AC Service', msg: 'Car AC Service chahiye' },
                { label: 'Battery', msg: 'Car Battery Service chahiye' },
                { label: 'Workshop', msg: 'Show me workshops near me' },
              ].map((q) => (
                <TouchableOpacity
                  key={q.label}
                  style={styles.quickChip}
                  activeOpacity={0.8}
                  onPress={() => {
                    Keyboard.dismiss();
                    submitFromPanel(q.msg, q.label);
                  }}
                >
                  <Text style={styles.quickChipText}>{q.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.composerWrap}>
            <View style={styles.composer}>
              <View style={styles.composerBotIcon}>
                <BotFace size={24} scale={0.45} surface="white" />
              </View>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Ask MISA about service, price, booking…"
                placeholderTextColor="rgba(255,255,255,0.75)"
                style={styles.input}
                returnKeyType="send"
                onSubmitEditing={onSend}
              />
              <TouchableOpacity
                style={[styles.sendBtn, draft.trim().length === 0 ? styles.sendBtnDisabled : null]}
                onPress={onSend}
                disabled={draft.trim().length === 0}
                activeOpacity={0.9}
              >
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.composerFooter}>✨ Powered by MyFNG AI · Instant quotes · Book in chat</Text>
          </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  darkRoot: { backgroundColor: MISA.bgTop },
  bgOrbTop: {
    position: 'absolute',
    top: -80,
    left: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(0,136,232,0.18)',
  },
  bgOrbRight: {
    position: 'absolute',
    top: '20%',
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(34,211,238,0.1)',
  },
  safe: { flex: 1 },
  fullRoot: { flex: 1, backgroundColor: MISA.bgTop },
  fullSheet: { flex: 1, backgroundColor: 'transparent' },
  drawerRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  drawerBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  drawerSheet: {
    height: Dimensions.get('window').height * 0.8,
    backgroundColor: MISA.bgTop,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  drawerHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginTop: 8,
    marginBottom: 4,
  },
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: MISA.headerBg,
  },
  headerBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBotAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  headerTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 14, fontWeight: '900', color: '#fff' },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.3)',
    backgroundColor: 'rgba(34,211,238,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  aiBadgeText: { fontSize: 9, fontWeight: '800', color: MISA.cyan, letterSpacing: 0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotOnline: { backgroundColor: MISA.online },
  statusDotConnecting: { backgroundColor: MISA.connecting },
  headerSub: { fontSize: 11, fontWeight: '600', color: '#CBD5E1' },
  homeLink: { paddingHorizontal: 4, paddingVertical: 6 },
  homeLinkText: { fontSize: 12, fontWeight: '600', color: '#CBD5E1' },
  tagline: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: MISA.tagline,
    paddingHorizontal: SPACING.md,
    paddingTop: 10,
    paddingBottom: 6,
  },
  taglineAccent: { color: '#E2E8F0', fontWeight: '800' },
  chatCard: {
    flex: 1,
    marginHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: MISA.cardBorder,
    backgroundColor: MISA.cardBg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  chatScroll: { flex: 1, backgroundColor: MISA.chatInnerTop },
  uiTitle: { fontSize: FONT_SIZES.xs, fontWeight: '900', color: COLORS.gray[600], marginLeft: 4 },
  workshopPanel: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(14,116,144,0.12)',
    backgroundColor: '#F8FAFC',
    padding: 10,
  },
  workshopPanelTitle: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.primary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  workshopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  workshopCard: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '46%',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
  },
  workshopName: { fontSize: FONT_SIZES.sm, fontWeight: '900', color: COLORS.primaryDark },
  workshopSub: { marginTop: 4, fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.gray[600] },
  workshopBtnCol: { marginTop: 10, gap: 6 },
  workshopBtnRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  workshopBtnDirections: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignItems: 'center',
  },
  workshopBtnDirectionsText: { fontSize: 10, fontWeight: '800', color: '#0369A1' },
  workshopBtnCall: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
  },
  workshopBtnCallText: { fontSize: 10, fontWeight: '800', color: '#047857' },
  workshopBtnBook: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  workshopBtnBookText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  primaryBtn: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-start',
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  chat: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.md },
  msgBlock: { marginBottom: 14 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowBot: { alignItems: 'flex-start' },
  msgAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  msgContent: { flex: 1, maxWidth: '88%' },
  msgContentUser: { alignItems: 'flex-end', maxWidth: '82%' },
  botLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4, marginLeft: 2 },
  botLabel: { fontSize: 11, fontWeight: '800', color: MISA.botLabel, letterSpacing: 0.3 },
  bubble: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16 },
  bubbleBot: {
    backgroundColor: MISA.bubbleBotBg,
    borderWidth: 1,
    borderColor: MISA.bubbleBotBorder,
    borderTopLeftRadius: 6,
  },
  bubbleBotFirst: {
    backgroundColor: MISA.bubbleFirstBg,
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.2)',
    borderTopLeftRadius: 6,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bubbleUser: {
    backgroundColor: COLORS.secondary,
    borderTopRightRadius: 6,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bubbleText: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: '#111827', lineHeight: 20 },
  bubbleTextUser: { color: '#fff' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginLeft: 6 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9CA3AF' },
  quickChipsRow: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quickChipText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  composerWrap: {
    paddingHorizontal: SPACING.sm,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#fff',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: MISA.composerBg,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
  },
  composerBotIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingVertical: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MISA.composerBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  composerFooter: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    color: MISA.footerText,
  },
});
