import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { requireOptionalNativeModule } from 'expo-modules-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicPillNav';

type Props = {
  navigation: any;
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
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [isDetectingCity, setIsDetectingCity] = useState(false);
  const [cityDetectError, setCityDetectError] = useState<string | null>(null);
  const [citiesFromDb, setCitiesFromDb] = useState<string[]>([]);
  const [trustStats, setTrustStats] = useState<{
    ratingText: string;
    carsServiced: number | null;
    verifiedWorkshops: number | null;
  }>({ ratingText: '4.8/5', carsServiced: null, verifiedWorkshops: null });
  const [featuredWorkshops, setFeaturedWorkshops] = useState<
    Array<{ id: string; name: string; city?: string | null; map_link?: string | null; latitude?: number | null; longitude?: number | null }>
  >([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [supportOpen, setSupportOpen] = useState(false);
  const [heroLayoutWidth, setHeroLayoutWidth] = useState<number | null>(null);
  const heroCarouselRef = useRef<ScrollView>(null);
  const heroIndexRef = useRef(0);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const supportPhone = '+919167779696';
  const supportEmail = 'support@myfng.in';

  const onPressAIBooking = (prefill?: string) =>
    navigation.navigate('AIBooking', { city, prefill: prefill || '' });
  const onPressPackages = () => navigation.navigate('PublicServicePackages', { city });
  const onPressLocator = () => navigation.navigate('PublicWorkshopLocator', { city });
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
      { icon: 'star', title: trustStats.ratingText, subtitle: 'MY FNG rating' },
      { icon: 'trophy', title: formatCount(trustStats.carsServiced), subtitle: 'cars serviced' },
      { icon: 'construct', title: formatCount(trustStats.verifiedWorkshops), subtitle: 'verified workshops' },
      { icon: 'shield-checkmark', title: 'Warranty', subtitle: 'on service & parts' },
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

  const heroCards = useMemo(
    () => [
      {
        key: 'ai',
        kicker: 'AI BOOKING',
        title: 'Chat & Book with AI',
        desc: 'No forms. Get instant recommendation + booking in minutes.',
        primaryText: 'Start AI Booking',
        primaryIcon: 'chatbubbles',
        onPrimary: () => onPressAIBooking(),
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
        onSecondary: () => onPressAIBooking('I need roadside assistance.'),
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
        onSecondary: () => onPressAIBooking('Recommend the right package for my car.'),
        bg: '#F5F3FF',
        accent: COLORS.purple,
      },
    ],
    [onPressPackages, supportPhone]
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

      // Emulator often has a stale last-known location (e.g. Mountain View) even after you set a new mock.
      // Rules:
      // - Manual detection: always force a fresh current GPS fix.
      // - Auto detection: use last-known only if it's recent; otherwise fetch current.
      const last =
        source === 'manual'
          ? null
          : await Location.getLastKnownPositionAsync({
              // only accept last-known that is <= 2 minutes old
              maxAge: 2 * 60 * 1000,
            });

      const pos =
        last ||
        (await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
        ]));

      if (!pos) {
        setCityDetectError('No GPS fix');
        if (source === 'manual') {
          Alert.alert(
            'Couldn’t get your location',
            'Please turn on Location (GPS) and try again.\n\nYou can also select a city manually.'
          );
        }
        return;
      }

      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });

      let candidate = pickCityName(place);

      // Emulator sometimes returns stale "Mountain View" even after setting mock location.
      // If we see that, fallback to network reverse geocode (Nominatim) using the coordinates.
      const looksWrong =
        !candidate ||
        candidate.toLowerCase().includes('mountain view') ||
        (place?.country && String(place.country).toLowerCase() !== 'india');
      if (looksWrong) {
        const nom = await reverseGeocodeNominatim(pos.coords.latitude, pos.coords.longitude);
        if (nom) {
          candidate = nom;
        }
      }

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
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(CITY_CACHE_KEY);
        const tsRaw = await AsyncStorage.getItem(CITY_CACHE_TS_KEY);
        const ts = tsRaw ? Number(tsRaw) : 0;
        if (cached && Date.now() - ts < CITY_CACHE_MAX_AGE_MS) {
          // Use cached city immediately for snappy UI, but still attempt a background refresh.
          setCity(cached);
        }
      } catch {
        // ignore cache issues
      }
      // Always attempt auto-detect (best-effort) to override stale emulator cache.
      await detectAndSetCity('auto');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        const [citiesRes, verifiedRes, servicedRes] = await Promise.all([citiesReq, verifiedCountReq, servicedReq]);

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
                onPress={() => navigation.navigate('Login')}
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

            {/* Primary CTA (Website-style booking) */}
            <TouchableOpacity style={styles.bookNowCta} onPress={onPressBookServiceNow} activeOpacity={0.92}>
              <Ionicons name="calendar" size={18} color="#fff" />
              <Text style={styles.bookNowCtaText}>Book Service Now</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>

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
                const clamped = Math.max(0, Math.min(heroCards.length - 1, idx));
                setHeroIndex(clamped);
                heroIndexRef.current = clamped;
              }}
            >
              {heroCards.map((c, idx) => (
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

                  <TouchableOpacity
                    style={styles.heroSlideSecondary}
                    onPress={c.onSecondary}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.heroSlideSecondaryText}>{c.secondaryText}</Text>
                    <Ionicons name={c.secondaryIcon as any} size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={styles.dotsRow}>
              {heroCards.map((c, i) => (
                <View key={c.key} style={[styles.dot, i === heroIndex ? styles.dotActive : null]} />
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
                  onPress={() => onPressAIBooking(c.prefill)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.starterChipText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Option E: Trust strip (show early) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trust & Proof</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {trustCards.map((c) => (
                <View key={c.title} style={styles.proofCard}>
                  <View style={styles.proofIcon}>
                    <Ionicons name={c.icon as any} size={18} color="#fff" />
                  </View>
                  <Text style={styles.proofTitle}>{c.title}</Text>
                  <Text style={styles.proofSub}>{c.subtitle}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Workshop Locator (public) */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Workshop Locator</Text>
              <TouchableOpacity onPress={onPressLocator} style={styles.smallLink}>
                <Text style={styles.smallLinkText}>View all</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.locatorCard}>
              <View style={styles.locatorTop}>
                <Ionicons name="location" size={18} color={COLORS.primary} />
                <Text style={styles.locatorTitle}>Find verified workshops near you</Text>
              </View>
              <Text style={styles.locatorSub}>
                {publicLoading ? 'Loading workshops…' : 'See verified partner workshops and open directions in Maps.'}
              </Text>

              {featuredWorkshops.length ? (
                <View style={styles.locatorList}>
                  {featuredWorkshops.slice(0, 3).map((w) => (
                    <TouchableOpacity
                      key={w.id}
                      style={styles.locatorRow}
                      activeOpacity={0.85}
                      onPress={onPressLocator}
                    >
                      <View style={styles.locatorDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.locatorName} numberOfLines={1}>
                          {w.name}
                        </Text>
                        <Text style={styles.locatorMeta} numberOfLines={1}>
                          {w.city || city}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.locatorEmpty}>
                  <Text style={styles.locatorEmptyText}>
                    {publicLoading ? 'Loading…' : 'No workshops found for this city yet.'}
                  </Text>
                </View>
              )}

              <TouchableOpacity style={styles.locatorCta} onPress={onPressLocator} activeOpacity={0.9}>
                <Ionicons name="search" size={18} color="#fff" />
                <Text style={styles.locatorCtaText}>Open Workshop Locator</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* AI Smart Booking (Core Differentiator) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Smart Booking — No Forms, No Confusion</Text>
            </View>

            <View style={styles.aiCard}>
              <View style={styles.aiCardTop}>
                <View style={styles.aiChip}>
                  <Ionicons name="sparkles" size={14} color="#fff" />
                  <Text style={styles.aiChipText}>AI-first booking</Text>
                </View>
                <Text style={styles.aiCardTitle}>Start by chatting</Text>
              </View>

              <View style={styles.chatPreview}>
                <View style={[styles.bubble, styles.bubbleBot]}>
                  <Text style={styles.bubbleText}>Which car do you drive?</Text>
                </View>
                <View style={[styles.bubble, styles.bubbleBot]}>
                  <Text style={styles.bubbleText}>What issue are you facing?</Text>
                </View>
                <View style={[styles.bubble, styles.bubbleBot]}>
                  <Text style={styles.bubbleText}>When do you want service?</Text>
                </View>
              </View>

              <Text style={styles.aiMicro}>
                Our AI understands your car and recommends the right service.
              </Text>

              <TouchableOpacity style={styles.aiCta} onPress={() => onPressAIBooking()}>
                <Text style={styles.aiCtaText}>Start AI Booking</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Actions (below Trust & Smart Booking) */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <TouchableOpacity onPress={onPressPackages} style={styles.smallLink}>
                <Text style={styles.smallLinkText}>See all</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.quickGrid}>
              {quickActions.map((a) => (
                <TouchableOpacity
                  key={a.label}
                  style={styles.quickCard}
                  activeOpacity={0.9}
                  onPress={() => onPressAIBooking(a.prefill)}
                >
                  <View style={styles.quickIconWrap}>
                    <Ionicons name={a.icon as any} size={18} color={COLORS.primaryDark} />
                  </View>
                  <Text style={styles.quickLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* How MY FNG Works */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How MY FNG Works</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {[
                { icon: 'chatbubbles', title: 'Book via AI or App' },
                { icon: 'car', title: 'Free Pickup & Inspection' },
                { icon: 'checkbox', title: 'Live Updates + Warranty' },
              ].map((s) => (
                <View key={s.title} style={styles.stepCard}>
                  <View style={styles.stepIconWrap}>
                    <Ionicons name={s.icon as any} size={18} color="#fff" />
                  </View>
                  <Text style={styles.stepCardText}>{s.title}</Text>
                </View>
              ))}
            </ScrollView>
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
            <Text style={styles.sectionTitle}>Verified MY FNG Partner Workshops</Text>
            <Text style={styles.sectionSub}>
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
            if (tab === 'ai') onPressAIBooking();
            if (tab === 'search') onPressLocator();
            if (tab === 'profile') navigation.navigate('Login');
            if (tab === 'settings') setSupportOpen(true);
          }}
        />

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
                  navigation.navigate('Login');
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
                  navigation.navigate('Login');
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
    paddingBottom: 140,
    backgroundColor: COLORS.gray[50],
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 110,
    height: 34,
  },
  citySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.18)',
  },
  citySelectorText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  heroCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
    shadowColor: '#0B1F44',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  heroHeadline: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primaryDark,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  heroHeadlineAccent: {
    color: COLORS.primary,
  },
  heroSub: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.gray[600],
    lineHeight: 19,
  },
  bookNowCta: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  bookNowCtaText: {
    color: '#fff',
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
  },
  heroCarousel: {
    marginTop: SPACING.md,
    paddingRight: SPACING.md,
  },
  heroSlide: {
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
  },
  heroSlideTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  heroKickerPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  heroSlideTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  heroSlideDesc: {
    marginTop: 8,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.gray[700],
    lineHeight: 18,
  },
  heroSlidePrimary: {
    marginTop: SPACING.md,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  heroSlidePrimaryText: {
    color: '#fff',
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
  },
  heroSlideSecondary: {
    marginTop: SPACING.sm,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  heroSlideSecondaryText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  dotsRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(2,61,149,0.18)',
  },
  dotActive: {
    width: 22,
    backgroundColor: COLORS.primary,
  },
  heroPrimaryBtn: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
  },
  heroPrimaryBtnText: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
  },
  heroSecondaryBtn: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#F3F8FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.18)',
  },
  heroSecondaryBtnText: {
    color: COLORS.primaryDark,
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
  },
  section: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  sectionHeader: { marginBottom: SPACING.md },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  sectionSub: {
    marginTop: 8,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.gray[600],
    lineHeight: 18,
  },
  smallLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    gap: 8,
    paddingRight: SPACING.md,
  },
  starterChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray[600],
    lineHeight: 15,
  },
  smallLinkInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    gap: 10,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
  },
  aiCtaText: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.sm,
  },
  quickCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
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
    paddingRight: SPACING.md,
    gap: SPACING.sm,
  },
  proofCard: {
    width: 160,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  proofIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  proofTitle: {
    fontSize: 18,
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
  stepCard: {
    width: 220,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  stepIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  stepCardText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
    lineHeight: 18,
  },
  transparencyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  transparencyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: SPACING.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  bulletIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#EEF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.gray[700],
    lineHeight: 18,
  },
  workshopCard: {
    width: 260,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    overflow: 'hidden',
  },
  workshopImg: {
    width: '100%',
    height: 140,
    backgroundColor: COLORS.gray[200],
  },
  workshopMeta: {
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  workshopName: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
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


