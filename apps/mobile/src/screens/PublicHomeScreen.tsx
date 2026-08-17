import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PostBookingMembershipOfferCard from '../components/PostBookingMembershipOfferCard';
import { usePendingPostBookingMembershipOffer } from '../hooks/usePendingPostBookingMembershipOffer';
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicBottomNav';
import PublicHeader from '../components/PublicHeader';
import RsaHomeSection from '../components/RsaHomeSection';
import { detectHeaderLocation } from '../lib/locationDisplay';
import LiveTrackingModal from '../components/LiveTrackingModal';
import SearchOverlay from '../components/SearchOverlay';
import MembershipCardsBlock from '../components/MembershipCardsBlock';
import ReferAndFooter from '../components/ReferAndFooter';
import TrustStatsGrid from '../components/TrustStatsGrid';
import SmartToolsBlock from '../components/SmartToolsSection';
import { useAppFooter } from '../context/AppFooterContext';
import SectionHeading from '../components/SectionHeading';
import CompleteTransparencySection from '../components/CompleteTransparencySection';
import { openPhoneCall } from '../lib/phone';
import { COLORS } from '../constants/theme';
import {
  BLOGS as BLOG_ITEMS,
  POPULAR_PACKAGES as PACKAGE_ITEMS,
  SPARE_PART_BRANDS,
  CAR_BRANDS,
  FAQ_CATEGORIES,
  CUSTOMER_REVIEWS,
  type PublicBrand,
} from '../constants/publicAppData';
import { getCustomerSessionToken } from '../lib/customerSession';
import { ENV } from '../config/environment';
import { supabase } from '../lib/supabase';
import { WelcomeBonusCreditedModal, WelcomeBonusGuestModal } from '../components/WelcomeBonusModal';
import DynamicPopupManager from '../components/DynamicPopupManager';
import {
  decideWelcomeCreditedPopup,
  getWelcomeBonusAmount,
  markGuestWelcomePopupShown,
  markWelcomeCreditedPopupQueued,
  markWelcomeCreditedPopupShown,
  mobileCustomerHeaders,
  shouldShowGuestWelcomePopup,
} from '../lib/welcomeBonus';
import { getCartBadgeCount, subscribeCartBadgeCount } from '../lib/cartBadgeCount';
import { fetchPublicFaqs, type PublicFaqItem } from '../lib/publicFaqs';
import { trackEvent } from '../lib/trackEvent';
type Props = {
  navigation: any;
};

type HeroBanner = {
  id: string;
  title: string;
  desc: string;
  route: string;
  routeParams?: Record<string, any>;
  icon: keyof typeof Ionicons.glyphMap;
  colors: [string, string];
  image: string;
  overlay: string;
};

// Fallback banners — used only if the admin-managed list (home_carousel_banners table)
// returns no rows or fails. Once the admin uploads images on the Super Admin page,
// those override this list.
const FALLBACK_HERO_BANNERS: HeroBanner[] = [
  {
    id: 'service',
    title: 'Car Service',
    desc: 'Expert maintenance for your car',
    route: 'PublicBookServiceNow',
    icon: 'construct',
    colors: ['#004AAD', '#0A57BF'],
    image:
      'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/Mobile%20Screen%20-%20Hero%20Section/CarService.PNG',
    overlay: 'rgba(0, 74, 173, 0.45)',
  },
  {
    id: 'rsa',
    title: 'RSA 24/7',
    desc: "Stranded? We're on our way",
    route: 'PublicWorkshopLocator',
    icon: 'alert-circle',
    colors: ['#DC2626', '#991B1B'],
    image:
      'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/Mobile%20Screen%20-%20Hero%20Section/RSA.PNG',
    overlay: 'rgba(17, 24, 39, 0.42)',
  },
  {
    id: 'ai',
    title: 'MyFNG AI',
    desc: 'Book service via smart chat',
    route: 'AIBooking',
    icon: 'sparkles',
    colors: ['#2563EB', '#1E3A8A'],
    image:
      'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/Mobile%20Screen%20-%20Hero%20Section/MyFNG-AI.PNG',
    overlay: 'rgba(30, 58, 138, 0.45)',
  },
];

const SUPABASE_STORAGE = 'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App';
type PromoBanner = { image_url: string; route_name: string; route_params: any };

// Fallback promo banners — overridden by admin-managed `home_promo_banners` table
// once Super Admin uploads custom images via the web dashboard.
const FALLBACK_PROMO_BANNERS: PromoBanner[] = [
  { image_url: `${SUPABASE_STORAGE}/Mobile%20Screen%20-%20Home%20Page%20-%20Other%20Cards/My%20FNG%20-%20Banner%20-%20Get%20A%20Loan%20Against%20Car.PNG`, route_name: '', route_params: {} },
  { image_url: `${SUPABASE_STORAGE}/Mobile%20Screen%20-%20Home%20Page%20-%20Other%20Cards/My%20FNG%20-%20Banner%20-%20Check%20Your%20Cars%20E-Challan.PNG`, route_name: '', route_params: {} },
  { image_url: `${SUPABASE_STORAGE}/Mobile%20Screen%20-%20Home%20Page%20-%20Other%20Cards/My%20FNG%20-%20Banner%20-%20Get%20Nearest%20Fuel%20Station.PNG`, route_name: '', route_params: {} },
  { image_url: `${SUPABASE_STORAGE}/Mobile%20Screen%20-%20Home%20Page%20-%20Other%20Cards/My%20FNG%20-%20Banner%20-%20Sell%20Your%20Car%20Stress%20Free.PNG`, route_name: '', route_params: {} },
];

const PROMO_BANNER_LINKS: Record<string, string> = {
  loan: 'https://myfng.in/car-loan',
  challan: 'https://myfng.in',
  fuel: 'https://myfng.in',
  sell: 'https://myfng.in',
};

type ServiceItem = {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  image?: any;
  color: string;
  bg: string;
};

