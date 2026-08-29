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
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicBottomNav';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import { trackEvent } from '../lib/trackEvent';
import { workshopPublicPageAddress, isMyFngBrandedWorkshop } from '../lib/workshopDisplay';
import { ENV } from '../config/environment';

type Props = {
  navigation: any;
  route?: any;
  /** When true (CRM tab), hide public back/pill nav and fill parent. */
  embedded?: boolean;
};

type WorkshopRow = {
  id: string;
  name: string;
  workshop_name?: string | null;
  workshop_area?: string | null;
  near_famous_area?: string | null;
  city: string | null;
  address?: string | null;
  short_address?: string | null;
  landmark?: string | null;
  pincode?: string | null;
  service_pincode?: string | null;
  mapping_pincodes?: unknown;
  latitude: number | null;
  longitude: number | null;
  map_link: string | null;
  is_verified: boolean | null;
  phone?: string | null;
  gmb_formatted_address?: string | null;
};

const MAX_SANE_KM = 150;

function normalizePinList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || '').trim()).filter((p) => /^\d{6}$/.test(p));
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        return normalizePinList(JSON.parse(trimmed));
      } catch {
        /* fall through */
      }
    }
    return trimmed
      .split(/[|,;\s]+/)
      .map((p) => p.trim())
      .filter((p) => /^\d{6}$/.test(p));
  }
  return [];
}

function workshopCoversPincode(w: WorkshopRow, pincode: string): boolean {
  const target = String(pincode || '').trim();
  if (!/^\d{6}$/.test(target)) return false;
  if (String(w.pincode || '').trim() === target) return true;
  const servicePin = String(w.service_pincode || '').trim();
  if (servicePin === target) return true;
  if (servicePin && normalizePinList(servicePin.replace(/\|/g, ',')).includes(target)) return true;
  return normalizePinList(w.mapping_pincodes).includes(target);
}

function workshopDisplayName(w: WorkshopRow) {
  return (
    String(w.workshop_name || '').trim() ||
    String(w.workshop_area || '').trim() ||
    String(w.near_famous_area || '').trim() ||
    String(w.name || '').trim() ||
    'Workshop'
  );
}

function workshopCenterName(w: WorkshopRow) {
  const area = workshopDisplayName(w);
  const center = String(w.name || '').trim();
  if (center && center !== area) return center;
  return null;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MAP_W = Math.max(1, SCREEN_W - SPACING.md * 2);
const MAP_H = Math.max(240, Math.min(360, Math.round(SCREEN_H * 0.42)));

const SEARCH_LOCATION_PRESETS: Record<string, { lat: number; lng: number; label: string }> = {
  mumbai: { lat: 19.076, lng: 72.8777, label: 'Mumbai' },
  thane: { lat: 19.2183, lng: 72.9781, label: 'Thane' },
  kalyan: { lat: 19.2437, lng: 73.1355, label: 'Kalyan' },
  dombivli: { lat: 19.2167, lng: 73.0833, label: 'Dombivli' },
  'navi mumbai': { lat: 19.033, lng: 73.0297, label: 'Navi Mumbai' },
  pune: { lat: 18.5204, lng: 73.8567, label: 'Pune' },
  bangalore: { lat: 12.9716, lng: 77.5946, label: 'Bangalore' },
  bengaluru: { lat: 12.9716, lng: 77.5946, label: 'Bengaluru' },
  delhi: { lat: 28.6139, lng: 77.209, label: 'Delhi' },
};

function workshopSearchText(w: WorkshopRow) {
  return [
    w.name,
    w.workshop_name,
    w.workshop_area,
    w.near_famous_area,
    w.city,
    w.address,
    w.short_address,
    w.pincode,
  ]
    .map((v) => String(v || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

function workshopMatchesQuery(w: WorkshopRow, rawQuery: string) {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const haystack = workshopSearchText(w);
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}

function resolveSearchRegion(query: string): Region | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const presetKey = Object.keys(SEARCH_LOCATION_PRESETS).find((key) => q.includes(key));
  if (!presetKey) return null;
  const preset = SEARCH_LOCATION_PRESETS[presetKey];
  return {
    latitude: preset.lat,
    longitude: preset.lng,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  };
}

function buildOsmMapHtml(opts: {
  center: { lat: number; lng: number; zoom?: number };
  points: Array<{ id: string; lat: number; lng: number; title: string }>;
}) {
  const payload = JSON.stringify({
    center: opts.center,
    points: opts.points,
  }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#e8f1fa}
    .leaflet-control-attribution{font-size:9px}
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const data = ${payload};
    const map = L.map('map', { zoomControl: true }).setView(
      [data.center.lat, data.center.lng],
      data.center.zoom || 12
    );
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    const bounds = [];
    data.points.forEach(function (p) {
      const marker = L.marker([p.lat, p.lng]);
      marker.bindPopup(String(p.title || 'Workshop'));
      marker.on('click', function () {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ id: p.id }));
        }
      });
      marker.addTo(map);
      bounds.push([p.lat, p.lng]);
    });
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
    }
    window.panTo = function (lat, lng) {
      map.setView([lat, lng], 15);
    };
  </script>
