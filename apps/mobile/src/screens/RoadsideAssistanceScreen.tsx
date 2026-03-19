import React, { useState, useRef } from 'react';
import {
  Animated,
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
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicBottomNav';
import ReferAndFooter from '../components/ReferAndFooter';

type Props = { navigation: any; route: any };

const RSA_SERVICES = [
  { name: 'Battery Jumpstart', desc: 'Instant battery start at your location.', icon: 'flash' as const, bg: '#F97316' },
  { name: 'Fuel Delivery', desc: 'Emergency petrol/diesel delivery.', icon: 'add-circle' as const, bg: '#EF4444' },
  { name: 'Car Towing Services', desc: 'Safe towing to nearest workshop.', icon: 'car' as const, bg: '#3B82F6' },
  { name: 'Accidental Car Towing', desc: 'Accident vehicle recovery & transport.', icon: 'shield' as const, bg: '#DC2626' },
  { name: 'Roadside Assistance', desc: 'Minor on-road repairs support.', icon: 'construct' as const, bg: '#EA580C' },
  { name: 'Car Tracking Services', desc: 'Live location and tracking support.', icon: 'location' as const, bg: '#EC4899' },
  { name: 'Periodic Car Service', desc: 'Doorstep periodic maintenance booking.', icon: 'time' as const, bg: '#2563EB' },
  { name: 'Flat Tyre Assistance', desc: 'Tyre change or puncture fix instantly.', icon: 'ellipse-outline' as const, bg: '#525252' },
];

const RSA_FAQS = [
  { q: 'How fast is RSA?', a: 'Our average response time is 30-45 minutes depending on your location.' },
  { q: 'Is RSA available 24/7?', a: 'Yes, our emergency team is available round the clock.' },
  { q: "What if my car can't be fixed on spot?", a: 'We provide towing services to the nearest MyFNG certified workshop.' },
  { q: 'Does RSA cover fuel delivery?', a: 'Yes, we provide emergency fuel delivery (fuel cost extra).' },
  { q: 'Is jumpstart safe for my car?', a: 'Yes, our technicians use professional equipment safe for modern car electronics.' },
  { q: 'What areas do you cover?', a: 'We currently cover all major cities and highways across India.' },
  { q: 'How much does RSA cost?', a: 'Pricing varies by service type and location. Towing starts at ₹25/km.' },
  { q: 'Can I track the RSA vehicle?', a: 'Yes, once dispatched you receive real-time tracking of the assistance vehicle.' },
  { q: 'Do I need a membership for RSA?', a: 'No membership required. However, MyFNG Pro and Max members get priority dispatch and discounted rates.' },
  { q: 'What happens after towing?', a: 'Your car is towed to the nearest MyFNG partner workshop where a full inspection is done and you receive a detailed estimate.' },
];

const RSA_REVIEWS = [
  { name: 'Ravi Deshmukh', car: 'Maruti Baleno', stars: 5, text: 'Battery died at midnight on highway. MyFNG sent jumpstart help within 35 mins. Lifesaver!', date: 'Jan 2025' },
  { name: 'Sneha Kapoor', car: 'Hyundai i20', stars: 5, text: 'Flat tyre in heavy rain. The technician was professional and quick. Highly recommend their RSA service.', date: 'Dec 2024' },
  { name: 'Vikram Singh', car: 'Honda City', stars: 4, text: 'Car broke down on expressway. Towing was smooth and the workshop did a great job fixing the issue.', date: 'Feb 2025' },
  { name: 'Ananya Joshi', car: 'Tata Nexon', stars: 5, text: 'Ran out of fuel and panicked. MyFNG delivered diesel within 40 minutes. Amazing service!', date: 'Nov 2024' },
  { name: 'Karan Mehta', car: 'Kia Seltos', stars: 5, text: 'Accident towing service was very careful with my car. No additional scratches. Very professional team.', date: 'Jan 2025' },
];

const DEFAULT_FAQ_COUNT = 5;

export default function RoadsideAssistanceScreen({ navigation, route }: Props) {
  const city: string | undefined = route?.params?.city;
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.screen}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Roadside Assistance</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

          {/* ── RSA Emergency Card (red, matching Home) ── */}
          <View style={s.rsaHeroCard}>
            <Text style={s.rsaHeroTitle}>Roadside Assistance</Text>
            <Text style={s.rsaHeroSub}>Quick on-road solutions for every car emergency.</Text>
            {[
              { name: 'Battery Jumpstart', desc: 'Instant battery start at your location.', icon: 'flash' as const, bg: '#F97316' },
              { name: 'Car Towing Services', desc: 'Safe towing to nearest workshop.', icon: 'car-sport' as const, bg: '#3B82F6' },
            ].map((svc) => (
              <View key={svc.name} style={s.rsaHeroService}>
                <View style={[s.rsaHeroIcon, { backgroundColor: svc.bg }]}>
                  <Ionicons name={svc.icon} size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rsaHeroServiceName}>{svc.name}</Text>
                  <Text style={s.rsaHeroServiceDesc}>{svc.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
              </View>
            ))}
            <TouchableOpacity
              style={s.rsaEmergencyBtn}
              activeOpacity={0.85}
              onPress={() => Linking.openURL('tel:+919152307030')}
            >
              <Ionicons name="call" size={18} color="#DC2626" />
              <Text style={s.rsaEmergencyBtnText}>Call Emergency Helpline</Text>
            </TouchableOpacity>
          </View>

          {/* ── Services Grid (2-column) ── */}
          <View style={s.rsaCard}>
            <Text style={s.rsaTitle}>Our RSA Services</Text>
            <Text style={s.rsaSub}>Tap any service to get instant help.</Text>

            <View style={s.serviceGrid}>
              {RSA_SERVICES.map((svc) => (
                <TouchableOpacity
                  key={svc.name}
                  style={s.serviceItem}
                  activeOpacity={0.8}
                  onPress={() => Linking.openURL('https://wa.me/919152307030?text=Hi%2C+I+need+' + encodeURIComponent(svc.name))}
                >
                  <View style={[s.serviceIcon, { backgroundColor: svc.bg }]}>
                    <Ionicons name={svc.icon} size={20} color="#FFFFFF" />
                  </View>
                  <Text style={s.serviceName} numberOfLines={2}>{svc.name}</Text>
                  <Text style={s.serviceDesc} numberOfLines={2}>{svc.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Pricing Section ── */}
          <Text style={s.pricingHeading}>Pricing</Text>
          <Text style={s.pricingSub}>Clear and affordable pricing. Exact cost depends on location, vehicle type and distance.</Text>

          <View style={s.priceCard}>
            <Text style={s.priceLabel}>TOWING</Text>
            <View style={s.priceRow}>
              <Text style={s.priceValue}>₹25/km</Text>
              <Text style={s.priceSuffix}>onwards</Text>
            </View>
            {['Safe towing with proper equipment', 'Pickup from breakdown spot', 'Drop to nearest service location'].map((t) => (
              <View key={t} style={s.priceBullet}>
                <View style={s.bulletDot}><Ionicons name="star" size={10} color="#22C55E" /></View>
                <Text style={s.priceBulletText}>{t}</Text>
              </View>
            ))}
            <TouchableOpacity style={s.towingBtn} onPress={() => Linking.openURL('tel:+919152307030')}>
              <Text style={s.towingBtnText}>Request Towing</Text>
            </TouchableOpacity>
          </View>

          <View style={s.priceCard}>
            <Text style={s.priceLabel}>RSA SUPPORT</Text>
            <View style={s.priceRow}>
              <Text style={s.priceValue}>On Demand</Text>
              <Text style={s.priceSuffix}>as per service</Text>
            </View>
            {['Jumpstart, puncture, fuel & minor fixes', 'AI-powered emergency dispatch', '24×7 customer support'].map((t) => (
              <View key={t} style={s.priceBullet}>
                <View style={s.bulletDot}><Ionicons name="star" size={10} color="#22C55E" /></View>
                <Text style={s.priceBulletText}>{t}</Text>
              </View>
            ))}
            <TouchableOpacity style={s.whatsappBtn} onPress={() => Linking.openURL('https://wa.me/919152307030')}>
              <Text style={s.whatsappBtnText}>WhatsApp for Quote</Text>
            </TouchableOpacity>
          </View>

          {/* ── Reviews Slider ── */}
          <View style={s.reviewHeaderRow}>
            <Text style={s.sectionTitle}>What Our Customers Say</Text>
            <View style={s.reviewBadge}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={s.reviewBadgeText}>4.8/5</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.reviewScroll}>
            {RSA_REVIEWS.slice(0, 3).map((review) => (
              <View key={review.name} style={s.reviewCard}>
                <View style={s.reviewStars}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Ionicons key={i} name={i < review.stars ? 'star' : 'star-outline'} size={12} color="#F59E0B" />
                  ))}
                </View>
                <Text style={s.reviewText}>"{review.text}"</Text>
                <View style={s.reviewAuthor}>
                  <View style={s.reviewAvatar}>
                    <Text style={s.reviewAvatarText}>{review.name[0]}</Text>
                  </View>
                  <View>
                    <Text style={s.reviewName}>{review.name}</Text>
                    <Text style={s.reviewCar}>{review.car} • {review.date}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={s.showMoreBtn} onPress={() => setShowAllReviews(true)}>
            <Text style={s.showMoreBtnText}>Show More Reviews</Text>
            <Ionicons name="chevron-down" size={16} color="#2563EB" />
          </TouchableOpacity>

          {/* ── FAQs Section ── */}
          <Text style={s.faqHeading}>Frequently Asked Questions</Text>
          {RSA_FAQS.slice(0, DEFAULT_FAQ_COUNT).map((faq, idx) => (
            <View key={faq.q} style={s.faqCard}>
              <TouchableOpacity style={s.faqHeader} onPress={() => setOpenFaqIdx((prev) => (prev === idx ? null : idx))}>
                <Text style={s.faqQ}>{faq.q}</Text>
                <Ionicons name={openFaqIdx === idx ? 'chevron-up' : 'chevron-forward'} size={18} color="#6B7280" />
              </TouchableOpacity>
              {openFaqIdx === idx && <Text style={s.faqA}>{faq.a}</Text>}
            </View>
          ))}
          {RSA_FAQS.length > DEFAULT_FAQ_COUNT && (
            <TouchableOpacity style={s.showMoreBtn} onPress={() => setShowAllFaqs(true)}>
              <Text style={s.showMoreBtnText}>Show More FAQs</Text>
              <Ionicons name="chevron-down" size={16} color="#2563EB" />
            </TouchableOpacity>
          )}

          <ReferAndFooter />
          <View style={{ height: 24 }} />
        </ScrollView>

        <PublicPillNav
          activeTab="roadside"
          onPressTab={(tab: PublicPillNavTab) => {
            if (tab === 'home') navigation.navigate('PublicHome');
            if (tab === 'services') navigation.navigate('PublicServicePackages', { city });
            if (tab === 'ai') navigation.navigate('AIBooking', { city });
            if (tab === 'roadside') return;
            if (tab === 'account') navigation.navigate('Settings');
          }}
        />

        {/* ── All Reviews Modal ── */}
        <Modal visible={showAllReviews} transparent animationType="slide" onRequestClose={() => setShowAllReviews(false)}>
          <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowAllReviews(false)}>
            <TouchableOpacity style={s.modalSheet} activeOpacity={1} onPress={() => undefined}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>All Reviews</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={s.modalScroll}>
                {RSA_REVIEWS.map((review) => (
                  <View key={review.name} style={s.modalReviewCard}>
                    <View style={s.reviewStars}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Ionicons key={i} name={i < review.stars ? 'star' : 'star-outline'} size={14} color="#F59E0B" />
                      ))}
                    </View>
                    <Text style={s.reviewText}>"{review.text}"</Text>
                    <View style={s.reviewAuthor}>
                      <View style={s.reviewAvatar}>
                        <Text style={s.reviewAvatarText}>{review.name[0]}</Text>
                      </View>
                      <View>
                        <Text style={s.reviewName}>{review.name}</Text>
                        <Text style={s.reviewCar}>{review.car} • {review.date}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ── All FAQs Modal ── */}
        <Modal visible={showAllFaqs} transparent animationType="slide" onRequestClose={() => setShowAllFaqs(false)}>
          <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowAllFaqs(false)}>
            <TouchableOpacity style={s.modalSheet} activeOpacity={1} onPress={() => undefined}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>All FAQs</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={s.modalScroll}>
                {RSA_FAQS.map((faq, idx) => (
                  <View key={faq.q} style={s.faqCard}>
                    <TouchableOpacity
                      style={s.faqHeader}
                      onPress={() => setOpenFaqIdx((prev) => (prev === idx + 100 ? null : idx + 100))}
                    >
                      <Text style={s.faqQ}>{faq.q}</Text>
                      <Ionicons name={openFaqIdx === idx + 100 ? 'chevron-up' : 'chevron-forward'} size={18} color="#6B7280" />
                    </TouchableOpacity>
                    {openFaqIdx === idx + 100 && <Text style={s.faqA}>{faq.a}</Text>}
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F7FF' },
  screen: { flex: 1, backgroundColor: '#F0F7FF' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#111827' },
  content: { paddingHorizontal: 16, paddingBottom: 140 },

  /* ── RSA Hero (Red Card) ── */
  rsaHeroCard: {
    marginTop: 12,
    borderRadius: 32,
    backgroundColor: '#DC2626',
    padding: 24,
    shadowColor: '#DC2626',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  rsaHeroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  rsaHeroSub: { marginTop: 4, color: 'rgba(255,255,255,0.84)', fontSize: 12 },
  rsaHeroService: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  rsaHeroIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rsaHeroServiceName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  rsaHeroServiceDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 },
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
  rsaEmergencyBtnText: { color: '#DC2626', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  /* ── Dark Services Card (2-col grid) ── */
  rsaCard: {
    marginTop: 16,
    borderRadius: 32,
    backgroundColor: '#171717',
    padding: 24,
  },
  rsaTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  rsaSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 20 },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  serviceItem: {
    width: '48%' as any,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  serviceIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  serviceName: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 4 },
  serviceDesc: { fontSize: 9, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 13 },

  /* ── Pricing ── */
  pricingHeading: { fontSize: 20, fontWeight: '900', color: '#111827', marginTop: 24, marginBottom: 4 },
  pricingSub: { fontSize: 12, color: '#6B7280', marginBottom: 16, lineHeight: 18 },
  priceCard: {
    backgroundColor: '#171717',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 12,
  },
  priceLabel: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4, marginBottom: 16 },
  priceValue: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  priceSuffix: { fontSize: 12, color: '#6B7280' },
  priceBullet: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  bulletDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.2)', alignItems: 'center', justifyContent: 'center' },
  priceBulletText: { fontSize: 12, color: '#D1D5DB' },
  towingBtn: {
    marginTop: 16, height: 50, borderRadius: 16,
    backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center',
  },
  towingBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  whatsappBtn: {
    marginTop: 16, height: 50, borderRadius: 16,
    backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center',
  },
  whatsappBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  /* ── Reviews ── */
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  reviewHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 24, marginBottom: 14,
  },
  reviewBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  reviewBadgeText: { fontSize: 11, fontWeight: '800', color: '#92400E' },
  reviewScroll: { gap: 12 },
  reviewCard: {
    width: 280, borderRadius: 24, padding: 20,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6',
    marginRight: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  reviewStars: { flexDirection: 'row', gap: 2, marginBottom: 12 },
  reviewText: { fontSize: 13, color: '#374151', lineHeight: 20, fontStyle: 'italic', marginBottom: 16 },
  reviewAuthor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarText: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
  reviewName: { fontSize: 12, fontWeight: '700', color: '#111827' },
  reviewCar: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  showMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, marginTop: 12, marginBottom: 8,
  },
  showMoreBtnText: { fontSize: 13, fontWeight: '700', color: '#2563EB' },

  /* ── FAQs ── */
  faqHeading: { fontSize: 18, fontWeight: '900', color: '#111827', marginTop: 20, marginBottom: 10 },
  faqCard: {
    borderRadius: 16, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8, overflow: 'hidden',
  },
  faqHeader: {
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  faqQ: { flex: 1, fontSize: 13, color: '#111827', fontWeight: '700' },
  faqA: {
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 12, color: '#6B7280', lineHeight: 18,
  },

  /* ── Modals (Reviews + FAQs) ── */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '80%', paddingBottom: 32,
  },
  modalHandle: {
    width: 48, height: 5, borderRadius: 3,
    backgroundColor: '#D1D5DB', alignSelf: 'center',
    marginTop: 12, marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 16 },
  modalScroll: { paddingHorizontal: 20 },
  modalReviewCard: {
    borderRadius: 20, padding: 20,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6',
    marginBottom: 10,
  },
});
