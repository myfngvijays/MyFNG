import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Platform,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  findNodeHandle,
  Switch,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { supabase } from '../lib/supabase';
import { ENV } from '../config/environment';
import { reverseGeocodeCoords } from '../lib/reverseGeocode';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicBottomNav';
import { getCustomerSessionToken, setCustomerSessionToken } from '../lib/customerSession';
import { apiFetch } from '../lib/api';
import { submitServiceBooking } from '../lib/serviceBooking';
import {
  calculateWalletUsage,
  calculateWalletUsageForServiceLines,
  fetchWalletVehicleBlocked,
  getEffectiveServiceWalletLimit,
  getWalletRules,
} from '../lib/wallet';
import {
  bookingMembershipExtraDiscountLabel,
  calculateBookingMembershipExtraDiscount,
} from '../lib/bookingMembershipDiscount';
import { isMembershipActive } from '../lib/membershipTheme';
import type { MembershipClaimRouteParams } from '../lib/membershipClaims';
import { fetchPrimeMembershipConfig, type AppMembershipPlan } from '../lib/membershipPlan';
import {
  membershipCartServiceLabel,
  membershipCartUnitPrice,
} from '../lib/membershipCart';
import {
  activatePostBookingMembership,
  quotePostBookingMembership,
} from '../lib/postBookingMembership';
import {
  formatOfferCountdown,
  membershipOfferCardTitle,
  membershipOfferFomoMessage,
  resolveMembershipOfferExpiresAt,
} from '../lib/postBookingMembershipOffer';
import {
  DEFAULT_POST_BOOKING_MEMBERSHIP_APP_CONFIG,
  fetchPostBookingMembershipAppConfig,
  type PostBookingMembershipAppConfig,
} from '../lib/postBookingMembershipAppConfig';
import { WelcomeBonusCreditedModal } from '../components/WelcomeBonusModal';
import {
  AuthVerifyResponse,
  decideWelcomeCreditedPopup,
  getWelcomeBonusAmount,
  markWelcomeCreditedPopupShown,
} from '../lib/welcomeBonus';
import {
  shouldSkipFirebaseSmsOnSimulator,
  isDevSimulator,
  isFirebaseIosClientError,
  firebaseTestOtpHint,
} from '../lib/firebasePhoneAuth';
import { sendSmsOtp, verifySmsOtp } from '../lib/backendSmsOtp';
import { countLiveBookingCart, notifyCartBadgeCountChanged } from '../lib/cartBadgeCount';
import { BookingDraft, saveBookingDraft, removeBookingDraft } from '../lib/bookingDraft';
import { fetchServicePriceForBooking } from '../lib/servicePricing';
import VehicleImage from '../components/VehicleImage';
import { trackEvent } from '../lib/trackEvent';

const SERVICE_ICON_BASE = 'https://myfng.in';
function getCategoryIconUrl(category: string): string {
  const c = category.toUpperCase();
  if (c.includes('PERIODIC')) return `${SERVICE_ICON_BASE}/icon-periodic-service.png`;
  if (c.includes('AC')) return `${SERVICE_ICON_BASE}/icon-ac-service.png`;
  if (c.includes('BATTERY') && !c.includes('ELECTRICAL')) return `${SERVICE_ICON_BASE}/icon-battery-service.png`;
  if (c.includes('BRAKE')) return `${SERVICE_ICON_BASE}/icon-brake-service.png`;
  if (c.includes('CLUTCH')) return `${SERVICE_ICON_BASE}/icon-clutch-service.png`;
  if (c.includes('DENTING') || c.includes('PAINTING')) return `${SERVICE_ICON_BASE}/icon-denting-service.png`;
  if (c.includes('DETAILING')) return `${SERVICE_ICON_BASE}/icon-detailing-service.png`;
  if (c.includes('ENGINE')) return `${SERVICE_ICON_BASE}/icon-engine-service.png`;
  if (c.includes('TYRE') || c.includes('WHEEL')) return `${SERVICE_ICON_BASE}/icon-tyre-service.png`;
  if (c.includes('ELECTRICAL')) return `${SERVICE_ICON_BASE}/icon-electrical-service.png`;
  if (c.includes('SUSPENSION') || c.includes('STEERING')) return `${SERVICE_ICON_BASE}/icon-suspension-service.png`;
  return '';
}

type Props = { navigation: any; route?: any };

type CityRow = { id: string; name: string; state?: string | null; zone_id?: string | null; city_pincodes?: string | null };
type CarModelRow = { id: string; make: string; model_name: string; variant?: string | null; class?: string | null };
type ServiceTypeRow = {
  id: string;
  name: string;
  description?: string | null;
  category_uuid?: string | null;
  category?: string;
  points?: number;
};
type WorkshopRow = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
};
type SavedAddress = {
  id: string;
  label?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  landmark?: string | null;
  address_type?: string | null;
};

function normalizeSavedAddressKey(parts: {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  pincode?: string | null;
  landmark?: string | null;
}) {
  return [parts.address_line1, parts.address_line2, parts.landmark, parts.city, parts.pincode]
    .map((v) => String(v || '').trim().toLowerCase())
    .filter(Boolean)
    .join('|');
}

