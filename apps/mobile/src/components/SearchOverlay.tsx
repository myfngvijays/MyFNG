import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
};

const ALL_ITEMS: SearchItem[] = [
  // ── Car Services ──
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

  // ── RSA ──
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

  // ── Booking ──
  { id: 'ai', title: 'AI Assistant', category: 'Booking', icon: 'sparkles',
    screen: 'AIBooking', keywords: ['ai', 'chatbot', 'assistant', 'book', 'booking', 'quick book'] },
  { id: 'book-service', title: 'Book Service Now', category: 'Booking', icon: 'calendar',
    screen: 'PublicBookServiceNow', keywords: ['book now', 'book service', 'schedule', 'appointment'] },

  // ── Find ──
  { id: 'locator', title: 'Workshop Locator', category: 'Find Us', icon: 'location',
    screen: 'PublicWorkshopLocator', keywords: ['workshop', 'locator', 'near me', 'nearest workshop', 'garage', 'find workshop'] },

  // ── Account / Settings ──
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
  { id: 'wallet', title: 'Your Wallet', category: 'Account', icon: 'wallet',
    screen: 'Settings', params: { subPage: 'Your Wallet' },
    keywords: ['wallet', 'balance', 'money', 'credits', 'cashback', 'points'] },
  { id: 'refer', title: 'Refer & Earn', category: 'Rewards', icon: 'gift',
    screen: 'Settings', params: { subPage: 'Refer & Earn' },
    keywords: ['refer', 'referral', 'earn', 'invite', 'share', 'reward'] },
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
];

const POPULAR_CHIPS = ['Periodic Service', 'RSA', 'Brake Pads', 'Oil Change', 'Clutch Work'];

export default function SearchOverlay({ visible, onClose, navigation }: Props) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_ITEMS;
    return ALL_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.keywords.some((kw) => kw.includes(q) || q.includes(kw)),
    );
  }, [query]);

  const handleSelect = (item: SearchItem) => {
    setQuery('');
    onClose();
    if (item.id === 'refer' && !item.params) {
      Share.share({ message: 'Join MyFNG and get rewards on your first car service booking. Use code MYFNG500.' });
      return;
    }
    navigation.navigate(item.screen, { city: 'Mumbai', ...item.params });
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.topRow}>
          <View style={styles.inputWrap}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search services, help, or features..."
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={() => { setQuery(''); onClose(); }} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!query ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Popular Searches</Text>
                <View style={styles.chips}>
                  {POPULAR_CHIPS.map((label) => (
                    <TouchableOpacity key={label} style={styles.chip} onPress={() => setQuery(label)}>
                      <Text style={styles.chipText}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Links</Text>
                <View style={styles.quickGrid}>
                  <TouchableOpacity
                    style={[styles.quickCard, styles.quickBlue]}
                    onPress={() => handleSelect(ALL_ITEMS.find((i) => i.id === 'periodic')!)}
                  >
                    <Ionicons name="construct" size={18} color="#2563EB" />
                    <Text style={styles.quickText}>Services</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickCard, styles.quickRed]}
                    onPress={() => handleSelect(ALL_ITEMS.find((i) => i.id === 'rsa')!)}
                  >
                    <Ionicons name="call" size={18} color="#DC2626" />
                    <Text style={styles.quickText}>RSA</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : null}

          <View style={styles.results}>
            {results.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.resultRow}
                onPress={() => handleSelect(item)}
              >
                <View style={styles.resultIcon}>
                  <Ionicons name={item.icon} size={16} color="#6B7280" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle}>{item.title}</Text>
                  <Text style={styles.resultSub}>{item.category}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
            {query.length > 0 && results.length === 0 && (
              <View style={styles.emptyWrap}>
                <Ionicons name="search-outline" size={40} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No results for "{query}"</Text>
                <Text style={styles.emptySub}>Try different keywords or browse Quick Links above</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  inputWrap: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: '#F3F4F6', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '600' },
  cancelBtn: { paddingHorizontal: 4, paddingVertical: 8 },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  content: { padding: 16, gap: 16 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.2, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { color: '#4B5563', fontSize: 12, fontWeight: '700' },
  quickGrid: { flexDirection: 'row', gap: 10 },
  quickCard: { flex: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickBlue: { backgroundColor: '#EFF6FF' },
  quickRed: { backgroundColor: '#FEF2F2' },
  quickText: { fontSize: 13, fontWeight: '700', color: '#111827' },
  results: { gap: 8 },
  resultRow: { borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  resultSub: { marginTop: 2, fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 },
  emptyWrap: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  emptySub: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
});
