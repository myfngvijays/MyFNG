import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  Linking,
  Platform,
  Pressable,
  Dimensions,
  PixelRatio,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { requireOptionalNativeModule } from 'expo-modules-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getCustomerSessionToken } from '../lib/customerSession';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicPillNav';

type Props = {
  navigation: any;
};

type HomeCarouselBanner = {
  id: string;
  title: string | null;
  image_url: string;
  route_name: string;
  route_params: any;
  display_order: number;
};

function openTel(phoneE164: string) {
  const url = Platform.select({
    ios: `telprompt:${phoneE164}`,
    android: `tel:${phoneE164}`,
    default: `tel:${phoneE164}`,
  });
  if (url) Linking.openURL(url);
}

function openMail(email: string) {
  Linking.openURL(`mailto:${email}`);
}

export default function PublicHomeScreen({ navigation }: Props) {
  const [city, setCity] = useState<string>('Mumbai');
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [aiPreviewPrefill, setAiPreviewPrefill] = useState<string>('');
  const [aiPreviewInput, setAiPreviewInput] = useState<string>('');
  const [isDetectingCity, setIsDetectingCity] = useState(false);
  const [cityDetectError, setCityDetectError] = useState<string | null>(null);
  const [citiesFromDb, setCitiesFromDb] = useState<string[]>([]);
  const [trustStats, setTrustStats] = useState<{
    ratingText: string;
    carsServiced: number | null;
    verifiedWorkshops: number | null;
  }>({ ratingText: '4.8/5', carsServiced: null, verifiedWorkshops: null });
  const [homeCarouselBanners, setHomeCarouselBanners] = useState<HomeCarouselBanner[]>([]);
  const [featuredWorkshops, setFeaturedWorkshops] = useState<
    Array<{ id: string; name: string; city?: string | null; map_link?: string | null; latitude?: number | null; longitude?: number | null }>
  >([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [supportOpen, setSupportOpen] = useState(false);
  const [howItWorksActive, setHowItWorksActive] = useState<number>(2);
  const [heroLayoutWidth, setHeroLayoutWidth] = useState<number | null>(null);
  const heroCarouselRef = useRef<ScrollView>(null);
  const heroIndexRef = useRef(0);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const howCarouselRef = useRef<ScrollView>(null);
  const howIndexRef = useRef(0);
  const howTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const howResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationWatchRef = useRef<{ remove: () => void } | null>(null);
  const lastCityUpdateRef = useRef<{ ts: number; lat: number; lng: number } | null>(null);
  const aiPopupShownThisSessionRef = useRef(false);
  const lastAiAutoShowTsRef = useRef(0);

  const supportPhone = '+919167779696';
  const supportEmail = 'support@myfng.in';
  
  const goToLoginOrDashboard = useCallback(async () => {
    const token = await getCustomerSessionToken();
    if (token) {
      navigation.navigate('Dashboard');
      return;
    }
    navigation.navigate('Login');
  }, [navigation]);

  const AI_POPUP_DISMISSED_TS_KEY = 'myfng_ai_popup_dismissed_ts_v1';

  const goToAIBooking = (prefill?: string) => navigation.navigate('AIBooking', { city, prefill: (prefill || '').trim() });

  const ALLOWED_PUBLIC_ROUTES = useMemo(
    () =>
      new Set([
        'PublicHome',
        'AIBooking',
        'PublicWorkshopLocator',
        'PublicServicePackages',
        'PublicBookServiceNow',
        'Login',
      ]),
    []
  );

  function replacePlaceholdersDeep(value: any): any {
    if (value === '__CITY__') return city;
    if (Array.isArray(value)) return value.map(replacePlaceholdersDeep);
    if (value && typeof value === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(value)) out[k] = replacePlaceholdersDeep(v);
      return out;
    }
    return value;
  }

  const onPressCarouselBanner = (b: HomeCarouselBanner) => {
    try {
      const routeName = String(b.route_name || '');
      if (!ALLOWED_PUBLIC_ROUTES.has(routeName)) {
        Alert.alert('Not supported', 'This banner route is not supported in the app.');
        return;
      }
      const params = replacePlaceholdersDeep(b.route_params || {});
      navigation.navigate(routeName as any, params);
    } catch {
      Alert.alert('Something went wrong', 'Unable to open this banner.');
    }
  };

  const openAiPreview = (prefill?: string) => {
    const next = prefill || '';
    setAiPreviewPrefill(next);
    setAiPreviewInput(next);
    setAiPreviewOpen(true);
  };
  const continueToAIBooking = () => {
    const prefill = (aiPreviewInput || aiPreviewPrefill || '').trim();
    setAiPreviewOpen(false);
    navigation.navigate('AIBooking', { city, prefill });
  };
  const onPressPackages = () => navigation.navigate('PublicServicePackages', { city });
  const onPressLocator = () => navigation.navigate('PublicWorkshopLocator', { city, userLoc });
  const onPressBookServiceNow = () => navigation.navigate('PublicBookServiceNow');

  const formatCount = (n: number | null) => {
    if (n == null) return '—';
    if (n >= 100000) return `${Math.floor(n / 1000)}k+`;
    if (n >= 10000) return `${Math.floor(n / 1000)}k+`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  const trustCards = useMemo(() => {
    return [
      { icon: 'star', title: trustStats.ratingText, subtitle: 'MY FNG\nRATING' },
      {
        icon: 'trophy',
        title: trustStats.carsServiced != null && trustStats.carsServiced >= 10000 ? `${trustStats.carsServiced}+` : '10000+',
        subtitle: 'CARS\nSERVICED',
      },
      {
        icon: 'construct',
        title:
          trustStats.verifiedWorkshops != null && trustStats.verifiedWorkshops >= 100
            ? `${trustStats.verifiedWorkshops}+`
            : '100+',
        subtitle: 'VERIFIED\nWORKSHOPS',
      },
      { icon: 'shield-checkmark', title: 'Warranty', subtitle: 'ON SERVICE &\nPARTS' },
      { icon: 'eye', title: 'Transparency', subtitle: 'LIVE\nUPDATES' },
    ];
  }, [trustStats]);

  const quickActions = useMemo(
    () => [
      { icon: 'calendar', label: 'Periodic Service', prefill: 'I want a periodic service.' },
      { icon: 'snow', label: 'AC Service', prefill: 'AC is not cooling / needs AC service.' },
      { icon: 'build', label: 'Repairs', prefill: 'My car needs repair. I want an estimate.' },
      { icon: 'sparkles', label: 'Detailing', prefill: 'I want car detailing / cleaning.' },
      { icon: 'car-sport', label: 'Roadside Assistance', prefill: 'I need roadside assistance.' },
      { icon: 'pricetag', label: 'Instant Quote', prefill: 'Give me an instant quote.' },
    ],
    []
  );

  const aiStarterChips = useMemo(
    () => [
      { label: 'AC not cooling', prefill: 'AC not cooling' },
      { label: 'Brake noise', prefill: 'Brake noise' },
      { label: 'Battery weak', prefill: 'Battery weak' },
      { label: 'Periodic service', prefill: 'Periodic service' },
    ],
    []
  );

  const howItWorksSteps = useMemo(
    () => [
      { icon: 'chatbubble-ellipses', title: 'Book with AI', sub: '60 seconds booking' },
      { icon: 'car', title: 'Pickup at Home', sub: 'Scheduled pickup' },
      { icon: 'radio', title: 'Track Live', sub: 'Updates in app' },
      { icon: 'checkbox', title: 'QC Approved', sub: 'Verified checks' },
      { icon: 'shield-checkmark', title: 'Delivered + Warranty', sub: 'Peace of mind' },
    ],
    []
  );

  // How-it-works horizontal carousel sizing (H3)
  const howSectionWidth = Math.round(Dimensions.get('window').width - SPACING.sm * 2);
  const howCardGap = 12;

  // Keep height stable (no wrapping): card width should expand based on its own text (no cut).
  // RN doesn't support "fit-content" width, so we approximate per-card widths and snap using offsets.
  const howCardWidths = useMemo(() => {
    const fontScale = PixelRatio.getFontScale();
    const avgCharW = (fontSize: number) => fontSize * 0.62 * fontScale;
    const titleFont = 14;
    const subFont = 11;
    const horizPadding = 12 * 2; // matches styles.howCard paddingHorizontal
    const iconBlock = 40; // styles.howIconWrap width
    const rowGap = 10; // styles.howCard gap
    const safety = 28; // extra buffer so text never truncates
    const minW = Math.max(220, Math.min(260, Math.round(howSectionWidth * 0.62)));

    return howItWorksSteps.map((s) => {
      const titleW = String(s.title || '').length * avgCharW(titleFont);
      const subW = String(s.sub || '').length * avgCharW(subFont);
      const textW = Math.max(titleW, subW);
      return Math.max(minW, Math.ceil(horizPadding + iconBlock + rowGap + textW + safety));
    });
  }, [howItWorksSteps, howSectionWidth]);

  const howSnapOffsets = useMemo(() => {
    let x = 0;
    return howCardWidths.map((w) => {
      const offset = x;
      x += w + howCardGap;
      return offset;
    });
  }, [howCardWidths]);

  const stopHowAutoplay = () => {
    if (howTimerRef.current) {
      clearInterval(howTimerRef.current);
      howTimerRef.current = null;
    }
    if (howResumeTimeoutRef.current) {
      clearTimeout(howResumeTimeoutRef.current);
      howResumeTimeoutRef.current = null;
    }
  };

  const scheduleHowAutoplayResume = () => {
    if (howResumeTimeoutRef.current) clearTimeout(howResumeTimeoutRef.current);
    howResumeTimeoutRef.current = setTimeout(() => {
      startHowAutoplay();
    }, 2000);
  };

  const startHowAutoplay = () => {
    stopHowAutoplay();
    if (howItWorksSteps.length <= 1) return;
    howTimerRef.current = setInterval(() => {
      const nextIdx = (howIndexRef.current + 1) % howItWorksSteps.length;
      howIndexRef.current = nextIdx;
      setHowItWorksActive(nextIdx + 1);
      howCarouselRef.current?.scrollTo({ x: howSnapOffsets[nextIdx] || 0, y: 0, animated: true });
    }, 3800);
  };

  // Keep ref in sync so autoplay doesn't depend on stale state
  useEffect(() => {
    howIndexRef.current = Math.max(0, (howItWorksActive || 1) - 1);
  }, [howItWorksActive]);

  // How-it-works autoplay lifecycle
  useEffect(() => {
    startHowAutoplay();
    return () => stopHowAutoplay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [howSnapOffsets, howItWorksSteps.length]);

  const heroCards = useMemo(
    () => [
      {
        key: 'ai',
        kicker: 'AI BOOKING',
        title: 'Chat & Book with AI',
        desc: 'No forms. Get instant recommendation + booking in minutes.',
        primaryText: 'Start AI Booking',
        primaryIcon: 'chatbubbles',
        onPrimary: () => goToAIBooking(),
        secondaryText: 'View Packages',
        secondaryIcon: 'chevron-forward',
        onSecondary: onPressPackages,
        bg: '#EEF6FF',
        accent: COLORS.primary,
      },
      {
        key: 'rsa',
        kicker: 'ROAD-SIDE ASSISTANCE',
        title: 'Need help right now?',
        desc: 'Jumpstart • Towing • Puncture • Emergency support.',
        primaryText: 'Call Support',
        primaryIcon: 'call',
        onPrimary: () => openTel(supportPhone),
        secondaryText: 'Chat with AI',
        secondaryIcon: 'chevron-forward',
        onSecondary: () => goToAIBooking('I need roadside assistance.'),
        bg: '#FFF7ED',
        accent: COLORS.orange,
      },
      {
        key: 'packages',
        kicker: 'TRANSPARENT PRICING',
        title: 'Book Service Now',
        desc: 'Website-style booking flow: city → car → services → pickup.',
        primaryText: 'Book Service Now',
        primaryIcon: 'pricetag',
        onPrimary: onPressBookServiceNow,
        secondaryText: 'Get AI Recommendation',
        secondaryIcon: 'chevron-forward',
        onSecondary: () => goToAIBooking('Recommend the right package for my car.'),
        bg: '#F5F3FF',
        accent: COLORS.purple,
      },
    ],
    [onPressPackages, supportPhone, onPressBookServiceNow, goToAIBooking]
  );

  // Compute carousel slide width from the actual hero container width (prevents right-side clipping).
  const fallbackOuter = Math.min(Dimensions.get('window').width - SPACING.md * 2, 420);
  const heroInnerWidth =
    heroLayoutWidth != null ? Math.max(0, heroLayoutWidth - SPACING.lg * 2) : fallbackOuter - SPACING.lg * 2;
  const heroPageWidth = Math.max(280, Math.min(420, heroInnerWidth));
  const heroSnap = heroPageWidth + SPACING.sm;

  const stopHeroAutoplay = () => {
    if (heroTimerRef.current) {
      clearInterval(heroTimerRef.current);
      heroTimerRef.current = null;
    }
  };

  const startHeroAutoplay = () => {
    // avoid multiple timers
    stopHeroAutoplay();
    if (heroCards.length <= 1) return;
    heroTimerRef.current = setInterval(() => {
      const next = (heroIndexRef.current + 1) % heroCards.length;
      heroIndexRef.current = next;
      setHeroIndex(next);
      heroCarouselRef.current?.scrollTo({ x: next * heroSnap, y: 0, animated: true });
    }, 4200);
  };

  // Keep ref in sync so autoplay doesn't depend on stale state
  useEffect(() => {
    heroIndexRef.current = heroIndex;
  }, [heroIndex]);

  // Autoplay lifecycle
  useEffect(() => {
    startHeroAutoplay();
    return () => stopHeroAutoplay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroSnap, heroCards.length]);

  const CITY_CACHE_KEY = 'myfng_public_city_v1';
  const CITY_CACHE_TS_KEY = 'myfng_public_city_ts_v1';
  const CITY_CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
  const LOCATION_PROMPTED_KEY = 'myfng_location_prompted_v1';

  function pickCityName(place: any): string | null {
    const candidate =
      place?.city ||
      place?.subregion ||
      place?.district ||
      place?.region ||
      place?.name ||
      null;
    return candidate ? String(candidate) : null;
  }

  async function reverseGeocodeNominatim(lat: number, lon: number): Promise<string | null> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
        {
          headers: {
            // Nominatim requests a UA / Referer. Some environments ignore it; that's OK.
            'User-Agent': 'MyFNG-Mobile/1.0',
          },
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const address = data?.address || {};
      const cityLike =
        address.city ||
        address.town ||
        address.village ||
        address.county ||
        address.state_district ||
        address.municipality ||
        address.suburb ||
        address.state ||
        null;
      return cityLike ? String(cityLike) : null;
    } catch {
      return null;
    }
  }

  function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const s =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  async function resolveCityFromCoords(lat: number, lng: number): Promise<string | null> {
    try {
      const expoLocationNative = requireOptionalNativeModule('ExpoLocation');
      if (!expoLocationNative) return null;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Location = require('expo-location') as typeof import('expo-location');
      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const candidate = pickCityName(place);
      const country = place?.country ? String(place.country).toLowerCase() : '';
      const looksWrong =
        !candidate ||
        candidate.toLowerCase().includes('mountain view') ||
        (country && !country.includes('india'));
      if (!looksWrong) return candidate;
    } catch {
      // ignore and fallback below
    }
    // Fallback: network reverse geocode (more reliable on emulators)
    return await reverseGeocodeNominatim(lat, lng);
  }

  async function updateCityFromCoords(lat: number, lng: number) {
    const candidate = await resolveCityFromCoords(lat, lng);
    if (!candidate) return;
    setCity(candidate);
    AsyncStorage.setItem(CITY_CACHE_KEY, candidate).catch(() => undefined);
    AsyncStorage.setItem(CITY_CACHE_TS_KEY, String(Date.now())).catch(() => undefined);
    setCityDetectError(null);
  }

  async function detectAndSetCity(source: 'auto' | 'manual') {
    try {
      setIsDetectingCity(true);
      setCityDetectError(null);
      // IMPORTANT:
      // In some builds (e.g. older dev client / mismatched native deps), ExpoLocation native module is missing.
      // Any call into `expo-location` will throw "Cannot find native module 'ExpoLocation'".
      // So we *first* check for the native module and only then load/call expo-location.
      const expoLocationNative = requireOptionalNativeModule('ExpoLocation');
      if (!expoLocationNative) {
        setCityDetectError('Location module missing');
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Location = require('expo-location') as typeof import('expo-location');

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCityDetectError('Permission denied');
        if (source === 'manual') {
          Alert.alert(
            'Location permission needed',
            'Please allow location permission to detect your current city.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        } else {
          // Ask once on auto mode (so user understands why it says Detecting…)
          AsyncStorage.getItem(LOCATION_PROMPTED_KEY)
            .then((v) => {
              if (v) return;
              Alert.alert(
                'Enable location',
                'Allow location permission to auto-detect your current city.',
                [
                  { text: 'Not now', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => Linking.openSettings() },
                ]
              );
              AsyncStorage.setItem(LOCATION_PROMPTED_KEY, '1').catch(() => undefined);
            })
            .catch(() => undefined);
        }
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setCityDetectError('GPS/Location OFF');
        if (source === 'manual') {
          Alert.alert(
            'Turn on Location',
            'Please enable device location (GPS) to detect your current city.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        } else {
          AsyncStorage.getItem(LOCATION_PROMPTED_KEY)
            .then((v) => {
              if (v) return;
              Alert.alert(
                'Turn on Location',
                'Device location is off. Turn it on to auto-detect your current city.',
                [
                  { text: 'Not now', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => Linking.openSettings() },
                ]
              );
              AsyncStorage.setItem(LOCATION_PROMPTED_KEY, '1').catch(() => undefined);
            })
            .catch(() => undefined);
        }
        return;
      }

      // Always prefer a fresh GPS fix on launch; last-known is often stale on emulators.
      const pos =
        (await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), source === 'manual' ? 20000 : 15000)),
        ])) || (await Location.getLastKnownPositionAsync());

      if (!pos) {
        setCityDetectError('No GPS fix');
        if (source === 'manual') {
          Alert.alert(
            'Couldn’t get your location',
            'Please turn on Location (GPS) and try again.\n\nIf you are using an emulator, set a mock location (Extended controls → Location).\n\nYou can also select a city manually.'
          );
        }
        return;
      }

      // Keep last known user location for "near me" experiences
      setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      const candidate = await resolveCityFromCoords(pos.coords.latitude, pos.coords.longitude);
      if (candidate) {
        setCity(candidate);
        await AsyncStorage.setItem(CITY_CACHE_KEY, candidate);
        await AsyncStorage.setItem(CITY_CACHE_TS_KEY, String(Date.now()));
        setCityDetectError(null);
      } else if (source === 'manual') {
        // Manual detect requested but city is outside supported list.
        // Keep current city and just return.
        Alert.alert(
          'City not detected',
          'We got your location but could not determine a city name. Please select a city manually.'
        );
      }
    } catch {
      setCityDetectError('Detection failed');
    } finally {
      setIsDetectingCity(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function startRealtimeLocationWatch() {
      try {
        const expoLocationNative = requireOptionalNativeModule('ExpoLocation');
        if (!expoLocationNative) return;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Location = require('expo-location') as typeof import('expo-location');

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) return;

        // Clean up any existing watcher (hot reload safety)
        locationWatchRef.current?.remove?.();
        locationWatchRef.current = null;

        // Seed with last-known location (fast) so "near me" works even before a fresh GPS fix.
        const last = await Location.getLastKnownPositionAsync();
        if (mounted && last?.coords) {
          setUserLoc({ lat: last.coords.latitude, lng: last.coords.longitude });
        }

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 7000,
            distanceInterval: 30,
          },
          (pos) => {
            if (!mounted || !pos?.coords) return;
            const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setUserLoc(next);

            // Debounced city update from live location:
            // only if moved significantly or enough time passed.
            const now = Date.now();
            const prev = lastCityUpdateRef.current;
            const movedKm = prev ? distKm({ lat: prev.lat, lng: prev.lng }, next) : Number.POSITIVE_INFINITY;
            const timeOk = !prev || now - prev.ts > 2 * 60 * 1000;
            if (timeOk && movedKm >= 1.5) {
              lastCityUpdateRef.current = { ts: now, lat: next.lat, lng: next.lng };
              updateCityFromCoords(next.lat, next.lng).catch(() => undefined);
            }
          }
        );
        locationWatchRef.current = sub as any;
      } catch {
        // best-effort only; no UI impact
      }
    }

    startRealtimeLocationWatch();
    return () => {
      mounted = false;
      locationWatchRef.current?.remove?.();
      locationWatchRef.current = null;
    };
  }, []);

  useEffect(() => {
    (async () => {
      // Always auto-detect on app open (best-effort) to reflect the device's current city.
      await detectAndSetCity('auto');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maybeAutoShowAiPopup = useCallback(async () => {
    try {
      // Avoid double-trigger (mount + AppState active, etc.)
      const now = Date.now();
      if (now - lastAiAutoShowTsRef.current < 1200) return;
      lastAiAutoShowTsRef.current = now;

      if (aiPreviewOpen) return;

      // Show on app open/resume (per user request). Keep dismissed timestamp for tracking,
      // but do NOT block showing based on it (was causing "popup not showing" confusion).
      if (aiPopupShownThisSessionRef.current) return;

      await new Promise((r) => setTimeout(r, 650));
      aiPopupShownThisSessionRef.current = true;
      setAiPreviewPrefill('');
      setAiPreviewInput('');
      setAiPreviewOpen(true);
    } catch {
      // ignore
    }
  }, [aiPreviewOpen]);

  // Auto-show AI popup when app opens / resumes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await maybeAutoShowAiPopup();
    })();

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        // reset per-session gate on resume so it appears each time the user re-opens the app
        aiPopupShownThisSessionRef.current = false;
        maybeAutoShowAiPopup();
      }
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [maybeAutoShowAiPopup]);

  useEffect(() => {
    let cancelled = false;

    async function loadPublicData() {
      try {
        setPublicLoading(true);

        // 1) Cities for selector
        const citiesReq = supabase
          .from('cities')
          .select('name,is_active')
          .eq('is_active', true)
          .order('name', { ascending: true });

        // 2) Verified workshop count (trust proof)
        const verifiedCountReq = supabase
          .from('workshops')
          .select('id', { count: 'exact', head: true })
          .eq('is_verified', true);

        // 3) Cars serviced count (best-effort from leads status)
        const servicedReq = supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .in('status', ['COMPLETED', 'QC_APPROVED', 'WORK_COMPLETED', 'DELIVERED']);

        const bannersReq = supabase
          .from('home_carousel_banners')
          .select('id,title,image_url,route_name,route_params,display_order,is_active')
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: false })
          .limit(3);

        const [citiesRes, verifiedRes, servicedRes, bannersRes] = await Promise.all([
          citiesReq,
          verifiedCountReq,
          servicedReq,
          bannersReq,
        ]);

        if (!cancelled) {
          const names =
            (citiesRes.data || [])
              .map((c: any) => (c?.name ? String(c.name) : ''))
              .filter(Boolean) || [];
          setCitiesFromDb(names);

          setTrustStats((prev) => ({
            ...prev,
            verifiedWorkshops: verifiedRes.count ?? prev.verifiedWorkshops,
            carsServiced: servicedRes.count ?? prev.carsServiced,
          }));

          setHomeCarouselBanners(((bannersRes.data as any[]) || []).map((r) => ({
            id: String(r.id),
            title: r.title ? String(r.title) : null,
            image_url: String(r.image_url || ''),
            route_name: String(r.route_name || ''),
            route_params: r.route_params || {},
            display_order: Number(r.display_order || 0),
          })));
        }

        // 4) Featured workshops for selected city (best-effort)
        const { data: wData } = await supabase
          .from('workshops')
          .select('id,name,city,latitude,longitude,map_link,is_verified,audit_score')
          .eq('is_verified', true)
          .ilike('city', `%${city}%`)
          .order('audit_score', { ascending: false })
          .limit(6);

        if (!cancelled) {
          setFeaturedWorkshops(
            (wData as any[] | null)?.map((w) => ({
              id: String(w.id),
              name: String(w.name || ''),
              city: w.city ?? null,
              map_link: w.map_link ?? null,
              latitude: w.latitude ?? null,
              longitude: w.longitude ?? null,
            })) || []
          );
        }
      } catch (e) {
        // Best-effort: keep home usable even if DB call fails
        if (!cancelled) {
          // keep existing UI
        }
      } finally {
        if (!cancelled) setPublicLoading(false);
      }
    }

    loadPublicData();
    return () => {
      cancelled = true;
    };
  }, [city]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <TouchableOpacity
                style={styles.citySelector}
                onPress={() => setCityModalOpen(true)}
                activeOpacity={0.85}
                disabled={isDetectingCity}
              >
                <Ionicons name="location" size={14} color={COLORS.primary} />
                <Text style={styles.citySelectorText}>
                  {isDetectingCity ? 'Detecting…' : city}
                </Text>
                <Ionicons name="chevron-down" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => { void goToLoginOrDashboard(); }}
                accessibilityLabel="Notifications"
              >
                <Ionicons name="notifications-outline" size={20} color={COLORS.primaryDark} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Option E: Premium Carousel Hero (Above the Fold) */}
          <View
            style={styles.heroCard}
            onLayout={(e) => {
              setHeroLayoutWidth(e.nativeEvent.layout.width);
            }}
          >
            <Text style={styles.heroHeadline}>
              Book Your Car Service in Minutes —{' '}
              <Text style={styles.heroHeadlineAccent}>Powered by AI</Text>
            </Text>
            <Text style={styles.heroSub}>
              Free pickup & drop • Transparent pricing • Verified workshops
            </Text>

            <ScrollView
              ref={heroCarouselRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={heroSnap}
              snapToAlignment="start"
              contentContainerStyle={styles.heroCarousel}
              onScrollBeginDrag={() => stopHeroAutoplay()}
              onScrollEndDrag={() => {
                // resume after a short delay so momentum swipe finishes
                setTimeout(() => startHeroAutoplay(), 900);
              }}
              onMomentumScrollEnd={(e) => {
                const x = e.nativeEvent.contentOffset.x;
                const idx = Math.round(x / heroSnap);
                const listLen = homeCarouselBanners.length ? homeCarouselBanners.length : heroCards.length;
                const clamped = Math.max(0, Math.min(listLen - 1, idx));
                setHeroIndex(clamped);
                heroIndexRef.current = clamped;
              }}
            >
              {homeCarouselBanners.length
                ? homeCarouselBanners.map((b, idx) => (
                    <TouchableOpacity
                      key={b.id}
                      style={[
                        styles.heroSlide,
                        { width: heroPageWidth, backgroundColor: '#fff', marginRight: idx === homeCarouselBanners.length - 1 ? 0 : SPACING.sm },
                      ]}
                      activeOpacity={0.92}
                      onPress={() => onPressCarouselBanner(b)}
                    >
                      <Image source={{ uri: b.image_url }} style={styles.heroBannerImg} resizeMode="cover" />
                      <View style={styles.heroBannerOverlay} />
                      {b.title ? <Text style={styles.heroBannerTitle} numberOfLines={2}>{b.title}</Text> : null}
                      <View style={styles.heroBannerCta}>
                        <Text style={styles.heroBannerCtaText}>Open</Text>
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  ))
                : heroCards.map((c, idx) => (
                    <View
                      key={c.key}
                      style={[
                        styles.heroSlide,
                        { width: heroPageWidth, backgroundColor: c.bg, marginRight: idx === heroCards.length - 1 ? 0 : SPACING.sm },
                      ]}
                    >
                      <View style={styles.heroSlideTop}>
                        <View style={[styles.heroKickerPill, { borderColor: `${c.accent}33` }]}>
                          <Text style={[styles.heroKickerText, { color: c.accent }]}>{c.kicker}</Text>
                        </View>
                        <View style={[styles.heroAccentDot, { backgroundColor: c.accent }]} />
                      </View>

                      <Text style={styles.heroSlideTitle}>{c.title}</Text>
                      <Text style={styles.heroSlideDesc}>{c.desc}</Text>

                      <TouchableOpacity
                        style={[styles.heroSlidePrimary, { backgroundColor: c.accent }]}
                        onPress={c.onPrimary}
                        activeOpacity={0.92}
                      >
                        <Ionicons name={c.primaryIcon as any} size={18} color="#fff" />
                        <Text style={styles.heroSlidePrimaryText}>{c.primaryText}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.heroSlideSecondary} onPress={c.onSecondary} activeOpacity={0.9}>
                        <Text style={styles.heroSlideSecondaryText}>{c.secondaryText}</Text>
                        <Ionicons name={c.secondaryIcon as any} size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
            </ScrollView>

            <View style={styles.dotsRow}>
              {(homeCarouselBanners.length ? homeCarouselBanners : heroCards).map((c: any, i: number) => (
                <View key={String(c.id || c.key || i)} style={[styles.dot, i === heroIndex ? styles.dotActive : null]} />
              ))}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.starterScroll}
            >
              {aiStarterChips.map((c) => (
                <TouchableOpacity
                  key={c.label}
                  style={styles.starterChip}
                  onPress={() => goToAIBooking(c.prefill)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.starterChipText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Services */}
          <View style={styles.section}>
            <View style={styles.servicesBox}>
              <Text style={styles.servicesBoxTitle}>Our Services</Text>
              <View style={styles.quickActionsRow}>
                {quickActions.slice(0, 4).map((a) => (
                  <TouchableOpacity
                    key={a.label}
                    style={styles.quickActionTile}
                    activeOpacity={0.9}
                    onPress={() => goToAIBooking(a.prefill)}
                  >
                    <View style={styles.quickActionIconBox}>
                      <Ionicons name={a.icon as any} size={22} color={COLORS.primaryDark} />
                    </View>
                    <Text style={styles.quickActionLabel} numberOfLines={2}>
                      {a.label}
                    </Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  key="__quick_actions_all__"
                  style={styles.quickActionTile}
                  activeOpacity={0.9}
                  onPress={onPressPackages}
                >
                  <View style={[styles.quickActionIconBox, styles.quickActionAllBox]}>
                    <Text style={styles.quickActionAllText}>ALL</Text>
                  </View>
                  <Text style={styles.quickActionLabel} numberOfLines={2}>
                    All services
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Near By Workshop */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.locatorBanner} onPress={onPressLocator} activeOpacity={0.9}>
              <View style={styles.locatorBannerIcon}>
                <Ionicons name="location" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.locatorBannerTitle}>Near By Workshops</Text>
                <Text style={styles.locatorBannerSub} numberOfLines={1}>
                  {publicLoading ? 'Loading verified workshops…' : 'See verified partner workshops near you'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gray[500]} />
            </TouchableOpacity>
          </View>

          {/* How it works */}
          <View style={styles.section}>
            <View style={styles.howItWorksBox}>
              <View style={styles.howItWorksBoxHeader}>
                <Text style={styles.howItWorksBoxTitle}>How It Works</Text>
                <Text style={styles.howStepText}>
                  Step {howItWorksActive}/{howItWorksSteps.length}
                </Text>
              </View>

              <View style={styles.howProgressTrack}>
                <View
                  style={[
                    styles.howProgressFill,
                    { width: `${Math.round((howItWorksActive / howItWorksSteps.length) * 100)}%` },
                  ]}
                />
              </View>

              <ScrollView
                ref={howCarouselRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToOffsets={howSnapOffsets}
                snapToAlignment="start"
                decelerationRate="fast"
                contentContainerStyle={styles.howHScroll}
                onScrollBeginDrag={() => stopHowAutoplay()}
                onScrollEndDrag={() => scheduleHowAutoplayResume()}
                onMomentumScrollEnd={() => scheduleHowAutoplayResume()}
                onScroll={(e) => {
                  const x = e.nativeEvent.contentOffset.x || 0;
                  // Find nearest snap index (small N, so linear is fine and avoids binary-search bugs)
                  let bestIdx = 0;
                  let bestDist = Number.POSITIVE_INFINITY;
                  for (let i = 0; i < howSnapOffsets.length; i += 1) {
                    const d = Math.abs(x - howSnapOffsets[i]);
                    if (d < bestDist) {
                      bestDist = d;
                      bestIdx = i;
                    }
                  }
                  const idx = Math.max(0, Math.min(howItWorksSteps.length - 1, bestIdx));
                  const step = idx + 1;
                  if (step !== howItWorksActive) setHowItWorksActive(step);
                }}
                scrollEventThrottle={16}
              >
                {howItWorksSteps.map((s, idx) => {
                  const n = idx + 1;
                  const active = howItWorksActive === n;
                  return (
                    <Pressable
                      key={s.title}
                      onPress={() => {
                        stopHowAutoplay();
                        howIndexRef.current = n - 1;
                        setHowItWorksActive(n);
                        howCarouselRef.current?.scrollTo({ x: howSnapOffsets[n - 1] || 0, y: 0, animated: true });
                        scheduleHowAutoplayResume();
                      }}
                      style={[
                        styles.howCard,
                        {
                          width: howCardWidths[idx],
                          marginRight: idx === howItWorksSteps.length - 1 ? 0 : howCardGap,
                        },
                        active ? styles.howCardActive : null,
                      ]}
                    >
                      <View style={[styles.howIconWrap, active ? styles.howIconWrapActive : null]}>
                        <Ionicons name={s.icon as any} size={20} color={active ? '#fff' : COLORS.gray[700]} />
                        <View style={[styles.howNumBadge, active ? styles.howNumBadgeActive : null]}>
                          <Text style={[styles.howNumBadgeText, active ? styles.howNumBadgeTextActive : null]}>{n}</Text>
                        </View>
                      </View>
                      <View style={styles.howTextWrap}>
                        <Text style={[styles.howTitle, active ? styles.howTitleActive : null]} numberOfLines={1}>
                          {s.title}
                        </Text>
                        <Text style={[styles.howSub, active ? styles.howSubActive : null]} numberOfLines={1}>
                          {s.sub}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Trust & Proofs */}
          <View style={styles.section}>
            <View style={styles.whyChooseBox}>
              <Text style={styles.whyChooseBoxTitle}>Why MyFNG</Text>
              <View style={styles.quickActionsRow}>
                {trustCards.map((c) => (
                  <View key={c.subtitle} style={styles.quickActionTile}>
                    <View style={styles.quickActionIconBox}>
                      <Ionicons name={c.icon as any} size={22} color={COLORS.primaryDark} />
                    </View>
                    <Text
                      style={styles.trustMetricText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {c.title}
                    </Text>
                    <Text
                      style={styles.trustLabelText}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {c.subtitle}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Transparency */}
          <View style={styles.section}>
            <View style={styles.transparencyCard}>
              <Text style={styles.transparencyTitle}>Complete Transparency, Always</Text>
              {[
                { icon: 'camera', text: 'Photo & video updates during service' },
                { icon: 'document-text', text: 'Clear estimate before approval' },
                { icon: 'cash', text: 'No hidden charges' },
                { icon: 'headset', text: 'Central MY FNG support' },
              ].map((b) => (
                <View key={b.text} style={styles.bulletRow}>
                  <View style={styles.bulletIcon}>
                    <Ionicons name={b.icon as any} size={16} color={COLORS.primary} />
                  </View>
                  <Text style={styles.bulletText}>{b.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Workshop Quality Highlight */}
          <View style={styles.section}>
            <View style={styles.verifiedWorkshopsBox}>
              <Text style={styles.verifiedWorkshopsBoxTitle}>Verified Workshops</Text>
              <Text style={styles.verifiedWorkshopsBoxSub}>
                Every workshop is quality-audited and MY FNG certified.
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {[
                  {
                    name: 'MY FNG Certified Workshop',
                    rating: '4.6',
                    img: 'https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&w=900&q=80',
                  },
                  {
                    name: 'Premium Service Bay',
                    rating: '4.7',
                    img: 'https://images.unsplash.com/photo-1599256872237-5dcc0fbe9668?auto=format&fit=crop&w=900&q=80',
                  },
                  {
                    name: 'Clean Facility',
                    rating: '4.8',
                    img: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=900&q=80',
                  },
                ].map((w) => (
                  <View key={w.img} style={styles.workshopCard}>
                    <Image source={{ uri: w.img }} style={styles.workshopImg} />
                    <View style={styles.workshopMeta}>
                      <Text style={styles.workshopName} numberOfLines={1}>
                        {w.name}
                      </Text>
                      <View style={styles.ratingPill}>
                        <Ionicons name="star" size={14} color="#F59E0B" />
                        <Text style={styles.ratingText}>{w.rating}</Text>
                        <Text style={styles.ratingSub}>Google</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Footer / Contact */}
          <View style={styles.footer}>
            <View style={styles.footerBrand}>
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.footerLogo}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.footerBrandTitle}>MY FNG</Text>
                <Text style={styles.footerBrandSubtitle}>Your Friendly Neighbourhood Garage</Text>
              </View>
            </View>

            <View style={styles.footerActions}>
              <TouchableOpacity style={styles.contactBtn} onPress={() => openTel(supportPhone)}>
                <Ionicons name="call" size={16} color={COLORS.primary} />
                <Text style={styles.contactBtnText}>Call Support</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactBtn} onPress={() => openMail(supportEmail)}>
                <Ionicons name="mail" size={16} color={COLORS.primary} />
                <Text style={styles.contactBtnText}>Email</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.footerFineprint}>
              © {new Date().getFullYear()} MY FNG. All rights reserved.
            </Text>
          </View>
        </ScrollView>

        {/* Bottom Pill Nav (like screenshot) */}
        <PublicPillNav
          activeTab="ai"
          onPressTab={(tab: PublicPillNavTab) => {
            if (tab === 'ai') goToAIBooking();
            if (tab === 'search') onPressLocator();
            if (tab === 'profile') { void goToLoginOrDashboard(); }
            if (tab === 'settings') setSupportOpen(true);
          }}
        />

        {/* AI Preview Popup (2–3 message preview) */}
        <Modal visible={aiPreviewOpen} transparent animationType="fade" onRequestClose={() => setAiPreviewOpen(false)}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              setAiPreviewOpen(false);
              AsyncStorage.setItem(AI_POPUP_DISMISSED_TS_KEY, String(Date.now())).catch(() => undefined);
            }}
          >
            <Pressable style={styles.aiPreviewCard} onPress={() => undefined}>
              <View style={styles.aiPreviewHandle} />
              <View style={styles.aiPreviewBackdrop} />
              <View style={styles.aiPreviewHeader}>
                <View style={styles.aiPreviewTitleRow}>
                  <Ionicons name="sparkles" size={18} color={COLORS.primary} />
                  <Text style={styles.aiPreviewTitle}>AI Booking</Text>
                </View>
                <TouchableOpacity
                  style={styles.aiPreviewClose}
                  onPress={() => {
                    setAiPreviewOpen(false);
                    AsyncStorage.setItem(AI_POPUP_DISMISSED_TS_KEY, String(Date.now())).catch(() => undefined);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={18} color={COLORS.gray[700]} />
                </TouchableOpacity>
              </View>

              <View style={styles.aiPreviewHero}>
                <View style={styles.aiPreviewBot}>
                  <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
                </View>
                <View style={styles.aiPreviewBubbles}>
                  <View style={styles.aiPreviewBubble}>
                    <Text style={styles.aiPreviewBubbleText}>Show me a periodic service for my car</Text>
                  </View>
                  <View style={styles.aiPreviewBubble}>
                    <Text style={styles.aiPreviewBubbleText}>AC not cooling — what should I do?</Text>
                  </View>
                  <View style={styles.aiPreviewBubble}>
                    <Text style={styles.aiPreviewBubbleText}>Which workshop is near me?</Text>
                  </View>
                </View>
              </View>

              <View style={styles.aiPreviewInputWrap}>
                <TextInput
                  value={aiPreviewInput}
                  onChangeText={setAiPreviewInput}
                  placeholder="Ask me anything about your car service…"
                  placeholderTextColor={COLORS.gray[500]}
                  style={styles.aiPreviewInput}
                  returnKeyType="done"
                  onSubmitEditing={continueToAIBooking}
                />
              </View>

              <TouchableOpacity style={styles.aiPreviewContinue} onPress={continueToAIBooking} activeOpacity={0.92}>
                <Text style={styles.aiPreviewContinueText}>Ask</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {/* City Selector Modal */}
        <Modal visible={cityModalOpen} transparent animationType="fade" onRequestClose={() => setCityModalOpen(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setCityModalOpen(false)}>
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <Text style={styles.modalTitle}>Select City</Text>
              <TouchableOpacity
                style={styles.modalRow}
                onPress={async () => {
                  setCityModalOpen(false);
                  await detectAndSetCity('manual');
                }}
              >
                <Text style={styles.modalRowText}>Detect my location</Text>
                <Ionicons
                  name={isDetectingCity ? 'sync' : cityDetectError ? 'alert-circle' : 'locate'}
                  size={18}
                  color={cityDetectError ? COLORS.warning : COLORS.primary}
                />
              </TouchableOpacity>
              {(citiesFromDb.length ? citiesFromDb : (['Mumbai', 'Thane', 'Navi Mumbai'] as const)).map((c) => (
                <TouchableOpacity
                  key={String(c)}
                  style={styles.modalRow}
                  onPress={() => {
                    const next = String(c);
                    setCity(next);
                    AsyncStorage.setItem(CITY_CACHE_KEY, next).catch(() => undefined);
                    AsyncStorage.setItem(CITY_CACHE_TS_KEY, String(Date.now())).catch(() => undefined);
                    setCityModalOpen(false);
                  }}
                >
                  <Text style={styles.modalRowText}>{String(c)}</Text>
                  {city === String(c) ? (
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={18} color={COLORS.gray[400]} />
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.modalLoginBtn}
                onPress={() => {
                  setCityModalOpen(false);
                  void goToLoginOrDashboard();
                }}
              >
                <Text style={styles.modalLoginText}>Partner / Customer Login</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Support / Settings Sheet */}
        <Modal visible={supportOpen} transparent animationType="fade" onRequestClose={() => setSupportOpen(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setSupportOpen(false)}>
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <Text style={styles.modalTitle}>Support</Text>
              <TouchableOpacity style={styles.modalRow} onPress={() => openTel(supportPhone)}>
                <Text style={styles.modalRowText}>Call Support</Text>
                <Ionicons name="call" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalRow} onPress={() => openMail(supportEmail)}>
                <Text style={styles.modalRowText}>Email</Text>
                <Ionicons name="mail" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalLoginBtn}
                onPress={() => {
                  setSupportOpen(false);
                  void goToLoginOrDashboard();
                }}
              >
                <Text style={styles.modalLoginText}>Login</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  screen: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  container: {
    paddingBottom: 96,
    backgroundColor: COLORS.gray[50],
  },
  header: {
    paddingHorizontal: SPACING.sm,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 86,
    height: 26,
  },
  citySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.18)',
  },
  citySelectorText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  heroCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
    shadowColor: '#0B1F44',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  heroHeadline: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.primaryDark,
    lineHeight: 30,
    letterSpacing: -0.1,
  },
  heroHeadlineAccent: {
    color: COLORS.primary,
  },
  heroSub: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.gray[600],
    lineHeight: 16,
  },
  bookNowCta: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bookNowCtaText: {
    color: '#fff',
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
  },
  heroCarousel: {
    marginTop: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  heroSlide: {
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
  },
  heroBannerImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
  },
  heroBannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 88,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroBannerTitle: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 44,
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  heroBannerCta: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,136,232,0.92)',
  },
  heroBannerCtaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  heroSlideTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  heroKickerPill: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  heroKickerText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  heroAccentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroSlideTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  heroSlideDesc: {
    marginTop: 6,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.gray[700],
    lineHeight: 16,
  },
  heroSlidePrimary: {
    marginTop: SPACING.sm,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  heroSlidePrimaryText: {
    color: '#fff',
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
  },
  heroSlideSecondary: {
    marginTop: SPACING.sm,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  heroSlideSecondaryText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  dotsRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(2,61,149,0.18)',
  },
  dotActive: {
    width: 16,
    backgroundColor: COLORS.primary,
  },
  heroPrimaryBtn: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
  },
  heroPrimaryBtnText: {
    color: '#fff',
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
  },
  heroSecondaryBtn: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#F3F8FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.18)',
  },
  heroSecondaryBtnText: {
    color: COLORS.primaryDark,
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
  },
  section: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  sectionHeader: { marginBottom: SPACING.sm },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionHeaderLeft: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  sectionSub: {
    marginTop: 6,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.gray[600],
    lineHeight: 16,
  },
  smallLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#EEF6FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
  },
  smallLinkText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.primary,
  },
  locatorCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  locatorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  locatorBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locatorBannerTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
    letterSpacing: 0.2,
  },
  locatorBannerSub: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.gray[600],
  },
  locatorTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  locatorTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  locatorSub: {
    marginTop: 6,
    color: COLORS.gray[600],
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    lineHeight: 16,
  },
  locatorList: {
    marginTop: SPACING.md,
    gap: 10,
  },
  locatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  locatorDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    opacity: 0.9,
  },
  locatorName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  locatorMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray[600],
  },
  locatorEmpty: {
    marginTop: SPACING.md,
    paddingVertical: 10,
  },
  locatorEmptyText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.gray[600],
  },
  locatorCta: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  locatorCtaText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: FONT_SIZES.sm,
  },
  aiCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    shadowColor: '#0B1F44',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  aiCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  aiChipText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: '#fff',
  },
  aiCardTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  chatPreview: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  bubble: {
    maxWidth: '92%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  bubbleBot: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F8FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
  },
  bubbleText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  starterScroll: {
    paddingTop: SPACING.sm,
    gap: 6,
    paddingRight: SPACING.sm,
  },
  starterChip: {
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#EEF6FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
  },
  starterChipText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  heroLinksRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  microText: {
    flex: 1,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.gray[600],
    lineHeight: 13,
  },
  smallLinkInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
  },
  smallLinkInlineText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.primary,
  },
  aiMicro: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.gray[600],
  },
  aiCta: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
  },
  aiCtaText: {
    color: '#fff',
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.sm,
  },
  servicesBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  servicesBoxTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: 10,
  },
  whyChooseBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  whyChooseBoxTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: 10,
  },
  howItWorksBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  howItWorksBoxHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  howItWorksBoxTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  verifiedWorkshopsBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  verifiedWorkshopsBoxTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  verifiedWorkshopsBoxSub: {
    marginTop: 6,
    marginBottom: 10,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.gray[600],
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickActionTile: {
    flex: 1,
    alignItems: 'center',
  },
  quickActionIconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#EEF6FF',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.gray[800],
    textAlign: 'center',
    lineHeight: 11,
  },
  quickActionAllBox: {
    backgroundColor: '#7C3AED',
    borderColor: 'rgba(124,58,237,0.25)',
  },
  quickActionAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  quickCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  quickIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#EEF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  quickLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.black,
  },
  hScroll: {
    paddingRight: SPACING.sm,
    gap: SPACING.sm,
  },
  trustMetricText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.primaryDark,
    textAlign: 'center',
    lineHeight: 14,
  },
  trustLabelText: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.gray[800],
    textAlign: 'center',
    lineHeight: 11,
  },
  proofCard: {
    width: 120,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  proofIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  proofTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  proofSub: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    color: COLORS.gray[600],
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  howList: {
    marginTop: SPACING.sm,
    gap: 12,
  },
  howHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  howStepText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.gray[600],
  },
  howProgressTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.gray[200],
    overflow: 'hidden',
  },
  howProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  howHScroll: {
    paddingTop: 12,
    paddingRight: 0,
  },
  howCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
  },
  howCardActive: {
    backgroundColor: '#EEF6FF',
    borderColor: 'rgba(0,136,232,0.55)',
    shadowColor: '#0088E8',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
  },
  howRowActive: {
    backgroundColor: '#EEF6FF',
    borderColor: 'rgba(0,136,232,0.55)',
    shadowColor: '#0088E8',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  howIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
  },
  howIconWrapActive: {
    backgroundColor: COLORS.primary,
    borderColor: 'rgba(0,136,232,0.65)',
  },
  howNumBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.gray[100],
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  howNumBadgeActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: 'rgba(17,24,39,0.10)',
  },
  howNumBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.gray[700],
  },
  howNumBadgeTextActive: {
    color: '#fff',
  },
  howTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  howTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.gray[900],
  },
  howTitleActive: {
    color: COLORS.primaryDark,
  },
  howSub: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray[600],
  },
  howSubActive: {
    color: COLORS.primary,
  },
  stepCard: {
    width: 160,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  stepIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  stepCardText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.primaryDark,
    lineHeight: 16,
  },
  transparencyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  transparencyTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: SPACING.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  bulletIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: '#EEF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.gray[700],
    lineHeight: 16,
  },
  workshopCard: {
    width: 200,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    overflow: 'hidden',
  },
  workshopImg: {
    width: '100%',
    height: 104,
    backgroundColor: COLORS.gray[200],
  },
  workshopMeta: {
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  workshopName: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  ratingText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: '#92400e',
  },
  ratingSub: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    color: '#92400e',
  },
  footer: {
    marginTop: SPACING.xl,
    marginHorizontal: SPACING.md,
    padding: SPACING.lg,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  footerLogo: {
    width: 60,
    height: 22,
    tintColor: '#fff',
  },
  footerBrandTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '900',
    color: '#fff',
  },
  footerBrandSubtitle: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.82)',
  },
  footerActions: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  contactBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  footerFineprint: {
    marginTop: SPACING.md,
    textAlign: 'center',
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
  },
  // bottom nav is handled by `PublicPillNav`
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    padding: SPACING.md,
  },
  aiPreviewCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    overflow: 'hidden',
  },
  aiPreviewHandle: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(17,24,39,0.18)',
    zIndex: 3,
  },
  aiPreviewBackdrop: {
    position: 'absolute',
    left: -40,
    right: -40,
    top: -60,
    height: 260,
    borderBottomLeftRadius: 220,
    borderBottomRightRadius: 220,
    backgroundColor: '#FCE7F3',
    opacity: 1,
  },
  aiPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    zIndex: 4,
  },
  aiPreviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiPreviewTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  aiPreviewClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiPreviewBody: {
    gap: SPACING.sm,
  },
  aiPreviewHero: {
    marginTop: 6,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    zIndex: 4,
  },
  aiPreviewBot: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  aiPreviewBubbles: {
    gap: 10,
  },
  aiPreviewBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
  },
  aiPreviewBubbleText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  aiPreviewInputWrap: {
    marginTop: SPACING.md,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 4,
  },
  aiPreviewInput: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  aiPreviewContinue: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    zIndex: 4,
  },
  aiPreviewContinueText: {
    color: '#fff',
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: SPACING.md,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.06)',
  },
  modalRowText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    color: COLORS.black,
  },
  modalLoginBtn: {
    marginTop: SPACING.md,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F3F8FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.18)',
    alignItems: 'center',
  },
  modalLoginText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
});


