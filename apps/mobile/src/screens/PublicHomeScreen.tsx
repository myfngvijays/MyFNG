import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageBackground,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicBottomNav';
import PublicHeader from '../components/PublicHeader';
import LiveTrackingModal from '../components/LiveTrackingModal';
import SearchOverlay from '../components/SearchOverlay';
import ReferAndFooter from '../components/ReferAndFooter';
import { COLORS } from '../constants/theme';
import {
  BLOGS as BLOG_ITEMS,
  POPULAR_PACKAGES as PACKAGE_ITEMS,
  SPARE_PART_BRANDS,
  type PublicBrand,
} from '../constants/publicAppData';
import { getCustomerSessionToken } from '../lib/customerSession';
import { ENV } from '../config/environment';

type Props = {
  navigation: any;
};

type HeroBanner = {
  id: string;
  title: string;
  desc: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: [string, string];
  image: string;
  overlay: string;
};

const HERO_BANNERS: HeroBanner[] = [
  {
    id: 'service',
    title: 'Car Service',
    desc: 'Expert maintenance for your car',
    route: 'PublicBookServiceNow',
    icon: 'construct',
    colors: ['#004AAD', '#0A57BF'],
    image:
      'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/Mobile%20Screen%20-%20Hero%20Section/CarService.png',
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
      'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/Mobile%20Screen%20-%20Hero%20Section/RSA.png',
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
      'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/Mobile%20Screen%20-%20Hero%20Section/MyFNG-AI.png',
    overlay: 'rgba(30, 58, 138, 0.45)',
  },
];

const SUPABASE_STORAGE = 'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App';
const PROMO_BANNERS = [
  `${SUPABASE_STORAGE}/Mobile%20Screen%20-%20Home%20Page%20-%20Other%20Cards/My%20FNG%20-%20Banner%20-%20Get%20A%20Loan%20Against%20Car.png`,
  `${SUPABASE_STORAGE}/Mobile%20Screen%20-%20Home%20Page%20-%20Other%20Cards/My%20FNG%20-%20Banner%20-%20Check%20Your%20Cars%20E-Challan.png`,
  `${SUPABASE_STORAGE}/Mobile%20Screen%20-%20Home%20Page%20-%20Other%20Cards/My%20FNG%20-%20Banner%20-%20Get%20Nearest%20Fuel%20Station.png`,
  `${SUPABASE_STORAGE}/Mobile%20Screen%20-%20Home%20Page%20-%20Other%20Cards/My%20FNG%20-%20Banner%20-%20Sell%20Your%20Car%20Stress%20Free.png`,
];

const DENTING_ICON = require('../../assets/service-icons/denting-painting.png');
const TYRE_ICON = require('../../assets/service-icons/tyre-wheels.png');

type ServiceItem = {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  image?: any;
  color: string;
  bg: string;
};

const SERVICES: ServiceItem[] = [
  { id: '1', label: 'Periodic Service', icon: 'construct-outline', color: '#2563EB', bg: '#EFF6FF' },
  { id: '4', label: 'Engine Services', icon: 'speedometer-outline', color: '#EA580C', bg: '#FFF7ED' },
  { id: '8', label: 'Detailing Service', icon: 'car-sport-outline', color: '#EC4899', bg: '#FDF2F8' },
  { id: '9', label: 'Denting & Painting', image: DENTING_ICON, color: '#059669', bg: '#ECFDF5' },
  { id: '7', label: 'Tyre & Wheels', image: TYRE_ICON, color: '#525252', bg: '#F5F5F5' },
  { id: 'all', label: 'View All', icon: 'arrow-forward', color: COLORS.primary, bg: '#F3F4F6' },
];