const SERVICES: ServiceItem[] = [
  { id: '1', label: 'Periodic Service', icon: 'construct', color: '#2563EB', bg: '#FFFFFF' },
  { id: '4', label: 'Engine Services', icon: 'speedometer', color: '#EA580C', bg: '#FFFFFF' },
  { id: '8', label: 'Detailing Service', icon: 'car-sport', color: '#EC4899', bg: '#FFFFFF' },
  { id: '9', label: 'Denting & Painting', icon: 'color-fill', color: '#059669', bg: '#FFFFFF' },
  { id: '7', label: 'Tyre and Wheels', icon: 'disc-outline', color: '#1F2937', bg: '#FFFFFF' },
  { id: 'all', label: 'View All', icon: 'arrow-forward', color: COLORS.primary, bg: '#FFFFFF' },
];

const HOW_IT_WORKS = [
  { id: '01', title: 'Book Via Misa AI', desc: 'Chat with our AI assistant to select your service and preferred time. No calls required.', color: '#004AAD', icon: 'sparkles' as const },
  { id: '02', title: 'Pickup Scheduled', desc: 'We confirm your slot and arrange doorstep pickup at your convenience.', color: '#60A5FA', icon: 'car' as const },
  { id: '03', title: 'Tracking & Updates', desc: "Track your car's journey and receive photos & video updates during service.", color: '#004AAD', icon: 'pulse' as const },
  { id: '04', title: 'Quality Check', desc: 'Service completion is verified as per MY FNG process before delivery.', color: '#60A5FA', icon: 'shield-checkmark' as const },
  { id: '05', title: 'Delivery & Warranty', desc: 'Your car is delivered back with service documentation and warranty coverage.', color: '#004AAD', icon: 'trophy' as const },
];

const HEADLINES = [
  { prefix: 'Book Your Car Service in 60 Seconds - ', highlight: 'Powered by AI', suffix: '' },
  { prefix: "India's ", highlight: '#1 AI-Powered', suffix: ' Car Service Booking Platform' },
  { prefix: 'Book Reliable Car Service ', highlight: 'Anytime, Anywhere', suffix: '' },
];

const SCREEN_HEIGHT = Dimensions.get('window').height;
const REVIEW_MODAL_SCROLL_MAX_HEIGHT = SCREEN_HEIGHT * 0.8 - 96;

function BrandLogoCard({ brand }: { brand: PublicBrand }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <View style={styles.brandCardSmall}>
      {brand.logo && !failed ? (
        <Image
          source={{ uri: brand.logo }}
          style={styles.brandLogoLarge}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.brandLogoPlaceholder}>
          <Text style={styles.brandLogoPlaceholderText}>{brand.name[0]}</Text>
        </View>
      )}
      <Text style={styles.brandCardTitle}>{brand.name}</Text>
    </View>
  );
}

