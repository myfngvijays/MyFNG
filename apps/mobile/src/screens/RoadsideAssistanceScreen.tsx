import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicBottomNav';
import RSAMembershipPlansSection from '../components/RSAMembershipPlansSection';
import { invalidateAppMembershipPlansCache } from '../hooks/useAppMembershipPlans';
import MembershipCardsBlock from '../components/MembershipCardsBlock';
import SmartToolsBlock from '../components/SmartToolsSection';
import MembershipTermsCard from '../components/MembershipTermsCard';
import ReferAndFooter from '../components/ReferAndFooter';
import SectionHeading from '../components/SectionHeading';
import { COLORS } from '../constants/theme';
import { openPhoneCall } from '../lib/phone';
import { supabase } from '../lib/supabase';
import { RSA_PHONE, RSA_SERVICES, RSA_FAQS_FALLBACK, type RsaServiceDef } from '../constants/rsaServices';
import { RsaServiceIcon } from '../components/RsaHomeSection';
import { fetchPublicFaqs, type PublicFaqItem } from '../lib/publicFaqs';
import { trackEvent } from '../lib/trackEvent';

type Props = { navigation: any; route: any };

const REVIEW_MODAL_SCROLL_MAX_HEIGHT = Dimensions.get('window').height * 0.8 - 96;

const DEFAULT_RSA_HERO_IMAGE =
  'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/Mobile%20Screen%20-%20Hero%20Section/RSA.PNG';

type RsaHeroBanner = {
  image_url: string;
  route_name: string;
  route_params?: Record<string, unknown> | null;
  title?: string | null;
};

type CustomerReview = {
  name: string;
  car: string;
  stars: number;
  text: string;
  date: string;
};

