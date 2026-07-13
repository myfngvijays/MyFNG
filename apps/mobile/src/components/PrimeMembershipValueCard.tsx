import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  shouldSkipFirebaseSmsOnSimulator,
  isFirebaseIosClientError,
  firebaseTestOtpHint,
} from '../lib/firebasePhoneAuth';
import { sendSmsOtp, verifySmsOtp } from '../lib/backendSmsOtp';
import { ENV } from '../config/environment';
import { setCustomerSessionToken } from '../lib/customerSession';
import { COLORS } from '../constants/theme';
import {
  PRIME_VALUE_ADDON,
  PRIME_VALUE_BENEFITS,
  PRIME_VALUE_FOOTER,
  PRIME_VALUE_PRICE,
  PRIME_VALUE_SAVE,
  PRIME_VALUE_TOTAL,
} from '../constants/primeMembershipValueCard';
import type { ValueCardBenefit, ValueCardConfig } from '../lib/membershipPlan';
import type { MembershipType } from '../lib/membershipPlacements';
import {
  formatClaimHistoryDate,
  formatClaimHistoryStatus,
  formatClaimRemaining,
  isBenefitClaimButtonEnabled,
  resolveBenefitCode,
  type MembershipBenefitStatusRow,
  type MembershipClaimHistoryRow,
} from '../lib/membershipClaims';
import MembershipBenefitIcon, { benefitIconStyles } from './MembershipBenefitIcon';
import { getMembershipTerms, loadMembershipTerms, type MembershipTermType } from '../lib/membershipTerms';
import MembershipPlanHeaderIcon from './MembershipPlanHeaderIcon';
import CarModelSearchField from './CarModelSearchField';

export type MembershipVehicleOption = {
  key: string;
  vehicle_number?: string;
  make?: string;
  model?: string;
  label?: string;
};

export type GuestVehicleForm = {
  name: string;
  phone: string;
  vehicleNumber: string;
  make: string;
  model: string;
  carSearchDisplay?: string;
};

export type LinkedMembershipVehicle = {
  label: string;
  vehicle_number?: string;
  make?: string;
  model?: string;
};

type Props = {
  isLoggedIn: boolean;
  isActive: boolean;
  hasSecondCarAddon?: boolean;
  linkedPrimaryVehicle?: LinkedMembershipVehicle | null;
  linkedSecondVehicle?: LinkedMembershipVehicle | null;
  linkedPrimaryVehicleKey?: string | null;
  activeExpiry?: string;
  membershipLabel?: string;
  vehicles: MembershipVehicleOption[];
  primaryVehicleKey: string | null;
  onPrimaryVehicleKeyChange: (key: string) => void;
  addSecondCar: boolean;
  onAddSecondCarChange: (v: boolean) => void;
  secondVehicleKey: string | null;
  onSecondVehicleKeyChange: (key: string) => void;
  showSecondVehicleForm: boolean;
  onShowSecondVehicleFormChange: (v: boolean) => void;
  guestForm: GuestVehicleForm;
  onGuestFormChange: (patch: Partial<GuestVehicleForm>) => void;
  guestSecondForm: Pick<GuestVehicleForm, 'vehicleNumber' | 'make' | 'model' | 'carSearchDisplay'>;
  onGuestSecondFormChange: (patch: Partial<GuestVehicleForm>) => void;
  onActivate: () => void;
  onBuySecondCarAddon?: () => void;
  activating?: boolean;
  planName?: string;
  planPrice?: number;
  addonPrice?: number;
  tagline?: string;
  valueCard?: Partial<ValueCardConfig>;
  addonIcon?: string;
  addonIconUrl?: string;
  addonTitle?: string;
  addonDescription?: string;
  footerNote?: string;
  membershipType?: MembershipType;
  accentColor?: string;
  accentTextColor?: string;
  headerIcon?: string;
  headerIconUrl?: string;
  preview?: boolean;
  embedded?: boolean;
  previewInteractiveAddon?: boolean;
  previewCtaLabel?: string;
  pricePeriodLabel?: string;
  onPreviewPress?: () => void;
  onGuestAuthenticated?: () => void | Promise<void>;
  showSecondCarAddon?: boolean;
  membershipTerms?: string[];
  benefitStatuses?: MembershipBenefitStatusRow[];
  claimHistory?: MembershipClaimHistoryRow[];
  claimsUnlocked?: boolean;
  claimsUnlockMessage?: string | null;
  claimingBenefitCode?: string | null;
  onClaimBenefit?: (payload: {
    benefitCode: string;
    benefitTitle: string;
    serviceCategory?: string;
  }) => void;
  style?: object;
};


const PRIME_MEMBERSHIP_TERMS = [
  'Membership is valid for 12 months from the date of activation.',
  'All benefits apply to the vehicle registered on your MyFNG account.',
  'Free pickup & drop is included with eligible services during membership.',
  '2nd car add-on (if selected) expires on the same date as your primary car.',
  'Membership is non-transferable and linked to your verified mobile number.',
];

const RSA_MEMBERSHIP_TERMS = [
  'RSA coverage is valid for the plan duration selected at purchase.',
  'Assistance applies to registered vehicle(s) linked to your membership.',
  'Service calls are subject to plan limits and fair usage policy.',
  '2nd car add-on (if selected) shares the same validity as the primary car.',
  'Membership is non-refundable after activation and tied to your mobile number.',
];

function hexWithAlpha(hex: string, alphaHex: string) {
  const clean = hex.replace('#', '');
  if (clean.length === 6) return `#${clean}${alphaHex}`;
  return hex;
}

function themeFromAccent(accentColor: string | undefined, isRsa: boolean, accentTextColor?: string) {
  const accent = accentColor || '#023D95';
  const onAccent = accentTextColor || '#FFFFFF';
  return {
    headerBg: accent,
    onAccent,
    onAccentMuted: hexWithAlpha(onAccent, 'D9'),
    onAccentSoft: hexWithAlpha(onAccent, 'BF'),
    headerSub: hexWithAlpha(onAccent, '99'),
    accent,
    accentBorder: hexWithAlpha(accent, '40'),
    benefitIconBg: hexWithAlpha(accent, '18'),
    benefitValue: accent,
    totalBandBg: hexWithAlpha(accent, '0C'),
    priceHeroBg: accent,
    activateBg: accent,
    linkedBg: hexWithAlpha(accent, '0C'),
    linkedBorder: hexWithAlpha(accent, '40'),
    linkedHeading: accent,
  };
}

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function vehicleLabel(v: MembershipVehicleOption) {
  const plate = String(v.vehicle_number || '').trim().toUpperCase();
  const mm = [v.make, v.model].filter(Boolean).join(' ');
  return mm ? `${mm}${plate ? ` · ${plate}` : ''}` : plate || v.label || 'Vehicle';
}

