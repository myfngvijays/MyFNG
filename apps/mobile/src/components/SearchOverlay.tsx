import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { PrimeMembershipIcon, RSAMembershipIcon } from './MembershipPromoVisuals';
import MembershipCardsBlock from './MembershipCardsBlock';
import SmartToolsBlock from './SmartToolsSection';
import type { MembershipType } from '../lib/membershipPlacements';
import { getServiceIconSource, RSA_ICON_RED_SOURCE } from '../lib/serviceIcons';
import { SMART_TOOL_WEB_URLS } from '../constants/smartTools';
import { trackEvent } from '../lib/trackEvent';

type SearchItem = {
  id: string;
  title: string;
  category: string;
  icon: keyof typeof Ionicons.glyphMap;
  screen: string;
  params?: Record<string, any>;
  keywords: string[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  navigation: any;
  city?: string;
};

const ALL_ITEMS: SearchItem[] = [
  { id: 'periodic', title: 'Periodic Service', category: 'Car Service', icon: 'construct',
    screen: 'PublicServicePackages', params: { selectedServiceId: '1' },
    keywords: ['periodic', 'general service', 'basic service', 'maintenance', 'oil change', 'oil filter', 'air filter', '60 point check', 'regular service', 'annual service'] },
  { id: 'ac', title: 'AC Service & Repair', category: 'Car Service', icon: 'snow',
    screen: 'PublicServicePackages', params: { selectedServiceId: '2' },
    keywords: ['ac', 'air conditioning', 'cooling', 'ac gas', 'ac repair', 'cabin filter', 'ac compressor'] },
  { id: 'brakes', title: 'Brakes Service', category: 'Car Service', icon: 'warning',
    screen: 'PublicServicePackages', params: { selectedServiceId: '3' },
    keywords: ['brake', 'brake pads', 'brake disc', 'brake fluid', 'brake shoe', 'braking', 'abs'] },
  { id: 'engine', title: 'Engine Services', category: 'Car Service', icon: 'speedometer',
    screen: 'PublicServicePackages', params: { selectedServiceId: '4' },
    keywords: ['engine', 'engine oil', 'engine repair', 'overheating', 'engine noise', 'engine mount', 'timing belt', 'engine tuning'] },
  { id: 'clutch', title: 'Clutch Service', category: 'Car Service', icon: 'cog',
    screen: 'PublicServicePackages', params: { selectedServiceId: '5' },
    keywords: ['clutch', 'clutch plate', 'clutch work', 'gear', 'gear shifting', 'clutch cable', 'flywheel'] },
  { id: 'battery', title: 'Battery Services', category: 'Car Service', icon: 'battery-charging',
    screen: 'PublicServicePackages', params: { selectedServiceId: '6' },
    keywords: ['battery', 'battery replacement', 'battery dead', 'battery jumpstart', 'amaron', 'exide'] },
  { id: 'tyre', title: 'Tyre & Wheels', category: 'Car Service', icon: 'radio-button-off',
    screen: 'PublicServicePackages', params: { selectedServiceId: '7' },
    keywords: ['tyre', 'tire', 'wheel', 'alignment', 'balancing', 'puncture', 'tyre rotation', 'alloy', 'flat tyre'] },
  { id: 'detailing', title: 'Detailing Service', category: 'Car Service', icon: 'car-sport',
    screen: 'PublicServicePackages', params: { selectedServiceId: '8' },
    keywords: ['detailing', 'ceramic', 'polish', 'interior cleaning', 'car wash', 'wax', 'paint protection', 'foam wash', 'deep clean'] },
  { id: 'denting', title: 'Denting & Painting', category: 'Car Service', icon: 'color-palette',
    screen: 'PublicServicePackages', params: { selectedServiceId: '9' },
    keywords: ['denting', 'painting', 'dent', 'scratch', 'body work', 'bumper', 'fender', 'paint', 'body repair'] },
  { id: 'rsa', title: 'Roadside Assistance', category: 'Emergency', icon: 'call',
    screen: 'RoadsideAssistance', keywords: ['rsa', 'roadside', 'emergency', 'breakdown', 'stuck', 'towing', 'stranded'] },
  { id: 'rsa-jumpstart', title: 'Battery Jumpstart', category: 'RSA Service', icon: 'flash',
    screen: 'RoadsideAssistance', keywords: ['jumpstart', 'battery dead', 'car not starting', 'dead battery'] },
  { id: 'rsa-towing', title: 'Car Towing', category: 'RSA Service', icon: 'car',
    screen: 'RoadsideAssistance', keywords: ['towing', 'tow', 'car tow', 'accident towing', 'breakdown tow'] },
  { id: 'rsa-fuel', title: 'Fuel Delivery', category: 'RSA Service', icon: 'add-circle',
    screen: 'RoadsideAssistance', keywords: ['fuel', 'petrol', 'diesel', 'fuel delivery', 'ran out of fuel', 'no fuel'] },
  { id: 'rsa-flat', title: 'Flat Tyre Assistance', category: 'RSA Service', icon: 'ellipse-outline',
    screen: 'RoadsideAssistance', keywords: ['flat tyre', 'puncture', 'tyre burst', 'spare tyre'] },
  { id: 'ai', title: 'AI Assistant', category: 'Booking', icon: 'sparkles',
    screen: 'AIBooking', keywords: ['ai', 'chatbot', 'assistant', 'book', 'booking', 'quick book'] },
  { id: 'book-service', title: 'Book Service Now', category: 'Booking', icon: 'calendar',
    screen: 'PublicBookServiceNow', keywords: ['book now', 'book service', 'schedule', 'appointment'] },
  { id: 'locator', title: 'Workshop Locator', category: 'Find Us', icon: 'location',
    screen: 'PublicWorkshopLocator', keywords: ['workshop', 'locator', 'near me', 'nearest workshop', 'garage', 'find workshop'] },
  { id: 'profile', title: 'My Profile', category: 'Account', icon: 'person',
    screen: 'Settings', params: { subPage: 'My Profile' },
    keywords: ['profile', 'my profile', 'name', 'email', 'phone', 'account'] },
  { id: 'vehicles', title: 'Your Vehicles', category: 'Account', icon: 'car-sport',
    screen: 'Settings', params: { subPage: 'Your Vehicles' },
    keywords: ['vehicle', 'my car', 'car details', 'car number'] },
  { id: 'addresses', title: 'Your Addresses', category: 'Account', icon: 'location',
    screen: 'Settings', params: { subPage: 'Your Addresses' },
    keywords: ['address', 'saved address', 'home address', 'location'] },
  { id: 'membership', title: 'Membership Plans', category: 'Account', icon: 'diamond',
    screen: 'Settings', params: { subPage: 'Membership' },
    keywords: ['membership', 'plan', 'premium', 'go', 'pro', 'max', 'subscribe'] },
  { id: 'orders', title: 'Order History', category: 'Account', icon: 'receipt',
    screen: 'Settings', params: { subPage: 'Order History' },
    keywords: ['order', 'history', 'past orders', 'booking history', 'invoice'] },
  { id: 'cart', title: 'Cart', category: 'Account', icon: 'cart',
    screen: 'Settings', params: { subPage: 'Cart' },
    keywords: ['cart', 'checkout', 'payment', 'pay'] },
  { id: 'notifications', title: 'Notifications', category: 'Settings', icon: 'notifications',
    screen: 'Settings', params: { subPage: 'Notifications' },
    keywords: ['notification', 'alert', 'push', 'sms', 'email notification'] },
  { id: 'help', title: 'Help & Support', category: 'Support', icon: 'help-circle',
    screen: 'Settings', params: { subPage: 'Help & Support' },
    keywords: ['help', 'support', 'contact', 'faq', 'customer care', 'complaint'] },
  { id: 'privacy', title: 'Privacy Policy', category: 'Legal', icon: 'shield-checkmark',
    screen: 'Settings', params: { subPage: 'Privacy Policy' },
    keywords: ['privacy', 'data', 'policy'] },
  { id: 'terms', title: 'Terms of Use', category: 'Legal', icon: 'document-text',
    screen: 'Settings', params: { subPage: 'Terms of Use' },
    keywords: ['terms', 'conditions', 'legal', 'agreement'] },
  { id: 'tool-car-health', title: 'Smart Health Checkup', category: 'Smart Tools', icon: 'pulse',
    screen: 'CarHealthCheck',
    keywords: ['health', 'health check', 'car health', 'diagnostic', 'inspection', 'score'] },
  { id: 'tool-fuel', title: 'Fuel Cost Calculator', category: 'Smart Tools', icon: 'speedometer',
    screen: 'FuelCostCalculator',
    keywords: ['fuel', 'petrol', 'diesel', 'mileage', 'trip cost', 'calculator', 'fuel cost'] },
  { id: 'tool-compare', title: 'Compare Service Cost', category: 'Smart Tools', icon: 'git-compare',
    screen: 'AuthorisedPricing',
    keywords: ['compare', 'pricing', 'authorised', 'service cost', 'price compare', 'dealer'] },
  { id: 'tool-loan', title: 'Loan Against Car', category: 'Smart Tools', icon: 'cash',
    screen: 'SmartToolWeb', params: { title: 'Loan Against Car', url: SMART_TOOL_WEB_URLS.car_loan },
    keywords: ['loan', 'car loan', 'finance', 'against car', 'cash'] },
  { id: 'tool-resale', title: 'Car Resale Value', category: 'Smart Tools', icon: 'trending-up',
    screen: 'ResaleValue',
    keywords: ['resale', 'sell car', 'value', 'market price', 'used car'] },
  { id: 'tool-quiz', title: 'Car Quiz', category: 'Smart Tools', icon: 'game-controller',
    screen: 'CarQuizGame',
    keywords: ['quiz', 'game', 'car quiz', 'trivia', 'challenge'] },
  { id: 'tool-parking', title: 'Nearby Parking', category: 'Smart Tools', icon: 'location',
    screen: 'SmartToolWeb', params: { title: 'Nearby Parking', url: SMART_TOOL_WEB_URLS.parking_finder, useLocation: true },
    keywords: ['parking', 'nearby parking', 'park', 'find parking'] },
  { id: 'tool-parts', title: 'Check Parts Price', category: 'Smart Tools', icon: 'construct',
    screen: 'CarPartsPrice',
    keywords: ['parts', 'spare parts', 'parts price', 'genuine parts', 'oem'] },
];

const CAR_SERVICES = ALL_ITEMS.filter((item) => item.category === 'Car Service');
const RSA_ITEM = ALL_ITEMS.find((item) => item.id === 'rsa')!;
const POPULAR_SERVICE_IDS = new Set(['periodic', 'brakes', 'denting', 'rsa']);
const DISPLAY_SERVICES = CAR_SERVICES.filter((item) => !POPULAR_SERVICE_IDS.has(item.id));
const POPULAR_ITEMS = [
  ALL_ITEMS.find((item) => item.id === 'periodic')!,
  ALL_ITEMS.find((item) => item.id === 'brakes')!,
  ALL_ITEMS.find((item) => item.id === 'denting')!,
  RSA_ITEM,
];
const QUICK_ACTIONS = [
  ALL_ITEMS.find((item) => item.id === 'orders')!,
  ALL_ITEMS.find((item) => item.id === 'help')!,
  ALL_ITEMS.find((item) => item.id === 'privacy')!,
  ALL_ITEMS.find((item) => item.id === 'terms')!,
];
const GRID_ITEM_WIDTH = (Dimensions.get('window').width - 32 - 30) / 4;
function getGridTitle(item: SearchItem) {
  if (item.id === 'rsa') return 'RSA';
  if (item.id === 'brakes') return 'Brakes';
  if (item.id === 'denting') return 'Denting & Painting';
  if (item.id.startsWith('membership-plan-')) return item.title;
  return item.title;
}

function MembershipPlanIcon({ membershipType, size = 46, compact = false }: { membershipType?: MembershipType; size?: number; compact?: boolean }) {
  if (membershipType === 'RSA') return <RSAMembershipIcon size={size} compact={compact} />;
  return <PrimeMembershipIcon size={size} compact={compact} />;
}

function ServiceIcon({ item, size = 46 }: { item: SearchItem; size?: number }) {
  if (item.id.startsWith('membership-plan-')) {
    return <MembershipPlanIcon membershipType={item.params?.membershipType} size={size} />;
  }

  const isRsa = item.id === 'rsa';
  const iconSource = isRsa ? RSA_ICON_RED_SOURCE : getServiceIconSource(item.title);
  if (iconSource) {
    return (
      <Image
        source={iconSource}
        style={{ width: size, height: size, marginBottom: 6 }}
        resizeMode="contain"
      />
    );
  }
  return <Ionicons name={item.icon} size={size * 0.6} color={COLORS.primary} style={{ marginBottom: 6 }} />;
}

function ServiceGridItem({ item, onPress }: { item: SearchItem; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.serviceGridItem} activeOpacity={0.85} onPress={onPress}>
      <ServiceIcon item={item} />
      <Text style={styles.serviceGridText} numberOfLines={2}>
        {getGridTitle(item)}
      </Text>
    </TouchableOpacity>
  );
}

