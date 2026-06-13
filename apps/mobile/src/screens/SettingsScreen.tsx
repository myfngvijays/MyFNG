import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { clearCustomerSessionToken, getCustomerSessionToken } from '../lib/customerSession';
import { supabase } from '../lib/supabase';
import {
  LEGAL_SECTIONS,
  MEMBERSHIP_PLANS,
  PRIME_MEMBERSHIP,
  SUPPORT_FAQ_CATEGORIES,
} from '../constants/publicAppData';
import { COLORS } from '../constants/theme';
import ReferAndFooter from '../components/ReferAndFooter';
import { apiFetch } from '../lib/api';
import { openPhoneCall, openEmail } from '../lib/phone';
import { ENV } from '../config/environment';

type Props = {
  navigation: any;
  route: { params?: { initialSubPage?: string | null; subPage?: string | null } };
};

type MenuItem = { id: string; label: string; icon: keyof typeof Ionicons.glyphMap };

const MAIN_MENU: MenuItem[] = [
  { id: 'profile', label: 'My Profile', icon: 'person' },
  { id: 'addresses', label: 'Your Addresses', icon: 'location' },
  { id: 'membership', label: 'Membership', icon: 'trophy' },
  { id: 'orders', label: 'Order History', icon: 'receipt' },
  { id: 'cart', label: 'Cart', icon: 'cart' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications' },
];

const LEGAL_MENU: MenuItem[] = [
  { id: 'privacy', label: 'Privacy Policy', icon: 'shield-checkmark' },
  { id: 'terms', label: 'Terms of Use', icon: 'document-text' },
  { id: 'support', label: 'Help & Support', icon: 'help-circle' },
  { id: 'delete', label: 'Delete Account', icon: 'trash' },
];

const CAR_IMAGE_BASE_URL = 'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/car-brands-images';

// Maps a free-text service name to the PublicServicePackages category id (1-9).
function mapServiceNameToCategoryId(serviceName: string): string {
  const s = String(serviceName || '').toLowerCase();
  if (/\bac\b|air ?condition|cooling/.test(s)) return '2';
  if (/brake/.test(s)) return '3';
  if (/clutch/.test(s)) return '5';
  if (/battery|alternator/.test(s)) return '6';
  if (/tyre|tire|wheel|alignment|balancing/.test(s)) return '7';
  if (/dent|paint/.test(s)) return '9';
  if (/detail|polish|wax|ceramic|wash|cleaning|spa/.test(s)) return '8';
  if (/engine/.test(s)) return '4';
  if (/periodic|general|standard|comprehensive|basic|premium|service/.test(s)) return '1';
  return '1';
}

function getVehicleImageUris(vehicle: any): { primary: string; fallback: string } {
  const rawMake = String(vehicle?.make || vehicle?.vehicle_make || '').trim();
  const rawModel = String(vehicle?.model || vehicle?.model_name || vehicle?.vehicle_model || '').trim();
  const make = rawMake.toLowerCase().replace(/\s+/g, '-');
  const model = rawModel.toLowerCase().replace(/\s+/g, '-');
  const defaultImg = `${CAR_IMAGE_BASE_URL}/default-car.png`;
  if (!make) {
    return { primary: defaultImg, fallback: defaultImg };
  }
  const brandImg = `${CAR_IMAGE_BASE_URL}/${make}.png`;
  if (!model) {
    return { primary: brandImg, fallback: defaultImg };
  }
  const makePart = make.split('-')[0];
  const folderName = `${make}-cars`;
  const fileName = `${makePart}-${model}.png`;
  return { primary: `${CAR_IMAGE_BASE_URL}/${folderName}/${fileName}`, fallback: brandImg };
}

function VehicleImage({ vehicle, style }: { vehicle: any; style: any }) {
  const uris = useMemo(() => getVehicleImageUris(vehicle), [vehicle]);
  const [src, setSrc] = useState(uris.primary);
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    setSrc(uris.primary);
    setErrored(false);
  }, [uris.primary]);
  return (
    <Image
      source={{ uri: src }}
      style={style}
      resizeMode="contain"
      onError={() => {
        if (!errored && src !== uris.fallback) {
          setSrc(uris.fallback);
          setErrored(true);
        }
      }}
    />
  );
}