</body>
</html>`;
}

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

// Open Google Maps directions using near_area_google_map column (preferred)
function openMapsForWorkshop(w: any) {
  const nearAreaLink = String((w as any).near_area_google_map || '').trim();
  if (nearAreaLink && nearAreaLink.startsWith('http')) {
    Linking.openURL(nearAreaLink);
    return;
  }
  const link = (w.map_link || '').trim();
  if (link && link.startsWith('http')) {
    Linking.openURL(link);
    return;
  }
  if (typeof w.latitude === 'number' && typeof w.longitude === 'number') {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${w.latitude},${w.longitude}`
    );
    return;
  }
  const dest = [w.name, w.address || '', w.city || ''].filter(Boolean).join(', ').trim();
  if (dest) {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`
    );
    return;
  }
  Alert.alert('No map location', 'This workshop does not have a map location yet.');
}

export default function PublicWorkshopLocatorScreen({ navigation, route, embedded = false }: Props) {
  const city: string | undefined = route?.params?.city;
  const routeUserLoc = route?.params?.userLoc as { lat?: number; lng?: number } | undefined;
  const initialUserLoc =
    routeUserLoc && typeof routeUserLoc.lat === 'number' && typeof routeUserLoc.lng === 'number'
      ? { lat: routeUserLoc.lat, lng: routeUserLoc.lng }
      : null;

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<WorkshopRow[]>([]);
  const [cityScoped, setCityScoped] = useState<boolean>(Boolean(city));
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(initialUserLoc);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const webMapRef = useRef<WebView | null>(null);
  const mapRegionRef = useRef<Region | null>(null);
  const [mapLayoutW, setMapLayoutW] = useState(MAP_W);

  const canRenderNativeMap = useMemo(() => {
    // In Expo Go, AIRMap may not be available -> MapView crashes with "AIRMap not found".
    try {
      const cfg = (UIManager as any)?.getViewManagerConfig?.('AIRMap');
      return !!cfg;
    } catch {
      return false;
    }
  }, []);
  const useWebMap = Platform.OS === 'android';
  const canRenderMap = useWebMap || canRenderNativeMap;

  const filtered = useMemo(() => {
    const q = query.trim();
    const pinQuery = /^\d{6}$/.test(q) ? q : null;
    let base = rows;
    if (pinQuery) {
      const nearby = rows.filter((w) => workshopCoversPincode(w, pinQuery));
      base = nearby.length ? nearby : rows.filter((w) => workshopMatchesQuery(w, q));
    } else if (q) {
      base = rows.filter((w) => workshopMatchesQuery(w, q));
    }

    if (!userLoc) return base.map((w) => ({ ...w, _km: null as number | null }));

    const scored = base
      .map((w) => {
        const lat = w.latitude;
        const lng = w.longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number') {
          return { w, km: Number.POSITIVE_INFINITY };
        }
        // Ignore obviously bad coordinates
        if (lat < 6 || lat > 38 || lng < 68 || lng > 98) {
          return { w, km: Number.POSITIVE_INFINITY };
        }
        return { w, km: haversineKm(userLoc, { lat, lng }) };
      })
      .sort((a, b) => a.km - b.km);

    // If GPS is wildly off (e.g. US coords vs India workshops), don't show absurd km
    const finite = scored.filter((s) => Number.isFinite(s.km));
    const saneCount = finite.filter((s) => s.km <= MAX_SANE_KM).length;
    const useDistance = saneCount >= Math.min(3, Math.max(1, Math.floor(finite.length * 0.2)));

    return scored.map((s) => ({
      ...s.w,
      _km: useDistance && Number.isFinite(s.km) && s.km <= MAX_SANE_KM ? s.km : null,
    })) as any[];
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

  mapRegionRef.current = mapRegion;
  const mappableRef = useRef(mappable);
  mappableRef.current = mappable;

  const osmHtml = useMemo(() => {
    const points = mappable.slice(0, 40).map((w) => ({
      id: String(w.id),
      lat: Number(w.latitude),
      lng: Number(w.longitude),
      title: String(w.workshop_name || w.name || 'Workshop').slice(0, 80),
    }));
    const first = points[0];
    return buildOsmMapHtml({
      center: first
        ? { lat: first.lat, lng: first.lng, zoom: 12 }
        : { lat: mapRegion.latitude, lng: mapRegion.longitude, zoom: 12 },
      points,
    });
    // Don't depend on GPS jitter or the WebView remounts and goes blank.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mappable
      .slice(0, 40)
      .map((w) => `${w.id}:${w.latitude}:${w.longitude}`)
      .join('|'),
  ]);

  function panWebMap(lat: number, lng: number) {
    webMapRef.current?.injectJavaScript(`window.panTo && window.panTo(${lat},${lng}); true;`);
  }

  function kickMapTiles() {
    const map = mapRef.current;
    const region = mapRegionRef.current;
    if (!map || !region) return;
    const coords = mappableRef.current
      .slice(0, 16)
      .map((w) => ({ latitude: Number(w.latitude), longitude: Number(w.longitude) }))
      .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
    if (coords.length >= 2) {
      map.fitToCoordinates(coords, {
        edgePadding: { top: 56, right: 40, bottom: 56, left: 40 },
        animated: false,
      });
      return;
    }
    map.animateToRegion(
      { ...region, latitudeDelta: region.latitudeDelta * 1.01, longitudeDelta: region.longitudeDelta * 1.01 },
      1,
    );
  }

  useEffect(() => {
    const searchRegion = resolveSearchRegion(query);
    if (!searchRegion) return;
    if (useWebMap) {
      panWebMap(searchRegion.latitude, searchRegion.longitude);
      return;
    }
    if (!canRenderNativeMap || !mapRef.current) return;
    mapRef.current.animateToRegion(searchRegion, 450);
  }, [query, canRenderNativeMap, useWebMap]);

  useEffect(() => {
    if (resolveSearchRegion(query)) return;
    if (useWebMap) {
      panWebMap(mapRegion.latitude, mapRegion.longitude);
      return;
    }
    if (!canRenderNativeMap || !mapRef.current) return;
    mapRef.current.animateToRegion(mapRegion, 450);
  }, [mapRegion, canRenderNativeMap, query, useWebMap]);

  async function fetchWorkshops() {
    try {
      setLoading(true);

      let loaded: any[] = [];
      try {
        const res = await fetch(`${ENV.API_URL}/api/public/workshop-locator`);
        const json = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(json?.workshops)) {
          loaded = json.workshops;
        }
      } catch {
        /* fall through to direct Supabase */
      }

      if (!loaded.length) {
        const [{ data, error }, { data: pageRows }] = await Promise.all([
          supabase
            .from('workshops')
            .select(
              'id,name,workshop_name,workshop_area,near_famous_area,city,state,address,short_address,landmark,pincode,service_pincode,mapping_pincodes,latitude,longitude,map_link,near_area_google_map,is_verified,phone',
            )
            .eq('is_verified', true)
            .order('created_at', { ascending: false })
            .limit(250),
          supabase
            .from('workshop_public_pages')
            .select('workshop_id, gmb_data')
            .eq('is_published', true),
        ]);
        if (error) throw error;

        const gmbByWorkshop = new Map<string, Record<string, unknown>>();
        for (const page of (pageRows as any[]) || []) {
          const workshopId = String(page?.workshop_id || '').trim();
          const gmb = page?.gmb_data;
          if (workshopId && gmb && typeof gmb === 'object') {
            gmbByWorkshop.set(workshopId, gmb as Record<string, unknown>);
          }
        }

        loaded = ((data as any[]) || [])
          .filter((w) =>
            isMyFngBrandedWorkshop({
              name: w.name,
              workshop_name: w.workshop_name,
              gmb_business_name: (gmbByWorkshop.get(String(w.id)) as any)?.business_name,
            }),
          )
          .map((w) => {
          const gmb = gmbByWorkshop.get(String(w.id)) || null;
          return {
            ...w,
            gmb_formatted_address: String((gmb as any)?.formatted_address || '').trim() || null,
            display_address: workshopPublicPageAddress(w, gmb),
          };
        });
      }

      setRows(loaded);
      setCityScoped(false);
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
        Alert.alert('Location not available', 'Please update or reinstall the app (native location module missing).');
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
      // Use last known position first (instant) for quick sorting
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        setUserLoc({ lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude });
      }

      // Then get fresh position for accuracy
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
      if (pos) {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } else if (!lastKnown) {
        Alert.alert('No GPS fix', 'Could not get your location. Try again.');
      }
    } catch {
      Alert.alert('Location failed', 'Could not detect your location.');
    }
  }

  useEffect(() => {
    trackEvent('workshop_locator_opened');
    fetchWorkshops();
    if (!userLoc) detectMyLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  const renderItem = ({ item }: any) => {
    const km = typeof item._km === 'number' && Number.isFinite(item._km) ? item._km : null;
    const isExpanded = expandedId === String(item.id);
    const title = workshopDisplayName(item);
    // Real garage name is telecaller-only; customers see MyFNG area brand only.
    const center = embedded ? workshopCenterName(item) : null;
    const address =
      String(item.display_address || '').trim() ||
      workshopPublicPageAddress(item, { formatted_address: item.gmb_formatted_address });
    return (
      <View style={[styles.sheetItem, isExpanded ? styles.sheetItemActive : null]}>
        <TouchableOpacity
          style={styles.sheetRow}
          activeOpacity={0.9}
          onPress={() => {
            const next = isExpanded ? null : String(item.id);
            setExpandedId(next);
            if (canRenderMap && typeof item.latitude === 'number' && typeof item.longitude === 'number') {
              if (useWebMap) {
                panWebMap(item.latitude, item.longitude);
              } else {
                mapRef.current?.animateToRegion(
                  { latitude: item.latitude, longitude: item.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
                  450
                );
              }
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

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {title}
            </Text>
            {center ? (
              <Text style={styles.sheetCenter} numberOfLines={1}>
                {center}
              </Text>
            ) : null}
            {address ? (
              <Text style={styles.sheetSub} numberOfLines={2}>
                {address}
              </Text>
            ) : null}
            {!item.gmb_formatted_address && !item.display_address ? (
              <Text style={styles.sheetSub} numberOfLines={1}>
                {[item.city, item.pincode].filter(Boolean).join(' · ') || '—'}
              </Text>
            ) : null}
            {km != null ? (
              <View style={styles.kmPill}>
                <Text style={styles.kmPillText}>
                  {km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)} km`}
                </Text>
              </View>
            ) : null}
          </View>

          <Ionicons name="chevron-forward" size={20} color={COLORS.gray[500]} />
        </TouchableOpacity>

        {isExpanded ? (
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => { trackEvent('workshop_directions_tapped'); openMapsForWorkshop(item); }} activeOpacity={0.9}>
            <Ionicons name="navigate" size={16} color={COLORS.primary} />
              <Text style={styles.sheetBtnText}>Directions</Text>
          </TouchableOpacity>
              <TouchableOpacity style={styles.sheetBtn} onPress={() => { trackEvent('workshop_call_tapped'); openTel('+919152307030'); }} activeOpacity={0.9}>
              <Ionicons name="call" size={16} color={COLORS.primary} />
                <Text style={styles.sheetBtnText}>Call</Text>
            </TouchableOpacity>
        </View>
        ) : null}
      </View>
    );
  };

  const content = (
      <View style={styles.screen}>
        <View style={styles.header}>
          {!embedded ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={20} color={COLORS.primaryDark} />
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Workshop Locator</Text>
            <Text style={styles.subTitle}>
              {userLoc
                ? 'Showing nearby verified workshops'
                : 'Detecting your location…'}
            </Text>
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
            placeholder="Search pincode, workshop, city (e.g. 400601)"
            placeholderTextColor={COLORS.gray[500]}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            keyboardType="default"
          />
          <TouchableOpacity onPress={fetchWorkshops} style={styles.refreshBtn} activeOpacity={0.9}>
            <Ionicons name={loading ? 'sync' : 'refresh'} size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View
          style={styles.mapWrap}
          collapsable={false}
          onLayout={(e) => {
            const w = Math.round(e.nativeEvent.layout.width);
            if (w > 0 && w !== mapLayoutW) setMapLayoutW(w);
          }}
        >
          {useWebMap && mapLayoutW > 0 ? (
            <WebView
              ref={webMapRef}
              originWhitelist={['*']}
              source={{ html: osmHtml, baseUrl: 'https://local' }}
              style={{ width: mapLayoutW, height: MAP_H, backgroundColor: '#E8F1FA' }}
              scrollEnabled={false}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
              setSupportMultipleWindows={false}
              androidLayerType="hardware"
              onLoadEnd={() => {
                if (userLoc) panWebMap(userLoc.lat, userLoc.lng);
              }}
              onMessage={(event) => {
                try {
                  const parsed = JSON.parse(String(event.nativeEvent.data || '{}'));
                  if (parsed?.id) setExpandedId(String(parsed.id));
                } catch {
                  /* ignore */
                }
              }}
            />
          ) : canRenderNativeMap && mapLayoutW > 0 ? (
            <MapView
              ref={(r) => {
                mapRef.current = r;
              }}
              style={{ width: mapLayoutW, height: MAP_H }}
              initialRegion={mapRegion}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              googleRenderer={Platform.OS === 'android' ? 'LEGACY' : undefined}
              loadingEnabled
              loadingBackgroundColor="#E8F1FA"
              loadingIndicatorColor={COLORS.primary}
              showsUserLocation={!!userLoc}
              showsMyLocationButton={false}
              showsCompass={false}
              rotateEnabled={false}
              toolbarEnabled={false}
              moveOnMarkerPress={false}
              onMapReady={kickMapTiles}
            >
              {mappable.map((w) => (
                <Marker
                  key={String(w.id)}
                  coordinate={{ latitude: w.latitude, longitude: w.longitude }}
                  title={String(w.workshop_name || w.name || 'Workshop')}
                  description={String(w.city || '')}
                  pinColor="#E11D48"
                  tracksViewChanges={false}
                  onPress={() => setExpandedId(String(w.id))}
                />
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
        <View style={[styles.sheet, embedded ? styles.sheetEmbedded : styles.sheetPublic]}>
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

        {!embedded ? (
          <PublicPillNav
            activeTab="roadside"
            onPressTab={(tab: PublicPillNavTab) => {
              if (tab === 'home') navigation.navigate('PublicHome');
              if (tab === 'services') navigation.navigate('PublicServicePackages', { city });
              if (tab === 'ai') navigation.navigate('AIBooking', { city, fullScreen: true });
              if (tab === 'roadside') navigation.navigate('RoadsideAssistance', { city });
              if (tab === 'account') navigation.navigate('Settings');
              if (tab === 'profile') navigation.navigate('Settings');
              if (tab === 'settings') Alert.alert('Support', 'Use the home screen support option.');
            }}
          />
        ) : null}
      </View>
  );

  if (embedded) {
    return content;
  }

  return <SafeAreaView style={styles.safe}>{content}</SafeAreaView>;
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
    height: MAP_H,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E8F1FA',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
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
  markerContainer: { alignItems: 'center', maxWidth: 160 },
  markerLabel: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    alignItems: 'center',
  },
  markerLabelText: { fontSize: 10, fontWeight: '800', color: '#111827', maxWidth: 140 },
  markerLabelSub: { fontSize: 8, fontWeight: '600', color: '#6B7280' },
  markerArrow: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: COLORS.primary,
    marginBottom: -1,
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
  sheetEmbedded: { bottom: 0 },
  sheetPublic: { bottom: 64 },
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
    paddingBottom: 120,
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
  sheetCenter: {
    marginTop: 3,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sheetSub: { marginTop: 4, fontSize: FONT_SIZES.xs, fontWeight: '600', color: COLORS.gray[600], lineHeight: 16 },
  kmPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EEF6FF',
  },
  kmPillText: { fontSize: FONT_SIZES.xs, fontWeight: '900', color: COLORS.primary },
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


