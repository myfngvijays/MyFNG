import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  Image,
  ImageSourcePropType,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../../constants/theme';
import type { MisaAddress, MisaVehicle } from '../../lib/misa/misaCustomerContext';
import type { BookingSummaryData } from '../../lib/misa/misaDetectors';
import {
  addDaysToIsoDate,
  buildQuickDates,
  formatDateForButton,
  formatDateForChat,
  getAvailableSlotsForDate,
  getCurrentDateIST,
  getDefaultPickupDate,
  getNextDateIST,
  isSameDayBookingAllowed,
  isoFromDatePickerValue,
  normalizeIsoDate,
} from '../../lib/misa/misaPickupUtils';
import { isValidVehicleNumber, normalizeVehicleNumber } from '../../lib/misa/misaVehicleNumber';
import { ENV } from '../../config/environment';
import { buildMobileAuthHeaders } from '../../lib/serviceBooking';
import { PRIME_VALUE_BENEFITS, PRIME_VALUE_PRICE } from '../../constants/primeMembershipValueCard';
import { fetchPrimeMembershipConfig } from '../../lib/membershipPlan';
import { setCustomerSessionToken } from '../../lib/customerSession';

const OTHER_SERVICES: Array<{ name: string; message: string; icon: ImageSourcePropType }> = [
  { name: 'AC Service', message: 'Car AC Service chahiye', icon: require('../../../assets/icon-ac-service.png') },
  { name: 'Battery', message: 'Car Battery Service chahiye', icon: require('../../../assets/icon-battery-service.png') },
  { name: 'Brake', message: 'Car Brake Service chahiye', icon: require('../../../assets/icon-brake-service.png') },
  { name: 'Engine', message: 'Car Engine Service chahiye', icon: require('../../../assets/icon-engine-service.png') },
  { name: 'Clutch', message: 'Car Clutch Service chahiye', icon: require('../../../assets/icon-clutch-service.png') },
  { name: 'Tyre & Wheel', message: 'Car Tyre & Wheel Care chahiye', icon: require('../../../assets/icon-tyre-service.png') },
  { name: 'Detailing', message: 'Car Detailing Service chahiye', icon: require('../../../assets/icon-detailing-service.png') },
  { name: 'Denting', message: 'Car Denting & Painting chahiye', icon: require('../../../assets/icon-denting-service.png') },
  { name: 'Electrical', message: 'Electrical & Battery Service chahiye', icon: require('../../../assets/icon-electrical-service.png') },
  { name: 'Suspension', message: 'Suspension & Steering Service chahiye', icon: require('../../../assets/icon-suspension-service.png') },
];

const PIN_LENGTH = 6;

export function MisaServiceCategories({
  onPrime,
  onPeriodic,
  onOther,
}: {
  onPrime: () => void;
  onPeriodic: () => void;
  onOther: () => void;
}) {
  return (
    <View style={panelStyles.categoryWrap}>
      <View style={panelStyles.categoryLabelRow}>
        <View style={panelStyles.categoryDot} />
        <Text style={panelStyles.categoryLabel}>Choose a category</Text>
      </View>
      <View style={panelStyles.row3}>
        <TouchableOpacity
          style={[panelStyles.catCard, panelStyles.catCardPrime]}
          activeOpacity={0.85}
          onPress={onPrime}
        >
          <View style={[panelStyles.catIconWrap, panelStyles.catIconPrime]}>
            <Ionicons name="ribbon" size={20} color="#fff" />
          </View>
          <Text style={panelStyles.catTitle}>Prime</Text>
          <Text style={panelStyles.catSub}>Membership</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[panelStyles.catCard, panelStyles.catCardPeriodic]} onPress={onPeriodic}>
          <View style={[panelStyles.catIconWrap, panelStyles.catIconPeriodic]}>
            <Ionicons name="construct" size={20} color="#fff" />
          </View>
          <Text style={panelStyles.catTitle}>Periodic</Text>
          <Text style={panelStyles.catSub}>Service</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[panelStyles.catCard, panelStyles.catCardOther]} onPress={onOther}>
          <View style={[panelStyles.catIconWrap, panelStyles.catIconOther]}>
            <Ionicons name="car-sport" size={20} color="#fff" />
          </View>
          <Text style={panelStyles.catTitle}>Other</Text>
          <Text style={panelStyles.catSub}>Services</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const PRIME_BENEFIT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pricetag: 'pricetag',
  cash: 'cash',
  construct: 'construct',
  pulse: 'pulse',
  'shield-checkmark': 'shield-checkmark',
  'logo-whatsapp': 'logo-whatsapp',
  flash: 'flash',
  ribbon: 'ribbon',
};