function dedupeSavedAddresses(addresses: SavedAddress[]): SavedAddress[] {
  const seen = new Set<string>();
  return addresses.filter((addr) => {
    const key = normalizeSavedAddressKey(addr);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type BookingFormData = {
  city: CityRow | null;
  carModel: CarModelRow | null;
  customerName: string;
  customerPhone: string;
  vehicleNumber: string;
  selectedServices: string[];
  pickupRequired: boolean;
  selectedWorkshop: WorkshopRow | null;
  pickupDate: string;
  pickupTime: string;
  pickupAddress: string;
  flatNumber: string;
  landmark: string;
  paymentMethod: 'PAY_LATER' | 'PAY_NOW';
};

function formatCar(m: CarModelRow) {
  const v = m.variant ? ` ${m.variant}` : '';
  return `${m.make} ${m.model_name}${v}`.trim();
}


function inr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function getIndiaDate(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 3600000);
}

function formatDateYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDMY(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateDMShort(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const dt = new Date(dateStr + 'T00:00:00');
    const day = dt.getDate();
    const month = dt.toLocaleString('en-US', { month: 'short' });
    return `${day} ${month}`;
  } catch {
    return '';
  }
}

const TIME_SLOTS = Array.from({ length: 6 }, (_, i) => {
  const hour = 10 + i;
  const time24 = `${String(hour).padStart(2, '0')}:00`;
  const nextHour = hour + 1;
  const startH = hour === 12 ? 12 : hour > 12 ? hour - 12 : hour;
  const startSuffix = hour >= 12 ? 'PM' : 'AM';
  const endH = nextHour === 12 ? 12 : nextHour > 12 ? nextHour - 12 : nextHour;
  const endSuffix = nextHour >= 12 ? 'PM' : 'AM';
  return {
    value: time24,
    label: `${startH} ${startSuffix} - ${endH} ${endSuffix}`,
  };
});

function getIndiaNowMinutes(): number {
  const d = getIndiaDate();
  return d.getHours() * 60 + d.getMinutes();
}

function isTimeSlotPastForDate(slotValue: string, pickupDate: string, todayYmd: string): boolean {
  if (!pickupDate || pickupDate !== todayYmd) return false;
  const hour = Number(String(slotValue).split(':')[0]);
  if (!Number.isFinite(hour)) return false;
  const slotEndMinutes = (hour + 1) * 60;
  return getIndiaNowMinutes() >= slotEndMinutes;
}

function isTodayBookingClosed(
  todayYmd: string,
  slots: Array<{ value: string; label: string }> = TIME_SLOTS,
): boolean {
  if (slots.length === 0) return true;
  return !slots.some((slot) => !isTimeSlotPastForDate(slot.value, todayYmd, todayYmd));
}

export default function PublicBookServiceNowScreen({ navigation, route }: Props) {
  const paramServiceCategory = route?.params?.serviceCategory;
  const paramSelectedServiceId = route?.params?.selectedServiceId;
  const membershipClaim: MembershipClaimRouteParams | null = route?.params?.membershipClaim ?? null;
  const resumeDraft: BookingDraft | null = route?.params?.resumeDraft ?? null;
  const [draftId] = useState(() => resumeDraft?.id || `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [step, setStep] = useState(resumeDraft?.step || 0);
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const scrollToInput = (reactNode: any) => {
    if (scrollRef.current && reactNode) {
      setTimeout(() => {
        (scrollRef.current as any)?.scrollResponderScrollNativeHandleToKeyboard?.(
          findNodeHandle(reactNode), 150, true
        );
      }, 300);
    }
  };

  const [form, setForm] = useState<BookingFormData>(() => {
    const base: BookingFormData = {
      city: null,
      carModel: null,
      customerName: '',
      customerPhone: '',
      vehicleNumber: '',
      selectedServices: [],
      pickupRequired: true,
      selectedWorkshop: null,
      pickupDate: '',
      pickupTime: '',
      pickupAddress: '',
      flatNumber: '',
      landmark: '',
      paymentMethod: 'PAY_LATER',
    };
    if (resumeDraft) {
      return {
        ...base,
        city: resumeDraft.city as any || null,
        carModel: resumeDraft.carModel as any || null,
        customerName: resumeDraft.customerName || '',
        customerPhone: resumeDraft.customerPhone || '',
        vehicleNumber: resumeDraft.vehicleNumber || '',
        selectedServices: resumeDraft.selectedServices || [],
        pickupRequired: resumeDraft.pickupRequired ?? true,
        pickupDate: resumeDraft.pickupDate || '',
        pickupTime: resumeDraft.pickupTime || '',
        pickupAddress: resumeDraft.pickupAddress || '',
        paymentMethod: (resumeDraft.paymentMethod as any) || 'PAY_LATER',
      };
    }
    return base;
  });

  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [cityModal, setCityModal] = useState(false);
  const [locationDetecting, setLocationDetecting] = useState(false);
  const [detectedCityNotServiceable, setDetectedCityNotServiceable] = useState<string | null>(null);

  const [carQuery, setCarQuery] = useState(() => {
    if (resumeDraft?.carModel) return `${resumeDraft.carModel.make} ${resumeDraft.carModel.model_name}`;
    return '';
  });
  const [carSuggestions, setCarSuggestions] = useState<CarModelRow[]>([]);
  const [showCarSuggestions, setShowCarSuggestions] = useState(false);
  const [rebookServiceIds, setRebookServiceIds] = useState<string[]>([]);

  const [serviceTypes, setServiceTypes] = useState<ServiceTypeRow[]>([]);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(resumeDraft?.selectedCategory || '');
  const [selectedOilType, setSelectedOilType] = useState<'semi' | 'full'>('semi');
  const [pricing, setPricing] = useState<Record<string, number>>(() => {
    const snapshot = resumeDraft?.pricingSnapshot;
    if (snapshot && Object.keys(snapshot).length > 0) return { ...snapshot };
    const saved = resumeDraft?.servicePrices;
    if (saved && Object.keys(saved).length > 0) return { ...saved };
    return {};
  });
  const [pricingLoading, setPricingLoading] = useState(false);
  const [servicePoints, setServicePoints] = useState<Record<string, number>>({});

  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMeta, setCouponMeta] = useState<any | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);

  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);
  const [workshopLoading, setWorkshopLoading] = useState(false);
  const [workshopModal, setWorkshopModal] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentMembership, setCurrentMembership] = useState<any>(null);
  const [primeMembershipPlan, setPrimeMembershipPlan] = useState<AppMembershipPlan | null>(null);
  const [includeBookingMembership, setIncludeBookingMembership] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWalletForBooking, setUseWalletForBooking] = useState(true);
  const [walletVehicleBlocked, setWalletVehicleBlocked] = useState(false);
  const [walletBlockReason, setWalletBlockReason] = useState<string | null>(null);
  const [savedVehicles, setSavedVehicles] = useState<any[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [addressDetecting, setAddressDetecting] = useState(false);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddrForm, setNewAddrForm] = useState<{ label: 'Home' | 'Work' | 'Other'; line1: string; line2: string; city: string; pincode: string }>({ label: 'Home', line1: '', line2: '', city: '', pincode: '' });
  const [newAddrLocating, setNewAddrLocating] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [otpChannel, setOtpChannel] = useState<'sms' | 'whatsapp'>('whatsapp');
  const [otpValue, setOtpValue] = useState('');
  const [otpConfirmation, setOtpConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [creditedWelcomeVisible, setCreditedWelcomeVisible] = useState(false);
  const [creditedWelcomeAmount, setCreditedWelcomeAmount] = useState(getWelcomeBonusAmount());
  const pendingStepAdvanceRef = useRef(false);
  const pendingWelcomeCustomerIdRef = useRef<string | null>(null);
  const pendingWelcomePhoneRef = useRef<string | null>(null);
  const bookingCompletedRef = useRef(false);
  const selectedSavedAddressIdRef = useRef(selectedSavedAddressId);
  selectedSavedAddressIdRef.current = selectedSavedAddressId;
  const formRef = useRef(form);
  const pricingRef = useRef(pricing);
  const stepRef = useRef(step);
  const selectedCategoryRef = useRef(selectedCategory);
  const serviceTypesRef = useRef(serviceTypes);
  const sessionPricingFetchedRef = useRef(false);
  const prevCityCarRef = useRef<{ cityId?: string; carId?: string }>({
    cityId: resumeDraft?.city?.id,
    carId: resumeDraft?.carModel?.id,
  });
  const cartBadgeScale = useRef(new Animated.Value(1)).current;
  const servicesCartYOffset = useRef(0);
  const paymentCartYOffset = useRef(0);

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [serviceChecklists, setServiceChecklists] = useState<
    Record<string, Array<{ name: string; category?: string }>>
  >({});
  const [detailsService, setDetailsService] = useState<ServiceTypeRow | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<{
    leadNumber: string;
    leadId: string;
    serviceSubtotal: number;
    title: string;
    message: string;
    isPaid: boolean;
    membershipActivated?: boolean;
    membershipOfferExpiresAt?: string;
  } | null>(null);
  const [membershipActivating, setMembershipActivating] = useState(false);
  const [successCountdownTick, setSuccessCountdownTick] = useState(0);
  const [postBookingAppConfig, setPostBookingAppConfig] = useState<PostBookingMembershipAppConfig>(
    DEFAULT_POST_BOOKING_MEMBERSHIP_APP_CONFIG,
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of serviceTypes) {
      if (s.category) set.add(s.category);
    }
    const arr = Array.from(set);
    const order = ['PERIODIC', 'ENGINE', 'AC', 'BATTERY', 'BRAKE', 'CLUTCH', 'TYRE', 'WHEEL', 'DETAILING', 'DENTING', 'PAINTING', 'ELECTRICAL', 'SUSPENSION', 'STEERING'];
    arr.sort((a, b) => {
      const ai = order.findIndex((k) => a.toUpperCase().includes(k));
      const bi = order.findIndex((k) => b.toUpperCase().includes(k));
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    return arr.length ? arr : [];
  }, [serviceTypes]);

  // Show all categories; put the pre-selected / active category first.
  const orderedCategories = useMemo(() => {
    if (categories.length <= 1) return categories;

    const keyword = String(paramServiceCategory || '').trim().toUpperCase();
    const preferred = selectedCategory
      || (keyword ? categories.find((c) => c.toUpperCase().includes(keyword)) : undefined)
      || categories[0];

    const rest = categories.filter((c) => c !== preferred);
    return [preferred, ...rest];
  }, [categories, paramServiceCategory, selectedCategory]);

  const formatOilTypeLabel = (oilType: 'semi' | 'full') =>
    oilType === 'full' ? 'Fully Synthetic' : 'Semi Synthetic';

  const getOilTypeForService = (service: any): 'semi' | 'full' | 'unknown' => {
    const text = `${String(service?.name || '')} ${String(service?.description || '')}`.toLowerCase();
    const hasSemi =
      text.includes('semi synthetic') || text.includes('semi-synthetic') || text.includes('(semi)') || /\bsemi\b/.test(text);
    const hasFull =
      text.includes('fully synthetic') || text.includes('full synthetic') || text.includes('synthetic full') ||
      text.includes('(fully)') || text.includes('(full)') || /\bfully\b/.test(text) || /\bfull\b/.test(text);
    if (hasSemi && hasFull) return 'unknown';
    if (hasFull) return 'full';
    if (hasSemi) return 'semi';
    return 'unknown';
  };

  const selectedServiceLabels = useMemo(() => {
    return form.selectedServices
      .map((id) => {
        const service = serviceTypes.find((s) => s.id === id);
        if (!service?.name) return null;

        const isPeriodicService =
          String(service.category || '').toUpperCase().includes('PERIODIC') ||
          String(service.name || '').toUpperCase().includes('PERIODIC');

        if (!isPeriodicService) return service.name;

        const oilInName = getOilTypeForService(service);
        if (oilInName !== 'unknown') return service.name;

        return `${service.name} (${formatOilTypeLabel(selectedOilType)})`;
      })
      .filter(Boolean) as string[];
  }, [form.selectedServices, serviceTypes, selectedOilType]);

  const summaryPickupAddress = useMemo(() => {
    const parts: string[] = [];
    if (form.flatNumber.trim()) parts.push(form.flatNumber.trim());
    if (form.pickupAddress.trim()) parts.push(form.pickupAddress.trim());
    if (form.landmark.trim()) parts.push(form.landmark.trim());
    return parts.join(', ');
  }, [form.flatNumber, form.pickupAddress, form.landmark]);

  const isPeriodicCategory = useMemo(
    () => String(selectedCategory || '').toUpperCase().includes('PERIODIC'),
    [selectedCategory],
  );

  const servicesInCategory = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    return serviceTypes
      .filter((s) => s.category === selectedCategory)
      .filter((s) => (q ? s.name.toLowerCase().includes(q) : true))
      .filter((s) => {
        if (!isPeriodicCategory) return true;
        const oilType = getOilTypeForService(s);
        if (oilType === 'unknown') return true;
        return oilType === selectedOilType;
      });
  }, [serviceTypes, selectedCategory, serviceSearch, isPeriodicCategory, selectedOilType]);

  const totalPrice = useMemo(() => {
    return form.selectedServices.reduce((sum, id) => sum + (pricing[id] || 0), 0);
  }, [form.selectedServices, pricing]);

  const hasActiveMembership = isMembershipActive(currentMembership);

  const membershipLinePrice = useMemo(() => {
    if (!includeBookingMembership || hasActiveMembership || !primeMembershipPlan) return 0;
    return membershipCartUnitPrice(primeMembershipPlan);
  }, [includeBookingMembership, hasActiveMembership, primeMembershipPlan]);

  const membershipBundleDiscount = useMemo(
    () =>
      calculateBookingMembershipExtraDiscount(totalPrice, {
        includeMembership: includeBookingMembership && Boolean(primeMembershipPlan),
        hasActiveMembership,
      }),
    [totalPrice, includeBookingMembership, hasActiveMembership, primeMembershipPlan],
  );

  const bookingCartSubtotal = totalPrice + membershipLinePrice;

  const selectedBookingCartItems = useMemo(() => {
    return form.selectedServices.map((serviceId) => {
      const service = serviceTypes.find((s) => s.id === serviceId);
      const price = pricing[serviceId] || 0;
      const category = String(service?.category || service?.name || 'Service');
      const effectivePrice =
        membershipBundleDiscount > 0 && totalPrice > 0
          ? Math.max(
              0,
              Math.round((price - membershipBundleDiscount * (price / totalPrice)) * 100) / 100,
            )
          : price;
      return {
        key: serviceId,
        type: 'service' as const,
        name: service?.name || 'Service',
        price,
        effectivePrice,
        iconUrl: getCategoryIconUrl(category),
      };
    });
  }, [form.selectedServices, pricing, serviceTypes, membershipBundleDiscount, totalPrice]);

  const membershipCartItem = useMemo(() => {
    if (!includeBookingMembership || hasActiveMembership || !primeMembershipPlan) return null;
    return {
      key: 'membership',
      type: 'membership' as const,
      name: membershipCartServiceLabel(primeMembershipPlan, false),
      price: membershipLinePrice,
      originalPrice:
        primeMembershipPlan.originalPriceNum > 0 ? primeMembershipPlan.originalPriceNum : 0,
    };
  }, [includeBookingMembership, hasActiveMembership, primeMembershipPlan, membershipLinePrice]);

  const serviceItemsForCoupon = useMemo(() => {
    return form.selectedServices.map((serviceId) => {
      const service = serviceTypes.find((s) => s.id === serviceId);
      return {
        service_type_id: serviceId,
        label: service?.name || null,
        price: pricing[serviceId] || 0,
      };
    });
  }, [form.selectedServices, pricing, serviceTypes]);

  const couponAdjustedTotal = Math.max(
    bookingCartSubtotal - membershipBundleDiscount - (couponDiscount || 0),
    0,
  );
  const payableBeforeWallet = couponAdjustedTotal;

  const walletServiceLines = useMemo(() => {
    const lines = serviceItemsForCoupon.map((item) => ({
      service_type_id: item.service_type_id,
      amount: Math.max(0, Number(item.price || 0)),
    }));
    const totalServiceDiscounts = membershipBundleDiscount + (couponDiscount || 0);
    if (totalServiceDiscounts <= 0 || totalPrice <= 0) return lines;
    return lines.map((line) => ({
      ...line,
      amount: Math.max(
        0,
        Math.round((line.amount - totalServiceDiscounts * (line.amount / totalPrice)) * 100) / 100,
      ),
    }));
  }, [serviceItemsForCoupon, membershipBundleDiscount, couponDiscount, totalPrice]);

  const walletMaxUsable = useMemo(() => {
    if (walletServiceLines.length > 0) {
      return calculateWalletUsageForServiceLines(
        walletServiceLines,
        Number(walletBalance || 0),
        walletVehicleBlocked,
      );
    }
    return calculateWalletUsage(
      payableBeforeWallet,
      Number(walletBalance || 0),
      'SERVICE',
      walletVehicleBlocked,
    );
  }, [walletServiceLines, payableBeforeWallet, walletBalance, walletVehicleBlocked]);

  const walletHintLabel = useMemo(() => {
    const rules = getWalletRules();
    if (!rules.advanced_enabled || walletServiceLines.length === 0) {
      return getEffectiveServiceWalletLimit(undefined, rules);
    }
    if (walletServiceLines.length > 1) {
      const limits = walletServiceLines.map((line) => getEffectiveServiceWalletLimit(line.service_type_id, rules));
      const unique = Array.from(new Set(limits));
      return unique.length === 1 ? unique[0] : `${unique.join(' / ')} (varies)`;
    }
    return getEffectiveServiceWalletLimit(walletServiceLines[0]?.service_type_id, rules);
  }, [walletServiceLines]);

  const walletUsed = useMemo(() => {
    if (!useWalletForBooking || !isLoggedIn || walletVehicleBlocked) return 0;
    return walletMaxUsable;
  }, [useWalletForBooking, isLoggedIn, walletVehicleBlocked, walletMaxUsable]);

  const finalPayableAmount = Math.max(0, payableBeforeWallet - walletUsed);

  const postBookingMembershipQuote = useMemo(
    () => quotePostBookingMembership(bookingSuccess?.serviceSubtotal || 0, primeMembershipPlan),
    [bookingSuccess?.serviceSubtotal, primeMembershipPlan],
  );

  useEffect(() => {
    fetchPostBookingMembershipAppConfig()
      .then(setPostBookingAppConfig)
      .catch(() => {});
  }, []);

  void successCountdownTick;
  const showPostBookingMembershipOffer = Boolean(
    bookingSuccess &&
      postBookingAppConfig.enabled &&
      postBookingAppConfig.show_on_booking_success &&
      !bookingSuccess.membershipActivated &&
      !hasActiveMembership &&
      isLoggedIn &&
      primeMembershipPlan &&
      postBookingMembershipQuote &&
      postBookingMembershipQuote.payable > 0 &&
      bookingSuccess.membershipOfferExpiresAt &&
      new Date(bookingSuccess.membershipOfferExpiresAt).getTime() > Date.now(),
  );

  useEffect(() => {
    if (!bookingSuccess || bookingSuccess.membershipActivated) return;
    const timer = setInterval(() => setSuccessCountdownTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [bookingSuccess?.leadId, bookingSuccess?.membershipActivated]);

  const prevServicesKeyRef = useRef<string>('');
  const prevServiceCountRef = useRef(form.selectedServices.length);
  useEffect(() => {
    const key = [...form.selectedServices].sort().join('|');
    // Only clear an applied coupon when the selected services actually change
    // (not when the coupon itself is applied).
    if (prevServicesKeyRef.current && prevServicesKeyRef.current !== key && couponMeta) {
      setCouponMeta(null);
      setCouponDiscount(0);
      setCouponError('Coupon cleared. Please re-apply after changing services.');
    }
    prevServicesKeyRef.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.selectedServices]);

  useEffect(() => {
    const prevCount = prevServiceCountRef.current;
    const nextCount = form.selectedServices.length;
    prevServiceCountRef.current = nextCount;
    if (hasActiveMembership || !primeMembershipPlan) return;
    if (nextCount > prevCount && nextCount > 0) {
      setIncludeBookingMembership(true);
    }
  }, [form.selectedServices.length, hasActiveMembership, primeMembershipPlan]);

  const cartServiceCount = countLiveBookingCart(
    form.selectedServices,
    includeBookingMembership,
    Boolean(primeMembershipPlan),
  );

  useEffect(() => {
    if (cartServiceCount <= 0) return;
    cartBadgeScale.setValue(0.55);
    Animated.spring(cartBadgeScale, {
      toValue: 1,
      friction: 4,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [cartServiceCount, cartBadgeScale]);

  const steps = [
    { title: "Let's get started!", subtitle: 'Select your location and car model' },
    { title: 'Almost there!', subtitle: 'Just a few more details' },
    { title: 'Choose your services', subtitle: 'Select services with transparent pricing' },
    { title: 'Pickup Details', subtitle: 'When and where should we pick up your vehicle?' },
    { title: 'Payment Options', subtitle: 'Choose your preferred payment method' },
  ];
  const DETAILS_STEP = 1;

  const getNextStep = (current: number, loggedIn: boolean) => {
    if (current === 0 && loggedIn) return 2;
    if (current < steps.length - 1) return current + 1;
    return current;
  };

  const getPrevStep = (current: number, loggedIn: boolean) => {
    if (current === 2 && loggedIn) return 0;
    return Math.max(0, current - 1);
  };

  const getVisibleStepCount = (loggedIn: boolean) => (loggedIn ? steps.length - 1 : steps.length);

  const getVisibleStepIndex = (current: number, loggedIn: boolean) => {
    if (!loggedIn) return current;
    if (current <= 0) return 0;
    return current - 1;
  };

  const goStep = (next: number) => {
    setStep(next);
    trackEvent('booking_step_viewed', { step: next });
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    persistBookingSession(next);
  };

  const persistBookingSession = useCallback((currentStep?: number) => {
    if (bookingCompletedRef.current) return;
    const liveForm = formRef.current;
    const livePricing = pricingRef.current;
    const liveStep = currentStep ?? stepRef.current;
    const liveCategory = selectedCategoryRef.current;
    const liveServiceTypes = serviceTypesRef.current;

    if (!liveForm.city && !liveForm.carModel && liveForm.selectedServices.length === 0) return;

    const serviceNames: Record<string, string> = {};
    const servicePrices: Record<string, number> = {};
    for (const sid of liveForm.selectedServices) {
      const svc = liveServiceTypes.find((s) => s.id === sid);
      if (svc) serviceNames[sid] = svc.name;
      if (livePricing[sid]) servicePrices[sid] = livePricing[sid];
    }

    const draft: BookingDraft = {
      id: draftId,
      step: liveStep,
      createdAt: resumeDraft?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      city: liveForm.city
        ? { id: liveForm.city.id, name: liveForm.city.name, zone_id: liveForm.city.zone_id || undefined }
        : null,
      carModel: liveForm.carModel
        ? {
            id: liveForm.carModel.id,
            make: liveForm.carModel.make,
            model_name: liveForm.carModel.model_name,
            variant: liveForm.carModel.variant,
            class: liveForm.carModel.class,
          }
        : null,
      customerName: liveForm.customerName || undefined,
      customerPhone: liveForm.customerPhone || undefined,
      selectedCategory: liveCategory,
      selectedServices: liveForm.selectedServices,
      serviceNames,
      servicePrices,
      pricingSnapshot: Object.keys(livePricing).length > 0 ? { ...livePricing } : undefined,
      pickupRequired: liveForm.pickupRequired,
      pickupDate: liveForm.pickupDate || undefined,
      pickupTime: liveForm.pickupTime || undefined,
      pickupAddress: liveForm.pickupAddress || undefined,
      vehicleNumber: liveForm.vehicleNumber || undefined,
      paymentMethod: liveForm.paymentMethod || undefined,
    };
    saveBookingDraft(draft);
    notifyCartBadgeCountChanged();
  }, [draftId, resumeDraft?.createdAt]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    pricingRef.current = pricing;
  }, [pricing]);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    selectedCategoryRef.current = selectedCategory;
  }, [selectedCategory]);
  useEffect(() => {
    serviceTypesRef.current = serviceTypes;
  }, [serviceTypes]);

  useEffect(() => {
    const prev = prevCityCarRef.current;
    const nextCityId = form.city?.id;
    const nextCarId = form.carModel?.id;
    if (prev.cityId !== nextCityId || prev.carId !== nextCarId) {
      if (prev.cityId || prev.carId) {
        setPricing({});
        sessionPricingFetchedRef.current = false;
      }
      prevCityCarRef.current = { cityId: nextCityId, carId: nextCarId };
    }
  }, [form.city?.id, form.carModel?.id]);

  useEffect(() => {
    if (bookingCompletedRef.current) return;
    const timer = setTimeout(() => persistBookingSession(), 300);
    return () => clearTimeout(timer);
  }, [
    step,
    form.city?.id,
    form.carModel?.id,
    form.selectedServices.join('|'),
    form.customerPhone,
    form.pickupDate,
    form.pickupTime,
    form.pickupAddress,
    form.vehicleNumber,
    form.pickupRequired,
    selectedCategory,
    pricing,
    persistBookingSession,
  ]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        persistBookingSession();
      };
    }, [persistBookingSession]),
  );

  // ── Data Fetching ───────────────────────────────────────────────

  async function fetchCities() {
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('id,name,state,zone_id,is_active,city_pincodes')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setCities((data as any[]) || []);
      return (data as CityRow[]) || [];
    } catch {
      const fallback: CityRow[] = [
        { id: '1', name: 'Mumbai', state: 'Maharashtra' },
        { id: '2', name: 'Pune', state: 'Maharashtra' },
        { id: '3', name: 'Bangalore', state: 'Karnataka' },
        { id: '4', name: 'Delhi', state: 'Delhi' },
      ];
      setCities(fallback);
      return fallback;
    }
  }

  const autoDetectLocation = useCallback(async (cityList?: CityRow[]) => {
    const list = cityList && cityList.length > 0 ? cityList : cities;
    if (list.length === 0) return;
    setLocationDetecting(true);
    setDetectedCityNotServiceable(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationDetecting(false);
        Alert.alert('Permission denied', 'Location permission is needed to auto-detect your city.');
        return;
      }
      const last = await Location.getLastKnownPositionAsync();
      const loc = last || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&zoom=14&addressdetails=1`,
        { headers: { 'User-Agent': 'MyFNG-App/1.0' } }
      );
      if (response.ok) {
        const data = await response.json();
        const addr = data?.address || {};
        const detectedCity = addr.city || addr.town || addr.state_district || addr.county || addr.village || '';
        const displayLocation = [
          addr.suburb || addr.neighbourhood || addr.village || '',
          addr.city || addr.town || addr.state_district || '',
        ].filter(Boolean).join(', ') || detectedCity;
        if (detectedCity) {
          const normalised = detectedCity.toLowerCase();
          const districtNorm = (addr.state_district || '').toLowerCase();
          const pincode = (addr.postcode || '').replace(/\D/g, '').trim();
          let match = list.find(
            (c) => {
              const cn = c.name.toLowerCase();
              return cn === normalised ||
                cn.includes(normalised) ||
                normalised.includes(cn) ||
                (districtNorm && (cn === districtNorm || cn.includes(districtNorm) || districtNorm.includes(cn)));
            }
          );
          if (!match && pincode.length === 6) {
            match = list.find(
              (c) => c.city_pincodes && c.city_pincodes.includes(pincode)
            );
          }
          if (match) {
            setForm((p) => ({ ...p, city: match }));
            setDetectedCityNotServiceable(null);
            trackEvent('booking_city_detected');
          } else {
            setDetectedCityNotServiceable(displayLocation || detectedCity);
          }
        } else {
          setDetectedCityNotServiceable('your area');
        }
      }
    } catch {
      Alert.alert('Detection failed', 'Unable to detect your location. Please select city manually.');
    } finally {
      setLocationDetecting(false);
    }
  }, [cities]);

  const autoDetectAddress = useCallback(async () => {
    setAddressDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is needed to auto-detect address.');
        setAddressDetecting(false);
        return;
      }
      const last = await Location.getLastKnownPositionAsync();
      const loc = last || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const parsed = await reverseGeocodeCoords(loc.coords.latitude, loc.coords.longitude);
      const parts = [parsed.building, parsed.nearbyArea, parsed.city, parsed.pincode].filter(Boolean);
      if (parts.length > 0) {
        setForm((p) => ({
          ...p,
          pickupAddress: parts.join(', '),
          flatNumber: parsed.building || p.flatNumber,
          landmark: parsed.nearbyArea || p.landmark,
        }));
        setSelectedSavedAddressId(null);
      }
    } catch {
      Alert.alert('Error', 'Could not detect address. Please enter manually.');
    } finally {
      setAddressDetecting(false);
    }
  }, []);

  const fetchNewAddrLocation = useCallback(async () => {
    setNewAddrLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is needed.');
        return;
      }
      let position = await Location.getLastKnownPositionAsync().catch(() => null);
      if (!position) {
        position = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
        ]).catch(() => null);
      }
      if (!position) {
        Alert.alert('Location', 'Could not fetch location. Try again.');
        return;
      }
      const { latitude, longitude } = (position as any).coords;
      const parsed = await reverseGeocodeCoords(latitude, longitude);
      setNewAddrForm((prev) => ({
        ...prev,
        line1: parsed.building,
        line2: parsed.nearbyArea,
        city: parsed.city,
        pincode: parsed.pincode,
      }));
    } catch {
      Alert.alert('Location', 'Unable to fetch. Enter manually.');
    } finally {
      setNewAddrLocating(false);
    }
  }, []);

  const saveNewAddress = useCallback(() => {
    const line1 = newAddrForm.line1.trim();
    const line2 = newAddrForm.line2.trim();
    const city = newAddrForm.city.trim();
    const pincode = newAddrForm.pincode.trim();
    if (!line1) {
      Alert.alert('Address', 'Please enter Flat / House / Building (Address Line 1).');
      return;
    }
    if (!line2 && !city) {
      Alert.alert('Address', 'Please enter area/street or city.');
      return;
    }
    const fullAddress = [line1, line2, city, pincode].filter(Boolean).join(', ');
    setForm((p) => ({ ...p, pickupAddress: fullAddress, flatNumber: line1, landmark: line2 || city }));
    setSelectedSavedAddressId(null);
    setShowNewAddressForm(false);
    setNewAddrForm({ label: 'Home', line1: '', line2: '', city: '', pincode: '' });
  }, [newAddrForm]);

  async function resolveCarModelForRebook(
    make: string,
    model: string,
    fuelType?: string | null,
  ): Promise<CarModelRow | null> {
    try {
      const { data, error } = await supabase
        .from('car_models')
        .select('id,make,model_name,variant,class')
        .eq('is_active', true)
        .ilike('make', make)
        .ilike('model_name', `%${model}%`)
        .order('model_name')
        .limit(30);
      if (error || !data?.length) return null;
      const rows = data as CarModelRow[];
      const exact = rows.find((row) => row.model_name.toLowerCase() === model.toLowerCase());
      if (exact) return exact;
      if (fuelType) {
        const byFuel = rows.find((row) =>
          String(row.variant || '').toLowerCase().includes(String(fuelType).toLowerCase()),
        );
        if (byFuel) return byFuel;
      }
      return rows[0] || null;
    } catch {
      return null;
    }
  }

  function parseRebookServiceIds(input: unknown): string[] {
    if (!input) return [];
    if (Array.isArray(input)) return input.map((v) => String(v || '').trim()).filter(Boolean);
    const raw = String(input || '').trim();
    if (!raw) return [];
    try {
      if (raw.startsWith('[') && raw.endsWith(']')) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v || '').trim()).filter(Boolean);
      }
    } catch {
      // ignore
    }
    return raw.split(',').map((v) => v.trim()).filter(Boolean);
  }

  async function searchCarModels(q: string) {
    const query = q.trim();
    if (query.length < 2) {
      setCarSuggestions([]);
      return;
    }
    try {
      const safe = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const tokens = safe.split(' ').filter(Boolean);
      // Build an OR filter that matches the make OR model on every token so
      // multi-word queries like "skoda rapid" and single brand queries both work.
      const orFilters: string[] = [`make.ilike.%${safe}%`, `model_name.ilike.%${safe}%`];
      for (const t of tokens) {
        orFilters.push(`make.ilike.%${t}%`);
        orFilters.push(`model_name.ilike.%${t}%`);
      }
      const { data, error } = await supabase
        .from('car_models')
        .select('id,make,model_name,variant,class')
        .eq('is_active', true)
        .or(orFilters.join(','))
        .order('make')
        .order('model_name')
        .limit(100);
      if (error) throw error;
      setCarSuggestions(((data as any[]) || []) as any);
    } catch {
      setCarSuggestions([]);
    }
  }

  async function fetchServiceTypes() {
    if (!form.city || !form.carModel) return;
    setServiceLoading(true);
    try {
      const { data: catRows } = await supabase
        .from('categories')
        .select('uuid, category, category_icon')
        .order('category');

      const categoryMap: Record<string, string> = {};
      ((catRows as any[]) || []).forEach((c: any) => {
        if (c.uuid && c.category) {
          categoryMap[c.uuid] = c.category.toUpperCase();
        }
      });

      const { data, error } = await supabase
        .from('service_types')
        .select('id,name,description,is_active,category_uuid')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;

      const enriched: ServiceTypeRow[] = ((data as any[]) || []).map((s: any) => ({
        ...s,
        category: s.category_uuid ? categoryMap[s.category_uuid] || 'OTHER SERVICES' : 'OTHER SERVICES',
      }));

      setServiceTypes(enriched);

      const ids = enriched.map((s) => s.id).filter(Boolean);
      if (ids.length > 0) {
        try {
          const { data: tplRows } = await supabase
            .from('service_type_checklist_templates')
            .select('service_type_id, points, checklist_items')
            .in('service_type_id', ids);
          if (tplRows) {
            const pts: Record<string, number> = {};
            const lists: Record<string, Array<{ name: string; category?: string }>> = {};
            (tplRows as any[]).forEach((r: any) => {
              if (r.service_type_id) {
                if (typeof r.points === 'number') pts[r.service_type_id] = r.points;
                if (Array.isArray(r.checklist_items)) {
                  const items = r.checklist_items
                    .map((it: any) => {
                      if (!it) return null;
                      if (typeof it === 'string') return { name: it, category: 'General' };
                      const name = String(it?.name || it?.title || it?.label || '').trim();
                      if (!name) return null;
                      const category = String(it?.category || 'General').trim() || 'General';
                      return { name, category };
                    })
                    .filter(Boolean);
                  if (items.length > 0) lists[r.service_type_id] = items;
                }
              }
            });
            setServicePoints(pts);
            setServiceChecklists(lists);
          }
        } catch {
          // checklist templates table might not exist yet
        }
      }
    } catch {
      setServiceTypes([]);
    } finally {
      setServiceLoading(false);
    }
  }

  async function fetchPricing() {
    if (!form.city || !form.carModel || serviceTypes.length === 0) return;
    if (Object.keys(pricingRef.current).length > 0 && !sessionPricingFetchedRef.current) {
      return;
    }
    setPricingLoading(true);
    try {
      const cityId = form.city.id;
      const zoneId = form.city.zone_id || null;
      const vehicleClass = form.carModel.class || null;

      const next: Record<string, number> = {};
      const list = serviceTypes.slice(0, 120);
      await Promise.all(
        list.map(async (s) => {
          const p = await fetchServicePriceForBooking(s.id, cityId, zoneId, vehicleClass);
          if (p > 0) next[s.id] = p;
        })
      );
      setPricing(next);
      pricingRef.current = next;
      sessionPricingFetchedRef.current = true;
      persistBookingSession();
    } catch {
      setPricing({});
    } finally {
      setPricingLoading(false);
    }
  }

  async function fetchWorkshops() {
    if (!form.city) return;
    setWorkshopLoading(true);
    try {
      const { data, error } = await supabase
        .from('workshops')
        .select('id,name,address,city,state,pincode,phone,is_active,is_verified')
        .eq('is_active', true)
        .eq('is_verified', true)
        .ilike('city', `%${form.city.name}%`)
        .order('name')
        .limit(200);
      if (error) throw error;
      setWorkshops(((data as any[]) || []) as any);
    } catch {
      setWorkshops([]);
    } finally {
      setWorkshopLoading(false);
    }
  }

  async function fetchAvailableCoupons() {
    // Public, unauthenticated fetch (booking flow works for logged-out users too).
    // The coupons table has RLS so a direct anon Supabase query won't work — must go via the API.
    try {
      const res = await fetch(`${ENV.API_URL}/api/coupons/active?channel=${Platform.OS === 'ios' ? 'IOS' : 'ANDROID'}`);
      const json = await res.json().catch(() => ({}));
      const list = Array.isArray(json?.coupons) ? json.coupons : [];
      setAvailableCoupons(list);
    } catch {
      setAvailableCoupons([]);
    }
  }

  function describeCoupon(c: any): string {
    const mode = String(c?.discount_mode || '').toUpperCase();
    const val = Number(c?.discount_value || 0);
    if (c?.coupon_kind === 'FREE_SERVICE') return 'Free service';
    if (mode === 'PERCENT' && val > 0) return `${val}% OFF`;
    if ((mode === 'AMOUNT' || mode === 'FLAT' || mode === 'FIXED') && val > 0) return `₹${val} OFF`;
    if (c?.description) return String(c.description);
    return 'Offer';
  }

  async function applyCoupon(overrideCode?: string) {
    const code = (overrideCode ?? couponCode).trim();
    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    if (overrideCode) setCouponCode(overrideCode.toUpperCase());
    setCouponApplying(true);
    setCouponError(null);
    try {
      const response = await fetch(`${ENV.API_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          lead_context: {
            subtotal: totalPrice,
            service_type_ids: form.selectedServices,
            service_items: serviceItemsForCoupon,
            customer_phone: form.customerPhone,
            channel: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
            city_id: form.city?.id || null,
          },
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.valid) {
        throw new Error(json?.error || 'Coupon validation failed.');
      }
      setCouponMeta(json.coupon_meta || null);
      setCouponDiscount(Number(json.discount_amount || 0));
      setCouponError(null);
      trackEvent('booking_coupon_applied');
      Alert.alert('Coupon applied', `Code: ${json?.coupon?.code || code}`);
    } catch (error: any) {
      setCouponMeta(null);
      setCouponDiscount(0);
      setCouponError(error?.message || 'Invalid coupon.');
      trackEvent('booking_coupon_failed');
    } finally {
      setCouponApplying(false);
    }
  }

  function clearCoupon() {
    setCouponCode('');
    setCouponMeta(null);
    setCouponDiscount(0);
    setCouponError(null);
  }

  async function fetchProfileIfLoggedIn() {
    try {
      const token = await getCustomerSessionToken();
      if (!token) {
        setIsLoggedIn(false);
        setCurrentMembership(null);
        return;
      }
      setIsLoggedIn(true);
      setStep((current) => (current === DETAILS_STEP ? 2 : current));

      const profileRes = await apiFetch<any>('/api/customer/profile');
      const customer = profileRes?.customer || {};

      setForm((p) => ({
        ...p,
        customerName: customer.full_name || customer.name || p.customerName,
        customerPhone: customer.phone || p.customerPhone,
      }));

      const addresses: SavedAddress[] = (profileRes?.addresses || []).map((a: any) => ({
        id: String(a.id),
        label: a.label || a.address_type || null,
        address_line1: a.address_line1 || a.line1 || a.address || null,
        address_line2: a.address_line2 || a.line2 || null,
        city: a.city || null,
        state: a.state || null,
        pincode: a.pincode || null,
        landmark: a.landmark || null,
        address_type: a.address_type || null,
      }));
      setSavedAddresses(dedupeSavedAddresses(addresses));

      // If no saved addresses from API, pull from past orders + customer record
      if (addresses.length === 0) {
        const fallbackAddresses: SavedAddress[] = [];
        const seen = new Set<string>();

        // Customer's own address from profile
        const custAddr = customer.address || customer.customer_address || '';
        if (custAddr && !seen.has(custAddr.toLowerCase().trim())) {
          seen.add(custAddr.toLowerCase().trim());
          fallbackAddresses.push({
            id: 'customer_primary',
            address_line1: custAddr,
            city: customer.city || null,
            address_type: 'Home',
            label: 'Home',
            address_line2: null, state: null, pincode: null, landmark: null,
          });
        }

        // Past bookings (orders + leads)
        try {
          const [ordersRes, leadsRes] = await Promise.all([
            apiFetch<any>('/api/customer/orders').catch(() => null),
            apiFetch<any>('/api/customer/leads').catch(() => null),
          ]);
          const allLeads = [
            ...(Array.isArray(ordersRes?.orders) ? ordersRes.orders : []),
            ...(Array.isArray(leadsRes?.leads) ? leadsRes.leads : []),
          ];
          for (const o of allLeads) {
            const addr = o.address || o.customer_address || o.pickup_address || '';
            if (!addr || seen.has(addr.toLowerCase().trim())) continue;
            seen.add(addr.toLowerCase().trim());
            fallbackAddresses.push({
              id: `lead_${o.id}`,
              address_line1: addr,
              city: o.city || null,
              address_type: 'Saved Address',
              label: 'Saved Address',
              address_line2: null, state: null, pincode: null, landmark: null,
            });
          }
        } catch {}

        if (fallbackAddresses.length > 0) setSavedAddresses(dedupeSavedAddresses(fallbackAddresses.slice(0, 5)));
      }

      try {
        const vehiclesRes = await apiFetch<any>('/api/customer/vehicles');
        const savedV = Array.isArray(vehiclesRes?.vehicles) ? vehiclesRes.vehicles : [];
        if (savedV.length > 0) {
          setSavedVehicles(savedV);
          const firstPlate = String(savedV[0].vehicle_number || '').trim().toUpperCase();
          if (firstPlate) setForm((p) => ({ ...p, vehicleNumber: p.vehicleNumber || firstPlate }));
        } else {
          // Fallback: pull vehicles from past orders/leads
          try {
            const [ordersRes, leadsRes] = await Promise.all([
              apiFetch<any>('/api/customer/orders').catch(() => null),
              apiFetch<any>('/api/customer/leads').catch(() => null),
            ]);
            const allLeads = [
              ...(Array.isArray(ordersRes?.orders) ? ordersRes.orders : []),
              ...(Array.isArray(leadsRes?.leads) ? leadsRes.leads : []),
            ];
            const vehicleMap = new Map<string, any>();
            for (const o of allLeads) {
              const make = o.vehicle_make || o.car_make || '';
              const model = o.vehicle_model || o.car_model || '';
              const plate = String(o.vehicle_number || o.car_number || '').trim().toUpperCase();
              const key = plate || `${make}-${model}`;
              if (!key || vehicleMap.has(key)) continue;
              vehicleMap.set(key, {
                id: o.id,
                make,
                model,
                vehicle_number: plate,
                fuel_type: o.fuel_type || null,
              });
            }
            setSavedVehicles(Array.from(vehicleMap.values()).slice(0, 5));
          } catch {}
        }
      } catch {}

      try {
        const walletRes = await apiFetch<any>('/api/customer/wallet');
        setWalletBalance(
          Number(walletRes?.wallet?.spendable_balance ?? walletRes?.wallet?.current_balance ?? 0),
        );
      } catch {
        setWalletBalance(0);
      }

      try {
        const memRes = await apiFetch<any>('/api/customer/membership');
        setCurrentMembership(memRes?.membership || null);
      } catch {
        setCurrentMembership(null);
      }

    } catch {
      // not logged in or API failed
      setCurrentMembership(null);
    }
  }

  async function persistNewPickupAddressIfNeeded() {
    if (!isLoggedIn || !form.pickupRequired || !form.pickupAddress.trim()) return;
    if (selectedSavedAddressId || selectedSavedAddressIdRef.current) return;

    const line1 =
      form.flatNumber.trim() ||
      form.pickupAddress.split(',')[0]?.trim() ||
      form.pickupAddress.trim();
    if (!line1) return;

    const parts = form.pickupAddress.split(',').map((s) => s.trim()).filter(Boolean);
    const pincode = parts.find((p) => /^\d{6}$/.test(p)) || null;
    const cityGuess = parts.length > 1 ? parts[parts.length - (pincode ? 2 : 1)] : null;

    try {
      await apiFetch('/api/customer/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: 'Home',
          line1,
          line2: form.landmark.trim() || null,
          city: cityGuess,
          pincode,
          is_default: savedAddresses.length === 0,
        }),
      });
    } catch {
      // non-fatal — duplicate addresses are ignored server-side
    }
  }

  async function submitLead() {
    if (!form.city || !form.carModel) return;
    if (!form.customerPhone.trim()) {
      Alert.alert('Phone required', 'Please enter your phone number.');
      return;
    }
    if (!form.pickupDate || !form.pickupTime) {
      Alert.alert('Date & time required', 'Please select your preferred date and time.');
      return;
    }
    if (form.pickupRequired && !form.pickupAddress.trim()) {
      Alert.alert('Address required', 'Please select or add a pickup address.');
      return;
    }

    setLoading(true);
    try {
      let freshWalletBalance = Number(walletBalance || 0);
      if (isLoggedIn) {
        try {
          const walletRes = await apiFetch<any>('/api/customer/wallet');
          freshWalletBalance = Number(
            walletRes?.wallet?.spendable_balance ?? walletRes?.wallet?.current_balance ?? 0,
          );
          setWalletBalance(freshWalletBalance);
        } catch {
          // keep cached balance
        }
      }

      const shouldUseWallet =
        isLoggedIn && useWalletForBooking && !walletVehicleBlocked && freshWalletBalance > 0;

      const leadNumber = `L-${Date.now().toString().slice(-8)}`;
      const addressParts = [form.pickupAddress.trim()];
      if (form.flatNumber.trim()) addressParts.unshift(form.flatNumber.trim());
      if (form.landmark.trim()) addressParts.push(form.landmark.trim());
      const completeAddress = addressParts.filter((p) => p.length > 0).join(', ');

      const leadPayload = {
        lead_number: leadNumber,
        created_from: isLoggedIn ? 'MOBILE_APP' : 'MOBILE_PUBLIC',
        status: 'NEW',
        lead_type: 'CAR_SERVICE',
        lead_source: 'App Booking',
        customer_name: form.customerName || null,
        customer_phone: form.customerPhone.replace(/\D/g, '').slice(-10),
        city: form.city.name,
        city_id: form.city.id,
        vehicle_make: form.carModel.make,
        model_id: form.carModel.id,
        vehicle_model: form.carModel.model_name,
        vehicle_variant: form.carModel.variant || null,
        vehicle_number: form.vehicleNumber.trim().toUpperCase() || null,
        service_type_ids: form.selectedServices.length > 0 ? form.selectedServices : null,
        pickup_required: form.pickupRequired,
        workshop_id: form.pickupRequired ? null : form.selectedWorkshop?.id || null,
        address: form.pickupRequired ? completeAddress : form.selectedWorkshop?.address || null,
        customer_address: form.pickupRequired ? completeAddress : form.selectedWorkshop?.address || null,
        pickup_address: form.pickupRequired ? completeAddress : null,
        preferred_slot_start:
          form.pickupDate && form.pickupTime
            ? `${form.pickupDate}T${form.pickupTime}:00`
            : null,
        estimated_amount: totalPrice > 0 ? totalPrice : null,
        lead_priority: 'NORMAL',
        created_at: new Date().toISOString(),
        coupon_code: couponMeta?.code || null,
        discount_amount: couponDiscount || 0,
      };

      const couponPayload = couponMeta
        ? {
            code: couponCode,
            lead_context: {
              subtotal: totalPrice,
              service_type_ids: form.selectedServices,
              service_items: serviceItemsForCoupon,
              customer_phone: form.customerPhone,
              channel: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
              city_id: form.city?.id || null,
            },
          }
        : undefined;

      const bookingPayload = {
        subtotal: totalPrice,
        discount_amount: couponDiscount,
        membership_bundle_discount: membershipBundleDiscount,
        include_booking_membership:
          includeBookingMembership && !hasActiveMembership && Boolean(primeMembershipPlan),
        membership_line_price: membershipLinePrice,
        use_wallet: shouldUseWallet,
        service_lines: walletServiceLines,
        service_items: serviceItemsForCoupon,
        lead: leadPayload,
        coupon: couponPayload,
        membership_claim: membershipClaim
          ? {
              benefit_code: membershipClaim.benefitCode,
              benefit_title: membershipClaim.benefitTitle,
              vehicle_number: membershipClaim.vehicleNumber || form.vehicleNumber.trim().toUpperCase(),
              vehicle_label: membershipClaim.vehicleLabel || null,
            }
          : undefined,
      };

      const createdLead = await submitServiceBooking(bookingPayload);

      if (isLoggedIn && useWalletForBooking && walletUsed > 0) {
        const serverWallet = Number(createdLead.wallet_deduction ?? 0);
        if (serverWallet <= 0) {
          if (freshWalletBalance <= 0) {
            Alert.alert(
              'Wallet',
              'Your wallet balance is ₹0 on the server, so nothing was deducted. Your booking was saved successfully.',
            );
          } else {
            Alert.alert(
              'Wallet not applied',
              'Your booking was saved, but wallet balance was not deducted. Please contact support with your booking ID.',
            );
          }
        } else {
          setWalletBalance((prev) => Math.max(0, prev - serverWallet));
        }
      } else if (isLoggedIn && useWalletForBooking && freshWalletBalance <= 0 && walletUsed > 0) {
        Alert.alert(
          'Wallet',
          'Your wallet balance is ₹0 on the server. Booking was saved without wallet deduction.',
        );
      }

      // Clear draft on successful booking
      bookingCompletedRef.current = true;
      trackEvent('booking_submitted');
      await persistNewPickupAddressIfNeeded();
      await removeBookingDraft(draftId);
      notifyCartBadgeCountChanged();

      const createdLeadId = createdLead.id;
      const savedLeadNumber = createdLead.lead_number || leadNumber;
      const latestOfferConfig = await fetchPostBookingMembershipAppConfig(true).catch(
        () => postBookingAppConfig,
      );
      setPostBookingAppConfig(latestOfferConfig);
      const createdLeadRecord = (createdLead.raw?.lead || {}) as {
        meta?: unknown;
        created_at?: string | null;
      };
      const successBase = {
        leadId: createdLeadId,
        leadNumber: savedLeadNumber,
        serviceSubtotal: totalPrice,
        membershipActivated: false,
        membershipOfferExpiresAt: resolveMembershipOfferExpiresAt(
          createdLeadRecord,
          latestOfferConfig.offer_window_minutes,
        ),
      };
      const amountToPay = isLoggedIn
        ? Number(createdLead.amount_payable ?? finalPayableAmount)
        : couponAdjustedTotal;

      if (form.paymentMethod === 'PAY_NOW' && amountToPay > 0 && createdLeadId) {
        try {
          const intentRes = await fetch(`${ENV.API_URL}/api/payments/create-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead_id: createdLeadId,
              payment_type: 'ADVANCE',
              amount: amountToPay,
              payment_method: 'RAZORPAY',
            }),
          });
          const intentJson = await intentRes.json();
          if (intentRes.ok && intentJson?.success) {
            const pi = intentJson.payment_intent;
            let RazorpayCheckout: any = null;
            try {
              RazorpayCheckout = require('react-native-razorpay')?.default;
            } catch {
              RazorpayCheckout = null;
            }
            if (RazorpayCheckout) {
              try {
                const options = {
                  key: pi.razorpay_key,
                  amount: pi.amount_paise,
                  currency: 'INR',
                  name: 'MyFNG',
                  description: `Booking ${leadNumber}`,
                  order_id: pi.order_id,
                  prefill: {
                    contact: form.customerPhone,
                    name: form.customerName || undefined,
                  },
                  theme: { color: '#004AAD' },
                };
                trackEvent('payment_initiated');
                await RazorpayCheckout.open(options);
                trackEvent('payment_success');
                setBookingSuccess({
                  ...successBase,
                  title: 'Payment Successful!',
                  message:
                    'Your booking has been confirmed and payment received. Our team will reach out to you shortly with pickup details.',
                  isPaid: true,
                });
              } catch (payErr: any) {
                const cancelled =
                  payErr?.code === 'PAYMENT_CANCELLED' ||
                  payErr?.description?.includes('cancelled');
                if (cancelled) {
                  trackEvent('payment_cancelled');
                } else {
                  trackEvent('payment_failed');
                }
                setBookingSuccess({
                  ...successBase,
                  title: 'Booking Confirmed!',
                  message: cancelled
                    ? 'Your booking has been created. Payment was cancelled \u2014 you can pay later from your bookings.'
                    : 'Your booking has been created. Payment could not be processed \u2014 you can pay later from your bookings.',
                  isPaid: false,
                });
              }
            } else {
              setBookingSuccess({
                ...successBase,
                title: 'Booking Confirmed!',
                message:
                  'Your booking has been created. Payment module is not available \u2014 you can pay later from your bookings.',
                isPaid: false,
              });
            }
          } else {
            setBookingSuccess({
              ...successBase,
              title: 'Booking Confirmed!',
              message:
                'Your booking has been created. Payment could not be initiated \u2014 you can pay later from your bookings.',
              isPaid: false,
            });
          }
        } catch {
          setBookingSuccess({
            ...successBase,
            title: 'Booking Confirmed!',
            message:
              'Your booking has been created. Payment gateway is currently unavailable \u2014 you can pay later from your bookings.',
            isPaid: false,
          });
        }
      } else {
        setBookingSuccess({
          ...successBase,
          title: 'Booking Confirmed!',
          message:
            'Thank you for choosing MyFNG! Our team will contact you shortly to confirm pickup details and finalise your service.',
          isPaid: false,
        });
      }

      setForm((prev) => ({
        ...prev,
        selectedServices: [],
        pickupDate: '',
        pickupTime: '',
        pickupAddress: '',
        flatNumber: '',
        landmark: '',
        selectedWorkshop: null,
      }));
    } catch (error: any) {
      trackEvent('booking_submit_failed');
      Alert.alert('Failed', error?.message || 'Could not create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const handlePostBookingMembershipPay = async () => {
    if (!bookingSuccess?.leadId || !primeMembershipPlan || !postBookingMembershipQuote) return;
    const vehicleNumber = form.vehicleNumber.trim().toUpperCase();
    const make = String(form.carModel?.make || '').trim();
    const model = String(form.carModel?.model_name || '').trim();
    if (!vehicleNumber || !make || !model) {
      Alert.alert('Vehicle required', 'Booking vehicle details are missing. You can activate Prime from Settings → Membership.');
      return;
    }

    setMembershipActivating(true);
    try {
      const result = await activatePostBookingMembership({
        apiFetch,
        plan: primeMembershipPlan,
        leadId: bookingSuccess.leadId,
        serviceSubtotal: bookingSuccess.serviceSubtotal,
        expectedPayable: postBookingMembershipQuote.payable,
        vehicle: { vehicle_number: vehicleNumber, make, model },
      });

      if (result.membership) {
        setCurrentMembership(result.membership);
      } else {
        const memRes = await apiFetch<any>('/api/customer/membership').catch(() => null);
        if (memRes?.membership) setCurrentMembership(memRes.membership);
      }

      const walletNote =
        result.walletCredit && result.walletCredit > 0
          ? ` ₹${Math.round(result.walletCredit).toLocaleString('en-IN')} booking discount added to your wallet.`
          : '';

      setBookingSuccess((prev) =>
        prev
          ? {
              ...prev,
              membershipActivated: true,
              message: `Prime membership activated for ${vehicleNumber}.${walletNote}`,
            }
          : prev,
      );
      Alert.alert('Prime Activated', `Membership is now active for ${vehicleNumber}.${walletNote}`);
    } catch (err: any) {
      const cancelled = err?.code === 'PAYMENT_CANCELLED' || err?.description?.includes('cancelled');
      if (cancelled) {
        Alert.alert('Payment Cancelled', 'Membership payment was cancelled. You can try again from this screen.');
      } else {
        Alert.alert('Membership', err?.message || 'Could not activate membership. Please try again.');
      }
    } finally {
      setMembershipActivating(false);
    }
  };

  // ── Effects ─────────────────────────────────────────────────────

  useEffect(() => {
    fetchAvailableCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoggedIn || step !== 4) return;
    const plate = form.vehicleNumber.trim().toUpperCase();
    if (!plate) {
      setWalletVehicleBlocked(false);
      setWalletBlockReason(null);
      return;
    }
    let active = true;
    (async () => {
      const check = await fetchWalletVehicleBlocked(apiFetch, plate);
      if (!active) return;
      setWalletVehicleBlocked(check.blocked);
      setWalletBlockReason(check.reason || null);
    })();
    return () => {
      active = false;
    };
  }, [isLoggedIn, step, form.vehicleNumber]);

  useEffect(() => {
    trackEvent('booking_started');
    (async () => {
      const cityList = await fetchCities();
      const rebook = route?.params?.rebookOrder;
      const claim = route?.params?.membershipClaim as MembershipClaimRouteParams | undefined;
      if (rebook) {
        const cityName = String(rebook.city || '').trim().toLowerCase();
        const matchedCity = cityList.find((c) => c.name.toLowerCase() === cityName);
        const addressText = String(rebook.address || '').trim();
        const rebookFormUpdates: Partial<BookingFormData> = {};
        if (matchedCity) rebookFormUpdates.city = matchedCity;
        if (addressText) {
          rebookFormUpdates.pickupAddress = addressText;
          rebookFormUpdates.landmark = addressText;
        }
        const make = String(rebook.vehicle_make || '').trim();
        const model = String(rebook.vehicle_model || '').trim();
        const serviceIds = parseRebookServiceIds(rebook.service_type_ids);
        if (serviceIds.length > 0) setRebookServiceIds(serviceIds);
        if (make && model) {
          const resolvedCar = await resolveCarModelForRebook(make, model, rebook.fuel_type || null);
          if (resolvedCar) {
            rebookFormUpdates.carModel = resolvedCar;
            setCarQuery(`${resolvedCar.make} ${resolvedCar.model_name}`);
          } else {
            rebookFormUpdates.carModel = {
              id: `rebook-${Date.now()}`,
              make,
              model_name: model,
              variant: rebook.fuel_type || null,
            };
            setCarQuery(`${make} ${model}`);
          }
        }
        setForm((prev) => ({ ...prev, ...rebookFormUpdates }));
        if (!matchedCity) autoDetectLocation(cityList);
        if (matchedCity || make) setStep(1);
      } else if (claim) {
        if (claim.vehicleNumber) {
          setForm((prev) => ({
            ...prev,
            vehicleNumber: String(claim.vehicleNumber || '').trim().toUpperCase(),
          }));
        }
        if (claim.serviceCategory) {
          setSelectedCategory(String(claim.serviceCategory));
        }
        autoDetectLocation(cityList);
      } else {
        autoDetectLocation(cityList);
      }
    })();
    fetchProfileIfLoggedIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoggedIn && step === DETAILS_STEP) {
      goStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, step]);

  useEffect(() => {
    if (form.city && !form.pickupRequired) {
      fetchWorkshops();
    } else {
      setWorkshops([]);
      setForm((p) => ({ ...p, selectedWorkshop: null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.city?.id, form.pickupRequired]);

  useEffect(() => {
    if (step === 2 && form.city && form.carModel) {
      fetchServiceTypes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.city?.id, form.carModel?.id]);

  useEffect(() => {
    if (step === 2 && form.city && form.carModel && serviceTypes.length > 0) {
      const allowed = orderedCategories.length > 0 ? orderedCategories : categories;
      if (!selectedCategory || !allowed.includes(selectedCategory)) {
        const keyword = String(paramServiceCategory || '').trim().toUpperCase();
        const fromKeyword = keyword
          ? allowed.find((c) => c.toUpperCase().includes(keyword))
          : undefined;
        const exact = paramServiceCategory && allowed.includes(paramServiceCategory)
          ? paramServiceCategory
          : undefined;
        setSelectedCategory(fromKeyword || exact || allowed[0] || '');
      }
      fetchPricing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceTypes.length, step, form.city?.id, form.carModel?.id, orderedCategories.length]);

  useEffect(() => {
    if (step === 2 && serviceTypes.length > 0 && paramSelectedServiceId && form.selectedServices.length === 0) {
      const exists = serviceTypes.find((s) => s.id === paramSelectedServiceId);
      if (exists) {
        setForm((prev) => ({ ...prev, selectedServices: [paramSelectedServiceId] }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, serviceTypes.length, paramSelectedServiceId]);

  useEffect(() => {
    if (step !== 2 || rebookServiceIds.length === 0 || serviceTypes.length === 0) return;
    const validIds = rebookServiceIds.filter((id) => serviceTypes.some((s) => s.id === id));
    if (validIds.length === 0) return;
    setForm((prev) => {
      if (prev.selectedServices.length > 0) return prev;
      return { ...prev, selectedServices: validIds };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, serviceTypes.length, rebookServiceIds.join('|')]);

  useEffect(() => {
    if (!bookingSuccess || primeMembershipPlan || hasActiveMembership) return;
    let active = true;
    (async () => {
      try {
        const plan = await fetchPrimeMembershipConfig(ENV.API_URL);
        if (active && plan) setPrimeMembershipPlan(plan as AppMembershipPlan);
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, [bookingSuccess, primeMembershipPlan, hasActiveMembership]);

  useEffect(() => {
    if (hasActiveMembership) {
      setIncludeBookingMembership(false);
    }
  }, [hasActiveMembership]);

  useEffect(() => {
    if (step < 2 || hasActiveMembership) return;
    let active = true;
    (async () => {
      try {
        const plan = await fetchPrimeMembershipConfig(ENV.API_URL);
        if (!active) return;
        setPrimeMembershipPlan(plan as AppMembershipPlan | null);
      } catch {
        if (active) setPrimeMembershipPlan(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [step, hasActiveMembership]);

  // ── Handlers ────────────────────────────────────────────────────

  const handleServiceToggle = useCallback((serviceId: string) => {
    setForm((prev) => {
      const has = prev.selectedServices.includes(serviceId);
      if (!has) trackEvent('booking_service_selected');
      return {
        ...prev,
        selectedServices: has
          ? prev.selectedServices.filter((x) => x !== serviceId)
          : [...prev.selectedServices, serviceId],
      };
    });
    setTimeout(() => persistBookingSession(), 0);
  }, [persistBookingSession]);

  const removeSelectedService = useCallback((serviceId: string) => {
    setForm((prev) => ({
      ...prev,
      selectedServices: prev.selectedServices.filter((x) => x !== serviceId),
    }));
    setTimeout(() => persistBookingSession(), 0);
  }, [persistBookingSession]);

  const canNext = () => {
    if (step === 0) return Boolean(form.city && form.carModel);
    if (step === 1) {
      if (!form.customerPhone.trim() || form.customerPhone.trim().length < 10) return false;
      if (!isLoggedIn && !otpVerified) return false;
      return true;
    }
    if (step === 2) return form.selectedServices.length > 0;
    if (step === 3) {
      if (!form.vehicleNumber.trim() || form.vehicleNumber.trim().length < 4) return false;
      if (form.pickupRequired)
        return Boolean(form.pickupDate && form.pickupTime && form.pickupAddress.trim());
      return Boolean(form.pickupDate && form.pickupTime);
    }
    return true;
  };


  const handleSendWhatsAppOtp = async () => {
    const cleanPhone = form.customerPhone.replace(/\D/g, '');
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

      // Try primary endpoint
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

      // Fallback if primary fails or returns 404
      if (!res || res.status === 404) {
        try {
          res = await fetch(`${ENV.API_URL}/api/booking/send-otp`, {
            method: 'POST',
            headers,
            body: payload,
          });
          json = await res.json().catch(() => ({}));
        } catch (fetchErr: any) {
          throw new Error('Network error. Please check your internet connection and try again.');
        }
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
    const cleanPhone = form.customerPhone.replace(/\D/g, '');
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
      if (testHint) {
        Alert.alert('Test OTP', testHint);
      }
    } catch (error: any) {
      if (__DEV__ && isDevSimulator() && isFirebaseIosClientError(error)) {
        Alert.alert(
          'Simulator SMS unavailable',
          'iOS Simulator par real SMS nahi aata. WhatsApp OTP bhej rahe hain.',
          [{ text: 'OK', onPress: () => handleSendWhatsAppOtp() }],
        );
        return;
      }
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
      } else if (code === 'auth/network-request-failed') {
        Alert.alert('Network Error', 'Please check your internet connection and try again.');
      } else {
        Alert.alert('OTP Failed', error?.message || 'Unable to send SMS OTP.');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSendOtp = handleSendWhatsAppOtp;

  const handleVerifyOtp = async () => {
    if (otpValue.trim().length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the OTP sent to your number');
      return;
    }
    setOtpLoading(true);
    try {
      let sessionToken: string | null = null;
      let authResponse: AuthVerifyResponse | null = null;

      if (otpChannel === 'whatsapp') {
        const cleanPhone = form.customerPhone.replace(/\D/g, '');
        const payload = JSON.stringify({
          phone: cleanPhone,
          otp: otpValue.trim(),
          displayName: form.customerName?.trim() || undefined,
          platform: Platform.OS,
        });
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-mobile-client': 'true',
          'X-App-Platform': Platform.OS,
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
          try {
            res = await fetch(`${ENV.API_URL}/api/booking/verify-otp`, {
              method: 'POST',
              headers,
              body: payload,
            });
            json = await res.json().catch(() => ({}));
          } catch (fetchErr: any) {
            throw new Error('Network error. Please check your internet and try again.');
          }
        }

        if (!res.ok) throw new Error(json?.error || 'Invalid OTP. Please try again.');
        sessionToken = json?.session_token || null;
        authResponse = json;
      } else {
        const cleanPhone = form.customerPhone.replace(/\D/g, '');
        const authResult = await verifySmsOtp(cleanPhone, otpValue.trim(), otpConfirmation);
        sessionToken = authResult.session_token ?? null;
        authResponse = authResult;
      }

      // Save session and auto-login
      if (sessionToken) {
        await setCustomerSessionToken(sessionToken);
        setIsLoggedIn(true);
        // Fetch profile data (name, car, addresses) for existing users
        fetchProfileIfLoggedIn();
      }

      setOtpVerified(true);

      const customerId =
        (authResponse as any)?.customer?.id ||
        (typeof authResponse === 'object' && authResponse && 'customer' in authResponse
          ? (authResponse as any).customer?.id
          : null);
      const decision = sessionToken
        ? await decideWelcomeCreditedPopup(
            sessionToken,
            customerId,
            authResponse,
            (authResponse as any)?.customer?.phone || form.customerPhone,
          )
        : { show: false, amount: getWelcomeBonusAmount(), welcomeBonus: null };
      if (decision.show) {
        pendingWelcomeCustomerIdRef.current = customerId ? String(customerId) : null;
        pendingWelcomePhoneRef.current =
          (authResponse as any)?.customer?.phone || form.customerPhone || null;
        setCreditedWelcomeAmount(decision.amount);
        setCreditedWelcomeVisible(true);
        pendingStepAdvanceRef.current = true;
      } else {
        setTimeout(() => goStep(2), 300);
      }
    } catch (error: any) {
      Alert.alert('Verification Failed', error?.message || 'Invalid OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const onNext = () => {
    if (step === 1 && !isLoggedIn && !otpVerified) {
      if (!otpSent) {
        handleSendOtp();
      } else {
        handleVerifyOtp();
      }
      return;
    }
    if (!canNext()) {
      Alert.alert('Complete this step', 'Please fill the required details.');
      return;
    }
    if (step < steps.length - 1) goStep(getNextStep(step, isLoggedIn));
    else submitLead();
  };

  const onBack = () => goStep(getPrevStep(step, isLoggedIn));

  const onDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      trackEvent('booking_date_selected');
      const nextDate = formatDateYMD(selectedDate);
      const todayYmd = formatDateYMD(getIndiaDate());
      setForm((p) => ({
        ...p,
        pickupDate: nextDate,
        pickupTime:
          p.pickupTime && isTimeSlotPastForDate(p.pickupTime, nextDate, todayYmd) ? '' : p.pickupTime,
      }));
    }
  };

  const selectSavedAddress = (addr: SavedAddress) => {
    setSelectedSavedAddressId(addr.id);
    const raw = addr.address_line1 || '';
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);

    let flatNumber = addr.address_line2 || '';
    let landmark = addr.landmark || '';
    let pickupAddress = raw;

    if (!flatNumber && parts.length >= 3) {
      const pincodeIdx = parts.findIndex((p) => /^\d{6}$/.test(p));
      const nonPinParts = parts.filter((p) => !/^\d{6}$/.test(p));
      if (nonPinParts.length >= 2) {
        flatNumber = nonPinParts[0] || '';
        landmark = nonPinParts[1] || '';
        pickupAddress = nonPinParts.slice(1).join(', ');
      }
    } else if (!flatNumber && parts.length === 2) {
      flatNumber = parts[0] || '';
      pickupAddress = parts[1] || '';
    }

    if (!pickupAddress) {
      const cityState = [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
      pickupAddress = [raw, cityState].filter(Boolean).join(', ');
    }

    setForm((p) => ({
      ...p,
      pickupAddress,
      flatNumber,
      landmark,
    }));
  };

  const todayStr = formatDateYMD(getIndiaDate());
  const tomorrowDate = new Date(getIndiaDate());
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = formatDateYMD(tomorrowDate);
  const dayAfterTomorrowDate = new Date(getIndiaDate());
  dayAfterTomorrowDate.setDate(dayAfterTomorrowDate.getDate() + 2);
  const dayAfterTomorrowStr = formatDateYMD(dayAfterTomorrowDate);
  const bookingTimeSlots = form.pickupRequired
    ? TIME_SLOTS
    : TIME_SLOTS.filter((slot) => slot.value < '13:00');
  const todayBookingClosed = isTodayBookingClosed(todayStr, bookingTimeSlots);

  const dateQuickOptions = useMemo(() => {
    if (todayBookingClosed) {
      return [
        {
          key: 'tomorrow',
          dateStr: tomorrowStr,
          label: `Tomorrow, ${formatDateDMShort(tomorrowStr)}`,
        },
        {
          key: 'day-after',
          dateStr: dayAfterTomorrowStr,
          label: formatDateDMShort(dayAfterTomorrowStr),
        },
      ];
    }
    return [
      {
        key: 'today',
        dateStr: todayStr,
        label: `Today, ${formatDateDMShort(todayStr)}`,
      },
      {
        key: 'tomorrow',
        dateStr: tomorrowStr,
        label: `Tomorrow, ${formatDateDMShort(tomorrowStr)}`,
      },
    ];
  }, [todayBookingClosed, todayStr, tomorrowStr, dayAfterTomorrowStr, form.pickupRequired]);

  const quickPickupDates = useMemo(
    () => new Set(dateQuickOptions.map((option) => option.dateStr)),
    [dateQuickOptions],
  );

  useEffect(() => {
    if (!todayBookingClosed) return;
    setForm((p) => {
      if (p.pickupDate && p.pickupDate !== todayStr) return p;
      return {
        ...p,
        pickupDate: tomorrowStr,
        pickupTime: p.pickupDate === todayStr ? '' : p.pickupTime,
      };
    });
  }, [todayBookingClosed, todayStr, tomorrowStr, form.pickupRequired]);

  useEffect(() => {
    if (
      form.pickupDate === todayStr &&
      form.pickupTime &&
      isTimeSlotPastForDate(form.pickupTime, form.pickupDate, todayStr)
    ) {
      setForm((p) => ({ ...p, pickupTime: '' }));
    }
  }, [form.pickupDate, form.pickupTime, todayStr]);

  const selectPickupDate = (dateStr: string) => {
    trackEvent('booking_date_selected');
    setForm((p) => ({
      ...p,
      pickupDate: dateStr,
      pickupTime:
        p.pickupTime && isTimeSlotPastForDate(p.pickupTime, dateStr, todayStr) ? '' : p.pickupTime,
    }));
  };

  const handleHeaderCartPress = () => {
    if (step === 2) {
      scrollRef.current?.scrollTo({
        y: Math.max(0, servicesCartYOffset.current - 12),
        animated: true,
      });
      return;
    }
    if (step === 4) {
      scrollRef.current?.scrollTo({
        y: Math.max(0, paymentCartYOffset.current - 12),
        animated: true,
      });
      return;
    }
    if (step === 3) {
      goStep(2);
    }
  };

  const showHeaderCart = cartServiceCount > 0 && step >= 2;

  const renderDateQuickRow = () => (
    <View style={styles.dateQuickRow}>
      {dateQuickOptions.map((option) => (
        <TouchableOpacity
          key={option.key}
          style={[styles.datePill, form.pickupDate === option.dateStr ? styles.datePillActive : null]}
          onPress={() => selectPickupDate(option.dateStr)}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.datePillText,
              form.pickupDate === option.dateStr ? styles.datePillTextActive : null,
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={styles.dateCalendarBtn}
        onPress={() => setShowDatePicker(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="calendar" size={16} color="#FFFFFF" />
        {form.pickupDate && !quickPickupDates.has(form.pickupDate) ? (
          <Text style={styles.dateCalendarBtnText}>
            {new Date(form.pickupDate + 'T00:00:00').getDate()}
          </Text>
        ) : null}
      </TouchableOpacity>
    </View>
  );

  // ── Render ──────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.container,
            keyboardVisible ? { paddingBottom: 180 } : null,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Top header */}
          <View style={styles.top}>
            <View style={styles.topRow}>
              <Image source={require('../../assets/logo.png')} style={styles.brandLogo} resizeMode="contain" />
              {showHeaderCart ? (
                <TouchableOpacity
                  style={styles.headerCartBtn}
                  activeOpacity={0.85}
                  onPress={handleHeaderCartPress}
                >
                  <Ionicons name="cart-outline" size={22} color={COLORS.primary} />
                  <Animated.View
                    style={[
                      styles.headerCartBadge,
                      cartServiceCount > 0 ? { transform: [{ scale: cartBadgeScale }] } : null,
                    ]}
                  >
                    <Text style={styles.headerCartBadgeText}>
                      {cartServiceCount > 9 ? '9+' : cartServiceCount}
                    </Text>
                  </Animated.View>
                </TouchableOpacity>
              ) : !isLoggedIn ? (
                <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginBtn}>
                  <Text style={styles.loginText}>Login</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.loggedInBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                  <Text style={styles.loggedInText}>Logged In</Text>
                </View>
              )}
            </View>
            <Text style={styles.h1}>{membershipClaim ? 'Membership Claim Booking' : 'Book Service Now'}</Text>
            <Text style={styles.h2}>{steps[step].subtitle}</Text>

            {membershipClaim ? (
              <View style={styles.membershipClaimBanner}>
                <Ionicons name="diamond" size={16} color="#B45309" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.membershipClaimBannerTitle}>Membership Claim</Text>
                  <Text style={styles.membershipClaimBannerText}>
                    {membershipClaim.benefitTitle}
                    {membershipClaim.vehicleLabel || membershipClaim.vehicleNumber
                      ? ` · ${membershipClaim.vehicleLabel || membershipClaim.vehicleNumber}`
                      : ''}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.stepper}>
              {Array.from({ length: getVisibleStepCount(isLoggedIn) }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.stepDot,
                    i <= getVisibleStepIndex(step, isLoggedIn) ? styles.stepDotActive : null,
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Step cards */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{steps[step].title}</Text>

            {/* ── Step 0: City + Car ── */}
            {step === 0 ? (
              <>
                <TouchableOpacity style={styles.inputRow} onPress={() => setCityModal(true)} activeOpacity={0.9}>
                  <Ionicons name="location" size={16} color={COLORS.primary} />
                  <Text style={styles.inputRowText}>
                    {form.city
                      ? `${form.city.name}${form.city.state ? `, ${form.city.state}` : ''}`
                      : 'Select city'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.gray[500]} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.autoDetectBtn}
                  onPress={() => autoDetectLocation()}
                  disabled={locationDetecting}
                  activeOpacity={0.9}
                >
                  {locationDetecting ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Ionicons name="navigate" size={14} color={COLORS.primary} />
                  )}
                  <Text style={styles.autoDetectText}>
                    {locationDetecting ? 'Detecting…' : 'Auto Detect Location'}
                  </Text>
                </TouchableOpacity>

                {detectedCityNotServiceable ? (
                  <View style={styles.notServiceableBanner}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Ionicons name="location" size={16} color="#EA580C" style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.notServiceableTitle}>
                          We currently don't serve <Text style={{ fontWeight: '900' }}>{detectedCityNotServiceable}</Text>
                        </Text>
                        <Text style={styles.notServiceableSub}>
                          Please select from our available cities below — we're expanding soon!
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {/* Inline car search */}
                <View style={styles.carSearchWrap}>
                  <View style={styles.carSearchRow}>
                    <Ionicons name="car-sport" size={16} color={COLORS.primary} />
                    <TextInput
                      value={form.carModel ? formatCar(form.carModel) : carQuery}
                      onChangeText={(t) => {
                        if (form.carModel) setForm((p) => ({ ...p, carModel: null }));
                        setCarQuery(t);
                        setShowCarSuggestions(true);
                        searchCarModels(t);
                      }}
                      onFocus={() => {
                        if (carSuggestions.length > 0) setShowCarSuggestions(true);
                      }}
                      placeholder="Type make or model (e.g. Tata Nexon)"
                      placeholderTextColor={COLORS.gray[500]}
                      style={styles.carSearchInput}
                      autoCorrect={false}
                      spellCheck={false}
                      autoComplete="off"
                    />
                    {form.carModel ? (
                      <TouchableOpacity
                        onPress={() => {
                          setForm((p) => ({ ...p, carModel: null }));
                          setCarQuery('');
                          setCarSuggestions([]);
                        }}
                      >
                        <Ionicons name="close-circle" size={18} color={COLORS.gray[400]} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {showCarSuggestions && carSuggestions.length > 0 ? (
                    <ScrollView
                      style={styles.carSuggestionList}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator
                    >
                      {carSuggestions.map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          style={styles.carSuggestionRow}
                          onPress={() => {
                            setForm((p) => ({ ...p, carModel: m }));
                            trackEvent('booking_car_model_selected');
                            setCarQuery('');
                            setShowCarSuggestions(false);
                          }}
                        >
                          <Text style={styles.carSuggestionText}>{formatCar(m)}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : null}

                  {showCarSuggestions && carQuery.length >= 2 && carSuggestions.length === 0 ? (
                    <View style={styles.carSuggestionList}>
                      <Text style={styles.carSuggestionEmpty}>No models found</Text>
                    </View>
                  ) : null}

                  {!showCarSuggestions && carQuery.length > 0 && carQuery.length < 2 ? (
                    <Text style={styles.carHint}>Type at least 2 letters to search</Text>
                  ) : null}
                </View>

                {isLoggedIn && savedVehicles.length > 0 && !form.carModel ? (
                  <View style={styles.savedVehicleSection}>
                    <Text style={styles.savedVehicleLabel}>YOUR SAVED VEHICLE</Text>
                    {savedVehicles.map((v) => (
                      <TouchableOpacity
                        key={v.id}
                        style={styles.savedVehicleCard}
                        activeOpacity={0.85}
                        onPress={async () => {
                          const make = v.make || '';
                          const model = v.model || '';
                          const plate = v.vehicle_number ? String(v.vehicle_number).trim().toUpperCase() : '';
                          const { data } = await supabase
                            .from('car_models')
                            .select('id,make,model_name,variant,class')
                            .eq('is_active', true)
                            .ilike('make', make)
                            .ilike('model_name', model)
                            .limit(1);
                          if (data && data.length > 0) {
                            setForm((p) => ({ ...p, carModel: data[0] as any, vehicleNumber: plate || p.vehicleNumber }));
                          } else {
                            setForm((p) => ({ ...p, carModel: { id: v.id, make, model_name: model, variant: v.variant || null } as any, vehicleNumber: plate || p.vehicleNumber }));
                          }
                        }}
                      >
                        <VehicleImage make={v.make} model={v.model} style={styles.savedVehicleImg} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.savedVehicleName}>{[v.make, v.model].filter(Boolean).join(' ') || 'Vehicle'}</Text>
                          {v.vehicle_number ? <Text style={styles.savedVehicleNumber}>{v.vehicle_number}</Text> : null}
                          {v.fuel_type ? <Text style={styles.savedVehicleFuel}>{v.fuel_type}</Text> : null}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                <View style={styles.tip}>
                  <Ionicons name="sparkles" size={16} color={COLORS.purple} />
                  <Text style={styles.tipText}>Book Your Service Under 60 Seconds</Text>
                </View>
              </>
            ) : null}

            {/* ── Step 1: Name + Phone (guests only) ── */}
            {step === 1 && !isLoggedIn ? (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Name (optional)</Text>
                  <TextInput
                    value={form.customerName}
                    onChangeText={(t) => setForm((p) => ({ ...p, customerName: t }))}
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor={COLORS.gray[500]}
                    onFocus={(e) => scrollToInput(e.target)}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Phone *</Text>
                  <TextInput
                    value={form.customerPhone}
                    onChangeText={(t) => {
                      setForm((p) => ({ ...p, customerPhone: t.replace(/\D/g, '').slice(0, 10) }));
                      if (otpSent) { setOtpSent(false); setOtpVerified(false); setOtpValue(''); setOtpChannel('whatsapp'); }
                    }}
                    style={styles.input}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={COLORS.gray[500]}
                    keyboardType="phone-pad"
                    editable={!otpVerified}
                    onFocus={(e) => scrollToInput(e.target)}
                  />
                </View>
                {!isLoggedIn && !otpSent && !otpVerified ? (
                  <View style={styles.otpBtnRow}>
                    <TouchableOpacity
                      style={styles.otpWhatsAppBtn}
                      onPress={handleSendWhatsAppOtp}
                      disabled={otpLoading || form.customerPhone.replace(/\D/g, '').length < 10}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                      <Text style={styles.otpWhatsAppBtnText}>WhatsApp OTP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.otpSmsBtnAlt}
                      onPress={handleSendSmsOtp}
                      disabled={otpLoading || form.customerPhone.replace(/\D/g, '').length < 10}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="chatbubble-ellipses" size={16} color={COLORS.primary} />
                      <Text style={styles.otpSmsBtnAltText}>SMS OTP</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {!isLoggedIn && otpSent && !otpVerified ? (
                  <View style={styles.field}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Ionicons name={otpChannel === 'whatsapp' ? 'logo-whatsapp' : 'chatbubble-ellipses'} size={14} color={otpChannel === 'whatsapp' ? '#25D366' : COLORS.primary} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B7280' }}>
                        OTP sent via {otpChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to +91 {form.customerPhone}
                      </Text>
                    </View>
                    <Text style={styles.label}>Enter OTP *</Text>
                    <TextInput
                      value={otpValue}
                      onChangeText={setOtpValue}
                      style={styles.input}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor={COLORS.gray[500]}
                      keyboardType="number-pad"
                      maxLength={6}
                      onFocus={(e) => scrollToInput(e.target)}
                    />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
                      <TouchableOpacity onPress={otpChannel === 'whatsapp' ? handleSendWhatsAppOtp : handleSendSmsOtp} disabled={otpLoading}>
                        <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700' }}>Resend OTP</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={otpChannel === 'whatsapp' ? handleSendSmsOtp : handleSendWhatsAppOtp} disabled={otpLoading}>
                        <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '700' }}>
                          Try {otpChannel === 'whatsapp' ? 'SMS' : 'WhatsApp'} instead
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
                {!isLoggedIn && otpVerified ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Ionicons name="checkmark-circle" size={16} color="#059669" />
                    <Text style={{ color: '#059669', fontSize: 12, fontWeight: '700' }}>Phone verified via {otpChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</Text>
                  </View>
                ) : null}
              </>
            ) : null}

            {/* ── Step 2: Services ── */}
            {step === 2 ? (
              <View onLayout={(e) => { servicesCartYOffset.current = e.nativeEvent.layout.y; }}>
              <>
                {orderedCategories.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} pagingEnabled={false} contentContainerStyle={styles.categoryScrollContainer}>
                    {orderedCategories.map((c) => {
                      const isActive = c === selectedCategory;
                      const iconUrl = getCategoryIconUrl(c);
                      return (
                        <TouchableOpacity
                          key={c}
                          style={[styles.categoryGridItem, isActive ? styles.categoryGridItemActive : null]}
                          onPress={() => setSelectedCategory(c)}
                          activeOpacity={0.85}
                        >
                          <View style={[styles.categoryIconWrap, isActive ? styles.categoryIconWrapActive : null]}>
                            {iconUrl ? (
                              <Image source={{ uri: iconUrl }} style={styles.categoryIcon} resizeMode="contain" />
                            ) : (
                              <Ionicons name="construct-outline" size={22} color={isActive ? '#1D4ED8' : '#6B7280'} />
                            )}
                          </View>
                          <Text style={[styles.categoryGridText, isActive ? styles.categoryGridTextActive : null]} numberOfLines={2}>
                            {c.split(' ').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : null}

                <View style={styles.searchRow}>
                  <Ionicons name="search" size={16} color={COLORS.gray[500]} />
                  <TextInput
                    value={serviceSearch}
                    onChangeText={setServiceSearch}
                    placeholder="Search in services"
                    placeholderTextColor={COLORS.gray[500]}
                    style={styles.searchInput}
                  />
                  {pricingLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
                </View>

                {isPeriodicCategory ? (
                  <View style={styles.oilTypeRow}>
                    <Text style={styles.oilTypeLabel}>Engine Oil:</Text>
                    <View style={styles.oilTypeToggle}>
                      <TouchableOpacity
                        style={[styles.oilTypeTab, selectedOilType === 'semi' ? styles.oilTypeTabActive : null]}
                        onPress={() => setSelectedOilType('semi')}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="water-outline" size={13} color={selectedOilType === 'semi' ? '#FFFFFF' : COLORS.primary} />
                        <Text style={[styles.oilTypeTabText, selectedOilType === 'semi' ? styles.oilTypeTabTextActive : null]}>Semi Synthetic</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.oilTypeTab, selectedOilType === 'full' ? styles.oilTypeTabFullActive : null]}
                        onPress={() => setSelectedOilType('full')}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="water" size={13} color={selectedOilType === 'full' ? '#FFFFFF' : '#EA580C'} />
                        <Text style={[styles.oilTypeTabText, selectedOilType === 'full' ? styles.oilTypeTabTextActive : { color: '#EA580C' }]}>Fully Synthetic</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {form.selectedServices.length > 0 ? (
                  <View style={styles.selectedCartPanel}>
                    <View style={styles.selectedCartHeader}>
                      <View style={styles.selectedCartHeaderLeft}>
                        <Ionicons name="cart" size={16} color={COLORS.primary} />
                        <Text style={styles.selectedCartTitle}>
                          {form.selectedServices.length} service{form.selectedServices.length !== 1 ? 's' : ''} selected
                          {membershipCartItem ? ' + membership' : ''}
                        </Text>
                      </View>
                      <Text style={styles.selectedCartTotal}>{inr(bookingCartSubtotal)}</Text>
                    </View>
                    <Text style={styles.selectedCartHint}>
                      Add more services from other categories — all selected items stay in your cart.
                    </Text>
                    <View style={styles.selectedCartChips}>
                      {selectedBookingCartItems.map((item) => (
                        <View key={item.key} style={styles.selectedCartChip}>
                          <Text style={styles.selectedCartChipText} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.selectedCartChipPrice}>
                            {item.effectivePrice < item.price ? inr(item.effectivePrice) : inr(item.price)}
                          </Text>
                          <TouchableOpacity
                            onPress={() => removeSelectedService(item.key)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {membershipCartItem ? (
                        <View style={[styles.selectedCartChip, styles.selectedCartChipMembership]}>
                          <Ionicons name="diamond" size={12} color="#7C3AED" />
                          <Text style={styles.selectedCartChipText} numberOfLines={1}>
                            {membershipCartItem.name}
                          </Text>
                          <Text style={styles.selectedCartChipPrice}>{inr(membershipCartItem.price)}</Text>
                          <TouchableOpacity
                            onPress={() => setIncludeBookingMembership(false)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                    {membershipBundleDiscount > 0 ? (
                      <Text style={styles.selectedCartSavingHint}>
                        Membership saves {inr(membershipBundleDiscount)} on services
                      </Text>
                    ) : null}
                    <TouchableOpacity
                      style={styles.selectedCartContinueBtn}
                      onPress={onNext}
                      activeOpacity={0.9}
                    >
                      <Text style={styles.selectedCartContinueBtnText}>Continue</Text>
                      <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {serviceLoading ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading services…</Text>
                  </View>
                ) : (
                  <View style={styles.serviceList}>
                    {servicesInCategory.map((s) => {
                      const selected = form.selectedServices.includes(s.id);
                      const price = pricing[s.id] || 0;
                      const pts = servicePoints[s.id] || s.points || 0;
                      const checklistItems = serviceChecklists[s.id] || [];
                      const visibleItems = checklistItems.slice(0, 5);
                      return (
                        <View
                          key={s.id}
                          style={[styles.planCard, selected ? styles.planCardActive : null]}
                        >
                          <TouchableOpacity
                            style={styles.planCardHeader}
                            onPress={() => handleServiceToggle(s.id)}
                            activeOpacity={0.85}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.serviceName}>{s.name}</Text>
                              {pts > 0 ? (
                                <Text style={styles.servicePoints}>{pts} Points</Text>
                              ) : null}
                            </View>
                            <View style={styles.serviceRight}>
                              <Text style={styles.servicePrice}>{price ? inr(price) : '—'}</Text>
                              <Ionicons
                                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                                size={20}
                                color={selected ? COLORS.success : COLORS.gray[400]}
                              />
                            </View>
                          </TouchableOpacity>

                          {visibleItems.length > 0 ? (
                            <View style={styles.planCardItems}>
                              {visibleItems.map((it, idx) => (
                                <View key={`${s.id}-it-${idx}`} style={styles.planCardItemRow}>
                                  <Ionicons
                                    name="checkmark-circle"
                                    size={14}
                                    color="#16A34A"
                                    style={{ marginTop: 2 }}
                                  />
                                  <Text style={styles.planCardItemText} numberOfLines={2}>
                                    {it.name}
                                  </Text>
                                </View>
                              ))}
                              {checklistItems.length > 5 ? (
                                <TouchableOpacity
                                  onPress={() => setDetailsService(s)}
                                  activeOpacity={0.7}
                                  style={styles.planViewAllBtn}
                                >
                                  <Text style={styles.planViewAllText}>
                                    View all points ({checklistItems.length})
                                  </Text>
                                  <Ionicons
                                    name="chevron-forward"
                                    size={14}
                                    color={COLORS.primary}
                                  />
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          ) : s.description ? (
                            <Text style={styles.serviceDesc} numberOfLines={2}>
                              {s.description}
                            </Text>
                          ) : null}

                          {/* MyFNG Prime Membership Promo */}
                          {price > 0 && !hasActiveMembership ? (
                            <View style={styles.membershipPromo}>
                              <Text style={styles.membershipPromoLine}>
                                Get <Text style={styles.membershipPromoBold}>MyFNG Prime</Text> — service at{' '}
                                <Text style={styles.membershipPromoPrice}>{inr(Math.round(price * 0.9))}</Text>
                                {' '}<Text style={styles.membershipPromoStrike}>{inr(price)}</Text>
                              </Text>
                              <TouchableOpacity
                                style={styles.membershipActivateBtn}
                                activeOpacity={0.85}
                                onPress={() => navigation.navigate('Settings', { subPage: 'Membership' })}
                              >
                                <Text style={styles.membershipActivateBtnText}>Activate Membership Now</Text>
                              </TouchableOpacity>
                            </View>
                          ) : null}

                          {selected ? (
                            <View style={styles.addedServiceBadge}>
                              <Ionicons name="checkmark-circle" size={16} color="#059669" />
                              <Text style={styles.addedServiceBadgeText}>Added to cart</Text>
                              <TouchableOpacity
                                onPress={() => handleServiceToggle(s.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Text style={styles.addedServiceRemoveText}>Remove</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.selectContinueBtnOutline}
                              activeOpacity={0.85}
                              onPress={() => handleServiceToggle(s.id)}
                            >
                              <Text style={styles.selectContinueBtnOutlineText}>Add to Cart</Text>
                              <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={styles.totalBar}>
                  <View>
                    <Text style={styles.totalLabel}>
                      {form.selectedServices.length > 0
                        ? `${form.selectedServices.length} service${form.selectedServices.length !== 1 ? 's' : ''} in cart`
                        : 'Estimated total'}
                      {membershipCartItem ? ' + membership' : ''}
                    </Text>
                    {form.selectedServices.length > 0 ? (
                      <Text style={styles.totalSubLabel}>
                        {membershipBundleDiscount > 0
                          ? `Save ${inr(membershipBundleDiscount)} with membership on services`
                          : 'Tap Add to Cart on more services anytime'}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.totalValue}>{bookingCartSubtotal ? inr(bookingCartSubtotal) : '—'}</Text>
                </View>
              </>
              </View>
            ) : null}

            {/* ── Step 3: Pickup / Visit ── */}
            {step === 3 ? (
              <>
                {/* Service Preference Card */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionCardHeader}>
                    <View style={[styles.sectionIcoBox, { backgroundColor: '#6366F1' }]}>
                      <Ionicons name="car" size={16} color="#FFFFFF" />
                    </View>
                    <Text style={styles.sectionCardTitle}>Service Preference</Text>
                    <Text style={styles.requiredStar}>*</Text>
                  </View>
                  <View style={styles.servicePrefRow}>
                    <TouchableOpacity
                      style={styles.servicePrefSide}
                      onPress={() => {
                        trackEvent('booking_pickup_mode_selected', { mode: 'pickup' });
                        setForm((p) => ({ ...p, pickupRequired: true, selectedWorkshop: null }));
                      }}
                      activeOpacity={0.85}
                    >
                      <View
                        style={[
                          styles.servicePrefIcoBox,
                          form.pickupRequired
                            ? { backgroundColor: '#6366F1' }
                            : { backgroundColor: '#D1D5DB' },
                        ]}
                      >
                        <Ionicons
                          name="navigate"
                          size={18}
                          color={form.pickupRequired ? '#FFFFFF' : '#6B7280'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.servicePrefLabel,
                          form.pickupRequired ? { color: '#4338CA' } : { color: '#6B7280' },
                        ]}
                      >
                        Pickup
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        if (form.pickupRequired) {
                          trackEvent('booking_pickup_mode_selected', { mode: 'workshop' });
                          setForm((p) => ({
                            ...p,
                            pickupRequired: false,
                            pickupDate: '',
                            pickupTime: '',
                            pickupAddress: '',
                            flatNumber: '',
                            landmark: '',
                          }));
                          fetchWorkshops();
                        } else {
                          trackEvent('booking_pickup_mode_selected', { mode: 'pickup' });
                          setForm((p) => ({ ...p, pickupRequired: true, selectedWorkshop: null }));
                        }
                      }}
                      style={[
                        styles.servicePrefToggle,
                        form.pickupRequired
                          ? { backgroundColor: '#6366F1' }
                          : { backgroundColor: '#10B981' },
                      ]}
                    >
                      <View
                        style={[
                          styles.servicePrefKnob,
                          form.pickupRequired ? { left: 3 } : { right: 3 },
                        ]}
                      >
                        <Ionicons
                          name={form.pickupRequired ? 'navigate' : 'location'}
                          size={16}
                          color={form.pickupRequired ? '#6366F1' : '#10B981'}
                        />
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.servicePrefSide, { justifyContent: 'flex-end' }]}
                      onPress={() => {
                        setForm((p) => ({
                          ...p,
                          pickupRequired: false,
                          pickupDate: '',
                          pickupTime: '',
                          pickupAddress: '',
                          flatNumber: '',
                          landmark: '',
                        }));
                        fetchWorkshops();
                      }}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.servicePrefLabel,
                          !form.pickupRequired ? { color: '#047857' } : { color: '#6B7280' },
                        ]}
                      >
                        Visit
                      </Text>
                      <View
                        style={[
                          styles.servicePrefIcoBox,
                          !form.pickupRequired
                            ? { backgroundColor: '#10B981' }
                            : { backgroundColor: '#D1D5DB' },
                        ]}
                      >
                        <Ionicons
                          name="location"
                          size={18}
                          color={!form.pickupRequired ? '#FFFFFF' : '#6B7280'}
                        />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Vehicle Number Card (common for both Pickup and Visit) */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionCardHeader}>
                    <View style={[styles.sectionIcoBox, { backgroundColor: '#F59E0B' }]}>
                      <Ionicons name="document-text" size={16} color="#FFFFFF" />
                    </View>
                    <Text style={styles.sectionCardTitle}>Vehicle Number</Text>
                    <Text style={styles.requiredStar}>*</Text>
                  </View>
                  <TextInput
                    style={[styles.input, { letterSpacing: 1.5, fontWeight: '600', textTransform: 'uppercase' }]}
                    value={form.vehicleNumber}
                    onChangeText={(text) => setForm((p) => ({ ...p, vehicleNumber: text.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12) }))}
                    placeholder="e.g. MH01BJ7842"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="characters"
                    maxLength={12}
                  />
                </View>

                {form.pickupRequired ? (
                  <>
                    {/* Pickup Date Card */}
                    <View style={styles.sectionCard}>
                      <View style={styles.sectionCardHeader}>
                        <View style={[styles.sectionIcoBox, { backgroundColor: '#3B82F6' }]}>
                          <Ionicons name="calendar" size={16} color="#FFFFFF" />
                        </View>
                        <Text style={styles.sectionCardTitle}>Pickup Date</Text>
                        <Text style={styles.requiredStar}>*</Text>
                      </View>
                      {renderDateQuickRow()}
                    </View>

                    {/* Pickup Time Card */}
                    {form.pickupDate ? (
                      <View style={styles.sectionCard}>
                        <View style={styles.sectionCardHeader}>
                          <View style={[styles.sectionIcoBox, { backgroundColor: '#A855F7' }]}>
                            <Ionicons name="time" size={16} color="#FFFFFF" />
                          </View>
                          <Text style={styles.sectionCardTitle}>Pickup Time</Text>
                          <Text style={styles.requiredStar}>*</Text>
                        </View>
                        <View style={styles.timeSlotsGrid}>
                          {TIME_SLOTS.map((slot) => {
                            const isActive = form.pickupTime === slot.value;
                            const isPast = isTimeSlotPastForDate(slot.value, form.pickupDate, todayStr);
                            return (
                              <TouchableOpacity
                                key={slot.value}
                                style={[
                                  styles.timeSlotTile,
                                  isActive ? styles.timeSlotTileActive : null,
                                  isPast ? styles.timeSlotTileDisabled : null,
                                ]}
                                onPress={() => {
                                  if (isPast) return;
                                  trackEvent('booking_time_selected');
                                  setForm((p) => ({ ...p, pickupTime: slot.value }));
                                }}
                                disabled={isPast}
                                activeOpacity={isPast ? 1 : 0.9}
                              >
                                <Text
                                  style={[
                                    styles.timeSlotTileText,
                                    isActive ? styles.timeSlotTileTextActive : null,
                                    isPast ? styles.timeSlotTileTextDisabled : null,
                                  ]}
                                >
                                  {slot.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {form.pickupTime ? (
                          <View style={styles.timeSelectedRow}>
                            <Ionicons name="checkmark-circle" size={14} color="#9333EA" />
                            <Text style={styles.timeSelectedText}>
                              Selected:{' '}
                              {TIME_SLOTS.find((s) => s.value === form.pickupTime)?.label}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <View style={styles.fieldHintCard}>
                        <Text style={styles.fieldHintText}>
                          Select a pickup date to choose a time slot.
                        </Text>
                      </View>
                    )}

                    {/* Pickup Address Card */}
                    {form.pickupTime ? (
                      <View style={styles.sectionCard}>
                        <View style={styles.sectionCardHeader}>
                          <View style={[styles.sectionIcoBox, { backgroundColor: '#F97316' }]}>
                            <Ionicons name="home" size={16} color="#FFFFFF" />
                          </View>
                          <Text style={styles.sectionCardTitle}>Pickup Address</Text>
                          <Text style={styles.requiredStar}>*</Text>
                        </View>

                        {/* Saved addresses list */}
                        {savedAddresses.length > 0 && !showNewAddressForm ? (
                          <View style={{ gap: 8 }}>
                            {savedAddresses.map((addr) => {
                              const isActive = selectedSavedAddressId === addr.id;
                              const addrLabel = addr.label || addr.address_type || 'Address';
                              const addrValue = [addr.address_line1, addr.address_line2, addr.city, addr.pincode].filter(Boolean).join(', ');
                              const icon = addrLabel.toLowerCase() === 'home' ? 'home' : addrLabel.toLowerCase() === 'work' ? 'briefcase' : 'location';
                              return (
                                <TouchableOpacity
                                  key={addr.id}
                                  style={[styles.addrPickCard, isActive ? styles.addrPickCardActive : null]}
                                  onPress={() => selectSavedAddress(addr)}
                                  activeOpacity={0.85}
                                >
                                  <View style={[styles.addrPickIcon, isActive ? { backgroundColor: '#EEF2FF' } : null]}>
                                    <Ionicons name={icon as any} size={16} color={isActive ? COLORS.primary : '#6B7280'} />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.addrPickLabel, isActive ? { color: COLORS.primary } : null]}>{addrLabel}</Text>
                                    <Text style={styles.addrPickValue} numberOfLines={2}>{addrValue || 'No address details'}</Text>
                                  </View>
                                  <Ionicons name={isActive ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={isActive ? COLORS.primary : '#D1D5DB'} />
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ) : null}

                        {/* Add new address button */}
                        {!showNewAddressForm ? (
                          <TouchableOpacity
                            style={styles.addNewAddrBtn}
                            onPress={() => {
                              setShowNewAddressForm(true);
                              setSelectedSavedAddressId(null);
                              setForm((p) => ({ ...p, pickupAddress: '', flatNumber: '', landmark: '' }));
                            }}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
                            <Text style={styles.addNewAddrBtnText}>Add New Address</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.newAddrFormWrap}>
                            {/* Address type pills with icons */}
                            <View style={styles.addrTypePillRow}>
                              {([
                                { key: 'Home', icon: 'home' },
                                { key: 'Work', icon: 'briefcase' },
                                { key: 'Other', icon: 'location' },
                              ] as const).map(({ key, icon }) => {
                                const active = newAddrForm.label === key;
                                return (
                                  <TouchableOpacity
                                    key={key}
                                    style={[styles.addrTypePill, active ? styles.addrTypePillActive : null]}
                                    onPress={() => setNewAddrForm((p) => ({ ...p, label: key }))}
                                    activeOpacity={0.85}
                                  >
                                    <Ionicons name={icon as any} size={14} color={active ? '#FFFFFF' : '#6B7280'} />
                                    <Text style={[styles.addrTypePillText, active ? styles.addrTypePillTextActive : null]}>{key}</Text>
                                  </TouchableOpacity>
                                );
                              })}

                              <TouchableOpacity
                                style={styles.fetchLocBtn}
                                onPress={fetchNewAddrLocation}
                                disabled={newAddrLocating}
                                activeOpacity={0.85}
                              >
                                <Ionicons name="locate" size={14} color="#FFFFFF" />
                                <Text style={styles.fetchLocBtnText}>
                                  {newAddrLocating ? 'Fetching...' : 'Fetch Location'}
                                </Text>
                              </TouchableOpacity>
                            </View>

                            {/* Address fields */}
                            <TextInput
                              style={styles.input}
                              placeholder="Flat / House / Building *"
                              placeholderTextColor="#9CA3AF"
                              value={newAddrForm.line1}
                              onChangeText={(t) => setNewAddrForm((p) => ({ ...p, line1: t }))}
                              onFocus={(e) => scrollToInput(e.target)}
                            />
                            <TextInput
                              style={[styles.input, { marginTop: 8 }]}
                              placeholder="Area / Street / Locality"
                              placeholderTextColor="#9CA3AF"
                              value={newAddrForm.line2}
                              onChangeText={(t) => setNewAddrForm((p) => ({ ...p, line2: t }))}
                              onFocus={(e) => scrollToInput(e.target)}
                            />
                            <View style={[styles.row2, { marginTop: 8 }]}>
                              <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="City"
                                placeholderTextColor="#9CA3AF"
                                value={newAddrForm.city}
                                onChangeText={(t) => setNewAddrForm((p) => ({ ...p, city: t }))}
                                onFocus={(e) => scrollToInput(e.target)}
                              />
                              <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="Pincode"
                                placeholderTextColor="#9CA3AF"
                                value={newAddrForm.pincode}
                                onChangeText={(t) => setNewAddrForm((p) => ({ ...p, pincode: t.replace(/[^0-9]/g, '').slice(0, 6) }))}
                                keyboardType="number-pad"
                                maxLength={6}
                                onFocus={(e) => scrollToInput(e.target)}
                              />
                            </View>

                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                              <TouchableOpacity
                                style={styles.newAddrCancelBtn}
                                onPress={() => {
                                  setShowNewAddressForm(false);
                                  setNewAddrForm({ label: 'Home', line1: '', line2: '', city: '', pincode: '' });
                                }}
                              >
                                <Text style={styles.newAddrCancelBtnText}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.newAddrSaveBtn}
                                onPress={saveNewAddress}
                              >
                                <Text style={styles.newAddrSaveBtnText}>Use This Address</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}

                        {/* Show selected address summary if chosen */}
                        {form.pickupAddress && !showNewAddressForm ? (
                          <View style={styles.selectedAddrSummary}>
                            <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                            <Text style={styles.selectedAddrText} numberOfLines={2}>{form.pickupAddress}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                ) : (
                  <>
                    <View style={styles.sectionCard}>
                      <View style={styles.sectionCardHeader}>
                        <View style={[styles.sectionIcoBox, { backgroundColor: '#3B82F6' }]}>
                          <Ionicons name="calendar" size={16} color="#FFFFFF" />
                        </View>
                        <Text style={styles.sectionCardTitle}>Visit Date</Text>
                        <Text style={styles.requiredStar}>*</Text>
                      </View>
                      {renderDateQuickRow()}
                    </View>

                    {form.pickupDate ? (
                      <View style={styles.sectionCard}>
                        <View style={styles.sectionCardHeader}>
                          <View style={[styles.sectionIcoBox, { backgroundColor: '#A855F7' }]}>
                            <Ionicons name="time" size={16} color="#FFFFFF" />
                          </View>
                          <Text style={styles.sectionCardTitle}>Visit Time</Text>
                          <Text style={styles.requiredStar}>*</Text>
                        </View>
                        <View style={styles.timeSlotsGrid}>
                          {TIME_SLOTS.filter((slot) => slot.value < '13:00').map((slot) => {
                            const isActive = form.pickupTime === slot.value;
                            const isPast = isTimeSlotPastForDate(slot.value, form.pickupDate, todayStr);
                            return (
                              <TouchableOpacity
                                key={slot.value}
                                style={[
                                  styles.timeSlotTile,
                                  isActive ? styles.timeSlotTileActive : null,
                                  isPast ? styles.timeSlotTileDisabled : null,
                                ]}
                                onPress={() => {
                                  if (isPast) return;
                                  trackEvent('booking_time_selected');
                                  setForm((p) => ({ ...p, pickupTime: slot.value }));
                                }}
                                disabled={isPast}
                                activeOpacity={isPast ? 1 : 0.9}
                              >
                                <Text
                                  style={[
                                    styles.timeSlotTileText,
                                    isActive ? styles.timeSlotTileTextActive : null,
                                    isPast ? styles.timeSlotTileTextDisabled : null,
                                  ]}
                                >
                                  {slot.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {form.pickupTime ? (
                          <View style={styles.timeSelectedRow}>
                            <Ionicons name="checkmark-circle" size={14} color="#9333EA" />
                            <Text style={styles.timeSelectedText}>
                              Selected: {TIME_SLOTS.find((s) => s.value === form.pickupTime)?.label}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                )}

                {showDatePicker && Platform.OS === 'android' ? (
                  <DateTimePicker
                    value={form.pickupDate ? new Date(form.pickupDate) : getIndiaDate()}
                    mode="date"
                    display="default"
                    minimumDate={getIndiaDate()}
                    onChange={onDateChange}
                  />
                ) : null}

                {Platform.OS === 'ios' ? (
                  <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
                    <View style={styles.datePickerModalOverlay}>
                      <View style={styles.datePickerModalCard}>
                        <View style={styles.datePickerModalHeader}>
                          <Text style={styles.datePickerModalTitle}>Select Date</Text>
                          <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                            <Text style={styles.datePickerModalDone}>Done</Text>
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={form.pickupDate ? new Date(form.pickupDate) : getIndiaDate()}
                          mode="date"
                          display="spinner"
                          minimumDate={getIndiaDate()}
                          onChange={onDateChange}
                        />
                      </View>
                    </View>
                  </Modal>
                ) : null}

              </>
            ) : null}

            {/* ── Step 4: Payment + Coupon + Summary ── */}
            {step === 4 ? (
              <>
                {/* Pay Later */}
                <TouchableOpacity
                  style={[styles.payRow, form.paymentMethod === 'PAY_LATER' ? styles.payRowActive : null]}
                  onPress={() => {
                    trackEvent('booking_payment_method_selected', { method: 'PAY_LATER' });
                    setForm((p) => ({ ...p, paymentMethod: 'PAY_LATER' }));
                  }}
                  activeOpacity={0.9}
                >
                  <Ionicons
                    name="time"
                    size={18}
                    color={form.paymentMethod === 'PAY_LATER' ? '#fff' : COLORS.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.payTitle,
                        form.paymentMethod === 'PAY_LATER' ? styles.payTitleActive : null,
                      ]}
                    >
                      Pay Later (Recommended)
                    </Text>
                    <Text
                      style={[
                        styles.paySub,
                        form.paymentMethod === 'PAY_LATER' ? styles.paySubActive : null,
                      ]}
                    >
                      Pay after inspection / final approval.
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Pay Now */}
                <TouchableOpacity
                  style={[styles.payRow, form.paymentMethod === 'PAY_NOW' ? styles.payRowActive : null]}
                  onPress={() => {
                    trackEvent('booking_payment_method_selected', { method: 'PAY_NOW' });
                    setForm((p) => ({ ...p, paymentMethod: 'PAY_NOW' }));
                  }}
                  activeOpacity={0.9}
                >
                  <Ionicons
                    name="card"
                    size={18}
                    color={form.paymentMethod === 'PAY_NOW' ? '#fff' : COLORS.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.payTitle,
                        form.paymentMethod === 'PAY_NOW' ? styles.payTitleActive : null,
                      ]}
                    >
                      Pay Now
                    </Text>
                    <Text
                      style={[
                        styles.paySub,
                        form.paymentMethod === 'PAY_NOW' ? styles.paySubActive : null,
                      ]}
                    >
                      Pay securely via UPI, Card, or Netbanking.
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Coupon */}
                <View style={styles.couponBox}>
                  <Text style={styles.label}>Apply Coupon</Text>

                  {/* Available coupon cards - like saved addresses */}
                  {availableCoupons.length > 0 ? (
                    <View style={{ marginBottom: 10 }}>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                      >
                        {availableCoupons.map((c) => {
                          const isApplied = couponMeta?.code && String(couponMeta.code).toUpperCase() === String(c.code).toUpperCase();
                          return (
                            <TouchableOpacity
                              key={c.id}
                              style={{
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                borderRadius: 12,
                                borderWidth: 1.5,
                                borderColor: isApplied ? '#047857' : '#E2E8F0',
                                backgroundColor: isApplied ? '#ECFDF5' : '#F8FAFC',
                                minWidth: 120,
                              }}
                              activeOpacity={0.85}
                              onPress={() => isApplied ? clearCoupon() : applyCoupon(c.code)}
                              disabled={couponApplying}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="pricetag" size={14} color={isApplied ? '#047857' : COLORS.primary} />
                                <Text style={{ fontSize: 13, fontWeight: '800', color: isApplied ? '#047857' : '#1E293B' }}>{c.code}</Text>
                              </View>
                              <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }} numberOfLines={1}>
                                {describeCoupon(c)}
                              </Text>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: isApplied ? '#047857' : COLORS.primary, marginTop: 4 }}>
                                {isApplied ? '✓ APPLIED' : 'TAP TO APPLY'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : null}

                  <View style={styles.couponRow}>
                    <TextInput
                      value={couponCode}
                      onChangeText={(t) => setCouponCode(t.toUpperCase())}
                      style={[styles.input, styles.couponInput]}
                      placeholder="Or enter coupon code"
                      placeholderTextColor={COLORS.gray[500]}
                      autoCapitalize="characters"
                      onFocus={(e) => scrollToInput(e.target)}
                    />
                    <TouchableOpacity
                      style={[
                        styles.couponBtn,
                        couponApplying || !couponCode.trim() ? styles.couponBtnDisabled : null,
                      ]}
                      onPress={() => applyCoupon()}
                      disabled={couponApplying || !couponCode.trim()}
                    >
                      <Text style={styles.couponBtnText}>
                        {couponApplying ? 'Applying…' : 'Apply'}
                      </Text>
                    </TouchableOpacity>
                    {couponMeta ? (
                      <TouchableOpacity style={styles.couponRemoveBtn} onPress={clearCoupon}>
                        <Text style={styles.couponRemoveText}>Remove</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {couponError ? <Text style={styles.errorText}>{couponError}</Text> : null}
                  {couponMeta ? (
                    <View style={styles.couponAppliedBanner}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <View style={styles.couponAppliedCheck}>
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.couponAppliedTitle}>{couponMeta.code} applied</Text>
                          {couponDiscount > 0 ? (
                            <Text style={styles.couponAppliedSub}>You saved {inr(couponDiscount)}</Text>
                          ) : null}
                        </View>
                      </View>
                      <TouchableOpacity onPress={clearCoupon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.couponAppliedRemove}>REMOVE</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>

                {totalPrice > 0 && !hasActiveMembership && !includeBookingMembership ? (
                  <TouchableOpacity
                    style={styles.fomoCardUrgent}
                    activeOpacity={0.85}
                    onPress={() => setIncludeBookingMembership(true)}
                  >
                    <View style={styles.fomoUrgentTop}>
                      <Ionicons name="flash" size={14} color="#FFFFFF" />
                      <Text style={styles.fomoUrgentTitle}>Add membership & save more</Text>
                    </View>
                    <Text style={styles.fomoUrgentText}>
                      Add MyFNG Prime with this booking & get{' '}
                      <Text style={{ fontWeight: '900' }}>{bookingMembershipExtraDiscountLabel()}</Text>
                      {' '}on services — save up to{' '}
                      {inr(calculateBookingMembershipExtraDiscount(totalPrice, { includeMembership: true }))} today!
                    </Text>
                    <View style={styles.fomoUrgentBtn}>
                      <Text style={styles.fomoUrgentBtnText}>Add Membership to Booking</Text>
                    </View>
                  </TouchableOpacity>
                ) : null}

                {membershipBundleDiscount > 0 ? (
                  <View style={styles.membershipSavingBanner}>
                    <Ionicons name="checkmark-circle" size={16} color="#059669" />
                    <Text style={styles.membershipSavingBannerText}>
                      Membership added — you save {inr(membershipBundleDiscount)} on this service booking
                    </Text>
                  </View>
                ) : null}

                {isLoggedIn && payableBeforeWallet > 0 ? (
                  <View style={styles.walletCard}>
                    <View style={styles.walletCardHeader}>
                      <View style={styles.walletIconWrap}>
                        <Ionicons name="wallet-outline" size={18} color={COLORS.primary} />
                      </View>
                      <View style={styles.walletHeaderText}>
                        <Text style={styles.walletTitle}>Wallet Balance</Text>
                        <Text style={styles.walletHint}>Up to {walletHintLabel} on this order</Text>
                      </View>
                      <View style={styles.walletToggleWrap}>
                        <Switch
                          style={Platform.OS === 'ios' ? styles.walletSwitch : undefined}
                          value={useWalletForBooking && !walletVehicleBlocked}
                          onValueChange={(val) => {
                            setUseWalletForBooking(val);
                            trackEvent('booking_wallet_toggle', { enabled: val });
                          }}
                          disabled={walletVehicleBlocked}
                          trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                          thumbColor="#FFFFFF"
                          ios_backgroundColor="#CBD5E1"
                        />
                      </View>
                    </View>

                    <View style={styles.walletStatsRow}>
                      <View style={styles.walletStatBox}>
                        <Text style={styles.walletStatLabel}>Available</Text>
                        <Text style={styles.walletStatValue}>
                          ₹{Math.round(Number(walletBalance || 0)).toLocaleString('en-IN')}
                        </Text>
                      </View>
                      <View style={styles.walletStatDivider} />
                      <View style={styles.walletStatBox}>
                        <Text style={styles.walletStatLabel}>Max usable</Text>
                        <Text style={[styles.walletStatValue, styles.walletStatValueAccent]}>
                          ₹{Math.round(walletMaxUsable).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </View>

                    {useWalletForBooking && walletUsed > 0 ? (
                      <View style={styles.walletAppliedPill}>
                        <Ionicons name="checkmark-circle" size={14} color="#059669" />
                        <Text style={styles.walletAppliedText}>
                          {form.paymentMethod === 'PAY_NOW'
                            ? `₹${Math.round(walletUsed).toLocaleString('en-IN')} applied · Pay ₹${Math.round(finalPayableAmount).toLocaleString('en-IN')} to book`
                            : `₹${Math.round(walletUsed).toLocaleString('en-IN')} will be applied at checkout`}
                        </Text>
                      </View>
                    ) : null}

                    {walletVehicleBlocked ? (
                      <Text style={styles.walletBlocked}>
                        {walletBlockReason || 'Wallet cannot be used — this vehicle is linked to another account.'}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Summary / My Cart */}
                <View
                  style={styles.reviewBox}
                  onLayout={(e) => {
                    paymentCartYOffset.current = e.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.reviewTitle}>My Cart</Text>

                  {membershipClaim ? (
                    <View style={styles.reviewClaimTag}>
                      <Text style={styles.reviewClaimTagLabel}>Membership Claim</Text>
                      <Text style={styles.reviewClaimTagValue}>
                        {membershipClaim.benefitTitle}
                        {membershipClaim.vehicleNumber ? ` · ${membershipClaim.vehicleNumber}` : ''}
                      </Text>
                    </View>
                  ) : null}

                  {selectedBookingCartItems.length === 0 && !membershipCartItem ? (
                    <Text style={styles.cartEmptyText}>No services selected</Text>
                  ) : null}

                  {selectedBookingCartItems.map((item) => (
                    <View key={item.key} style={styles.cartLineItem}>
                      <View style={styles.cartLineIconWrap}>
                        <Image source={{ uri: item.iconUrl }} style={styles.cartLineIcon} resizeMode="contain" />
                      </View>
                      <View style={styles.cartLineBody}>
                        <Text style={styles.cartLineName} numberOfLines={2}>{item.name}</Text>
                        <View style={styles.cartLinePriceRow}>
                          {item.effectivePrice < item.price ? (
                            <>
                              <Text style={styles.cartLinePrice}>{inr(item.effectivePrice)}</Text>
                              <Text style={styles.cartLineStrike}>{inr(item.price)}</Text>
                            </>
                          ) : (
                            <Text style={styles.cartLinePrice}>{inr(item.price)}</Text>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.cartLineRemoveBtn}
                        onPress={() => removeSelectedService(item.key)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close" size={14} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {membershipCartItem ? (
                    <View style={[styles.cartLineItem, styles.cartLineItemMembership]}>
                      <View style={[styles.cartLineIconWrap, styles.cartLineIconWrapMembership]}>
                        <Ionicons name="diamond" size={18} color="#7C3AED" />
                      </View>
                      <View style={styles.cartLineBody}>
                        <Text style={styles.cartLineName} numberOfLines={2}>{membershipCartItem.name}</Text>
                        <Text style={styles.cartLineSub}>Auto-added · {bookingMembershipExtraDiscountLabel()}</Text>
                        <View style={styles.cartLinePriceRow}>
                          <Text style={styles.cartLinePrice}>{inr(membershipCartItem.price)}</Text>
                          {membershipCartItem.originalPrice > membershipCartItem.price ? (
                            <Text style={styles.cartLineStrike}>{inr(membershipCartItem.originalPrice)}</Text>
                          ) : null}
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.cartLineRemoveBtn}
                        onPress={() => setIncludeBookingMembership(false)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close" size={14} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {!hasActiveMembership && primeMembershipPlan && !includeBookingMembership ? (
                    <TouchableOpacity
                      style={styles.addMembershipBackBtn}
                      onPress={() => setIncludeBookingMembership(true)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.addMembershipBackText}>
                        Add {primeMembershipPlan.name} Membership ({inr(membershipCartUnitPrice(primeMembershipPlan))})
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  <View style={styles.reviewDivider} />

                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewRowLabel}>Location</Text>
                    <Text style={styles.reviewRowValue}>{form.city?.name || '—'}</Text>
                  </View>
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewRowLabel}>Vehicle</Text>
                    <Text style={styles.reviewRowValue}>
                      {form.carModel ? formatCar(form.carModel) : '—'}
                    </Text>
                  </View>
                  {form.vehicleNumber.trim() ? (
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewRowLabel}>Reg. No.</Text>
                      <Text style={styles.reviewRowValue}>
                        {form.vehicleNumber.trim().toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                  {form.pickupRequired ? (
                    <>
                      {form.pickupDate ? (
                        <View style={styles.reviewRow}>
                          <Text style={styles.reviewRowLabel}>Pickup Date</Text>
                          <Text style={styles.reviewRowValue}>{formatDateDMY(form.pickupDate)}</Text>
                        </View>
                      ) : null}
                      {form.pickupTime ? (
                        <View style={styles.reviewRow}>
                          <Text style={styles.reviewRowLabel}>Pickup Time</Text>
                          <Text style={styles.reviewRowValue}>
                            {TIME_SLOTS.find((s) => s.value === form.pickupTime)?.label || form.pickupTime}
                          </Text>
                        </View>
                      ) : null}
                      {summaryPickupAddress ? (
                        <View style={[styles.reviewRow, styles.reviewRowTop]}>
                          <Text style={styles.reviewRowLabel}>Address</Text>
                          <Text style={[styles.reviewRowValue, styles.reviewRowValueWrap]}>
                            {summaryPickupAddress}
                          </Text>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {form.selectedWorkshop ? (
                        <>
                          <View style={styles.reviewRow}>
                            <Text style={styles.reviewRowLabel}>Workshop</Text>
                            <Text style={[styles.reviewRowValue, styles.reviewRowValueWrap]}>
                              {form.selectedWorkshop.name}
                            </Text>
                          </View>
                          {form.selectedWorkshop.address ? (
                            <View style={[styles.reviewRow, styles.reviewRowTop]}>
                              <Text style={styles.reviewRowLabel}>Address</Text>
                              <Text style={[styles.reviewRowValue, styles.reviewRowValueWrap]}>
                                {form.selectedWorkshop.address}
                              </Text>
                            </View>
                          ) : null}
                        </>
                      ) : null}
                      {form.pickupDate ? (
                        <View style={styles.reviewRow}>
                          <Text style={styles.reviewRowLabel}>Visit Date</Text>
                          <Text style={styles.reviewRowValue}>{formatDateDMY(form.pickupDate)}</Text>
                        </View>
                      ) : null}
                      {form.pickupTime ? (
                        <View style={styles.reviewRow}>
                          <Text style={styles.reviewRowLabel}>Visit Time</Text>
                          <Text style={styles.reviewRowValue}>
                            {TIME_SLOTS.find((s) => s.value === form.pickupTime)?.label || form.pickupTime}
                          </Text>
                        </View>
                      ) : null}
                    </>
                  )}

                  <View style={styles.reviewDivider} />

                  <Text style={styles.billSummaryTitle}>Bill Summary</Text>
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewRowLabel}>Item Total (Incl. taxes)</Text>
                    <Text style={styles.reviewRowValue}>{bookingCartSubtotal ? inr(bookingCartSubtotal) : '—'}</Text>
                  </View>
                  {membershipBundleDiscount > 0 ? (
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewRowLabel}>Membership booking discount</Text>
                      <Text style={[styles.reviewRowValue, styles.reviewRowValueDiscount]}>
                        -{inr(membershipBundleDiscount)}
                      </Text>
                    </View>
                  ) : null}
                  {couponMeta && couponDiscount > 0 ? (
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewRowLabel}>Coupon Discount</Text>
                      <Text style={[styles.reviewRowValue, styles.reviewRowValueDiscount]}>
                        -{inr(couponDiscount || 0)}
                      </Text>
                    </View>
                  ) : null}
                  {walletUsed > 0 ? (
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewRowLabel}>Wallet</Text>
                      <Text style={[styles.reviewRowValue, styles.reviewRowValueDiscount]}>
                        -{inr(walletUsed)}
                      </Text>
                    </View>
                  ) : null}
                  {bookingCartSubtotal > 0 ? (
                    <View style={styles.payableBar}>
                      <Text style={styles.payableLabel}>Payable</Text>
                      <Text style={styles.payableValue}>{inr(finalPayableAmount)}</Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}

            {/* Bottom actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.secondaryBtn, step === 0 ? styles.secondaryBtnDisabled : null]}
                onPress={onBack}
                disabled={step === 0}
                activeOpacity={0.9}
              >
                <Ionicons
                  name="arrow-back"
                  size={16}
                  color={step === 0 ? COLORS.gray[400] : COLORS.primary}
                />
                <Text style={[styles.secondaryText, step === 0 ? styles.secondaryTextDisabled : null]}>
                  Back
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={onNext}
                activeOpacity={0.9}
                disabled={loading}
              >
                {(loading || otpLoading) ? <ActivityIndicator color="#fff" /> : null}
                <Text style={styles.primaryText}>
                  {step === 1 && !isLoggedIn && !otpVerified
                    ? (otpSent ? 'Verify OTP →' : 'Send OTP →')
                    : step === steps.length - 1
                      ? form.paymentMethod === 'PAY_NOW'
                        ? 'Pay & Book'
                        : 'Book Service'
                      : 'Continue'}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footerPad} />
        </ScrollView>
      </KeyboardAvoidingView>

      <PublicPillNav
        activeTab="services"
        onPressTab={(tab: PublicPillNavTab) => {
          if (tab === 'home') navigation.navigate('PublicHome');
          if (tab === 'services')
            navigation.navigate('PublicServicePackages', { city: form.city?.name || undefined });
          if (tab === 'ai')
            navigation.navigate('AIBooking', { city: form.city?.name || undefined, fullScreen: true });
          if (tab === 'roadside')
            navigation.navigate('RoadsideAssistance', { city: form.city?.name || undefined });
          if (tab === 'account') navigation.navigate('Settings');
          if (tab === 'profile') navigation.navigate('Settings');
          if (tab === 'settings')
            Alert.alert('Support', 'Use AI booking or call support from the home screen.');
        }}
      />

        {/* City modal */}
        <Modal
          visible={cityModal}
          transparent
          animationType="fade"
          onRequestClose={() => setCityModal(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setCityModal(false)}>
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <Text style={styles.modalTitle}>Select City</Text>
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {cities.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.modalRow}
                    onPress={() => {
                      setForm((p) => ({ ...p, city: c }));
                      setCityModal(false);
                    }}
                  >
                    <Text style={styles.modalRowText}>{`${c.name}${c.state ? `, ${c.state}` : ''}`}</Text>
                    <Ionicons
                      name={form.city?.id === c.id ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={form.city?.id === c.id ? COLORS.success : COLORS.gray[400]}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Workshop modal */}
        <Modal
          visible={workshopModal}
          transparent
          animationType="fade"
          onRequestClose={() => setWorkshopModal(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setWorkshopModal(false)}>
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <Text style={styles.modalTitle}>Select Workshop</Text>
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {workshops.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={styles.modalRow}
                    onPress={() => {
                      setForm((p) => ({ ...p, selectedWorkshop: w }));
                      setWorkshopModal(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalRowText}>{w.name}</Text>
                      {w.address ? (
                        <Text style={styles.modalSub} numberOfLines={1}>
                          {w.address}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={form.selectedWorkshop?.id === w.id ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={form.selectedWorkshop?.id === w.id ? COLORS.success : COLORS.gray[400]}
                    />
                  </TouchableOpacity>
                ))}
                {workshopLoading ? (
                  <Text style={styles.modalEmpty}>Loading workshops…</Text>
                ) : null}
                {!workshopLoading && !workshops.length ? (
                  <Text style={styles.modalEmpty}>No workshops found for this city.</Text>
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Service Details / View All Points modal */}
        <Modal
          visible={!!detailsService}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setDetailsService(null)}
        >
          <View style={styles.detailsOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setDetailsService(null)}
            />
            <View style={styles.detailsCard}>
              {detailsService ? (
                <>
                  <View style={styles.detailsHeader}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.detailsTitle} numberOfLines={2}>
                        {detailsService.name}
                      </Text>
                      <View style={styles.detailsMetaRow}>
                        <Text style={styles.detailsMetaText}>Checklist</Text>
                        {Number(servicePoints[detailsService.id] || detailsService.points) > 0 ? (
                          <View style={styles.detailsPtsPill}>
                            <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                            <Text style={styles.detailsPtsPillText}>
                              {servicePoints[detailsService.id] || detailsService.points} pts
                            </Text>
                          </View>
                        ) : null}
                        <View style={styles.detailsOfficialPill}>
                          <Text style={styles.detailsOfficialText}>Official</Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => setDetailsService(null)}
                      style={styles.detailsCloseBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={20} color="#374151" />
                    </TouchableOpacity>
                  </View>

                  {(() => {
                    const categoryId = String(detailsService?.category || selectedCategory || '').toUpperCase();
                    const isPeriodic = categoryId.includes('PERIODIC');
                    const isDenting = categoryId.includes('DENTING') || categoryId.includes('PAINTING');
                    const isDetailing = categoryId.includes('DETAIL');

                    const usps = isPeriodic
                      ? ['Live Photos & Videos Updates', 'Same-Day Servicing', 'Free Pickup & Drop', 'Genuine OEM/OES Parts', 'Detailed Inspection Report', 'Car Delivery At Your Doorstep']
                      : isDenting
                        ? ['Live Photos & Videos Updates', 'Transparent Pricing', 'Free Pickup & Drop', 'Color Matching', 'Premium Finish']
                        : isDetailing
                          ? ['Live Photos & Videos Updates', 'Transparent Pricing', 'Free Pickup & Drop', 'Interior Deep Clean', 'Exterior Polish']
                          : ['Live Photos & Videos Updates', 'Transparent Pricing', 'Free Pickup & Drop', 'Genuine OEM/OES Parts'];

                    const warrantyLabel = isPeriodic
                      ? '1000 kms / 1 Month'
                      : isDenting
                        ? 'Depends on Package'
                        : 'NA';

                    let disclaimer = '';
                    if (isPeriodic) {
                      disclaimer = '* Spare part replacements charged at actual cost. Service packages use company-recommended oil and filters.';
                    } else if (isDenting) {
                      disclaimer = '* Major panel denting will incur additional charges. Rates do not apply to rusted vehicles.';
                    } else if (!isDetailing) {
                      disclaimer = '* This includes only labor charges, If any additional parts are required, they will be billed at actual cost.';
                    }

                    const uspRows: string[][] = [];
                    for (let i = 0; i < usps.length; i += 2) {
                      uspRows.push(usps.slice(i, i + 2));
                    }

                    return (
                      <>
                        {/* Price + Warranty + Proceed (green box) */}
                        <View style={styles.detailsPriceRow}>
                          <View>
                            <Text style={styles.detailsPriceText}>
                              {pricing[detailsService.id] && pricing[detailsService.id] > 0
                                ? `\u20B9${pricing[detailsService.id].toLocaleString('en-IN')}`
                                : '\u2014'}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                              <Ionicons name="shield-checkmark" size={12} color="#16A34A" />
                              <Text style={{ fontSize: 11, fontWeight: '600', color: '#065F46' }}>Warranty: {warrantyLabel}</Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => {
                              const sid = detailsService.id;
                              setForm((p) => ({
                                ...p,
                                selectedServices: Array.from(
                                  new Set([...(p.selectedServices || []), sid])
                                ),
                              }));
                              setDetailsService(null);
                              setTimeout(() => onNext(), 0);
                            }}
                            style={styles.detailsProceedBtn}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.detailsProceedText}>Proceed to Book</Text>
                            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.detailsBodyWrap}>
                          <ScrollView
                            style={styles.detailsBody}
                            contentContainerStyle={styles.detailsBodyContent}
                            showsVerticalScrollIndicator
                            nestedScrollEnabled
                          >
                            {/* What you get (USPs in 2-column rows) */}
                            <View style={{ backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: '#DBEAFE', padding: 12, marginBottom: 16 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>What you get</Text>
                              </View>
                              {uspRows.map((row, rIdx) => (
                                <View key={rIdx} style={{ flexDirection: 'row', gap: 8, marginBottom: rIdx < uspRows.length - 1 ? 8 : 0 }}>
                                  {row.map((usp) => (
                                    <View key={usp} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 10, borderWidth: 1, borderColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 7 }}>
                                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563EB' }} />
                                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151', flexShrink: 1 }}>{usp}</Text>
                                    </View>
                                  ))}
                                  {row.length < 2 ? <View style={{ flex: 1 }} /> : null}
                                </View>
                              ))}
                            </View>

                            {/* Checklist points */}
                            {(() => {
                              const items = serviceChecklists[detailsService.id] || [];
                              if (!items.length) {
                                return (
                                  <Text style={styles.detailsEmpty}>
                                    No checklist available for this service.
                                  </Text>
                                );
                              }
                              const rows: Array<typeof items> = [];
                              for (let i = 0; i < items.length; i += 2) {
                                rows.push(items.slice(i, i + 2));
                              }
                              return (
                                <View style={styles.detailsGrid}>
                                  {rows.map((row, rIdx) => (
                                    <View key={rIdx} style={styles.detailsGridRow}>
                                      {row.map((it, idx) => (
                                        <View key={`${rIdx}-${idx}`} style={styles.detailsGridItem}>
                                          <Ionicons
                                            name="checkmark-circle"
                                            size={16}
                                            color="#16A34A"
                                            style={{ marginTop: 2 }}
                                          />
                                          <Text style={styles.detailsGridItemText}>{it.name}</Text>
                                        </View>
                                      ))}
                                      {row.length === 1 ? (
                                        <View style={styles.detailsGridItem} />
                                      ) : null}
                                    </View>
                                  ))}
                                </View>
                              );
                            })()}

                            {/* Disclaimer */}
                            {disclaimer ? (
                              <Text style={{ marginTop: 12, fontSize: 11, fontStyle: 'italic', color: '#DC2626' }}>{disclaimer}</Text>
                            ) : null}

                            {/* MyFNG Prime Membership Promo in modal */}
                            {pricing[detailsService.id] > 0 && !hasActiveMembership ? (
                              <View style={[styles.membershipPromo, { marginTop: 16 }]}>
                                <Text style={styles.membershipPromoLine}>
                                  Get <Text style={styles.membershipPromoBold}>MyFNG Prime</Text> — service at{' '}
                                  <Text style={styles.membershipPromoPrice}>{inr(Math.round(pricing[detailsService.id] * 0.9))}</Text>
                                  {' '}<Text style={styles.membershipPromoStrike}>{inr(pricing[detailsService.id])}</Text>
                                </Text>
                                <TouchableOpacity
                                  style={styles.membershipActivateBtn}
                                  activeOpacity={0.85}
                                  onPress={() => {
                                    setDetailsService(null);
                                    navigation.navigate('Settings', { subPage: 'Membership' });
                                  }}
                                >
                                  <Text style={styles.membershipActivateBtnText}>Activate Membership Now</Text>
                                </TouchableOpacity>
                              </View>
                            ) : null}
                          </ScrollView>
                        </View>
                      </>
                    );
                  })()}
                </>
              ) : null}
            </View>
          </View>
        </Modal>

        {/* Booking Success modal */}
        <Modal
          visible={!!bookingSuccess}
          transparent
          animationType="fade"
          onRequestClose={() => undefined}
        >
          <View style={styles.successOverlay}>
            <View style={styles.successCard}>
              <View style={styles.successIconWrap}>
                <View style={styles.successIconRingOuter}>
                  <View style={styles.successIconRingInner}>
                    <Ionicons
                      name={bookingSuccess?.isPaid ? 'checkmark-done' : 'checkmark'}
                      size={44}
                      color="#FFFFFF"
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.successTitle}>
                {bookingSuccess?.title || 'Booking Confirmed!'}
              </Text>

              {bookingSuccess?.leadNumber ? (
                <View style={styles.successLeadPill}>
                  <Ionicons name="receipt-outline" size={13} color="#047857" />
                  <Text style={styles.successLeadText}>
                    Booking ID: {bookingSuccess.leadNumber}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.successMessage}>
                {bookingSuccess?.message ||
                  'Thank you for choosing MyFNG! We will contact you shortly.'}
              </Text>

              <View style={styles.successInfoRow}>
                <View style={styles.successInfoItem}>
                  <View style={[styles.successInfoIco, { backgroundColor: '#DBEAFE' }]}>
                    <Ionicons name="call-outline" size={16} color="#2563EB" />
                  </View>
                  <Text style={styles.successInfoText}>We'll call to confirm</Text>
                </View>
                <View style={styles.successInfoItem}>
                  <View style={[styles.successInfoIco, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="car-outline" size={16} color="#D97706" />
                  </View>
                  <Text style={styles.successInfoText}>Doorstep pickup</Text>
                </View>
              </View>

              {showPostBookingMembershipOffer && postBookingMembershipQuote ? (
                <View style={styles.successMembershipCard}>
                  {bookingSuccess?.membershipOfferExpiresAt ? (
                    <View style={styles.successMembershipTimerRow}>
                      <View style={styles.successMembershipTimerBadge}>
                        <Text style={styles.successMembershipTimerText}>
                          {formatOfferCountdown(bookingSuccess.membershipOfferExpiresAt)}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  <View style={styles.successMembershipTop}>
                    <View style={styles.successMembershipIconWrap}>
                      <Ionicons name="diamond" size={18} color="#DC2626" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.successMembershipTitle}>
                        {membershipOfferCardTitle(postBookingAppConfig.card_title)}
                      </Text>
                      <Text style={styles.successMembershipSub}>
                        {membershipOfferFomoMessage(
                          postBookingMembershipQuote.bundleDiscount,
                          postBookingAppConfig.fomo_message,
                        )}
                      </Text>
                      <Text style={styles.successMembershipWindow}>Also available in Order History</Text>
                    </View>
                  </View>
                  <View style={styles.successMembershipPriceRow}>
                    <Text style={styles.successMembershipStrike}>{inr(postBookingMembershipQuote.membershipPrice)}</Text>
                    <Text style={styles.successMembershipPayable}>{inr(postBookingMembershipQuote.payable)}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.successMembershipBtn, membershipActivating ? styles.successMembershipBtnDisabled : null]}
                    onPress={handlePostBookingMembershipPay}
                    disabled={membershipActivating}
                    activeOpacity={0.85}
                  >
                    {membershipActivating ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="card-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.successMembershipBtnText}>
                          Pay {inr(postBookingMembershipQuote.payable)} & Activate Prime
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : bookingSuccess?.membershipActivated ? (
                <View style={styles.successMembershipActivated}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.successMembershipActivatedText}>Prime membership activated</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.successPrimaryBtn}
                onPress={() => {
                  setBookingSuccess(null);
                  goStep(0);
                  navigation.navigate('PublicHome');
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="home" size={16} color="#FFFFFF" />
                <Text style={styles.successPrimaryBtnText}>Go to Home</Text>
              </TouchableOpacity>

              {isLoggedIn ? (
                <TouchableOpacity
                  style={styles.successSecondaryBtn}
                  onPress={() => {
                    setBookingSuccess(null);
                    goStep(0);
                    navigation.navigate('Settings', { subPage: 'Order History' });
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.successSecondaryBtnText}>View My Bookings</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </Modal>

      <WelcomeBonusCreditedModal
        visible={creditedWelcomeVisible}
        amount={creditedWelcomeAmount}
        onClose={async () => {
          setCreditedWelcomeVisible(false);
          const welcomeCustomerId = pendingWelcomeCustomerIdRef.current;
          const welcomePhone = pendingWelcomePhoneRef.current;
          if (welcomeCustomerId || welcomePhone) {
            await markWelcomeCreditedPopupShown(welcomeCustomerId || '', welcomePhone);
            pendingWelcomeCustomerIdRef.current = null;
            pendingWelcomePhoneRef.current = null;
          }
          if (pendingStepAdvanceRef.current) {
            pendingStepAdvanceRef.current = false;
            setTimeout(() => goStep(2), 300);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.gray[50] },
  screen: { flex: 1, backgroundColor: COLORS.gray[50] },
  container: { paddingBottom: 120 },
  top: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCartBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerCartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerCartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 11,
  },
  brand: { fontSize: 18, fontWeight: '900', color: COLORS.primaryDark },
  brandLogo: { width: 110, height: 36 },
  loginBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#EEF6FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.16)',
  },
  loginText: { fontSize: FONT_SIZES.xs, fontWeight: '900', color: COLORS.primaryDark },
  loggedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#ECFDF5',
  },
  loggedInText: { fontSize: 11, fontWeight: '800', color: '#059669' },
  h1: { marginTop: 10, fontSize: 28, fontWeight: '900', color: COLORS.primaryDark },
  h2: { marginTop: 6, fontSize: 13, fontWeight: '700', color: COLORS.gray[600] },
  membershipClaimBanner: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    padding: 12,
  },
  membershipClaimBannerTitle: { fontSize: 11, fontWeight: '800', color: '#92400E' },
  membershipClaimBannerText: { fontSize: 11, fontWeight: '600', color: '#78350F', marginTop: 2, lineHeight: 15 },
  stepper: { marginTop: 12, flexDirection: 'row', gap: 8 },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(17,24,39,0.12)',
  },
  stepDotActive: { backgroundColor: COLORS.primary },
  card: {
    marginTop: SPACING.sm,
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 0,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: SPACING.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  inputRowText: { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.primaryDark },

  autoDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.2)',
    backgroundColor: '#EEF6FF',
    marginBottom: 12,
  },
  autoDetectText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },

  notServiceableBanner: { padding: 14, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDBA74', borderRadius: 14, marginBottom: 12 },
  notServiceableTitle: { fontSize: 13, fontWeight: '700', color: '#9A3412' },
  notServiceableSub: { fontSize: 11, fontWeight: '600', color: '#C2410C', marginTop: 4 },

  carSearchWrap: { marginBottom: 12, zIndex: 10 },
  carSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  carSearchInput: { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.primaryDark },
  carSuggestionList: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#0A2540',
    borderRadius: 12,
    backgroundColor: '#0A2540',
    maxHeight: 240,
  },
  carSuggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  carSuggestionText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  carSuggestionEmpty: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  carHint: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray[500],
    paddingHorizontal: 4,
  },

  savedVehicleSection: {
    marginTop: 12,
  },
  savedVehicleLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 8,
  },
  savedVehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F0F7FF',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    marginBottom: 8,
  },
  savedVehicleImg: {
    width: 72,
    height: 48,
    borderRadius: 8,
  },
  savedVehicleName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  savedVehicleNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 2,
  },
  savedVehicleFuel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  tip: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.14)',
  },
  tipText: { flex: 1, fontSize: 12, fontWeight: '800', color: COLORS.primaryDark },
  field: { marginBottom: 12 },
  otpBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 4 },
  otpWhatsAppBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#25D366',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  otpWhatsAppBtnText: { fontSize: 13.5, fontWeight: '800', color: '#FFFFFF' },
  otpSmsBtnAlt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  otpSmsBtnAltText: { fontSize: 13.5, fontWeight: '800', color: COLORS.primary },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: { marginBottom: 6, fontSize: 12, fontWeight: '900', color: COLORS.gray[700] },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark,
    backgroundColor: '#fff',
  },
  row2: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  tabs: { paddingBottom: 10, gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  tabActive: { backgroundColor: '#EEF6FF', borderColor: 'rgba(0,136,232,0.18)' },
  tabText: { fontSize: 11, fontWeight: '900', color: COLORS.gray[700] },
  tabTextActive: { color: COLORS.primaryDark },
  categoryScrollContainer: {
    paddingBottom: 12,
    gap: 10,
  },
  categoryGridItem: {
    width: (Dimensions.get('window').width - 32 - 30) / 4,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  categoryGridItemActive: {
    borderColor: '#1D4ED8',
    backgroundColor: '#EFF6FF',
  },
  categoryIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryIconWrapActive: {
    backgroundColor: '#FFFFFF',
  },
  categoryIcon: {
    width: 50,
    height: 50,
  },
  categoryGridText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 12,
  },
  categoryGridTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  scopedHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#EEF6FF',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.18)',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  scopedHintText: { fontSize: 11, fontWeight: '800', color: COLORS.primaryDark },
  scopedHintClear: { marginLeft: 4, fontSize: 11, fontWeight: '900', color: COLORS.primary, textDecorationLine: 'underline' },
  searchRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.primaryDark },
  datePickerModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  datePickerModalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  datePickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  datePickerModalTitle: { fontSize: 15, fontWeight: '900', color: COLORS.primaryDark },
  datePickerModalDone: { fontSize: 15, fontWeight: '900', color: COLORS.primary },
  oilTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  oilTypeLabel: { fontSize: 12, fontWeight: '800', color: COLORS.gray[700] },
  oilTypeToggle: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 25,
    padding: 3,
  },
  oilTypeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'transparent',
  },
  oilTypeTabActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  oilTypeTabFullActive: {
    backgroundColor: '#EA580C',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  oilTypeTabText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  oilTypeTabTextActive: { color: '#FFFFFF' },
  loadingBox: { paddingVertical: 18, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 12, fontWeight: '800', color: COLORS.gray[600] },
  serviceList: { marginTop: 10, gap: 10 },
  serviceRow: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    borderRadius: 18,
    padding: 12,
    backgroundColor: '#fff',
  },
  serviceRowActive: { borderColor: 'rgba(0,136,232,0.28)', backgroundColor: '#EEF6FF' },
  serviceName: { fontSize: 13, fontWeight: '900', color: COLORS.primaryDark },
  servicePoints: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  serviceDesc: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray[600],
    lineHeight: 15,
  },
  serviceRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
  servicePrice: { fontSize: 12, fontWeight: '900', color: COLORS.primaryDark },
  totalBar: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#0B1220',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.72)' },
  totalSubLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  totalValue: { fontSize: 14, fontWeight: '900', color: '#fff' },
  selectedCartPanel: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    gap: 8,
  },
  selectedCartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectedCartHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  selectedCartTitle: { fontSize: 13, fontWeight: '900', color: '#1E3A8A' },
  selectedCartTotal: { fontSize: 14, fontWeight: '900', color: COLORS.primaryDark },
  selectedCartHint: { fontSize: 11, fontWeight: '600', color: '#475569', lineHeight: 15 },
  selectedCartChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectedCartChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  selectedCartChipText: { fontSize: 11, fontWeight: '800', color: '#1E293B', maxWidth: 140 },
  selectedCartChipPrice: { fontSize: 11, fontWeight: '900', color: COLORS.primary },
  selectedCartChipMembership: {
    backgroundColor: '#FAF5FF',
    borderColor: '#DDD6FE',
  },
  selectedCartSavingHint: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
    lineHeight: 15,
  },
  selectedCartContinueBtn: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  selectedCartContinueBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  addedServiceBadge: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  addedServiceBadgeText: { flex: 1, fontSize: 12, fontWeight: '800', color: '#047857' },
  addedServiceRemoveText: { fontSize: 11, fontWeight: '800', color: '#DC2626' },
  cartEmptyText: { fontSize: 12, fontWeight: '600', color: COLORS.gray[500], marginBottom: 8 },
  cartLineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cartLineItemMembership: { backgroundColor: '#FAF5FF', borderRadius: 12, paddingHorizontal: 10, marginBottom: 4 },
  cartLineIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cartLineIconWrapMembership: { backgroundColor: '#F3E8FF', borderColor: '#DDD6FE' },
  cartLineIcon: { width: 34, height: 34 },
  cartLineBody: { flex: 1, minWidth: 0 },
  cartLineName: { fontSize: 13, fontWeight: '800', color: '#111827' },
  cartLineSub: { fontSize: 10, fontWeight: '600', color: '#7C3AED', marginTop: 2 },
  cartLinePriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  cartLinePrice: { fontSize: 14, fontWeight: '900', color: '#111827' },
  cartLineStrike: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textDecorationLine: 'line-through' },
  cartLineRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMembershipBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#F0F7FF',
  },
  addMembershipBackText: { flex: 1, fontSize: 12, fontWeight: '800', color: COLORS.primary },
  billSummaryTitle: { fontSize: 13, fontWeight: '900', color: '#111827', marginBottom: 8 },
  switchRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  choice: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.18)',
    backgroundColor: '#EEF6FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  choiceActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  choiceText: { fontSize: 12, fontWeight: '900', color: COLORS.primaryDark },
  choiceTextActive: { color: '#fff' },

  autoDetectSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EEF6FF',
  },
  autoDetectSmallText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },

  savedAddrSection: { marginBottom: 12 },
  savedAddrTitle: { fontSize: 12, fontWeight: '900', color: COLORS.gray[700], marginBottom: 8 },
  savedAddrRow: { gap: 8 },
  savedAddrCard: {
    width: 140,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
    backgroundColor: '#fff',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedAddrCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEF6FF',
  },
  savedAddrLabel: { fontSize: 11, fontWeight: '900', color: COLORS.primaryDark },
  savedAddrLabelActive: { color: COLORS.primary },
  savedAddrLine: { fontSize: 10, fontWeight: '700', color: COLORS.gray[600], textAlign: 'center' },
  savedAddrLineActive: { color: COLORS.primaryDark },

  addrPickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  addrPickCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEF6FF',
  },
  addrPickIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addrPickLabel: { fontSize: 13, fontWeight: '800', color: '#111827' },
  addrPickValue: { fontSize: 11.5, fontWeight: '600', color: '#6B7280', marginTop: 1 },
  addNewAddrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  addNewAddrBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  newAddrFormWrap: { marginTop: 10, gap: 0 },
  addrTypePillRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  addrTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  addrTypePillActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  addrTypePillText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  addrTypePillTextActive: { color: '#FFFFFF' },
  fetchLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#16A34A',
  },
  fetchLocBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  newAddrCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  newAddrCancelBtnText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  newAddrSaveBtn: {
    flex: 2,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  newAddrSaveBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  selectedAddrSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  selectedAddrText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#166534' },

  dateQuickRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  dateQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    backgroundColor: '#fff',
  },
  dateQuickBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEF6FF',
  },
  dateQuickBtnText: { fontSize: 12, fontWeight: '800', color: COLORS.primaryDark },
  dateQuickBtnTextActive: { color: COLORS.primary },
  dateSelectedText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },

  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
  },
  timeSlotBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    backgroundColor: '#fff',
  },
  timeSlotBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  timeSlotText: { fontSize: 11, fontWeight: '800', color: COLORS.primaryDark },
  timeSlotTextActive: { color: '#fff' },

  fieldHint: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  fieldHintText: { fontSize: 12, fontWeight: '700', color: COLORS.gray[500] },

  payRow: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
    backgroundColor: '#EEF6FF',
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  payRowActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  payTitle: { fontSize: 13, fontWeight: '900', color: COLORS.primaryDark },
  payTitleActive: { color: '#fff' },
  paySub: { marginTop: 2, fontSize: 11, fontWeight: '700', color: COLORS.gray[600] },
  paySubActive: { color: 'rgba(255,255,255,0.8)' },
  couponBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    backgroundColor: '#fff',
  },
  couponRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  couponInput: { flex: 1 },
  availCouponWrap: { marginTop: 12, gap: 8 },
  availCouponHeading: { fontSize: 12, fontWeight: '900', color: COLORS.gray[600], marginBottom: 2 },
  availCouponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    backgroundColor: '#F8FAFF',
  },
  availCouponCardActive: { borderStyle: 'solid', borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  availCouponLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  availCouponCode: { fontSize: 13, fontWeight: '900', color: COLORS.primaryDark },
  availCouponDesc: { fontSize: 11, fontWeight: '700', color: COLORS.gray[600], marginTop: 1 },
  availCouponAction: { fontSize: 12, fontWeight: '900', color: COLORS.primary },
  availCouponActionActive: { color: '#047857' },
  couponBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  couponBtnDisabled: { backgroundColor: COLORS.gray[300] },
  couponBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  couponRemoveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    backgroundColor: '#fff',
  },
  couponRemoveText: { fontSize: 12, fontWeight: '900', color: COLORS.gray[700] },
  errorText: { marginTop: 6, fontSize: 11, fontWeight: '700', color: '#DC2626' },
  successText: { marginTop: 6, fontSize: 11, fontWeight: '800', color: '#059669' },
  couponAppliedBanner: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  couponAppliedCheck: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#059669',
    alignItems: 'center', justifyContent: 'center',
  },
  couponAppliedTitle: { fontSize: 13, fontWeight: '800', color: '#047857' },
  couponAppliedSub: { fontSize: 11, fontWeight: '700', color: '#059669', marginTop: 1 },
  couponAppliedRemove: { fontSize: 11, fontWeight: '900', color: '#DC2626', letterSpacing: 0.5 },
  payableBar: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  payableLabel: { fontSize: 14, fontWeight: '800', color: '#1E40AF' },
  payableValue: { fontSize: 22, fontWeight: '900', color: '#1D4ED8', letterSpacing: -0.3 },
  walletCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    backgroundColor: '#fff',
  },
  walletCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  walletHeaderText: { flex: 1, minWidth: 0, paddingRight: 4 },
  walletIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  walletHint: { fontSize: 11, fontWeight: '500', color: '#64748B', marginTop: 2, lineHeight: 15 },
  walletToggleWrap: { justifyContent: 'center', alignItems: 'center' },
  walletSwitch: { transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] },
  walletStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  walletStatBox: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8 },
  walletStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  walletStatValue: { fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 3 },
  walletStatValueAccent: { color: '#1D4ED8' },
  walletStatDivider: { width: 1, alignSelf: 'stretch', backgroundColor: '#E2E8F0' },
  walletAppliedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  walletAppliedText: { flex: 1, fontSize: 11, fontWeight: '700', color: '#047857', lineHeight: 15 },
  walletBlocked: { fontSize: 11, fontWeight: '600', color: '#DC2626', marginTop: 8, lineHeight: 15 },
  reviewBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
  },
  reviewClaimTag: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  reviewClaimTagLabel: { fontSize: 10, fontWeight: '800', color: '#92400E', textTransform: 'uppercase' },
  reviewClaimTagValue: { fontSize: 12, fontWeight: '700', color: '#78350F', marginTop: 3, lineHeight: 16 },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  reviewRowTop: {
    alignItems: 'flex-start',
  },
  reviewRowLabel: {
    minWidth: 96,
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    lineHeight: 19,
    flexShrink: 0,
  },
  reviewRowValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
    lineHeight: 18,
  },
  reviewRowValueWrap: {
    flexShrink: 1,
  },
  reviewRowValueDiscount: {
    color: '#16A34A',
    fontWeight: '800',
  },
  reviewRowValueStrike: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
    fontWeight: '600',
  },
  reviewDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 4,
    marginBottom: 12,
  },
  actions: { marginTop: SPACING.md, flexDirection: 'row', gap: 12 },
  secondaryBtn: {
    width: 110,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: '#EEF6FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: 'rgba(17,24,39,0.06)',
  },
  secondaryText: { fontWeight: '900', color: COLORS.primary, fontSize: 12 },
  secondaryTextDisabled: { color: COLORS.gray[400] },
  primaryBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  footerPad: { height: 40 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: COLORS.primaryDark, marginBottom: 10 },
  modalRow: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.06)',
    gap: 10,
  },
  modalRowText: { flex: 1, fontSize: 13, fontWeight: '900', color: COLORS.primaryDark },
  modalSub: { marginTop: 3, fontSize: 11, fontWeight: '700', color: COLORS.gray[600] },
  modalEmpty: { paddingVertical: 14, fontSize: 12, fontWeight: '800', color: COLORS.gray[600] },

  // Step 2 — plan card with checklist preview
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 12,
  },
  planCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0F7FF',
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planCardItems: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(17,24,39,0.06)',
    gap: 6,
  },
  planCardItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  planCardItemText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#374151',
    lineHeight: 17,
  },
  planViewAllBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  planViewAllText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.primary,
  },
  selectContinueBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  selectContinueBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  selectContinueBtnOutline: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  selectContinueBtnOutlineText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // MyFNG Prime Membership Promo
  membershipPromo: {
    marginTop: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  membershipPromoLine: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78350F',
    textAlign: 'center',
    marginBottom: 8,
  },
  membershipPromoBold: {
    fontWeight: '900',
    color: '#B45309',
  },
  membershipPromoPrice: {
    fontWeight: '900',
    color: '#16A34A',
    fontSize: 13,
  },
  membershipPromoStrike: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
    fontSize: 11,
  },
  membershipActivateBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  membershipActivateBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // FOMO Membership banners
  fomoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  fomoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fomoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78350F',
    lineHeight: 17,
  },
  fomoHighlight: {
    fontWeight: '900',
    color: '#B45309',
  },
  fomoCta: {
    fontSize: 12,
    fontWeight: '900',
    color: '#D97706',
  },
  fomoCardUrgent: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  fomoUrgentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  fomoUrgentTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  fomoUrgentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FEE2E2',
    lineHeight: 18,
    marginBottom: 10,
  },
  fomoUrgentBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 9,
    alignItems: 'center',
  },
  fomoUrgentBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#DC2626',
  },
  membershipSavingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  membershipSavingBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
    lineHeight: 17,
  },

  // Step 3 — flat section (matches Cart page clean UI)
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0,
    borderColor: 'transparent',
    paddingHorizontal: 0,
    paddingTop: 14,
    paddingBottom: 16,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIcoBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  requiredStar: {
    fontSize: 18,
    fontWeight: '900',
    color: '#EF4444',
    marginLeft: 2,
  },

  // Service Preference toggle
  servicePrefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  servicePrefSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  servicePrefIcoBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servicePrefLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  servicePrefToggle: {
    width: 64,
    height: 36,
    borderRadius: 999,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  servicePrefKnob: {
    position: 'absolute',
    top: 3,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  // Date pills (Step 3) — matched to Cart page styling
  datePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  datePillActive: {
    borderColor: '#1D4ED8',
    backgroundColor: '#EFF6FF',
  },
  datePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  datePillTextActive: {
    color: '#1D4ED8',
  },
  dateCalendarBtn: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: '#1D4ED8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dateCalendarBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },

  // Time slot tiles (Step 3) — matched to Cart page styling
  timeSlotTile: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSlotTileActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#7C3AED',
  },
  timeSlotTileDisabled: {
    opacity: 0.4,
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  timeSlotTileText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  timeSlotTileTextActive: {
    color: '#7C3AED',
  },
  timeSlotTileTextDisabled: {
    color: '#9CA3AF',
  },
  timeSelectedRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeSelectedText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#9333EA',
  },
  fieldHintCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
  },

  // Service Details / View All Points modal
  detailsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 24,
  },
  detailsCard: {
    width: '100%',
    maxHeight: Dimensions.get('window').height * 0.88,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  detailsHeader: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  detailsMetaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailsMetaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  detailsPtsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  detailsPtsPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#374151',
  },
  detailsOfficialPill: {
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  detailsOfficialText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  detailsCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsPriceRow: {
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailsPriceText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  detailsProceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: '#16A34A',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  detailsProceedText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  detailsBodyWrap: {
    flexShrink: 1,
    minHeight: 120,
    maxHeight: Dimensions.get('window').height * 0.5,
  },
  detailsBody: {
    flexGrow: 1,
  },
  detailsBodyContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 22,
  },
  detailsEmpty: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  detailsGrid: {
    flexDirection: 'column',
  },
  detailsGridRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  detailsGridItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  detailsGridItemText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 17,
  },

  // Booking Success modal
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  successCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  successIconWrap: {
    marginBottom: 18,
  },
  successIconRingOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconRingInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
  },
  successLeadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  successLeadText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#047857',
  },
  successMessage: {
    fontSize: 13.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  successInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
    marginBottom: 18,
  },
  successInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  successInfoIco: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successInfoText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  successMembershipCard: {
    width: '100%',
    marginTop: 16,
    marginBottom: 4,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    gap: 10,
  },
  successMembershipTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  successMembershipIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successMembershipTimerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: -4,
  },
  successMembershipTimerBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  successMembershipTimerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  successMembershipTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#991B1B',
  },
  successMembershipSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
    color: '#7F1D1D',
    lineHeight: 17,
    opacity: 0.85,
  },
  successMembershipWindow: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: '#B91C1C',
  },
  successMembershipPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successMembershipStrike: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  successMembershipPayable: {
    fontSize: 20,
    fontWeight: '900',
    color: '#DC2626',
  },
  successMembershipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 13,
  },
  successMembershipBtnDisabled: {
    opacity: 0.7,
  },
  successMembershipBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  successMembershipActivated: {
    width: '100%',
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successMembershipActivatedText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
  },
  successPrimaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  successPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  successSecondaryBtn: {
    marginTop: 10,
    paddingVertical: 10,
  },
  successSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
});