const HOW_IT_WORKS = [
  { id: '01', title: 'Book Your Repair with AI', desc: 'Describe your car issues to our AI assistant for an instant quote and booking.', color: '#2563EB', icon: 'sparkles' as const },
  { id: '02', title: 'Track Live Updates', desc: 'Get real-time status of your car repair with photos and videos from the workshop.', color: '#7C3AED', icon: 'pulse' as const },
  { id: '03', title: 'Home Pickup', desc: 'Our professional driver picks up your car from your doorstep at your preferred time.', color: '#10B981', icon: 'home' as const },
  { id: '04', title: 'QC Approved', desc: 'Every repair undergoes a 25-point quality check before we clear it for delivery.', color: '#FBBF24', icon: 'shield-checkmark' as const },
  { id: '05', title: 'Delivered + Warranty', desc: 'Safe delivery to your home with a 6-month warranty on all spare parts and labor.', color: '#F43F5E', icon: 'trophy' as const },
];

const FAQS = [
  { q: 'How do I book a service?', a: 'You can book via our AI assistant or the traditional booking flow in just 60 seconds.' },
  { q: 'Are parts genuine?', a: 'Yes, we use 100% OEM/OES genuine spare parts.' },
  { q: 'What is RSA?', a: 'Roadside Assistance provides emergency help like jumpstarts and towing 24/7.' },
  { q: 'How long does a service take?', a: 'A basic service takes 4-5 hours, while comprehensive ones might take 24-48 hours.' },
  { q: 'Do you offer warranty?', a: 'Yes, we offer up to 1000km or 1 month warranty on services.' },
  { q: 'Can I track my service?', a: 'Yes, you get live photo and video updates during the service.' },
  { q: 'Is pickup and drop free?', a: 'Yes, we offer free pickup and drop within a 10km radius.' },
  { q: 'What car brands do you service?', a: 'We service all major brands including Maruti, Hyundai, Tata, Honda, etc.' },
  { q: 'How do I pay?', a: 'You can pay online via UPI, Cards, or Cash on Delivery.' },
  { q: "What if I'm not satisfied?", a: 'We have a 100% satisfaction guarantee. Contact our support for any issues.' },
];
const DEFAULT_FAQ_COUNT = 5;

const REVIEWS = [
  { name: 'Rahul Sharma', car: 'Hyundai Creta', stars: 5, text: 'Excellent service! My Creta feels brand new after the comprehensive service. The live tracking was amazing.', date: 'Oct 2024' },
  { name: 'Priya Patel', car: 'Maruti Swift', stars: 5, text: 'Very transparent process. Got photo updates during the service. Pickup and drop was super convenient.', date: 'Nov 2024' },
  { name: 'Amit Verma', car: 'Honda City', stars: 4, text: 'Quick booking through AI chatbot. Quality parts used. Will definitely use again for my City.', date: 'Dec 2024' },
];

const HEADLINES = [
  { prefix: 'Book Your Car Service in 60 Seconds - ', highlight: 'Powered by AI', suffix: '' },
  { prefix: "India's ", highlight: '#1 AI-Powered', suffix: ' Car Service Booking Platform' },
  { prefix: 'Book Reliable Car Service ', highlight: 'Anytime, Anywhere', suffix: '' },
];

