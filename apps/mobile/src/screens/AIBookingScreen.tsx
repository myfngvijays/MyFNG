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
        text: `Hi! I'm MISA AI — MyFNG Instant Service Assistant.\nTell me what you need — periodic service, repair, AC, battery, or nearest workshop.`,
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
    <View style={[fullScreen ? styles.fullRoot : styles.drawerRoot, styles.opaqueRoot]}>
      {!fullScreen && (
        <TouchableOpacity style={styles.drawerBackdrop} activeOpacity={1} onPress={() => navigation.goBack()} />
      )}
      <SafeAreaView style={fullScreen ? styles.fullSheet : styles.drawerSheet} edges={fullScreen ? ['top', 'bottom'] : ['bottom']}>
        {!fullScreen && <View style={styles.drawerHandle} />}
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? (fullScreen ? 50 : Math.round(Dimensions.get('window').height * 0.2)) : 0}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
            <View style={styles.botAvatar}>
              <BotFace size={40} scale={0.58} surface="blue" />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>MISA AI</Text>
              <Text style={styles.headerSub}>
                {customerCtx.isLoggedIn
                  ? `Hi ${customerCtx.name?.split(' ')[0] || 'there'} · App booking`
                  : city
                    ? `City: ${city}`
                    : 'Instant AI booking'}
              </Text>
            </View>
            {customerCtx.isLoggedIn ? (
              <View style={styles.loggedInBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text style={styles.loggedInText}>Logged in</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginBtn}>
                <Text style={styles.loginBtnText}>Login</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.chat}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {messages.map((m, msgIndex) => {
              const isUser = m.role === 'user';
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
                <View key={m.id}>
                  <View style={[styles.msgRow, isUser ? styles.msgRowUser : null]}>
                    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
                      <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : null]}>{displayText}</Text>
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
                    <View style={{ marginTop: 8 }}>
                      {m.ui.title ? <Text style={styles.uiTitle}>{m.ui.title}</Text> : null}
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6, gap: 12 }}>
                        {m.ui.items.map((w) => (
                          <View key={w.id} style={styles.workshopCard}>
                            <Text style={styles.workshopName}>{stripEmojis(w.name)}</Text>
                            {w.subtitle ? <Text style={styles.workshopSub}>{stripEmojis(w.subtitle)}</Text> : null}
                            {w.mapLink ? (
                              <TouchableOpacity style={styles.primaryBtn} onPress={() => Linking.openURL(w.mapLink as string).catch(() => null)}>
                                <Text style={styles.primaryBtnText}>Directions</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        ))}
                      </ScrollView>
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
                onVerified={(phone) => {
                  setChatContext((prev: any) => ({
                    ...(prev || {}),
                    customerPhone: phone,
                    phoneVerified: true,
                    pricingEligible: true,
                  }));
                  submitFromPanel(
                    `My mobile ${phone} is OTP verified. Please show service pricing now.`,
                    'Verified ✓',
                  );
                }}
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
                onSubmit={(label) => {
                  setChatContext((prev: any) => ({ ...(prev || {}), pickupDate: label }));
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

          <View style={styles.composer}>
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
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  opaqueRoot: { backgroundColor: COLORS.background },
  safe: { flex: 1, backgroundColor: COLORS.background },
  fullRoot: { flex: 1, backgroundColor: COLORS.background },
  fullSheet: { flex: 1, backgroundColor: COLORS.background },
  drawerRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  drawerBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  drawerSheet: {
    height: Dimensions.get('window').height * 0.8,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  drawerHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    gap: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  headerSub: { marginTop: 2, fontSize: 11, fontWeight: '600', color: COLORS.gray[600] },
  loginBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  loginBtnText: { fontSize: FONT_SIZES.xs, fontWeight: '900', color: COLORS.primary },
  loggedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  loggedInText: { fontSize: 11, fontWeight: '800', color: '#059669' },
  chat: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  uiTitle: { fontSize: FONT_SIZES.xs, fontWeight: '900', color: COLORS.gray[600], marginLeft: 4 },
  workshopCard: {
    minWidth: 260,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
  },
  workshopName: { fontSize: FONT_SIZES.sm, fontWeight: '900', color: COLORS.primaryDark },
  workshopSub: { marginTop: 4, fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.gray[600] },
  primaryBtn: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-start',
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  msgRow: { marginTop: SPACING.sm, alignItems: 'flex-start' },
  msgRowUser: { alignItems: 'flex-end' },
  bubble: { maxWidth: '88%', padding: 14, borderRadius: 16 },
  bubbleBot: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderTopLeftRadius: 6,
  },
  bubbleUser: { backgroundColor: COLORS.primary, borderTopRightRadius: 6 },
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
  composer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
    backgroundColor: '#0088E8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
});
