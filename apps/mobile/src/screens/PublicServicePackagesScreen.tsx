import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicBottomNav';
import ReferAndFooter from '../components/ReferAndFooter';

type Props = {
  navigation: any;
  route: any;
};

type ServiceCategory = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  image?: any;
  color: string;
  bg: string;
  desc: string;
};

const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: '1', name: 'Periodic Service', icon: 'construct', color: '#2563EB', bg: '#EFF6FF', desc: 'Complete maintenance check with oil & filter change, brake inspection, and 60-point health check.' },
  { id: '2', name: 'AC Service', icon: 'snow', color: '#06B6D4', bg: '#ECFEFF', desc: 'Gas top-up, filter cleaning, and cooling system check for a chilled cabin.' },
  { id: '3', name: 'Brakes Service', icon: 'warning', color: '#EF4444', bg: '#FEF2F2', desc: 'Brake pad replacement, disc resurfacing, and fluid check for maximum safety.' },
  { id: '4', name: 'Engine Services', icon: 'speedometer', color: '#EA580C', bg: '#FFF7ED', desc: 'Expert engine diagnostics, tuning, and major repairs to ensure peak performance.' },
  { id: '5', name: 'Clutch Service', icon: 'cog', color: '#7C3AED', bg: '#F5F3FF', desc: 'Clutch plate replacement, cable adjustment, and smooth gear shifting support.' },
  { id: '6', name: 'Battery Services', icon: 'battery-charging', color: '#CA8A04', bg: '#FEFCE8', desc: 'Battery testing, terminal cleaning, and instant replacement with top brands.' },
  { id: '7', name: 'Tyre and Wheels', icon: 'radio-button-off', image: require('../../assets/service-icons/tyre-wheels.png'), color: '#525252', bg: '#F5F5F5', desc: 'Wheel alignment, balancing, and tyre rotation for a stable ride.' },
  { id: '8', name: 'Detailing Service', icon: 'car-sport', color: '#EC4899', bg: '#FDF2F8', desc: 'Ceramic coating, interior deep cleaning, and exterior polishing for a showroom shine.' },
  { id: '9', name: 'Denting & Painting', icon: 'color-palette', image: require('../../assets/service-icons/denting-painting.png'), color: '#059669', bg: '#ECFDF5', desc: 'High-quality body work with premium paint matching and dent removal.' },
];

const SERVICE_FAQS: Record<string, Array<{ q: string; a: string }>> = {
  '1': [
    { q: 'How often should I get a periodic service?', a: 'Every 10,000 km or 1 year, whichever comes first.' },
    { q: 'What is included in a 60-point check?', a: 'It covers engine, brakes, suspension, electricals, and more.' },
    { q: 'Do you use genuine oil filters?', a: 'Yes, we only use OEM or OES genuine parts.' },
    { q: 'Is pickup and drop free?', a: 'Yes, we offer free pickup and drop for all periodic services.' },
    { q: 'How long does the service take?', a: 'Typically 4-6 hours depending on the car model.' },
  ],
  default: [
    { q: 'Is there a warranty on services?', a: 'Yes, we provide a 1000km or 1-month warranty on all services.' },
    { q: 'How can I track my service?', a: 'You can track live updates directly in the MyFNG app.' },
    { q: 'Are the technicians certified?', a: 'All our technicians are MyFNG certified with 5+ years experience.' },
    { q: 'What payment methods are accepted?', a: 'We accept all UPI, Cards, and Cash on delivery.' },
    { q: 'Can I cancel my booking?', a: 'Yes, you can cancel up to 2 hours before the scheduled pickup.' },
  ],
};
const DEFAULT_FAQ_COUNT = 5;

