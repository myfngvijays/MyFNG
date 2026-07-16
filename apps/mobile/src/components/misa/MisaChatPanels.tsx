import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../../constants/theme';
import type { MisaAddress, MisaVehicle } from '../../lib/misa/misaCustomerContext';
import type { BookingSummaryData } from '../../lib/misa/misaDetectors';
import {
  formatDateForChat,
  getAvailableSlotsForDate,
  getCurrentDateIST,
  getDefaultPickupDate,
  getNextDateIST,
} from '../../lib/misa/misaPickupUtils';
import { ENV } from '../../config/environment';
import { buildMobileAuthHeaders } from '../../lib/serviceBooking';

const OTHER_SERVICES = [
  { name: 'AC Service', message: 'Car AC Service chahiye' },
  { name: 'Battery', message: 'Car Battery Service chahiye' },
  { name: 'Brake', message: 'Car Brake Service chahiye' },
  { name: 'Engine', message: 'Car Engine Service chahiye' },
  { name: 'Clutch', message: 'Car Clutch Service chahiye' },
  { name: 'Tyre & Wheel', message: 'Car Tyre & Wheel Care chahiye' },
  { name: 'Detailing', message: 'Car Detailing Service chahiye' },
  { name: 'Denting', message: 'Car Denting & Painting chahiye' },
  { name: 'Electrical', message: 'Electrical & Battery Service chahiye' },
  { name: 'Suspension', message: 'Suspension & Steering Service chahiye' },
] as const;

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
    <View style={panelStyles.wrap}>
      <Text style={panelStyles.label}>Choose a category</Text>
      <View style={panelStyles.row3}>
        <TouchableOpacity style={[panelStyles.catCard, panelStyles.catCardPrime]} onPress={onPrime}>
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
        <Text style={panelStyles.label}>Select a service</Text>
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
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search model (Swift, City, WagonR…)"
        style={panelStyles.input}
        autoCapitalize="words"
      />
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
  const [pin, setPin] = useState('');
  return (
    <View style={panelStyles.wrap}>
      <Text style={panelStyles.label}>Enter 6-digit PIN code</Text>
      <TextInput
        value={pin}
        onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        style={panelStyles.input}
        placeholder="400604"
      />
      <TouchableOpacity
        style={[panelStyles.primaryBtn, pin.length !== 6 && panelStyles.primaryBtnDisabled]}
        disabled={pin.length !== 6}
        onPress={() => onSubmit(pin)}
      >
        <Text style={panelStyles.primaryBtnText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

export function MisaNamePanel({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <View style={panelStyles.wrap}>
      <Text style={panelStyles.label}>Your name</Text>
      <TextInput value={name} onChangeText={setName} style={panelStyles.input} placeholder="Full name" />
      <TouchableOpacity
        style={[panelStyles.primaryBtn, !name.trim() && panelStyles.primaryBtnDisabled]}
        disabled={!name.trim()}
        onPress={() => onSubmit(name.trim())}
      >
        <Text style={panelStyles.primaryBtnText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

export function MisaGuestOtpPanel({
  sessionId,
  onVerified,
}: {
  sessionId?: string;
  onVerified: (phone: string) => void;
}) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendOtp() {
    if (!/^[6-9]\d{9}$/.test(phone)) {
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
    } catch (e: any) {
      setError(e?.message || 'OTP send failed');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!/^\d{6}$/.test(otp)) {
      setError('6-digit OTP daalein');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const verifyRes = await fetch(`${ENV.API_URL}/api/booking/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const verifyJson = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !verifyJson?.verified) throw new Error(verifyJson?.error || 'Invalid OTP');

      if (sessionId) {
        const headers = await buildMobileAuthHeaders();
        await fetch(`${ENV.API_URL}/api/chatbot/v2/verification`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'sync_phone', session_id: sessionId, phone }),
        });
      }
      onVerified(phone);
    } catch (e: any) {
      setError(e?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={panelStyles.wrap}>
      <Text style={panelStyles.label}>Verify mobile (guest)</Text>
      <TextInput
        value={phone}
        onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
        keyboardType="phone-pad"
        style={panelStyles.input}
        placeholder="10-digit mobile"
        editable={!otpSent}
      />
      {otpSent ? (
        <TextInput
          value={otp}
          onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          style={panelStyles.input}
          placeholder="6-digit OTP"
        />
      ) : null}
      {error ? <Text style={panelStyles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={panelStyles.primaryBtn}
        disabled={loading}
        onPress={() => (otpSent ? verifyOtp() : sendOtp())}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={panelStyles.primaryBtnText}>{otpSent ? 'Verify OTP' : 'Send OTP on WhatsApp'}</Text>
        )}
      </TouchableOpacity>
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
  onSubmit: (label: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(preferredDate || getDefaultPickupDate());

  if (mode === 'date') {
    const options = [getCurrentDateIST(), getNextDateIST()];
    return (
      <View style={panelStyles.wrap}>
        <Text style={panelStyles.label}>Pickup date</Text>
        <View style={panelStyles.chipRow}>
          {options.map((iso) => (
            <TouchableOpacity
              key={iso}
              style={[panelStyles.chip, selectedDate === iso && panelStyles.chipActive]}
              onPress={() => setSelectedDate(iso)}
            >
              <Text style={[panelStyles.chipText, selectedDate === iso && panelStyles.chipTextActive]}>
                {iso === getCurrentDateIST() ? 'Today' : 'Tomorrow'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={panelStyles.primaryBtn} onPress={() => onSubmit(formatDateForChat(selectedDate))}>
          <Text style={panelStyles.primaryBtnText}>Confirm date</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const slots = getAvailableSlotsForDate(preferredDate || getDefaultPickupDate());
  return (
    <View style={panelStyles.wrap}>
      <Text style={panelStyles.label}>Pickup time (10 AM – 4 PM)</Text>
      <View style={panelStyles.chipRow}>
        {slots.map((slot) => (
          <TouchableOpacity key={slot.value} style={panelStyles.chip} onPress={() => onSubmit(slot.label)}>
            <Text style={panelStyles.chipText}>{slot.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
  const rows = [
    ['Service', summary.service],
    ['Price', summary.price],
    ['Car', summary.car],
    ['Vehicle', summary.vehicleNo],
    ['PIN', summary.pinCode],
    ['Name', summary.name],
    ['Phone', summary.phone],
    ['Address', summary.address],
    ['Date', summary.date],
    ['Time', summary.time],
  ].filter(([, v]) => Boolean(v));

  return (
    <View style={panelStyles.wrap}>
      <Text style={panelStyles.label}>Booking summary</Text>
      {rows.map(([k, v]) => (
        <View key={k} style={panelStyles.summaryRow}>
          <Text style={panelStyles.summaryKey}>{k}</Text>
          <Text style={panelStyles.summaryVal}>{v}</Text>
        </View>
      ))}
      <View style={panelStyles.row2}>
        <TouchableOpacity style={[panelStyles.primaryBtn, { flex: 1 }]} onPress={onConfirm}>
          <Text style={panelStyles.primaryBtnText}>Yes, confirm</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[panelStyles.ghostBtn, { flex: 1 }]} onPress={onReject}>
          <Text style={panelStyles.ghostBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function MisaCheckoutExtras({
  walletBalance,
  hasActiveMembership,
  membershipPlanName,
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
  estimatedTotal,
}: {
  walletBalance: number;
  hasActiveMembership: boolean;
  membershipPlanName?: string;
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
  estimatedTotal?: number;
}) {
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

      {!hasActiveMembership ? (
        <TouchableOpacity style={panelStyles.membershipBanner} onPress={onToggleMembership}>
          <Ionicons name="star" size={18} color="#B45309" />
          <View style={{ flex: 1 }}>
            <Text style={panelStyles.listTitle}>{membershipPlanName || 'Prime Membership'}</Text>
            <Text style={panelStyles.listSub}>
              {includeMembership ? 'Membership add-on selected — lower service price' : 'Add membership for discounted service'}
            </Text>
          </View>
          <Ionicons name={includeMembership ? 'checkbox' : 'square-outline'} size={20} color="#B45309" />
        </TouchableOpacity>
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
  },
  label: { fontSize: 12, fontWeight: '900', color: COLORS.gray[600], marginBottom: 8 },
  row3: { flexDirection: 'row', gap: 8 },
  row2: { flexDirection: 'row', gap: 10, marginTop: 8 },
  catCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    gap: 4,
  },
  catCardPrime: { borderColor: '#BFDBFE', backgroundColor: '#F0F9FF' },
  catCardPeriodic: { borderColor: '#BAE6FD', backgroundColor: '#ECFEFF' },
  catCardOther: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  catIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
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
    borderColor: '#E5E7EB',
    alignItems: 'center',
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
  membershipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 8,
  },
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