export default function PublicHomeScreen({ navigation }: Props) {
  const [heroIndex, setHeroIndex] = useState(0);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [loanIndex, setLoanIndex] = useState(0);
  const [howIndex, setHowIndex] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasActiveBooking] = useState(false);
  const [carBrands, setCarBrands] = useState<PublicBrand[]>([]);
  const [liveBlogs, setLiveBlogs] = useState<Array<{ id: string; title: string; excerpt: string; date: string; image: string; slug: string }>>([]);
  const brandScrollX = useRef(new Animated.Value(0)).current;
  const brandAnimRef = useRef<Animated.CompositeAnimation | null>(null);

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
      (async () => {
        const token = await getCustomerSessionToken();
        if (active) setIsLoggedIn(Boolean(token));
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${ENV.API_URL}/api/super_admin/car-brands?active_only=true`);
        if (res.ok) {
          const json = await res.json();
          const brands: PublicBrand[] = (json.data || []).map((b: any) => ({
            name: b.name,
            logo: b.logo_url || '',
          }));
          if (brands.length > 0) setCarBrands(brands);
        }
      } catch {}
    })();
    (async () => {
      try {
        const res = await fetch(`${ENV.API_URL}/api/blogs/public?limit=5`);
        if (res.ok) {
          const json = await res.json();
          const blogs = (json.blogs || []).map((b: any) => ({
            id: b.id,
            title: b.title || '',
            excerpt: b.excerpt || '',
            date: b.published_at ? new Date(b.published_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
            image: b.featured_image || '',
            slug: b.slug || '',
          }));
          if (blogs.length > 0) setLiveBlogs(blogs);
        }
      } catch {}
    })();
  }, []);

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
    const timer = setInterval(() => {
      Animated.timing(heroFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setHeroIndex((prev) => (prev + 1) % HERO_BANNERS.length);
        Animated.timing(heroFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [heroFade]);

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
        setLoanIndex((prev) => (prev + 1) % PROMO_BANNERS.length);
        Animated.timing(loanFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [loanFade]);

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

  const activeHero = useMemo(() => HERO_BANNERS[heroIndex], [heroIndex]);

  const onNavPress = (tab: PublicPillNavTab) => {
    if (tab === 'home') return;
    if (tab === 'services') navigation.navigate('PublicServicePackages', { city: 'Mumbai' });
    if (tab === 'ai') navigation.navigate('AIBooking', { city: 'Mumbai' });
    if (tab === 'roadside') navigation.navigate('RoadsideAssistance', { city: 'Mumbai' });
    if (tab === 'account') navigation.navigate('Settings');
  };

  // Search navigation is now handled inside SearchOverlay directly

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <PublicHeader
          city="Mumbai, Maharashtra"
          isLoggedIn={isLoggedIn}
          userName={isLoggedIn ? 'MyFNG User' : null}
          onPressSearch={() => setShowSearchOverlay(true)}
          onPressSettings={() => navigation.navigate('Settings')}
          onPressViewNotifications={() => navigation.navigate('Settings', { initialSubPage: 'Notifications' })}
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {!isLoggedIn ? (
            <View style={[styles.loginBanner, { backgroundColor: '#004AAD' }]}>
              <View>
                <Text style={styles.loginBannerTitle}>Unlock Premium Benefits</Text>
                <Text style={styles.loginBannerText}>
                  Login to track services, earn rewards and manage your garage.
                </Text>
              </View>
              <TouchableOpacity style={styles.loginBannerButton} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginBannerButtonText}>Login Now</Text>
              </TouchableOpacity>
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
                onPress={() => navigation.navigate(activeHero.route as never)}
                style={styles.heroTouchable}
              >
                <Image source={{ uri: activeHero.image }} style={styles.heroFullImage} resizeMode="cover" />
              </TouchableOpacity>
              <View style={styles.heroDots}>
                {HERO_BANNERS.map((banner, idx) => (
                  <View key={banner.id} style={[styles.heroDot, idx === heroIndex ? styles.heroDotActive : null]} />
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
            <SectionTitle title="Our Services" />
            <View style={styles.serviceGrid}>
              {SERVICES.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={styles.serviceTile}
                  onPress={() =>
                    navigation.navigate('PublicServicePackages', {
                      city: 'Mumbai',
                      selectedServiceId: service.id === 'all' ? null : service.id,
                    })
                  }
                >
                  <View style={[styles.serviceIconWrap, { backgroundColor: service.bg }]}>
                    {service.image ? (
                      <Image source={service.image} style={styles.serviceIconImage} resizeMode="contain" />
                    ) : service.icon ? (
                      <Ionicons name={service.icon} size={20} color={service.color} />
                    ) : null}
                  </View>
                  <Text style={styles.serviceLabel}>{service.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          <Section>
            <TouchableOpacity
              style={styles.locatorCard}
              onPress={() => navigation.navigate('PublicWorkshopLocator', { city: 'Mumbai' })}
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
            <SectionTitle title="How It Works" />
            <Text style={styles.howSubLabel}>Scroll to see the steps</Text>
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
            <SectionTitle title="Why MyFNG" />
            <View style={styles.uspRow}>
              {([
                ['4.8/5', 'RATING', 'star' as const],
                ['17K+', 'CARS', 'trophy' as const],
                ['100+', 'WORKSHOPS', 'construct' as const],
                ['Warranty', 'PARTS', 'shield-checkmark' as const],
                ['Live', 'UPDATES', 'eye' as const],
              ] as const).map(([value, label, icon]) => (
                <View key={label} style={styles.uspItem}>
                  <View style={styles.uspIconWrap}>
                    <Ionicons name={icon} size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.uspValue}>{value}</Text>
                  <Text style={styles.uspLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </Section>

          <Section>
            <SectionTitle title="Complete Transparency" />
            <View style={styles.gridTwo}>
              {([
                ['Photo/Video Updates', 'Live service tracking', 'eye' as const],
                ['Clear Estimates', 'No hidden costs', 'document-text' as const],
                ['Genuine Parts', '100% quality spares', 'wallet' as const],
                ['Central Support', '24/7 assistance', 'call' as const],
              ] as const).map(([title, subtitle, icon]) => (
                <View key={title} style={styles.transparencyCard}>
                  <View style={styles.transparencyIconWrap}>
                    <Ionicons name={icon} size={26} color="#2563EB" />
                  </View>
                  <Text style={styles.transparencyTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    {title}
                  </Text>
                  <Text style={styles.transparencySubtitle}>{subtitle}</Text>
                </View>
              ))}
            </View>
          </Section>

          <Section>
            <Animated.View style={[styles.loanCard, { opacity: loanFade }]}>
              <Image
                source={{ uri: PROMO_BANNERS[loanIndex % PROMO_BANNERS.length] }}
                style={styles.loanBannerImage}
                resizeMode="cover"
              />
              <View style={styles.loanDots}>
                {PROMO_BANNERS.map((_, idx) => (
                  <View key={idx} style={[styles.heroDot, idx === loanIndex % PROMO_BANNERS.length ? styles.heroDotActive : null]} />
                ))}
              </View>
            </Animated.View>
          </Section>

          <Section>
            <SectionTitle title="Original Spare Parts" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
              {SPARE_PART_BRANDS.map((brand) => (
                <View key={brand.name} style={styles.brandCard}>
                  <View style={styles.brandLogoWrap}>
                    {brand.logo ? (
                      <Image source={{ uri: brand.logo }} style={styles.brandLogo} resizeMode="contain" />
                    ) : (
                      <View style={styles.brandLogoPlaceholder}>
                        <Text style={styles.brandLogoPlaceholderText}>{brand.name[0]}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.brandCardTitle} numberOfLines={1}>
                    {brand.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </Section>

          <Section>
            <SectionTitle title="Popular Packages" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
              {PACKAGE_ITEMS.map((pkg) => (
                <View key={pkg.id} style={styles.packageCard}>
                  <Image source={{ uri: pkg.image }} style={styles.packageImagePlaceholder} resizeMode="cover" />
                  <View style={styles.packageContent}>
                    <Text style={styles.packageName}>{pkg.name}</Text>
                    <Text style={styles.packageDesc}>{pkg.desc}</Text>
                    <View style={styles.packageFooter}>
                      <Text style={styles.packagePrice}>₹{pkg.price.toLocaleString()}</Text>
                      <TouchableOpacity
                        style={styles.packageBookBtn}
                        onPress={() => navigation.navigate('PublicBookServiceNow', { city: 'Mumbai', packageId: pkg.id })}
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
            <View style={[styles.rsaCard, { backgroundColor: '#DC2626' }]}>
              <Text style={styles.rsaTitle}>Roadside Assistance</Text>
              <Text style={styles.rsaSubtitle}>Quick on-road solutions for every car emergency.</Text>
              {[
                { name: 'Battery Jumpstart', desc: 'Instant battery start at your location.', icon: 'flash' as const, bg: '#F97316' },
                { name: 'Car Towing Services', desc: 'Safe towing to nearest workshop.', icon: 'car-sport' as const, bg: '#3B82F6' },
              ].map((svc) => (
                <TouchableOpacity
                  key={svc.name}
                  style={styles.rsaServiceCard}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('RoadsideAssistance', { city: 'Mumbai' })}
                >
                  <View style={[styles.rsaServiceIcon, { backgroundColor: svc.bg }]}>
                    <Ionicons name={svc.icon} size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rsaServiceName}>{svc.name}</Text>
                    <Text style={styles.rsaServiceDesc}>{svc.desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.rsaEmergencyBtn}
                activeOpacity={0.85}
                onPress={() => Linking.openURL('tel:+919152307030')}
              >
                <Ionicons name="call" size={18} color="#DC2626" />
                <Text style={styles.rsaEmergencyBtnText}>Call Emergency Helpline</Text>
              </TouchableOpacity>
            </View>
          </Section>

          <Section>
            <SectionTitle title="Brands We Service" />
            <View style={styles.brandCarouselClip}>
              <Animated.View style={[styles.brandCarouselRow, { transform: [{ translateX: brandScrollX }] }]}>
                {carBrands.map((brand) => (
                  <View key={brand.name} style={styles.brandCardSmall}>
                    {brand.logo ? (
                      <Image source={{ uri: brand.logo }} style={styles.brandLogoLarge} resizeMode="contain" />
                    ) : (
                      <View style={styles.brandLogoPlaceholder}>
                        <Text style={styles.brandLogoPlaceholderText}>{brand.name[0]}</Text>
                      </View>
                    )}
                    <Text style={styles.brandCardTitle}>{brand.name}</Text>
                  </View>
                ))}
              </Animated.View>
            </View>
          </Section>

          <Section>
            <View style={[styles.trustCard, { backgroundColor: '#2563EB' }]}>
              <View style={styles.trustGrid}>
                <View style={[styles.trustItem, styles.trustItemBorderRight]}>
                  <Text style={styles.trustValue}>17K+</Text>
                  <Text style={styles.trustLabel}>Cars Serviced</Text>
                </View>
                <View style={styles.trustItem}>
                  <Text style={styles.trustValue}>4.8</Text>
                  <Text style={styles.trustLabel}>Reviews</Text>
                </View>
                <View style={[styles.trustItem, styles.trustItemBorderRight]}>
                  <Text style={styles.trustValue}>100+</Text>
                  <Text style={styles.trustLabel}>Workshops</Text>
                </View>
                <View style={styles.trustItem}>
                  <Text style={styles.trustValue}>24/7</Text>
                  <Text style={styles.trustLabel}>Support</Text>
                </View>
              </View>
            </View>
          </Section>

          <Section>
            <View style={styles.reviewHeaderRow}>
              <Text style={styles.sectionTitle}>What Our Customers Say</Text>
              <View style={styles.reviewBadge}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.reviewBadgeText}>4.8/5</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
              {REVIEWS.slice(0, 3).map((review) => (
                <View key={review.name} style={styles.reviewCard}>
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
                      <Text style={styles.reviewCar}>{review.car} • {review.date}</Text>
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
            <View style={styles.blogHeaderRow}>
              <Text style={styles.sectionTitle}>Latest from Blog</Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://myfng.in/blog')}>
                <Text style={styles.blogReadMore}>Read More →</Text>
              </TouchableOpacity>
            </View>
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
            <SectionTitle title="FAQs" />
            {FAQS.slice(0, DEFAULT_FAQ_COUNT).map((faq, idx) => (
              <View key={faq.q} style={styles.faqCard}>
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => setOpenFaqIndex((prev) => (prev === idx ? null : idx))}
                >
                  <Text style={styles.faqQ}>{faq.q}</Text>
                  <Ionicons name={openFaqIndex === idx ? 'chevron-up' : 'chevron-forward'} size={18} color="#6B7280" />
                </TouchableOpacity>
                {openFaqIndex === idx ? <Text style={styles.faqA}>{faq.a}</Text> : null}
              </View>
            ))}
            {FAQS.length > DEFAULT_FAQ_COUNT && (
              <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllFaqs(true)}>
                <Text style={styles.showMoreBtnText}>Show More FAQs</Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </Section>

          <ReferAndFooter />

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <PublicPillNav activeTab="home" onPressTab={onNavPress} />
        <SearchOverlay visible={showSearchOverlay} onClose={() => setShowSearchOverlay(false)} navigation={navigation} />
        <LiveTrackingModal visible={showTrackingModal} onClose={() => setShowTrackingModal(false)} />

        <Modal visible={showAllReviews} transparent animationType="slide" onRequestClose={() => setShowAllReviews(false)}>
          <TouchableOpacity style={styles.reviewModalOverlay} activeOpacity={1} onPress={() => setShowAllReviews(false)}>
            <TouchableOpacity style={styles.reviewModalSheet} activeOpacity={1} onPress={() => undefined}>
              <View style={styles.reviewModalHandle} />
              <Text style={styles.reviewModalTitle}>All Reviews</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.reviewModalScroll}>
                {REVIEWS.map((review) => (
                  <View key={review.name} style={styles.reviewModalCard}>
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
                        <Text style={styles.reviewCar}>{review.car} • {review.date}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <Modal visible={showAllFaqs} transparent animationType="slide" onRequestClose={() => setShowAllFaqs(false)}>
          <TouchableOpacity style={styles.reviewModalOverlay} activeOpacity={1} onPress={() => setShowAllFaqs(false)}>
            <TouchableOpacity style={styles.reviewModalSheet} activeOpacity={1} onPress={() => undefined}>
              <View style={styles.reviewModalHandle} />
              <Text style={styles.reviewModalTitle}>All FAQs</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.reviewModalScroll}>
                {FAQS.map((faq, idx) => (
                  <View key={faq.q} style={styles.faqCard}>
                    <TouchableOpacity
                      style={styles.faqHeader}
                      onPress={() => setOpenFaqIndex((prev) => (prev === idx + 100 ? null : idx + 100))}
                    >
                      <Text style={styles.faqQ}>{faq.q}</Text>
                      <Ionicons name={openFaqIndex === idx + 100 ? 'chevron-up' : 'chevron-forward'} size={18} color="#6B7280" />
                    </TouchableOpacity>
                    {openFaqIndex === idx + 100 ? <Text style={styles.faqA}>{faq.a}</Text> : null}
                  </View>
                ))}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 132,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(59,130,246,0.2)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 36,
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
    borderRadius: 20,
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
    borderRadius: 20,
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
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  uspItem: {
    alignItems: 'center',
    flex: 1,
  },
  uspIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uspValue: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '800',
    marginBottom: 2,
  },
  uspLabel: {
    fontSize: 8.5,
    color: '#9CA3AF',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  gridTwo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'space-between',
  },
  transparencyCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 22,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  transparencyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  transparencyTitle: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 5,
  },
  transparencySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
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
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  brandLogoWrap: {
    width: '100%',
    height: 46,
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
    width: '92%',
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
  rsaTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  rsaSubtitle: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.84)',
    fontSize: 12,
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
  trustCard: {
    borderRadius: 32,
    padding: 32,
    shadowColor: '#2563EB',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 32,
  },
  trustItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  trustItemBorderRight: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.15)',
  },
  trustValue: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
  },
  trustLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  reviewModalCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 14,
  },
  blogHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 12,
    overflow: 'hidden',
  },
  faqHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    marginTop: 4,
    paddingVertical: 10,
  },
  showMoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
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
  packagePrice: {
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
