import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
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
import { clearCustomerSessionToken, getCustomerSessionToken } from '../lib/customerSession';
import { supabase } from '../lib/supabase';
import {
  ADD_ON_SERVICES,
  LEGAL_SECTIONS,
  MEMBERSHIP_PLANS,
  SUPPORT_FAQ_CATEGORIES,
} from '../constants/publicAppData';
import { COLORS } from '../constants/theme';
import ReferAndFooter from '../components/ReferAndFooter';
import { apiFetch } from '../lib/api';
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
  { id: 'wallet', label: 'Your Wallet', icon: 'wallet' },
  { id: 'refer', label: 'Refer & Earn', icon: 'gift' },
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

export default function SettingsScreen({ navigation, route }: Props) {
  const [activeSubPage, setActiveSubPage] = useState<string | null>(route?.params?.initialSubPage ?? route?.params?.subPage ?? null);
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
  const [selectedVehicleKey, setSelectedVehicleKey] = useState<string | null>(null);
  const [carSearch, setCarSearch] = useState('');
  const [carSuggestions, setCarSuggestions] = useState<any[]>([]);
  const [carSearchLoading, setCarSearchLoading] = useState(false);
  const [selectedCar, setSelectedCar] = useState<any | null>(null);
  const [regDate, setRegDate] = useState('');
  const [fuelType, setFuelType] = useState<'Petrol' | 'Diesel' | 'CNG' | ''>('');
  const [carNumberParts, setCarNumberParts] = useState<string[]>(['', '', '', '']);
  const [carSearchFocused, setCarSearchFocused] = useState(false);
  const carNumberRefs = useRef<Array<TextInput | null>>([]);

  const [addresses, setAddresses] = useState<Array<{ id: string; label: string; value: string }>>([]);
  const [showAddAddress, setShowAddAddress] = useState(false);
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
  const [showReferTnC, setShowReferTnC] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [walletRewardPoints, setWalletRewardPoints] = useState(0);
  const [walletEarnedCashback, setWalletEarnedCashback] = useState(0);
  const [walletReferralRewards, setWalletReferralRewards] = useState(0);
  const [walletAddAmount, setWalletAddAmount] = useState('');
  const [walletTxFilter, setWalletTxFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [walletPromoCode, setWalletPromoCode] = useState('');
  const [orderFilter, setOrderFilter] = useState<'All' | 'Completed' | 'Upcoming' | 'Ongoing' | 'Cancelled'>('All');
  const [coupon, setCoupon] = useState('');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [cartServiceMode, setCartServiceMode] = useState<'pickup' | 'workshop'>('pickup');
  const [cartPaymentMode, setCartPaymentMode] = useState<'pay_now' | 'pay_later'>('pay_now');
  const [cartDate, setCartDate] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [cartCouponResult, setCartCouponResult] = useState<any>(null);
  const [cartCouponLoading, setCartCouponLoading] = useState(false);
  const [cartSelectedService, setCartSelectedService] = useState<{ name: string; price: number; items: string[] } | null>(null);
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
  const [privacyModal, setPrivacyModal] = useState<{ title: string; content: string } | null>(null);
  const [faqModal, setFaqModal] = useState<{ question: string; answer: string } | null>(null);

  const supportFaqs = useMemo(() => {
    if (!selectedFaqCategory) return [];
    return SUPPORT_FAQ_CATEGORIES[selectedFaqCategory] || [];
  }, [selectedFaqCategory]);

  const toggleAddOn = (id: string) => {
    setSelectedAddOns((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toTitleCase = useCallback((value: string) => {
    return String(value || '')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }, []);

  const serviceKeywords = useMemo(() => {
    const source = String(cartSelectedService?.name || '').toLowerCase();
    if (source.includes('periodic')) return ['periodic', 'general', 'premium', 'platinum'];
    if (source.includes('ac')) return ['ac', 'periodic'];
    return ['periodic', 'general'];
  }, [cartSelectedService]);

  const recommendedAddOns = useMemo(() => {
    return ADD_ON_SERVICES.filter((item: any) =>
      Array.isArray(item.recommended_for)
        ? item.recommended_for.some((k: string) => serviceKeywords.includes(k))
        : true
    );
  }, [serviceKeywords]);

  const cartServiceBase = useMemo(() => Number(cartSelectedService?.price || 0), [cartSelectedService]);
  const addOnTotal = useMemo(
    () =>
      selectedAddOns.reduce((sum, id) => {
        const found: any = ADD_ON_SERVICES.find((x: any) => x.id === id);
        return sum + Number(found?.price || 0);
      }, 0),
    [selectedAddOns]
  );
  const subtotal = useMemo(() => cartServiceBase + addOnTotal, [cartServiceBase, addOnTotal]);
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

  const applyCartCoupon = useCallback(async () => {
    const code = String(coupon || '').trim().toUpperCase();
    if (!code) {
      Alert.alert('Coupon', 'Please enter coupon code.');
      return;
    }
    setCartCouponLoading(true);
    try {
      const payload = {
        code,
        lead_context: {
          subtotal,
          customer_phone: profileForm.phone || null,
          custom_labels: selectedAddOns,
          service_items: [
            ...(cartSelectedService
              ? [{ label: cartSelectedService.name, price: cartSelectedService.price }]
              : []),
            ...selectedAddOns.map((id) => {
              const found: any = ADD_ON_SERVICES.find((x: any) => x.id === id);
              return { label: found?.name || id, price: Number(found?.price || 0) };
            }),
          ],
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
  }, [coupon, subtotal, profileForm.phone, selectedAddOns, cartSelectedService]);

  const hydrateCustomerData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [profileRes, vehiclesRes, ordersRes, walletRes, referralRes, leadsRes] = await Promise.all([
        apiFetch<any>('/api/customer/profile'),
        apiFetch<any>('/api/customer/vehicles'),
        apiFetch<any>('/api/customer/orders'),
        apiFetch<any>('/api/customer/wallet'),
        apiFetch<any>('/api/customer/referral'),
        apiFetch<any>('/api/customer/leads'),
      ]);

      const customer = profileRes?.customer || {};
      setCustomerId(customer?.id ? String(customer.id) : null);
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
            label: String(lead?.lead_number || 'Recent Service Address'),
            value: fullAddress,
          };
        })
        .filter(Boolean) as Array<{ id: string; label: string; value: string }>;

      const mergedAddresses = mappedAddresses.length > 0
        ? mappedAddresses
        : mappedLeadAddresses;
      setAddresses(mergedAddresses);
      setVehicles(Array.isArray(vehiclesRes?.vehicles) ? vehiclesRes.vehicles : []);
      setOrders(Array.isArray(ordersRes?.orders) ? ordersRes.orders : []);
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
    if (sp) setActiveSubPage(sp);
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

    (orders || []).forEach((o: any) => {
      const plate = String(o?.vehicle_number || '').trim().toUpperCase();
      const make = String(o?.vehicle_make || '').trim();
      const model = String(o?.vehicle_model || '').trim();
      const key = plate || `${make}-${model}`.trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          vehicle_number: plate || null,
          make: make || null,
          model: model || null,
          fuel_type: o?.fuel_type || null,
          year: o?.year || null,
        });
      }
    });

    (vehicles || []).forEach((v: any) => {
      const plate = String(v?.vehicle_number || '').trim().toUpperCase();
      const make = String(v?.make || '').trim();
      const model = String(v?.model || '').trim();
      const key = plate || `${make}-${model}`.trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          vehicle_number: plate || null,
          make: make || null,
          model: model || null,
          fuel_type: v?.fuel_type || null,
          year: v?.year || null,
        });
      }
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

  const selectedVehicleImageUri = useMemo(() => {
    const make = String(selectedVehicle?.make || '').trim().toLowerCase();
    const modelFamily = String(selectedVehicle?.model || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    if (!make || !modelFamily) {
      return 'https://cdn.imagin.studio/getimage?customer=img&make=tata&modelFamily=tigor&angle=23&width=400';
    }
    return `https://cdn.imagin.studio/getimage?customer=img&make=${encodeURIComponent(make)}&modelFamily=${encodeURIComponent(modelFamily)}&angle=23&width=400`;
  }, [selectedVehicle]);

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
    if (vehicleYear && !regDate) {
      setRegDate(vehicleYear);
    }

    const rawVehicleNumber = String(selectedVehicle?.vehicle_number || '').toUpperCase();
    if (!rawVehicleNumber) return;
    const compact = rawVehicleNumber.replace(/[^A-Z0-9]/g, '');
    const matched = compact.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,2})(\d{1,4})$/);
    if (matched) {
      setCarNumberParts([matched[1], matched[2], matched[3], matched[4]]);
      return;
    }
    setCarNumberParts([compact.slice(0, 2), compact.slice(2, 4), compact.slice(4, 6), compact.slice(6, 10)]);
  }, [activeSubPage, selectedVehicle, regDate]);

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
    const latestOrder = orders[0];
    const serviceName = String(latestOrder?.service_display || latestOrder?.service_type || 'Periodic Service Package').trim();
    const servicePriceRaw = Number(latestOrder?.amount_display || 2999);
    const servicePrice = Number.isFinite(servicePriceRaw) && servicePriceRaw > 0 ? Math.round(servicePriceRaw) : 2999;
    const defaultChecklist = serviceName.toLowerCase().includes('periodic')
      ? ['Engine Oil Change', 'Oil Filter Replacement', 'General Inspection']
      : ['Service Checklist', 'Basic Diagnostics', 'General Inspection'];
    setCartSelectedService({
      name: serviceName,
      price: servicePrice,
      items: defaultChecklist,
    });
  }, [activeSubPage, orders]);

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

  const handleMembershipUpgrade = async () => {
    if (!isLoggedIn) {
      setActiveSubPage('My Profile');
      return;
    }
    const plan = membershipPlans[selectedMembershipIdx];
    if (!plan?.raw?.id) {
      Alert.alert('Membership', 'Plan details not available. Please try again.');
      return;
    }
    if (currentMembership?.plan_id === plan.raw.id) {
      Alert.alert('Already subscribed', `You are already on ${plan.name}.`);
      return;
    }
    try {
      await apiFetch('/api/customer/membership/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: plan.raw.id }),
      });
      Alert.alert('Success', `You are now a ${plan.name} member!`);
      const memRes = await apiFetch<any>('/api/customer/membership').catch(() => null);
      if (memRes?.membership) setCurrentMembership(memRes.membership);
    } catch (err: any) {
      Alert.alert('Upgrade failed', err?.message || 'Unable to upgrade membership.');
    }
  };

  const handleCarPartChange = (index: number, value: string) => {
    const maxLengths = [2, 2, 2, 4];
    const isAlphaPart = index === 0 || index === 2;
    const sanitized = isAlphaPart
      ? value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, maxLengths[index])
      : value.replace(/\D/g, '').slice(0, maxLengths[index]);

    setCarNumberParts((prev) => {
      const next = [...prev];
      next[index] = sanitized;
      return next;
    });

    if (sanitized.length === maxLengths[index] && index < 3) {
      carNumberRefs.current[index + 1]?.focus();
    }
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

    try {
      await apiFetch('/api/customer/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_number: vehicleNumber,
          make,
          model,
          year,
          fuel_type: fuelType || undefined,
          is_default: true,
        }),
      });
      await hydrateCustomerData();
      Alert.alert('Saved', 'Profile and car details have been updated.');
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Unable to save car details');
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
    };
  };

  const handleFetchCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow location access to auto-fill your address.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const latitude = Number(current?.coords?.latitude);
      const longitude = Number(current?.coords?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Unable to read your location coordinates.');
      }
      setGeoPoint({ latitude, longitude });

      const reverseAddress = await fetchReverseAddress(latitude, longitude);
      const parsed = parseReverseAddress(reverseAddress.address, reverseAddress.shortLabel);
      setNewAddrArea(parsed.area);
      setNewAddrCity(parsed.city);
      setNewAddrState(parsed.state);
      setNewAddrPincode(parsed.pincode);
    } catch (err: any) {
      Alert.alert('Location unavailable', err?.message || 'Could not fetch your current location.');
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

      try {
        await apiFetch('/api/customer/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(addressPayload),
        });
      } catch (_apiErr: any) {
        if (!customerId) throw _apiErr;
        const { error: sbErr } = await supabase
          .from('customer_addresses')
          .insert({ customer_id: customerId, ...addressPayload });
        if (sbErr) throw new Error(sbErr.message);
      }

      await hydrateCustomerData();
      setShowAddAddress(false);
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
    { icon: 'logo-instagram' as const, url: 'http://instagram.com/myfngcarservices', color: '#E4405F' },
    { icon: 'logo-youtube' as const, url: 'https://www.youtube.com/@myfng_car_servicing', color: '#FF0000' },
    { icon: 'logo-linkedin' as const, url: 'https://www.linkedin.com/company/myfngcarservices', color: '#0A66C2' },
    { icon: 'logo-twitter' as const, url: 'https://x.com/myfngcarservice', color: '#1DA1F2' },
  ];

  const renderMain = () => (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
        <View style={styles.vehicleRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.numberPlateBadge}>
              <Text style={styles.numberPlateText}>
                {selectedVehicle?.vehicle_number ? String(selectedVehicle.vehicle_number).toUpperCase() : 'NO VEHICLE'}
              </Text>
            </View>
            <Text style={styles.vehicleName}>
              {[selectedVehicle?.make, selectedVehicle?.model].filter(Boolean).join(' ') || 'Add your first vehicle'}
            </Text>
            <View style={styles.vehicleTags}>
              <View style={styles.vehicleTag}>
                <Text style={styles.vehicleTagText}>{String(selectedVehicle?.fuel_type || 'N/A').toUpperCase()}</Text>
              </View>
              <Text style={styles.vehicleYear}>{selectedVehicle?.year ? String(selectedVehicle.year) : '-'}</Text>
            </View>
          </View>
          <Image
            source={{ uri: selectedVehicleImageUri }}
            style={styles.vehicleImage}
            resizeMode="contain"
          />
        </View>
        {allAssociatedVehicles.length > 1 ? (
          <View style={styles.vehicleListWrap}>
            <Text style={styles.vehicleListTitle}>All Vehicles ({allAssociatedVehicles.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehicleListRow}>
              {allAssociatedVehicles.map((v, idx) => {
                const label = String(v?.vehicle_number || '').trim().toUpperCase() || `Vehicle ${idx + 1}`;
                const model = [v?.make, v?.model].filter(Boolean).join(' ') || 'Model not available';
                const key = label || `vehicle-${idx}`;
                const isActive = key === selectedVehicleKey;
                return (
                  <TouchableOpacity
                    key={`${label}-${idx}`}
                    style={[styles.vehicleMiniCard, isActive ? styles.vehicleMiniCardActive : null]}
                    onPress={() => setSelectedVehicleKey(key)}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.vehicleMiniPlate}>{label}</Text>
                    <Text style={styles.vehicleMiniModel} numberOfLines={1}>{model}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <View style={styles.grid}>
        {MAIN_MENU.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.gridCard}
            onPress={() => setActiveSubPage(item.label)}
          >
            <Ionicons name={item.icon} size={18} color={COLORS.primary} />
            <Text style={styles.gridCardText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionHeading}>Legal & Support</Text>
      <View style={styles.grid}>
        {LEGAL_MENU.map((item) => (
          <TouchableOpacity key={item.id} style={styles.gridCard} onPress={() => setActiveSubPage(item.label)}>
            <Ionicons name={item.icon} size={18} color={item.id === 'delete' ? '#DC2626' : COLORS.primary} />
            <Text style={[styles.gridCardText, item.id === 'delete' ? { color: '#DC2626' } : null]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionHeading}>Connect With Us</Text>
      <View style={styles.socialRow}>
        {SOCIAL_LINKS.map((s) => (
          <TouchableOpacity key={s.url} style={[styles.socialBtn, { borderColor: s.color }]} onPress={() => Linking.openURL(s.url)}>
            <Ionicons name={s.icon} size={20} color={s.color} />
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

      <ReferAndFooter />
    </ScrollView>
  );

  const renderSubPage = () => {
    switch (activeSubPage) {
      case 'My Profile':
        return (
          <View style={styles.subWrap}>
            <View style={styles.myProfileHeaderCard}>
              <View style={[styles.avatar, !isLoggedIn ? styles.avatarGuest : null]}>
                <Text style={[styles.avatarText, !isLoggedIn ? styles.avatarGuestText : null]}>
                  {(profileForm.name || 'Guest').trim().charAt(0).toUpperCase() || 'G'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.myProfileHeaderTitle}>{isLoggedIn ? (profileForm.name || 'MyFNG User') : 'Guest Login'}</Text>
                <Text style={styles.myProfileHeaderSub}>
                  {isLoggedIn
                    ? (profileForm.phone ? `+91 ${profileForm.phone}` : 'Complete profile details below')
                    : 'Register now to unlock all features'}
                </Text>
              </View>
            </View>

            <View style={styles.myProfileFormCard}>
              <Text style={styles.subTitle}>FULL NAME</Text>
              <TextInput
                style={styles.input}
                value={profileForm.name}
                onChangeText={(text) => setProfileForm((prev) => ({ ...prev, name: text }))}
                placeholder="Enter your full name"
              />

              <Text style={styles.subTitle}>MOBILE NUMBER</Text>
              <TextInput
                style={[styles.input, styles.readOnlyInput]}
                value={profileForm.phone ? `+91 ${profileForm.phone}` : ''}
                placeholder="Mobile number"
                editable={false}
              />

              <Text style={styles.subTitle}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                value={profileForm.email}
                onChangeText={(text) => setProfileForm((prev) => ({ ...prev, email: text }))}
                placeholder="Enter email address"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.formDivider} />
              <Text style={styles.subTitle}>CAR DETAILS</Text>

              <Text style={styles.subTitle}>CAR MODEL</Text>
              <View style={styles.carSearchWrap}>
                <TextInput
                  style={styles.input}
                  value={carSearch}
                  onChangeText={(text) => {
                    setCarSearch(text);
                    setSelectedCar(null);
                  }}
                  onFocus={() => setCarSearchFocused(true)}
                  onBlur={() => setTimeout(() => setCarSearchFocused(false), 120)}
                  placeholder="Search Brand/Model (e.g. Swift)"
                />
                {carSearchLoading ? (
                  <View style={styles.carSearchLoader}>
                    <Text style={styles.rowSub}>Searching...</Text>
                  </View>
                ) : null}
                {carSearchFocused && carSuggestions.length > 0 ? (
                  <View style={styles.carSuggestionBox}>
                    <FlatList
                      data={carSuggestions.slice(0, 8)}
                      keyExtractor={(item, idx) => String(item?.id || `${item?.make}-${item?.model || item?.model_name}-${idx}`)}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item }) => {
                        const itemMake = String(item?.make || '').trim();
                        const itemModel = String(item?.model_name || item?.model || '').trim();
                        return (
                          <TouchableOpacity
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
                      }}
                    />
                  </View>
                ) : null}
              </View>

              <Text style={styles.subTitle}>REGISTRATION DATE OF CAR</Text>
              <TextInput
                style={styles.input}
                value={regDate}
                onChangeText={setRegDate}
                placeholder="dd-mm-yyyy"
              />

              <Text style={styles.subTitle}>FUEL TYPE</Text>
              <View style={styles.fuelPillRow}>
                {(['Petrol', 'Diesel', 'CNG'] as const).map((fuel) => {
                  const active = fuelType === fuel;
                  return (
                    <TouchableOpacity
                      key={fuel}
                      style={[styles.fuelPill, active ? styles.fuelPillActive : null]}
                      onPress={() => setFuelType(fuel)}
                    >
                      <Text style={[styles.fuelPillText, active ? styles.fuelPillTextActive : null]}>{fuel}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.subTitle}>CAR NUMBER</Text>
              <View style={styles.carNumberRow}>
                {[0, 1, 2, 3].map((idx) => (
                  <TextInput
                    key={String(idx)}
                    ref={(input) => {
                      carNumberRefs.current[idx] = input;
                    }}
                    style={[styles.carNumberInput, idx === 3 ? styles.carNumberInputWide : null]}
                    value={carNumberParts[idx]}
                    onChangeText={(text) => handleCarPartChange(idx, text)}
                    maxLength={idx === 3 ? 4 : 2}
                    autoCapitalize="characters"
                    keyboardType={idx === 0 || idx === 2 ? 'default' : 'number-pad'}
                    placeholder={idx === 0 ? 'MH' : idx === 1 ? '01' : idx === 2 ? 'BJ' : '7842'}
                  />
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleRegisterSave}>
              <Text style={styles.primaryBtnText}>{isLoggedIn ? 'Save Changes' : 'Register Now'}</Text>
            </TouchableOpacity>
          </View>
        );
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
                      if (!next) resetAddressForm();
                      return next;
                    });
                  }}
                >
                  <Ionicons name="add-circle-outline" size={14} color={COLORS.primary} />
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
                {addresses.length === 0 ? (
                  <Text style={styles.rowSub}>No saved addresses found.</Text>
                ) : addresses.map((a) => (
                  <View key={a.id} style={styles.addressCard}>
                    <View style={styles.addressIconWrap}>
                      <Ionicons name="location" size={16} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addressLabel}>{a.label}</Text>
                      <Text style={styles.addressText}>{a.value}</Text>
                    </View>
                    {!String(a.id).startsWith('lead-') ? (
                      <TouchableOpacity style={styles.addressDeleteBtn} onPress={() => handleDeleteAddress(a.id)}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}

                {showAddAddress ? (
                  <View style={styles.addressFormCard}>
                    <TouchableOpacity style={styles.addressDetectBtn} onPress={handleFetchCurrentLocation}>
                      <Ionicons name="locate-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.addressDetectBtnText}>
                        {locationLoading ? 'Fetching location...' : 'Fetch Current Location'}
                      </Text>
                    </TouchableOpacity>

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

                    <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveAddress}>
                      <Text style={styles.primaryBtnText}>{saveAddressLoading ? 'Saving...' : 'Save Address'}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            )}
          </View>
        );
      case 'Membership':
        return (
          <View style={styles.subWrap}>
            <View style={styles.memHeaderCard}>
              <View style={styles.memTrophyCircle}>
                <Ionicons name="trophy" size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.memHeaderTitle}>MyFNG Membership</Text>
              <Text style={styles.memHeaderSub}>Unlock exclusive benefits and savings</Text>
            </View>

            {(membershipPlans.length > 0 ? membershipPlans : MEMBERSHIP_PLANS.map((p, i) => ({ id: String(i), name: p.name, price: p.price, color: p.color, code: i === 0 ? 'BRONZE' : i === 1 ? 'SILVER' : 'GOLD', raw: null }))).map((plan: any, idx: number) => {
              const isSelected = selectedMembershipIdx === idx;
              const isCurrent = Boolean(currentMembership && currentMembership.plan_id === plan.id);
              const isRecommended = idx === 1;
              return (
                <TouchableOpacity
                  key={plan.id || plan.name}
                  style={[styles.memPlanCard, isSelected ? styles.memPlanCardActive : null]}
                  onPress={() => setSelectedMembershipIdx(idx)}
                  activeOpacity={0.85}
                >
                  {isRecommended ? (
                    <View style={styles.memRecommendedBadge}>
                      <Text style={styles.memRecommendedText}>RECOMMENDED</Text>
                    </View>
                  ) : null}
                  <View style={styles.memPlanRow}>
                    <View style={[styles.memPlanDot, isSelected ? styles.memPlanDotActive : null]}>
                      {isSelected ? <View style={styles.memPlanDotInner} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memPlanName}>{plan.name}</Text>
                      <Text style={styles.memPlanPrice}>{plan.price} / Year</Text>
                    </View>
                    {isCurrent ? (
                      <View style={styles.memCurrentBadge}>
                        <Text style={styles.memCurrentText}>CURRENT</Text>
                      </View>
                    ) : null}
                    <View style={[styles.memRadioOuter, isSelected ? styles.memRadioOuterActive : null]}>
                      {isSelected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {selectedPlanBenefits.length > 0 ? (
              <View style={styles.memBenefitsCard}>
                <Text style={styles.memBenefitsHeading}>
                  Benefits for {membershipPlans[selectedMembershipIdx]?.name || 'MyFNG Go'}
                </Text>
                {selectedPlanBenefits.map((b: any, idx: number) => (
                  <View key={b.id || idx} style={styles.memBenefitRow}>
                    <Ionicons name={(b.icon || 'checkmark-circle-outline') as any} size={18} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memBenefitTitle}>{b.title}</Text>
                      <Text style={styles.memBenefitDesc}>{b.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <TouchableOpacity style={styles.memUpgradeBtn} onPress={handleMembershipUpgrade}>
              <Text style={styles.memUpgradeBtnText}>
                {isLoggedIn ? 'Upgrade Now  →' : 'Upgrade Now  →'}
              </Text>
            </TouchableOpacity>
          </View>
        );
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
              <View style={{ height: 40 }} />
              <TouchableOpacity
                style={ostyles.referBanner}
                onPress={() => { setActiveSubPage('Refer & Earn'); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={ostyles.referBannerTitle}>Refer & Earn ₹500</Text>
                  <Text style={ostyles.referBannerSub}>Invite friends & get discount</Text>
                </View>
                <View style={ostyles.referInviteChip}>
                  <Text style={ostyles.referInviteChipText}>Invite Now</Text>
                </View>
              </TouchableOpacity>
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
                    <Text style={ostyles.serviceType}>{order.service_display || order.service_type || 'Service'}</Text>

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
                      <TouchableOpacity style={ostyles.viewDetailsBtn}>
                        <Text style={ostyles.viewDetailsBtnText}>View Details</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={ostyles.actionRow}>
                      <TouchableOpacity style={ostyles.bookAgainBtn}>
                        <Ionicons name="refresh" size={14} color="#1A3C6E" />
                        <Text style={ostyles.bookAgainText}>BOOK AGAIN</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={ostyles.invoiceBtn}>
                        <Ionicons name="document-text-outline" size={14} color="#6B7280" />
                        <Text style={ostyles.invoiceText}>INVOICE</Text>
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
              <View style={{ height: 40 }} />
              <TouchableOpacity
                style={cstyles.referBanner}
                onPress={() => { setActiveSubPage('Refer & Earn'); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={cstyles.referBannerTitle}>Refer & Earn ₹500</Text>
                  <Text style={cstyles.referBannerSub}>Invite friends & get discount</Text>
                </View>
                <View style={cstyles.referInviteChip}>
                  <Text style={cstyles.referInviteChipText}>Invite Now</Text>
                </View>
              </TouchableOpacity>
            </View>
          );
        }

        return (
          <View style={styles.subWrap}>
            <View style={cstyles.sectionCard}>
              <View style={cstyles.vehicleRow}>
                <View style={cstyles.vehicleIconWrap}>
                  <Ionicons name="car-sport" size={18} color="#1D4ED8" />
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
                <TouchableOpacity style={cstyles.changeChip} onPress={() => setActiveSubPage('My Profile')}>
                  <Text style={cstyles.changeChipText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={cstyles.sectionHeading}>SELECTED SERVICES</Text>
            <View style={cstyles.sectionCard}>
              <View style={cstyles.serviceHeaderRow}>
                <Text style={cstyles.serviceTitle}>{cartSelectedService?.name || 'Periodic Service Package'}</Text>
                <Text style={cstyles.servicePrice}>₹{Math.round(Number(cartSelectedService?.price || 2999)).toLocaleString('en-IN')}</Text>
              </View>
              {(cartSelectedService?.items || []).map((item) => (
                <View key={item} style={cstyles.serviceBulletRow}>
                  <Ionicons name="checkmark" size={14} color="#22C55E" />
                  <Text style={cstyles.serviceBulletText}>{item}</Text>
                </View>
              ))}
              <View style={cstyles.serviceActionRow}>
                <TouchableOpacity
                  style={cstyles.removeBtn}
                  onPress={() => setCartSelectedService((prev) => (prev ? { ...prev, items: [] } : prev))}
                >
                  <Text style={cstyles.removeBtnText}>Remove</Text>
                </TouchableOpacity>
                <TouchableOpacity style={cstyles.editBtn} onPress={() => navigation.navigate('PublicServicePackages' as never)}>
                  <Text style={cstyles.editBtnText}>Edit Service</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={cstyles.sectionHeading}>ADD-ON SERVICES</Text>
            <View style={cstyles.addOnGrid}>
              {recommendedAddOns.map((item: any) => {
                const selected = selectedAddOns.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[cstyles.addOnCard, selected && cstyles.addOnCardActive]}
                    onPress={() => toggleAddOn(item.id)}
                  >
                    <View style={cstyles.addOnIconWrap}>
                      <Ionicons name={(item.icon as any) || 'construct'} size={16} color="#374151" />
                    </View>
                    <Text style={cstyles.addOnName}>{item.name}</Text>
                    <Text style={cstyles.addOnPrice}>₹{Number(item.price || 0).toLocaleString('en-IN')}</Text>
                    <View style={cstyles.addOnActionRow}>
                      <Ionicons
                        name={selected ? 'checkmark-circle' : 'add-circle-outline'}
                        size={14}
                        color={selected ? '#1D4ED8' : '#9CA3AF'}
                      />
                      <Text style={[cstyles.addOnActionText, selected && cstyles.addOnActionTextActive]}>
                        {selected ? 'ADDED' : 'ADD'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={cstyles.sectionCard}>
              <Text style={cstyles.subHeading}>APPLY COUPON</Text>
              <View style={cstyles.couponRow}>
                <TextInput
                  style={cstyles.couponInput}
                  placeholder="Enter Code (e.g. SAVE200)"
                  placeholderTextColor="#9CA3AF"
                  value={coupon}
                  onChangeText={setCoupon}
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={cstyles.applyBtn} onPress={applyCartCoupon} disabled={cartCouponLoading}>
                  <Text style={cstyles.applyBtnText}>{cartCouponLoading ? '...' : 'Apply'}</Text>
                </TouchableOpacity>
              </View>

              <View style={cstyles.creditRow}>
                <View style={cstyles.creditChip}>
                  <Ionicons name="wallet-outline" size={14} color="#6B7280" />
                  <View>
                    <Text style={cstyles.creditTitle}>Wallet</Text>
                    <Text style={cstyles.creditValue}>Balance: ₹{Number(walletBalance || 0).toLocaleString('en-IN')}</Text>
                  </View>
                </View>
                <View style={cstyles.creditChip}>
                  <Ionicons name="gift-outline" size={14} color="#6B7280" />
                  <View>
                    <Text style={cstyles.creditTitle}>Referral</Text>
                    <Text style={cstyles.creditValue}>Points: {walletReferralRewards.toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={cstyles.sectionHeading}>SERVICE MODE</Text>
            <View style={cstyles.modeRow}>
              <TouchableOpacity
                style={[cstyles.modeCard, cartServiceMode === 'pickup' && cstyles.modeCardActive]}
                onPress={() => setCartServiceMode('pickup')}
              >
                <Ionicons name="car-sport-outline" size={22} color={cartServiceMode === 'pickup' ? '#1D4ED8' : '#9CA3AF'} />
                <Text style={[cstyles.modeText, cartServiceMode === 'pickup' && cstyles.modeTextActive]}>Doorstep Pickup & Drop</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cstyles.modeCard, cartServiceMode === 'workshop' && cstyles.modeCardActive]}
                onPress={() => setCartServiceMode('workshop')}
              >
                <Ionicons name="location-outline" size={22} color={cartServiceMode === 'workshop' ? '#1D4ED8' : '#9CA3AF'} />
                <Text style={[cstyles.modeText, cartServiceMode === 'workshop' && cstyles.modeTextActive]}>Visit Workshop</Text>
              </TouchableOpacity>
            </View>

            <View style={cstyles.sectionCard}>
              <View style={cstyles.dateRow}>
                <Ionicons name="calendar-outline" size={20} color="#9CA3AF" />
                <View style={{ flex: 1 }}>
                  <Text style={cstyles.dateValue}>{formattedCartDate}</Text>
                  <Text style={cstyles.dateSub}>10:00 AM</Text>
                </View>
                <TouchableOpacity onPress={() => setCartDate((prev) => new Date(prev.getTime() + 24 * 60 * 60 * 1000))}>
                  <Text style={cstyles.changeLink}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>

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

            <TouchableOpacity style={cstyles.bookNowBtn}>
              <Text style={cstyles.bookNowBtnText}>Proceed to Book</Text>
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
                ['sms', 'SMS Alerts'],
                ['email', 'Email Alerts'],
                ['order', 'Order Updates'],
                ['promos', 'Offers & Promos'],
                ['wallet', 'Wallet Credits'],
                ['referral', 'Referral Updates'],
                ['support', 'Support Updates'],
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
                <TouchableOpacity style={hstyles.contactItem} onPress={() => Linking.openURL('tel:+919152307030')}>
                  <View style={hstyles.contactIconWrap}>
                    <Ionicons name="call-outline" size={16} color={COLORS.primary} />
                  </View>
                  <Text style={hstyles.contactLabel}>Call Us</Text>
                  <Text style={hstyles.contactSub}>+91 9152307030</Text>
                </TouchableOpacity>
                <TouchableOpacity style={hstyles.contactItem} onPress={() => Linking.openURL('mailto:support@myfng.in')}>
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
                    <TouchableOpacity style={hstyles.agentBtn} onPress={() => Linking.openURL('mailto:support@myfng.in')}>
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
            {/* Intro card */}
            <View style={pstyles.introCard}>
              <Text style={pstyles.introHeading}>PRIVACY POLICY</Text>
              <Text style={pstyles.introText}>{LEGAL_SECTIONS.privacyIntro}</Text>
              <TouchableOpacity
                onPress={() =>
                  setPrivacyModal({
                    title: 'PRIVACY POLICY',
                    content: LEGAL_SECTIONS.privacyFull,
                  })
                }
              >
                <Text style={pstyles.readMore}>Read More  {'>'}</Text>
              </TouchableOpacity>
            </View>

            {/* Section list */}
            <Text style={pstyles.sectionHeading}>PRIVACY SECTIONS</Text>
            <View style={pstyles.listCard}>
              {LEGAL_SECTIONS.privacy.map((item, idx) => (
                <TouchableOpacity
                  key={item.title}
                  style={[pstyles.listRow, idx !== LEGAL_SECTIONS.privacy.length - 1 ? pstyles.listRowDivider : null]}
                  onPress={() => setPrivacyModal(item)}
                >
                  <Text style={pstyles.listTitle}>{item.title.toUpperCase()}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>

            {/* Modal popup */}
            <Modal
              visible={!!privacyModal}
              transparent
              animationType="slide"
              onRequestClose={() => setPrivacyModal(null)}
            >
              <View style={pstyles.modalOverlay}>
                <View style={pstyles.modalCard}>
                  <View style={pstyles.modalHeader}>
                    <Text style={pstyles.modalTitle}>{privacyModal?.title || ''}</Text>
                    <TouchableOpacity onPress={() => setPrivacyModal(null)}>
                      <Ionicons name="close" size={22} color="#374151" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={pstyles.modalScroll} showsVerticalScrollIndicator={false}>
                    <Text style={pstyles.modalBody}>{privacyModal?.content || ''}</Text>
                  </ScrollView>
                  <TouchableOpacity style={pstyles.modalBtn} onPress={() => setPrivacyModal(null)}>
                    <Text style={pstyles.modalBtnText}>I Understand</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>
        );
      case 'Terms of Use':
        return (
          <View style={styles.subWrapCompact}>
            <View style={pstyles.introCard}>
              <Text style={pstyles.introHeading}>CONTRACTUAL RELATIONSHIP</Text>
              <Text style={pstyles.introText}>{LEGAL_SECTIONS.termsIntro}</Text>
              <TouchableOpacity
                onPress={() =>
                  setPrivacyModal({
                    title: 'TERMS OF USE',
                    content: LEGAL_SECTIONS.termsFull,
                  })
                }
              >
                <Text style={pstyles.readMore}>Read More  {'>'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={pstyles.sectionHeading}>TERMS & POLICIES</Text>
            <View style={pstyles.listCard}>
              {LEGAL_SECTIONS.terms.map((item: any, idx: number) => (
                <TouchableOpacity
                  key={item.title}
                  style={[pstyles.listRow, idx !== LEGAL_SECTIONS.terms.length - 1 ? pstyles.listRowDivider : null]}
                  onPress={() => setPrivacyModal(item)}
                >
                  <Text style={pstyles.listTitle}>{String(item.title || '').toUpperCase()}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>

            <Modal
              visible={!!privacyModal}
              transparent
              animationType="slide"
              onRequestClose={() => setPrivacyModal(null)}
            >
              <View style={pstyles.modalOverlay}>
                <View style={pstyles.modalCard}>
                  <View style={pstyles.modalHeader}>
                    <Text style={pstyles.modalTitle}>{privacyModal?.title || ''}</Text>
                    <TouchableOpacity onPress={() => setPrivacyModal(null)}>
                      <Ionicons name="close" size={22} color="#374151" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={pstyles.modalScroll} showsVerticalScrollIndicator={false}>
                    <Text style={pstyles.modalBody}>{privacyModal?.content || ''}</Text>
                  </ScrollView>
                  <TouchableOpacity style={pstyles.modalBtn} onPress={() => setPrivacyModal(null)}>
                    <Text style={pstyles.modalBtnText}>I Understand</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
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
                      'This will permanently delete your account and all associated data. Are you sure?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => navigation.navigate('Login' as never) },
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
        <Text style={styles.headerTitle}>{activeSubPage || 'Settings'}</Text>
        <View style={styles.iconCircleGhost} />
      </View>
      {activeSubPage ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {subPageContent}
          <ReferAndFooter hideRefer={activeSubPage === 'Refer & Earn'} />
        </ScrollView>
      ) : (
        renderMain()
      )}
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
  vehicleRow: { flexDirection: 'row', alignItems: 'center' },
  numberPlateBadge: { backgroundColor: '#1F2937', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  numberPlateText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  vehicleName: { fontSize: 18, fontWeight: '800', color: '#111827' },
  vehicleTags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  vehicleTag: { backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  vehicleTagText: { fontSize: 9, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  vehicleYear: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  vehicleImage: { width: 130, height: 90, borderRadius: 12 },
  vehicleListWrap: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 10 },
  vehicleListTitle: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 },
  vehicleListRow: { paddingTop: 8, gap: 8, paddingRight: 8 },
  vehicleMiniCard: { minWidth: 148, maxWidth: 188, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 8 },
  vehicleMiniCardActive: { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' },
  vehicleMiniPlate: { fontSize: 10, fontWeight: '800', color: '#111827', textTransform: 'uppercase' },
  vehicleMiniModel: { marginTop: 4, fontSize: 11, fontWeight: '700', color: '#6B7280' },
  vehicleImgPlaceholder: { width: 130, height: 90, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  sectionHeading: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridCard: { width: '48.8%', backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  gridCardText: { fontSize: 12, fontWeight: '700', color: '#111827', flex: 1 },
  socialRow: { flexDirection: 'row', justifyContent: 'space-between' },
  socialBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  logoutBtn: { marginTop: 4, borderRadius: 16, backgroundColor: '#991B1B', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  logoutText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  loginBtn: { marginTop: 4, borderRadius: 16, backgroundColor: COLORS.primary, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  loginBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  subWrap: { flex: 1, padding: 16, gap: 10 },
  subWrapCompact: { padding: 16, gap: 12 },
  subTitle: { fontSize: 12, fontWeight: '900', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingHorizontal: 12, fontSize: 13, color: '#111827' },
  myProfileHeaderCard: { borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  myProfileHeaderTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  myProfileHeaderSub: { marginTop: 2, fontSize: 11, fontWeight: '600', color: '#6B7280' },
  myProfileFormCard: { borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 12, gap: 8 },
  readOnlyInput: { backgroundColor: '#F8FAFC', color: '#6B7280' },
  formDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  carSearchWrap: { position: 'relative', zIndex: 10 },
  carSearchLoader: { marginTop: 4 },
  carSuggestionBox: { marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: '#DBEAFE', backgroundColor: '#FFFFFF', maxHeight: 220, overflow: 'hidden' },
  carSuggestionItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EFF6FF' },
  carSuggestionTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  carSuggestionMeta: { marginTop: 2, fontSize: 11, color: '#6B7280' },
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
  vehicleIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  vehicleName: { fontSize: 18, fontWeight: '800', color: '#111827' },
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

  addOnGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  addOnCard: {
    width: '48.2%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
  },
  addOnCardActive: { borderColor: '#1D4ED8', backgroundColor: '#EFF6FF' },
  addOnIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  addOnName: { minHeight: 36, fontSize: 13, fontWeight: '800', color: '#1F2937' },
  addOnPrice: { marginTop: 2, fontSize: 16, fontWeight: '900', color: '#1D4ED8' },
  addOnActionRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addOnActionText: { fontSize: 11, fontWeight: '700', color: '#9CA3AF' },
  addOnActionTextActive: { color: '#1D4ED8' },

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
  dateValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  dateSub: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  changeLink: { fontSize: 12, fontWeight: '800', color: '#1D4ED8' },

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
});