function VehiclePicker({
  title,
  options,
  selectedKey,
  onSelect,
  onAddNew,
  showAddNew,
}: {
  title: string;
  options: MembershipVehicleOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onAddNew?: () => void;
  showAddNew?: boolean;
}) {
  return (
    <View style={styles.vehicleBlock}>
      <Text style={styles.vehicleBlockTitle}>{title}</Text>
      {options.length === 0 ? (
        <Text style={styles.vehicleHint}>No saved car in profile — search and add below.</Text>
      ) : (
        options.map((v) => {
          const active = selectedKey === v.key;
          return (
            <TouchableOpacity
              key={v.key}
              style={[styles.vehicleChip, active ? styles.vehicleChipActive : null]}
              onPress={() => onSelect(v.key)}
            >
              <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={active ? COLORS.primary : '#9CA3AF'} />
              <Text style={[styles.vehicleChipText, active ? styles.vehicleChipTextActive : null]}>{vehicleLabel(v)}</Text>
            </TouchableOpacity>
          );
        })
      )}
      {showAddNew && onAddNew ? (
        <TouchableOpacity style={styles.addVehicleBtn} onPress={onAddNew}>
          <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.addVehicleBtnText}>Add another car</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function BenefitValue({ prefix, label, accentColor = '#023D95' }: { prefix?: string; label: string; accentColor?: string }) {
  if (!label) return <Text style={styles.bValueMuted}>—</Text>;
  if (prefix) {
    return (
      <View style={styles.bValueStack}>
        <Text style={styles.bValuePrefix}>{prefix}</Text>
        <Text style={[styles.bValue, { color: accentColor }]}>{label}</Text>
      </View>
    );
  }
  return <Text style={[styles.bValue, { color: accentColor }]}>{label}</Text>;
}

function GuestPhoneOtpSection({
  phone,
  name,
  verified,
  onVerified,
}: {
  phone: string;
  name: string;
  verified: boolean;
  onVerified: () => void | Promise<void>;
}) {
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpChannel, setOtpChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [otpConfirmation, setOtpConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);

  const cleanPhone = phone.replace(/\D/g, '').slice(-10);

  const handleSendWhatsAppOtp = async () => {
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number');
      return;
    }
    setOtpLoading(true);
    setOtpChannel('whatsapp');
    try {
      const payload = JSON.stringify({ phone: cleanPhone });
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-mobile-client': 'true',
      };
      let res: Response | null = null;
      let json: any = {};
      try {
        res = await fetch(`${ENV.API_URL}/api/customer/auth/whatsapp-otp`, {
          method: 'POST',
          headers,
          body: payload,
        });
        json = await res.json().catch(() => ({}));
      } catch {
        res = null;
      }
      if (!res || res.status === 404) {
        res = await fetch(`${ENV.API_URL}/api/booking/send-otp`, {
          method: 'POST',
          headers,
          body: payload,
        });
        json = await res.json().catch(() => ({}));
      }
      if (!res.ok) throw new Error(json?.error || 'Failed to send OTP');
      setOtpSent(true);
    } catch (error: any) {
      Alert.alert('OTP Failed', error?.message || 'Unable to send WhatsApp OTP. Try SMS instead.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSendSmsOtp = async () => {
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number');
      return;
    }
    if (shouldSkipFirebaseSmsOnSimulator(cleanPhone)) {
      Alert.alert(
        'Simulator SMS unavailable',
        'iOS Simulator par real SMS nahi aata. WhatsApp OTP bhej rahe hain.',
        [{ text: 'OK', onPress: () => handleSendWhatsAppOtp() }],
      );
      return;
    }
    setOtpLoading(true);
    setOtpChannel('sms');
    try {
      const result = await sendSmsOtp(cleanPhone);
      setOtpConfirmation(result.confirmation);
      setOtpSent(true);
      const testHint = firebaseTestOtpHint(cleanPhone);
      if (testHint) Alert.alert('Test OTP', testHint);
    } catch (error: any) {
      const code = error?.code as string | undefined;
      if (code === 'auth/missing-client-identifier' || code === 'auth/app-not-authorized') {
        Alert.alert(
          'SMS Unavailable',
          'SMS verification is not available on this device. Please use WhatsApp OTP instead.',
          [
            { text: 'Use WhatsApp', onPress: () => handleSendWhatsAppOtp() },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
      } else {
        Alert.alert('OTP Failed', error?.message || 'Unable to send SMS OTP.');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.trim().length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the OTP sent to your number');
      return;
    }
    setOtpLoading(true);
    try {
      let sessionToken: string | null = null;
      if (otpChannel === 'whatsapp') {
        const payload = JSON.stringify({
          phone: cleanPhone,
          otp: otpValue.trim(),
          displayName: name.trim() || undefined,
        });
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-mobile-client': 'true',
        };
        let res: Response | null = null;
        let json: any = {};
        try {
          res = await fetch(`${ENV.API_URL}/api/customer/auth/whatsapp-verify`, {
            method: 'POST',
            headers,
            body: payload,
          });
          json = await res.json().catch(() => ({}));
        } catch {
          res = null;
        }
        if (!res || res.status === 404) {
          res = await fetch(`${ENV.API_URL}/api/booking/verify-otp`, {
            method: 'POST',
            headers,
            body: payload,
          });
          json = await res.json().catch(() => ({}));
          if (res.ok && json?.verified) {
            res = await fetch(`${ENV.API_URL}/api/customer/auth/whatsapp-verify`, {
              method: 'POST',
              headers,
              body: payload,
            });
            json = await res.json().catch(() => ({}));
          }
        }
        if (!res.ok) throw new Error(json?.error || 'Invalid OTP. Please try again.');
        sessionToken = json?.session_token || null;
      } else {
        const authResult = await verifySmsOtp(cleanPhone, otpValue.trim(), otpConfirmation);
        sessionToken = authResult.session_token;
      }
      if (!sessionToken) throw new Error('Session token not received');
      await setCustomerSessionToken(sessionToken);
      await onVerified();
    } catch (error: any) {
      Alert.alert('Verification Failed', error?.message || 'Invalid OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  if (verified) {
    return (
      <View style={styles.otpVerifiedRow}>
        <Ionicons name="checkmark-circle" size={16} color="#059669" />
        <Text style={styles.otpVerifiedText}>Mobile verified via {otpChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</Text>
      </View>
    );
  }

  if (!otpSent) {
    return (
      <View style={styles.otpBtnRow}>
        <TouchableOpacity
          style={styles.otpWhatsAppBtn}
          onPress={handleSendWhatsAppOtp}
          disabled={otpLoading || cleanPhone.length !== 10}
          activeOpacity={0.85}
        >
          {otpLoading && otpChannel === 'whatsapp' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
              <Text style={styles.otpWhatsAppBtnText}>WhatsApp OTP</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.otpSmsBtnAlt}
          onPress={handleSendSmsOtp}
          disabled={otpLoading || cleanPhone.length !== 10}
          activeOpacity={0.85}
        >
          {otpLoading && otpChannel === 'sms' ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : (
            <>
              <Ionicons name="chatbubble-ellipses" size={16} color={COLORS.primary} />
              <Text style={styles.otpSmsBtnAltText}>SMS OTP</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.otpVerifyBlock}>
      <View style={styles.otpSentRow}>
        <Ionicons
          name={otpChannel === 'whatsapp' ? 'logo-whatsapp' : 'chatbubble-ellipses'}
          size={14}
          color={otpChannel === 'whatsapp' ? '#25D366' : COLORS.primary}
        />
        <Text style={styles.otpSentText}>
          OTP sent via {otpChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to +91 {cleanPhone}
        </Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Enter 6-digit OTP"
        keyboardType="number-pad"
        maxLength={6}
        value={otpValue}
        onChangeText={setOtpValue}
      />
      <View style={styles.otpActionRow}>
        <TouchableOpacity onPress={otpChannel === 'whatsapp' ? handleSendWhatsAppOtp : handleSendSmsOtp} disabled={otpLoading}>
          <Text style={styles.otpActionLink}>Resend OTP</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={otpChannel === 'whatsapp' ? handleSendSmsOtp : handleSendWhatsAppOtp} disabled={otpLoading}>
          <Text style={styles.otpActionMuted}>Try {otpChannel === 'whatsapp' ? 'SMS' : 'WhatsApp'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.otpVerifyBtn} onPress={handleVerifyOtp} disabled={otpLoading}>
          {otpLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.otpVerifyBtnText}>Verify</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function GuestCarSection({
  form,
  onChange,
  title,
  includeProfileFields = true,
  showPhoneOtp = false,
  guestPhoneVerified = false,
  onGuestPhoneVerified,
}: {
  form: GuestVehicleForm | Pick<GuestVehicleForm, 'vehicleNumber' | 'make' | 'model' | 'carSearchDisplay'>;
  onChange: (patch: Partial<GuestVehicleForm>) => void;
  title?: string;
  includeProfileFields?: boolean;
  showPhoneOtp?: boolean;
  guestPhoneVerified?: boolean;
  onGuestPhoneVerified?: () => void | Promise<void>;
}) {
  const showNamePhone = includeProfileFields && 'name' in form;
  const carDisplay =
    (form as GuestVehicleForm).carSearchDisplay ||
    [form.make, form.model].filter(Boolean).join(' ');

  return (
    <View style={styles.guestForm}>
      {title ? <Text style={styles.vehicleBlockTitle}>{title}</Text> : null}
      {showNamePhone ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Full name"
            value={(form as GuestVehicleForm).name}
            onChangeText={(name) => onChange({ name })}
          />
          <TextInput
            style={styles.input}
            placeholder="Mobile number"
            keyboardType="phone-pad"
            maxLength={10}
            value={(form as GuestVehicleForm).phone}
            onChangeText={(phone) => onChange({ phone: phone.replace(/\D/g, '').slice(0, 10) })}
            editable={!guestPhoneVerified}
          />
          {showPhoneOtp && onGuestPhoneVerified ? (
            <GuestPhoneOtpSection
              phone={(form as GuestVehicleForm).phone}
              name={(form as GuestVehicleForm).name}
              verified={guestPhoneVerified}
              onVerified={onGuestPhoneVerified}
            />
          ) : null}
        </>
      ) : null}
      <TextInput
        style={styles.input}
        placeholder="Car number (e.g. MH12AB1234)"
        autoCapitalize="characters"
        value={form.vehicleNumber}
        onChangeText={(vehicleNumber) => onChange({ vehicleNumber: vehicleNumber.toUpperCase() })}
      />
      <CarModelSearchField
        label="Car brand & model"
        displayValue={carDisplay}
        selectedMake={form.make}
        selectedModel={form.model}
        onSelect={(make, model, display) =>
          onChange({ make, model, carSearchDisplay: display })
        }
        onClear={() => onChange({ make: '', model: '', carSearchDisplay: '' })}
      />
    </View>
  );
}

function LinkedVehicleCard({
  title,
  vehicle,
  badge,
  validUntil,
}: {
  title: string;
  vehicle: LinkedMembershipVehicle;
  badge?: string;
  validUntil?: string;
}) {
  return (
    <View style={styles.linkedCarCard}>
      <View style={styles.linkedCarIcon}>
        <Ionicons name="car-sport" size={18} color={COLORS.primary} />
      </View>
      <View style={styles.linkedCarBody}>
        <Text style={styles.linkedCarTitle}>{title}</Text>
        <Text style={styles.linkedCarName}>{vehicle.label}</Text>
        {vehicle.vehicle_number ? (
          <Text style={styles.linkedCarPlate}>{vehicle.vehicle_number}</Text>
        ) : null}
        {validUntil ? <Text style={styles.linkedCarValid}>Valid until {validUntil}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.linkedCarBadge}>
          <Text style={styles.linkedCarBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function PrimeMembershipValueCard({
  isLoggedIn,
  isActive,
  hasSecondCarAddon = false,
  linkedPrimaryVehicle = null,
  linkedSecondVehicle = null,
  linkedPrimaryVehicleKey = null,
  activeExpiry,
  membershipLabel,
  vehicles,
  primaryVehicleKey,
  onPrimaryVehicleKeyChange,
  addSecondCar,
  onAddSecondCarChange,
  secondVehicleKey,
  onSecondVehicleKeyChange,
  showSecondVehicleForm,
  onShowSecondVehicleFormChange,
  guestForm,
  onGuestFormChange,
  guestSecondForm,
  onGuestSecondFormChange,
  onActivate,
  onBuySecondCarAddon,
  activating,
  planName = 'MyFNG Prime',
  planPrice = PRIME_VALUE_PRICE,
  addonPrice = PRIME_VALUE_ADDON,
  tagline,
  valueCard,
  addonIcon = 'car-sport',
  addonIconUrl,
  addonTitle = '2nd Car Add-On',
  addonDescription = "same benefits, same membership period as primary car",
  footerNote,
  membershipType = 'SERVICE',
  accentColor,
  accentTextColor,
  headerIcon,
  headerIconUrl,
  preview = false,
  embedded = false,
  previewInteractiveAddon = false,
  previewCtaLabel,
  pricePeriodLabel = '/ year',
  onPreviewPress,
  onGuestAuthenticated,
  showSecondCarAddon = true,
  membershipTerms: membershipTermsProp,
  benefitStatuses = [],
  claimHistory = [],
  claimsUnlocked = true,
  claimsUnlockMessage = null,
  claimingBenefitCode = null,
  onClaimBenefit,
  style,
}: Props) {
  const isRsa = membershipType === 'RSA';
  const theme = themeFromAccent(accentColor, isRsa, accentTextColor);
  const canBuySecondCarAddon = isActive && !hasSecondCarAddon && Boolean(onBuySecondCarAddon) && showSecondCarAddon;
  const showFullPurchase = !isActive && (!preview || embedded);
  const totalPay = planPrice + (addSecondCar ? addonPrice : 0);
  const primaryOptions = vehicles;
  const [guestDetailsOpen, setGuestDetailsOpen] = useState(false);
  const [guestPhoneVerified, setGuestPhoneVerified] = useState(isLoggedIn);
  const [termsExpanded, setTermsExpanded] = useState(false);
  const [loadedTerms, setLoadedTerms] = useState<string[]>(() =>
    getMembershipTerms((membershipType === 'RSA' ? 'RSA' : 'SERVICE') as MembershipTermType),
  );

  useEffect(() => {
    if (membershipTermsProp?.length) return;
    const type = (membershipType === 'RSA' ? 'RSA' : 'SERVICE') as MembershipTermType;
    setLoadedTerms(getMembershipTerms(type));
    void loadMembershipTerms(type).then(setLoadedTerms);
  }, [membershipType, membershipTermsProp]);

  const membershipTerms =
    membershipTermsProp?.length
      ? membershipTermsProp
      : loadedTerms.length
        ? loadedTerms
        : isRsa
          ? RSA_MEMBERSHIP_TERMS
          : PRIME_MEMBERSHIP_TERMS;

  useEffect(() => {
    if (isLoggedIn) setGuestPhoneVerified(true);
  }, [isLoggedIn]);

  const handleGuestPhoneVerified = async () => {
    setGuestPhoneVerified(true);
    await onGuestAuthenticated?.();
  };

  const handleActivatePress = () => {
    if (!isLoggedIn && !guestDetailsOpen) {
      setGuestDetailsOpen(true);
      return;
    }
    if (!isLoggedIn) {
      const name = guestForm.name.trim();
      const phone = guestForm.phone.replace(/\D/g, '').slice(-10);
      const vehicleNumber = guestForm.vehicleNumber.trim().toUpperCase();
      const make = guestForm.make.trim();
      const model = guestForm.model.trim();
      if (!name || phone.length !== 10) {
        Alert.alert('Add Your Details', 'Please enter your name and mobile number.');
        return;
      }
      if (!guestPhoneVerified) {
        Alert.alert('Verify Mobile', 'Please verify your mobile number with WhatsApp or SMS OTP.');
        return;
      }
      if (!vehicleNumber || !make || !model) {
        Alert.alert('Add Your Details', 'Please enter car number and search-select your car model.');
        return;
      }
    }
    onActivate();
  };

  const cardBenefits: ValueCardBenefit[] =
    valueCard?.benefits && valueCard.benefits.length > 0
      ? valueCard.benefits
      : PRIME_VALUE_BENEFITS.map((b) => ({
          benefitCode: b.benefitCode,
          showClaimButton: Boolean(b.showClaimButton),
          icon: b.icon,
          title: b.title,
          description: b.description,
          valueLabel: b.valueLabel,
          valuePrefix: b.valuePrefix,
        }));

  const statusByCode = Object.fromEntries(
    (benefitStatuses || []).map((row) => [String(row.benefit_code || '').toUpperCase(), row]),
  );

  const totalBenefitsValue = valueCard?.totalBenefitsValue ?? PRIME_VALUE_TOTAL;
  const saveAmount = valueCard?.saveAmount ?? PRIME_VALUE_SAVE;
  const valueColumnLabel = valueCard?.valueColumnLabel ?? 'VALUE';
  const totalBenefitsLabel = valueCard?.totalBenefitsLabel ?? 'Total Benefits Value';
  const saveLabel = valueCard?.saveLabel ?? 'You Save';
  const priceHeroLabel = valueCard?.priceHeroLabel ?? 'YOU PAY ONLY';
  const priceHeroSub = valueCard?.priceHeroSub ?? 'All benefits · One full year · One car';
  const headerTagline = tagline || valueCard?.tagline || 'Your Car. Our Responsibility.';
  const cardFooter = footerNote || valueCard?.footerNote || PRIME_VALUE_FOOTER;

  const benefitsHead = `BENEFITS FOR ${String(planName || 'MYFNG PRIME').toUpperCase()}`;

  const renderSecondCarDetails = (addonOnly = false) => {
    const excludeKey = addonOnly ? linkedPrimaryVehicleKey || primaryVehicleKey : primaryVehicleKey;
    const pickerOptions = addonOnly
      ? vehicles.filter((v) => v.key !== excludeKey)
      : vehicles.filter((v) => v.key !== primaryVehicleKey);
    const showAddForm = showSecondVehicleForm || pickerOptions.length === 0;
    return (
    <View style={[styles.detailsSection, preview ? styles.detailsSectionPreview : null]}>
      {isLoggedIn ? (
        pickerOptions.length > 0 && !showAddForm ? (
          <VehiclePicker
            title={addonOnly ? 'Select your 2nd car' : 'Select 2nd car from profile'}
            options={pickerOptions}
            selectedKey={secondVehicleKey}
            onSelect={onSecondVehicleKeyChange}
            showAddNew
            onAddNew={() => onShowSecondVehicleFormChange(true)}
          />
        ) : (
          <>
            {pickerOptions.length > 0 ? (
              <TouchableOpacity onPress={() => onShowSecondVehicleFormChange(false)} style={styles.backLink}>
                <Text style={styles.backLinkText}>← Choose from saved cars</Text>
              </TouchableOpacity>
            ) : null}
            <GuestCarSection
              title={addonOnly ? 'Add your 2nd car' : '2nd car details'}
              form={guestSecondForm}
              onChange={onGuestSecondFormChange}
              includeProfileFields={false}
            />
          </>
        )
      ) : (
        <GuestCarSection title="2nd car details" form={guestSecondForm} onChange={onGuestSecondFormChange} includeProfileFields={false} />
      )}
    </View>
    );
  };

  const cardBody = (
    <View style={[styles.card, preview ? styles.cardPreview : null]}>
      <View style={[styles.header, preview ? styles.headerPreview : null, { backgroundColor: theme.headerBg }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.onAccent }]}>{planName}</Text>
          <Text style={[styles.headerSub, { color: theme.headerSub }]}>{headerTagline}</Text>
        </View>
        <View style={styles.crownWrap}>
          <MembershipPlanHeaderIcon
            icon={headerIcon}
            iconUrl={headerIconUrl}
            membershipType={membershipType}
            size={20}
            color={theme.onAccent}
          />
        </View>
      </View>

      {isActive ? (
        <View style={styles.activeBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#047857" />
          <Text style={styles.activeBannerText}>
            {membershipLabel || 'Prime Member'} active{activeExpiry ? ` · until ${activeExpiry}` : ''}
            {hasSecondCarAddon ? ' · 2nd car included' : ''}
          </Text>
        </View>
      ) : null}

      {isActive && isLoggedIn && linkedPrimaryVehicle ? (
        <View style={[styles.linkedCarsSection, { backgroundColor: theme.linkedBg, borderColor: theme.linkedBorder }]}>
          <Text style={[styles.linkedCarsHeading, { color: theme.linkedHeading }]}>Your membership covers</Text>
          <LinkedVehicleCard
            title="Primary car"
            vehicle={linkedPrimaryVehicle}
            badge="ACTIVE"
            validUntil={activeExpiry}
          />
          {hasSecondCarAddon && linkedSecondVehicle ? (
            <LinkedVehicleCard
              title="2nd car add-on"
              vehicle={linkedSecondVehicle}
              badge="ADD-ON"
              validUntil={activeExpiry}
            />
          ) : null}
        </View>
      ) : null}

      <View style={[styles.benefitsSection, preview ? styles.benefitsSectionPreview : null]}>
        {isActive && !claimsUnlocked && claimsUnlockMessage ? (
          <View style={styles.claimsLockedBanner}>
            <Ionicons name="time-outline" size={16} color="#92400E" />
            <Text style={styles.claimsLockedBannerText}>{claimsUnlockMessage}</Text>
          </View>
        ) : null}
        <View style={styles.benefitsHead}>
          <Text style={[styles.benefitsHeadText, styles.benefitsHeadLeft]}>{benefitsHead}</Text>
          <Text style={styles.benefitsHeadText}>{valueColumnLabel}</Text>
        </View>
        {cardBenefits.map((b, idx) => {
          const benefitCode = resolveBenefitCode(b, idx);
          const status = benefitCode ? statusByCode[String(benefitCode).toUpperCase()] : null;
          const showClaimButton = isBenefitClaimButtonEnabled(b, status, claimsUnlocked);
          const remainingLabel = formatClaimRemaining(status);
          const isPendingApproval = Boolean(status?.approval_pending);
          const canClaim = Boolean(
            isActive &&
              benefitCode &&
              showClaimButton &&
              onClaimBenefit &&
              (status?.claimable ?? true) &&
              !isPendingApproval,
          );
          const isClaiming = claimingBenefitCode === benefitCode;

          return (
          <View key={`${b.title}-${idx}`} style={[styles.bRow, idx === cardBenefits.length - 1 ? styles.bRowLast : null]}>
            <View style={styles.bLeft}>
              <View style={[styles.bIcon, { backgroundColor: theme.benefitIconBg }]}>
                <MembershipBenefitIcon icon={b.icon} iconUrl={b.iconUrl} size={15} />
              </View>
              <View style={styles.bTextWrap}>
                <Text style={styles.bTitle}>{b.title}</Text>
                <Text style={styles.bSub}>{b.description}</Text>
                {remainingLabel ? (
                  <Text style={styles.bRemaining}>{remainingLabel}</Text>
                ) : null}
                {isPendingApproval ? (
                  <Text style={styles.bPending}>Approval pending</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.bRightCol}>
              <BenefitValue prefix={b.valuePrefix} label={b.valueLabel} accentColor={theme.benefitValue} />
              {isPendingApproval ? (
                <View style={styles.claimPendingBadge}>
                  <Text style={styles.claimPendingBadgeText}>Pending</Text>
                </View>
              ) : null}
              {canClaim ? (
                <TouchableOpacity
                  style={[styles.claimBtn, isClaiming ? styles.claimBtnDisabled : null]}
                  activeOpacity={0.85}
                  disabled={Boolean(claimingBenefitCode) || isClaiming}
                  onPress={() => onClaimBenefit?.({
                    benefitCode: String(benefitCode),
                    benefitTitle: b.title,
                  })}
                >
                  {isClaiming ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.claimBtnText}>Claim</Text>
                  )}
                </TouchableOpacity>
              ) : null}
              {!canClaim && !isPendingApproval && showClaimButton && isActive && status && !status.claimable ? (
                <View style={styles.claimUsedBadge}>
                  <Text style={styles.claimUsedBadgeText}>Used</Text>
                </View>
              ) : null}
            </View>
          </View>
          );
        })}
      </View>

      {isActive && claimHistory.length > 0 ? (
        <View style={styles.claimHistorySection}>
          <Text style={styles.claimHistoryTitle}>Claim History</Text>
          {claimHistory.slice(0, 8).map((item, historyIdx) => {
            const historyStatus = formatClaimHistoryStatus(item.claim_status);
            const statusStyle =
              String(item.claim_status || '').toUpperCase() === 'APPROVED'
                ? styles.claimHistoryStatusApproved
                : String(item.claim_status || '').toUpperCase() === 'REJECTED'
                  ? styles.claimHistoryStatusRejected
                  : styles.claimHistoryStatusPending;
            return (
            <View key={item.id} style={[styles.claimHistoryRow, historyIdx === 0 ? styles.claimHistoryRowFirst : null]}>
              <View style={{ flex: 1 }}>
                <View style={styles.claimHistoryTitleRow}>
                  <Text style={styles.claimHistoryBenefit}>{item.benefit_title}</Text>
                  <View style={[styles.claimHistoryStatusBadge, statusStyle]}>
                    <Text style={styles.claimHistoryStatusText}>{historyStatus}</Text>
                  </View>
                </View>
                <Text style={styles.claimHistoryMeta}>
                  {item.vehicle_label || item.vehicle_number || 'Vehicle'}
                  {item.vehicle_number ? ` · ${item.vehicle_number}` : ''}
                </Text>
                {item.lead_number ? (
                  <Text style={styles.claimHistoryLead}>Booking #{item.lead_number}</Text>
                ) : null}
              </View>
              <Text style={styles.claimHistoryDate}>{formatClaimHistoryDate(item.created_at)}</Text>
            </View>
            );
          })}
        </View>
      ) : null}

      <View style={[styles.totalBand, preview ? styles.totalBandPreview : null, { backgroundColor: theme.totalBandBg }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{totalBenefitsLabel}</Text>
          <Text style={[styles.totalValue, styles.totalStrike, { color: theme.benefitValue }]}>{inr(totalBenefitsValue)}</Text>
        </View>
        <View style={styles.saveRow}>
          <Text style={styles.saveLabel}>{saveLabel}</Text>
          <Text style={styles.saveValue}>{inr(saveAmount)}</Text>
        </View>
      </View>

      {!isActive ? (
        <View
          style={[
            styles.priceHero,
            preview ? styles.priceHeroPreview : styles.priceHeroCompact,
            isRsa ? styles.priceHeroRsa : null,
            { backgroundColor: theme.priceHeroBg },
          ]}
        >
          <Text style={[styles.priceHeroLabel, isRsa ? styles.priceHeroLabelRsa : null, { color: theme.onAccentMuted }]}>
            {priceHeroLabel}
          </Text>
          {isRsa ? (
            <>
              <Text
                style={[
                  styles.priceHeroAmount,
                  styles.priceHeroAmountRsa,
                  preview ? styles.priceHeroAmountPreviewRsa : styles.priceHeroAmountCompactRsa,
                  { color: theme.onAccent },
                ]}
              >
                {inr(planPrice)}
              </Text>
              {pricePeriodLabel ? (
                <Text
                  style={[
                    styles.priceHeroPeriodStacked,
                    preview ? styles.priceHeroPeriodStackedPreview : null,
                    { color: theme.onAccentMuted },
                  ]}
                >
                  {pricePeriodLabel.replace(/^\s*\/?\s*/, '')}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.priceHeroPriceGroupCentered}>
                <Text
                  style={[
                    styles.priceHeroAmount,
                    preview ? styles.priceHeroAmountPreview : styles.priceHeroAmountCompact,
                    { color: theme.onAccent },
                  ]}
                >
                  {inr(planPrice)}
                </Text>
                {pricePeriodLabel ? (
                  <Text
                    style={[
                      styles.priceHeroPeriodInline,
                      preview ? styles.priceHeroPeriodPreview : null,
                      { color: theme.onAccentMuted },
                    ]}
                  >
                    / {pricePeriodLabel.replace(/^\s*\/?\s*/, '')}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.priceHeroSubOnBlue, { color: theme.onAccentSoft }]} numberOfLines={2}>
                {priceHeroSub}
              </Text>
            </>
          )}
        </View>
      ) : null}

      {preview && !isActive ? (
        <>
          {previewInteractiveAddon && showSecondCarAddon ? (
            <>
              <TouchableOpacity
                style={[
                  styles.addon,
                  preview ? styles.addonPreviewCompact : null,
                  addSecondCar ? styles.addonActive : null,
                  { borderColor: theme.accentBorder },
                ]}
                onPress={() => onAddSecondCarChange(!addSecondCar)}
                activeOpacity={0.85}
              >
                <Ionicons name={addSecondCar ? 'checkbox' : 'square-outline'} size={20} color={addSecondCar ? theme.accent : '#9CA3AF'} />
                <View style={benefitIconStyles.wrap}>
                  <MembershipBenefitIcon icon={addonIcon} iconUrl={addonIconUrl} size={14} />
                </View>
                <Text style={[styles.addonText, preview ? styles.addonTextCompact : null]}>
                  <Text style={[styles.addonBold, { color: theme.accent }]}>{addonTitle}</Text>
                  {'\n'}
                  <Text style={styles.addonDesc}>{addonDescription}</Text>
                </Text>
                <Text style={[styles.addonPrice, { color: theme.accent }]}>+{inr(addonPrice)}</Text>
              </TouchableOpacity>

              {addSecondCar ? renderSecondCarDetails(false) : null}

              <View style={[styles.checkoutRow, preview ? styles.checkoutRowPreview : null]}>
                <Text style={styles.checkoutLabel}>Total payable</Text>
                <Text style={[styles.checkoutAmount, { color: theme.accent }]}>{inr(totalPay)}</Text>
              </View>
            </>
          ) : showSecondCarAddon ? (
            <View style={[styles.addon, styles.addonPreview, { borderColor: theme.accentBorder }]}>
              <View style={benefitIconStyles.wrap}>
                <MembershipBenefitIcon icon={addonIcon} iconUrl={addonIconUrl} size={14} />
              </View>
              <Text style={styles.addonText}>
                <Text style={[styles.addonBold, { color: theme.accent }]}>{addonTitle}</Text> — {addonDescription}
              </Text>
              <Text style={[styles.addonPrice, { color: theme.accent }]}>+{inr(addonPrice)}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.cta, styles.previewCta, previewInteractiveAddon ? styles.previewCtaCompact : null, { backgroundColor: theme.activateBg }]}
            onPress={onPreviewPress}
            activeOpacity={0.9}
          >
            <Text style={[styles.ctaText, previewInteractiveAddon ? styles.previewCtaTextCompact : null, { color: theme.onAccent }]}>
              {previewCtaLabel || `${isRsa ? 'Get RSA Membership' : 'Get Prime Membership'} — ${inr(previewInteractiveAddon ? totalPay : planPrice)} →`}
            </Text>
          </TouchableOpacity>
        </>
      ) : null}

      {showFullPurchase ? (
        <>
          {!isLoggedIn ? (
            guestDetailsOpen ? (
              <View style={styles.detailsSection}>
                <View style={styles.detailsSectionHeader}>
                  <Text style={styles.detailsTitle}>Your details</Text>
                  <TouchableOpacity onPress={() => setGuestDetailsOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.collapseDetailsText}>Hide</Text>
                  </TouchableOpacity>
                </View>
                <GuestCarSection
                  form={guestForm}
                  onChange={onGuestFormChange}
                  showPhoneOtp
                  guestPhoneVerified={guestPhoneVerified}
                  onGuestPhoneVerified={handleGuestPhoneVerified}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addDetailsBtn, { borderColor: theme.accentBorder }]}
                onPress={() => setGuestDetailsOpen(true)}
                activeOpacity={0.85}
              >
                <View style={[styles.addDetailsIcon, { backgroundColor: theme.benefitIconBg }]}>
                  <Ionicons name="person-add-outline" size={18} color={theme.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.addDetailsTitle, { color: theme.accent }]}>Add Your Details</Text>
                  <Text style={styles.addDetailsSub}>Name, mobile & car info for membership</Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={theme.accent} />
              </TouchableOpacity>
            )
          ) : (
            <View style={styles.detailsSection}>
              <Text style={styles.detailsTitle}>Which car is this membership for?</Text>
              <VehiclePicker
                title="Primary car"
                options={primaryOptions}
                selectedKey={primaryVehicleKey}
                onSelect={onPrimaryVehicleKeyChange}
              />
              {primaryOptions.length === 0 ? (
                <GuestCarSection form={guestForm} onChange={onGuestFormChange} includeProfileFields={false} />
              ) : null}
            </View>
          )}

          {showSecondCarAddon ? (
          <TouchableOpacity
            style={[styles.addon, addSecondCar ? styles.addonActive : null]}
            onPress={() => onAddSecondCarChange(!addSecondCar)}
            activeOpacity={0.85}
          >
            <Ionicons name={addSecondCar ? 'checkbox' : 'square-outline'} size={20} color={addSecondCar ? COLORS.primary : '#9CA3AF'} />
            <View style={benefitIconStyles.wrap}>
              <MembershipBenefitIcon icon={addonIcon} iconUrl={addonIconUrl} size={14} />
            </View>
            <Text style={styles.addonText}>
              <Text style={styles.addonBold}>{addonTitle}</Text> — {addonDescription}
            </Text>
            <Text style={styles.addonPrice}>+{inr(addonPrice)}</Text>
          </TouchableOpacity>
          ) : null}

          {showSecondCarAddon && addSecondCar ? renderSecondCarDetails(false) : null}

          <View style={styles.checkoutRow}>
            <Text style={styles.checkoutLabel}>Total payable</Text>
            <Text style={styles.checkoutAmount}>{inr(totalPay)}</Text>
          </View>

          <View style={styles.termsSection}>
            <TouchableOpacity
              style={styles.termsHeader}
              onPress={() => setTermsExpanded((v) => !v)}
              activeOpacity={0.85}
            >
              <Text style={[styles.termsHeaderText, { color: theme.accent }]}>Terms & Conditions</Text>
              <Ionicons name={termsExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.accent} />
            </TouchableOpacity>
            {termsExpanded ? (
              <View style={styles.termsPoints}>
                {membershipTerms.map((point) => (
                  <View key={point} style={styles.termsPointRow}>
                    <Text style={[styles.termsBullet, { color: theme.accent }]}>•</Text>
                    <Text style={styles.termsPointText}>{point}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.cta, { backgroundColor: theme.activateBg }]}
            onPress={handleActivatePress}
            disabled={activating}
            activeOpacity={0.9}
          >
            {activating ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text style={[styles.ctaText, { color: theme.onAccent }]}>
                {isRsa ? 'Activate RSA Membership' : 'Activate Prime'} — {inr(totalPay)} →
              </Text>
            )}
          </TouchableOpacity>
        </>
      ) : null}

      {canBuySecondCarAddon ? (
        <View style={styles.addonUpgradeSection}>
          <Text style={styles.addonUpgradeTitle}>Add 2nd Car to your membership</Text>
          <Text style={styles.addonUpgradeSub}>
            2nd car primary car ke saath same membership period mein chalegi
            {activeExpiry ? ` · valid until ${activeExpiry}` : ''}. Alag saal ki renewal nahi hogi.
          </Text>
          {renderSecondCarDetails(true)}
          <View style={styles.checkoutRow}>
            <Text style={styles.checkoutLabel}>2nd car add-on</Text>
            <Text style={styles.checkoutAmount}>{inr(addonPrice)}</Text>
          </View>
          <TouchableOpacity
            style={styles.ctaAddon}
            onPress={onBuySecondCarAddon}
            disabled={activating}
            activeOpacity={0.9}
          >
            {activating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>Add 2nd Car — {inr(addonPrice)} →</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {isActive && hasSecondCarAddon && linkedSecondVehicle ? (
        <View style={styles.addonDoneBanner}>
          <Ionicons name="car-sport" size={18} color={COLORS.primary} />
          <Text style={styles.addonDoneText}>
            2nd car active: {linkedSecondVehicle.label}
            {linkedSecondVehicle.vehicle_number ? ` · ${linkedSecondVehicle.vehicle_number}` : ''}
            {activeExpiry ? ` · valid until ${activeExpiry}` : ''}
          </Text>
        </View>
      ) : null}

      <Text style={styles.foot}>{cardFooter}</Text>
    </View>
  );

  if (embedded) {
    return (
      <View style={[styles.previewOuter, style]}>
        {cardBody}
      </View>
    );
  }

  if (preview) {
    return (
      <View style={[styles.previewOuter, style]}>
        {previewInteractiveAddon ? (
          cardBody
        ) : (
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} bounces={false}>
            {cardBody}
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {cardBody}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { paddingBottom: 24 },
  previewOuter: {
    marginBottom: 16,
  },
  previewCta: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
  },
  previewCtaCompact: {
    marginHorizontal: 16,
    paddingVertical: 14,
  },
  previewCtaTextCompact: {
    fontSize: 14,
    textAlign: 'center',
  },
  addonPreview: {
    borderStyle: 'dashed',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#023D95',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardPreview: {
    borderRadius: 20,
  },
  header: {
    backgroundColor: '#023D95',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerPreview: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: { flex: 1, paddingRight: 12 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#9ec3f0', fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  crownWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownEmoji: { fontSize: 20 },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  activeBannerText: { color: '#047857', fontSize: 12, fontWeight: '600', flex: 1 },
  linkedCarsSection: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 10,
  },
  linkedCarsHeading: { fontSize: 12, fontWeight: '800', color: '#023D95', letterSpacing: 0.3 },
  linkedCarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  linkedCarIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E6F0FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedCarBody: { flex: 1 },
  linkedCarTitle: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  linkedCarName: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginTop: 1 },
  linkedCarPlate: { fontSize: 11, fontWeight: '600', color: '#475569', marginTop: 2 },
  linkedCarValid: { fontSize: 10, fontWeight: '600', color: '#047857', marginTop: 3 },
  linkedCarBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  linkedCarBadgeText: { fontSize: 9, fontWeight: '800', color: '#047857' },
  benefitsSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
  benefitsSectionPreview: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  benefitsHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#f0f4f8',
    marginBottom: 4,
    gap: 8,
  },
  benefitsHeadText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: '#8A8A8A' },
  benefitsHeadLeft: { flex: 1 },
  bRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f7fb',
  },
  bRowLast: { borderBottomWidth: 0 },
  bLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, flex: 1, paddingRight: 10 },
  bIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#E6F0FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bTextWrap: { flex: 1 },
  bTitle: { fontSize: 12, fontWeight: '700', color: '#1A1A1A', lineHeight: 16 },
  bSub: { fontSize: 9.5, color: '#9A9A9A', marginTop: 1, lineHeight: 13 },
  bRemaining: { fontSize: 9, fontWeight: '700', color: '#047857', marginTop: 3 },
  bPending: { fontSize: 9, fontWeight: '700', color: '#B45309', marginTop: 3 },
  bRightCol: { alignItems: 'flex-end', gap: 6, minWidth: 72 },
  claimPendingBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  claimPendingBadgeText: { fontSize: 10, fontWeight: '800', color: '#92400E' },
  claimUsedBadge: {
    marginTop: 6,
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  claimUsedBadgeText: { fontSize: 10, fontWeight: '800', color: '#64748B' },
  claimsLockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  claimsLockedBannerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 16,
  },
  claimBtn: {
    backgroundColor: '#004AAD',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  claimBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  claimBtnText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  claimHistorySection: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  claimHistoryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  claimHistoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  claimHistoryRowFirst: { borderTopWidth: 0, paddingTop: 0 },
  claimHistoryBenefit: { fontSize: 11, fontWeight: '700', color: '#1E293B', flex: 1 },
  claimHistoryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  claimHistoryStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  claimHistoryStatusApproved: { backgroundColor: '#DCFCE7' },
  claimHistoryStatusRejected: { backgroundColor: '#FEE2E2' },
  claimHistoryStatusPending: { backgroundColor: '#FEF3C7' },
  claimHistoryStatusText: { fontSize: 9, fontWeight: '800', color: '#334155' },
  claimHistoryMeta: { fontSize: 10, color: '#64748B', marginTop: 2 },
  claimHistoryLead: { fontSize: 9, fontWeight: '700', color: '#004AAD', marginTop: 2 },
  claimHistoryDate: { fontSize: 9, fontWeight: '600', color: '#94A3B8' },
  bValueStack: { alignItems: 'flex-end' },
  bValuePrefix: { fontSize: 9, fontWeight: '600', color: '#64748B', lineHeight: 11 },
  bValue: { fontSize: 12, fontWeight: '800', color: '#023D95' },
  bValueMuted: { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  totalBand: {
    marginHorizontal: 20,
    marginTop: 6,
    backgroundColor: '#F2F6FC',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  totalBandPreview: {
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, color: '#555', fontWeight: '600' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#023D95' },
  totalStrike: { textDecorationLine: 'line-through', color: '#C0392B' },
  saveRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#c5d6ec',
    borderStyle: 'dashed',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saveLabel: { fontSize: 13, fontWeight: '700', color: '#1f9d55' },
  saveValue: { fontSize: 18, fontWeight: '800', color: '#1f9d55' },
  priceHero: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: '#023D95',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceHeroPreview: {
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  priceHeroCompact: {
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  priceHeroRsa: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  priceHeroPriceGroupCentered: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  priceHeroLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontWeight: '600',
  },
  priceHeroLabelRsa: {
    fontSize: 9,
    letterSpacing: 0.8,
  },
  priceHeroAmount: { fontSize: 34, fontWeight: '800', color: '#fff', textAlign: 'center' },
  priceHeroAmountPreview: { fontSize: 30, lineHeight: 34 },
  priceHeroAmountCompact: { fontSize: 32, lineHeight: 36 },
  priceHeroAmountRsa: { marginTop: 4 },
  priceHeroAmountPreviewRsa: { fontSize: 22, lineHeight: 26 },
  priceHeroAmountCompactRsa: { fontSize: 24, lineHeight: 28 },
  priceHeroPeriodInline: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  priceHeroPeriodPreview: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  priceHeroPeriodStacked: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  priceHeroPeriodStackedPreview: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  priceHeroSubOnBlue: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 16,
  },
  addDetailsBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
  },
  addDetailsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDetailsTitle: { fontSize: 14, fontWeight: '800' },
  addDetailsSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  detailsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  collapseDetailsText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  detailsSection: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailsSectionPreview: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
  },
  detailsTitle: { fontSize: 13, fontWeight: '800', color: '#1A1A1A', marginBottom: 8 },
  vehicleBlock: { gap: 10 },
  vehicleBlockTitle: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 },
  vehicleHint: { fontSize: 12, color: '#64748B' },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  vehicleChipActive: { borderColor: COLORS.primary, backgroundColor: '#E6F0FB' },
  vehicleChipText: { flex: 1, fontSize: 12, color: '#334155', fontWeight: '600' },
  vehicleChipTextActive: { color: COLORS.primary },
  addVehicleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addVehicleBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  guestForm: { gap: 10 },
  otpBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  otpWhatsAppBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#25D366',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  otpWhatsAppBtnText: { fontSize: 12.5, fontWeight: '800', color: '#FFFFFF' },
  otpSmsBtnAlt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  otpSmsBtnAltText: { fontSize: 12.5, fontWeight: '800', color: COLORS.primary },
  otpVerifyBlock: { gap: 8, marginTop: 2 },
  otpSentRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  otpSentText: { flex: 1, fontSize: 11, fontWeight: '700', color: '#6B7280' },
  otpActionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  otpActionLink: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  otpActionMuted: { color: '#6B7280', fontSize: 12, fontWeight: '700' },
  otpVerifyBtn: {
    marginLeft: 'auto',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  otpVerifyBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  otpVerifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  otpVerifiedText: { color: '#059669', fontSize: 12, fontWeight: '700' },
  termsSection: {
    marginHorizontal: 20,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  termsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  termsHeaderText: { fontSize: 12, fontWeight: '800' },
  termsPoints: { marginTop: 8, gap: 6 },
  termsPointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  termsBullet: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  termsPointText: { flex: 1, fontSize: 11, color: '#64748B', lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 13,
    backgroundColor: '#fff',
    color: '#111',
  },
  addon: {
    marginHorizontal: 20,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addonPreviewCompact: {
    marginHorizontal: 16,
    alignItems: 'center',
  },
  addonActive: { borderColor: COLORS.primary, backgroundColor: '#E8F2FF' },
  addonText: { flex: 1, fontSize: 12, color: '#555', lineHeight: 16 },
  addonTextCompact: { fontSize: 11, lineHeight: 15 },
  addonDesc: { fontSize: 10, color: '#64748B', lineHeight: 14, marginTop: 2 },
  addonBold: { fontWeight: '800', color: '#023D95' },
  addonPrice: { fontWeight: '800', color: '#023D95', fontSize: 13, marginTop: 2 },
  backLink: { marginBottom: 8 },
  backLinkText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  checkoutRow: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkoutRowPreview: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  checkoutLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  checkoutAmount: { fontSize: 20, fontWeight: '800', color: '#111' },
  cta: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: '#023D95',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaAddon: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#023D95',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  addonUpgradeSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  addonUpgradeTitle: {
    marginHorizontal: 20,
    marginTop: 10,
    fontSize: 15,
    fontWeight: '800',
    color: '#023D95',
  },
  addonUpgradeSub: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 4,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  addonDoneBanner: {
    marginHorizontal: 20,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F2FF',
    borderRadius: 12,
    padding: 12,
  },
  addonDoneText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#023D95' },
  foot: {
    textAlign: 'center',
    fontSize: 9.5,
    color: '#AAA',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
    lineHeight: 14,
  },
});