export default function SearchOverlay({ visible, onClose, navigation, city }: Props) {
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ALL_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.keywords.some((kw) => kw.includes(q) || q.includes(kw)),
    );
  }, [query]);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      trackEvent('search_query_entered', { query: q });
    }, 600);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [query]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const handleSelect = (item: SearchItem) => {
    trackEvent('search_result_tapped', { result_type: item.category });
    setQuery('');
    onClose();
    if (item.id === 'refer' && !item.params) {
      Share.share({ message: 'Join MyFNG and get rewards on your first car service booking. Use code MYFNG500.' });
      return;
    }
    if (item.id === 'tool-parking' && item.params) {
      navigation.navigate(item.screen, { city, ...item.params });
      return;
    }
    navigation.navigate(item.screen, { city: city || 'Mumbai', ...item.params });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.screen}>
          <View style={[styles.topRow, { paddingTop: Math.max(insets.top, 12) }]}>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
            <View style={styles.inputWrap}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search services, help, or features..."
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                autoFocus
                returnKeyType="search"
              />
              {query.length > 0 ? (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.cancelBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!query ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Popular Searches</Text>
                  <View style={styles.serviceGrid}>
                    {POPULAR_ITEMS.map((item) => (
                      <ServiceGridItem key={item.id} item={item} onPress={() => handleSelect(item)} />
                    ))}
                  </View>
                </View>

                <MembershipCardsBlock screen="search" slot="after_popular_searches" navigation={navigation} bannerOnly spacing="compact" />
                <View style={styles.section}>
                  <SmartToolsBlock screen="search" slot="after_popular_searches" navigation={navigation} city={city} compact onBeforeNavigate={handleClose} />
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Other Services</Text>
                  <View style={styles.serviceGrid}>
                    {DISPLAY_SERVICES.map((item) => (
                      <ServiceGridItem key={item.id} item={item} onPress={() => handleSelect(item)} />
                    ))}
                  </View>
                </View>

                <MembershipCardsBlock screen="search" slot="after_other_services" navigation={navigation} bannerOnly spacing="compact" />
                <View style={styles.section}>
                  <SmartToolsBlock screen="search" slot="after_other_services" navigation={navigation} city={city} compact onBeforeNavigate={handleClose} />
                </View>

                <SmartToolsBlock screen="search" slot="main_grid" navigation={navigation} city={city} onBeforeNavigate={handleClose} />

                <MembershipCardsBlock screen="search" slot="after_smart_tools" navigation={navigation} bannerOnly spacing="compact" />

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Legal and Support</Text>
                  <View style={styles.serviceGrid}>
                    {QUICK_ACTIONS.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.serviceGridItem}
                        activeOpacity={0.85}
                        onPress={() => handleSelect(item)}
                      >
                        <View style={styles.quickActionIconWrap}>
                          <Ionicons name={item.icon} size={22} color={COLORS.primary} />
                        </View>
                        <Text style={styles.serviceGridText} numberOfLines={2}>
                          {item.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.results}>
                {results.map((item) => {
                  const isRsa = item.id === 'rsa';
                  const isMembership = item.id.startsWith('membership-plan-');
                  const iconSource = isRsa ? RSA_ICON_RED_SOURCE : getServiceIconSource(item.title);
                  return (
                  <TouchableOpacity key={item.id} style={styles.resultRow} onPress={() => handleSelect(item)}>
                    <View style={styles.resultIcon}>
                      {isMembership ? (
                        <MembershipPlanIcon membershipType={item.params?.membershipType} size={28} compact />
                      ) : iconSource ? (
                        <Image source={iconSource} style={styles.resultIconImage} resizeMode="contain" />
                      ) : (
                        <Ionicons name={item.icon} size={16} color="#6B7280" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultTitle}>{item.title}</Text>
                      <Text style={styles.resultSub}>{item.category}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                  );
                })}
                {results.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Ionicons name="search-outline" size={40} color="#D1D5DB" />
                    <Text style={styles.emptyTitle}>No results for "{query}"</Text>
                    <Text style={styles.emptySub}>Try different keywords or browse services above</Text>
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '600' },
  cancelBtn: { paddingHorizontal: 4, paddingVertical: 8 },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.2, textTransform: 'uppercase' },
  quickActionIconWrap: {
    width: 46,
    height: 46,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartToolIconWrap: {
    width: 46,
    height: 46,
    marginBottom: 6,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  membershipIconWrap: {
    width: 46,
    height: 46,
    marginBottom: 6,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  membershipResultIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  serviceGridItem: {
    width: GRID_ITEM_WIDTH,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  serviceIcon: {
    width: 46,
    height: 46,
    marginBottom: 6,
  },
  serviceGridText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 12,
  },
  results: { gap: 8 },
  resultRow: { borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  resultIconImage: { width: 32, height: 32 },
  resultTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  resultSub: { marginTop: 2, fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 },
  emptyWrap: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  emptySub: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
});
