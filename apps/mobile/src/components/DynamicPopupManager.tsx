import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { ENV } from '../config/environment';
import { COLORS } from '../constants/theme';
import { getCustomerSessionToken } from '../lib/customerSession';

type AppPopup = {
  id: string;
  title: string;
  body: string | null;
  icon: string;
  image_url: string | null;
  primary_button_text: string;
  primary_button_action: string;
  secondary_button_text: string | null;
  target_screens: string[];
  display_rule: string;
  show_for: string;
  priority: number;
};

type Props = {
  screen: string;
};

const DISMISSED_EVER_KEY = 'app_popups_dismissed_ever';
const DISMISSED_SESSION = new Set<string>();
let cachedPopups: AppPopup[] | null = null;
let lastFetchTime = 0;
const CACHE_MS = 5 * 60 * 1000;

async function fetchPopups(): Promise<AppPopup[]> {
  if (cachedPopups && Date.now() - lastFetchTime < CACHE_MS) return cachedPopups;
  try {
    const res = await fetch(`${ENV.API_URL}/api/public/app-popups`);
    if (!res.ok) return cachedPopups || [];
    const json = await res.json();
    cachedPopups = json.popups || [];
    lastFetchTime = Date.now();
    return cachedPopups!;
  } catch {
    return cachedPopups || [];
  }
}

async function getDismissedEver(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_EVER_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

async function markDismissedEver(id: string) {
  try {
    const current = await getDismissedEver();
    current.add(id);
    await AsyncStorage.setItem(DISMISSED_EVER_KEY, JSON.stringify([...current]));
  } catch {}
}

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  gift: 'gift',
  bell: 'notifications',
  star: 'star',
  zap: 'flash',
  heart: 'heart',
  'shield-check': 'shield-checkmark',
  megaphone: 'megaphone',
  tag: 'pricetag',
  'message-square': 'chatbubble',
};

export default function DynamicPopupManager({ screen }: Props) {
  const [popup, setPopup] = useState<AppPopup | null>(null);
  const [visible, setVisible] = useState(false);
  const nav = useNavigation<any>();
  const checked = useRef(false);

  const checkPopups = useCallback(async () => {
    if (checked.current) return;
    checked.current = true;

    const isLoggedIn = Boolean(await getCustomerSessionToken());
    const all = await fetchPopups();
    const dismissedEver = await getDismissedEver();

    for (const p of all) {
      const matchesScreen = p.target_screens.includes('ALL') || p.target_screens.includes(screen);
      if (!matchesScreen) continue;

      if (p.show_for === 'GUEST_ONLY' && isLoggedIn) continue;
      if (p.show_for === 'LOGGED_IN_ONLY' && !isLoggedIn) continue;

      if (p.display_rule === 'ONCE_EVER' && dismissedEver.has(p.id)) continue;
      if (p.display_rule === 'ONCE_PER_SESSION' && DISMISSED_SESSION.has(p.id)) continue;

      setPopup(p);
      setTimeout(() => setVisible(true), 500);
      return;
    }
  }, [screen]);

  useEffect(() => {
    checkPopups();
  }, [checkPopups]);

  const dismiss = async () => {
    if (!popup) return;
    setVisible(false);
    if (popup.display_rule === 'ONCE_EVER') await markDismissedEver(popup.id);
    DISMISSED_SESSION.add(popup.id);
  };

  const handlePrimary = async () => {
    if (!popup) return;
    await dismiss();
    const action = popup.primary_button_action;
    if (action === 'DISMISS') return;
    if (action === 'LOGIN') {
      try { nav.navigate('CustomerOtpLogin'); } catch { /* screen may not exist */ }
      return;
    }
    if (action.startsWith('SCREEN:')) {
      const screenName = action.replace('SCREEN:', '');
      try { nav.navigate(screenName); } catch { /* screen may not exist */ }
      return;
    }
    if (action.startsWith('LINK:')) {
      const url = action.replace('LINK:', '');
      try {
        const { Linking } = require('react-native');
        Linking.openURL(url);
      } catch {}
    }
  };

  if (!popup || !visible) return null;

  const ionIcon = ICON_MAP[popup.icon] || 'gift';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={s.overlay} onPress={dismiss}>
        <Pressable style={s.card} onPress={() => undefined}>
          {popup.image_url ? (
            <Image source={{ uri: popup.image_url }} style={s.image} resizeMode="cover" />
          ) : (
            <View style={s.iconWrap}>
              <View style={s.iconRingOuter}>
                <View style={s.iconRingInner}>
                  <Ionicons name={ionIcon} size={34} color="#FFFFFF" />
                </View>
              </View>
            </View>
          )}

          <Text style={s.title}>{popup.title}</Text>
          {popup.body ? <Text style={s.body}>{popup.body}</Text> : null}

          <TouchableOpacity style={s.primaryBtn} onPress={handlePrimary} activeOpacity={0.88}>
            <Text style={s.primaryBtnText}>{popup.primary_button_text}</Text>
          </TouchableOpacity>

          {popup.secondary_button_text ? (
            <TouchableOpacity style={s.secondaryBtn} onPress={dismiss} activeOpacity={0.85}>
              <Text style={s.secondaryBtnText}>{popup.secondary_button_text}</Text>
            </TouchableOpacity>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    marginBottom: 16,
  },
  iconWrap: { marginBottom: 16 },
  iconRingOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRingInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 20,
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryBtn: { marginTop: 12, paddingVertical: 8 },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});
