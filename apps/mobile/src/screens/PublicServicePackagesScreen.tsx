import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { FAQ_CATEGORIES } from '../constants/publicAppData';
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicBottomNav';
import ReferAndFooter from '../components/ReferAndFooter';
import { openPhoneCall, openEmail } from '../lib/phone';
import { supabase } from '../lib/supabase';

type Props = {
  navigation: any;
  route: any;
};

type ServiceCategory = {
  id: string;
  name: string;
  detailTitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  image?: any;
  color: string;
  bg: string;
  desc: string;
  longDesc: string;
  duration: string;
  warranty: string;
  points: string[];
};

type PromoBanner = { image_url: string; route_name: string; route_params: any };

const SUPABASE_STORAGE = 'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App';
// Fallback list — overridden by admin-managed `home_promo_banners` table
// (Super Admin → Website Images → Promo Banners).
const FALLBACK_SERVICE_PAGE_PROMO_BANNERS: PromoBanner[] = [
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

const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: '1',
    name: 'Periodic Service',
    detailTitle: 'Periodic Car Service',
    icon: 'construct',
    color: '#2563EB',
    bg: '#EFF6FF',
    desc: 'Standardised periodic maintenance to keep your car smooth, safe, and fuel-efficient.',
    longDesc:
      'Keep your car running smooth, safe, and fuel-efficient with MyFNG Periodic Car Service. We follow a standardised service process to inspect, clean, and maintain all critical components.',
    duration: '2-3 hours',
    warranty: '1 month / 1,000 km',
    points: ['Engine Oil Replacement', 'Oil Filter & Air Filter Replacement', 'Complete 60-Point Inspection'],
  },
  {
    id: '2',
    name: 'AC Service',
    detailTitle: 'Car AC Service',
    icon: 'snow',
    color: '#06B6D4',
    bg: '#ECFEFF',
    desc: 'Faster cooling, cleaner air, and reliable AC performance.',
    longDesc:
      'Beat the heat with MyFNG Car AC Service, designed to deliver faster cooling, cleaner air, and consistent performance. We inspect, clean, and optimise your car AC system end-to-end.',
    duration: '2-3 hours',
    warranty: 'NA',
    points: ['AC Gas Top-up / Replacement', 'Cooling Coil & Condenser Cleaning', 'Complete System Sanitization'],
  },
  {
    id: '3',
    name: 'Brakes Service',
    detailTitle: 'Car Brake Service',
    icon: 'warning',
    color: '#EF4444',
    bg: '#FEF2F2',
    desc: 'Responsive braking with inspection, cleaning, and precise adjustments.',
    longDesc:
      'Your car safety depends on its brakes. MyFNG Car Brake Service ensures responsive braking, reduced stopping distance, and complete driving confidence through detailed inspection.',
    duration: '2-3 hours',
    warranty: 'NA',
    points: ['Brake Pad Check & Replacement', 'Brake Fluid Replacement', 'Brake System Safety Test'],
  },
  {
    id: '4',
    name: 'Engine Services',
    detailTitle: 'Car Engine Service',
    icon: 'speedometer',
    color: '#EA580C',
    bg: '#FFF7ED',
    desc: 'Thorough engine inspection, cleaning, and tuning for mileage and long engine life.',
    longDesc:
      'Your car engine is its heart. MyFNG Car Engine Service ensures smooth performance, better mileage, and long engine life by thoroughly inspecting, cleaning, and tuning components.',
    duration: '3-4 hours',
    warranty: 'NA',
    points: ['Complete Engine Diagnostics', 'Engine Oil Service & Replacement', 'Performance Check & Tuning'],
  },
  {
    id: '5',
    name: 'Clutch Service',
    detailTitle: 'Car Clutch Service',
    icon: 'cog',
    color: '#7C3AED',
    bg: '#F5F3FF',
    desc: 'Early clutch wear diagnosis for smooth shifts and longer clutch life.',
    longDesc:
      'A healthy clutch ensures smooth gear shifts and comfortable driving. MyFNG Car Clutch Service diagnoses wear and performance issues early to prevent breakdowns and jerks.',
    duration: '3-6 hours',
    warranty: 'NA',
    points: ['Clutch System Inspection', 'Pressure Plate & Bearing Check', 'Test Drive & Shift Calibration'],
  },
  {
    id: '6',
    name: 'Battery Services',
    detailTitle: 'Car Battery Service',
    icon: 'battery-charging',
    color: '#CA8A04',
    bg: '#FEFCE8',
    desc: 'Battery and charging system health checks for reliable starts.',
    longDesc:
      'Avoid sudden breakdowns with MyFNG Car Battery Service. We test, inspect, and optimise your battery and charging system to ensure consistent power and longer battery life.',
    duration: '1-2 hours',
    warranty: 'NA',
    points: ['Battery Health Check & Analysis', 'Charging System Testing', 'Alternator & Starter Check'],
  },
  {
    id: '7',
    name: 'Tyre and Wheels',
    detailTitle: 'Car Tyre & Wheel Care',
    icon: 'disc-outline',
    color: '#1F2937',
    bg: '#F5F5F5',
    desc: 'Alignment and tyre care for better grip, steering control, and longer tyre life.',
    longDesc:
      'Safe handling and smooth rides start with healthy tyres and aligned wheels. MyFNG Tyre & Wheel Care improves road grip, steering control, and tyre life with precise checks.',
    duration: '1-2 hours',
    warranty: 'NA',
    points: ['Tyre Rotation & Balancing', 'Wheel Alignment (4-Wheel)', 'Tyre Pressure Check & Adjustment'],
  },
  {
    id: '8',
    name: 'Detailing Service',
    detailTitle: 'Car Detailing Service',
    icon: 'car-sport',
    color: '#EC4899',
    bg: '#FDF2F8',
    desc: 'Deep clean and protection for comfort, hygiene, and a showroom-like finish.',
    longDesc:
      'A clean car is about comfort, hygiene, and value. MyFNG Car Detailing Service deep-cleans, restores, and protects your interior and exterior with a standardised process.',
    duration: '4-6 hours',
    warranty: 'NA',
    points: ['Interior Deep Cleaning', 'Exterior Polish & Waxing', 'Ceramic Coating Application'],
  },
  {
    id: '9',
    name: 'Denting & Painting',
    detailTitle: 'Car Denting & Painting',
    icon: 'color-fill',
    color: '#059669',
    bg: '#ECFDF5',
    desc: 'Dent repair and paint matching to restore body strength and resale value.',
    longDesc:
      'Dents and scratches weaken body panels over time. MyFNG Denting & Painting restores body strength and finish using professional dent repair and accurate color matching.',
    duration: '2-5 days',
    warranty: 'Depends on package',
    points: ['Color Matching Technology', 'Dent Removal & Repair', 'Primer & Paint Application'],
  },
];