const RSA_REVIEWS_FALLBACK: CustomerReview[] = [
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
  const [reviews, setReviews] = useState<CustomerReview[]>(RSA_REVIEWS_FALLBACK);
  const [rsaFaqs, setRsaFaqs] = useState<PublicFaqItem[]>(RSA_FAQS_FALLBACK);
  const [heroBanner, setHeroBanner] = useState<RsaHeroBanner>({
    image_url: DEFAULT_RSA_HERO_IMAGE,
    route_name: 'RoadsideAssistance',
    route_params: {},
    title: 'RSA 24/7',
  });

  useEffect(() => {
    trackEvent('rsa_screen_viewed');
    invalidateAppMembershipPlansCache();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('rsa_screen_hero_banners')
          .select('image_url, route_name, route_params, title')
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!active || error || !data?.image_url) return;
        setHeroBanner({
          image_url: String(data.image_url),
          route_name: String(data.route_name || 'RoadsideAssistance'),
          route_params: (data.route_params as Record<string, unknown>) || {},
          title: data.title ? String(data.title) : null,
        });
      } catch {
        // keep default hero image
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchPublicFaqs({ group: 'RSA', section: 'rsa', platform: 'app' })
      .then((items) => {
        if (active && items.length) setRsaFaqs(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('customer_reviews')
          .select('id, name, car, stars, text, date, display_order, is_active, screen')
          .eq('is_active', true)
          .eq('screen', 'rsa')
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: false });

        if (!active || error || !Array.isArray(data) || data.length === 0) return;

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
        // keep fallback reviews
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const onServicePress = (svc: RsaServiceDef) => {
    trackEvent('rsa_service_tapped', { service_id: svc.name });
    if (svc.action === 'book_periodic') {
      navigation.navigate('PublicBookServiceNow', {
        city,
        serviceCategory: 'PERIODIC',
        serviceCategoryName: 'Periodic Car Service',
      });
      return;
    }
    openPhoneCall(RSA_PHONE);
  };

  const handleHeroPress = () => {
    const routeName = heroBanner.route_name || 'RoadsideAssistance';
    const params = { ...(heroBanner.route_params || {}) } as Record<string, unknown>;
    Object.keys(params).forEach((key) => {
      if (params[key] === '__CITY__') params[key] = city || '';
    });

    if (routeName.startsWith('Settings__')) {
      const subPageMap: Record<string, string> = {
        Settings__MyProfile: 'My Profile',
        Settings__Membership: 'Membership',
        Settings__YourAddresses: 'Your Addresses',
        Settings__OrderHistory: 'Order History',
        Settings__Cart: 'Cart',
        Settings__Notifications: 'Notifications',
      };
      navigation.navigate('Settings', { subPage: subPageMap[routeName] || null, ...params });
      return;
    }

    if (routeName === 'RoadsideAssistance') return;
    navigation.navigate(routeName as never, params as never);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.screen}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Roadside Assistance</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

          {/* Hero cover image — unchanged */}
          <View style={s.heroCard}>
            <TouchableOpacity activeOpacity={0.92} onPress={handleHeroPress} style={s.heroTouchable}>
              <Image source={{ uri: heroBanner.image_url }} style={s.heroFullImage} resizeMode="cover" />
            </TouchableOpacity>
          </View>

          {/* Slim emergency strip — not a heavy block */}
          <View style={s.emergencyStrip}>
            <View style={s.emergencyLeft}>
              <View style={s.emergencyPulse}>
                <View style={s.emergencyDot} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.emergencyTitle}>24/7 Emergency Help</Text>
                <Text style={s.emergencySub}>Avg. response in 30–45 mins • Pan-India coverage</Text>
              </View>
            </View>
            <TouchableOpacity
              style={s.emergencyCallBtn}
              activeOpacity={0.85}
              onPress={() => { trackEvent('rsa_call_now_tapped'); openPhoneCall(RSA_PHONE); }}
            >
              <Ionicons name="call" size={16} color="#FFFFFF" />
              <Text style={s.emergencyCallText}>Call Now</Text>
            </TouchableOpacity>
          </View>

          {/* Services — original 2-column grid */}
          <SectionHeading
            title="Our RSA Services"
            subtitle="Tap any service to get instant help."
            style={s.servicesHeading}
          />
          <View style={s.serviceGrid}>
            {RSA_SERVICES.map((svc) => (
              <TouchableOpacity
                key={svc.name}
                style={s.serviceItem}
                activeOpacity={0.8}
                onPress={() => onServicePress(svc)}
              >
                <RsaServiceIcon svc={svc} />
                <Text style={s.serviceName} numberOfLines={2}>{svc.name}</Text>
                <Text style={s.serviceDesc} numberOfLines={2}>{svc.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <RSAMembershipPlansSection navigation={navigation} slot="after_services" />
          <MembershipCardsBlock screen="rsa" slot="after_services" navigation={navigation} bannerOnly />
          <SmartToolsBlock screen="rsa" slot="after_services" navigation={navigation} compact />

          <RSAMembershipPlansSection navigation={navigation} slot="before_pricing" />
          <MembershipCardsBlock screen="rsa" slot="before_pricing" navigation={navigation} bannerOnly />
          <SmartToolsBlock screen="rsa" slot="before_pricing" navigation={navigation} compact />

          <MembershipTermsCard membershipType="RSA" style={s.termsCardWrap} />

          {/* Pricing — single light card, not dark blocks */}
          <SectionHeading
            title="Pricing"
            subtitle="Clear and affordable pricing. Exact cost depends on location, vehicle type and distance."
            style={s.pricingHeadingWrap}
          />

          <View style={s.pricingCard}>
            <View style={s.pricingRow}>
              <View style={s.pricingCol}>
                <View style={[s.pricingIconWrap, { backgroundColor: '#3B82F6' }]}>
                  <MaterialCommunityIcons name="tow-truck" size={18} color="#FFFFFF" />
                </View>
                <Text style={s.priceLabel}>Towing</Text>
                <View style={s.priceRow}>
                  <Text style={s.priceValue}>₹25/km</Text>
                  <Text style={s.priceSuffix}>onwards</Text>
                </View>
                {['Safe towing with proper equipment', 'Pickup from breakdown spot', 'Drop to nearest workshop'].map((t) => (
                  <View key={t} style={s.priceBullet}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={s.priceBulletText}>{t}</Text>
                  </View>
                ))}
              </View>

              <View style={s.pricingDivider} />

              <View style={s.pricingCol}>
                <View style={[s.pricingIconWrap, { backgroundColor: '#DC2626' }]}>
                  <MaterialCommunityIcons name="shield-car" size={18} color="#FFFFFF" />
                </View>
                <Text style={s.priceLabel}>RSA Support</Text>
                <View style={s.priceRow}>
                  <Text style={s.priceValue}>On Demand</Text>
                </View>
                <Text style={s.priceSuffixInline}>As per service type</Text>
                {['Jumpstart, puncture, fuel & minor fixes', 'AI-powered emergency dispatch', '24×7 customer support'].map((t) => (
                  <View key={t} style={s.priceBullet}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={s.priceBulletText}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={s.pricingDisclaimer}>
              Base charge covers dispatch and loading. Distance charges apply beyond minimum km.
            </Text>

            <View style={s.pricingActions}>
              <TouchableOpacity style={s.pricingBtnPrimary} onPress={() => openPhoneCall(RSA_PHONE)}>
                <Text style={s.pricingBtnPrimaryText}>Request Towing</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.pricingBtnOutline} onPress={() => openPhoneCall(RSA_PHONE)}>
                <Ionicons name="call-outline" size={16} color={COLORS.primary} />
                <Text style={s.pricingBtnOutlineText}>Get Quote</Text>
              </TouchableOpacity>
            </View>
          </View>

          <RSAMembershipPlansSection navigation={navigation} slot="before_reviews" />
          <MembershipCardsBlock screen="rsa" slot="before_reviews" navigation={navigation} bannerOnly />
          <SmartToolsBlock screen="rsa" slot="before_reviews" navigation={navigation} compact />

          {/* Reviews */}
          <SectionHeading
            title="What Our Customers Say"
            subtitle="Real reviews from verified customers"
            rightAccessory={
              <View style={s.reviewBadge}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={s.reviewBadgeText}>4.8/5</Text>
              </View>
            }
            style={s.reviewHeadingWrap}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.reviewScroll}>
            {reviews.slice(0, 3).map((review) => (
              <View key={`${review.name}-${review.date}`} style={s.reviewCard}>
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
            <Ionicons name="chevron-down" size={16} color={COLORS.primary} />
          </TouchableOpacity>

          <RSAMembershipPlansSection navigation={navigation} slot="before_faqs" />
          <MembershipCardsBlock screen="rsa" slot="before_faqs" navigation={navigation} bannerOnly />
          <SmartToolsBlock screen="rsa" slot="before_faqs" navigation={navigation} compact />

          {/* FAQs — minimal accordion */}
          <SectionHeading
            title="Frequently Asked Questions"
            subtitle="Answers to common RSA questions"
            style={s.faqHeadingWrap}
          />
          {rsaFaqs.slice(0, DEFAULT_FAQ_COUNT).map((faq, idx) => (
            <View key={faq.q} style={[s.faqCard, openFaqIdx === idx && s.faqCardOpen]}>
              <TouchableOpacity style={s.faqHeader} onPress={() => setOpenFaqIdx((prev) => (prev === idx ? null : idx))}>
                <Text style={s.faqQ}>{faq.q}</Text>
                <View style={[s.faqChevron, openFaqIdx === idx && s.faqChevronOpen]}>
                  <Ionicons name="chevron-down" size={14} color={COLORS.primary} />
                </View>
              </TouchableOpacity>
              {openFaqIdx === idx && <Text style={s.faqA}>{faq.a}</Text>}
            </View>
          ))}
          {rsaFaqs.length > DEFAULT_FAQ_COUNT && (
            <TouchableOpacity style={s.showMoreBtn} onPress={() => setShowAllFaqs(true)}>
              <Text style={s.showMoreBtnText}>Show More FAQs</Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.primary} />
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
            if (tab === 'ai') navigation.navigate('AIBooking', { city, fullScreen: true });
            if (tab === 'roadside') return;
            if (tab === 'account') navigation.navigate('Settings');
          }}
        />

        {/* All Reviews Modal */}
        <Modal visible={showAllReviews} transparent animationType="slide" onRequestClose={() => setShowAllReviews(false)}>
          <View style={s.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowAllReviews(false)} />
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>All Reviews</Text>
              <ScrollView
                showsVerticalScrollIndicator
                style={[s.modalScroll, { maxHeight: REVIEW_MODAL_SCROLL_MAX_HEIGHT }]}
                contentContainerStyle={s.modalScrollContent}
                nestedScrollEnabled
                bounces
              >
                {reviews.map((review) => (
                  <View key={`${review.name}-${review.date}`} style={s.modalReviewCard}>
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
            </View>
          </View>
        </Modal>

        {/* All FAQs Modal */}
        <Modal visible={showAllFaqs} transparent animationType="slide" onRequestClose={() => setShowAllFaqs(false)}>
          <View style={s.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowAllFaqs(false)} />
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>All FAQs</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={s.modalScroll}>
                {rsaFaqs.map((faq, idx) => (
                  <View key={faq.q} style={[s.faqCard, openFaqIdx === idx + 100 && s.faqCardOpen]}>
                    <TouchableOpacity
                      style={s.faqHeader}
                      onPress={() => setOpenFaqIdx((prev) => (prev === idx + 100 ? null : idx + 100))}
                    >
                      <Text style={s.faqQ}>{faq.q}</Text>
                      <View style={[s.faqChevron, openFaqIdx === idx + 100 && s.faqChevronOpen]}>
                        <Ionicons name="chevron-down" size={14} color={COLORS.primary} />
                      </View>
                    </TouchableOpacity>
                    {openFaqIdx === idx + 100 && <Text style={s.faqA}>{faq.a}</Text>}
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#111827' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140 },

  heroCard: {
    marginTop: 8,
    marginBottom: 14,
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

  emergencyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    shadowColor: '#DC2626',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 8,
  },
  emergencyLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emergencyPulse: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  emergencyTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  emergencySub: { marginTop: 2, fontSize: 10, color: '#6B7280', lineHeight: 14 },
  emergencyCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emergencyCallText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  servicesHeading: { marginTop: 8 },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  serviceItem: {
    width: '48%' as any,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  serviceDesc: {
    fontSize: 9,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 13,
  },

  pricingHeadingWrap: { marginTop: 4 },
  pricingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pricingRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pricingCol: {
    flex: 1,
  },
  pricingDivider: {
    width: 1,
    backgroundColor: '#F3F4F6',
  },
  pricingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  priceLabel: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4, marginBottom: 10 },
  priceValue: { fontSize: 22, fontWeight: '900', color: '#111827' },
  priceSuffix: { fontSize: 10, color: '#9CA3AF' },
  priceSuffixInline: { fontSize: 10, color: '#9CA3AF', marginTop: -6, marginBottom: 10 },
  priceBullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  priceBulletText: { flex: 1, fontSize: 10, color: '#6B7280', lineHeight: 14 },
  pricingActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  pricingBtnPrimary: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricingBtnPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  pricingBtnOutline: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pricingBtnOutlineText: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },
  pricingDisclaimer: {
    marginTop: 4,
    marginBottom: 4,
    paddingTop: 14,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    fontSize: 11,
    lineHeight: 16,
    color: '#DC2626',
    fontStyle: 'italic',
    textAlign: 'center',
  },

  reviewHeadingWrap: { marginTop: 28 },
  reviewBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  reviewBadgeText: { fontSize: 11, fontWeight: '800', color: '#92400E' },
  reviewScroll: { gap: 12 },
  reviewCard: {
    width: 280, borderRadius: 20, padding: 18,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
    marginRight: 12,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  reviewStars: { flexDirection: 'row', gap: 2, marginBottom: 10 },
  reviewText: { fontSize: 13, color: '#374151', lineHeight: 20, fontStyle: 'italic', marginBottom: 14 },
  reviewAuthor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  reviewName: { fontSize: 12, fontWeight: '700', color: '#111827' },
  reviewCar: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  showMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, marginTop: 12, marginBottom: 8,
  },
  showMoreBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  faqHeadingWrap: { marginTop: 8 },
  termsCardWrap: { marginTop: 4, marginBottom: 8 },
  faqCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
    overflow: 'hidden',
  },
  faqCardOpen: {
    borderColor: '#DBEAFE',
    backgroundColor: '#FAFCFF',
  },
  faqHeader: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  faqQ: { flex: 1, fontSize: 13, color: '#111827', fontWeight: '700' },
  faqChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqChevronOpen: {
    backgroundColor: '#EFF6FF',
    transform: [{ rotate: '180deg' }],
  },
  faqA: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },

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
  modalScrollContent: { paddingBottom: 16 },
  modalReviewCard: {
    borderRadius: 20, padding: 20,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6',
    marginBottom: 10,
  },
});
