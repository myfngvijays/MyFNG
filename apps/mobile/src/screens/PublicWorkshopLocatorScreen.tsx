import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  UIManager,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { supabase } from '../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicPillNav';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

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

const { height: SCREEN_H } = Dimensions.get('window');
const MAP_H = Math.max(240, Math.min(360, Math.round(SCREEN_H * 0.42)));

function cityFallbackRegion(city?: string): Region {
  const c = String(city || '').trim().toLowerCase();
  const presets: Record<string, { lat: number; lng: number }> = {
    mumbai: { lat: 19.076, lng: 72.8777 },
    thane: { lat: 19.2183, lng: 72.9781 },
    'navi mumbai': { lat: 19.033, lng: 73.0297 },
    pune: { lat: 18.5204, lng: 73.8567 },
    bangalore: { lat: 12.9716, lng: 77.5946 },
    bengaluru: { lat: 12.9716, lng: 77.5946 },
    delhi: { lat: 28.6139, lng: 77.209 },
  };
  const hit = Object.keys(presets).find((k) => c.includes(k));
  const { lat, lng } = hit ? presets[hit] : { lat: 20.5937, lng: 78.9629 }; // India-ish fallback
  return { latitude: lat, longitude: lng, latitudeDelta: 0.18, longitudeDelta: 0.18 };
}

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
  const routeUserLoc = route?.params?.userLoc as { lat?: number; lng?: number } | undefined;
  const initialUserLoc =
    routeUserLoc && typeof routeUserLoc.lat === 'number' && typeof routeUserLoc.lng === 'number'
      ? { lat: routeUserLoc.lat, lng: routeUserLoc.lng }
      : null;

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<WorkshopRow[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(initialUserLoc);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const mapRef = useRef<MapView | null>(null);

  const canRenderNativeMap = useMemo(() => {
    // In Expo Go, AIRMap may not be available -> MapView crashes with "AIRMap not found".
    try {
      const cfg = (UIManager as any)?.getViewManagerConfig?.('AIRMap');
      return !!cfg;
    } catch {
      return false;
    }
  }, []);
  const canRenderMap = canRenderNativeMap;

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

  const mappable = useMemo(() => {
    return (filtered as any[]).filter((w) => typeof w.latitude === 'number' && typeof w.longitude === 'number') as any[];
  }, [filtered]);

  const mapRegion: Region = useMemo(() => {
    if (userLoc) {
      return { latitude: userLoc.lat, longitude: userLoc.lng, latitudeDelta: 0.10, longitudeDelta: 0.10 };
    }
    if (mappable.length) {
      const first = mappable[0];
      return { latitude: first.latitude, longitude: first.longitude, latitudeDelta: 0.16, longitudeDelta: 0.16 };
    }
    return cityFallbackRegion(city);
  }, [userLoc, mappable, city]);

  useEffect(() => {
    // Smoothly re-center when location or dataset changes
    if (!canRenderMap) return;
    if (!mapRef.current) return;
    mapRef.current.animateToRegion(mapRegion, 450);
  }, [mapRegion, canRenderMap]);

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
    const isExpanded = expandedId === String(item.id);
    return (
      <View style={[styles.sheetItem, isExpanded ? styles.sheetItemActive : null]}>
        <TouchableOpacity
          style={styles.sheetRow}
          activeOpacity={0.9}
          onPress={() => {
            const next = isExpanded ? null : String(item.id);
            setExpandedId(next);
            if (canRenderMap && typeof item.latitude === 'number' && typeof item.longitude === 'number') {
              mapRef.current?.animateToRegion(
                { latitude: item.latitude, longitude: item.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
                450
              );
            }
          }}
        >
          <TouchableOpacity
            style={styles.favBtn}
            activeOpacity={0.8}
            onPress={() => Alert.alert('Saved', 'Favorites coming soon.')}
          >
            <Ionicons name="heart-outline" size={20} color={COLORS.primaryDark} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
          {item.name}
        </Text>
            <Text style={styles.sheetSub} numberOfLines={2}>
          {item.city || '—'}
        </Text>
            {km != null ? (
              <View style={styles.kmPill}>
                <Text style={styles.kmPillText}>{km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`}</Text>
              </View>
            ) : null}
          </View>

          <Ionicons name="chevron-forward" size={20} color={COLORS.gray[500]} />
        </TouchableOpacity>

        {isExpanded ? (
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => openMapsForWorkshop(item)} activeOpacity={0.9}>
            <Ionicons name="navigate" size={16} color={COLORS.primary} />
              <Text style={styles.sheetBtnText}>Directions</Text>
          </TouchableOpacity>
          {item.phone ? (
              <TouchableOpacity style={styles.sheetBtn} onPress={() => openTel(String(item.phone))} activeOpacity={0.9}>
              <Ionicons name="call" size={16} color={COLORS.primary} />
                <Text style={styles.sheetBtnText}>Call</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        ) : null}
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

        <View style={styles.mapWrap}>
          {canRenderMap ? (
            <MapView
              ref={(r) => {
                mapRef.current = r;
              }}
              style={styles.map}
              initialRegion={mapRegion}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              showsUserLocation={!!userLoc}
              showsMyLocationButton={false}
              showsCompass={false}
              rotateEnabled={false}
            >
              {mappable.map((w) => (
                <Marker
                  key={String(w.id)}
                  coordinate={{ latitude: w.latitude, longitude: w.longitude }}
                  title={String(w.name || '')}
                  description={String(w.city || '')}
                  onPress={() => setExpandedId(String(w.id))}
                >
                  <View style={styles.pinWrap}>
                    <View style={styles.pinInner}>
                      <Ionicons name="location" size={18} color="#fff" />
                    </View>
                    <View style={styles.pinStem} />
                  </View>
                </Marker>
              ))}
            </MapView>
          ) : (
            <View style={styles.mapFallback}>
              <Ionicons name="map-outline" size={22} color={COLORS.primary} />
              <Text style={styles.mapFallbackTitle}>
                Map preview needs a Development Build
              </Text>
              <Text style={styles.mapFallbackSub}>
                Expo Go doesn’t include the native map module. You can still open directions in Google Maps.
              </Text>
              <TouchableOpacity
                style={styles.mapFallbackBtn}
                activeOpacity={0.9}
                onPress={() => {
                  const first = mappable[0] as any;
                  if (first) openMapsForWorkshop(first);
                  else Alert.alert('No map location', 'No workshop coordinates available yet.');
                }}
              >
                <Ionicons name="navigate" size={16} color={COLORS.primary} />
                <Text style={styles.mapFallbackBtnText}>Open in Maps</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.mapHint}>
            <Ionicons name="map" size={14} color={COLORS.gray[600]} />
            <Text style={styles.mapHintText}>
              {canRenderMap
                ? userLoc
                  ? 'Showing nearest workshops on map'
                  : 'Tap ⌖ to use your location'
                : 'Map unavailable in Expo Go (build dev client)'}
            </Text>
          </View>
        </View>

        {/* Bottom sheet list overlay (BMS-style) */}
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
        <FlatList
          data={filtered}
          keyExtractor={(it: any) => String(it.id)}
          renderItem={renderItem}
            contentContainerStyle={styles.sheetList}
            keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{loading ? 'Loading…' : 'No workshops found'}</Text>
              <Text style={styles.emptySub}>Try a different city or search keyword.</Text>
            </View>
          }
        />
        </View>

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
    paddingHorizontal: SPACING.md,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  title: { fontSize: FONT_SIZES.md, fontWeight: '900', color: COLORS.primaryDark },
  subTitle: { marginTop: 2, fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.gray[600] },
  locBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    marginHorizontal: SPACING.md,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 42,
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
  mapWrap: {
    marginHorizontal: SPACING.md,
    marginBottom: 10,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  map: {
    width: '100%',
    height: MAP_H,
  },
  mapFallback: {
    width: '100%',
    height: 210,
    padding: 14,
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3F8FF',
  },
  mapFallbackTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  mapFallbackSub: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.gray[600],
    lineHeight: 16,
  },
  mapFallbackBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.18)',
  },
  mapFallbackBtnText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  mapHint: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  mapHintText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    color: COLORS.gray[700],
  },
  pinWrap: { alignItems: 'center' },
  pinInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pinStem: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#E11D48',
    marginTop: -2,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 64, // above pill nav
    top: MAP_H + 118, // header + search + map approx
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    shadowColor: '#0B1F44',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 6,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(17,24,39,0.18)',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetList: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 110,
    paddingTop: 6,
    gap: 10,
  },
  sheetItem: {
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    overflow: 'hidden',
  },
  sheetItemActive: {
    borderColor: 'rgba(0,136,232,0.22)',
    backgroundColor: '#F8FAFF',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
  },
  favBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  sheetTitle: { fontSize: FONT_SIZES.md, fontWeight: '900', color: COLORS.primaryDark },
  sheetSub: { marginTop: 4, fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.gray[600], lineHeight: 16 },
  kmPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  kmPillText: { fontSize: FONT_SIZES.xs, fontWeight: '900', color: COLORS.gray[800] },
  sheetActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  sheetBtn: {
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
  sheetBtnText: { fontWeight: '900', color: COLORS.primary, fontSize: FONT_SIZES.xs },
  empty: { padding: SPACING.xl, alignItems: 'center' },
  emptyTitle: { fontSize: FONT_SIZES.md, fontWeight: '900', color: COLORS.primaryDark },
  emptySub: { marginTop: 6, fontSize: FONT_SIZES.xs, fontWeight: '700', color: COLORS.gray[600], textAlign: 'center' },
});