const SERVICE_ID_TO_FAQ: Record<string, string> = {
  '1': 'Periodic Car Service',
  '2': 'AC Service',
  '3': 'Brake Service',
  '4': 'Car Engine Service',
  '5': 'Clutch Maintenance',
  '6': 'Battery Service',
  '7': 'Tyre Service',
  '8': 'Car Detailing',
  '9': 'Denting & Painting',
};

// Keyword used to filter category pills on the booking screen so users
// only see plans matching the service they chose here.
const SERVICE_ID_TO_CATEGORY_KEYWORD: Record<string, string> = {
  '1': 'PERIODIC',
  '2': 'AC',
  '3': 'BRAKE',
  '4': 'ENGINE',
  '5': 'CLUTCH',
  '6': 'BATTERY',
  '7': 'TYRE',
  '8': 'DETAIL',
  '9': 'DENT',
};
const GENERAL_FAQS = FAQ_CATEGORIES[0].items;
const DEFAULT_FAQ_COUNT = 5;

export default function PublicServicePackagesScreen({ navigation, route }: Props) {
  const city: string | undefined = route?.params?.city;
  const initialServiceId: string | null = route?.params?.selectedServiceId ?? '1';
  const [selectedService, setSelectedService] = useState<string>(initialServiceId || '1');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [promoIdx, setPromoIdx] = useState(0);
  const [promoBanners, setPromoBanners] = useState<PromoBanner[]>(FALLBACK_SERVICE_PAGE_PROMO_BANNERS);
  const [supportOpen, setSupportOpen] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const detailY = useRef(0);
  const supportPhone = '+919167779696';
  const supportEmail = 'support@myfng.in';

  useEffect(() => {
    if (initialServiceId) setSelectedService(initialServiceId);
  }, [initialServiceId]);

  useEffect(() => {
    const timer = setInterval(
      () => setPromoIdx((p) => (p + 1) % Math.max(promoBanners.length, 1)),
      4000,
    );
    return () => clearInterval(timer);
  }, [promoBanners.length]);

  useEffect(() => {
    // Fetch admin-managed promo banners (mirrors PublicHomeScreen).
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('home_promo_banners')
          .select('image_url, route_name, route_params, display_order, is_active')
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: false });

        if (error) return;
        if (!active || !Array.isArray(data) || data.length === 0) return;

        const banners: PromoBanner[] = data
          .filter((row: any) => !!row.image_url)
          .map((row: any) => ({
            image_url: String(row.image_url),
            route_name: String(row.route_name || ''),
            route_params: row.route_params || {},
          }));
        if (active && banners.length > 0) setPromoBanners(banners);
      } catch {
        // ignore — keep fallback list
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const current = useMemo(() => SERVICE_CATEGORIES.find((s) => s.id === selectedService) || SERVICE_CATEGORIES[0], [selectedService]);
  const faqs = useMemo(() => {
    const catTitle = SERVICE_ID_TO_FAQ[selectedService];
    const found = catTitle ? FAQ_CATEGORIES.find((c) => c.title === catTitle) : null;
    return found?.items || GENERAL_FAQS;
  }, [selectedService]);
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.screen}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Our Services</Text>
        </View>

        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          {/* Home page promo banners (admin-managed) */}
          <View style={s.promoWrap}>
            {(() => {
              const currentBanner = promoBanners[promoIdx % Math.max(promoBanners.length, 1)];
              if (!currentBanner) return null;
              const handlePress = () => {
                if (currentBanner.route_name) {
                  navigation.navigate(currentBanner.route_name as never, currentBanner.route_params as never);
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
                    style={s.promoImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              );
            })()}
            <View style={s.promoDots}>
              {promoBanners.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    s.promoDot,
                    idx === promoIdx % Math.max(promoBanners.length, 1) ? s.promoDotActive : null,
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Service Category Grid */}
          <Text style={s.gridHeading}>Select Service Category</Text>
          <View style={s.grid}>
            {SERVICE_CATEGORIES.map((svc) => {
              const active = svc.id === selectedService;
              return (
                <TouchableOpacity
                  key={svc.id}
                  style={s.gridItem}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedService(svc.id);
                    setOpenFaqIdx(null);
                    setTimeout(() => scrollRef.current?.scrollTo({ y: detailY.current, animated: true }), 100);
                  }}
                >
                  <View style={[s.gridIcon, { borderColor: active ? '#2563EB' : '#E5E7EB' }, active ? s.gridIconActive : null]}>
                    {svc.image ? (
                      <Image source={svc.image} style={{ width: 28, height: 28 }} resizeMode="contain" />
                    ) : (
                      <Ionicons name={svc.icon as any} size={22} color={svc.color} />
                    )}
                  </View>
                  <Text style={[s.gridLabel, active ? s.gridLabelActive : s.gridLabelInactive]}>{svc.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* RSA Banner */}
          <TouchableOpacity
            style={s.rsaBanner}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('RoadsideAssistance', { city })}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.rsaBannerTitle}>Roadside Assistance</Text>
              <Text style={s.rsaBannerSub}>Emergency support & towing services</Text>
            </View>
            <View style={s.rsaBannerBadge}>
              <Text style={s.rsaBannerBadgeText}>Get Help</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>

          {/* Selected Service Detail */}
          <View
            style={s.detailCard}
            onLayout={(e) => { detailY.current = e.nativeEvent.layout.y; }}
          >
            <View style={s.detailTop}>
              <View style={[s.detailIcon, { backgroundColor: current.bg }]}>
                <Ionicons name={current.icon as any} size={22} color={current.color} />
              </View>
              <Text style={s.detailTitle}>{current.detailTitle}</Text>
            </View>
            <Text style={s.detailDesc}>{current.longDesc}</Text>
            <View style={s.detailMetaRow}>
              <View style={s.detailMetaChip}>
                <Ionicons name="time-outline" size={13} color="#2563EB" />
                <Text style={s.detailMetaText}>{current.duration}</Text>
              </View>
              <View style={s.detailMetaChip}>
                <Ionicons name="shield-checkmark-outline" size={13} color="#2563EB" />
                <Text style={s.detailMetaText}>{current.warranty}</Text>
              </View>
            </View>
            <View style={s.detailPoints}>
              {current.points.map((point) => (
                <View key={point} style={s.detailPointRow}>
                  <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                  <Text style={s.detailPointText}>{point}</Text>
                </View>
              ))}
            </View>
            <View style={s.detailBtns}>
              <TouchableOpacity
                style={s.bookNowBtn}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate('PublicBookServiceNow', {
                    city,
                    serviceCategory: SERVICE_ID_TO_CATEGORY_KEYWORD[selectedService] || null,
                    serviceCategoryName: current?.name || null,
                  })
                }
              >
                <Text style={s.bookNowBtnText}>Book Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.phoneBtn}
                activeOpacity={0.85}
                onPress={() => openPhoneCall(supportPhone)}
              >
                <Ionicons name="call" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Why MyFNG */}
          <Text style={s.sectionHeading}>Why MyFNG</Text>
          <View style={s.whyCard}>
            {([
              ['4.8/5', 'RATING', 'star' as const],
              ['17K+', 'CARS', 'trophy' as const],
              ['100+', 'WORKSHOPS', 'construct' as const],
              ['Warranty', 'PARTS', 'shield-checkmark' as const],
              ['Live', 'UPDATES', 'eye' as const],
            ] as const).map(([value, label, icon]) => (
              <View key={label} style={s.whyItem}>
                <View style={s.whyIconWrap}>
                  <Ionicons name={icon} size={18} color={COLORS.primary} />
                </View>
                <Text style={s.whyValue}>{value}</Text>
                <Text style={s.whyLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Complete Transparency */}
          <Text style={s.sectionHeading}>Complete Transparency</Text>
          <View style={s.transparencyGrid}>
            {([
              ['Photo/Video Updates', 'Live service tracking', 'eye' as const],
              ['Clear Estimates', 'No hidden costs', 'document-text' as const],
              ['MY FNG Service Guarantee', '100% quality assurance', 'shield-checkmark' as const],
              ['Same-Day Service', 'Quick turnaround time', 'flash' as const],
            ] as const).map(([title, subtitle, icon]) => (
              <View key={title} style={[s.transparencyCard, { width: (Dimensions.get('window').width - 32 - 10) / 2 }]}>
                <View style={s.transparencyIconWrap}>
                  <Ionicons name={icon} size={24} color="#2563EB" />
                </View>
                <Text style={s.transparencyTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{title}</Text>
                <Text style={s.transparencySubtitle}>{subtitle}</Text>
              </View>
            ))}
          </View>

          {/* Service FAQs */}
          <Text style={s.faqHeading}>Service FAQs</Text>
          {faqs.slice(0, 5).map((faq, idx) => (
            <View key={faq.q} style={s.faqCard}>
              <TouchableOpacity
                style={s.faqHeader}
                onPress={() => setOpenFaqIdx((prev) => (prev === idx ? null : idx))}
              >
                <Text style={s.faqQ}>{faq.q}</Text>
                <Ionicons name={openFaqIdx === idx ? 'chevron-up' : 'chevron-forward'} size={18} color="#6B7280" />
              </TouchableOpacity>
              {openFaqIdx === idx ? <Text style={s.faqA}>{faq.a}</Text> : null}
            </View>
          ))}
          {faqs.length > 5 && (
            <TouchableOpacity style={s.showMoreBtn} onPress={() => setShowAllFaqs(true)}>
              <Text style={s.showMoreBtnText}>View All FAQs</Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          )}

          <ReferAndFooter hideRefer />
          <View style={{ height: 24 }} />
        </ScrollView>

        <PublicPillNav
          activeTab="services"
          onPressTab={(tab: PublicPillNavTab) => {
            if (tab === 'home') navigation.navigate('PublicHome');
            if (tab === 'services') return;
            if (tab === 'ai') navigation.navigate('AIBooking', { city, fullScreen: true });
            if (tab === 'roadside') navigation.navigate('RoadsideAssistance', { city });
            if (tab === 'account') navigation.navigate('Settings');
            if (tab === 'profile') navigation.navigate('Settings');
            if (tab === 'settings') setSupportOpen(true);
          }}
        />

        {/* Support Modal */}
        <Modal visible={supportOpen} transparent animationType="fade" onRequestClose={() => setSupportOpen(false)}>
          <Pressable style={s.modalOverlay} onPress={() => setSupportOpen(false)}>
            <Pressable style={s.modalCard} onPress={() => undefined}>
              <Text style={s.modalTitle}>Support</Text>
              <TouchableOpacity style={s.modalRow} onPress={() => navigation.navigate('AIBooking', { city, prefill: 'I need help.' })}>
                <Text style={s.modalRowText}>Chat with AI</Text>
                <Ionicons name="chatbubbles" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={s.modalRow} onPress={() => openPhoneCall(supportPhone)}>
                <Text style={s.modalRowText}>Call Support</Text>
                <Ionicons name="call" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={s.modalRow} onPress={() => openEmail(supportEmail)}>
                <Text style={s.modalRowText}>Email</Text>
                <Ionicons name="mail" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Package Comparison Modal */}
        <Modal visible={showComparison} transparent animationType="fade" onRequestClose={() => setShowComparison(false)}>
          <Pressable style={s.compareOverlay} onPress={() => setShowComparison(false)}>
            <Pressable style={s.compareSheet} onPress={() => undefined}>
              <View style={s.compareHeader}>
                <Text style={s.compareTitle}>Compare Packages</Text>
                <TouchableOpacity style={s.compareClose} onPress={() => setShowComparison(false)}>
                  <Ionicons name="close" size={20} color="#111827" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={s.compareBody}>
                {/* Column Headers */}
                <View style={s.compareRow}>
                  <View style={s.compareLabel} />
                  {(['Basic', 'Standard', 'Comprehensive'] as const).map((n) => (
                    <View key={n} style={s.compareCol}>
                      <Text style={s.compareColName}>{n}</Text>
                      <Text style={s.compareColPrice}>{n === 'Basic' ? '₹1,999' : n === 'Standard' ? '₹2,999' : '₹4,499'}</Text>
                    </View>
                  ))}
                </View>

                {/* Feature Rows */}
                {[
                  { label: 'Engine Oil Change', vals: [true, true, true] },
                  { label: 'Oil Filter Change', vals: [true, true, true] },
                  { label: 'Health Checkup', vals: ['30-Point', '60-Point', '90-Point'] },
                  { label: 'Car Wash & Wax', vals: [true, true, true] },
                  { label: 'Computer Scanning', vals: [false, true, true] },
                  { label: 'Wheel Alignment', vals: [false, false, true] },
                ].map((feat) => (
                  <View key={feat.label} style={s.compareFeatureRow}>
                    <View style={s.compareLabel}>
                      <Text style={s.compareFeatureLabel}>{feat.label}</Text>
                    </View>
                    {feat.vals.map((v, i) => (
                      <View key={i} style={s.compareCol}>
                        {typeof v === 'boolean' ? (
                          <View style={[s.compareDot, { backgroundColor: v ? '#10B981' : '#E5E7EB' }]}>
                            <Ionicons name={v ? 'checkmark' : 'close'} size={12} color={v ? '#FFFFFF' : '#9CA3AF'} />
                          </View>
                        ) : (
                          <Text style={s.compareFeatureText}>{v}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                ))}

                <View style={s.compareNote}>
                  <Text style={s.compareNoteText}>* Prices are indicative and may vary based on car model and engine capacity. Taxes extra as applicable.</Text>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={showAllFaqs} transparent animationType="slide" onRequestClose={() => setShowAllFaqs(false)}>
          <Pressable style={s.faqModalOverlay} onPress={() => setShowAllFaqs(false)}>
            <Pressable style={s.faqModalSheet} onPress={() => undefined}>
              <View style={s.faqModalHeaderRow}>
                <Text style={s.faqModalTitle}>All FAQs</Text>
                <TouchableOpacity onPress={() => setShowAllFaqs(false)} style={s.faqModalCloseBtn}>
                  <Ionicons name="close" size={22} color="#374151" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {faqs.map((faq, idx) => (
                  <View key={faq.q} style={s.faqCard}>
                    <TouchableOpacity
                      style={s.faqHeader}
                      onPress={() => setOpenFaqIdx((prev) => (prev === idx + 100 ? null : idx + 100))}
                    >
                      <Text style={s.faqQ}>{faq.q}</Text>
                      <Ionicons name={openFaqIdx === idx + 100 ? 'chevron-up' : 'chevron-forward'} size={18} color="#6B7280" />
                    </TouchableOpacity>
                    {openFaqIdx === idx + 100 ? <Text style={s.faqA}>{faq.a}</Text> : null}
                  </View>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F7FF' },
  screen: { flex: 1, backgroundColor: '#F0F7FF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#111827' },
  compareBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  compareBtnText: { fontSize: 10, fontWeight: '800', color: '#2563EB', textTransform: 'uppercase', letterSpacing: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 140 },

  promoWrap: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  promoImage: {
    width: '100%',
    aspectRatio: 1029 / 376,
  },
  promoDots: {
    flexDirection: 'row',
    gap: 6,
    position: 'absolute',
    right: 12,
    bottom: 10,
  },
  promoDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  promoDotActive: {
    width: 18,
    backgroundColor: '#FFFFFF',
  },

  gridHeading: { fontSize: 16, fontWeight: '900', color: '#111827', marginTop: 20, marginBottom: 12, paddingHorizontal: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '30.6%', alignItems: 'center' },
  gridIcon: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  gridIconActive: { borderColor: '#2563EB', shadowColor: '#2563EB', shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  gridLabel: { marginTop: 6, fontSize: 10, fontWeight: '800', textAlign: 'center', lineHeight: 13 },
  gridLabelActive: { color: '#111827' },
  gridLabelInactive: { color: '#111827', opacity: 0.5 },

  rsaBanner: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: '#DC2626',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#DC2626',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  rsaBannerTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  rsaBannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 2 },
  rsaBannerBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  rsaBannerBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  detailCard: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  detailTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  detailIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { fontSize: 18, fontWeight: '900', color: '#111827', flex: 1 },
  detailDesc: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginBottom: 10 },
  detailMetaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  detailMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  detailMetaText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },
  detailPoints: { marginBottom: 14, gap: 6 },
  detailPointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailPointText: { flex: 1, fontSize: 11, color: '#374151', lineHeight: 16, fontWeight: '600' },
  detailBtns: { flexDirection: 'row', gap: 10 },
  bookNowBtn: { flex: 1, height: 50, borderRadius: 16, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', shadowColor: '#2563EB', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  bookNowBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  phoneBtn: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },

  sectionHeading: { fontSize: 16, fontWeight: '900', color: '#111827', marginTop: 20, marginBottom: 10, textTransform: 'uppercase' },
  whyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  whyItem: {
    alignItems: 'center',
    flex: 1,
  },
  whyIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  whyValue: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '800',
    marginBottom: 1,
    textAlign: 'center',
  },
  whyLabel: {
    fontSize: 7.5,
    color: '#9CA3AF',
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 10,
  },
  transparencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  transparencyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  transparencyIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  transparencyTitle: {
    fontSize: 11,
    color: '#111827',
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  transparencySubtitle: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 14,
  },

  faqHeading: { fontSize: 16, fontWeight: '900', color: '#111827', marginTop: 20, marginBottom: 8, paddingHorizontal: 2 },
  faqCard: { borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8, overflow: 'hidden' },
  faqHeader: { paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  faqQ: { flex: 1, fontSize: 13, color: '#111827', fontWeight: '700' },
  faqA: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 10, fontSize: 12, color: '#6B7280', lineHeight: 18 },
  showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 2, marginBottom: 8, paddingVertical: 10 },
  showMoreBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', padding: 16 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#111827', marginBottom: 12 },
  faqModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  faqModalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingBottom: 24, paddingHorizontal: 16 },
  faqModalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 12 },
  faqModalTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  faqModalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalRowText: { fontSize: 14, fontWeight: '700', color: '#111827' },

  compareOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  compareSheet: { width: '100%', maxHeight: '80%', backgroundColor: '#FFFFFF', borderRadius: 32, overflow: 'hidden' },
  compareHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  compareTitle: { fontSize: 20, fontWeight: '900', color: '#111827' },
  compareClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  compareBody: { padding: 20 },
  compareRow: { flexDirection: 'row', marginBottom: 16 },
  compareLabel: { flex: 1 },
  compareCol: { flex: 1, alignItems: 'center' },
  compareColName: { fontSize: 10, fontWeight: '900', color: '#2563EB', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  compareColPrice: { fontSize: 12, fontWeight: '800', color: '#111827' },
  compareFeatureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  compareFeatureLabel: { fontSize: 10, fontWeight: '700', color: '#6B7280', lineHeight: 14 },
  compareFeatureText: { fontSize: 10, fontWeight: '800', color: '#374151' },
  compareDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  compareNote: { marginTop: 20, backgroundColor: '#EFF6FF', borderRadius: 16, borderWidth: 1, borderColor: '#DBEAFE', padding: 14 },
  compareNoteText: { fontSize: 10, color: '#2563EB', lineHeight: 16 },
});