export default function SettingsScreen({ navigation, route }: Props) {
  const resolveSubPage = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const all = [...MAIN_MENU, ...LEGAL_MENU];
    const byLabel = all.find((m) => m.label === value);
    if (byLabel) return byLabel.label;
    const byId = all.find((m) => m.id === value);
    if (byId) return byId.label;
    return value;
  };
  const [activeSubPage, setActiveSubPage] = useState<string | null>(resolveSubPage(route?.params?.initialSubPage ?? route?.params?.subPage ?? null));
  const activeSubPageRef = useRef(activeSubPage);
  activeSubPageRef.current = activeSubPage;
  const [vehicleEntryOnly, setVehicleEntryOnly] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    email: '',
  });
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [referralCode, setReferralCode] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [selectedVehicleKey, setSelectedVehicleKey] = useState<string | null>(null);
  const [carSearch, setCarSearch] = useState('');
  const [carSuggestions, setCarSuggestions] = useState<any[]>([]);
  const [carSearchLoading, setCarSearchLoading] = useState(false);
  const [selectedCar, setSelectedCar] = useState<any | null>(null);
  const [regDate, setRegDate] = useState('');
  const [regDateValue, setRegDateValue] = useState<Date>(new Date());
  const [showRegDatePicker, setShowRegDatePicker] = useState(false);
  const [chassisNumber, setChassisNumber] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [insuranceExpiryValue, setInsuranceExpiryValue] = useState<Date>(new Date());
  const [showInsuranceDatePicker, setShowInsuranceDatePicker] = useState(false);
  const [odometerReading, setOdometerReading] = useState('');
  const [profileStep, setProfileStep] = useState(1);
  const [fuelType, setFuelType] = useState<'Petrol' | 'Diesel' | 'CNG' | ''>('');
  const [carNumberParts, setCarNumberParts] = useState<string[]>(['']);
  const [carSearchFocused, setCarSearchFocused] = useState(false);
  const carNumberRefs = useRef<Array<TextInput | null>>([]);

  const [addresses, setAddresses] = useState<Array<{ id: string; label: string; value: string; source: 'saved' | 'lead'; city?: string | null; state?: string | null; pincode?: string | null }>>([]);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [newAddrLabel, setNewAddrLabel] = useState<'Home' | 'Work' | 'Others'>('Home');
  const [newAddrLine1, setNewAddrLine1] = useState('');
  const [newAddrLine2, setNewAddrLine2] = useState('');
  const [newAddrArea, setNewAddrArea] = useState('');
  const [newAddrCity, setNewAddrCity] = useState('');
  const [newAddrState, setNewAddrState] = useState('');
  const [newAddrPincode, setNewAddrPincode] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [saveAddressLoading, setSaveAddressLoading] = useState(false);
  const [geoPoint, setGeoPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [membershipPlans, setMembershipPlans] = useState<any[]>([]);
  const [membershipBenefits, setMembershipBenefits] = useState<any[]>([]);
  const [currentMembership, setCurrentMembership] = useState<any | null>(null);
  const [selectedMembershipIdx, setSelectedMembershipIdx] = useState(0);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [addSecondCar, setAddSecondCar] = useState(false);
  const [showReferTnC, setShowReferTnC] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [walletRewardPoints, setWalletRewardPoints] = useState(0);
  const [walletEarnedCashback, setWalletEarnedCashback] = useState(0);
  const [walletReferralRewards, setWalletReferralRewards] = useState(0);
  const [walletAddAmount, setWalletAddAmount] = useState('');
  const [walletTxFilter, setWalletTxFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [walletPromoCode, setWalletPromoCode] = useState('');
  const [orderFilter, setOrderFilter] = useState<'All' | 'Completed' | 'Upcoming' | 'Ongoing' | 'Cancelled'>('All');
  const [orderDetailModal, setOrderDetailModal] = useState<any>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [cartServiceMode, setCartServiceMode] = useState<'pickup' | 'workshop'>('pickup');
  const [cartPaymentMode, setCartPaymentMode] = useState<'pay_now' | 'pay_later'>('pay_now');
  const [cartDate, setCartDate] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [cartTime, setCartTime] = useState(() => {
    const next = new Date();
    next.setHours(10, 0, 0, 0);
    return next;
  });
  const [cartDateStr, setCartDateStr] = useState('');
  const [cartTimeStr, setCartTimeStr] = useState('');
  const [showCartDatePicker, setShowCartDatePicker] = useState(false);
  const [showCartTimePicker, setShowCartTimePicker] = useState(false);
  const [cartCouponResult, setCartCouponResult] = useState<any>(null);
  const [cartCouponLoading, setCartCouponLoading] = useState(false);
  const [cartAvailableCoupons, setCartAvailableCoupons] = useState<any[]>([]);
  const [cartSelectedService, setCartSelectedService] = useState<{ name: string; price: number; items: string[] } | null>(null);
  const [cartLeads, setCartLeads] = useState<any[]>([]);
  const [cartSelectedLeadId, setCartSelectedLeadId] = useState<string | null>(null);
  const [cartWorkshops, setCartWorkshops] = useState<any[]>([]);
  const [cartWorkshopLoading, setCartWorkshopLoading] = useState(false);
  const [cartSelectedWorkshopId, setCartSelectedWorkshopId] = useState<string | null>(null);
  const [cartPickupAddressId, setCartPickupAddressId] = useState<string | null>(null);
  const [cartBookingLoading, setCartBookingLoading] = useState(false);
  const [cartServerCart, setCartServerCart] = useState<any>(null);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartSyncing, setCartSyncing] = useState(false);
  const [showInlinePickupAdd, setShowInlinePickupAdd] = useState(false);
  const [pickupForm, setPickupForm] = useState<{ label: 'Home' | 'Work' | 'Others'; line1: string; line2: string; city: string; pincode: string }>(
    { label: 'Home', line1: '', line2: '', city: '', pincode: '' }
  );
  const [pickupSaving, setPickupSaving] = useState(false);
  const [pickupLocationLoading, setPickupLocationLoading] = useState(false);
  const [notifState, setNotifState] = useState({
    push: true,
    sms: true,
    email: true,
    order: true,
    promos: false,
    wallet: true,
    referral: true,
    support: true,
  });
  const [selectedFaqCategory, setSelectedFaqCategory] = useState<string | null>(null);
  // Legal sections are now rendered inline (fully expanded). No modal state needed.
  const [faqModal, setFaqModal] = useState<{ question: string; answer: string } | null>(null);

  const supportFaqs = useMemo(() => {
    if (!selectedFaqCategory) return [];
    return SUPPORT_FAQ_CATEGORIES[selectedFaqCategory] || [];
  }, [selectedFaqCategory]);
  const vehiclePagerRef = useRef<FlatList<any> | null>(null);
  const screenWidth = Dimensions.get('window').width;
  const vehicleCardWidth = useMemo(() => Math.max(280, screenWidth - 64), [screenWidth]);
  const vehicleCardSnapInterval = useMemo(() => vehicleCardWidth + 10, [vehicleCardWidth]);

  const toTitleCase = useCallback((value: string) => {
    return String(value || '')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }, []);

  const subtotal = useMemo(() => {
    if (cartItems && cartItems.length > 0) {
      return cartItems.reduce((sum: number, item: any) => sum + Number(item?.total_price || 0), 0);
    }
    return Number(cartServerCart?.subtotal || cartSelectedService?.price || 0);
  }, [cartItems, cartServerCart, cartSelectedService]);
  const couponDiscount = useMemo(() => Number(cartCouponResult?.discount_amount || 0), [cartCouponResult]);
  const walletUsed = useMemo(() => Math.min(Number(walletBalance || 0), Math.max(0, subtotal - couponDiscount)), [walletBalance, subtotal, couponDiscount]);
  const referralUsed = useMemo(() => 0, []);
  const finalAmount = useMemo(() => Math.max(0, subtotal - couponDiscount - walletUsed - referralUsed), [subtotal, couponDiscount, walletUsed, referralUsed]);
  const formattedCartDate = useMemo(
    () =>
      cartDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
    [cartDate]
  );
  const formattedCartTime = useMemo(
    () =>
      cartTime.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [cartTime]
  );
  const savedAddresses = useMemo(
    () => addresses.filter((address) => address.source === 'saved'),
    [addresses]
  );
  const selectedPickupAddress = useMemo(
    () => savedAddresses.find((address) => address.id === cartPickupAddressId) || null,
    [savedAddresses, cartPickupAddressId]
  );

  const applyCartCoupon = useCallback(async (overrideCode?: string) => {
    const code = String(overrideCode || coupon || '').trim().toUpperCase();
    if (!code) {
      Alert.alert('Coupon', 'Please enter coupon code.');
      return;
    }
    if (overrideCode) setCoupon(code);
    setCartCouponLoading(true);
    try {
      const serviceItems = (cartItems || []).length > 0
        ? cartItems.map((it: any) => ({ label: String(it?.service_type || 'Service'), price: Number(it?.total_price || 0) }))
        : cartSelectedService
        ? [{ label: cartSelectedService.name, price: cartSelectedService.price }]
        : [];
      const payload = {
        code,
        lead_context: {
          subtotal,
          customer_phone: profileForm.phone || null,
          service_items: serviceItems,
        },
      };
      const res = await fetch(`${ENV.API_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data?.valid) {
        setCartCouponResult(data);
        Alert.alert('Coupon Applied', `You saved ₹${Math.round(Number(data.discount_amount || 0)).toLocaleString('en-IN')}.`);
      } else {
        setCartCouponResult(null);
        Alert.alert('Coupon', String(data?.error || 'Coupon is not applicable.'));
      }
    } catch (_e) {
      setCartCouponResult(null);
      Alert.alert('Coupon', 'Unable to validate coupon. Please try again.');
    } finally {
      setCartCouponLoading(false);
    }
  }, [coupon, subtotal, profileForm.phone, cartItems, cartSelectedService]);

  const fetchCartCoupons = useCallback(async () => {
    try {
      const res = await fetch(`${ENV.API_URL}/api/coupons/active`);
      const json = await res.json().catch(() => ({}));
      setCartAvailableCoupons(Array.isArray(json?.coupons) ? json.coupons : []);
    } catch {
      setCartAvailableCoupons([]);
    }
  }, []);

  const describeCartCoupon = (c: any): string => {
    const mode = String(c?.discount_mode || '').toUpperCase();
    const val = Number(c?.discount_value || 0);
    if (c?.coupon_kind === 'FREE_SERVICE') return 'Free service';
    if (mode === 'PERCENT' && val > 0) return `${val}% OFF`;
    if ((mode === 'AMOUNT' || mode === 'FLAT' || mode === 'FIXED') && val > 0) return `₹${val} OFF`;
    if (c?.description) return String(c.description);
    return 'Offer';
  };

  const loadCart = useCallback(async () => {
    setCartLoading(true);
    try {
      const res = await apiFetch<any>('/api/customer/cart');
      setCartServerCart(res?.cart || null);
      const items = Array.isArray(res?.items) ? res.items : [];
      setCartItems(items);
    } catch (_err) {
      setCartServerCart(null);
      setCartItems([]);
    } finally {
      setCartLoading(false);
    }
  }, []);

  const addCartItem = useCallback(
    async (
      serviceType: string,
      unitPrice: number,
      quantity = 1,
      metadata?: Record<string, any>,
    ) => {
      const cleanService = String(serviceType || '').trim();
      if (!cleanService) return;
      setCartSyncing(true);
      try {
        await apiFetch('/api/customer/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_type: cleanService,
            quantity: Math.max(1, Math.floor(quantity || 1)),
            unit_price: Math.max(0, Number(unitPrice) || 0),
            metadata: metadata && typeof metadata === 'object' ? metadata : {},
          }),
        });
        await loadCart();
      } catch (err: any) {
        Alert.alert('Cart', err?.message || 'Could not add item to cart.');
      } finally {
        setCartSyncing(false);
      }
    },
    [loadCart],
  );

  const removeCartItem = useCallback(
    async (itemId: string) => {
      if (!itemId) return;
      setCartSyncing(true);
      try {
        await apiFetch(`/api/customer/cart?item_id=${encodeURIComponent(itemId)}`, {
          method: 'DELETE',
        });
        await loadCart();
      } catch (err: any) {
        Alert.alert('Cart', err?.message || 'Could not remove item.');
      } finally {
        setCartSyncing(false);
      }
    },
    [loadCart],
  );

  const resetPickupForm = useCallback(() => {
    setPickupForm({ label: 'Home', line1: '', line2: '', city: '', pincode: '' });
    setShowInlinePickupAdd(false);
  }, []);

  const handlePickupQuickLocation = useCallback(async () => {
    setPickupLocationLoading(true);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!servicesEnabled) {
        Alert.alert(
          'Location is off',
          'Please turn on Location / GPS from your phone settings and try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow location access to autofill the address.');
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
        Alert.alert('Location', 'Could not fetch your current location. Please try again.');
        return;
      }
      const { latitude, longitude } = (position as any).coords;
      const places = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
      const p = (places && places[0]) || {};
      setPickupForm((prev) => ({
        ...prev,
        line1: prev.line1 || String((p as any).name || (p as any).street || '').trim(),
        line2: prev.line2 || String((p as any).district || (p as any).subregion || '').trim(),
        city: prev.city || String((p as any).city || (p as any).subregion || '').trim(),
        pincode: prev.pincode || String((p as any).postalCode || '').trim(),
      }));
    } catch (_err) {
      Alert.alert('Location', 'Unable to autofill address. Please enter manually.');
    } finally {
      setPickupLocationLoading(false);
    }
  }, []);

  const handleSaveInlinePickup = useCallback(async () => {
    const line1 = pickupForm.line1.trim();
    if (!line1) {
      Alert.alert('Address', 'Please enter address line 1.');
      return;
    }
    setPickupSaving(true);
    try {
      const res = await apiFetch<any>('/api/customer/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: pickupForm.label,
          line1,
          line2: pickupForm.line2.trim() || null,
          city: pickupForm.city.trim() || null,
          pincode: pickupForm.pincode.trim() || null,
        }),
      });
      const newId = res?.address?.id ? String(res.address.id) : null;
      await hydrateCustomerData();
      if (newId) setCartPickupAddressId(newId);
      resetPickupForm();
    } catch (err: any) {
      Alert.alert('Address', err?.message || 'Could not save address.');
    } finally {
      setPickupSaving(false);
    }
  }, [pickupForm, resetPickupForm]);

  const hydrateCustomerData = useCallback(async () => {
    setDataLoading(true);
    try {
      // Use allSettled so a single failing endpoint (e.g. wallet/referral)
      // never wipes out the rest of the profile (name, vehicles, orders).
      const settled = await Promise.allSettled([
        apiFetch<any>('/api/customer/profile'),
        apiFetch<any>('/api/customer/vehicles'),
        apiFetch<any>('/api/customer/orders'),
        apiFetch<any>('/api/customer/wallet'),
        apiFetch<any>('/api/customer/referral'),
        apiFetch<any>('/api/customer/leads'),
      ]);
      const valueOf = (i: number) => (settled[i]?.status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<any>).value : null);
      const profileRes = valueOf(0);
      const vehiclesRes = valueOf(1);
      const ordersRes = valueOf(2);
      const walletRes = valueOf(3);
      const referralRes = valueOf(4);
      const leadsRes = valueOf(5);

      const customer = profileRes?.customer || {};
      setCustomerId(customer?.id ? String(customer.id) : null);
      setProfileImageUrl(customer?.profile_image || null);
      setProfileForm({
        name: String(customer?.full_name || ''),
        phone: String(customer?.phone || ''),
        email: String(customer?.email || ''),
      });

      const mappedAddresses = (profileRes?.addresses || []).map((a: any) => {
        const fullAddress = [
          a?.line1,
          a?.line2,
          a?.address_line1,
          a?.address_line2,
          a?.landmark,
          a?.city,
          a?.state,
          a?.pincode,
        ]
          .map((v) => String(v || '').trim())
          .filter(Boolean)
          .join(', ');
        return {
          id: String(a?.id || Date.now()),
          label: String(a?.label || a?.address_type || 'Address'),
          value: fullAddress || String(a?.address || '').trim() || 'Address not available',
          source: 'saved' as const,
          city: a?.city ? String(a.city) : null,
          state: a?.state ? String(a.state) : null,
          pincode: a?.pincode ? String(a.pincode) : null,
        };
      });

      const mappedLeadAddresses = (leadsRes?.leads || [])
        .map((lead: any, idx: number) => {
          const fullAddress = [
            lead?.address,
            lead?.city,
            lead?.state,
            lead?.pincode,
          ]
            .map((v) => String(v || '').trim())
            .filter(Boolean)
            .join(', ');
          if (!fullAddress) return null;
          return {
            id: `lead-${String(lead?.id || idx)}`,
            label: 'Service Address',
            value: fullAddress,
            source: 'lead' as const,
            city: lead?.city ? String(lead.city) : null,
            state: lead?.state ? String(lead.state) : null,
            pincode: lead?.pincode ? String(lead.pincode) : null,
          };
        })
        .filter(Boolean) as Array<{ id: string; label: string; value: string; source: 'saved' | 'lead'; city?: string | null; state?: string | null; pincode?: string | null }>;

      const existingIds = new Set(mappedAddresses.map((a: { id: string }) => a.id));
      const uniqueLeadAddresses = mappedLeadAddresses.filter((a: { id: string }) => !existingIds.has(a.id));
      setAddresses([...mappedAddresses, ...uniqueLeadAddresses]);
      setVehicles(Array.isArray(vehiclesRes?.vehicles) ? vehiclesRes.vehicles : []);
      setOrders(Array.isArray(ordersRes?.orders) ? ordersRes.orders : []);
      setCartLeads(Array.isArray(leadsRes?.leads) ? leadsRes.leads : []);
      setWalletBalance(Number(walletRes?.wallet?.current_balance || 0));
      setReferralCode(String(referralRes?.code?.code || ''));
    } catch (_err) {
      // Keep UI usable even if one endpoint fails.
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    const sp = route?.params?.subPage;
    if (sp) setActiveSubPage(resolveSubPage(sp));
  }, [route?.params?.subPage]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const token = await getCustomerSessionToken();
        if (!active) return;
        const loggedIn = Boolean(token);
        setIsLoggedIn(loggedIn);
        if (!loggedIn) {
          setCustomerId(null);
          setProfileForm({ name: '', phone: '', email: '' });
          setVehicles([]);
          setOrders([]);
          setAddresses([]);
          setCartLeads([]);
          setCartItems([]);
          setCartServerCart(null);
          setShowAddAddress(false);
          setWalletBalance(0);
          setReferralCode('');
          return;
        }
        await hydrateCustomerData();
      })();
      return () => {
        active = false;
      };
    }, [hydrateCustomerData]),
  );

  useEffect(() => {
    const onHardwareBack = () => {
      if (faqModal) { setFaqModal(null); return true; }
      if (showAddAddress) { setShowAddAddress(false); return true; }
      if (showProfileEditor) { setShowProfileEditor(false); return true; }
      if (vehicleEntryOnly) { setVehicleEntryOnly(false); return true; }
      if (activeSubPage) { setActiveSubPage(null); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [activeSubPage, faqModal, showAddAddress, showProfileEditor, vehicleEntryOnly]);

  const primaryVehicle = useMemo(() => {
    // Prefer latest vehicle from order history because orders are tied to logged-in customer phone.
    const latestOrderWithVehicle = (orders || []).find((o: any) => Boolean(o?.vehicle_number || o?.vehicle_model));
    if (latestOrderWithVehicle) {
      return {
        vehicle_number: latestOrderWithVehicle.vehicle_number || null,
        make: latestOrderWithVehicle.vehicle_make || null,
        model: latestOrderWithVehicle.vehicle_model || null,
        fuel_type: latestOrderWithVehicle.fuel_type || null,
        year: latestOrderWithVehicle.year || null,
        is_default: true,
      };
    }

    if (!vehicles.length) return null;
    return vehicles.find((v) => Boolean(v?.is_default)) || vehicles[0];
  }, [orders, vehicles]);

  const allAssociatedVehicles = useMemo(() => {
    const map = new Map<string, any>();
    const INVALID_PLATES = new Set(['', 'NA', 'N/A', 'NONE', 'NULL', 'UNDEFINED']);
    const normalizePlate = (raw: any) => {
      const plate = String(raw || '').trim().toUpperCase();
      return INVALID_PLATES.has(plate) ? '' : plate;
    };

    // Real saved vehicles take priority (they have authoritative make/model/plate).
    (vehicles || []).forEach((v: any) => {
      const plate = normalizePlate(v?.vehicle_number);
      const make = String(v?.make || '').trim();
      const model = String(v?.model || '').trim();
      const key = plate || `${make}-${model}`.trim().toUpperCase();
      if (!key) return;
      map.set(key, {
        id: v?.id || null,
        vehicle_number: plate || null,
        make: make || null,
        model: model || null,
        fuel_type: v?.fuel_type || null,
        year: v?.year || null,
      });
    });

    // Add order-derived vehicles only if they aren't already covered by a saved vehicle.
    (orders || []).forEach((o: any) => {
      const plate = normalizePlate(o?.vehicle_number);
      const make = String(o?.vehicle_make || '').trim();
      const model = String(o?.vehicle_model || '').trim();
      if (!make && !model && !plate) return;
      const key = plate || `${make}-${model}`.trim().toUpperCase();
      if (!key) return;
      // If a saved vehicle already matches by plate OR make-model, skip.
      const makeModelKey = `${make}-${model}`.trim().toUpperCase();
      if (map.has(key) || (makeModelKey && map.has(makeModelKey))) return;
      map.set(key, {
        id: null,
        vehicle_number: plate || null,
        make: make || null,
        model: model || null,
        fuel_type: o?.fuel_type || null,
        year: o?.year || null,
      });
    });

    return Array.from(map.values());
  }, [orders, vehicles]);

  useEffect(() => {
    if (!allAssociatedVehicles.length) {
      setSelectedVehicleKey(null);
      return;
    }
    const currentExists = allAssociatedVehicles.some((v, idx) => {
      const plate = String(v?.vehicle_number || '').trim().toUpperCase();
      const key = plate || `vehicle-${idx}`;
      return key === selectedVehicleKey;
    });
    if (!currentExists) {
      const first = allAssociatedVehicles[0];
      const firstPlate = String(first?.vehicle_number || '').trim().toUpperCase();
      setSelectedVehicleKey(firstPlate || 'vehicle-0');
    }
  }, [allAssociatedVehicles, selectedVehicleKey]);

  const selectedVehicle = useMemo(() => {
    if (!allAssociatedVehicles.length) return primaryVehicle;
    const found = allAssociatedVehicles.find((v, idx) => {
      const plate = String(v?.vehicle_number || '').trim().toUpperCase();
      const key = plate || `vehicle-${idx}`;
      return key === selectedVehicleKey;
    });
    return found || allAssociatedVehicles[0] || primaryVehicle;
  }, [allAssociatedVehicles, selectedVehicleKey, primaryVehicle]);

  const vehicleCarouselData = useMemo(() => {
    if (allAssociatedVehicles.length > 0) return allAssociatedVehicles;
    if (selectedVehicle) return [selectedVehicle];
    return [];
  }, [allAssociatedVehicles, selectedVehicle]);

  const activeVehicleIndex = useMemo(() => {
    const idx = vehicleCarouselData.findIndex((vehicle, index) => {
      const plate = String(vehicle?.vehicle_number || '').trim().toUpperCase();
      const key = plate || `vehicle-${index}`;
      return key === selectedVehicleKey;
    });
    return idx >= 0 ? idx : 0;
  }, [vehicleCarouselData, selectedVehicleKey]);

  const persistProfile = async (collapseEditor = true) => {
    try {
      await apiFetch('/api/customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: profileForm.name,
          email: profileForm.email,
        }),
      });
      await hydrateCustomerData();
      if (collapseEditor) setShowProfileEditor(false);
      return true;
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Unable to save profile');
      return false;
    }
  };

  const handleProfileSave = async () => {
    await persistProfile();
  };

  const launchGalleryPicker = async () => {
    if (Platform.OS === 'ios') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow photo library access to upload profile picture.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadProfileImage(result.assets[0].uri);
    }
  };

  const launchCameraPicker = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow camera access to take profile picture.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadProfileImage(result.assets[0].uri);
    }
  };

  const pickAndUploadProfileImage = () => {
    if (!isLoggedIn) {
      Alert.alert('Login required', 'Please login to upload profile picture.');
      return;
    }
    Alert.alert('Profile Picture', 'Choose an option', [
      {
        text: 'Camera',
        onPress: () => setTimeout(() => { void launchCameraPicker(); }, 300),
      },
      {
        text: 'Gallery',
        onPress: () => setTimeout(() => { void launchGalleryPicker(); }, 300),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadProfileImage = async (uri: string) => {
    try {
      const filename = uri.split('/').pop() || 'profile.jpg';
      const customerSessionToken = await getCustomerSessionToken();
      if (!customerSessionToken) throw new Error('Not authenticated');

      const formData = new FormData();
      // @ts-ignore - React Native FormData handles file objects this way
      formData.append('file', { uri, name: filename, type: 'image/jpeg' });
      formData.append('folder', 'customer-profiles');

      const uploadRes = await fetch(`${ENV.API_URL}/api/customer/upload`, {
        method: 'POST',
        headers: { 'x-customer-session': customerSessionToken },
        body: formData,
      });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error(uploadJson?.error || 'Upload failed');

      const imageUrl = uploadJson.url;
      await apiFetch('/api/customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_image: imageUrl }),
      });
      setProfileImageUrl(imageUrl);
      Alert.alert('Success', 'Profile picture updated!');
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message || 'Could not upload image.');
    }
  };

  useEffect(() => {
    if (activeSubPage !== 'My Profile') return;
    if (!selectedVehicle) return;

    const searchText = [selectedVehicle?.make, selectedVehicle?.model].filter(Boolean).join(' ').trim();
    if (searchText) {
      setCarSearch(searchText);
      setSelectedCar({
        make: String(selectedVehicle?.make || '').trim(),
        model: String(selectedVehicle?.model || '').trim(),
      });
    }

    if (selectedVehicle?.fuel_type) {
      const vehicleFuel = String(selectedVehicle.fuel_type).trim().toLowerCase();
      if (vehicleFuel.includes('petrol')) setFuelType('Petrol');
      else if (vehicleFuel.includes('diesel')) setFuelType('Diesel');
      else if (vehicleFuel.includes('cng')) setFuelType('CNG');
    }

    const vehicleYear = String(selectedVehicle?.year || '').trim();
    if (vehicleYear) {
      setRegDate((prev) => prev || vehicleYear);
    }

    const rawVehicleNumber = String(selectedVehicle?.vehicle_number || '').toUpperCase();
    if (!rawVehicleNumber) return;
    const compact = rawVehicleNumber.replace(/[^A-Z0-9]/g, '');
    setCarNumberParts([compact]);
  }, [activeSubPage, selectedVehicle]);

  useEffect(() => {
    if (activeSubPage !== 'My Profile') return;
    const query = carSearch.trim();
    if (query.length < 2) {
      setCarSuggestions([]);
      setCarSearchLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setCarSearchLoading(true);
      try {
        const response = await fetch(`${ENV.API_URL}/api/car-models/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        const models = Array.isArray(data?.models) ? data.models : [];
        setCarSuggestions(models);
      } catch (_error) {
        setCarSuggestions([]);
      } finally {
        setCarSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [carSearch, activeSubPage]);

  useEffect(() => {
    if (activeSubPage !== 'Your Wallet') return;
    if (!isLoggedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const txRes = await apiFetch<any>('/api/customer/wallet/transactions').catch(() => null);
        const txs: any[] = Array.isArray(txRes?.transactions) ? txRes.transactions : [];
        if (!cancelled) {
          setWalletTransactions(txs);
          const credits = txs.filter((t: any) => t.transaction_type === 'CREDIT');
          const cashback = credits.filter((t: any) => String(t.source || '').includes('CASHBACK')).reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
          const referral = credits.filter((t: any) => String(t.source || '').includes('REFERRAL')).reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
          setWalletEarnedCashback(cashback);
          setWalletReferralRewards(referral);
        }
      } catch (_e) { /* keep UI usable */ }
    })();
    return () => { cancelled = true; };
  }, [activeSubPage, isLoggedIn]);

  useEffect(() => {
    if (activeSubPage !== 'Cart') return;
    if (!isLoggedIn) return;
    loadCart();
    fetchCartCoupons();
  }, [activeSubPage, isLoggedIn, loadCart, fetchCartCoupons]);

  useEffect(() => {
    if (activeSubPage !== 'Cart') return;
    const resumableStatuses = new Set(['NEW', 'PENDING', 'IN_PROGRESS', 'ASSIGNED', 'CONFIRMED', 'OPEN']);
    const resumableLead = (cartLeads || []).find((lead: any) => resumableStatuses.has(String(lead?.status || '').toUpperCase()));
    const latestOrder = orders[0];
    const serviceName = String(
      resumableLead?.plan_name ||
        resumableLead?.package_name ||
        resumableLead?.service_type ||
        latestOrder?.plan_name ||
        latestOrder?.package_name ||
        latestOrder?.service_display ||
        latestOrder?.service_type ||
        'Periodic Service Package'
    ).trim();
    const servicePriceRaw = Number(resumableLead?.estimated_amount || latestOrder?.amount_display || 2999);
    const servicePrice = Number.isFinite(servicePriceRaw) && servicePriceRaw > 0 ? Math.round(servicePriceRaw) : 2999;
    const defaultChecklist = serviceName.toLowerCase().includes('periodic')
      ? ['Engine Oil Change', 'Oil Filter Replacement', 'General Inspection']
      : ['Service Checklist', 'Basic Diagnostics', 'General Inspection'];
    setCartSelectedLeadId(resumableLead?.id ? String(resumableLead.id) : null);
    setCartSelectedService({
      name: serviceName,
      price: servicePrice,
      items: defaultChecklist,
    });
  }, [activeSubPage, orders, cartLeads]);

  useEffect(() => {
    if (!savedAddresses.length) {
      setCartPickupAddressId(null);
      return;
    }
    const currentExists = savedAddresses.some((address) => address.id === cartPickupAddressId);
    if (!currentExists) {
      setCartPickupAddressId(savedAddresses[0].id);
    }
  }, [savedAddresses, cartPickupAddressId]);

  const fetchCartWorkshops = useCallback(async () => {
    setCartWorkshopLoading(true);
    try {
      const selectedAddress = savedAddresses.find((address) => address.id === cartPickupAddressId);
      const cityFromAddress = String(selectedAddress?.city || '').trim();
      const cityFromValue = String(
        selectedAddress?.value.split(',').map((part) => part.trim()).find((part) => /^[A-Za-z ]+$/.test(part)) ||
          ''
      ).trim();
      const searchCity = cityFromAddress || cityFromValue;
      const qs = new URLSearchParams();
      if (searchCity) qs.set('city', searchCity);
      qs.set('limit', '50');
      const res = await fetch(`${ENV.API_URL}/api/customer/workshops?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || 'Unable to load workshops');
      const nextWorkshops = Array.isArray((data as any)?.workshops) ? (data as any).workshops : [];
      setCartWorkshops(nextWorkshops);
      if (nextWorkshops.length > 0 && !cartSelectedWorkshopId) {
        setCartSelectedWorkshopId(String(nextWorkshops[0].id));
      } else if (nextWorkshops.length === 0) {
        setCartSelectedWorkshopId(null);
      }
    } catch (_e) {
      setCartWorkshops([]);
      setCartSelectedWorkshopId(null);
    } finally {
      setCartWorkshopLoading(false);
    }
  }, [savedAddresses, cartPickupAddressId, cartSelectedWorkshopId]);

  useEffect(() => {
    if (activeSubPage !== 'Cart') return;
    if (cartServiceMode !== 'workshop') return;
    fetchCartWorkshops();
  }, [activeSubPage, cartServiceMode, cartPickupAddressId, fetchCartWorkshops]);

  useEffect(() => {
    if (activeSubPage !== 'Help & Support') return;
    if (!selectedFaqCategory) setSelectedFaqCategory('Account');
  }, [activeSubPage, selectedFaqCategory]);

  useEffect(() => {
    if (activeSubPage !== 'Membership') return;
    let cancelled = false;
    (async () => {
      setMembershipLoading(true);
      try {
        const plansRes = await apiFetch<any>('/api/customer/membership/plans').catch(() => null);
        const dbPlans: any[] = Array.isArray(plansRes?.plans) ? plansRes.plans : [];
        const dbBenefits: any[] = Array.isArray(plansRes?.benefits) ? plansRes.benefits : [];

        const displayPlans = dbPlans.length > 0
          ? dbPlans.map((p: any) => ({
              id: p.id,
              name: p.code === 'BRONZE' ? 'MyFNG Go' : p.code === 'SILVER' ? 'MyFNG Pro' : p.code === 'GOLD' ? 'MyFNG Max' : p.name,
              price: `₹${Number(p.price || 0).toLocaleString('en-IN')}`,
              priceNum: Number(p.price || 0),
              color: p.code === 'BRONZE' ? '#3B82F6' : p.code === 'SILVER' ? '#8B5CF6' : '#F97316',
              code: p.code,
              raw: p,
            }))
          : MEMBERSHIP_PLANS.map((p, idx) => ({
              id: String(idx),
              name: p.name,
              price: p.price,
              priceNum: idx === 0 ? 499 : idx === 1 ? 1499 : 2999,
              color: p.color,
              code: idx === 0 ? 'BRONZE' : idx === 1 ? 'SILVER' : 'GOLD',
              raw: null,
            }));

        if (!cancelled) {
          setMembershipPlans(displayPlans);
          setMembershipBenefits(dbBenefits);
        }

        if (isLoggedIn) {
          const memRes = await apiFetch<any>('/api/customer/membership').catch(() => null);
          if (!cancelled && memRes?.membership) {
            setCurrentMembership(memRes.membership);
            const currentIdx = displayPlans.findIndex((dp: any) => dp.id === memRes.membership.plan_id);
            if (currentIdx >= 0) setSelectedMembershipIdx(currentIdx);
          }
        }
      } catch (_err) {
        if (!cancelled) {
          setMembershipPlans(
            MEMBERSHIP_PLANS.map((p, idx) => ({
              id: String(idx),
              name: p.name,
              price: p.price,
              priceNum: idx === 0 ? 499 : idx === 1 ? 1499 : 2999,
              color: p.color,
              code: idx === 0 ? 'BRONZE' : idx === 1 ? 'SILVER' : 'GOLD',
              raw: null,
            })),
          );
        }
      } finally {
        if (!cancelled) setMembershipLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeSubPage, isLoggedIn]);

  const selectedPlanBenefits = useMemo(() => {
    if (!membershipPlans.length) return [];
    const plan = membershipPlans[selectedMembershipIdx];
    if (!plan) return [];
    const planBenefits = membershipBenefits.filter((b: any) => b.plan_id === plan.id);
    if (planBenefits.length > 0) return planBenefits;
    const fallbackMap: Record<string, Array<{ title: string; description: string; icon: string }>> = {
      BRONZE: [
        { title: 'Free Pickup & Drop', description: '2 free pickup and drop sessions per year', icon: 'car-outline' },
        { title: 'Standard Service', description: 'Standard service turnaround time', icon: 'time-outline' },
        { title: '5% Off Spares', description: 'Additional 5% discount on all spare parts', icon: 'pricetag-outline' },
        { title: 'Basic Car Wash', description: 'Get 1 free exterior car wash per year', icon: 'water-outline' },
      ],
      SILVER: [
        { title: 'Free Pickup & Drop', description: '4 free pickup and drop sessions per year', icon: 'car-outline' },
        { title: 'Priority Service', description: 'Priority workshop slot booking', icon: 'flash-outline' },
        { title: '10% Off Spares', description: '10% discount on all spare parts', icon: 'pricetag-outline' },
        { title: '₹200 Wallet Cashback', description: 'Per service wallet cashback', icon: 'wallet-outline' },
        { title: 'Free Car Wash', description: '2 free interior + exterior washes per year', icon: 'water-outline' },
      ],
      GOLD: [
        { title: 'Unlimited Pickup & Drop', description: 'Free pickup & drop on every service', icon: 'car-outline' },
        { title: 'VIP Priority', description: 'Highest priority with dedicated advisor', icon: 'star-outline' },
        { title: '15% Off Spares', description: '15% discount on all spare parts', icon: 'pricetag-outline' },
        { title: '₹500 Wallet Cashback', description: 'Per service wallet cashback', icon: 'wallet-outline' },
        { title: 'Free Car Wash & Detailing', description: '4 free washes + 1 detailing per year', icon: 'water-outline' },
        { title: 'Extended Warranty', description: '6 months extended warranty on services', icon: 'shield-checkmark-outline' },
      ],
    };
    return (fallbackMap[plan.code] || fallbackMap.BRONZE).map((b, idx) => ({ ...b, id: `fb-${idx}` }));
  }, [membershipPlans, selectedMembershipIdx, membershipBenefits]);

  const viewOrderDetails = async (orderId: string) => {
    setOrderDetailLoading(true);
    try {
      const res = await apiFetch<any>(`/api/customer/orders/${orderId}`);
      setOrderDetailModal(res);
    } catch {
      Alert.alert('Error', 'Could not load order details.');
    } finally {
      setOrderDetailLoading(false);
    }
  };

  const handleMembershipUpgrade = async () => {
    if (!isLoggedIn) {
      setVehicleEntryOnly(false);
      setActiveSubPage('My Profile');
      return;
    }
    const plan =
      membershipPlans.find((p: any) => String(p?.code || '').toUpperCase() === 'PRIME' && p?.raw?.id) ||
      membershipPlans.find((p: any) => p?.raw?.id) ||
      membershipPlans[selectedMembershipIdx];
    if (!plan?.raw?.id) {
      Alert.alert('Membership', 'Plan details not available. Please try again.');
      return;
    }
    if (currentMembership?.plan_id === plan.raw.id) {
      Alert.alert('Already subscribed', `You are already on ${plan.name}.`);
      return;
    }
    try {
      const orderRes = await apiFetch<any>('/api/customer/membership/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: plan.raw.id, add_second_car: addSecondCar }),
      });

      if (!orderRes?.order_id) {
        Alert.alert('Error', orderRes?.error || 'Could not create payment order. Please try again.');
        return;
      }

      let RazorpayCheckout: any = null;
      try {
        RazorpayCheckout = require('react-native-razorpay')?.default;
      } catch {
        RazorpayCheckout = null;
      }

      if (!RazorpayCheckout) {
        Alert.alert('Error', 'Payment module is not available. Please update the app.');
        return;
      }

      const options = {
        key: orderRes.razorpay_key,
        amount: orderRes.amount_paise,
        currency: 'INR',
        name: 'MyFNG',
        description: addSecondCar ? `${plan.name} Membership + 2nd Car` : `${plan.name} Membership`,
        order_id: orderRes.order_id,
        prefill: {
          contact: profileForm.phone || '',
          name: profileForm.name || '',
          email: profileForm.email || '',
        },
        theme: { color: '#004AAD' },
      };

      const paymentResult = await RazorpayCheckout.open(options);

      await apiFetch('/api/customer/membership/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: plan.raw.id,
          razorpay_payment_id: paymentResult.razorpay_payment_id,
          razorpay_order_id: paymentResult.razorpay_order_id,
          razorpay_signature: paymentResult.razorpay_signature,
        }),
      });

      Alert.alert('Success', `You are now a ${plan.name} member!`);
      const memRes = await apiFetch<any>('/api/customer/membership').catch(() => null);
      if (memRes?.membership) setCurrentMembership(memRes.membership);
    } catch (err: any) {
      const cancelled = err?.code === 'PAYMENT_CANCELLED' || err?.description?.includes('cancelled');
      if (cancelled) {
        Alert.alert('Payment Cancelled', 'Membership upgrade was cancelled. No charges were made.');
      } else {
        Alert.alert('Upgrade failed', err?.message || 'Unable to upgrade membership. Please try again.');
      }
    }
  };

  const handleCarPartChange = (_index: number, value: string) => {
    const sanitized = value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12);
    setCarNumberParts([sanitized]);
  };

  const handleRegisterSave = async () => {
    if (!isLoggedIn) {
      navigation.navigate('Login');
      return;
    }

    const profileSaved = await persistProfile(false);
    if (!profileSaved) return;

    const vehicleNumber = carNumberParts.join('').trim().toUpperCase();
    if (!vehicleNumber) {
      Alert.alert('Missing car number', 'Please enter your car registration number.');
      return;
    }

    const make = String(selectedCar?.make || selectedVehicle?.make || '').trim();
    const model = String(selectedCar?.model || selectedCar?.model_name || selectedVehicle?.model || '').trim();
    if (!make || !model) {
      Alert.alert('Car details required', 'Please select your car model from search.');
      return;
    }

    const yearMatch = regDate.match(/(19|20)\d{2}/);
    const year = yearMatch ? Number(yearMatch[0]) : Number(selectedVehicle?.year || 0) || null;

    const insuranceISO = (() => {
      if (!insuranceExpiry) return null;
      const [dd, mm, yyyy] = insuranceExpiry.split('-');
      if (!dd || !mm || !yyyy) return null;
      return `${yyyy}-${mm}-${dd}`;
    })();

    const vehiclePayload: Record<string, any> = {
      vehicle_number: vehicleNumber,
      make,
      model,
      year,
      fuel_type: fuelType || undefined,
      vin: chassisNumber || undefined,
      odometer_km: odometerReading ? Number(odometerReading) : undefined,
      insurance_expiry: insuranceISO || undefined,
      is_default: true,
    };

    const existingVehicle = allAssociatedVehicles.find((v: any) =>
      String(v?.vehicle_number || '').trim().toUpperCase() === vehicleNumber,
    );

    try {
      if (existingVehicle?.id) {
        await apiFetch(`/api/customer/vehicles/${existingVehicle.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vehiclePayload),
        });
      } else {
        await apiFetch('/api/customer/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vehiclePayload),
        });
      }
      await hydrateCustomerData();
      Alert.alert('Saved', 'Profile and car details have been updated.');
    } catch (err: any) {
      const message = String(err?.message || '');
      if (message.toLowerCase().includes('duplicate') || message.includes('unique_vehicle_per_customer')) {
        try {
          const vRes: any = await apiFetch('/api/customer/vehicles');
          const list: any[] = vRes?.vehicles || [];
          const match = list.find((v) => String(v?.vehicle_number || '').trim().toUpperCase() === vehicleNumber);
          if (match?.id) {
            await apiFetch(`/api/customer/vehicles/${match.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(vehiclePayload),
            });
            await hydrateCustomerData();
            Alert.alert('Saved', 'Profile and car details have been updated.');
            return;
          }
        } catch (_e2) {}
      }
      Alert.alert('Update failed', message || 'Unable to save car details');
    }
  };

  const resetAddressForm = () => {
    setNewAddrLabel('Home');
    setNewAddrLine1('');
    setNewAddrLine2('');
    setNewAddrArea('');
    setNewAddrCity('');
    setNewAddrState('');
    setNewAddrPincode('');
    setGeoPoint(null);
  };

  const parseReverseAddress = (fullAddress: string, shortLabel: string) => {
    const cleanDisplay = String(fullAddress || '').trim();
    const cleanShort = String(shortLabel || '').trim();
    const parts = cleanDisplay.split(',').map((x) => x.trim()).filter(Boolean);
    const pincodeMatch = cleanDisplay.match(/\b\d{6}\b/);
    const pincode = pincodeMatch ? pincodeMatch[0] : '';
    const country = parts.length > 0 ? parts[parts.length - 1] : '';
    const state = parts.length > 1 ? parts[parts.length - 2] : '';
    const city = parts.length > 2 ? parts[parts.length - 3] : '';
    const areaCandidate = parts.slice(0, Math.max(parts.length - 3, 1)).join(', ');
    const area = areaCandidate || cleanShort || cleanDisplay;
    return { area, city, state: state === country ? '' : state, pincode };
  };

  const fetchReverseAddress = async (latitude: number, longitude: number) => {
    const googleRes = await fetch(
      `${ENV.API_URL}/api/location/google-reverse?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`,
    );
    const googleData = await googleRes.json().catch(() => ({}));
    if (googleRes.ok && (googleData?.address || googleData?.shortLabel)) {
      return {
        address: String(googleData?.address || ''),
        shortLabel: String(googleData?.shortLabel || ''),
        pincode: String(googleData?.pincode || ''),
        city: String(googleData?.city || ''),
        state: String(googleData?.state || ''),
        area: String(googleData?.area || ''),
        building: String(googleData?.building || ''),
      };
    }

    const fallbackRes = await fetch(
      `${ENV.API_URL}/api/location/reverse?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`,
    );
    const fallbackData = await fallbackRes.json().catch(() => ({}));
    if (!fallbackRes.ok) {
      throw new Error(String(fallbackData?.error || googleData?.error || 'Unable to fetch nearby address.'));
    }
    return {
      address: String(fallbackData?.displayName || ''),
      shortLabel: String(fallbackData?.shortLabel || ''),
      pincode: '',
      city: '',
      state: '',
      area: '',
      building: '',
    };
  };

  const handleFetchCurrentLocation = async () => {
    try {
      setLocationLoading(true);

      const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!servicesEnabled) {
        Alert.alert(
          'Location is off',
          'Please turn on Location / GPS from your phone settings and try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }

      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission required',
          canAskAgain
            ? 'Please allow location access to auto-fill your address.'
            : 'Location permission was denied. Please enable it from app settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }

      const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Location timed out')), ms);
          p.then((v) => { clearTimeout(timer); resolve(v); })
           .catch((e) => { clearTimeout(timer); reject(e); });
        });

      let current: Location.LocationObject | null = null;
      try {
        current = await Location.getLastKnownPositionAsync({ maxAge: 60 * 1000 });
      } catch {}
      if (!current) {
        try {
          current = await withTimeout(
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            12000,
          );
        } catch (_e1) {
          try {
            current = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
          } catch (_e2) {
            current = null;
          }
          if (!current) {
            current = await withTimeout(
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }),
              15000,
            );
          }
        }
      }

      const latitude = Number(current?.coords?.latitude);
      const longitude = Number(current?.coords?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Unable to read your location coordinates. Please try again in an open area.');
      }
      setGeoPoint({ latitude, longitude });

      try {
        const reverseAddress = await fetchReverseAddress(latitude, longitude);
        if (reverseAddress.pincode) setNewAddrPincode(reverseAddress.pincode);
        if (reverseAddress.city) setNewAddrCity(reverseAddress.city);
        if (reverseAddress.state) setNewAddrState(reverseAddress.state);
        if (reverseAddress.area) {
          setNewAddrArea(reverseAddress.area);
        } else {
          const parsed = parseReverseAddress(reverseAddress.address, reverseAddress.shortLabel);
          if (parsed.area) setNewAddrArea(parsed.area);
        }
        if (!reverseAddress.pincode) {
          const parsed = parseReverseAddress(reverseAddress.address, reverseAddress.shortLabel);
          if (parsed.pincode) setNewAddrPincode(parsed.pincode);
          if (!reverseAddress.city && parsed.city) setNewAddrCity(parsed.city);
        }
      } catch (revErr: any) {
        Alert.alert(
          'Location captured',
          'We saved your coordinates but could not fetch the nearby address. Please fill the details manually.',
        );
      }
    } catch (err: any) {
      const msg = String(err?.message || '');
      Alert.alert(
        'Location unavailable',
        msg.toLowerCase().includes('timed out')
          ? 'Could not get your location in time. Please go to an open area or enter the address manually.'
          : msg || 'Could not fetch your current location.',
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!isLoggedIn) {
      navigation.navigate('Login');
      return;
    }

    const line1 = newAddrLine1.trim();
    const line2 = [newAddrLine2.trim(), newAddrArea.trim()].filter(Boolean).join(', ');
    if (!line1) {
      Alert.alert('Missing details', 'Please enter Flat / House Number.');
      return;
    }
    if (!line2) {
      Alert.alert('Missing details', 'Please enter Building / Society or fetch current location.');
      return;
    }

    const addressPayload = {
      label: newAddrLabel,
      line1,
      line2,
      city: newAddrCity.trim() || null,
      state: newAddrState.trim() || null,
      pincode: newAddrPincode.trim() || null,
      latitude: geoPoint?.latitude ?? null,
      longitude: geoPoint?.longitude ?? null,
      is_default: addresses.length === 0,
    };

    try {
      setSaveAddressLoading(true);

      if (editingAddressId) {
        if (String(editingAddressId).startsWith('lead-')) {
          throw new Error('Only saved addresses can be edited.');
        }
        try {
          await apiFetch('/api/customer/addresses', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingAddressId, ...addressPayload }),
          });
        } catch (_apiErr: any) {
          console.warn('[SettingsScreen] address PATCH failed, attempting direct update fallback', _apiErr?.message || _apiErr);
          if (!customerId) throw _apiErr;
          const { error: sbErr } = await supabase
            .from('customer_addresses')
            .update(addressPayload)
            .eq('id', editingAddressId)
            .eq('customer_id', customerId);
          if (sbErr) throw new Error(sbErr.message);
        }
      } else {
        try {
          await apiFetch('/api/customer/addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(addressPayload),
          });
        } catch (_apiErr: any) {
          console.warn('[SettingsScreen] address POST failed, attempting direct insert fallback', _apiErr?.message || _apiErr);
          if (!customerId) throw _apiErr;
          const { error: sbErr } = await supabase
            .from('customer_addresses')
            .insert({ customer_id: customerId, ...addressPayload });
          if (sbErr) throw new Error(sbErr.message);
        }
      }

      await hydrateCustomerData();
      setShowAddAddress(false);
      setEditingAddressId(null);
      resetAddressForm();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message || 'Unable to save address.');
    } finally {
      setSaveAddressLoading(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!id) return;
    Alert.alert('Delete address', 'Do you want to remove this saved address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            try {
              await apiFetch('/api/customer/addresses', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
              });
            } catch (_apiErr: any) {
              if (!customerId) throw _apiErr;
              const { error: sbErr } = await supabase
                .from('customer_addresses')
                .delete()
                .eq('id', id)
                .eq('customer_id', customerId);
              if (sbErr) throw new Error(sbErr.message);
            }
            await hydrateCustomerData();
          } catch (err: any) {
            Alert.alert('Delete failed', err?.message || 'Unable to delete address.');
          }
        },
      },
    ]);
  };

  const handleLogout = async () => {
    try {
      const token = await getCustomerSessionToken();
      if (token) {
        await fetch(`${ENV.API_URL}/api/customer/auth/logout`, {
          method: 'POST',
          headers: { 'x-customer-session': token },
        }).catch(() => null);
      }
      await clearCustomerSessionToken();
      setIsLoggedIn(false);
      navigation.navigate('Login');
    } catch (_err) {
      navigation.navigate('Login');
    }
  };

  const SOCIAL_LINKS = [
    { icon: 'logo-facebook' as const, url: 'https://facebook.com/myfngcarservices', color: '#1877F2' },
    { icon: 'logo-instagram' as const, url: 'https://instagram.com/myfngcarservices', color: '#E4405F' },
    { icon: 'logo-youtube' as const, url: 'https://www.youtube.com/@myfng_car_servicing', color: '#FF0000' },
    { icon: 'logo-linkedin' as const, url: 'https://www.linkedin.com/company/myfngcarservices', color: '#0A66C2' },
    { icon: 'logo-twitter' as const, url: 'https://x.com/myfngcarservice', color: '#1DA1F2' },
  ];

  const FUEL_COLOR_MAP: Record<'Petrol' | 'Diesel' | 'CNG', { bg: string; border: string; text: string }> = {
    Petrol: { bg: '#2563EB', border: '#2563EB', text: '#2563EB' },
    Diesel: { bg: '#D97706', border: '#D97706', text: '#D97706' },
    CNG: { bg: '#16A34A', border: '#16A34A', text: '#16A34A' },
  };

  const formatDate = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${day}-${month}-${year}`;
  };

  const onRegDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowRegDatePicker(false);
    if (!selectedDate) return;
    setRegDateValue(selectedDate);
    setRegDate(formatDate(selectedDate));
  };

  const onInsuranceDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowInsuranceDatePicker(false);
    if (!selectedDate) return;
    setInsuranceExpiryValue(selectedDate);
    setInsuranceExpiry(formatDate(selectedDate));
  };

  const onCartDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowCartDatePicker(false);
    if (!selectedDate) return;
    setCartDate(selectedDate);
  };

  const onCartTimeChange = (_event: DateTimePickerEvent, selectedTime?: Date) => {
    if (Platform.OS === 'android') setShowCartTimePicker(false);
    if (!selectedTime) return;
    const next = new Date(cartTime);
    next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    setCartTime(next);
  };

  const resumableLeads = useMemo(() => {
    const statusPriority = ['NEW', 'PENDING', 'IN_PROGRESS', 'ASSIGNED', 'CONFIRMED', 'OPEN'];
    return (cartLeads || [])
      .filter((lead: any) => statusPriority.includes(String(lead?.status || '').toUpperCase()))
      .sort((a: any, b: any) => {
        const ai = statusPriority.indexOf(String(a?.status || '').toUpperCase());
        const bi = statusPriority.indexOf(String(b?.status || '').toUpperCase());
        if (ai !== bi) return ai - bi;
        return new Date(String(b?.created_at || 0)).getTime() - new Date(String(a?.created_at || 0)).getTime();
      });
  }, [cartLeads]);

  const selectedCartWorkshop = useMemo(
    () => cartWorkshops.find((workshop: any) => String(workshop.id) === cartSelectedWorkshopId) || null,
    [cartWorkshops, cartSelectedWorkshopId]
  );

  const handleProceedToBook = useCallback(async () => {
    if (!profileForm.phone.trim()) {
      Alert.alert('Phone required', 'Please add your phone number in profile.');
      return;
    }
    if (!selectedVehicle) {
      Alert.alert('Vehicle required', 'Please add/select your vehicle before booking.');
      return;
    }
    if ((cartItems || []).length === 0) {
      Alert.alert('Cart empty', 'Please add a service to your cart before booking.');
      return;
    }
    if (cartServiceMode === 'pickup' && !selectedPickupAddress) {
      Alert.alert('Address required', 'Please select a pickup address.');
      return;
    }
    if (cartServiceMode === 'workshop' && !selectedCartWorkshop) {
      Alert.alert('Workshop required', 'Please select a workshop.');
      return;
    }

    setCartBookingLoading(true);
    try {
      const leadNumber = `L-${Date.now().toString().slice(-8)}`;
      const cartServiceTypes = (cartItems || [])
        .map((it: any) => String(it?.service_type || '').trim())
        .filter(Boolean);
      const serviceType = cartServiceTypes.length > 0
        ? cartServiceTypes.join(', ')
        : (cartSelectedService?.name || 'CAR_SERVICE');
      const bookingAmount = finalAmount > 0
        ? finalAmount
        : Number(cartServerCart?.grand_total || subtotal || 0);
      const payload = {
        lead: {
          lead_number: leadNumber,
          created_from: 'MOBILE_APP',
          status: 'NEW',
          lead_type: 'CAR_SERVICE',
          lead_source: 'App Booking',
          customer_name: profileForm.name || null,
          customer_phone: profileForm.phone.trim(),
          vehicle_number: String(selectedVehicle?.vehicle_number || '').trim() || null,
          vehicle_make: selectedVehicle?.make || null,
          vehicle_model: selectedVehicle?.model || null,
          service_type: serviceType,
          pickup_required: cartServiceMode === 'pickup',
          workshop_id: cartServiceMode === 'workshop' ? selectedCartWorkshop?.id || null : null,
          pickup_address: cartServiceMode === 'pickup' ? selectedPickupAddress?.value || null : null,
          address:
            cartServiceMode === 'pickup'
              ? selectedPickupAddress?.value || null
              : selectedCartWorkshop?.address || null,
          preferred_slot_start:
            cartServiceMode === 'pickup'
              ? `${cartDate.getFullYear()}-${String(cartDate.getMonth() + 1).padStart(2, '0')}-${String(cartDate.getDate()).padStart(2, '0')}T${String(cartTime.getHours()).padStart(2, '0')}:${String(cartTime.getMinutes()).padStart(2, '0')}:00`
              : null,
          estimated_amount: bookingAmount,
          payment_mode: cartPaymentMode,
          payment_status: cartPaymentMode === 'pay_now' ? 'PENDING' : 'PENDING_AT_SERVICE',
          coupon_code: cartCouponResult?.coupon?.code || null,
          discount_amount: Number(cartCouponResult?.discount_amount || 0),
        },
      };
      const response = await fetch(`${ENV.API_URL}/api/public/bookings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Failed to create booking');
      try {
        for (const it of cartItems) {
          if (it?.id) {
            await apiFetch(`/api/customer/cart?item_id=${encodeURIComponent(String(it.id))}`, {
              method: 'DELETE',
            });
          }
        }
      } catch (_clearErr) { /* non-fatal */ }
      Alert.alert('Booking created', `Lead: ${json?.lead?.lead_number || leadNumber}`);
      await hydrateCustomerData();
      await loadCart();
      setActiveSubPage('Order History');
    } catch (error: any) {
      Alert.alert('Booking failed', error?.message || 'Could not create booking.');
    } finally {
      setCartBookingLoading(false);
    }
  }, [
    profileForm.phone,
    profileForm.name,
    selectedVehicle,
    cartServiceMode,
    selectedPickupAddress,
    selectedCartWorkshop,
    cartSelectedService,
    cartDate,
    cartTime,
    finalAmount,
    subtotal,
    cartPaymentMode,
    cartCouponResult,
    cartItems,
    cartServerCart,
    hydrateCustomerData,
    loadCart,
  ]);

  const onPressAddVehicle = () => {
    if (isLoggedIn) {
      setVehicleEntryOnly(true);
    } else {
      setVehicleEntryOnly(false);
    }
    setProfileStep(2);
    setCarSearch('');
    setSelectedCar(null);
    setFuelType('');
    setCarNumberParts(['']);
    setActiveSubPage('My Profile');
  };

  useEffect(() => {
    if (activeSubPage !== 'My Profile' && vehicleEntryOnly) {
      setVehicleEntryOnly(false);
    }
  }, [activeSubPage, vehicleEntryOnly]);

  const renderMain = () => (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {isLoggedIn ? (
        <View style={styles.profileEditorCard}>
          <TouchableOpacity
            style={styles.profileTopRow}
            activeOpacity={0.9}
            onPress={() => setShowProfileEditor((prev) => !prev)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profileForm.name.trim().charAt(0).toUpperCase() || 'C'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{profileForm.name || 'Customer'}</Text>
              <Text style={styles.profileMeta}>{profileForm.phone ? `+91 ${profileForm.phone}` : 'No phone linked'}</Text>
            </View>
            <TouchableOpacity style={styles.editSquare} onPress={() => setShowProfileEditor((prev) => !prev)}>
              <Ionicons name="pencil" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </TouchableOpacity>

          {showProfileEditor ? (
            <View style={styles.profileExpanded}>
              <Text style={styles.profileFieldLabel}>Full Name</Text>
              <TextInput
                style={styles.profileInput}
                value={profileForm.name}
                onChangeText={(text) => setProfileForm((prev) => ({ ...prev, name: text }))}
                placeholder="Full name"
              />

              <Text style={styles.profileFieldLabel}>Email Address</Text>
              <TextInput
                style={styles.profileInput}
                value={profileForm.email}
                onChangeText={(text) => setProfileForm((prev) => ({ ...prev, email: text }))}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TouchableOpacity style={styles.profileSaveBtn} onPress={handleProfileSave}>
                <Text style={styles.profileSaveText}>Save Profile</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {dataLoading ? <Text style={styles.syncText}>Syncing account details...</Text> : null}
        </View>
      ) : (
        <TouchableOpacity style={styles.profileCard} onPress={() => navigation.navigate('Login')} activeOpacity={0.85}>
          <View style={styles.avatarGuest}>
            <Text style={styles.avatarGuestText}>G</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>Guest Login</Text>
            <Text style={styles.guestLoginLink}>LOGIN NOW</Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.vehicleCard}>
        <Text style={styles.cardHeading}>Your Vehicles</Text>
        {vehicleCarouselData.length > 0 ? (
          <FlatList
            ref={vehiclePagerRef}
            data={vehicleCarouselData}
            horizontal
            pagingEnabled
            decelerationRate="fast"
            snapToInterval={vehicleCardSnapInterval}
            snapToAlignment="start"
            disableIntervalMomentum
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.vehiclePagerContent}
            keyExtractor={(item, index) => {
              const plate = String(item?.vehicle_number || '').trim().toUpperCase();
              return plate || `vehicle-${index}`;
            }}
            renderItem={({ item, index }) => {
              const plate = String(item?.vehicle_number || '').trim().toUpperCase();
              return (
                <View style={[styles.vehicleSwipeCard, { width: vehicleCardWidth }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.numberPlateBadge}>
                      <Text style={styles.numberPlateText} numberOfLines={1}>{plate || `VEHICLE ${index + 1}`}</Text>
                    </View>
                    <Text style={styles.vehicleName} numberOfLines={1}>
                      {[item?.make, item?.model].filter(Boolean).join(' ') || 'Add your first vehicle'}
                    </Text>
                    <View style={styles.vehicleTags}>
                      <View style={styles.vehicleTag}>
                        <Text style={styles.vehicleTagText}>{String(item?.fuel_type || 'N/A').toUpperCase()}</Text>
                      </View>
                      <Text style={styles.vehicleYear}>{item?.year ? String(item.year) : '-'}</Text>
                    </View>
                  </View>
                  <VehicleImage vehicle={item} style={styles.vehicleImage} />
                </View>
              );
            }}
            onMomentumScrollEnd={(event) => {
              const offset = event.nativeEvent.contentOffset.x;
              const index = Math.round(offset / vehicleCardSnapInterval);
              const vehicle = vehicleCarouselData[index];
              if (!vehicle) return;
              const plate = String(vehicle?.vehicle_number || '').trim().toUpperCase();
              const key = plate || `vehicle-${index}`;
              setSelectedVehicleKey(key);
            }}
          />
        ) : (
          <View style={styles.vehicleSwipeCard}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.numberPlateBadge}>
                <Text style={styles.numberPlateText} numberOfLines={1}>NO VEHICLE</Text>
              </View>
              <Text style={styles.vehicleName} numberOfLines={1}>Add your first vehicle</Text>
            </View>
            <VehicleImage vehicle={selectedVehicle} style={styles.vehicleImage} />
          </View>
        )}
        {vehicleCarouselData.length > 1 ? (
          <View style={styles.vehicleDotsRow}>
            {vehicleCarouselData.map((_, index) => (
              <View
                key={`vehicle-dot-${index}`}
                style={[styles.vehicleDot, activeVehicleIndex === index ? styles.vehicleDotActive : null]}
              />
            ))}
          </View>
        ) : null}
        <TouchableOpacity style={styles.addVehicleBtn} onPress={onPressAddVehicle} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
          <Text style={styles.addVehicleBtnText}>Add New Vehicle</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {MAIN_MENU.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.gridCard}
            onPress={() => {
              setVehicleEntryOnly(false);
              setActiveSubPage(item.label);
            }}
          >
            <Ionicons name={item.icon} size={18} color={COLORS.primary} />
            <Text style={styles.gridCardText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionHeading}>Legal & Support</Text>
      <View style={styles.grid}>
        {LEGAL_MENU.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.gridCard}
            onPress={() => {
              setVehicleEntryOnly(false);
              setActiveSubPage(item.label);
            }}
          >
            <Ionicons name={item.icon} size={18} color={item.id === 'delete' ? '#DC2626' : COLORS.primary} />
            <Text style={[styles.gridCardText, item.id === 'delete' ? { color: '#DC2626' } : null]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionHeading}>Connect With Us</Text>
      <View style={styles.socialRow}>
        {SOCIAL_LINKS.map((s) => (
          <TouchableOpacity key={s.url} style={[styles.socialBtn, { borderColor: s.color }]} onPress={() => Linking.openURL(s.url)}>
            <Ionicons name={s.icon} size={18} color={s.color} />
          </TouchableOpacity>
        ))}
      </View>

      {isLoggedIn ? (
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Login')}>
          <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
          <Text style={styles.loginBtnText}>Login / Sign Up</Text>
        </TouchableOpacity>
      )}

      <ReferAndFooter hideRefer />
    </ScrollView>
  );

  const renderSubPage = () => {
    switch (activeSubPage) {
      case 'My Profile': {
        const step1Done = !!(profileForm.name && profileForm.phone);
        const step2Done = !!(carSearch && fuelType && carNumberParts[0]?.length > 0);
        const STEP_COLORS = {
          1: { accent: '#0046AD', bg: '#DBEAFE' },
          2: { accent: '#F97316', bg: '#FFEDD5' },
          3: { accent: '#7C3AED', bg: '#EDE9FE' },
        } as const;
        const STEP_CONTENT_STYLE = { backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 4 } as const;
        const STEP_LABEL_STYLE = { fontSize: 11, fontWeight: '800' as const, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginTop: 8, marginBottom: 4 };
        const STEP_INPUT_STYLE = { paddingHorizontal: 14, paddingVertical: 12, borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 14, backgroundColor: '#FFFFFF', fontSize: 14, fontWeight: '600' as const, color: '#1E293B' };
        const STEP_DATE_STYLE = { paddingHorizontal: 14, paddingVertical: 13, borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const };
        const STEP_NEXT_BTN_STYLE = { marginTop: 14, borderRadius: 12, paddingVertical: 14, alignItems: 'center' as const };
        const STEP_NEXT_BTN_TEXT_STYLE = { color: '#FFFFFF', fontSize: 14, fontWeight: '700' as const };
        const PLATE_BOX_STYLE = { flex: 1, paddingVertical: 14, borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 12, backgroundColor: '#FFFFFF', textAlign: 'center' as const, fontSize: 15, fontWeight: '800' as const, color: '#1E293B', textTransform: 'uppercase' as const };
        return (
          <View style={{ padding: 14, paddingBottom: 28, gap: 14, backgroundColor: '#F0F7FF' }}>
            {/* Vibrant Header Banner */}
            <View style={{
              backgroundColor: '#0046AD',
              borderRadius: 24,
              paddingTop: 28,
              paddingBottom: 22,
              paddingHorizontal: 20,
              alignItems: 'center',
              overflow: 'hidden',
              elevation: 10,
              shadowColor: '#0046AD',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
            }}>
              <View pointerEvents="none" style={{ position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, backgroundColor: '#0084FF', opacity: 0.5 }} />
              <View pointerEvents="none" style={{ position: 'absolute', bottom: -80, left: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: '#F97316', opacity: 0.2 }} />
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: '#F97316' }} />
              <View style={{ width: 82, height: 82, marginBottom: 14, position: 'relative', zIndex: 10 }}>
                <TouchableOpacity activeOpacity={0.6} onPress={pickAndUploadProfileImage} style={{ width: 82, height: 82, borderRadius: 41, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {profileImageUrl ? (
                    <Image source={{ uri: profileImageUrl }} style={{ width: 82, height: 82 }} />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900' }}>
                      {(profileForm.name || 'G').trim().charAt(0).toUpperCase()}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={pickAndUploadProfileImage} style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#0084FF', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="camera" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '900', textAlign: 'center' }}>
                {isLoggedIn ? (profileForm.name || 'MyFNG Customer') : 'Guest User'}
              </Text>
              <View style={{ marginTop: 10, flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: '#10B981' }}>
                  <Ionicons name="shield-checkmark" size={11} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>VERIFIED CUSTOMER</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
                  <Ionicons name="star" size={11} color="#FCD34D" />
                  <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>MyFNG MEMBER</Text>
                </View>
              </View>
            </View>

            {/* Step 1: Owner Information */}
            <View style={{
              borderRadius: 18,
              borderWidth: 2,
              borderColor: profileStep === 1 ? STEP_COLORS[1].accent : '#E2E8F0',
              backgroundColor: '#FFFFFF',
              overflow: 'hidden',
              elevation: profileStep === 1 ? 5 : 2,
              shadowColor: profileStep === 1 ? STEP_COLORS[1].accent : '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: profileStep === 1 ? 0.18 : 0.06,
              shadowRadius: 10,
            }}>
              <View style={{ height: 4, width: '100%', backgroundColor: STEP_COLORS[1].accent }} />
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setProfileStep(profileStep === 1 ? 0 : 1)}
                style={{ paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: step1Done ? '#10B981' : STEP_COLORS[1].bg, alignItems: 'center', justifyContent: 'center' }}>
                    {step1Done ? (
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    ) : (
                      <Ionicons name="person" size={16} color={STEP_COLORS[1].accent} />
                    )}
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: STEP_COLORS[1].accent }}>1. Owner Information</Text>
                </View>
                <Ionicons name={profileStep === 1 ? 'chevron-up' : 'chevron-down'} size={18} color={STEP_COLORS[1].accent} />
              </TouchableOpacity>
              {profileStep === 1 && (
                <View style={STEP_CONTENT_STYLE}>
                  <Text style={STEP_LABEL_STYLE}>FULL NAME</Text>
                  <TextInput
                    style={STEP_INPUT_STYLE}
                    value={profileForm.name}
                    onChangeText={(text) => setProfileForm((prev) => ({ ...prev, name: text }))}
                    placeholder="My FNG Autocare"
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text style={STEP_LABEL_STYLE}>MOBILE NUMBER</Text>
                  <TextInput
                    style={[STEP_INPUT_STYLE, { backgroundColor: '#F1F5F9', color: '#64748B' }]}
                    value={profileForm.phone ? `+91 ${profileForm.phone}` : ''}
                    placeholder="9152307030"
                    placeholderTextColor="#9CA3AF"
                    editable={false}
                  />
                  <Text style={STEP_LABEL_STYLE}>EMAIL ADDRESS</Text>
                  <TextInput
                    style={STEP_INPUT_STYLE}
                    value={profileForm.email}
                    onChangeText={(text) => setProfileForm((prev) => ({ ...prev, email: text }))}
                    placeholder="support@myfng.in"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={[STEP_NEXT_BTN_STYLE, { backgroundColor: STEP_COLORS[1].accent }]} onPress={() => setProfileStep(2)} activeOpacity={0.85}>
                    <Text style={STEP_NEXT_BTN_TEXT_STYLE}>Next: Vehicle Specs →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Step 2: Vehicle Specs */}
            <View style={{
              borderRadius: 18,
              borderWidth: 2,
              borderColor: profileStep === 2 ? STEP_COLORS[2].accent : '#E2E8F0',
              backgroundColor: '#FFFFFF',
              overflow: 'hidden',
              elevation: profileStep === 2 ? 5 : 2,
              shadowColor: profileStep === 2 ? STEP_COLORS[2].accent : '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: profileStep === 2 ? 0.18 : 0.06,
              shadowRadius: 10,
            }}>
              <View style={{ height: 4, width: '100%', backgroundColor: STEP_COLORS[2].accent }} />
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setProfileStep(profileStep === 2 ? 0 : 2)}
                style={{ paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: step2Done ? '#10B981' : STEP_COLORS[2].bg, alignItems: 'center', justifyContent: 'center' }}>
                    {step2Done ? (
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    ) : (
                      <Ionicons name="car-sport" size={16} color={STEP_COLORS[2].accent} />
                    )}
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: STEP_COLORS[2].accent }}>2. Vehicle Specs</Text>
                </View>
                <Ionicons name={profileStep === 2 ? 'chevron-up' : 'chevron-down'} size={18} color={STEP_COLORS[2].accent} />
              </TouchableOpacity>
              {profileStep === 2 && (
                <View style={STEP_CONTENT_STYLE}>
                  {/* Quick select from saved vehicles */}
                  {allAssociatedVehicles.length > 0 ? (
                    <View style={{ marginBottom: 14 }}>
                      <Text style={STEP_LABEL_STYLE}>YOUR SAVED VEHICLES</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {allAssociatedVehicles.map((v: any, idx: number) => {
                          const vMake = v.make || v.vehicle_make || '';
                          const vModel = v.model || v.vehicle_model || '';
                          const label = [vMake, vModel].filter(Boolean).join(' ') || 'Vehicle';
                          const isActive = carSearch === label;
                          return (
                            <TouchableOpacity
                              key={v.vehicle_number || idx}
                              style={{
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                borderRadius: 12,
                                borderWidth: 1.5,
                                borderColor: isActive ? STEP_COLORS[2].accent : '#E2E8F0',
                                backgroundColor: isActive ? STEP_COLORS[2].accent : '#FFFFFF',
                              }}
                              activeOpacity={0.85}
                              onPress={() => {
                                setSelectedCar({ make: vMake, model: vModel, raw: v });
                                setCarSearch(label);
                                setCarSuggestions([]);
                                setCarSearchFocused(false);
                                if (v.fuel_type) setFuelType(v.fuel_type);
                                if (v.vehicle_number) {
                                  setCarNumberParts([String(v.vehicle_number).replace(/[^A-Z0-9]/gi, '').toUpperCase()]);
                                }
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '800', color: isActive ? '#FFFFFF' : '#374151' }}>{label}</Text>
                              {v.vehicle_number ? <Text style={{ fontSize: 10, fontWeight: '700', color: isActive ? 'rgba(255,255,255,0.8)' : '#9CA3AF', marginTop: 2 }}>{v.vehicle_number}</Text> : null}
                            </TouchableOpacity>
                          );
                        })}
                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 12,
                            borderWidth: 1.5,
                            borderColor: STEP_COLORS[2].accent,
                            backgroundColor: '#FFFFFF',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          activeOpacity={0.85}
                          onPress={() => {
                            setSelectedCar(null);
                            setCarSearch('');
                            setCarSuggestions([]);
                            setFuelType('');
                            setCarNumberParts(['']);
                          }}
                        >
                          <Ionicons name="add-circle-outline" size={16} color={STEP_COLORS[2].accent} />
                          <Text style={{ fontSize: 12, fontWeight: '800', color: STEP_COLORS[2].accent }}>Add New</Text>
                        </TouchableOpacity>
                      </ScrollView>
                    </View>
                  ) : null}

                  <Text style={STEP_LABEL_STYLE}>CAR BRAND & MODEL</Text>
                  <View style={styles.carSearchWrap}>
                    <TextInput
                      style={STEP_INPUT_STYLE}
                      value={carSearch}
                      onChangeText={(text) => { setCarSearch(text); setSelectedCar(null); }}
                      onFocus={() => setCarSearchFocused(true)}
                      onBlur={() => setTimeout(() => setCarSearchFocused(false), 400)}
                      placeholder="Search (e.g. Tata Nexon)"
                      placeholderTextColor="#9CA3AF"
                    />
                    {carSearchLoading ? (
                      <View style={styles.carSearchLoader}><Text style={styles.rowSub}>Searching...</Text></View>
                    ) : null}
                    {carSearchFocused && carSuggestions.length > 0 ? (
                      <View style={[styles.carSuggestionBox, { maxHeight: 260 }]}>
                        <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled showsVerticalScrollIndicator>
                          {carSuggestions.slice(0, 20).map((item, idx) => {
                            const itemMake = String(item?.make || '').trim();
                            const itemModel = String(item?.model_name || item?.model || '').trim();
                            return (
                              <TouchableOpacity
                                key={String(item?.id || `${itemMake}-${itemModel}-${idx}`)}
                                style={styles.carSuggestionItem}
                                onPress={() => {
                                  setSelectedCar({ make: itemMake, model: itemModel, raw: item });
                                  setCarSearch([itemMake, itemModel].filter(Boolean).join(' '));
                                  setCarSuggestions([]);
                                  setCarSearchFocused(false);
                                }}
                              >
                                <Text style={styles.carSuggestionTitle}>{[itemMake, itemModel].filter(Boolean).join(' ')}</Text>
                                {!!item?.variant ? <Text style={styles.carSuggestionMeta}>{String(item.variant)}</Text> : null}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    ) : null}
                  </View>

                  <Text style={STEP_LABEL_STYLE}>FUEL TYPE</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {(['Petrol', 'Diesel', 'CNG'] as const).map((fuel) => {
                      const active = fuelType === fuel;
                      const colors = FUEL_COLOR_MAP[fuel];
                      return (
                        <TouchableOpacity
                          key={fuel}
                          style={{
                            flex: 1,
                            paddingVertical: 11,
                            paddingHorizontal: 8,
                            borderRadius: 999,
                            borderWidth: 1.5,
                            borderColor: active ? colors.bg : colors.border,
                            backgroundColor: active ? colors.bg : '#FFFFFF',
                            alignItems: 'center',
                          }}
                          onPress={() => setFuelType(fuel)}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '800', color: active ? '#FFFFFF' : colors.text }}>{fuel}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={STEP_LABEL_STYLE}>REG. DATE</Text>
                  <TouchableOpacity style={STEP_DATE_STYLE} onPress={() => setShowRegDatePicker(true)} activeOpacity={0.85}>
                    <Text style={[styles.datePickerText, !regDate ? styles.datePickerTextPlaceholder : null]}>
                      {regDate || 'dd-mm-yyyy'}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                  </TouchableOpacity>
                  {showRegDatePicker ? (
                    <View style={styles.datePickerWrap}>
                      <DateTimePicker
                        value={regDateValue}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        maximumDate={new Date()}
                        onChange={onRegDateChange}
                      />
                      {Platform.OS === 'ios' ? (
                        <TouchableOpacity style={styles.datePickerDoneBtn} onPress={() => setShowRegDatePicker(false)}>
                          <Text style={styles.datePickerDoneText}>Done</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}

                  <Text style={STEP_LABEL_STYLE}>VEHICLE NUMBER PLATE</Text>
                  <TextInput
                    style={STEP_INPUT_STYLE}
                    value={carNumberParts[0] || ''}
                    onChangeText={(text) => handleCarPartChange(0, text)}
                    maxLength={12}
                    autoCapitalize="characters"
                    placeholder="e.g. MH01BJ7842 or DL9CAY5551"
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity style={[STEP_NEXT_BTN_STYLE, { backgroundColor: STEP_COLORS[2].accent }]} onPress={() => setProfileStep(3)} activeOpacity={0.85}>
                    <Text style={STEP_NEXT_BTN_TEXT_STYLE}>Next: Maintenance →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Step 3: Maintenance Details */}
            <View style={{
              borderRadius: 18,
              borderWidth: 2,
              borderColor: profileStep === 3 ? STEP_COLORS[3].accent : '#E2E8F0',
              backgroundColor: '#FFFFFF',
              overflow: 'hidden',
              elevation: profileStep === 3 ? 5 : 2,
              shadowColor: profileStep === 3 ? STEP_COLORS[3].accent : '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: profileStep === 3 ? 0.18 : 0.06,
              shadowRadius: 10,
            }}>
              <View style={{ height: 4, width: '100%', backgroundColor: STEP_COLORS[3].accent }} />
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setProfileStep(profileStep === 3 ? 0 : 3)}
                style={{ paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: STEP_COLORS[3].bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="construct" size={16} color={STEP_COLORS[3].accent} />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: STEP_COLORS[3].accent }}>3. Maintenance Details</Text>
                </View>
                <Ionicons name={profileStep === 3 ? 'chevron-up' : 'chevron-down'} size={18} color={STEP_COLORS[3].accent} />
              </TouchableOpacity>
              {profileStep === 3 && (
                <View style={STEP_CONTENT_STYLE}>
                  <Text style={STEP_LABEL_STYLE}>CHASSIS (LAST 5)</Text>
                  <TextInput
                    style={STEP_INPUT_STYLE}
                    maxLength={5}
                    placeholder="12345"
                    placeholderTextColor="#9CA3AF"
                    value={chassisNumber}
                    onChangeText={(text) => setChassisNumber(text.toUpperCase())}
                    autoCapitalize="characters"
                  />

                  <Text style={STEP_LABEL_STYLE}>INSURANCE EXPIRY</Text>
                  <TouchableOpacity style={STEP_DATE_STYLE} onPress={() => setShowInsuranceDatePicker(true)} activeOpacity={0.85}>
                    <Text style={[styles.datePickerText, !insuranceExpiry ? styles.datePickerTextPlaceholder : null]}>
                      {insuranceExpiry || 'dd-mm-yyyy'}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                  </TouchableOpacity>
                  {showInsuranceDatePicker ? (
                    <View style={styles.datePickerWrap}>
                      <DateTimePicker
                        value={insuranceExpiryValue}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        minimumDate={new Date()}
                        onChange={onInsuranceDateChange}
                      />
                      {Platform.OS === 'ios' ? (
                        <TouchableOpacity style={styles.datePickerDoneBtn} onPress={() => setShowInsuranceDatePicker(false)}>
                          <Text style={styles.datePickerDoneText}>Done</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}

                  <Text style={STEP_LABEL_STYLE}>CURRENT ODOMETER READING</Text>
                  <View style={{ backgroundColor: '#121A29', borderRadius: 18, borderWidth: 3, borderColor: '#334155', paddingHorizontal: 14, paddingVertical: 8, marginTop: 4, position: 'relative', justifyContent: 'center' }}>
                    <TextInput
                      style={{ color: '#00F2FF', fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: 8, paddingVertical: 12 }}
                      placeholder="000000"
                      placeholderTextColor="rgba(0,242,255,0.25)"
                      keyboardType="number-pad"
                      maxLength={7}
                      value={odometerReading}
                      onChangeText={(text) => setOdometerReading(text.replace(/[^0-9]/g, ''))}
                    />
                    <Text style={{ position: 'absolute', right: 14, bottom: 10, color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>KMS</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={{
                marginTop: 18,
                marginHorizontal: 6,
                borderRadius: 20,
                paddingVertical: 18,
                paddingHorizontal: 22,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 10,
                backgroundColor: '#0046AD',
                overflow: 'hidden',
                elevation: 10,
                shadowColor: '#0046AD',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.4,
                shadowRadius: 18,
              }}
              onPress={handleRegisterSave}
              activeOpacity={0.9}
            >
              <View style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: '#0084FF', opacity: 0.5 }} />
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                {isLoggedIn ? (vehicleEntryOnly ? 'SAVE VEHICLE' : 'SAVE CHANGES') : 'REGISTER NOW'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      }
      case 'Your Addresses':
        return (
          <View style={styles.subWrap}>
            <View style={styles.addressHeaderRow}>
              <Text style={styles.subTitle}>Saved Addresses</Text>
              {isLoggedIn ? (
                <TouchableOpacity
                  style={styles.addressAddNewBtn}
                  onPress={() => {
                    setShowAddAddress((prev) => {
                      const next = !prev;
                      if (!next) { resetAddressForm(); setEditingAddressId(null); }
                      return next;
                    });
                  }}
                >
                  <Ionicons name={showAddAddress ? 'close-circle-outline' : 'add-circle-outline'} size={14} color={COLORS.primary} />
                  <Text style={styles.addressAddNewText}>{showAddAddress ? 'Close' : 'Add New'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {!isLoggedIn ? (
              <>
                {addresses.length > 0 ? addresses.map((a) => (
                  <View key={a.id} style={styles.addressCard}>
                    <View style={styles.addressIconWrap}>
                      <Ionicons name="location" size={16} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addressLabel}>{a.label}</Text>
                      <Text style={styles.addressText}>{a.value}</Text>
                    </View>
                  </View>
                )) : null}
                <TouchableOpacity style={styles.addressLoginGate} onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.addressLoginText}>Login to Manage Addresses</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {showAddAddress ? (
                  <View style={styles.addressFormCard}>
                    <TouchableOpacity style={styles.addressDetectBtn} onPress={handleFetchCurrentLocation} disabled={locationLoading}>
                      <Ionicons name="locate-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.addressDetectBtnText}>
                        {locationLoading ? 'Fetching location...' : 'Fetch Current Location'}
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.subTitle}>Address Type</Text>
                    <View style={styles.fuelPillRow}>
                      {(['Home', 'Work', 'Others'] as const).map((label) => {
                        const active = newAddrLabel === label;
                        return (
                          <TouchableOpacity
                            key={label}
                            style={[styles.fuelPill, active ? styles.fuelPillActive : null]}
                            onPress={() => setNewAddrLabel(label)}
                          >
                            <Text style={[styles.fuelPillText, active ? styles.fuelPillTextActive : null]}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {editingAddressId ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primary }}>Editing Address</Text>
                        <TouchableOpacity onPress={() => { setEditingAddressId(null); resetAddressForm(); }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B7280' }}>Clear & Add New</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    <Text style={styles.subTitle}>Nearby Area</Text>
                    <TextInput
                      style={styles.input}
                      value={newAddrArea}
                      onChangeText={setNewAddrArea}
                      placeholder="Detected nearby area"
                    />

                    <Text style={styles.subTitle}>Flat / House Number</Text>
                    <TextInput
                      style={styles.input}
                      value={newAddrLine1}
                      onChangeText={setNewAddrLine1}
                      placeholder="e.g. Flat 101"
                    />

                    <Text style={styles.subTitle}>Building / Society Name</Text>
                    <TextInput
                      style={styles.input}
                      value={newAddrLine2}
                      onChangeText={setNewAddrLine2}
                      placeholder="e.g. Sunshine Apartments"
                    />

                    <View style={styles.addressMiniRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.subTitle}>City</Text>
                        <TextInput style={styles.input} value={newAddrCity} onChangeText={setNewAddrCity} placeholder="City" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.subTitle}>Pincode</Text>
                        <TextInput
                          style={styles.input}
                          value={newAddrPincode}
                          onChangeText={(text) => setNewAddrPincode(text.replace(/\D/g, '').slice(0, 6))}
                          keyboardType="number-pad"
                          placeholder="Pincode"
                        />
                      </View>
                    </View>

                    <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveAddress}>
                      <Text style={styles.primaryBtnText}>{saveAddressLoading ? 'Saving...' : editingAddressId ? 'Update Address' : 'Save Address'}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {addresses.length === 0 ? (
                  <Text style={styles.rowSub}>No saved addresses found.</Text>
                ) : addresses.map((a) => {
                  const isLead = a.source === 'lead' || String(a.id).startsWith('lead-');
                  return (
                    <View key={a.id} style={styles.addressCard}>
                      <View style={styles.addressIconWrap}>
                        <Ionicons name="location" size={16} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.addressLabel}>{a.label}</Text>
                        <Text style={styles.addressText}>{a.value}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {!isLead ? (
                          <TouchableOpacity
                            style={styles.addressEditBtn}
                            onPress={() => {
                              const parts = a.value.split(',').map((p) => p.trim());
                              setEditingAddressId(a.id);
                              setNewAddrLabel(a.label === 'Work' ? 'Work' : a.label === 'Others' ? 'Others' : 'Home');
                              setNewAddrLine1(parts[0] || '');
                              setNewAddrLine2(parts[1] || '');
                              setNewAddrArea(parts[2] || '');
                              setNewAddrCity(parts[3] || '');
                              setNewAddrPincode(parts[parts.length - 1]?.match(/^\d{6}$/) ? parts[parts.length - 1] : '');
                              setShowAddAddress(true);
                            }}
                          >
                            <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                          </TouchableOpacity>
                        ) : null}
                        {!isLead ? (
                          <TouchableOpacity style={styles.addressDeleteBtn} onPress={() => handleDeleteAddress(a.id)}>
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })}

              </>
            )}
          </View>
        );
      case 'Membership': {
        const isPrimeCurrent = Boolean(currentMembership);
        return (
          <View style={styles.subWrap}>
            {/* Prime price card */}
            <View style={styles.primeCard}>
              <View style={styles.primeRow}>
                <Text style={styles.primeName}>{PRIME_MEMBERSHIP.name}</Text>
                <View style={styles.primeBadge}>
                  <Text style={styles.primeBadgeText}>{PRIME_MEMBERSHIP.badge}</Text>
                </View>
              </View>
              <View style={styles.primePriceRow}>
                <Text style={styles.primePriceAmount}>{PRIME_MEMBERSHIP.price}</Text>
                <Text style={styles.primePricePeriod}>{PRIME_MEMBERSHIP.period}</Text>
              </View>
              <Text style={styles.primeTagline}>{PRIME_MEMBERSHIP.tagline}</Text>
              {isPrimeCurrent ? (
                <View style={styles.primeActiveBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#047857" />
                  <Text style={styles.primeActiveText}>ACTIVE</Text>
                </View>
              ) : null}
            </View>

            {/* Benefits card */}
            <View style={styles.primeBenefitsCard}>
              <Text style={styles.primeBenefitsLabel}>BENEFITS FOR {PRIME_MEMBERSHIP.name.toUpperCase()}</Text>
              {PRIME_MEMBERSHIP.benefits.map((b, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.primeBenefitRow,
                    idx === PRIME_MEMBERSHIP.benefits.length - 1 ? { borderBottomWidth: 0 } : null,
                  ]}
                >
                  <View style={styles.primeBenefitIcon}>
                    <Ionicons name={b.icon as any} size={17} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.primeBenefitTitle}>{b.title}</Text>
                    <Text style={styles.primeBenefitSub}>{b.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Add-on card (selectable) */}
            <TouchableOpacity
              style={[styles.primeAddonCard, addSecondCar ? { borderColor: COLORS.primary, backgroundColor: '#E8F2FF' } : null]}
              onPress={() => setAddSecondCar(!addSecondCar)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={addSecondCar ? 'checkbox' : 'square-outline'}
                size={22}
                color={addSecondCar ? COLORS.primary : '#9CA3AF'}
              />
              <Ionicons name={PRIME_MEMBERSHIP.addOn.icon as any} size={22} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.primeAddonTitle}>{PRIME_MEMBERSHIP.addOn.title}</Text>
                <Text style={styles.primeAddonSub}>{PRIME_MEMBERSHIP.addOn.description}</Text>
              </View>
              <Text style={styles.primeAddonPrice}>{PRIME_MEMBERSHIP.addOn.price}</Text>
            </TouchableOpacity>

            {/* Total price display */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 10 }}>
              <Text style={{ fontSize: 14, color: '#6B7280' }}>Total</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>
                ₹{addSecondCar ? PRIME_MEMBERSHIP.priceNum + 299 : PRIME_MEMBERSHIP.priceNum}
              </Text>
            </View>

            {/* CTA */}
            <TouchableOpacity
              style={[styles.memUpgradeBtn, { marginTop: 14 }, isPrimeCurrent ? { backgroundColor: '#9CA3AF' } : null]}
              onPress={handleMembershipUpgrade}
              disabled={isPrimeCurrent}
              activeOpacity={0.85}
            >
              <Text style={styles.memUpgradeBtnText}>
                {isPrimeCurrent ? 'Already Active' : 'Activate Now  →'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.primeFooterNote}>{PRIME_MEMBERSHIP.footerNote}</Text>
          </View>
        );
      }
      case 'Your Wallet': {
        const bal = isLoggedIn ? Number(walletBalance || 0) : 0;
        const pts = isLoggedIn ? walletRewardPoints : 0;
        const ecb = isLoggedIn ? walletEarnedCashback : 0;
        const rr = isLoggedIn ? walletReferralRewards : 0;
        const filteredTx = walletTransactions.filter((t: any) =>
          walletTxFilter === 'ALL' ? true : t.transaction_type === walletTxFilter
        );
        return (
          <ScrollView style={styles.subWrap} showsVerticalScrollIndicator={false}>
            {/* ── Screen 1: Balance Card ── */}
            <View style={wstyles.balanceCard}>
              <View style={wstyles.balanceCardInner}>
                <View>
                  <Text style={wstyles.balanceLabel}>AVAILABLE BALANCE</Text>
                  <Text style={wstyles.balanceAmount}>₹{bal.toLocaleString('en-IN')}</Text>
                </View>
                <View style={wstyles.walletIconCircle}>
                  <Ionicons name="wallet" size={22} color="#FFFFFF" />
                </View>
              </View>
              <View style={wstyles.rewardRow}>
                <View style={wstyles.rewardPtsWrap}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={wstyles.rewardPtsLabel}>REWARD POINTS</Text>
                </View>
                <Text style={wstyles.rewardPtsValue}>{pts} Pts</Text>
                <TouchableOpacity>
                  <Text style={wstyles.convertBtn}>CONVERT</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Screen 2: Add Money ── */}
            <View style={wstyles.sectionCard}>
              <View style={wstyles.sectionRow}>
                <Ionicons name="add-circle-outline" size={20} color="#1A3C6E" />
                <Text style={wstyles.sectionRowTitle}>Add Money</Text>
              </View>
              <View style={wstyles.addMoneyInputRow}>
                <Text style={wstyles.rupeePrefix}>₹</Text>
                <TextInput
                  style={wstyles.addMoneyInput}
                  placeholder="Enter Amount"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={walletAddAmount}
                  onChangeText={setWalletAddAmount}
                />
              </View>
              <View style={wstyles.quickAmountRow}>
                {[100, 500, 1000].map((amt) => (
                  <TouchableOpacity key={amt} style={wstyles.quickAmountChip}
                    onPress={() => setWalletAddAmount(String(amt))}>
                    <Text style={wstyles.quickAmountText}>+₹{amt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={wstyles.payMethodRow}>
                <TouchableOpacity style={[wstyles.payMethodChip, wstyles.payMethodActive]}>
                  <Ionicons name="phone-portrait-outline" size={14} color="#1A3C6E" />
                  <Text style={wstyles.payMethodTextActive}>UPI</Text>
                </TouchableOpacity>
                <TouchableOpacity style={wstyles.payMethodChip}>
                  <Ionicons name="card-outline" size={14} color="#999" />
                  <Text style={wstyles.payMethodText}>Card</Text>
                </TouchableOpacity>
              </View>
              <Text style={wstyles.payLabel}>PAY VIA UPI / CARD</Text>
              <TouchableOpacity style={wstyles.proceedBtn} activeOpacity={0.8}>
                <Text style={wstyles.proceedBtnText}>Proceed to Add Money</Text>
              </TouchableOpacity>
            </View>

            {/* ── Screen 3: Cashback & Points ── */}
            <View style={wstyles.sectionCard}>
              <View style={wstyles.cashbackRow}>
                <View style={wstyles.cashbackBox}>
                  <View style={[wstyles.cashbackIcon, { backgroundColor: '#E8F5E9' }]}>
                    <Ionicons name="gift" size={20} color="#4CAF50" />
                  </View>
                  <Text style={wstyles.cashbackLabel}>EARNED CASHBACK</Text>
                  <Text style={wstyles.cashbackAmount}>₹{ecb.toLocaleString('en-IN')}</Text>
                  <Text style={wstyles.cashbackSub}>Till now</Text>
                </View>
                <View style={wstyles.cashbackBox}>
                  <View style={[wstyles.cashbackIcon, { backgroundColor: '#E3F2FD' }]}>
                    <Ionicons name="people" size={20} color="#2196F3" />
                  </View>
                  <Text style={wstyles.cashbackLabel}>REFERRAL REWARDS</Text>
                  <Text style={wstyles.cashbackAmount}>₹{rr.toLocaleString('en-IN')}</Text>
                  <Text style={wstyles.cashbackSub}>Currently active</Text>
                </View>
              </View>
            </View>

            {/* Points Conversion */}
            <TouchableOpacity style={wstyles.sectionCard} activeOpacity={0.7}>
              <View style={wstyles.conversionRow}>
                <View style={wstyles.conversionLeft}>
                  <View style={[wstyles.cashbackIcon, { backgroundColor: '#FFF3E0' }]}>
                    <Ionicons name="swap-horizontal" size={20} color="#FF9800" />
                  </View>
                  <View>
                    <Text style={wstyles.conversionTitle}>Points Conversion</Text>
                    <Text style={wstyles.conversionSub}>Convert Points → Wallet Money</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
            </TouchableOpacity>

            {/* Offers & Bonuses */}
            <View style={wstyles.sectionCard}>
              <View style={wstyles.sectionRow}>
                <Ionicons name="pricetag" size={18} color="#1A3C6E" />
                <Text style={wstyles.sectionRowTitle}>Offers & Bonuses</Text>
              </View>
              <View style={wstyles.offerRow}>
                <View style={wstyles.offerLeft}>
                  <View style={[wstyles.offerBadge, { backgroundColor: '#FFEBEE' }]}>
                    <Ionicons name="gift" size={16} color="#E53935" />
                  </View>
                  <View>
                    <Text style={wstyles.offerTag}>GET50</Text>
                    <Text style={wstyles.offerDesc}>Flat ₹50 Cashback</Text>
                  </View>
                </View>
                <TouchableOpacity>
                  <Text style={wstyles.offerApply}>APPLY</Text>
                </TouchableOpacity>
              </View>
              <View style={wstyles.promoRow}>
                <TextInput
                  style={wstyles.promoInput}
                  placeholder="Enter Promo Code"
                  placeholderTextColor="#999"
                  value={walletPromoCode}
                  onChangeText={setWalletPromoCode}
                />
                <TouchableOpacity>
                  <Text style={wstyles.offerApply}>APPLY</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Screen 4: Redeem / Use Balance ── */}
            <View style={wstyles.sectionCard}>
              <Text style={wstyles.redeemHeader}>REDEEM / USE BALANCE</Text>
              <View style={wstyles.redeemRow}>
                <TouchableOpacity style={wstyles.redeemOption}>
                  <Ionicons name="construct" size={24} color="#1A3C6E" />
                  <Text style={wstyles.redeemLabel}>Pay for Service</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[wstyles.redeemOption, wstyles.redeemOptionActive]}>
                  <Ionicons name="ribbon" size={24} color="#1A3C6E" />
                  <Text style={wstyles.redeemLabelActive}>Buy Membership</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Withdraw to Bank */}
            <View style={wstyles.sectionCard}>
              <View style={wstyles.withdrawRow}>
                <View style={[wstyles.cashbackIcon, { backgroundColor: '#E8EAF6' }]}>
                  <Ionicons name="business" size={20} color="#3F51B5" />
                </View>
                <View>
                  <Text style={wstyles.withdrawTitle}>Withdraw to Bank</Text>
                  <Text style={wstyles.withdrawSub}>Transfer to Bank / UPI</Text>
                </View>
              </View>
              <TouchableOpacity style={wstyles.withdrawBtn} activeOpacity={0.8}>
                <Text style={wstyles.withdrawBtnText}>Withdraw Money  →</Text>
              </TouchableOpacity>
            </View>

            {/* ── Screen 5: Transactions ── */}
            <View style={wstyles.sectionCard}>
              <View style={wstyles.txHeaderRow}>
                <View style={[wstyles.cashbackIcon, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="time" size={20} color="#FF9800" />
                </View>
                <Text style={wstyles.txHeaderTitle}>Transactions</Text>
              </View>
              <View style={wstyles.txFilterRow}>
                {(['ALL', 'CREDIT', 'DEBIT'] as const).map((f) => (
                  <TouchableOpacity key={f}
                    style={[wstyles.txFilterChip, walletTxFilter === f && wstyles.txFilterChipActive]}
                    onPress={() => setWalletTxFilter(f)}>
                    <Text style={[wstyles.txFilterText, walletTxFilter === f && wstyles.txFilterTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {filteredTx.length === 0 ? (
                <Text style={wstyles.txEmpty}>No transactions yet.</Text>
              ) : (
                filteredTx.slice(0, 20).map((tx: any, idx: number) => {
                  const isCredit = tx.transaction_type === 'CREDIT';
                  const src = String(tx.source || '');
                  let icon: keyof typeof Ionicons.glyphMap = isCredit ? 'add-circle' : 'remove-circle';
                  let iconColor = isCredit ? '#4CAF50' : '#E53935';
                  let label = isCredit ? 'Added to Wallet' : 'Payment';
                  if (src.includes('REFERRAL')) { icon = 'people'; iconColor = '#FF9800'; label = 'Referral Bonus'; }
                  else if (src.includes('CASHBACK')) { icon = 'gift'; iconColor = '#4CAF50'; label = 'Cashback'; }
                  else if (src.includes('SERVICE') || src.includes('BOOKING')) { icon = 'construct'; iconColor = '#E53935'; label = tx.metadata?.service_name || 'Service Payment'; }
                  const dt = tx.created_at ? new Date(tx.created_at) : null;
                  return (
                    <View key={tx.id || idx} style={wstyles.txRow}>
                      <View style={[wstyles.txIconWrap, { backgroundColor: `${iconColor}15` }]}>
                        <Ionicons name={icon} size={20} color={iconColor} />
                      </View>
                      <View style={wstyles.txInfo}>
                        <Text style={wstyles.txLabel}>{label}</Text>
                        <Text style={wstyles.txDate}>
                          {dt ? `${dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} • Success` : ''}
                        </Text>
                      </View>
                      <Text style={[wstyles.txAmount, { color: isCredit ? '#4CAF50' : '#E53935' }]}>
                        {isCredit ? '+' : '-'} ₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
            <View style={{ height: 30 }} />
          </ScrollView>
        );
      }
      case 'Refer & Earn':
        return (
          <View style={styles.subWrap}>
            {/* Hero Banner */}
            <View style={styles.refHeroBanner}>
              <View style={styles.refHeroIcons}>
                <View style={[styles.refHeroIconCircle, { backgroundColor: '#F97316' }]}>
                  <Ionicons name="gift" size={18} color="#FFFFFF" />
                </View>
                <View style={[styles.refHeroIconCircle, { backgroundColor: COLORS.primary }]}>
                  <Ionicons name="construct" size={18} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.refHeroTitle}>{'Refer Friends & Earn\nService Rewards 🎉'}</Text>
              <Text style={styles.refHeroSub}>
                Invite your friends to MyFNG. When they install the app and book a service, you earn referral rewards.
              </Text>
              <TouchableOpacity
                style={styles.refInviteBtn}
                activeOpacity={1}
                onPress={() => Share.share({ message: `Join MyFNG – India's #1 AI-powered car service platform! Use my referral code ${referralCode || 'MYFNG'} to get ₹500 off your first service. Download now: https://myfng.in` })}
              >
                <Text style={styles.refInviteBtnText}>Invite Friends</Text>
              </TouchableOpacity>
            </View>

            {/* Referral Code */}
            <View style={styles.refCodeCard}>
              <Text style={styles.refCodeLabel}>YOUR REFERRAL CODE</Text>
              <Text style={styles.refCodeValue}>{referralCode || 'MYFNG...'}</Text>
              <View style={styles.refCodeActions}>
                <TouchableOpacity
                  style={styles.refCopyBtn}
                  activeOpacity={1}
                  onPress={async () => {
                    if (referralCode) {
                      await Clipboard.setStringAsync(referralCode);
                      Alert.alert('Copied!', 'Referral code copied to clipboard.');
                    }
                  }}
                >
                  <Ionicons name="copy-outline" size={14} color="#111827" />
                  <Text style={styles.refCopyBtnText}>Copy Code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.refShareBtn}
                  activeOpacity={1}
                  onPress={() => Share.share({ message: `Join MyFNG – India's #1 AI-powered car service platform! Use my referral code ${referralCode || 'MYFNG'} to get ₹500 off your first service. Download now: https://myfng.in` })}
                >
                  <Ionicons name="share-social-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.refShareBtnText}>Share Link</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Your Rewards */}
            <View style={styles.refSectionCard}>
              <View style={styles.refSectionHeader}>
                <Ionicons name="ribbon" size={18} color={COLORS.primary} />
                <Text style={styles.refSectionTitle}>Your Rewards</Text>
              </View>
              <View style={styles.refRewardRow}>
                <Text style={styles.refRewardEmoji}>🎁</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.refRewardBadge}>
                    <Text style={styles.refRewardBadgeText}>FIRST SUCCESSFUL REFERRAL</Text>
                  </View>
                  <Text style={styles.refRewardValue}>Earn ₹500 reward</Text>
                </View>
              </View>
              <View style={styles.refRewardRow}>
                <Text style={styles.refRewardEmoji}>💝</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.refRewardBadge}>
                    <Text style={styles.refRewardBadgeText}>EVERY NEXT REFERRAL</Text>
                  </View>
                  <Text style={styles.refRewardValue}>Earn ₹250 reward</Text>
                </View>
              </View>
            </View>

            {/* Friend Benefits */}
            <View style={styles.refSectionCard}>
              <View style={styles.refSectionHeader}>
                <Ionicons name="gift" size={18} color="#F97316" />
                <Text style={styles.refSectionTitle}>Friend Benefits</Text>
              </View>
              <Text style={styles.refFriendDesc}>
                When your friend installs the MyFNG app using your referral code, they receive:
              </Text>
              <View style={styles.refFriendBenefitRow}>
                <Text style={styles.refRewardEmoji}>🎁</Text>
                <Text style={styles.refFriendBenefitText}>₹500 referral bonus</Text>
              </View>
              <View style={styles.refFriendBenefitRow}>
                <Text style={styles.refRewardEmoji}>🚗</Text>
                <Text style={styles.refFriendBenefitText}>Free pickup & drop on first service</Text>
              </View>
              <View style={styles.refFriendBenefitRow}>
                <Text style={styles.refRewardEmoji}>⭐</Text>
                <Text style={styles.refFriendBenefitText}>Priority booking slot</Text>
              </View>
            </View>

            {/* How It Works */}
            <View style={styles.refSectionCard}>
              <Text style={styles.refSectionTitle}>How It Works</Text>
              {([
                { icon: 'share-social-outline' as const, label: 'STEP 1', text: 'Share your referral code with friends.' },
                { icon: 'phone-portrait-outline' as const, label: 'STEP 2', text: 'Friend installs the MyFNG app.' },
                { icon: 'car-sport-outline' as const, label: 'STEP 3', text: 'Friend books a service through the app.' },
                { icon: 'gift-outline' as const, label: 'STEP 4', text: 'Your referral reward gets unlocked.' },
              ]).map((item, idx) => (
                <View key={String(idx)} style={styles.refStepCard}>
                  <View style={styles.refStepIconWrap}>
                    <Ionicons name={item.icon} size={20} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.refStepLabel}>{item.label}</Text>
                    <Text style={styles.refStepText}>{item.text}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Stats */}
            <View style={styles.refStatsRow}>
              <View style={styles.refStatBox}>
                <Text style={styles.refStatNum}>0</Text>
                <Text style={styles.refStatLabel}>TOTAL INVITES{'\n'}SENT</Text>
              </View>
              <View style={styles.refStatBox}>
                <Text style={styles.refStatNum}>0</Text>
                <Text style={styles.refStatLabel}>SUCCESSFUL{'\n'}REFERRALS</Text>
              </View>
            </View>

            {/* Referral History */}
            <View style={styles.refSectionCard}>
              <Text style={styles.refSectionTitle}>Referral History</Text>
              <View style={styles.refHistoryEmpty}>
                <Text style={styles.refHistoryCount}>0 Referrals</Text>
                {!isLoggedIn ? (
                  <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                    <Text style={styles.refHistoryLogin}>Login to See</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.refHistoryNone}>No referrals yet. Start inviting!</Text>
                )}
              </View>
            </View>

            {/* Terms & Conditions Dropdown */}
            <TouchableOpacity
              style={styles.refTncHeader}
              onPress={() => setShowReferTnC((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
                <Text style={styles.refTncHeaderText}>TERMS & CONDITIONS</Text>
              </View>
              <Ionicons name={showReferTnC ? 'chevron-up' : 'chevron-down'} size={16} color="#6B7280" />
            </TouchableOpacity>
            {showReferTnC ? (
              <View style={styles.refTncBody}>
                {[
                  'First successful referral gives ₹500 reward.',
                  'Every next referral gives ₹250 reward.',
                  'Referral reward unlocks only after the referred user books a service through MyFNG.',
                  'Maximum ₹500 discount on periodic service packages.',
                  'Maximum ₹200 discount on other services.',
                  'Rewards cannot be converted to cash.',
                ].map((term, idx) => (
                  <Text key={String(idx)} style={styles.refTncItem}>• {term}</Text>
                ))}
              </View>
            ) : null}
          </View>
        );
      case 'Order History': {
        if (!isLoggedIn) {
          return (
            <View style={styles.subWrap}>
              <View style={ostyles.loginGate}>
                <View style={ostyles.lockCircle}>
                  <Ionicons name="lock-closed" size={32} color="#9CA3AF" />
                </View>
                <Text style={ostyles.loginGateTitle}>Login Required</Text>
                <Text style={ostyles.loginGateSub}>Please login to view your order history and{'\n'}track active services.</Text>
                <TouchableOpacity style={ostyles.loginNowBtn} onPress={() => navigation.navigate('Login' as never)}>
                  <Text style={ostyles.loginNowBtnText}>Login Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }
        const STATUS_MAP: Record<string, string> = {
          completed: 'Completed', done: 'Completed', closed: 'Completed',
          'in-progress': 'In-Progress', in_progress: 'In-Progress', ongoing: 'In-Progress', active: 'In-Progress',
          upcoming: 'Upcoming', scheduled: 'Upcoming', pending: 'Upcoming', confirmed: 'Upcoming',
          cancelled: 'Cancelled', canceled: 'Cancelled',
        };
        const getOrderStatus = (o: any) => STATUS_MAP[String(o.status || '').toLowerCase()] || 'Upcoming';
        const FILTER_MAP: Record<string, string[]> = {
          All: [],
          Completed: ['Completed'],
          Upcoming: ['Upcoming'],
          Ongoing: ['In-Progress'],
          Cancelled: ['Cancelled'],
        };
        const filtered = orderFilter === 'All'
          ? orders
          : orders.filter((o: any) => FILTER_MAP[orderFilter]?.includes(getOrderStatus(o)));
        const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
          'Completed': { bg: '#E8F5E9', text: '#2E7D32' },
          'In-Progress': { bg: '#E3F2FD', text: '#1565C0' },
          'Upcoming': { bg: '#FFF3E0', text: '#E65100' },
          'Cancelled': { bg: '#FFEBEE', text: '#C62828' },
        };
        return (
          <ScrollView style={styles.subWrap} showsVerticalScrollIndicator={false}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ostyles.filterScroll} contentContainerStyle={ostyles.filterRow}>
              {(['All', 'Completed', 'Upcoming', 'Ongoing', 'Cancelled'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[ostyles.filterChip, orderFilter === f && ostyles.filterChipActive]}
                  onPress={() => setOrderFilter(f)}
                >
                  <Text style={[ostyles.filterText, orderFilter === f && ostyles.filterTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filtered.length === 0 ? (
              <View style={ostyles.emptyWrap}>
                <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
                <Text style={ostyles.emptyTitle}>No Orders Found</Text>
                <Text style={ostyles.emptySub}>
                  {orderFilter === 'All' ? 'You have no orders yet. Book a service to get started!' : `No ${orderFilter.toLowerCase()} orders.`}
                </Text>
              </View>
            ) : (
              filtered.map((order: any, idx: number) => {
                const status = getOrderStatus(order);
                const colors = STATUS_COLORS[status] || STATUS_COLORS['Upcoming'];
                const dt = order.created_at ? new Date(order.created_at) : null;
                const toTitleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
                const rawModel = order.vehicle_make && order.vehicle_model
                  ? `${order.vehicle_make} ${order.vehicle_model}`
                  : order.vehicle_model || order.vehicle_make || '';
                const carModel = rawModel ? toTitleCase(rawModel) : '';
                const leadNum = order.lead_number || order.id?.slice(0, 8) || '';
                const rawAmt = Number(order.amount_display || 0);
                const displayAmt = rawAmt > 0 ? `₹${Math.round(rawAmt).toLocaleString('en-IN')}` : '-';
                const workshop = order.workshop_name || 'MyFNG Partner';

                return (
                  <View key={order.id || idx} style={ostyles.orderCard}>
                    <View style={ostyles.orderCardHeader}>
                      <Text style={ostyles.orderId}>ORDER ID: #{leadNum.toUpperCase()}</Text>
                      <View style={[ostyles.statusBadge, { backgroundColor: colors.bg }]}>
                        <Ionicons
                          name={status === 'Completed' ? 'checkmark-circle' : status === 'Cancelled' ? 'close-circle' : status === 'In-Progress' ? 'time' : 'calendar'}
                          size={12}
                          color={colors.text}
                        />
                        <Text style={[ostyles.statusText, { color: colors.text }]}>{status}</Text>
                      </View>
                    </View>
                    <Text style={ostyles.carModel}>{carModel || 'Vehicle'}</Text>
                    <Text style={ostyles.serviceType}>{(order.service_display || order.service_type || 'Service').replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}</Text>

                    <View style={ostyles.detailRow}>
                      <View style={ostyles.detailCol}>
                        <Text style={ostyles.detailLabel}>DATE</Text>
                        <Text style={ostyles.detailValue}>
                          {dt ? dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </Text>
                      </View>
                      <View style={ostyles.detailCol}>
                        <Text style={ostyles.detailLabel}>WORKSHOP</Text>
                        <Text style={ostyles.detailValue} numberOfLines={1}>{workshop}</Text>
                      </View>
                    </View>

                    <View style={ostyles.amountRow}>
                      <View>
                        <Text style={ostyles.detailLabel}>TOTAL AMOUNT</Text>
                        <Text style={ostyles.amountValue}>{displayAmt}</Text>
                      </View>
                    </View>

                    <View style={ostyles.actionRow}>
                      <TouchableOpacity style={ostyles.bookAgainBtn} onPress={() => viewOrderDetails(order.id)}>
                        <Ionicons name="eye-outline" size={14} color="#1A3C6E" />
                        <Text style={ostyles.bookAgainText}>VIEW DETAILS</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={ostyles.bookAgainBtn}
                        onPress={() => {
                          navigation.navigate('PublicBookServiceNow', {
                            rebookOrder: {
                              vehicle_make: order.vehicle_make || '',
                              vehicle_model: order.vehicle_model || '',
                              fuel_type: order.fuel_type || '',
                              city: order.city || '',
                              address: order.address || '',
                              service_type: order.service_type || '',
                              service_type_ids: order.service_type_ids || '',
                              service_display: order.service_display || '',
                            },
                          });
                        }}
                      >
                        <Ionicons name="refresh" size={14} color="#1A3C6E" />
                        <Text style={ostyles.bookAgainText}>BOOK AGAIN</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
            <View style={{ height: 30 }} />
          </ScrollView>
        );
      }
      case 'Cart':
        if (!isLoggedIn) {
          return (
            <View style={styles.subWrap}>
              <View style={cstyles.loginGate}>
                <View style={cstyles.lockCircle}>
                  <Ionicons name="lock-closed" size={32} color="#9CA3AF" />
                </View>
                <Text style={cstyles.loginGateTitle}>Login Required</Text>
                <Text style={cstyles.loginGateSub}>Please login to view your cart and{'\n'}continue booking.</Text>
                <TouchableOpacity style={cstyles.loginNowBtn} onPress={() => navigation.navigate('Login' as never)}>
                  <Text style={cstyles.loginNowBtnText}>Login Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }

        return (
          <View style={styles.subWrap}>
            <View style={cstyles.sectionCard}>
              <View style={cstyles.vehicleRow}>
                <View style={cstyles.vehicleIconWrap}>
                  <VehicleImage vehicle={selectedVehicle} style={cstyles.vehicleThumb} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={cstyles.vehicleName}>
                    {toTitleCase(
                      [selectedVehicle?.make, selectedVehicle?.model].filter(Boolean).join(' ') || 'Your Car'
                    )}
                  </Text>
                  <Text style={cstyles.vehicleMeta}>
                    {String(selectedVehicle?.vehicle_number || 'DL01AB1234').toUpperCase()} • {String(selectedVehicle?.fuel_type || 'Petrol').toUpperCase()}
                  </Text>
                </View>
                <TouchableOpacity style={cstyles.changeChip} onPress={() => {
                  if (allAssociatedVehicles.length > 1) {
                    setShowVehiclePicker(true);
                  } else {
                    Alert.alert(
                      'Change Vehicle',
                      'You have only one saved vehicle. Add another vehicle in My Profile to switch.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Add Vehicle',
                          onPress: () => {
                            setVehicleEntryOnly(true);
                            setActiveSubPage('My Profile');
                          },
                        },
                      ]
                    );
                  }
                }}>
                  <Text style={cstyles.changeChipText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={cstyles.sectionHeading}>SELECTED SERVICES</Text>
            <View style={cstyles.sectionCard}>
              {resumableLeads.length > 0 ? (
                <View style={cstyles.resumeWrap}>
                  <Text style={cstyles.resumeTitle}>Resume Booking</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cstyles.resumeRow}>
                    {resumableLeads.slice(0, 6).map((lead: any) => {
                      const active = cartSelectedLeadId === String(lead.id);
                      const planName = String(lead?.service_display || lead?.plan_name || lead?.package_name || lead?.service_type || 'Service').trim();
                      const leadPrice = Math.max(0, Math.round(Number(lead?.estimated_amount || 0)));
                      return (
                        <TouchableOpacity
                          key={String(lead.id)}
                          style={[cstyles.resumeCard, active ? cstyles.resumeCardActive : null]}
                          disabled={cartSyncing}
                          onPress={async () => {
                            setCartSelectedLeadId(String(lead.id));
                            setCartSelectedService((prev) => ({
                              name: planName || prev?.name || 'Periodic Service Package',
                              price: Number(lead?.estimated_amount || prev?.price || 2999),
                              items: prev?.items || ['Service Checklist', 'Basic Diagnostics', 'General Inspection'],
                            }));
                            const alreadyInCart = (cartItems || []).some(
                              (it: any) => String(it?.metadata?.lead_id || '') === String(lead.id),
                            );
                            if (!alreadyInCart) {
                              await addCartItem(planName || 'Service', leadPrice || 2999, 1, {
                                lead_id: String(lead.id),
                                lead_number: lead?.lead_number || null,
                                source: 'resume_booking',
                              });
                            }
                          }}
                        >
                          <Text style={cstyles.resumeLeadNumber}>{String(lead?.lead_number || '').toUpperCase() || 'BOOKING'}</Text>
                          <Text style={cstyles.resumePlanName} numberOfLines={1}>{planName}</Text>
                          <Text style={cstyles.resumeLeadMeta} numberOfLines={1}>
                            {String(lead?.status || 'NEW').toUpperCase()} • ₹{leadPrice.toLocaleString('en-IN')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {cartLoading ? (
                <Text style={cstyles.workshopEmpty}>Loading your cart...</Text>
              ) : cartItems.length === 0 ? (
                <View style={cstyles.pickupEmptyWrap}>
                  <Text style={cstyles.workshopEmpty}>Your cart is empty.</Text>
                  <TouchableOpacity
                    style={cstyles.addPickupBtn}
                    onPress={() => navigation.navigate('PublicServicePackages' as never)}
                  >
                    <Text style={cstyles.addPickupBtnText}>Add a Service</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                cartItems.map((item: any, idx: number) => {
                  const checklist = Array.isArray(item?.metadata?.items) ? item.metadata.items : (cartSelectedService?.items || []);
                  return (
                    <View key={String(item?.id || idx)} style={{ marginTop: idx === 0 ? 0 : 12, paddingTop: idx === 0 ? 0 : 12, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: '#F3F4F6' }}>
                      <View style={cstyles.serviceHeaderRow}>
                        <Text style={cstyles.serviceTitle}>{String(item?.service_type || 'Service')}</Text>
                        <Text style={cstyles.servicePrice}>₹{Math.round(Number(item?.total_price || 0)).toLocaleString('en-IN')}</Text>
                      </View>
                      {(checklist || []).slice(0, 4).map((line: string) => (
                        <View key={line} style={cstyles.serviceBulletRow}>
                          <Ionicons name="checkmark" size={14} color="#22C55E" />
                          <Text style={cstyles.serviceBulletText}>{line}</Text>
                        </View>
                      ))}
                      <View style={cstyles.serviceActionRow}>
                        <TouchableOpacity
                          style={cstyles.removeBtn}
                          disabled={cartSyncing}
                          onPress={() => removeCartItem(String(item?.id))}
                        >
                          <Text style={cstyles.removeBtnText}>{cartSyncing ? 'Removing...' : 'Remove'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={cstyles.editBtn}
                          onPress={() => {
                            const cityParam = pickupForm.city?.trim() || undefined;
                            const serviceName = String(item?.service_type || cartSelectedService?.name || '');
                            const categoryId = mapServiceNameToCategoryId(serviceName);
                            navigation.navigate('PublicServicePackages', { city: cityParam, selectedServiceId: categoryId } as never);
                          }}
                        >
                          <Text style={cstyles.editBtnText}>Edit Service</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={cstyles.sectionCard}>
              <Text style={cstyles.subHeading}>APPLY COUPON</Text>

              {cartAvailableCoupons.length > 0 ? (
                <View style={{ marginBottom: 10 }}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                  >
                    {cartAvailableCoupons.map((c) => {
                      const isApplied = cartCouponResult?.coupon?.code && String(cartCouponResult.coupon.code).toUpperCase() === String(c.code).toUpperCase();
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
                          onPress={() => {
                            if (isApplied) {
                              setCartCouponResult(null);
                              setCoupon('');
                            } else {
                              applyCartCoupon(c.code);
                            }
                          }}
                          disabled={cartCouponLoading}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="pricetag" size={14} color={isApplied ? '#047857' : '#1D4ED8'} />
                            <Text style={{ fontSize: 13, fontWeight: '800', color: isApplied ? '#047857' : '#1E293B' }}>{c.code}</Text>
                          </View>
                          <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }} numberOfLines={1}>
                            {describeCartCoupon(c)}
                          </Text>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: isApplied ? '#047857' : '#1D4ED8', marginTop: 4 }}>
                            {isApplied ? '✓ APPLIED' : 'TAP TO APPLY'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              <View style={cstyles.couponRow}>
                <TextInput
                  style={cstyles.couponInput}
                  placeholder="Or enter coupon code"
                  placeholderTextColor="#9CA3AF"
                  value={coupon}
                  onChangeText={setCoupon}
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={cstyles.applyBtn} onPress={() => applyCartCoupon()} disabled={cartCouponLoading}>
                  <Text style={cstyles.applyBtnText}>{cartCouponLoading ? '...' : 'Apply'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={cstyles.sectionHeading}>SERVICE MODE</Text>
            <View style={cstyles.sectionCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() => setCartServiceMode('pickup')}
                  activeOpacity={0.85}
                >
                  <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: cartServiceMode === 'pickup' ? '#6366F1' : '#D1D5DB' }}>
                    <Ionicons name="navigate" size={18} color={cartServiceMode === 'pickup' ? '#FFF' : '#6B7280'} />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: cartServiceMode === 'pickup' ? '#4338CA' : '#6B7280' }}>Pickup</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setCartServiceMode(cartServiceMode === 'pickup' ? 'workshop' : 'pickup')}
                  style={{ width: 52, height: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: cartServiceMode === 'pickup' ? '#6366F1' : '#10B981' }}
                >
                  <View style={{ position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', ...(cartServiceMode === 'pickup' ? { left: 3 } : { right: 3 }) }}>
                    <Ionicons name={cartServiceMode === 'pickup' ? 'navigate' : 'location'} size={14} color={cartServiceMode === 'pickup' ? '#6366F1' : '#10B981'} />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}
                  onPress={() => { setCartServiceMode('workshop'); fetchCartWorkshops(); }}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 14, fontWeight: '800', color: cartServiceMode === 'workshop' ? '#047857' : '#6B7280' }}>Visit</Text>
                  <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: cartServiceMode === 'workshop' ? '#10B981' : '#D1D5DB' }}>
                    <Ionicons name="location" size={18} color={cartServiceMode === 'workshop' ? '#FFF' : '#6B7280'} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {cartServiceMode === 'pickup' ? (
              <View style={cstyles.sectionCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="calendar" size={14} color="#FFFFFF" />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#1A1A1A' }}>Pickup Date</Text>
                </View>
                {(() => {
                  const now = new Date();
                  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                  const tmr = new Date(now.getTime() + 86400000);
                  const tomorrowStr = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`;
                  const fmtShort = (s: string) => { const d = new Date(s + 'T00:00:00'); return `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}`; };
                  return (
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: cartDateStr === todayStr ? '#1D4ED8' : '#E5E7EB', backgroundColor: cartDateStr === todayStr ? '#EFF6FF' : '#FFF' }}
                        onPress={() => { setCartDateStr(todayStr); setCartDate(now); }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: cartDateStr === todayStr ? '#1D4ED8' : '#374151' }}>Today, {fmtShort(todayStr)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: cartDateStr === tomorrowStr ? '#1D4ED8' : '#E5E7EB', backgroundColor: cartDateStr === tomorrowStr ? '#EFF6FF' : '#FFF' }}
                        onPress={() => { setCartDateStr(tomorrowStr); setCartDate(tmr); }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: cartDateStr === tomorrowStr ? '#1D4ED8' : '#374151' }}>Tomorrow, {fmtShort(tomorrowStr)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => setShowCartDatePicker(true)}
                      >
                        <Ionicons name="calendar" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  );
                })()}
                {showCartDatePicker ? (
                  <View style={[styles.datePickerWrap, { marginTop: 8 }]}>
                    <DateTimePicker
                      value={cartDate}
                      mode="date"
                      minimumDate={new Date()}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(e, d) => {
                        if (Platform.OS === 'android') setShowCartDatePicker(false);
                        if (d) {
                          setCartDate(d);
                          setCartDateStr(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                        }
                      }}
                    />
                    {Platform.OS === 'ios' ? (
                      <TouchableOpacity style={styles.datePickerDoneBtn} onPress={() => setShowCartDatePicker(false)}>
                        <Text style={styles.datePickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}

                {cartDateStr ? (
                  <View style={{ marginTop: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#A855F7', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="time" size={14} color="#FFFFFF" />
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#1A1A1A' }}>Pickup Time</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {[
                        { value: '10:00', label: '10 AM - 11 AM' },
                        { value: '11:00', label: '11 AM - 12 PM' },
                        { value: '12:00', label: '12 PM - 1 PM' },
                        { value: '13:00', label: '1 PM - 2 PM' },
                        { value: '14:00', label: '2 PM - 3 PM' },
                        { value: '15:00', label: '3 PM - 4 PM' },
                      ].map((slot) => {
                        const isActive = cartTimeStr === slot.value;
                        return (
                          <TouchableOpacity
                            key={slot.value}
                            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: isActive ? '#7C3AED' : '#E5E7EB', backgroundColor: isActive ? '#F5F3FF' : '#FFF' }}
                            onPress={() => { setCartTimeStr(slot.value); const t = new Date(); t.setHours(parseInt(slot.value), 0, 0, 0); setCartTime(t); }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? '#7C3AED' : '#374151' }}>{slot.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {cartTimeStr ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                        <Ionicons name="checkmark-circle" size={14} color="#7C3AED" />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#7C3AED' }}>
                          Selected: {[{ value: '10:00', label: '10 AM - 11 AM' }, { value: '11:00', label: '11 AM - 12 PM' }, { value: '12:00', label: '12 PM - 1 PM' }, { value: '13:00', label: '1 PM - 2 PM' }, { value: '14:00', label: '2 PM - 3 PM' }, { value: '15:00', label: '3 PM - 4 PM' }].find((s) => s.value === cartTimeStr)?.label}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={{ marginTop: 10, padding: 10, backgroundColor: '#F9FAFB', borderRadius: 10 }}>
                    <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '600' }}>Select a pickup date to choose a time slot.</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={cstyles.sectionCard}>
                {/* Visit Date */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="calendar" size={14} color="#FFFFFF" />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#1A1A1A' }}>Visit Date</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#EF4444', marginLeft: 2 }}>*</Text>
                </View>
                {(() => {
                  const now = new Date();
                  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                  const tmr = new Date(now.getTime() + 86400000);
                  const tomorrowStr = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`;
                  const fmtShort = (s: string) => { const d = new Date(s + 'T00:00:00'); return `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}`; };
                  return (
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: cartDateStr === todayStr ? '#1D4ED8' : '#E5E7EB', backgroundColor: cartDateStr === todayStr ? '#EFF6FF' : '#FFF' }}
                        onPress={() => { setCartDateStr(todayStr); setCartDate(now); }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: cartDateStr === todayStr ? '#1D4ED8' : '#374151' }}>Today, {fmtShort(todayStr)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: cartDateStr === tomorrowStr ? '#1D4ED8' : '#E5E7EB', backgroundColor: cartDateStr === tomorrowStr ? '#EFF6FF' : '#FFF' }}
                        onPress={() => { setCartDateStr(tomorrowStr); setCartDate(tmr); }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: cartDateStr === tomorrowStr ? '#1D4ED8' : '#374151' }}>Tomorrow, {fmtShort(tomorrowStr)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => setShowCartDatePicker(true)}
                      >
                        <Ionicons name="calendar" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  );
                })()}
                {showCartDatePicker ? (
                  <View style={[styles.datePickerWrap, { marginTop: 8 }]}>
                    <DateTimePicker
                      value={cartDate}
                      mode="date"
                      minimumDate={new Date()}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(e, d) => {
                        if (Platform.OS === 'android') setShowCartDatePicker(false);
                        if (d) {
                          setCartDate(d);
                          setCartDateStr(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                        }
                      }}
                    />
                    {Platform.OS === 'ios' ? (
                      <TouchableOpacity style={styles.datePickerDoneBtn} onPress={() => setShowCartDatePicker(false)}>
                        <Text style={styles.datePickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}

                {/* Visit Time */}
                {cartDateStr ? (
                  <View style={{ marginTop: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#A855F7', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="time" size={14} color="#FFFFFF" />
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#1A1A1A' }}>Visit Time</Text>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: '#EF4444', marginLeft: 2 }}>*</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {[
                        { value: '10:00', label: '10 AM - 11 AM' },
                        { value: '11:00', label: '11 AM - 12 PM' },
                        { value: '12:00', label: '12 PM - 1 PM' },
                      ].map((slot) => {
                        const isActive = cartTimeStr === slot.value;
                        return (
                          <TouchableOpacity
                            key={slot.value}
                            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: isActive ? '#7C3AED' : '#E5E7EB', backgroundColor: isActive ? '#F5F3FF' : '#FFF' }}
                            onPress={() => { setCartTimeStr(slot.value); const t = new Date(); t.setHours(parseInt(slot.value), 0, 0, 0); setCartTime(t); }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? '#7C3AED' : '#374151' }}>{slot.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {cartTimeStr ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                        <Ionicons name="checkmark-circle" size={14} color="#7C3AED" />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#7C3AED' }}>
                          Selected: {[{ value: '10:00', label: '10 AM - 11 AM' }, { value: '11:00', label: '11 AM - 12 PM' }, { value: '12:00', label: '12 PM - 1 PM' }].find((s) => s.value === cartTimeStr)?.label}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={{ marginTop: 10, padding: 10, backgroundColor: '#F9FAFB', borderRadius: 10 }}>
                    <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '600' }}>Select a visit date to choose a time slot.</Text>
                  </View>
                )}
              </View>
            )}

            {cartServiceMode === 'pickup' ? (
              <>
                <Text style={cstyles.sectionHeading}>PICKUP ADDRESS</Text>
                <View style={cstyles.sectionCard}>
                  {savedAddresses.length > 0 ? (
                    <View style={cstyles.pickupAddressList}>
                      {savedAddresses.map((address) => {
                        const active = cartPickupAddressId === address.id;
                        return (
                          <TouchableOpacity
                            key={address.id}
                            style={[cstyles.pickupAddressCard, active ? cstyles.pickupAddressCardActive : null]}
                            onPress={() => setCartPickupAddressId(address.id)}
                          >
                            <Text style={cstyles.pickupAddressLabel}>{address.label}</Text>
                            <Text style={cstyles.pickupAddressValue} numberOfLines={2}>{address.value}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={cstyles.workshopEmpty}>No saved pickup address yet. Add one below.</Text>
                  )}

                  <TouchableOpacity
                    style={cstyles.pickupToggleRow}
                    onPress={() => setShowInlinePickupAdd((v) => !v)}
                  >
                    <Ionicons
                      name={showInlinePickupAdd ? 'remove-circle-outline' : 'add-circle-outline'}
                      size={16}
                      color="#1D4ED8"
                    />
                    <Text style={cstyles.pickupToggleText}>
                      {showInlinePickupAdd ? 'Cancel' : 'Add new pickup address'}
                    </Text>
                  </TouchableOpacity>

                  {showInlinePickupAdd ? (
                    <View style={cstyles.pickupFormWrap}>
                      <View style={cstyles.pickupLabelRow}>
                        {(['Home', 'Work', 'Others'] as const).map((label) => {
                          const active = pickupForm.label === label;
                          return (
                            <TouchableOpacity
                              key={label}
                              style={[cstyles.pickupLabelPill, active ? cstyles.pickupLabelPillActive : null]}
                              onPress={() => setPickupForm((prev) => ({ ...prev, label }))}
                            >
                              <Text style={[cstyles.pickupLabelPillText, active ? cstyles.pickupLabelPillTextActive : null]}>{label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <TouchableOpacity
                        style={cstyles.pickupLocateBtn}
                        onPress={handlePickupQuickLocation}
                        disabled={pickupLocationLoading}
                      >
                        <Ionicons name="locate-outline" size={14} color="#FFFFFF" />
                        <Text style={cstyles.pickupLocateBtnText}>
                          {pickupLocationLoading ? 'Fetching location...' : 'Use Current Location'}
                        </Text>
                      </TouchableOpacity>

                      <TextInput
                        style={cstyles.pickupInput}
                        placeholder="Address line 1 (House / Flat / Building) *"
                        placeholderTextColor="#9CA3AF"
                        value={pickupForm.line1}
                        onChangeText={(t) => setPickupForm((prev) => ({ ...prev, line1: t }))}
                      />
                      <TextInput
                        style={cstyles.pickupInput}
                        placeholder="Address line 2 (Area / Street) — optional"
                        placeholderTextColor="#9CA3AF"
                        value={pickupForm.line2}
                        onChangeText={(t) => setPickupForm((prev) => ({ ...prev, line2: t }))}
                      />
                      <View style={cstyles.pickupRow2}>
                        <TextInput
                          style={[cstyles.pickupInput, { flex: 1 }]}
                          placeholder="City"
                          placeholderTextColor="#9CA3AF"
                          value={pickupForm.city}
                          onChangeText={(t) => setPickupForm((prev) => ({ ...prev, city: t }))}
                        />
                        <TextInput
                          style={[cstyles.pickupInput, { flex: 1 }]}
                          placeholder="Pincode"
                          placeholderTextColor="#9CA3AF"
                          value={pickupForm.pincode}
                          onChangeText={(t) => setPickupForm((prev) => ({ ...prev, pincode: t.replace(/[^0-9]/g, '').slice(0, 6) }))}
                          keyboardType="number-pad"
                          maxLength={6}
                        />
                      </View>
                      <TouchableOpacity
                        style={[cstyles.addPickupBtn, { alignSelf: 'stretch', alignItems: 'center', marginTop: 4 }]}
                        onPress={handleSaveInlinePickup}
                        disabled={pickupSaving}
                      >
                        <Text style={cstyles.addPickupBtnText}>{pickupSaving ? 'Saving...' : 'Save Address'}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={cstyles.pickupManageRow}
                    onPress={() => {
                      setVehicleEntryOnly(false);
                      setActiveSubPage('Your Addresses');
                    }}
                  >
                    <Text style={cstyles.pickupManageText}>Manage all addresses</Text>
                    <Ionicons name="chevron-forward" size={14} color="#1D4ED8" />
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            <Text style={cstyles.sectionHeading}>PAYMENT MODE</Text>
            <View style={cstyles.modeRow}>
              <TouchableOpacity
                style={[cstyles.modeCard, cartPaymentMode === 'pay_now' && cstyles.modeCardActive]}
                onPress={() => setCartPaymentMode('pay_now')}
              >
                <Ionicons name="card-outline" size={22} color={cartPaymentMode === 'pay_now' ? '#1D4ED8' : '#9CA3AF'} />
                <Text style={[cstyles.modeText, cartPaymentMode === 'pay_now' && cstyles.modeTextActive]}>Pay Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cstyles.modeCard, cartPaymentMode === 'pay_later' && cstyles.modeCardActive]}
                onPress={() => setCartPaymentMode('pay_later')}
              >
                <Ionicons name="cash-outline" size={22} color={cartPaymentMode === 'pay_later' ? '#1D4ED8' : '#9CA3AF'} />
                <Text style={[cstyles.modeText, cartPaymentMode === 'pay_later' && cstyles.modeTextActive]}>Pay Later</Text>
              </TouchableOpacity>
            </View>

            <View style={cstyles.sectionCard}>
              <Text style={cstyles.summaryTitle}>Price Summary</Text>
              <View style={cstyles.summaryRow}>
                <Text style={cstyles.summaryLabel}>Service Total</Text>
                <Text style={cstyles.summaryValue}>₹{subtotal.toLocaleString('en-IN')}</Text>
              </View>
              {couponDiscount > 0 ? (
                <View style={cstyles.summaryRow}>
                  <Text style={cstyles.summaryLabel}>Coupon Discount</Text>
                  <Text style={[cstyles.summaryValue, { color: '#16A34A' }]}>- ₹{Math.round(couponDiscount).toLocaleString('en-IN')}</Text>
                </View>
              ) : null}
              {walletUsed > 0 ? (
                <View style={cstyles.summaryRow}>
                  <Text style={cstyles.summaryLabel}>Wallet Used</Text>
                  <Text style={[cstyles.summaryValue, { color: '#16A34A' }]}>- ₹{walletUsed.toLocaleString('en-IN')}</Text>
                </View>
              ) : null}
              <View style={[cstyles.summaryRow, cstyles.summaryFinalRow]}>
                <Text style={cstyles.finalLabel}>Final Amount</Text>
                <Text style={cstyles.finalValue}>₹{Math.round(finalAmount).toLocaleString('en-IN')}</Text>
              </View>
            </View>

            <View style={cstyles.noteWrap}>
              <View style={cstyles.noteRow}>
                <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
                <Text style={cstyles.noteText}>Service time may vary depending on vehicle condition and workshop workload.</Text>
              </View>
              <View style={cstyles.noteRow}>
                <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
                <Text style={cstyles.noteText}>Final cost may change if additional parts or repairs are required after inspection.</Text>
              </View>
            </View>

            <TouchableOpacity style={cstyles.bookNowBtn} onPress={handleProceedToBook} disabled={cartBookingLoading}>
              <Text style={cstyles.bookNowBtnText}>{cartBookingLoading ? 'Booking...' : 'Proceed to Book'}</Text>
            </TouchableOpacity>
          </View>
        );
      case 'Notifications':
        return (
          <View style={styles.subWrapCompact}>
            <View style={nstyles.headerCard}>
              <View style={{ flex: 1 }}>
                <Text style={nstyles.headerTitle}>Notification Preferences</Text>
                <Text style={nstyles.headerSub}>Control where and when we notify you.</Text>
              </View>
              <View style={nstyles.headerIconWrap}>
                <Ionicons name="notifications-outline" size={20} color={COLORS.primary} />
              </View>
            </View>

            <View style={nstyles.listCard}>
              {[
                ['push', 'Push Notifications'],
              ].map(([key, label], idx, arr) => (
                <View key={key} style={[nstyles.switchRow, idx !== arr.length - 1 ? nstyles.switchRowDivider : null]}>
                  <Text style={nstyles.switchLabel}>{label}</Text>
                  <Switch
                    value={(notifState as any)[key]}
                    onValueChange={(val) => setNotifState((prev) => ({ ...prev, [key]: val }))}
                    thumbColor="#FFFFFF"
                    trackColor={{ false: '#D1D5DB', true: '#0EA56B' }}
                  />
                </View>
              ))}
            </View>
          </View>
        );
      case 'Help & Support':
        return (
          <View style={styles.subWrapCompact}>
            <View style={hstyles.topCard}>
              <Text style={hstyles.topTitle}>How can we help you?</Text>
              <View style={hstyles.contactRow}>
                <TouchableOpacity style={hstyles.contactItem} onPress={() => openPhoneCall('+919152307030')}>
                  <View style={hstyles.contactIconWrap}>
                    <Ionicons name="call-outline" size={16} color={COLORS.primary} />
                  </View>
                  <Text style={hstyles.contactLabel}>Call Us</Text>
                  <Text style={hstyles.contactSub}>+91 9152307030</Text>
                </TouchableOpacity>
                <TouchableOpacity style={hstyles.contactItem} onPress={() => openEmail('support@myfng.in')}>
                  <View style={hstyles.contactIconWrap}>
                    <Ionicons name="mail-outline" size={16} color={COLORS.primary} />
                  </View>
                  <Text style={hstyles.contactLabel}>Mail Us</Text>
                  <Text style={hstyles.contactSub}>support@myfng.in</Text>
                </TouchableOpacity>
              </View>

              <Text style={hstyles.faqHeading}>FAQ CATEGORIES</Text>
              <View style={hstyles.faqListWrap}>
                {Object.keys(SUPPORT_FAQ_CATEGORIES).map((category) => {
                  const expanded = selectedFaqCategory === category;
                  return (
                    <View key={category} style={hstyles.faqCategoryBlock}>
                      <TouchableOpacity
                        style={hstyles.faqCategoryRow}
                        onPress={() => setSelectedFaqCategory(expanded ? null : category)}
                      >
                        <Text style={hstyles.faqCategoryText}>{category}</Text>
                        <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={16} color="#9CA3AF" />
                      </TouchableOpacity>
                      {expanded ? (
                        <View style={hstyles.faqQuestionsWrap}>
                          {(SUPPORT_FAQ_CATEGORIES[category] || []).map((faq) => (
                            <TouchableOpacity
                              key={faq.question}
                              style={hstyles.faqQuestionCard}
                              onPress={() => setFaqModal({ question: faq.question, answer: faq.answer })}
                            >
                              <Text style={hstyles.faqQuestionText}>{faq.question}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>

            <Modal
              visible={!!faqModal}
              transparent
              animationType="fade"
              onRequestClose={() => setFaqModal(null)}
            >
              <View style={hstyles.modalOverlay}>
                <View style={hstyles.modalCard}>
                  <View style={hstyles.modalHeader}>
                    <Text style={hstyles.modalTitle}>FAQ Detail</Text>
                    <TouchableOpacity onPress={() => setFaqModal(null)}>
                      <Ionicons name="close" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  <Text style={hstyles.modalLabel}>QUESTION</Text>
                  <Text style={hstyles.modalQuestion}>{faqModal?.question || ''}</Text>
                  <Text style={hstyles.modalLabel}>ANSWER</Text>
                  <Text style={hstyles.modalAnswer}>{faqModal?.answer || ''}</Text>
                  <View style={hstyles.modalActionRow}>
                    <TouchableOpacity style={hstyles.resolveBtn} onPress={() => setFaqModal(null)}>
                      <Text style={hstyles.resolveBtnText}>Resolved</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={hstyles.agentBtn} onPress={() => openEmail('support@myfng.in')}>
                      <Text style={hstyles.agentBtnText}>Talk with Agent</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        );
      case 'Privacy Policy':
        return (
          <View style={styles.subWrapCompact}>
            <View style={pstyles.introCard}>
              <Text style={pstyles.introHeading}>PRIVACY POLICY</Text>
              <Text style={pstyles.introText}>{LEGAL_SECTIONS.privacyIntro}</Text>
            </View>

            {LEGAL_SECTIONS.privacy.map((item) => (
              <View key={item.title} style={pstyles.expandedSection}>
                <Text style={pstyles.expandedTitle}>{item.title.toUpperCase()}</Text>
                <Text style={pstyles.expandedBody}>{item.content}</Text>
              </View>
            ))}
          </View>
        );
      case 'Terms of Use':
        return (
          <View style={styles.subWrapCompact}>
            <View style={pstyles.introCard}>
              <Text style={pstyles.introHeading}>CONTRACTUAL RELATIONSHIP</Text>
              <Text style={pstyles.introText}>{LEGAL_SECTIONS.termsIntro}</Text>
            </View>

            {LEGAL_SECTIONS.terms.map((item: any) => (
              <View key={item.title} style={pstyles.expandedSection}>
                <Text style={pstyles.expandedTitle}>{String(item.title || '').toUpperCase()}</Text>
                <Text style={pstyles.expandedBody}>{item.content}</Text>
              </View>
            ))}
          </View>
        );
      case 'Delete Account': {
        const wBal = isLoggedIn ? Number(walletBalance || 0) : 0;
        const rPts = isLoggedIn ? walletRewardPoints : 0;
        return (
          <View style={styles.subWrapCompact}>
            <View style={dstyles.card}>
              <View style={dstyles.iconCircle}>
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
              </View>
              <Text style={dstyles.title}>Delete Your Account?</Text>
              <Text style={dstyles.desc}>
                Once you delete your account, there is no going back. All your service history, wallet balance, and rewards will be permanently removed.
              </Text>

              <View style={dstyles.bulletList}>
                <View style={dstyles.bulletRow}>
                  <View style={[dstyles.bulletDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={dstyles.bulletText}>Lose all wallet credits (₹{wBal.toLocaleString('en-IN')})</Text>
                </View>
                <View style={dstyles.bulletRow}>
                  <View style={[dstyles.bulletDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={dstyles.bulletText}>Lose all reward points ({rPts})</Text>
                </View>
                <View style={dstyles.bulletRow}>
                  <View style={[dstyles.bulletDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={dstyles.bulletText}>Permanent deletion of service history</Text>
                </View>
              </View>

              {isLoggedIn ? (
                <TouchableOpacity
                  style={dstyles.deleteBtn}
                  activeOpacity={0.8}
                  onPress={() =>
                    Alert.alert(
                      'Delete Account',
                      'This will permanently delete your account and all associated personal data. Service history, wallet balance, and rewards will be lost forever and cannot be recovered. Are you sure?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await apiFetch('/api/customer/auth/delete-account', { method: 'POST' });
                              await clearCustomerSessionToken();
                              try {
                                await supabase.auth.signOut();
                              } catch {
                                // ignore — supabase session may not exist for customer-session users
                              }
                              setIsLoggedIn(false);
                              Alert.alert(
                                'Account Deleted',
                                'Your account has been permanently deleted.',
                                [{ text: 'OK', onPress: () => navigation.navigate('Login' as never) }]
                              );
                            } catch (err: any) {
                              Alert.alert(
                                'Could not delete account',
                                err?.message || 'Please try again later or contact support@myfng.in.'
                              );
                            }
                          },
                        },
                      ]
                    )
                  }
                >
                  <Text style={dstyles.deleteBtnText}>Permanently Delete Account</Text>
                </TouchableOpacity>
              ) : (
                <View style={dstyles.fadedWrap}>
                  <View style={dstyles.fadedOverlay} />
                  <TouchableOpacity
                    style={[dstyles.deleteBtn, { opacity: 0.45 }]}
                    onPress={() => navigation.navigate('Login' as never)}
                  >
                    <Text style={dstyles.deleteBtnText}>Login to Continue</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        );
      }
      default:
        return null;
    }
  };

  const subPageContent = renderSubPage();

  const allMenuItems = [...MAIN_MENU, ...LEGAL_MENU];
  const subPageLabel = useMemo(() => {
    if (!activeSubPage) return 'Settings';
    const found = allMenuItems.find((m) => m.id === activeSubPage);
    return found?.label || activeSubPage;
  }, [activeSubPage]);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !activeSubPage });
  }, [navigation, activeSubPage]);

  const swipeAnim = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return (
          Platform.OS === 'ios' &&
          !!activeSubPageRef.current &&
          gestureState.dx > 10 &&
          gestureState.x0 < 40 &&
          Math.abs(gestureState.dy) < Math.abs(gestureState.dx)
        );
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dx > 0) {
          swipeAnim.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dx > screenWidth * 0.35 || gestureState.vx > 0.5) {
          Animated.timing(swipeAnim, {
            toValue: screenWidth,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setActiveSubPage(null);
            swipeAnim.setValue(0);
          });
        } else {
          Animated.spring(swipeAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(swipeAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconCircle}
          onPress={() => {
            if (activeSubPage) setActiveSubPage(null);
            else navigation.goBack();
          }}
        >
          <Ionicons name="chevron-back" size={18} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{subPageLabel}</Text>
        <View style={styles.iconCircleGhost} />
      </View>
      {activeSubPage ? (
        <Animated.View
          style={{ flex: 1, transform: [{ translateX: swipeAnim }] }}
          {...panResponder.panHandlers}
        >
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {subPageContent}
            <ReferAndFooter hideRefer />
          </ScrollView>
        </Animated.View>
      ) : (
        renderMain()
      )}

      <Modal visible={!!orderDetailModal} transparent animationType="slide" onRequestClose={() => setOrderDetailModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 30 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827' }}>Order Details</Text>
              <TouchableOpacity onPress={() => setOrderDetailModal(null)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {orderDetailModal && (
              <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                {(() => {
                  const o = orderDetailModal.order || {};
                  const inv = orderDetailModal.invoice;
                  const activities = orderDetailModal.activities || [];
                  const extras = orderDetailModal.extra_charges || [];
                  const toTitleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
                  const carModel = [o.vehicle_make, o.vehicle_model].filter(Boolean).map((s: string) => toTitleCase(s)).join(' ');
                  const dt = o.created_at ? new Date(o.created_at) : null;
                  return (
                    <View style={{ gap: 14, paddingBottom: 20 }}>
                      <View style={{ backgroundColor: '#F0F7FF', borderRadius: 12, padding: 14, gap: 6 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B7280' }}>ORDER #{(o.lead_number || o.id || '').toString().toUpperCase()}</Text>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>{carModel || 'Vehicle'}</Text>
                        <Text style={{ fontSize: 13, color: '#374151' }}>{o.service_display || o.service_type || 'Service'}</Text>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#9CA3AF' }}>DATE</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827', marginTop: 2 }}>{dt ? dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#9CA3AF' }}>STATUS</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: o.status === 'COMPLETED' ? '#16A34A' : '#F59E0B', marginTop: 2 }}>{toTitleCase(o.status || 'Pending')}</Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#9CA3AF' }}>WORKSHOP</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827', marginTop: 2 }}>{o.workshop_name || 'MyFNG Partner'}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#9CA3AF' }}>AMOUNT</Text>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827', marginTop: 2 }}>₹{Math.round(Number(o.amount_display || o.estimated_cost || 0)).toLocaleString('en-IN')}</Text>
                        </View>
                      </View>

                      {o.customer_address ? (
                        <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#9CA3AF' }}>PICKUP ADDRESS</Text>
                          <Text style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{o.customer_address}</Text>
                        </View>
                      ) : null}

                      {(orderDetailModal.services || []).length > 0 || (orderDetailModal.addons || []).length > 0 ? (
                        <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, gap: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#9CA3AF' }}>SERVICES & ADDONS</Text>
                          {(o.services || []).map((s: string, i: number) => (
                            <Text key={`s-${i}`} style={{ fontSize: 13, color: '#111827' }}>• {s}</Text>
                          ))}
                          {(o.addons || []).map((a: string, i: number) => (
                            <Text key={`a-${i}`} style={{ fontSize: 13, color: '#6B7280' }}>+ {a}</Text>
                          ))}
                        </View>
                      ) : null}

                      {inv ? (
                        <View style={{ backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, gap: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#9CA3AF' }}>INVOICE</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>#{inv.invoice_number || '-'}</Text>
                          <Text style={{ fontSize: 12, color: '#374151' }}>Amount: ₹{Math.round(Number(inv.final_amount || 0)).toLocaleString('en-IN')}</Text>
                          <Text style={{ fontSize: 12, color: inv.payment_status === 'PAID' ? '#16A34A' : '#F59E0B' }}>Payment: {inv.payment_status || 'Pending'}</Text>
                        </View>
                      ) : null}

                      {extras.length > 0 ? (
                        <View style={{ backgroundColor: '#FFF7ED', borderRadius: 10, padding: 10, gap: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#9CA3AF' }}>EXTRA CHARGES</Text>
                          {extras.map((e: any) => (
                            <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 12, color: '#374151', flex: 1 }}>{e.description}</Text>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#111827' }}>₹{Number(e.amount || 0)}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {activities.length > 0 ? (
                        <View style={{ gap: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#9CA3AF', marginBottom: 4 }}>ACTIVITY TIMELINE</Text>
                          {activities.slice(0, 10).map((act: any) => (
                            <View key={act.id} style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#CBD5E1', marginTop: 5 }} />
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, color: '#374151' }}>{act.description || act.activity_type}</Text>
                                <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{act.created_at ? new Date(act.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })()}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {orderDetailLoading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151' }}>Loading...</Text>
        </View>
      )}

      <Modal visible={showVehiclePicker} transparent animationType="slide" onRequestClose={() => setShowVehiclePicker(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 30 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827' }}>Select Vehicle</Text>
              <TouchableOpacity onPress={() => setShowVehiclePicker(false)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              {allAssociatedVehicles.map((v: any, idx: number) => {
                const plate = String(v?.vehicle_number || '').trim().toUpperCase();
                const key = plate || `vehicle-${idx}`;
                const isActive = key === selectedVehicleKey;
                const name = [v?.make, v?.model].filter(Boolean).map((s: string) => s.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())).join(' ') || 'Vehicle';
                return (
                  <TouchableOpacity
                    key={key}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, marginBottom: 10,
                      borderWidth: 1.5, borderColor: isActive ? COLORS.primary : '#E5E7EB',
                      backgroundColor: isActive ? '#F0F7FF' : '#FFF',
                    }}
                    onPress={() => {
                      setSelectedVehicleKey(key);
                      setShowVehiclePicker(false);
                    }}
                  >
                    <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: '#EAF1FF', alignItems: 'center', justifyContent: 'center' }}>
                      <VehicleImage vehicle={v} style={{ width: 44, height: 44 }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{name}</Text>
                      <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {plate || 'No plate'}{v?.fuel_type ? ` • ${String(v.fuel_type).toUpperCase()}` : ''}
                      </Text>
                    </View>
                    {isActive && <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed', marginTop: 4 }}
                onPress={() => {
                  setShowVehiclePicker(false);
                  setVehicleEntryOnly(true);
                  setActiveSubPage('My Profile');
                }}
              >
                <Ionicons name="add" size={18} color={COLORS.primary} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary }}>Add New Vehicle</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F7FF' },
  header: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  profileCard: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileEditorCard: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#E5E7EB', padding: 14 },
  profileTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editSquare: { width: 42, height: 42, borderRadius: 12, borderWidth: 2, borderColor: '#1F2937', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  profileExpanded: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 12, gap: 8 },
  syncText: { marginTop: 8, fontSize: 11, color: '#6B7280', fontWeight: '600' },
  profileFieldLabel: { fontSize: 12, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 },
  profileInput: { minHeight: 44, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#F3F4F6', paddingHorizontal: 12, color: '#111827', fontSize: 16, fontWeight: '600' },
  profileSaveBtn: { marginTop: 6, minHeight: 46, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  profileSaveText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EAF1FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.primary, fontSize: 14, fontWeight: '900' },
  avatarGuest: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  avatarGuestText: { color: '#6B7280', fontSize: 16, fontWeight: '900' },
  profileName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  profileMeta: { marginTop: 2, fontSize: 11, color: '#6B7280' },
  guestLoginLink: { marginTop: 2, fontSize: 11, fontWeight: '800', color: COLORS.primary },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  iconCircleGhost: { width: 36, height: 36 },
  vehicleCard: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#E5E7EB', padding: 16 },
  cardHeading: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  vehiclePagerContent: { paddingRight: 10 },
  vehicleSwipeCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F8FBFF', paddingHorizontal: 14, paddingVertical: 12, marginRight: 10, gap: 10 },
  vehicleDotsRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  vehicleDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D1D5DB' },
  vehicleDotActive: { width: 16, backgroundColor: COLORS.primary },
  numberPlateBadge: { backgroundColor: '#1F2937', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8, maxWidth: '100%' },
  numberPlateText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  vehicleName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  vehicleTags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  vehicleTag: { backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  vehicleTagText: { fontSize: 9, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  vehicleYear: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  vehicleImage: { width: 130, height: 92, borderRadius: 12, flexShrink: 0 },
  addVehicleBtn: { marginTop: 12, borderRadius: 12, backgroundColor: COLORS.primary, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  addVehicleBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  vehicleImgPlaceholder: { width: 200, height: 140, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  sectionHeading: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  gridCard: { width: (Dimensions.get('window').width - 32 - 8) / 2, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  gridCardText: { fontSize: 12, fontWeight: '700', color: '#111827', flex: 1 },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  socialBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  logoutBtn: { marginTop: 4, borderRadius: 16, backgroundColor: '#991B1B', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  logoutText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  loginBtn: { marginTop: 4, borderRadius: 16, backgroundColor: COLORS.primary, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  loginBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  subWrap: { flex: 1, padding: 16, gap: 10 },
  subWrapCompact: { padding: 16, gap: 12 },
  subTitle: { fontSize: 12, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingHorizontal: 12, fontSize: 13, color: '#111827' },
  datePickerInput: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  datePickerText: { fontSize: 13, color: '#111827' },
  datePickerTextPlaceholder: { color: '#9CA3AF' },
  datePickerWrap: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 6, paddingTop: 6 },
  datePickerDoneBtn: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4 },
  datePickerDoneText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  myProfileHeaderCard: { borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  myProfileHeaderTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  myProfileHeaderSub: { marginTop: 2, fontSize: 11, fontWeight: '600', color: '#6B7280' },
  myProfileFormCard: { borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 12, gap: 8 },
  readOnlyInput: { backgroundColor: '#F8FAFC', color: '#6B7280' },
  formDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  carSearchWrap: { position: 'relative', zIndex: 10 },
  carSearchLoader: { marginTop: 4 },
  carSuggestionBox: { marginTop: 8, borderRadius: 14, backgroundColor: 'transparent', maxHeight: 260, paddingVertical: 4 },
  carSuggestionItem: {
    backgroundColor: '#0046AD',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 8,
    marginHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0046AD',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  carSuggestionTitle: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  carSuggestionMeta: { marginTop: 2, fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  fuelPillRow: { flexDirection: 'row', gap: 8 },
  fuelPill: { borderRadius: 999, borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  fuelPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  fuelPillText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  fuelPillTextActive: { color: '#FFFFFF' },
  carNumberRow: { flexDirection: 'row', gap: 8 },
  carNumberInput: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingHorizontal: 10, fontSize: 15, color: '#111827', fontWeight: '800', textAlign: 'center', width: 64 },
  carNumberInputWide: { width: 86 },
  addressHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  addressAddNewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addressAddNewText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  addressLoginGate: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  addressLoginText: { fontSize: 13, fontWeight: '700', color: COLORS.primary, textDecorationLine: 'underline' },
  addressCard: { borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  addressIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  addressLabel: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 3 },
  addressText: { fontSize: 12, fontWeight: '500', color: '#6B7280', lineHeight: 17 },
  addressEditBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  addressDeleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  addressFormCard: { marginTop: 4, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 14, gap: 8 },
  addressDetectBtn: { borderRadius: 12, minHeight: 44, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  addressDetectBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  addressMiniRow: { flexDirection: 'row', gap: 8 },
  primaryBtn: { marginTop: 6, minHeight: 46, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  rowCard: { borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  rowSub: { marginTop: 2, fontSize: 11, color: '#6B7280' },
  pillBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  pillBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  pillOutlineBtn: { borderRadius: 999, borderWidth: 1, borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  pillOutlineBtnText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' },
  walletCard: { backgroundColor: '#2563EB', borderRadius: 20, padding: 16 },
  walletLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  walletAmount: { marginTop: 6, color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
  orderAmount: { fontSize: 13, fontWeight: '800', color: '#111827' },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  switchRow: { borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 13, fontWeight: '700', color: '#111827' },
  faqCard: { borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 12 },
  faqQ: { fontSize: 12, fontWeight: '800', color: '#111827' },
  faqA: { marginTop: 6, fontSize: 11, color: '#6B7280', lineHeight: 16 },
  deleteBtn: { marginTop: 6, minHeight: 46, borderRadius: 12, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  memHeaderCard: { borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 20, alignItems: 'center', gap: 6 },
  memTrophyCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  memHeaderTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  memHeaderSub: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  memPlanCard: { borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 14, gap: 4 },
  memPlanCardActive: { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' },
  memPlanRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memPlanDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  memPlanDotActive: { borderColor: COLORS.primary },
  memPlanDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  memPlanName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  memPlanPrice: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 1 },
  memRecommendedBadge: { backgroundColor: '#FEF3C7', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4 },
  memRecommendedText: { fontSize: 9, fontWeight: '900', color: '#92400E', letterSpacing: 0.8 },
  memCurrentBadge: { borderRadius: 4, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2 },
  memCurrentText: { fontSize: 9, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 },
  memRadioOuter: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  memRadioOuterActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  memBenefitsCard: { borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 14, gap: 10 },
  memBenefitsHeading: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 },
  memBenefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  memBenefitTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  memBenefitDesc: { fontSize: 11, fontWeight: '500', color: '#6B7280', marginTop: 1 },
  memUpgradeBtn: { borderRadius: 14, backgroundColor: '#1E3A5F', minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  memUpgradeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  primeCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 2, borderColor: COLORS.primary },
  primeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  primeName: { fontSize: 22, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 },
  primeBadge: { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  primeBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  primePriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 },
  primePriceAmount: { fontSize: 30, fontWeight: '800', color: COLORS.primary },
  primePricePeriod: { fontSize: 14, color: '#8A8A8A', fontWeight: '500' },
  primeTagline: { marginTop: 6, fontSize: 12, color: '#0088E8', fontStyle: 'italic', fontWeight: '500' },
  primeActiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#ECFDF5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  primeActiveText: { fontSize: 10, fontWeight: '900', color: '#047857', letterSpacing: 0.5 },
  primeBenefitsCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginTop: 12 },
  primeBenefitsLabel: { fontSize: 11, fontWeight: '700', color: COLORS.primary, letterSpacing: 2, marginBottom: 6 },
  primeBenefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F0F4F8' },
  primeBenefitIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E6F0FB', alignItems: 'center', justifyContent: 'center' },
  primeBenefitTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', lineHeight: 18 },
  primeBenefitSub: { fontSize: 12, color: '#8A8A8A', marginTop: 2, lineHeight: 16 },
  primeAddonCard: { backgroundColor: '#F2F6FC', borderRadius: 14, padding: 14, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#0088E8' },
  primeAddonTitle: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  primeAddonSub: { fontSize: 11, color: '#8A8A8A', marginTop: 1 },
  primeAddonPrice: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  primeFooterNote: { textAlign: 'center', fontSize: 10, color: '#AAAAAA', marginTop: 14, paddingHorizontal: 16 },
  refHeroBanner: { borderRadius: 20, backgroundColor: COLORS.primary, padding: 20, alignItems: 'flex-start', gap: 8 },
  refHeroIcons: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  refHeroIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  refHeroTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', lineHeight: 26 },
  refHeroSub: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.85)', lineHeight: 17, marginTop: 2 },
  refInviteBtn: { marginTop: 8, borderRadius: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 10 },
  refInviteBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  refCodeCard: { borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 16, alignItems: 'center', gap: 8 },
  refCodeLabel: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 },
  refCodeValue: { fontSize: 28, fontWeight: '900', color: '#111827', letterSpacing: 3 },
  refCodeActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  refCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 8 },
  refCopyBtnText: { fontSize: 12, fontWeight: '700', color: '#111827' },
  refShareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8 },
  refShareBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  refSectionCard: { borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 14, gap: 10 },
  refSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refSectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  refRewardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  refRewardEmoji: { fontSize: 22 },
  refRewardBadge: { backgroundColor: '#FEF3C7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, alignSelf: 'flex-start', marginBottom: 2 },
  refRewardBadgeText: { fontSize: 8, fontWeight: '900', color: '#92400E', letterSpacing: 0.5 },
  refRewardValue: { fontSize: 14, fontWeight: '800', color: '#111827' },
  refFriendDesc: { fontSize: 12, fontWeight: '500', color: '#6B7280', lineHeight: 17 },
  refFriendBenefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refFriendBenefitText: { fontSize: 13, fontWeight: '700', color: '#111827' },
  refStepCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: '#EFF6FF', backgroundColor: '#FAFCFF', padding: 12 },
  refStepIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  refStepLabel: { fontSize: 10, fontWeight: '900', color: COLORS.primary, letterSpacing: 0.5 },
  refStepText: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 2 },
  refStatsRow: { flexDirection: 'row', gap: 10 },
  refStatBox: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 14, alignItems: 'center' },
  refStatNum: { fontSize: 28, fontWeight: '900', color: '#111827' },
  refStatLabel: { fontSize: 9, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', marginTop: 4 },
  refHistoryEmpty: { alignItems: 'center', paddingVertical: 8, gap: 4 },
  refHistoryCount: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  refHistoryLogin: { fontSize: 13, fontWeight: '800', color: COLORS.primary, textDecorationLine: 'underline' },
  refHistoryNone: { fontSize: 12, fontWeight: '500', color: '#9CA3AF' },
  refTncHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', paddingHorizontal: 14, paddingVertical: 12 },
  refTncHeaderText: { fontSize: 11, fontWeight: '900', color: '#6B7280', letterSpacing: 0.8 },
  refTncBody: { borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 14, gap: 6, marginTop: -4 },
  refTncItem: { fontSize: 11, fontWeight: '500', color: '#6B7280', lineHeight: 16 },
});

const wstyles = StyleSheet.create({
  balanceCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 14 },
  balanceCardInner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
    backgroundColor: '#1A3C6E',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  balanceLabel: { fontSize: 10, fontWeight: '700', color: '#B0C4DE', letterSpacing: 1 },
  balanceAmount: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },
  walletIconCircle: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  rewardRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D2A52',
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
  },
  rewardPtsWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  rewardPtsLabel: { fontSize: 9, fontWeight: '700', color: '#B0C4DE', letterSpacing: 0.5 },
  rewardPtsValue: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', marginRight: 12 },
  convertBtn: { fontSize: 11, fontWeight: '900', color: '#4FC3F7', letterSpacing: 0.5 },

  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionRowTitle: { fontSize: 15, fontWeight: '700', color: '#1A3C6E' },

  addMoneyInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, marginBottom: 10 },
  rupeePrefix: { fontSize: 16, fontWeight: '600', color: '#999', marginRight: 4 },
  addMoneyInput: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1A1A1A', paddingVertical: 12 },
  quickAmountRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  quickAmountChip: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#F9FAFB' },
  quickAmountText: { fontSize: 13, fontWeight: '600', color: '#1A3C6E' },

  payMethodRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  payMethodChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  payMethodActive: { borderColor: '#1A3C6E', backgroundColor: '#EBF0FA' },
  payMethodText: { fontSize: 12, fontWeight: '600', color: '#999' },
  payMethodTextActive: { fontSize: 12, fontWeight: '700', color: '#1A3C6E' },
  payLabel: { fontSize: 9, fontWeight: '700', color: '#999', letterSpacing: 0.5, textAlign: 'center', marginVertical: 8 },
  proceedBtn: { backgroundColor: '#1A3C6E', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  proceedBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  cashbackRow: { flexDirection: 'row', gap: 12 },
  cashbackBox: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  cashbackIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  cashbackLabel: { fontSize: 8, fontWeight: '700', color: '#999', letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' },
  cashbackAmount: { fontSize: 22, fontWeight: '900', color: '#1A1A1A' },
  cashbackSub: { fontSize: 10, fontWeight: '500', color: '#999', marginTop: 2 },

  conversionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  conversionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  conversionTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  conversionSub: { fontSize: 11, fontWeight: '500', color: '#999' },

  offerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  offerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  offerBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  offerTag: { fontSize: 12, fontWeight: '800', color: '#1A3C6E' },
  offerDesc: { fontSize: 11, fontWeight: '500', color: '#6B7280' },
  offerApply: { fontSize: 12, fontWeight: '900', color: '#1A3C6E' },
  promoRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  promoInput: { flex: 1, fontSize: 13, fontWeight: '500', color: '#1A1A1A', paddingVertical: 8 },

  redeemHeader: { fontSize: 10, fontWeight: '800', color: '#999', letterSpacing: 1, marginBottom: 14 },
  redeemRow: { flexDirection: 'row', gap: 12 },
  redeemOption: { flex: 1, alignItems: 'center', paddingVertical: 16, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, gap: 8 },
  redeemOptionActive: { borderColor: '#1A3C6E', backgroundColor: '#EBF0FA' },
  redeemLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  redeemLabelActive: { fontSize: 12, fontWeight: '700', color: '#1A3C6E' },

  withdrawRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  withdrawTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  withdrawSub: { fontSize: 11, fontWeight: '500', color: '#999' },
  withdrawBtn: { backgroundColor: '#1A3C6E', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  withdrawBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  txHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  txHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  txFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  txFilterChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6' },
  txFilterChipActive: { backgroundColor: '#1A3C6E' },
  txFilterText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  txFilterTextActive: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  txEmpty: { fontSize: 13, fontWeight: '500', color: '#999', textAlign: 'center', paddingVertical: 20 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  txIconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  txDate: { fontSize: 11, fontWeight: '500', color: '#999', marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '800' },
});

const ostyles = StyleSheet.create({
  loginGate: { alignItems: 'center', paddingVertical: 50 },
  lockCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  loginGateTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', marginBottom: 8 },
  loginGateSub: { fontSize: 13, fontWeight: '500', color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  loginNowBtn: { marginTop: 24, backgroundColor: '#1A3C6E', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 60, alignItems: 'center' },
  loginNowBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

  referBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563EB', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14,
  },
  referBannerTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  referBannerSub: { fontSize: 11, fontWeight: '500', color: '#BFDBFE', marginTop: 2 },
  referInviteChip: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  referInviteChipText: { fontSize: 12, fontWeight: '800', color: '#2563EB' },

  filterScroll: { marginBottom: 14 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22, backgroundColor: '#F3F4F6' },
  filterChipActive: { backgroundColor: '#1A3C6E' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  emptyWrap: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#6B7280' },
  emptySub: { fontSize: 12, fontWeight: '500', color: '#9CA3AF', textAlign: 'center' },

  orderCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F1F3',
  },
  orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  orderId: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },

  carModel: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 2 },
  serviceType: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginBottom: 14 },

  detailRow: { flexDirection: 'row', gap: 20, marginBottom: 14 },
  detailCol: { flex: 1 },
  detailLabel: { fontSize: 9, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 4 },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#374151' },

  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  amountValue: { fontSize: 22, fontWeight: '900', color: '#1A1A1A' },
  viewDetailsBtn: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  viewDetailsBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },

  actionRow: { flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  bookAgainBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', paddingVertical: 10, borderWidth: 1.5, borderColor: '#1A3C6E', borderRadius: 10 },
  bookAgainText: { fontSize: 12, fontWeight: '800', color: '#1A3C6E', letterSpacing: 0.3 },
  invoiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', paddingVertical: 10, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10 },
  invoiceText: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 0.3 },
});

const cstyles = StyleSheet.create({
  loginGate: { alignItems: 'center', paddingVertical: 50 },
  lockCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  loginGateTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', marginBottom: 8 },
  loginGateSub: { fontSize: 13, fontWeight: '500', color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  loginNowBtn: { marginTop: 24, backgroundColor: '#1A3C6E', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 60, alignItems: 'center' },
  loginNowBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  referBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563EB', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14,
  },
  referBannerTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  referBannerSub: { fontSize: 11, fontWeight: '500', color: '#BFDBFE', marginTop: 2 },
  referInviteChip: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  referInviteChipText: { fontSize: 12, fontWeight: '800', color: '#2563EB' },

  sectionHeading: { fontSize: 12, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: -2, marginTop: 2 },
  subHeading: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    padding: 14,
  },

  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vehicleIconWrap: { width: 60, height: 42, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  vehicleThumb: { width: 58, height: 40 },
  vehicleName: { fontSize: 14, fontWeight: '800', color: '#111827' },
  vehicleMeta: { marginTop: 2, fontSize: 11, fontWeight: '600', color: '#6B7280' },
  changeChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EFF6FF' },
  changeChipText: { fontSize: 11, fontWeight: '800', color: '#1D4ED8' },

  serviceHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  serviceTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#111827', paddingRight: 8 },
  servicePrice: { fontSize: 20, fontWeight: '900', color: '#1D4ED8' },
  serviceBulletRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  serviceBulletText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  serviceActionRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  removeBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#FEE2E2', minHeight: 36 },
  removeBtnText: { fontSize: 12, fontWeight: '800', color: '#EF4444' },
  editBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', minHeight: 36 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: '#4B5563' },

  resumeWrap: { marginBottom: 12 },
  resumeTitle: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  resumeRow: { gap: 8, paddingRight: 8 },
  resumeCard: { width: 168, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 10 },
  resumeCardActive: { borderColor: '#1D4ED8', backgroundColor: '#EFF6FF' },
  resumeLeadNumber: { fontSize: 10, fontWeight: '800', color: '#6B7280' },
  resumePlanName: { marginTop: 4, fontSize: 12, fontWeight: '800', color: '#111827' },
  resumeLeadMeta: { marginTop: 2, fontSize: 10, fontWeight: '700', color: '#6B7280' },
  couponRow: { flexDirection: 'row', gap: 8 },
  couponInput: { flex: 1, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, fontSize: 13, color: '#111827' },
  applyBtn: { minWidth: 72, borderRadius: 10, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  applyBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  creditRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  creditChip: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  creditTitle: { fontSize: 11, fontWeight: '800', color: '#374151' },
  creditValue: { marginTop: 2, fontSize: 10, fontWeight: '600', color: '#6B7280' },

  modeRow: { flexDirection: 'row', gap: 10 },
  modeCard: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', minHeight: 96, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, gap: 8 },
  modeCardActive: { borderColor: '#1D4ED8', backgroundColor: '#EFF6FF' },
  modeText: { fontSize: 12, fontWeight: '700', color: '#6B7280', textAlign: 'center' },
  modeTextActive: { color: '#1D4ED8' },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateActionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  dateSub: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  changeLink: { fontSize: 12, fontWeight: '800', color: '#1D4ED8' },
  workshopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workshopTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  workshopEmpty: { marginTop: 8, fontSize: 12, color: '#6B7280', fontWeight: '500' },
  workshopList: { marginTop: 10, gap: 8 },
  workshopCard: { borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  workshopCardActive: { borderColor: '#1D4ED8', backgroundColor: '#EFF6FF' },
  workshopName: { fontSize: 13, fontWeight: '800', color: '#111827' },
  workshopAddress: { marginTop: 2, fontSize: 11, fontWeight: '500', color: '#6B7280' },
  pickupAddressList: { gap: 8 },
  pickupAddressCard: { borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#FFFFFF' },
  pickupAddressCardActive: { borderColor: '#1D4ED8', backgroundColor: '#EFF6FF' },
  pickupAddressLabel: { fontSize: 11, fontWeight: '800', color: '#374151', textTransform: 'uppercase' },
  pickupAddressValue: { marginTop: 3, fontSize: 12, fontWeight: '500', color: '#4B5563' },
  pickupEmptyWrap: { alignItems: 'flex-start' },
  addPickupBtn: { marginTop: 10, borderRadius: 10, backgroundColor: '#1D4ED8', paddingHorizontal: 12, paddingVertical: 10 },
  addPickupBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  pickupToggleRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickupToggleText: { fontSize: 12, fontWeight: '800', color: '#1D4ED8' },
  pickupFormWrap: { marginTop: 10, gap: 8 },
  pickupLabelRow: { flexDirection: 'row', gap: 8 },
  pickupLabelPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  pickupLabelPillActive: { borderColor: '#1D4ED8', backgroundColor: '#EFF6FF' },
  pickupLabelPillText: { fontSize: 11, fontWeight: '800', color: '#6B7280' },
  pickupLabelPillTextActive: { color: '#1D4ED8' },
  pickupLocateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 10,
    backgroundColor: '#0EA56B',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pickupLocateBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  pickupInput: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  pickupRow2: { flexDirection: 'row', gap: 8 },
  pickupManageRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  pickupManageText: { fontSize: 12, fontWeight: '800', color: '#1D4ED8' },

  summaryTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryLabel: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  summaryValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  summaryFinalRow: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  finalLabel: { fontSize: 28, fontWeight: '800', color: '#111827' },
  finalValue: { fontSize: 34, fontWeight: '900', color: '#1D4ED8' },

  noteWrap: { gap: 8, paddingHorizontal: 2 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  noteText: { flex: 1, fontSize: 11, fontWeight: '500', color: '#9CA3AF', lineHeight: 18 },

  bookNowBtn: { minHeight: 48, borderRadius: 12, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  bookNowBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5, textTransform: 'uppercase' },
});

const nstyles = StyleSheet.create({
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  headerSub: { marginTop: 2, fontSize: 13, color: '#6B7280', fontWeight: '500', lineHeight: 18 },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  switchRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  switchLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
});

const pstyles = StyleSheet.create({
  introCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  introHeading: { fontSize: 12, fontWeight: '900', color: '#374151', letterSpacing: 1, marginBottom: 10 },
  introText: { fontSize: 13, fontWeight: '500', color: '#6B7280', lineHeight: 20 },
  readMore: { marginTop: 12, fontSize: 13, fontWeight: '800', color: '#1D4ED8' },

  sectionHeading: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1, marginTop: 4, marginBottom: -2 },

  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingVertical: 12,
  },
  listRowDivider: { borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  listTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: '#111827', paddingRight: 8 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
  },
  modalTitle: { fontSize: 15, fontWeight: '900', color: '#111827' },
  modalScroll: { marginBottom: 16 },
  modalBody: { fontSize: 13, fontWeight: '500', color: '#374151', lineHeight: 22 },
  modalBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  expandedSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  expandedTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  expandedBody: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 21,
  },
});

const hstyles = StyleSheet.create({
  topCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  topTitle: { fontSize: 16, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 12 },
  contactRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  contactItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#EEF2F7', backgroundColor: '#FFFFFF' },
  contactIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  contactLabel: { fontSize: 12, fontWeight: '700', color: '#111827' },
  contactSub: { fontSize: 9, fontWeight: '500', color: '#9CA3AF', marginTop: 2 },

  faqHeading: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1, marginBottom: 8 },
  faqListWrap: { gap: 6 },
  faqCategoryBlock: { borderRadius: 12, borderWidth: 1, borderColor: '#EEF2F7', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  faqCategoryRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  faqCategoryText: { fontSize: 13, fontWeight: '800', color: '#1D4ED8' },
  faqQuestionsWrap: { paddingHorizontal: 10, paddingBottom: 10, gap: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  faqQuestionCard: { borderRadius: 10, borderWidth: 1, borderColor: '#EEF2F7', backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 10 },
  faqQuestionText: { fontSize: 12, fontWeight: '600', color: '#374151' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 10, marginBottom: 12 },
  modalTitle: { fontSize: 15, fontWeight: '900', color: '#111827' },
  modalLabel: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1, marginTop: 4 },
  modalQuestion: { fontSize: 14, fontWeight: '800', color: '#1F2937', marginTop: 4 },
  modalAnswer: { fontSize: 12, fontWeight: '500', color: '#6B7280', lineHeight: 18, marginTop: 6 },
  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  resolveBtn: { flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981' },
  resolveBtnText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  agentBtn: { flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D4ED8' },
  agentBtnText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
});

const dstyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    alignItems: 'center',
  },
  iconCircle: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: '900', color: '#EF4444', marginBottom: 10 },
  desc: { fontSize: 13, fontWeight: '500', color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  bulletList: { alignSelf: 'stretch', gap: 10, marginBottom: 20 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bulletDot: { width: 8, height: 8, borderRadius: 4 },
  bulletText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  deleteBtn: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#F87171',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  fadedWrap: { alignSelf: 'stretch', position: 'relative' },
  fadedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 14,
    zIndex: 1,
  },

  profileWrap: { padding: 14, gap: 14, paddingBottom: 28 },
  profileBanner: {
    backgroundColor: '#0046AD',
    borderRadius: 24,
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#0046AD',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  profileBannerGlow: {
    position: 'absolute',
    top: -70,
    right: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#0084FF',
    opacity: 0.45,
  },
  profileBannerGlow2: {
    position: 'absolute',
    bottom: -80,
    left: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#F97316',
    opacity: 0.2,
  },
  profileBannerStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: '#F97316',
  },
  profileBannerBadge: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
  },
  profileBannerBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  stepAccentBar: {
    height: 4,
    width: '100%',
  },
  profileDpWrap: {
    marginBottom: 14,
    position: 'relative',
    width: 82,
    height: 82,
  },
  profileDp: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDpText: { color: '#FFFFFF', fontSize: 32, fontWeight: '900' },
  profileDpEdit: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0084FF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBannerName: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  profileBannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 4 },

  stepContainer: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#EEF2F6',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  stepContainerActive: {
    borderColor: '#0046AD',
    shadowColor: '#0046AD',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  stepHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  stepHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconCircleDone: { backgroundColor: '#10B981' },
  stepHeaderText: { fontSize: 14, fontWeight: '800', color: '#0046AD' },
  stepContent: {
    backgroundColor: '#FAFBFC',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  stepInput: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  stepInputReadonly: { backgroundColor: '#F1F5F9', color: '#64748B' },
  stepDateInput: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepNextBtn: {
    marginTop: 14,
    backgroundColor: '#0046AD',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  stepNextBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  stepRow: { flexDirection: 'row', gap: 12 },

  plateGrid: { flexDirection: 'row', gap: 8 },
  plateBox: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    textTransform: 'uppercase',
  },
  plateBoxWide: { flex: 1.5 },

  odoWrapper: {
    backgroundColor: '#121A29',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
    position: 'relative',
    justifyContent: 'center',
  },
  odoInput: {
    color: '#00F2FF',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 8,
    paddingVertical: 12,
  },
  odoUnit: {
    position: 'absolute',
    right: 14,
    bottom: 10,
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  profileBigSaveBtn: {
    marginTop: 18,
    marginHorizontal: 6,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0046AD',
    overflow: 'hidden',
    shadowColor: '#0046AD',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
  profileBigSaveBtnGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0084FF',
    opacity: 0.45,
  },
  profileBigSaveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
});