export default function PublicHomeScreen({ navigation }: Props) {
  const { footer, refreshFooter } = useAppFooter();
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroBanners, setHeroBanners] = useState<HeroBanner[]>(FALLBACK_HERO_BANNERS);
  const [promoBanners, setPromoBanners] = useState<PromoBanner[]>(FALLBACK_PROMO_BANNERS);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [loanIndex, setLoanIndex] = useState(0);
  const [howIndex, setHowIndex] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<string | null>(null);
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [reviews, setReviews] = useState(CUSTOMER_REVIEWS);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [guestWelcomeVisible, setGuestWelcomeVisible] = useState(false);
  const [creditedWelcomeVisible, setCreditedWelcomeVisible] = useState(false);
  const [creditedWelcomeAmount, setCreditedWelcomeAmount] = useState(getWelcomeBonusAmount());
  const pendingWelcomeCustomerIdRef = useRef<string | null>(null);
  const pendingWelcomePhoneRef = useRef<string | null>(null);
  const [hasActiveBooking] = useState(false);
  const [carBrands, setCarBrands] = useState<PublicBrand[]>(CAR_BRANDS);
  const [detectedCity, setDetectedCity] = useState('Detecting...');
  const [cartItemCount, setCartItemCount] = useState(0);
  const [generalFaqs, setGeneralFaqs] = useState<PublicFaqItem[]>(FAQ_CATEGORIES[0].items);
  const [refreshing, setRefreshing] = useState(false);
  const [liveBlogs, setLiveBlogs] = useState<Array<{ id: string; title: string; excerpt: string; date: string; image: string; slug: string }>>([]);
  const brandScrollX = useRef(new Animated.Value(0)).current;
  const brandAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const spareScrollX = useRef(new Animated.Value(0)).current;

  const blinkAnim = useRef(new Animated.Value(1)).current;
  const heroFade = useRef(new Animated.Value(1)).current;
  const headlineFade = useRef(new Animated.Value(1)).current;
  const loanFade = useRef(new Animated.Value(1)).current;
  const howFade = useRef(new Animated.Value(1)).current;
  const howSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.3, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [blinkAnim]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let popupTimer: ReturnType<typeof setTimeout> | null = null;
      (async () => {
        const token = await getCustomerSessionToken();
        const loggedIn = Boolean(token);
        if (active) setIsLoggedIn(loggedIn);
        if (active && !loggedIn && shouldShowGuestWelcomePopup(loggedIn)) {
          popupTimer = setTimeout(() => {
            if (!active) return;
            markGuestWelcomePopupShown();
            setGuestWelcomeVisible(true);
          }, 700);
        }

        if (active && loggedIn && token) {
          try {
            const meRes = await fetch(`${ENV.API_URL}/api/customer/auth/me`, {
              headers: mobileCustomerHeaders(token),
            });
            const meJson = meRes.ok ? await meRes.json().catch(() => ({})) : {};
            const decision = await decideWelcomeCreditedPopup(
              token,
              meJson?.customer?.id,
              null,
              meJson?.customer?.phone,
            );
            if (active && decision.show) {
              pendingWelcomeCustomerIdRef.current = meJson?.customer?.id
                ? String(meJson.customer.id)
                : null;
              pendingWelcomePhoneRef.current = meJson?.customer?.phone
                ? String(meJson.customer.phone)
                : null;
              setCreditedWelcomeAmount(decision.amount);
              // Delay so login/referral modals finish unmounting first (scroll blocker fix).
              popupTimer = setTimeout(() => {
                if (active) {
                  markWelcomeCreditedPopupQueued(
                    pendingWelcomeCustomerIdRef.current,
                    pendingWelcomePhoneRef.current,
                  );
                  setCreditedWelcomeVisible(true);
                }
              }, 600);
            }
          } catch {
            // ignore welcome popup errors
          }
        }
      })();
      return () => {
        active = false;
        if (popupTimer) clearTimeout(popupTimer);
      };
    }, []),
  );

  const {
    pending: pendingMembershipOffer,
    paying: payingMembershipOffer,
    tick: membershipOfferTick,
    pay: payMembershipOffer,
    appConfig: postBookingAppConfig,
    refresh: refreshMembershipOffer,
  } = usePendingPostBookingMembershipOffer(isLoggedIn);

  useEffect(() => {
    return subscribeCartBadgeCount((count) => {
      setCartItemCount(count);
    });
  }, []);

  const refreshHomeData = useCallback(async () => {
    const sessionToken = await getCustomerSessionToken();
    setIsLoggedIn(Boolean(sessionToken));

    void getCartBadgeCount()
      .then((count) => setCartItemCount(count))
      .catch(() => setCartItemCount(0));

    void detectHeaderLocation()
      .then((locationLabel) => setDetectedCity(locationLabel))
      .catch(() => setDetectedCity('Location unavailable'));

    fetchPublicFaqs({ group: 'GENERAL', platform: 'app' })
      .then(setGeneralFaqs)
      .catch(() => setGeneralFaqs(FAQ_CATEGORIES[0].items));

    await Promise.all([
      (async () => {
        try {
          const { data, error } = await supabase
            .from('home_carousel_banners')
            .select('id, title, image_url, route_name, route_params, display_order, is_active')
            .eq('is_active', true)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

          if (error || !Array.isArray(data) || data.length === 0) return;

          setHeroBanners(
            data.map((row: any) => ({
              id: String(row.id),
              title: row.title || '',
              desc: '',
              route: row.route_name || 'PublicHome',
              routeParams: row.route_params || undefined,
              icon: 'sparkles' as const,
              colors: ['#004AAD', '#0A57BF'] as [string, string],
              image: row.image_url,
              overlay: 'rgba(0,0,0,0)',
            })),
          );
        } catch {
          // keep existing banners
        }
      })(),
      (async () => {
        try {
          const { data, error } = await supabase
            .from('home_promo_banners')
            .select('image_url, route_name, route_params, display_order, is_active')
            .eq('is_active', true)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

          if (error || !Array.isArray(data) || data.length === 0) return;

          const banners: PromoBanner[] = data
            .filter((row: any) => !!row.image_url)
            .map((row: any) => ({
              image_url: String(row.image_url),
              route_name: String(row.route_name || ''),
              route_params: row.route_params || {},
            }));
          if (banners.length > 0) setPromoBanners(banners);
        } catch {
          // keep existing promos
        }
      })(),
      (async () => {
        try {
          const { data, error } = await supabase
            .from('customer_reviews')
            .select('id, name, car, stars, text, date, display_order, is_active, screen')
            .eq('is_active', true)
            .or('screen.eq.home,screen.is.null')
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

          if (error || !Array.isArray(data) || data.length === 0) return;

          setReviews(
            data.map((row: any) => ({
              name: row.name || '',
              car: row.car || '',
              stars: row.stars || 5,
              text: row.text || '',
              date: row.date || '',
            })),
          );
        } catch {
          // keep existing reviews
        }
      })(),
      (async () => {
        try {
          const { data, error } = await supabase
            .from('web_car_brand')
            .select('name, logo_url, display_order')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

          if (error || !Array.isArray(data) || data.length === 0) return;
          const brands: PublicBrand[] = data.map((b: any) => ({
            name: b.name,
            logo: b.logo_url || '',
          }));
          setCarBrands(brands);
        } catch {
          // keep fallback CAR_BRANDS
        }
      })(),
      (async () => {
        try {
          const res = await fetch(`${ENV.API_URL}/api/blogs/public?limit=5`);
          if (!res.ok) return;
          const json = await res.json();
          const blogs = (json.blogs || []).map((b: any) => ({
            id: b.id,
            title: b.title || '',
            excerpt: b.excerpt || '',
            date: b.published_at
              ? new Date(b.published_at).toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '',
            image: b.featured_image || '',
            slug: b.slug || '',
          }));
          if (blogs.length > 0) setLiveBlogs(blogs);
        } catch {
          // keep existing blogs
        }
      })(),
    ]);

    if (sessionToken) {
      await refreshMembershipOffer();
    }
  }, [refreshMembershipOffer]);

  useFocusEffect(
    useCallback(() => {
      void refreshHomeData();
    }, [refreshHomeData]),
  );

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshHomeData(), refreshFooter()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshHomeData, refreshFooter]);

  const BRAND_CARD_W = 96 + 16;
  const screenW = Dimensions.get('window').width - 32;
  useEffect(() => {
    if (carBrands.length === 0) return;
    const totalW = carBrands.length * BRAND_CARD_W;
    const scrollDistance = totalW - screenW + 16;
    if (scrollDistance <= 0) return;
    brandScrollX.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(brandScrollX, { toValue: -scrollDistance, duration: carBrands.length * 1800, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(brandScrollX, { toValue: 0, duration: carBrands.length * 1800, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    brandAnimRef.current = anim;
    anim.start();
    return () => anim.stop();
  }, [carBrands, brandScrollX, screenW]);

  useEffect(() => {
    const SPARE_CARD_W = 104 + 16;
    const totalW = SPARE_PART_BRANDS.length * SPARE_CARD_W;
    const scrollDistance = totalW - screenW + 16;
    if (scrollDistance <= 0) return;
    spareScrollX.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(spareScrollX, { toValue: -scrollDistance, duration: SPARE_PART_BRANDS.length * 1800, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(spareScrollX, { toValue: 0, duration: SPARE_PART_BRANDS.length * 1800, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [spareScrollX, screenW]);

  useEffect(() => {
    const count = heroBanners.length;
    const timer = setInterval(() => {
      Animated.timing(heroFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setHeroIndex((prev) => (prev + 1) % Math.max(count, 1));
        Animated.timing(heroFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [heroFade, heroBanners.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(headlineFade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setHeadlineIndex((prev) => (prev + 1) % HEADLINES.length);
        Animated.timing(headlineFade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [headlineFade]);

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(loanFade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setLoanIndex((prev) => (prev + 1) % Math.max(promoBanners.length, 1));
        Animated.timing(loanFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [loanFade, promoBanners.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.parallel([
        Animated.timing(howFade, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(howSlide, { toValue: -30, duration: 250, useNativeDriver: true }),
      ]).start(() => {
        setHowIndex((prev) => (prev + 1) % HOW_IT_WORKS.length);
        howSlide.setValue(30);
        Animated.parallel([
          Animated.timing(howFade, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(howSlide, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]).start();
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [howFade, howSlide]);

  const activeHero = useMemo(() => {
    if (heroBanners.length === 0) return FALLBACK_HERO_BANNERS[0];
    return heroBanners[heroIndex % heroBanners.length] || heroBanners[0];
  }, [heroIndex, heroBanners]);

  const onNavPress = (tab: PublicPillNavTab) => {
    if (tab === 'home') return;
    if (tab === 'services') navigation.navigate('PublicServicePackages', { city: detectedCity });
    if (tab === 'ai') navigation.navigate('AIBooking', { city: detectedCity, fullScreen: true });
    if (tab === 'roadside') navigation.navigate('RoadsideAssistance', { city: detectedCity });
    if (tab === 'account') navigation.navigate('Settings');
  };

  // Search navigation is now handled inside SearchOverlay directly

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <PublicHeader
          city={detectedCity}
          cartCount={cartItemCount}
          onPressSearch={() => { trackEvent('home_search_opened'); setShowSearchOverlay(true); }}
          onPressCart={() => navigation.navigate('Settings', { subPage: 'Cart' })}
        />

        <ScrollView
          style={styles.homeScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          scrollEnabled
          bounces
          removeClippedSubviews={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullRefresh}
              tintColor="#004AAD"
              colors={['#004AAD']}
            />
          }
        >
          {!isLoggedIn ? (
            <View style={[styles.loginBanner, { backgroundColor: '#004AAD' }]}>
              <View>
                <Text style={styles.loginBannerTitle}>Unlock Premium Benefits</Text>
                <Text style={styles.loginBannerText}>
                  Login to track services, earn rewards and manage your service history.
                </Text>
              </View>
              <TouchableOpacity style={styles.loginBannerButton} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginBannerButtonText}>Login Now</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {isLoggedIn && pendingMembershipOffer && postBookingAppConfig.show_on_home ? (
            <View style={styles.membershipOfferWrap}>
              <PostBookingMembershipOfferCard
                offerPayView={pendingMembershipOffer.offerPayView}
                paying={payingMembershipOffer}
                onPay={payMembershipOffer}
                tick={membershipOfferTick}
                cardTitle={postBookingAppConfig.card_title}
                fomoMessage={postBookingAppConfig.fomo_message}
              />
            </View>
          ) : null}

          <Section>
            <Animated.View style={{ opacity: headlineFade }}>
              <Text style={styles.heroHeadline}>
                {HEADLINES[headlineIndex].prefix}
                <Text style={styles.heroHeadlineBlue}>{HEADLINES[headlineIndex].highlight}</Text>
                {HEADLINES[headlineIndex].suffix}
              </Text>
            </Animated.View>
            <Text style={styles.heroSubLine}>
              Genuine Parts • Expert Technicians • Free Pickup & Drop • Transparent Pricing
            </Text>
            <Animated.View style={[styles.heroCard, { opacity: heroFade }]}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  trackEvent('home_banner_tapped', { banner_index: heroIndex % Math.max(heroBanners.length, 1) });
                  const params = activeHero.routeParams ? { ...activeHero.routeParams } : {};
                  Object.keys(params).forEach((k) => {
                    if (params[k] === '__CITY__') params[k] = detectedCity;
                  });
                  const route = activeHero.route;
                  if (route.startsWith('Settings__')) {
                    const subPageMap: Record<string, string> = {
                      Settings__MyProfile: 'My Profile',
                      Settings__Membership: 'Membership',
                      Settings__YourAddresses: 'Your Addresses',
                      Settings__OrderHistory: 'Order History',
                      Settings__Cart: 'Cart',
                      Settings__Notifications: 'Notifications',
                    };
                    navigation.navigate('Settings' as never, { subPage: subPageMap[route] || null, ...params } as never);
                  } else {
                    navigation.navigate(route as never, params as never);
                  }
                }}
                style={styles.heroTouchable}
              >
                <Image source={{ uri: activeHero.image }} style={styles.heroFullImage} resizeMode="cover" />
              </TouchableOpacity>
              <View style={styles.heroDots}>
                {heroBanners.map((banner, idx) => (
                  <View
                    key={banner.id}
                    style={[
                      styles.heroDot,
                      idx === heroIndex % Math.max(heroBanners.length, 1) ? styles.heroDotActive : null,
                    ]}
                  />
                ))}
              </View>
            </Animated.View>
          </Section>

          {isLoggedIn ? (
            <Section>
              <TouchableOpacity
                style={[styles.liveCard, !hasActiveBooking ? styles.liveCardDisabled : null]}
                onPress={() => {
                  if (hasActiveBooking) setShowTrackingModal(true);
                }}
                activeOpacity={hasActiveBooking ? 0.9 : 1}
              >
                {hasActiveBooking ? (
                  <View style={styles.liveBadge}>
                    <Animated.View style={[styles.livePing, { opacity: blinkAnim }]} />
                    <Text style={styles.liveBadgeText}>Live</Text>
                  </View>
                ) : (
                  <View style={styles.liveBadgeDisabled}>
                    <Text style={styles.liveBadgeText}>Disabled</Text>
                  </View>
                )}
                <View style={styles.liveRow}>
                  <View style={styles.liveLeft}>
                    <View style={styles.liveIcon}>
                      <Ionicons name="location" size={18} color="#FFFFFF" />
                    </View>
                    <Text style={styles.liveTitle}>Live Tracking</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.liveAction, !hasActiveBooking ? styles.liveActionDisabled : null]}
                    disabled={!hasActiveBooking}
                    onPress={() => setShowTrackingModal(true)}
                  >
                    <Text style={styles.liveActionText}>{hasActiveBooking ? 'View Status' : 'No Booking'}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                {!hasActiveBooking ? (
                  <Text style={styles.liveDisabledText}>Book a service first to enable live tracking.</Text>
                ) : null}
              </TouchableOpacity>
            </Section>
          ) : null}

          <Section>
            <SectionHeading
              spacing="inline"
              title="Our Services"
              subtitle="Book trusted car care services near you"
            />
            <View style={styles.serviceGrid}>
              {SERVICES.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={styles.serviceTile}
                  onPress={() => {
                    trackEvent('home_service_category_tapped', { category: service.label });
                    navigation.navigate('PublicServicePackages', {
                      city: detectedCity,
                      selectedServiceId: service.id === 'all' ? null : service.id,
                    });
                  }}
                >
                  <View style={styles.serviceIconWrap}>
                    {service.image ? (
                      <Image source={service.image} style={styles.serviceIconImage} resizeMode="contain" />
                    ) : service.icon ? (
                      <Ionicons name={service.icon} size={22} color={service.color} />
                    ) : null}
                  </View>
                  <Text style={styles.serviceLabel}>{service.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          <Section tight>
            <MembershipCardsBlock screen="home" slot="after_services" navigation={navigation} spacing="compact" />
            <SmartToolsBlock screen="home" slot="after_services" navigation={navigation} city={detectedCity} compact />
          </Section>

          <Section>
            <TouchableOpacity
              style={styles.locatorCard}
              onPress={() => { trackEvent('workshop_locator_opened'); navigation.navigate('PublicWorkshopLocator', { city: detectedCity }); }}
            >
              <View style={styles.locatorLeft}>
                <View style={styles.locatorIcon}>
                  <Ionicons name="location" size={22} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.locatorTitle}>Workshop Locator</Text>
                  <Text style={styles.locatorSubTitle}>Find nearest MyFNG certified workshop</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </Section>

          <Section>
            <SectionHeading
              spacing="inline"
              title="How It Works"
              subtitle="Simple steps from booking to delivery"
            />
            <View style={styles.howCardWrap}>
              <Animated.View
                style={[
                  styles.howAnimCard,
                  { backgroundColor: HOW_IT_WORKS[howIndex].color, opacity: howFade, transform: [{ translateY: howSlide }] },
                ]}
              >
                <View style={styles.howAnimTop}>
                  <Text style={styles.howAnimStep}>Step {HOW_IT_WORKS[howIndex].id}</Text>
                  <View style={styles.howAnimIconWrap}>
                    <Ionicons name={HOW_IT_WORKS[howIndex].icon} size={24} color="#FFFFFF" />
                  </View>
                </View>
                <Text style={styles.howAnimTitle}>{HOW_IT_WORKS[howIndex].title}</Text>
                <Text style={styles.howAnimDesc}>{HOW_IT_WORKS[howIndex].desc}</Text>
                <View style={styles.howBlurCircle} />
              </Animated.View>
            </View>
            <View style={styles.howDots}>
              {HOW_IT_WORKS.map((_, i) => (
                <View key={i} style={styles.howDotTrack}>
                  <View style={[styles.howDotFill, i <= howIndex ? styles.howDotFillActive : null]} />
                </View>
              ))}
            </View>
          </Section>

          <Section>
            <SectionHeading
              spacing="inline"
              title="Why MyFNG"
              subtitle="Trusted by thousands of car owners across India"
            />
            <View style={styles.uspRow}>
              {([
                [`${footer.stats[1].value}/5`, 'RATING', 'star' as const],
                [footer.stats[0].value, 'CARS', 'trophy' as const],
                [footer.trust_grid[2].value, 'WORKSHOPS', 'construct' as const],
                ['Warranty', 'PARTS', 'shield-checkmark' as const],
                ['Live', 'UPDATES', 'eye' as const],
              ] as const).map(([value, label, icon]) => (
                <View key={label} style={styles.uspItem}>
                  <View style={styles.uspIconWrap}>
                    <Ionicons name={icon} size={18} color={COLORS.primary} />
                  </View>
                  <Text style={styles.uspValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {value}
                  </Text>
                  <Text style={styles.uspLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </Section>

          <Section>
            <CompleteTransparencySection headingSpacing="inline" />
          </Section>

          <Section>
            <Animated.View style={[styles.loanCard, { opacity: loanFade }]}>
              {(() => {
                const currentBanner = promoBanners[loanIndex % Math.max(promoBanners.length, 1)];
                if (!currentBanner) return null;
                const handlePress = () => {
                  if (currentBanner.route_name) {
                    const route = currentBanner.route_name;
                    const params = currentBanner.route_params || {};
                    if (route.startsWith('Settings__')) {
                      const subPageMap: Record<string, string> = {
                        Settings__MyProfile: 'My Profile',
                        Settings__Membership: 'Membership',
                        Settings__YourAddresses: 'Your Addresses',
                        Settings__OrderHistory: 'Order History',
                        Settings__Cart: 'Cart',
                        Settings__Notifications: 'Notifications',
                      };
                      navigation.navigate('Settings' as never, { subPage: subPageMap[route] || null, ...params } as never);
                    } else {
                      navigation.navigate(route as never, params as never);
                    }
                  } else {
                    const bannerLower = currentBanner.image_url.toLowerCase();
                    const link = Object.entries(PROMO_BANNER_LINKS).find(([key]) => bannerLower.includes(key))?.[1] || 'https://myfng.in';
                    Linking.openURL(link);
                  }
                };
                return (
                  <TouchableOpacity activeOpacity={0.85} onPress={handlePress}>
                    <Image
                      source={{ uri: currentBanner.image_url }}
                      style={styles.loanBannerImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              })()}
              <View style={styles.loanDots}>
                {promoBanners.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.heroDot,
                      idx === loanIndex % Math.max(promoBanners.length, 1) ? styles.heroDotActive : null,
                    ]}
                  />
                ))}
              </View>
            </Animated.View>
          </Section>

          <Section tight>
            <MembershipCardsBlock screen="home" slot="after_loan_card" navigation={navigation} spacing="compact" />
            <SmartToolsBlock screen="home" slot="after_loan_card" navigation={navigation} city={detectedCity} compact />
          </Section>

          <SmartToolsBlock screen="home" slot="main_grid" navigation={navigation} city={detectedCity} />

          <Section>
            <SectionHeading
              spacing="inline"
              title="Original Spare Parts"
              subtitle="Genuine OEM/OES parts for every repair"
            />
            <View style={styles.brandCarouselClip}>
              <Animated.View style={[styles.brandCarouselRow, { transform: [{ translateX: spareScrollX }] }]}>
                {SPARE_PART_BRANDS.map((brand) => (
                  <View key={brand.name} style={styles.brandCard}>
                    {brand.logo ? (
                      <Image source={{ uri: brand.logo }} style={styles.brandLogo} resizeMode="contain" />
                    ) : (
                      <View style={styles.brandLogoPlaceholder}>
                        <Text style={styles.brandLogoPlaceholderText}>{brand.name[0]}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </Animated.View>
            </View>
          </Section>

          <Section>
            <SectionHeading
              spacing="inline"
              title="Popular Packages"
              subtitle="Best-value service bundles for your car"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
              {PACKAGE_ITEMS.map((pkg) => (
                <View key={pkg.id} style={styles.packageCard}>
                  <Image source={{ uri: pkg.image }} style={styles.packageImagePlaceholder} resizeMode="cover" />
                  <View style={styles.packageContent}>
                    <Text style={styles.packageName}>{pkg.name}</Text>
                    <Text style={styles.packageDesc}>{pkg.desc}</Text>
                    <View style={styles.packageFooter}>
                      <View>
                        <Text style={styles.packageStartsFrom}>Starts From</Text>
                        <Text style={styles.packageVariant}>WagonR</Text>
                        <Text style={styles.packagePrice}>₹{pkg.price.toLocaleString()}*</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.packageBookBtn}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate('PublicBookServiceNow', { city: detectedCity, packageId: pkg.id })}
                      >
                        <Text style={styles.packageBookBtnText}>Book</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </Section>

          <Section>
            <RsaHomeSection city={detectedCity} navigation={navigation} compact />
          </Section>

          <Section tight>
            <MembershipCardsBlock screen="home" slot="after_smart_tools" navigation={navigation} bannerOnly spacing="compact" />
          </Section>

          <Section>
            <SectionHeading
              spacing="inline"
              title="Brands We Service"
              subtitle="Multibrand expertise across all major makes"
            />
            <View style={styles.brandCarouselClip}>
              <Animated.View style={[styles.brandCarouselRow, { transform: [{ translateX: brandScrollX }] }]}>
                {carBrands.map((brand) => (
                  <BrandLogoCard key={brand.name} brand={brand} />
                ))}
              </Animated.View>
            </View>
          </Section>

          <Section>
            <TrustStatsGrid />
          </Section>

          <Section tight>
            <SmartToolsBlock screen="home" slot="before_reviews" navigation={navigation} city={detectedCity} compact />
            <MembershipCardsBlock screen="home" slot="before_reviews" navigation={navigation} spacing="compact" />
          </Section>

          <Section>
            <SectionHeading
              spacing="inline"
              title="What Our Customers Say"
              subtitle="Real reviews from verified customers"
              rightAccessory={
                <View style={styles.reviewBadge}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={styles.reviewBadgeText}>4.8/5</Text>
                </View>
              }
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
              {reviews.slice(0, 3).map((review) => (
                <View key={`${review.name}-${review.date}`} style={styles.reviewCard}>
                  <View style={styles.reviewStars}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Ionicons key={i} name={i < review.stars ? 'star' : 'star-outline'} size={12} color="#F59E0B" />
                    ))}
                  </View>
                  <Text style={styles.reviewText}>"{review.text}"</Text>
                  <View style={styles.reviewAuthor}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.reviewAvatarText}>{review.name[0]}</Text>
                    </View>
                    <View>
                      <Text style={styles.reviewName}>{review.name}</Text>
                      <Text style={styles.reviewCar}>
                        {review.car ? `${review.car} • ${review.date}` : review.date}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllReviews(true)}>
              <Text style={styles.showMoreBtnText}>Show More Reviews</Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </Section>

          <Section>
            <SectionHeading
              spacing="inline"
              title="Latest from Blog"
              subtitle="Tips, guides and car care insights"
              rightAccessory={
                <TouchableOpacity onPress={() => Linking.openURL('https://myfng.in/blog')}>
                  <Text style={styles.blogReadMore}>Read More →</Text>
                </TouchableOpacity>
              }
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
              {(liveBlogs.length > 0 ? liveBlogs : BLOG_ITEMS).map((post) => (
                <TouchableOpacity
                  key={post.id}
                  style={styles.blogCard}
                  activeOpacity={0.85}
                  onPress={() => {
                    const slug = (post as any).slug;
                    if (slug) Linking.openURL(`https://myfng.in/blog/${slug}`);
                    else Linking.openURL('https://myfng.in/blog');
                  }}
                >
                  {post.image ? (
                    <Image source={{ uri: post.image }} style={styles.blogImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.blogImage, { backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 28 }}>📝</Text>
                    </View>
                  )}
                  <View style={styles.blogTextWrap}>
                    <Text style={styles.blogTitle} numberOfLines={2}>{post.title}</Text>
                    <Text style={styles.blogExcerpt} numberOfLines={2}>{post.excerpt}</Text>
                    <Text style={styles.blogDate}>{post.date}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Section>

          <Section>
            <SectionHeading
              spacing="inline"
              title="FAQs"
              subtitle="Answers to common questions about MyFNG"
            />
            {generalFaqs.slice(0, 5).map((faq, idx) => (
              <View key={faq.q} style={styles.faqCard}>
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => setOpenFaqIndex((prev) => (prev === String(idx) ? null : String(idx)))}
                >
                  <Text style={styles.faqQ}>{faq.q}</Text>
                  <Ionicons name={openFaqIndex === String(idx) ? 'chevron-up' : 'chevron-forward'} size={18} color="#6B7280" />
                </TouchableOpacity>
                {openFaqIndex === String(idx) && <Text style={styles.faqA}>{faq.a}</Text>}
              </View>
            ))}
            {generalFaqs.length > 5 && (
              <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllFaqs(true)}>
                <Text style={styles.showMoreBtnText}>View All FAQs</Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </Section>

          <ReferAndFooter />

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <PublicPillNav activeTab="home" onPressTab={onNavPress} />
        <SearchOverlay
          visible={showSearchOverlay}
          onClose={() => setShowSearchOverlay(false)}
          navigation={navigation}
          city={detectedCity}
        />
        <LiveTrackingModal visible={showTrackingModal} onClose={() => setShowTrackingModal(false)} />

        {showAllReviews ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowAllReviews(false)}>
          <View style={styles.reviewModalOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowAllReviews(false)} />
            <View style={styles.reviewModalSheet}>
              <View style={styles.reviewModalHandle} />
              <Text style={styles.reviewModalTitle}>All Reviews</Text>
              <ScrollView
                showsVerticalScrollIndicator
                style={[styles.reviewModalScroll, { maxHeight: REVIEW_MODAL_SCROLL_MAX_HEIGHT }]}
                contentContainerStyle={styles.reviewModalScrollContent}
                nestedScrollEnabled
                bounces
              >
                {reviews.map((review) => (
                  <View key={`${review.name}-${review.date}`} style={styles.reviewModalCard}>
                    <View style={styles.reviewStars}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Ionicons key={i} name={i < review.stars ? 'star' : 'star-outline'} size={14} color="#F59E0B" />
                      ))}
                    </View>
                    <Text style={styles.reviewText}>"{review.text}"</Text>
                    <View style={styles.reviewAuthor}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewAvatarText}>{review.name[0]}</Text>
                      </View>
                      <View>
                        <Text style={styles.reviewName}>{review.name}</Text>
                        <Text style={styles.reviewCar}>
                        {review.car ? `${review.car} • ${review.date}` : review.date}
                      </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
        ) : null}

        {showAllFaqs ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowAllFaqs(false)}>
          <TouchableOpacity style={styles.faqModalOverlay} activeOpacity={1} onPress={() => setShowAllFaqs(false)}>
            <TouchableOpacity style={styles.faqModalSheet} activeOpacity={1} onPress={() => undefined}>
              <View style={styles.faqModalHeaderRow}>
                <Text style={styles.faqModalTitle}>All FAQs</Text>
                <TouchableOpacity onPress={() => setShowAllFaqs(false)} style={styles.faqModalCloseBtn}>
                  <Ionicons name="close" size={22} color="#374151" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.faqModalScroll}>
                {generalFaqs.map((faq, idx) => (
                  <View key={faq.q} style={styles.faqCard}>
                    <TouchableOpacity
                      style={styles.faqHeader}
                      onPress={() => setOpenFaqIndex((prev) => (prev === `modal-${idx}` ? null : `modal-${idx}`))}
                    >
                      <Text style={styles.faqQ}>{faq.q}</Text>
                      <Ionicons name={openFaqIndex === `modal-${idx}` ? 'chevron-up' : 'chevron-forward'} size={18} color="#6B7280" />
                    </TouchableOpacity>
                    {openFaqIndex === `modal-${idx}` && <Text style={styles.faqA}>{faq.a}</Text>}
                  </View>
                ))}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
        ) : null}

        <WelcomeBonusGuestModal
          visible={guestWelcomeVisible}
          onClose={() => setGuestWelcomeVisible(false)}
          onLogin={() => {
            setGuestWelcomeVisible(false);
            navigation.navigate('Login');
          }}
        />

        <WelcomeBonusCreditedModal
          visible={creditedWelcomeVisible}
          amount={creditedWelcomeAmount}
          onClose={async () => {
            setCreditedWelcomeVisible(false);
            const customerId = pendingWelcomeCustomerIdRef.current;
            const phone = pendingWelcomePhoneRef.current;
            if (customerId || phone) {
              await markWelcomeCreditedPopupShown(customerId || '', phone);
              pendingWelcomeCustomerIdRef.current = null;
              pendingWelcomePhoneRef.current = null;
            }
          }}
        />

        <DynamicPopupManager
          screen="HOME"
          paused={guestWelcomeVisible || creditedWelcomeVisible}
        />

      </View>
    </SafeAreaView>
  );
}

function Section({ children, tight = false }: { children: React.ReactNode; tight?: boolean }) {
  return <View style={[styles.section, tight ? styles.sectionTight : null]}>{children}</View>;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    position: 'relative',
  },
  homeScroll: {
    flex: 1,
    zIndex: 0,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 132,
  },
  membershipOfferWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTight: {
    paddingVertical: 2,
  },
  rsaHeading: {
    marginBottom: 8,
  },
  loginBanner: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  loginBannerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  loginBannerText: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.84)',
    fontSize: 12,
  },
  loginBannerButton: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  loginBannerButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  heroHeadline: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 32,
  },
  heroHeadlineBlue: {
    color: COLORS.primary,
  },
  heroSubLine: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  heroCard: {
    marginTop: 12,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  heroTouchable: {
    width: '100%',
    aspectRatio: 16 / 8,
  },
  heroFullImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  heroCta: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  heroCtaText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
  },
  heroDots: {
    flexDirection: 'row',
    gap: 6,
    position: 'absolute',
    right: 16,
    bottom: 12,
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  heroDotActive: {
    width: 18,
    backgroundColor: '#FFFFFF',
  },
  liveCard: {
    backgroundColor: '#0052CC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.4)',
    shadowColor: 'rgba(239,68,68,0.2)',
    shadowOpacity: 1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  liveCardDisabled: {
    backgroundColor: '#94A3B8',
    borderColor: 'rgba(148,163,184,0.6)',
    shadowColor: 'rgba(148,163,184,0.25)',
  },
  liveBadge: {
    position: 'absolute',
    right: 14,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EF4444',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveBadgeDisabled: {
    position: 'absolute',
    right: 14,
    top: 10,
    backgroundColor: 'rgba(15,23,42,0.35)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  livePing: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  liveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  liveTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  liveAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveActionDisabled: {
    opacity: 0.65,
  },
  liveActionText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  liveDisabledText: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '600',
  },
  serviceGrid: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(59,130,246,0.1)',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  serviceTile: {
    width: '33.33%',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(59,130,246,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 8,
  },
  serviceIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  serviceIconImage: {
    width: 36,
    height: 36,
  },
  serviceLabel: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  locatorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: 'rgba(59,130,246,0.15)',
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  locatorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locatorIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locatorTitle: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locatorSubTitle: {
    marginTop: 2,
    fontSize: 10,
    color: '#6B7280',
  },
  howSubLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    textAlign: 'center',
    marginBottom: 16,
  },
  howCardWrap: {
    height: 200,
    borderRadius: 32,
    overflow: 'hidden',
  },
  howAnimCard: {
    flex: 1,
    borderRadius: 32,
    padding: 32,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  howAnimTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  howAnimStep: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  howAnimIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  howAnimTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 26,
  },
  howAnimDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    paddingRight: 32,
  },
  howBlurCircle: {
    position: 'absolute',
    bottom: -48,
    right: -48,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  howDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
  howDotTrack: {
    width: 32,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  howDotFill: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
    backgroundColor: 'transparent',
  },
  howDotFillActive: {
    backgroundColor: '#004AAD',
  },
  uspRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  uspItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  uspIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  uspValue: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '800',
    marginBottom: 1,
    textAlign: 'center',
  },
  uspLabel: {
    fontSize: 7.5,
    color: '#9CA3AF',
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 10,
  },
  loanCard: {
    borderRadius: 0,
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  loanBannerImage: {
    width: '100%',
    aspectRatio: 1029 / 376,
  },
  loanDots: {
    flexDirection: 'row',
    gap: 6,
    position: 'absolute',
    right: 12,
    bottom: 10,
  },
  loanSubLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  loanHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  loanBullet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  loanBulletText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '700',
  },
  loanButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  loanButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  horizontalRow: {
    gap: 16,
    paddingRight: 16,
  },
  brandCard: {
    width: 104,
    height: 94,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  brandLogoWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCardTitle: {
    marginTop: 6,
    fontSize: 9,
    color: '#4B5563',
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  brandCarouselClip: {
    overflow: 'hidden',
  },
  brandCarouselRow: {
    flexDirection: 'row',
    gap: 16,
  },
  brandCardSmall: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  brandLogoLarge: {
    width: 60,
    height: 36,
  },
  brandLogoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoPlaceholderText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  rsaCard: {
    borderRadius: 32,
    padding: 24,
    shadowColor: '#DC2626',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  rsaServiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  rsaServiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rsaServiceName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  rsaServiceDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 2,
  },
  rsaEmergencyBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
  },
  rsaEmergencyBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reviewBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  reviewCard: {
    width: 280,
    borderRadius: 32,
    padding: 24,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 16,
  },
  reviewText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: 24,
  },
  reviewAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  reviewName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  reviewCar: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 1,
  },
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  reviewModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '80%',
    paddingBottom: 32,
  },
  reviewModalHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  reviewModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  reviewModalScroll: {
    paddingHorizontal: 20,
  },
  reviewModalScrollContent: {
    paddingBottom: 16,
  },
  reviewModalCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 14,
  },
  blogReadMore: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  blogCard: {
    width: 260,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  blogImage: {
    height: 128,
    backgroundColor: '#DBEAFE',
  },
  blogTextWrap: {
    padding: 16,
  },
  blogTitle: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
    lineHeight: 18,
  },
  blogExcerpt: {
    marginTop: 4,
    fontSize: 10,
    color: '#6B7280',
    lineHeight: 16,
  },
  blogDate: {
    marginTop: 8,
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  faqCard: {
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 8,
    overflow: 'hidden',
  },
  faqHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  faqQ: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '700',
  },
  faqA: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 20,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 0,
    paddingVertical: 6,
  },
  showMoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  faqModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  faqModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '80%',
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  faqModalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 12,
  },
  faqModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  faqModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqModalScroll: {
    paddingHorizontal: 0,
  },
  packageCard: {
    width: 240,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  packageImagePlaceholder: {
    height: 128,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageContent: {
    padding: 16,
  },
  packageName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  packageDesc: {
    fontSize: 10,
    color: '#6B7280',
    lineHeight: 14,
    marginBottom: 12,
  },
  packageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packageStartsFrom: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  packageVariant: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 2,
  },
  packagePrice: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '800',
    color: '#004AAD',
  },
  packageBookBtn: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  packageBookBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 24,
  },
});