const LOAN_CARDS = [
  { title: 'Loan Against Car', color: '#EA580C', btnText: 'GET LOAN', image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=400', points: ['Starting at 11.49%* p.a', 'Flexible Tenures'] },
  { title: 'Car Inspection', color: '#059669', btnText: 'CHECK NOW', image: 'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?auto=format&fit=crop&q=80&w=400', points: ['200+ points check', 'Expert Report'] },
  { title: 'Car Insurance', color: '#2563EB', btnText: 'INSURE NOW', image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=400', points: ['Save up to 80%', 'Renew in 2 mins'] },
];

export default function PublicServicePackagesScreen({ navigation, route }: Props) {
  const city: string | undefined = route?.params?.city;
  const initialServiceId: string | null = route?.params?.selectedServiceId ?? '1';
  const [selectedService, setSelectedService] = useState<string>(initialServiceId || '1');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [loanIdx, setLoanIdx] = useState(0);
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
    const timer = setInterval(() => setLoanIdx((p) => (p + 1) % LOAN_CARDS.length), 4000);
    return () => clearInterval(timer);
  }, []);

  const current = useMemo(() => SERVICE_CATEGORIES.find((s) => s.id === selectedService) || SERVICE_CATEGORIES[0], [selectedService]);
  const faqs = useMemo(() => SERVICE_FAQS[selectedService] || SERVICE_FAQS.default, [selectedService]);
  const loanCard = LOAN_CARDS[loanIdx];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.screen}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Our Services</Text>
          <TouchableOpacity style={s.compareBtn} onPress={() => setShowComparison(true)}>
            <Text style={s.compareBtnText}>Compare</Text>
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          {/* Loan Banner */}
          <View style={s.loanBanner}>
            <View style={{ flex: 1 }}>
              <Text style={s.loanSubLabel}>GET A QUICK</Text>
              <Text style={[s.loanTitle, { color: loanCard.color }]}>{loanCard.title}</Text>
              {loanCard.points.map((p) => (
                <View key={p} style={s.loanBullet}>
                  <Ionicons name="checkmark-circle" size={14} color={loanCard.color} />
                  <Text style={s.loanBulletText}>{p}</Text>
                </View>
              ))}
              <TouchableOpacity style={s.loanBtn}>
                <Text style={s.loanBtnText}>{loanCard.btnText}</Text>
              </TouchableOpacity>
            </View>
            <Image source={{ uri: loanCard.image }} style={s.loanImage} resizeMode="cover" />
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
              <Text style={s.detailTitle}>{current.name}</Text>
            </View>
            <Text style={s.detailDesc}>{current.desc}</Text>
            <View style={s.detailBtns}>
              <TouchableOpacity
                style={s.bookNowBtn}
                onPress={() => navigation.navigate('PublicBookServiceNow', { city })}
              >
                <Text style={s.bookNowBtnText}>Book Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.phoneBtn}
                onPress={() => Linking.openURL(`tel:${supportPhone}`)}
              >
                <Ionicons name="call" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Service FAQs */}
          <Text style={s.faqHeading}>Service FAQs</Text>
          {faqs.slice(0, DEFAULT_FAQ_COUNT).map((faq, idx) => (
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
          {faqs.length > DEFAULT_FAQ_COUNT ? (
            <TouchableOpacity style={s.showMoreBtn} onPress={() => setShowAllFaqs(true)}>
              <Text style={s.showMoreBtnText}>Show More FAQs</Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          ) : null}

          <ReferAndFooter />
          <View style={{ height: 24 }} />
        </ScrollView>

        <PublicPillNav
          activeTab="services"
          onPressTab={(tab: PublicPillNavTab) => {
            if (tab === 'home') navigation.navigate('PublicHome');
            if (tab === 'services') return;
            if (tab === 'ai') navigation.navigate('AIBooking', { city });
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
              <TouchableOpacity style={s.modalRow} onPress={() => Linking.openURL(`tel:${supportPhone}`)}>
                <Text style={s.modalRowText}>Call Support</Text>
                <Ionicons name="call" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={s.modalRow} onPress={() => Linking.openURL(`mailto:${supportEmail}`)}>
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
          <Pressable style={s.modalOverlay} onPress={() => setShowAllFaqs(false)}>
            <Pressable style={s.modalCard} onPress={() => undefined}>
              <Text style={s.modalTitle}>All FAQs</Text>
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

  loanBanner: {
    marginTop: 12,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
    flexDirection: 'row',
    minHeight: 170,
  },
  loanSubLabel: { fontSize: 9, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4, paddingLeft: 16, paddingTop: 16 },
  loanTitle: { fontSize: 20, fontWeight: '900', paddingLeft: 16, marginBottom: 10 },
  loanBullet: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 16, marginBottom: 4 },
  loanBulletText: { fontSize: 11, fontWeight: '700', color: '#374151' },
  loanBtn: { marginLeft: 16, marginTop: 10, marginBottom: 16, alignSelf: 'flex-start', backgroundColor: '#111827', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  loanBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  loanImage: { width: '38%', height: '100%', opacity: 0.8 },

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
  detailDesc: { fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 16 },
  detailBtns: { flexDirection: 'row', gap: 10 },
  bookNowBtn: { flex: 1, height: 50, borderRadius: 16, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', shadowColor: '#2563EB', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  bookNowBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  phoneBtn: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },

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
