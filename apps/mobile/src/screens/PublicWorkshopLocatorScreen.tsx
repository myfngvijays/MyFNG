import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { supabase } from '../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicPillNav';

type Props = {
  navigation: any;
  route: any;
};

type WorkshopRow = {
  id: string;
  name: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  map_link: string | null;
  is_verified: boolean | null;
  phone?: string | null;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
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

function openTel(phoneE164: string) {
  const url = Platform.select({
    ios: `telprompt:${phoneE164}`,
    android: `tel:${phoneE164}`,
    default: `tel:${phoneE164}`,
  });
  if (url) Linking.openURL(url);
}

function openMapsForWorkshop(w: WorkshopRow) {
  if (w.map_link) {
    Linking.openURL(w.map_link);
    return;
  }
  if (typeof w.latitude === 'number' && typeof w.longitude === 'number') {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${w.latitude},${w.longitude}`);
    return;
  }
  Alert.alert('No map location', 'This workshop does not have a map location yet.');
}

export default function PublicWorkshopLocatorScreen({ navigation, route }: Props) {
  const city: string | undefined = route?.params?.city;

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<WorkshopRow[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? rows.filter((w) => (w.name || '').toLowerCase().includes(q) || (w.city || '').toLowerCase().includes(q))
      : rows;

    if (!userLoc) return base;
    const scored = base
      .map((w) => {
        const lat = w.latitude;
        const lng = w.longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number') return { w, km: Number.POSITIVE_INFINITY };
        return { w, km: haversineKm(userLoc, { lat, lng }) };
      })
      .sort((a, b) => a.km - b.km);
    return scored.map((s) => ({ ...s.w, _km: s.km } as any));
  }, [rows, query, userLoc]);

  async function fetchWorkshops() {
    try {
      setLoading(true);
      const base = supabase
        .from('workshops')
        .select('id,name,city,latitude,longitude,map_link,is_verified,phone')
        .eq('is_verified', true)
        .order('created_at', { ascending: false })
        .limit(250);

      const res = city ? await base.ilike('city', `%${city}%`) : await base;
      if (res.error) throw res.error;
      setRows((res.data as any[]) || []);
    } catch {
      Alert.alert('Unable to load workshops', 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function detectMyLocation() {
    try {
      const expoLocationNative = requireOptionalNativeModule('ExpoLocation');
      if (!expoLocationNative) {
        Alert.alert('Location not available', 'Please rebuild the Android app (native location module missing).');
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Location = require('expo-location') as typeof import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location permission to sort by distance.');
        return;
      }
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        Alert.alert('Turn on Location', 'Please enable device Location (GPS) and try again.');
        return;
      }
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
      ]);
      if (!pos) {
        Alert.alert('No GPS fix', 'Couldn’t get your location. Try again.');
        return;
      }
      setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert('Location failed', 'Couldn’t detect your location.');
    }
  }

  useEffect(() => {
    fetchWorkshops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  const renderItem = ({ item }: any) => {
    const km = typeof item._km === 'number' && Number.isFinite(item._km) ? item._km : null;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={14} color="#fff" />
            <Text style={styles.badgeText}>Verified</Text>
          </View>
          {km != null ? (
            <Text style={styles.kmText}>{km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)} km`}</Text>
          ) : (
            <Text style={styles.kmTextMuted}>—</Text>
          )}
        </View>

        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.city || '—'}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btn} onPress={() => openMapsForWorkshop(item)} activeOpacity={0.9}>
            <Ionicons name="navigate" size={16} color={COLORS.primary} />
            <Text style={styles.btnText}>Directions</Text>
          </TouchableOpacity>
          {item.phone ? (
            <TouchableOpacity style={styles.btn} onPress={() => openTel(String(item.phone))} activeOpacity={0.9}>
              <Ionicons name="call" size={16} color={COLORS.primary} />
              <Text style={styles.btnText}>Call</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.primaryDark} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Workshop Locator</Text>
            <Text style={styles.subTitle}>{city ? `City: ${city}` : 'Verified workshops near you'}</Text>
          </View>
          <TouchableOpacity onPress={detectMyLocation} style={styles.locBtn} activeOpacity={0.9}>
            <Ionicons name="locate" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={COLORS.gray[500]} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search workshop or city"
            placeholderTextColor={COLORS.gray[500]}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={fetchWorkshops} style={styles.refreshBtn} activeOpacity={0.9}>
            <Ionicons name={loading ? 'sync' : 'refresh'} size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(it: any) => String(it.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{loading ? 'Loading…' : 'No workshops found'}</Text>
              <Text style={styles.emptySub}>Try a different city or search keyword.</Text>
            </View>
          }
        />

        <PublicPillNav
          activeTab="search"
          onPressTab={(tab: PublicPillNavTab) => {
            if (tab === 'ai') navigation.navigate('AIBooking', { city });
            if (tab === 'search') {
              // already here
            }
            if (tab === 'profile') navigation.navigate('Login');
            if (tab === 'settings') Alert.alert('Support', 'Use the home screen support option.');
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  title: { fontSize: FONT_SIZES.lg, fontWeight: '900', color: COLORS.primaryDark },
  subTitle: { marginTop: 2, fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.gray[600] },
  locBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.primaryDark },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF6FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl + 80,
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.success,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  badgeText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  kmText: { fontWeight: '900', color: COLORS.primaryDark, fontSize: 12 },
  kmTextMuted: { fontWeight: '900', color: COLORS.gray[500], fontSize: 12 },
  name: { fontSize: FONT_SIZES.md, fontWeight: '900', color: COLORS.primaryDark },
  meta: { marginTop: 4, fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.gray[600] },
  actions: { marginTop: SPACING.md, flexDirection: 'row', gap: SPACING.sm },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#EEF6FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
  },
  btnText: { fontWeight: '900', color: COLORS.primary, fontSize: FONT_SIZES.sm },
  empty: { padding: SPACING.xl, alignItems: 'center' },
  emptyTitle: { fontSize: FONT_SIZES.md, fontWeight: '900', color: COLORS.primaryDark },
  emptySub: { marginTop: 6, fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.gray[600], textAlign: 'center' },
});