export function MisaPrimePanel({
  onBack,
  onActivate,
}: {
  onBack: () => void;
  onActivate: () => void;
}) {
  const [planPrice, setPlanPrice] = useState(PRIME_VALUE_PRICE);

  useEffect(() => {
    void fetchPrimeMembershipConfig(ENV.API_URL)
      .then((plan) => {
        const price = Number(plan?.priceNum || 0);
        if (price > 0) setPlanPrice(price);
      })
      .catch(() => null);
  }, []);

  return (
    <View style={panelStyles.primeWrap}>
      <View style={panelStyles.primeHero}>
        <Text style={panelStyles.primeKicker}>Get MyFNG Prime Membership</Text>
        <Text style={panelStyles.primePrice}>@ just ₹{planPrice.toLocaleString('en-IN')}/year!</Text>
        <View style={panelStyles.primeOfferPill}>
          <Ionicons name="time" size={12} color="#fff" />
          <Text style={panelStyles.primeOfferText}>LIMITED TIME OFFER</Text>
        </View>

        <View style={panelStyles.primeBenefits}>
          {PRIME_VALUE_BENEFITS.map((item) => {
            const iconName = PRIME_BENEFIT_ICONS[item.icon] || 'checkmark-circle';
            return (
              <View key={item.benefitCode || item.title} style={panelStyles.primeBenefitRow}>
                <Ionicons name={iconName} size={14} color="#FDE047" />
                <Text style={panelStyles.primeBenefitText}>{item.title}</Text>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={panelStyles.primeActivateBtn} onPress={onActivate} activeOpacity={0.9}>
          <Text style={panelStyles.primeActivateText}>Get Prime Membership →</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={panelStyles.primeBackBtn} onPress={onBack}>
        <Text style={panelStyles.primeBackText}>← Back to options</Text>
      </TouchableOpacity>
    </View>
  );
}

export function MisaOtherServicesGrid({
  onSelect,
  onBack,
}: {
  onSelect: (message: string, label: string) => void;
  onBack?: () => void;
}) {
  return (
    <View style={panelStyles.wrap}>
      <View style={panelStyles.gridHeader}>
        <Text style={panelStyles.gridTitle}>Select a service</Text>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={panelStyles.backBtn}>
            <Ionicons name="chevron-back" size={16} color={COLORS.gray[600]} />
            <Text style={panelStyles.backBtnText}>Back</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={panelStyles.grid}>
        {OTHER_SERVICES.map((s) => (
          <TouchableOpacity key={s.name} style={panelStyles.serviceChip} onPress={() => onSelect(s.message, s.name)}>
            <Image source={s.icon} style={panelStyles.serviceIcon} resizeMode="contain" />
            <Text style={panelStyles.serviceChipText}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

type CarModelResult = { id: string; make: string; model: string; variant?: string | null };

export function MisaCarPicker({ onSelect }: { onSelect: (message: string, label: string) => void }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CarModelResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${ENV.API_URL}/api/car-models/search?q=${encodeURIComponent(q)}`);
        const json = await res.json().catch(() => ({}));
        if (!cancelled) setSuggestions(Array.isArray(json?.models) ? json.models : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function pick(car: CarModelResult) {
    const label = `${car.make} ${car.model}${car.variant ? ` ${car.variant}` : ''}`.trim();
    onSelect(label, label);
    setQuery(label);
    setSuggestions([]);
  }

  return (
    <View style={panelStyles.wrap}>
      <View style={panelStyles.carPickerHeader}>
        <Ionicons name="car-sport" size={18} color={COLORS.primary} />
        <Text style={panelStyles.carPickerTitle}>Select your car</Text>
      </View>
      <View style={panelStyles.searchWrap}>
        <Ionicons name="search" size={16} color="#9CA3AF" style={panelStyles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search model (Swift, City, WagonR…)"
          placeholderTextColor="#9CA3AF"
          style={panelStyles.searchInput}
          autoCapitalize="words"
        />
      </View>
      {loading ? <Text style={panelStyles.metaHint}>Searching…</Text> : null}
      {suggestions.length > 0 ? (
        <View style={panelStyles.suggestList}>
          {suggestions.map((car) => (
            <TouchableOpacity key={car.id} style={panelStyles.suggestItem} onPress={() => pick(car)}>
              <View style={{ flex: 1 }}>
                <Text style={panelStyles.suggestMake}>{car.make}</Text>
                <Text style={panelStyles.suggestModel}>
                  {car.model}
                  {car.variant ? ` (${car.variant})` : ''}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function MisaProfileCarPicker({
  vehicles,
  onSelect,
  onDifferentCar,
}: {
  vehicles: MisaVehicle[];
  onSelect: (message: string, label: string) => void;
  onDifferentCar: () => void;
}) {
  return (
    <View style={panelStyles.wrap}>
      <Text style={panelStyles.label}>Your saved cars</Text>
      {vehicles.map((v) => {
        const label = `${v.make} ${v.model}`.trim();
        const sub = v.vehicle_number ? v.vehicle_number : undefined;
        return (
          <TouchableOpacity
            key={v.id || label}
            style={panelStyles.listItem}
            onPress={() => onSelect(`My car is ${label}`, label)}
          >
            <Ionicons name="car" size={18} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={panelStyles.listTitle}>{label}</Text>
              {sub ? <Text style={panelStyles.listSub}>{sub}</Text> : null}
            </View>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity style={panelStyles.ghostBtn} onPress={onDifferentCar}>
        <Text style={panelStyles.ghostBtnText}>+ Different car</Text>
      </TouchableOpacity>
    </View>
  );
}

export function MisaAddressPicker({
  addresses,
  onSelect,
  onAddNew,
}: {
  addresses: MisaAddress[];
  onSelect: (message: string, label: string) => void;
  onAddNew: () => void;
}) {
  return (
    <View style={panelStyles.wrap}>
      <Text style={panelStyles.label}>Saved addresses</Text>
      {addresses.map((a) => {
        const label = [a.line1, a.line2, a.city, a.pincode].filter(Boolean).join(', ');
        return (
          <TouchableOpacity
            key={a.id}
            style={panelStyles.listItem}
            onPress={() => onSelect(`Pickup address: ${label}`, a.label || 'Address')}
          >
            <Ionicons name="home" size={18} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={panelStyles.listTitle}>{a.label || 'Address'}</Text>
              <Text style={panelStyles.listSub} numberOfLines={2}>
                {label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity style={panelStyles.ghostBtn} onPress={onAddNew}>
        <Text style={panelStyles.ghostBtnText}>+ Add new address</Text>
      </TouchableOpacity>
    </View>
  );
}

export function MisaPincodePanel({ onSubmit }: { onSubmit: (pin: string) => void }) {
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const value = digits.join('');
  const isValid = /^\d{6}$/.test(value);

  function updateDigit(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError(null);
    if (digit && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(index: number, key: string) {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleSubmit() {
    if (!isValid) {
      setError('Valid 6-digit PIN code daalein');
      return;
    }
    onSubmit(value);
  }

  return (
    <View style={panelStyles.wrap}>
      <View style={panelStyles.panelHeaderRow}>
        <View style={[panelStyles.panelIcon, panelStyles.panelIconBlue]}>
          <Ionicons name="location" size={16} color="#fff" />
        </View>
        <Text style={panelStyles.panelTitleDark}>Enter your PIN code</Text>
      </View>

      <View style={panelStyles.pinRow}>
        {digits.map((digit, index) => (
          <TextInput
            key={`pin-${index}`}
            ref={(el) => void (inputRefs.current[index] = el)}
            value={digit}
            onChangeText={(t) => updateDigit(index, t)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
            keyboardType="number-pad"
            maxLength={1}
            style={[panelStyles.pinBox, isValid && panelStyles.pinBoxValid]}
            selectTextOnFocus
          />
        ))}
      </View>

      {error ? <Text style={panelStyles.errorCenter}>{error}</Text> : null}

      {isValid ? (
        <View style={panelStyles.selectedHintRow}>
          <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
          <Text style={panelStyles.selectedHint}>PIN: {value}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[panelStyles.primaryBtn, !isValid && panelStyles.primaryBtnDisabled]}
        disabled={!isValid}
        onPress={handleSubmit}
      >
        <Text style={panelStyles.primaryBtnText}>
          {isValid ? `Continue · ${value}` : 'Enter PIN code to continue'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function MisaNamePanel({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const isValid = trimmed.length >= 2;

  return (
    <View style={panelStyles.wrap}>
      <View style={panelStyles.panelHeaderRow}>
        <View style={[panelStyles.panelIcon, panelStyles.panelIconBlue]}>
          <Ionicons name="person" size={16} color="#fff" />
        </View>
        <Text style={panelStyles.panelTitleDark}>Your name</Text>
      </View>
      <TextInput
        value={name}
        onChangeText={setName}
        style={panelStyles.inputLg}
        placeholder="Full name"
        placeholderTextColor="#9CA3AF"
      />
      <TouchableOpacity
        style={[panelStyles.primaryBtn, !isValid && panelStyles.primaryBtnDisabled]}
        disabled={!isValid}
        onPress={() => onSubmit(trimmed)}
      >
        <Text style={panelStyles.primaryBtnText}>
          {isValid ? `Continue · ${trimmed}` : 'Enter your name'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function MisaGuestOtpPanel({
  sessionId,
  onVerified,
}: {
  sessionId?: string;
  onVerified: (result: {
    phone: string;
    contextPatch?: Record<string, unknown>;
    isReturningCustomer?: boolean;
  }) => void;
}) {
  const [phone, setPhone] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otpRefs = useRef<Array<TextInput | null>>([]);

  const otp = otpDigits.join('');
  const phoneValid = /^[6-9]\d{9}$/.test(phone);
  const otpValid = /^\d{6}$/.test(otp);

  useEffect(() => {
    if (!otpSent || otpTimer <= 0) return;
    const t = setTimeout(() => setOtpTimer((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [otpSent, otpTimer]);

  function updateOtpDigit(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    setError(null);
    if (digit && index < PIN_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyPress(index: number, key: string) {
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  async function sendOtp() {
    if (!phoneValid) {
      setError('Valid 10-digit mobile number daalein');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${ENV.API_URL}/api/booking/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, metadata: { source: 'misa-app', session_id: sessionId } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'OTP send failed');
      setOtpSent(true);
      setOtpDigits(Array(PIN_LENGTH).fill(''));
      setOtpTimer(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (e: any) {
      setError(e?.message || 'OTP send failed');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!otpValid) {
      setError('6-digit OTP daalein');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const authRes = await fetch(`${ENV.API_URL}/api/customer/auth/whatsapp-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, channel: 'WHATSAPP', platform: 'mobile' }),
      });
      const authJson = await authRes.json().catch(() => ({}));
      if (!authRes.ok || !authJson?.success) {
        throw new Error(authJson?.error || 'Invalid OTP');
      }

      const sessionToken = String(authJson?.session_token || '').trim();
      if (sessionToken) {
        await setCustomerSessionToken(sessionToken);
      }

      let contextPatch: Record<string, unknown> | undefined;
      let isReturningCustomer = !authJson?.is_new_customer;

      if (sessionId) {
        const headers = await buildMobileAuthHeaders();
        const syncRes = await fetch(`${ENV.API_URL}/api/chatbot/v2/verification`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'sync_phone', session_id: sessionId, phone }),
        });
        const syncJson = await syncRes.json().catch(() => ({}));
        if (syncRes.ok && syncJson?.success && syncJson?.contextPatch) {
          contextPatch = syncJson.contextPatch as Record<string, unknown>;
          isReturningCustomer =
            Boolean(contextPatch?.skipNamePrompt) ||
            Boolean((contextPatch?.customerVehicles as unknown[])?.length) ||
            !authJson?.is_new_customer;
        }
      }

      onVerified({ phone, contextPatch, isReturningCustomer });
    } catch (e: any) {
      setError(e?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={panelStyles.wrap}>
      <View style={panelStyles.panelHeaderRow}>
        <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
        <Text style={panelStyles.panelTitle}>Mobile verification for pricing</Text>
      </View>

      <Text style={panelStyles.fieldLabel}>Mobile number (WhatsApp OTP)</Text>
      <View style={panelStyles.phoneRow}>
        <TextInput
          value={phone}
          onChangeText={(t) => {
            setPhone(t.replace(/\D/g, '').slice(0, 10));
            setError(null);
            if (otpSent) {
              setOtpSent(false);
              setOtpDigits(Array(PIN_LENGTH).fill(''));
            }
          }}
          keyboardType="phone-pad"
          style={panelStyles.phoneInput}
          placeholder="10-digit mobile"
          placeholderTextColor="#9CA3AF"
          editable={!loading}
        />
        {!otpSent ? (
          <TouchableOpacity
            style={[panelStyles.otpSendBtn, (!phoneValid || loading) && panelStyles.primaryBtnDisabled]}
            disabled={!phoneValid || loading}
            onPress={() => void sendOtp()}
          >
            {loading && !otpSent ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={panelStyles.otpSendBtnText}>Send OTP</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[panelStyles.otpResendBtn, (loading || otpTimer > 0) && panelStyles.primaryBtnDisabled]}
            disabled={loading || otpTimer > 0}
            onPress={() => void sendOtp()}
          >
            <Text style={panelStyles.otpResendBtnText}>{otpTimer > 0 ? `Resend (${otpTimer}s)` : 'Resend'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {otpSent ? (
        <>
          <Text style={[panelStyles.fieldLabel, { marginTop: 12 }]}>Enter 6-digit OTP from WhatsApp</Text>
          <View style={panelStyles.pinRow}>
            {otpDigits.map((digit, index) => (
              <TextInput
                key={`otp-${index}`}
                ref={(el) => void (otpRefs.current[index] = el)}
                value={digit}
                onChangeText={(t) => updateOtpDigit(index, t)}
                onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                style={panelStyles.otpBox}
                selectTextOnFocus
              />
            ))}
          </View>
          <TouchableOpacity
            style={[panelStyles.secondaryBtn, (!otpValid || loading) && panelStyles.primaryBtnDisabled]}
            disabled={!otpValid || loading}
            onPress={() => void verifyOtp()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={panelStyles.primaryBtnText}>Verify OTP</Text>
            )}
          </TouchableOpacity>
        </>
      ) : null}

      {error ? <Text style={panelStyles.error}>{error}</Text> : null}
    </View>
  );
}

export function MisaDateTimePanel({
  mode,
  preferredDate,
  onSubmit,
}: {
  mode: 'date' | 'time';
  preferredDate?: string;
  onSubmit: (label: string, isoDate?: string) => void;
}) {
  const today = getCurrentDateIST();
  const tomorrow = getNextDateIST();
  const sameDayAllowed = isSameDayBookingAllowed() && getAvailableSlotsForDate(today).length > 0;
  const minDate = sameDayAllowed ? today : tomorrow;
  const quickDates = useMemo(() => buildQuickDates(minDate, 7), [minDate]);
  const dateIso = normalizeIsoDate(preferredDate);

  const [selectedDate, setSelectedDate] = useState(normalizeIsoDate(preferredDate));
  const [showPicker, setShowPicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'date') {
      setSelectedDate(normalizeIsoDate(preferredDate));
    }
  }, [mode, preferredDate]);

  useEffect(() => {
    if (mode === 'time') setSelectedTime(null);
  }, [mode, dateIso]);

  const slots = useMemo(() => getAvailableSlotsForDate(dateIso), [dateIso]);

  if (mode === 'date') {
    const selectedLabel = formatDateForChat(selectedDate);
    const pickerDate = new Date(selectedDate + 'T12:00:00+05:30');
    const minPickerDate = new Date(minDate + 'T00:00:00+05:30');
    const maxPickerDate = new Date(addDaysToIsoDate(minDate, 30) + 'T00:00:00+05:30');

    return (
      <View style={panelStyles.wrap}>
        <View style={panelStyles.panelHeaderRow}>
          <View style={[panelStyles.panelIcon, panelStyles.panelIconBlue]}>
            <Ionicons name="calendar" size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={panelStyles.panelTitle}>Select pickup date</Text>
            <Text style={panelStyles.panelSub}>Today available only before 4 PM IST</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={panelStyles.dateChipScroll}>
          {sameDayAllowed ? (
            <TouchableOpacity
              style={[panelStyles.dateChip, selectedDate === today && panelStyles.dateChipActive]}
              onPress={() => setSelectedDate(today)}
            >
              <Text style={panelStyles.dateChipDay}>{formatDateForButton(today).split(',')[0]}</Text>
              <Text style={[panelStyles.dateChipNum, selectedDate === today && panelStyles.dateChipNumActive]}>
                {new Date(today + 'T00:00:00+05:30').getDate()}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[panelStyles.dateChip, selectedDate === tomorrow && panelStyles.dateChipActive]}
            onPress={() => setSelectedDate(tomorrow)}
          >
            <Text style={panelStyles.dateChipDay}>{formatDateForButton(tomorrow).split(',')[0]}</Text>
            <Text style={[panelStyles.dateChipNum, selectedDate === tomorrow && panelStyles.dateChipNumActive]}>
              {new Date(tomorrow + 'T00:00:00+05:30').getDate()}
            </Text>
          </TouchableOpacity>
          {quickDates.map((iso) => (
            <TouchableOpacity
              key={iso}
              style={[panelStyles.dateChip, selectedDate === iso && panelStyles.dateChipActive]}
              onPress={() => setSelectedDate(iso)}
            >
              <Text style={panelStyles.dateChipDay}>{formatDateForButton(iso).split(',')[0]}</Text>
              <Text style={[panelStyles.dateChipNum, selectedDate === iso && panelStyles.dateChipNumActive]}>
                {new Date(iso + 'T00:00:00+05:30').getDate()}{' '}
                {new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }).format(
                  new Date(iso + 'T00:00:00+05:30'),
                )}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity style={panelStyles.calendarBtn} onPress={() => setShowPicker(true)}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
          <Text style={panelStyles.calendarBtnText}>Pick another date</Text>
        </TouchableOpacity>

        {!sameDayAllowed ? (
          <Text style={panelStyles.hintAmber}>After 4 PM IST, same-day pickup is not available.</Text>
        ) : null}

        <View style={panelStyles.selectedHintRow}>
          <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
          <Text style={panelStyles.selectedHint}>Selected: {selectedLabel}</Text>
        </View>

        <TouchableOpacity
          style={panelStyles.primaryBtn}
          onPress={() => onSubmit(selectedLabel, selectedDate)}
        >
          <Text style={panelStyles.primaryBtnText}>Continue · {selectedLabel}</Text>
        </TouchableOpacity>

        {showPicker ? (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minPickerDate}
            maximumDate={maxPickerDate}
            onChange={(event: DateTimePickerEvent, date?: Date) => {
              if (Platform.OS === 'android') setShowPicker(false);
              if (event.type === 'dismissed') {
                setShowPicker(false);
                return;
              }
              if (!date) return;
              const iso = isoFromDatePickerValue(date);
              if (iso >= minDate) setSelectedDate(iso);
            }}
          />
        ) : null}
      </View>
    );
  }

  if (slots.length === 0) {
    return (
      <View style={[panelStyles.wrap, panelStyles.wrapAmber]}>
        <Text style={panelStyles.hintAmber}>No pickup slots left for this date. Please pick a future date.</Text>
      </View>
    );
  }

  return (
    <View style={panelStyles.wrap}>
      <View style={panelStyles.panelHeaderRow}>
        <View style={[panelStyles.panelIcon, panelStyles.panelIconPurple]}>
          <Ionicons name="time" size={16} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={panelStyles.panelTitle}>Select pickup time</Text>
          <Text style={panelStyles.panelSub}>Available 10 AM – 4 PM · past slots hidden</Text>
        </View>
      </View>
      <View style={panelStyles.chipRow}>
        {slots.map((slot) => {
          const isSelected = selectedTime === slot.value;
          return (
            <TouchableOpacity
              key={slot.value}
              style={[panelStyles.chip, isSelected && panelStyles.chipPurpleActive]}
              onPress={() => setSelectedTime(slot.value)}
            >
              <Text style={[panelStyles.chipText, isSelected && panelStyles.chipTextActive]}>{slot.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {selectedTime ? (
        <View style={panelStyles.selectedHintRow}>
          <Ionicons name="checkmark-circle" size={14} color="#7C3AED" />
          <Text style={[panelStyles.selectedHint, { color: '#7C3AED' }]}>Selected: {selectedTime}</Text>
        </View>
      ) : null}
      <TouchableOpacity
        style={[panelStyles.primaryBtn, !selectedTime && panelStyles.primaryBtnDisabled]}
        disabled={!selectedTime}
        onPress={() => selectedTime && onSubmit(selectedTime)}
      >
        <Text style={panelStyles.primaryBtnText}>
          {selectedTime ? `Continue · ${selectedTime}` : 'Select a time slot'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function MisaVehicleNumberPanel({
  sessionId,
  savedVehicles,
  onSubmit,
}: {
  sessionId?: string;
  savedVehicles?: MisaVehicle[];
  onSubmit: (vehicleNumber: string) => void;
}) {
  const defaultNumber =
    savedVehicles?.find((v) => v.is_default && v.vehicle_number)?.vehicle_number ||
    savedVehicles?.find((v) => v.vehicle_number)?.vehicle_number ||
    '';
  const [value, setValue] = useState(defaultNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeVehicleNumber(value);
  const isValid = isValidVehicleNumber(normalized);

  async function handleSave() {
    if (!isValid) {
      setError('Valid registration number daalein (e.g. DL01AB1234)');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (sessionId) {
        const headers = await buildMobileAuthHeaders();
        const res = await fetch(`${ENV.API_URL}/api/chatbot/v2/verification`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'set_vehicle', session_id: sessionId, vehicle_number: normalized }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Could not save vehicle number');
        }
      }
      onSubmit(normalized);
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={panelStyles.wrap}>
      <View style={panelStyles.panelHeaderRow}>
        <View style={[panelStyles.panelIcon, panelStyles.panelIconGreen]}>
          <Ionicons name="car" size={16} color="#fff" />
        </View>
        <Text style={panelStyles.panelTitle}>Car registration number</Text>
      </View>
      {savedVehicles && savedVehicles.some((v) => v.vehicle_number) ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={panelStyles.chipRow}>
          {savedVehicles
            .filter((v) => v.vehicle_number)
            .map((v) => (
              <TouchableOpacity
                key={v.id || v.vehicle_number}
                style={[panelStyles.chip, normalized === v.vehicle_number && panelStyles.chipActive]}
                onPress={() => setValue(String(v.vehicle_number))}
              >
                <Text style={[panelStyles.chipText, normalized === v.vehicle_number && panelStyles.chipTextActive]}>
                  {v.vehicle_number}
                </Text>
              </TouchableOpacity>
            ))}
        </ScrollView>
      ) : null}
      <TextInput
        value={value}
        onChangeText={(t) => {
          setValue(t.toUpperCase());
          setError(null);
        }}
        autoCapitalize="characters"
        placeholder="ENTER VEHICLE NUMBER"
        placeholderTextColor="#9CA3AF"
        style={[panelStyles.input, panelStyles.vehicleInput]}
      />
      {error ? <Text style={panelStyles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={[panelStyles.primaryBtn, (!isValid || loading) && panelStyles.primaryBtnDisabled]}
        disabled={!isValid || loading}
        onPress={() => void handleSave()}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={panelStyles.primaryBtnText}>Save</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export function MisaBookingSummaryPanel({
  summary,
  onConfirm,
  onReject,
}: {
  summary: BookingSummaryData;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const grid1 = [
    ['Service', summary.service],
    ['Price', summary.price],
    ['Car', summary.car],
    ['Vehicle', summary.vehicleNo],
    ['PIN', summary.pinCode],
    ['Time', summary.time],
  ].filter(([, v]) => Boolean(v)) as Array<[string, string]>;

  const grid2 = [
    ['Name', summary.name],
    ['Phone', summary.phone],
    ['Date', summary.date],
  ].filter(([, v]) => Boolean(v)) as Array<[string, string]>;

  return (
    <View style={panelStyles.summaryCard}>
      <View style={panelStyles.summaryHeader}>
        <Ionicons name="clipboard" size={16} color="#fff" />
        <Text style={panelStyles.summaryHeaderText}>Booking Summary</Text>
      </View>

      <View style={panelStyles.summaryBody}>
        {grid1.length > 0 ? (
          <View style={panelStyles.summaryGrid}>
            {grid1.map(([k, v]) => (
              <View key={k} style={panelStyles.summaryCell}>
                <Text style={panelStyles.summaryCellLabel}>{k}</Text>
                <Text style={panelStyles.summaryCellVal} numberOfLines={2}>
                  {v}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {(grid2.length > 0 || summary.address) && (
          <View style={[panelStyles.summaryGrid, { marginTop: 8 }]}>
            {grid2.map(([k, v]) => (
              <View key={k} style={panelStyles.summaryCell}>
                <Text style={panelStyles.summaryCellLabel}>{k}</Text>
                <Text style={panelStyles.summaryCellVal} numberOfLines={2}>
                  {v}
                </Text>
              </View>
            ))}
            {summary.address ? (
              <View style={panelStyles.summaryCellFull}>
                <Text style={panelStyles.summaryCellLabel}>Address</Text>
                <Text style={panelStyles.summaryCellVal} numberOfLines={3}>
                  {summary.address}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      <View style={panelStyles.summaryActions}>
        <TouchableOpacity style={panelStyles.summaryConfirmBtn} onPress={onConfirm}>
          <Ionicons name="checkmark" size={14} color="#fff" />
          <Text style={panelStyles.summaryConfirmText}>Yes, confirm</Text>
        </TouchableOpacity>
        <TouchableOpacity style={panelStyles.summaryRejectBtn} onPress={onReject}>
          <Ionicons name="close" size={14} color="#374151" />
          <Text style={panelStyles.summaryRejectText}>No, edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function MisaCheckoutExtras({
  walletBalance,
  hasActiveMembership,
  membershipPlanName,
  servicePrice,
  membershipLinePrice,
  membershipBundleDiscount,
  couponCode,
  couponDiscount,
  couponError,
  couponApplying,
  useWallet,
  includeMembership,
  onCouponChange,
  onApplyCoupon,
  onToggleWallet,
  onToggleMembership,
  onNavigateToMembership,
  estimatedTotal,
}: {
  walletBalance: number;
  hasActiveMembership: boolean;
  membershipPlanName?: string;
  servicePrice?: number;
  membershipLinePrice?: number;
  membershipBundleDiscount?: number;
  couponCode: string;
  couponDiscount: number;
  couponError: string | null;
  couponApplying: boolean;
  useWallet: boolean;
  includeMembership: boolean;
  onCouponChange: (code: string) => void;
  onApplyCoupon: () => void;
  onToggleWallet: () => void;
  onToggleMembership: () => void;
  onNavigateToMembership?: () => void;
  estimatedTotal?: number;
}) {
  const showMembershipOption = !hasActiveMembership && (membershipLinePrice ?? 0) > 0;

  return (
    <View style={panelStyles.wrap}>
      <Text style={panelStyles.label}>Savings & extras</Text>
      {walletBalance > 0 ? (
        <TouchableOpacity style={panelStyles.listItem} onPress={onToggleWallet}>
          <Ionicons name="wallet" size={18} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={panelStyles.listTitle}>Wallet · ₹{Math.round(walletBalance).toLocaleString('en-IN')}</Text>
            <Text style={panelStyles.listSub}>{useWallet ? 'Will apply at checkout' : 'Tap to use wallet'}</Text>
          </View>
          <Ionicons name={useWallet ? 'checkbox' : 'square-outline'} size={20} color={COLORS.primary} />
        </TouchableOpacity>
      ) : null}

      {showMembershipOption ? (
        <View style={panelStyles.membershipBanner}>
          <TouchableOpacity style={panelStyles.membershipBannerMain} onPress={onNavigateToMembership} activeOpacity={0.85}>
            <Ionicons name="star" size={18} color="#B45309" />
            <View style={{ flex: 1 }}>
              <Text style={panelStyles.listTitle}>{membershipPlanName || 'Prime Membership'}</Text>
              <Text style={panelStyles.listSub}>
                {includeMembership
                  ? `Extra 5% off service (up to ₹250) · membership ₹${Math.round(membershipLinePrice || 0).toLocaleString('en-IN')}`
                  : 'Tap to view benefits · add with booking for extra discount'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#B45309" />
          </TouchableOpacity>
          <TouchableOpacity style={panelStyles.membershipCheck} onPress={onToggleMembership} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={includeMembership ? 'checkbox' : 'square-outline'} size={22} color="#B45309" />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={panelStyles.couponRow}>
        <TextInput
          value={couponCode}
          onChangeText={onCouponChange}
          placeholder="Coupon code"
          autoCapitalize="characters"
          style={[panelStyles.input, { flex: 1, marginBottom: 0 }]}
        />
        <TouchableOpacity style={panelStyles.couponBtn} disabled={couponApplying} onPress={onApplyCoupon}>
          {couponApplying ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={panelStyles.couponBtnText}>Apply</Text>
          )}
        </TouchableOpacity>
      </View>
      {couponError ? <Text style={panelStyles.error}>{couponError}</Text> : null}
      {couponDiscount > 0 ? (
        <Text style={panelStyles.success}>Coupon applied · −₹{Math.round(couponDiscount).toLocaleString('en-IN')}</Text>
      ) : null}

      {typeof servicePrice === 'number' && servicePrice > 0 ? (
        <View style={panelStyles.priceBreakdown}>
          <View style={panelStyles.summaryRow}>
            <Text style={panelStyles.summaryKey}>Service</Text>
            <Text style={panelStyles.summaryVal}>₹{Math.round(servicePrice).toLocaleString('en-IN')}</Text>
          </View>
          {includeMembership && !hasActiveMembership && (membershipLinePrice ?? 0) > 0 ? (
            <View style={panelStyles.summaryRow}>
              <Text style={panelStyles.summaryKey}>Prime membership</Text>
              <Text style={panelStyles.summaryVal}>+₹{Math.round(membershipLinePrice || 0).toLocaleString('en-IN')}</Text>
            </View>
          ) : null}
          {includeMembership && !hasActiveMembership && (membershipBundleDiscount ?? 0) > 0 ? (
            <View style={panelStyles.summaryRow}>
              <Text style={[panelStyles.summaryKey, panelStyles.discountKey]}>Bundle discount</Text>
              <Text style={[panelStyles.summaryVal, panelStyles.discountVal]}>
                −₹{Math.round(membershipBundleDiscount || 0).toLocaleString('en-IN')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {typeof estimatedTotal === 'number' ? (
        <Text style={panelStyles.estTotal}>Est. payable · ₹{Math.round(estimatedTotal).toLocaleString('en-IN')}</Text>
      ) : null}
    </View>
  );
}

const panelStyles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    padding: SPACING.sm,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  wrapAmber: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  panelHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  panelIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelIconBlue: { backgroundColor: '#2563EB' },
  panelIconPurple: { backgroundColor: '#7C3AED' },
  panelIconGreen: { backgroundColor: '#059669' },
  panelTitle: { fontSize: FONT_SIZES.sm, fontWeight: '800', color: COLORS.secondary },
  panelSub: { fontSize: 11, fontWeight: '600', color: COLORS.gray[500], marginTop: 2 },
  dateChipScroll: { gap: 8, paddingVertical: 4 },
  dateChip: {
    minWidth: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateChipActive: { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' },
  dateChipDay: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' },
  dateChipNum: { marginTop: 2, fontSize: 13, fontWeight: '800', color: '#111827' },
  dateChipNumActive: { color: COLORS.primary },
  calendarBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
  },
  calendarBtnText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  hintAmber: { marginTop: 8, fontSize: 11, fontWeight: '600', color: '#B45309' },
  selectedHint: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  selectedHintRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  priceBreakdown: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  discountKey: { color: '#059669' },
  discountVal: { color: '#059669', fontWeight: '800' },
  membershipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    marginBottom: 8,
    overflow: 'hidden',
  },
  membershipBannerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  membershipCheck: { paddingHorizontal: 12, paddingVertical: 10 },
  primeWrap: {
    marginTop: 8,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  primeHero: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
  },
  primeKicker: { fontSize: FONT_SIZES.md, fontWeight: '900', color: '#FDE047' },
  primePrice: { marginTop: 4, fontSize: 20, fontWeight: '900', color: '#FDE047' },
  primeOfferPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  primeOfferText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.4 },
  primeBenefits: { marginTop: 14, gap: 8 },
  primeBenefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primeBenefitText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#fff' },
  primeActivateBtn: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#FDE047',
    paddingVertical: 13,
    alignItems: 'center',
  },
  primeActivateText: { fontSize: FONT_SIZES.sm, fontWeight: '900', color: COLORS.secondary },
  primeBackBtn: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  primeBackText: { fontSize: 12, fontWeight: '700', color: COLORS.gray[600] },
  label: { fontSize: 12, fontWeight: '900', color: COLORS.gray[600], marginBottom: 8 },
  categoryWrap: { marginTop: 8 },
  categoryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  categoryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  gridTitle: { fontSize: FONT_SIZES.sm, fontWeight: '800', color: COLORS.secondary },
  panelTitleDark: { fontSize: FONT_SIZES.sm, fontWeight: '800', color: '#1F2937' },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: COLORS.gray[600], marginBottom: 6 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#111827',
    backgroundColor: '#fff',
  },
  otpSendBtn: {
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  otpSendBtnText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  otpResendBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  otpResendBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 11 },
  secondaryBtn: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pinRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12, marginBottom: 4 },
  pinBox: {
    width: 40,
    height: 46,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    backgroundColor: '#fff',
  },
  pinBoxValid: { borderColor: COLORS.primary, backgroundColor: 'rgba(0,136,232,0.05)' },
  otpBox: {
    width: 42,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    backgroundColor: '#fff',
  },
  errorCenter: { color: '#DC2626', fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  inputLg: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#111827',
    backgroundColor: '#fff',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
  },
  searchIcon: { marginRight: 4 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#111827',
  },
  vehicleInput: { textAlign: 'center', letterSpacing: 1, fontWeight: '800' },
  serviceIcon: { width: 44, height: 44, marginBottom: 6 },
  summaryCard: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.2)',
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryHeaderText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  summaryBody: { padding: 10 },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
  },
  summaryCell: { width: '47%', minWidth: 120 },
  summaryCellFull: { width: '100%' },
  summaryCellLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryCellVal: { marginTop: 2, fontSize: 13, fontWeight: '700', color: '#111827' },
  summaryActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: 'rgba(249,250,251,0.8)',
    padding: 10,
  },
  summaryConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
  },
  summaryConfirmText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  summaryRejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    paddingVertical: 12,
  },
  summaryRejectText: { color: '#374151', fontWeight: '800', fontSize: 12 },
  chipPurpleActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  row3: { flexDirection: 'row', gap: 8 },
  row2: { flexDirection: 'row', gap: 10, marginTop: 8 },
  catCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    gap: 4,
  },
  catCardPrime: { borderColor: 'rgba(2,61,149,0.2)', backgroundColor: '#F0F9FF' },
  catCardPeriodic: { borderColor: 'rgba(0,136,232,0.25)', backgroundColor: '#ECFEFF' },
  catCardOther: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  catIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catIconPrime: { backgroundColor: COLORS.secondary },
  catIconPeriodic: { backgroundColor: COLORS.primary },
  catIconOther: { backgroundColor: '#059669' },
  catTitle: { fontSize: 11, fontWeight: '800', color: '#111827' },
  catSub: { fontSize: 9, fontWeight: '600', color: COLORS.gray[600] },
  gridHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.gray[600] },
  carPickerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  carPickerTitle: { fontSize: FONT_SIZES.sm, fontWeight: '800', color: COLORS.secondary },
  suggestList: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    backgroundColor: COLORS.secondary,
  },
  suggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  suggestMake: { fontSize: 13, fontWeight: '800', color: '#fff' },
  suggestModel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  metaHint: { marginTop: 6, fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceChip: {
    width: '31%',
    minWidth: 96,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  serviceChipText: { fontSize: 10, fontWeight: '800', color: '#111827', textAlign: 'center' },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  listTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  listSub: { fontSize: 11, fontWeight: '600', color: COLORS.gray[600], marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  primaryBtn: {
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: FONT_SIZES.sm },
  ghostBtn: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  ghostBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: FONT_SIZES.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '800', color: '#111827' },
  chipTextActive: { color: '#fff' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 4 },
  summaryKey: { fontSize: 11, fontWeight: '700', color: COLORS.gray[600] },
  summaryVal: { flex: 1, textAlign: 'right', fontSize: 11, fontWeight: '800', color: '#111827' },
  couponRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  couponBtn: {
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  couponBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  error: { color: '#DC2626', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  success: { color: '#059669', fontSize: 11, fontWeight: '800', marginTop: 4 },
  estTotal: { marginTop: 8, fontSize: 13, fontWeight: '900', color: COLORS.primary },
});
