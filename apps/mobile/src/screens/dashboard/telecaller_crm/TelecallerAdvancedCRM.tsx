import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  StatusBar,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  Alert,
  BackHandler,
  DeviceEventEmitter,
  PanResponder,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../lib/supabase';
import { useNotifications } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';
import { setAndroidShellBackHandler } from '../../../lib/androidShellBack';
import TelecallerWhatsAppInbox from '../../../components/telecaller/TelecallerWhatsAppInbox';
import TelecallerLeadDetailScreen from '../telecaller/TelecallerLeadDetailScreen';
import {
  CRM_OPEN_LEAD_EVENT,
  takePendingOpenCrmLead,
} from '../../../components/telecaller/IncomingCallLeadOverlay';
import CrmHomeTab from './CrmHomeTab';
import CrmQueueTab from './CrmQueueTab';
import CrmBookWizard from './CrmBookWizard';
import CrmBookChooser from './CrmBookChooser';
import CrmEngageTab from './CrmEngageTab';
import CrmWorkshopLocatorTab from './CrmWorkshopLocatorTab';
import CrmMeTab from './CrmMeTab';
import { COLORS } from '../../../constants/theme';
import { isPartnerPreview, exitPartnerPreview } from '../../../lib/partnerPreview';
import { istDayBounds, istYmd, type CrmDatePreset } from '../../../lib/crmDateRange';
import { crmLeadClosedForFollowUp } from '../../../lib/telecaller/crmFollowUpClose';
import {
  defaultTelecallerCrmFilterPrefs,
  loadTelecallerCrmFilterPrefs,
  saveTelecallerCrmFilterPrefs,
} from '../../../lib/crmFilterPrefs';

/** Keep Home / Leads mounted at full size so search / pickers stay usable after resume. */
const HIDDEN_TAB: ViewStyle = {
  ...StyleSheet.absoluteFillObject,
  opacity: 0,
  zIndex: 0,
};

const PREVIEW_TABS = [
  { id: 'home', label: 'Home', icon: 'home-outline' as const },
  { id: 'queue', label: 'Leads', icon: 'clipboard-outline' as const },
  { id: 'engage', label: 'Reminders', icon: 'alarm-outline' as const },
  { id: 'me', label: 'Profile', icon: 'person-outline' as const },
];

const MENU_TABS = [
  { id: 'home', label: 'Home', icon: 'home-outline' as const },
  { id: 'queue', label: 'Leads', icon: 'clipboard-outline' as const },
  { id: 'book', label: 'Book', icon: 'add-circle-outline' as const },
  { id: 'workshops', label: 'Workshops', icon: 'location-outline' as const },
  { id: 'me', label: 'My Profile', icon: 'person-outline' as const },
];

type NavLeaf = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  kind: 'tab' | 'stack' | 'whatsapp';
  screen?: string;
  params?: Record<string, unknown>;
};

type NavGroup = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: NavLeaf[];
};

type NavRow =
  | ({ type: 'item' } & NavLeaf)
  | ({ type: 'group' } & NavGroup);

/** TeleCRM-style: flat rows + expandable dropdowns (Lead Manager). */
const LM_NAV: NavRow[] = [
  { type: 'item', id: 'home', label: 'Home', icon: 'home-outline', kind: 'tab' },
  { type: 'item', id: 'queue', label: 'Leads', icon: 'clipboard-outline', kind: 'tab' },
  {
    type: 'item',
    id: 'reminders',
    label: 'Reminders',
    icon: 'alarm-outline',
    kind: 'stack',
    screen: 'TelecallerFollowUps',
  },
  {
    type: 'item',
    id: 'assignment',
    label: 'Assignment',
    icon: 'git-branch-outline',
    kind: 'stack',
    screen: 'LeadManagerDashboard',
  },
  {
    type: 'item',
    id: 'escalations',
    label: 'Escalations',
    icon: 'warning-outline',
    kind: 'stack',
    screen: 'LeadManagerEscalations',
  },
  {
    type: 'item',
    id: 'recordings',
    label: 'Recordings',
    icon: 'headset-outline',
    kind: 'stack',
    screen: 'LeadManagerRecordings',
  },
  {
    type: 'item',
    id: 'ai_suite',
    label: 'AI Suite',
    icon: 'sparkles-outline',
    kind: 'stack',
    screen: 'LeadManagerAiSuite',
  },
  {
    type: 'item',
    id: 'call_intelligence',
    label: 'Call IQ',
    icon: 'pulse-outline',
    kind: 'stack',
    screen: 'LeadManagerCallIntelligence',
  },
  {
    type: 'item',
    id: 'lead_iq',
    label: 'Lead IQ',
    icon: 'bulb-outline',
    kind: 'stack',
    screen: 'LeadManagerLeadIq',
  },
  {
    type: 'item',
    id: 'whatsapp',
    label: 'WhatsApp Chat',
    icon: 'logo-whatsapp',
    kind: 'whatsapp',
  },
  { type: 'item', id: 'book', label: 'Add lead / Book', icon: 'person-add-outline', kind: 'tab' },
  {
    type: 'item',
    id: 'workshops_stack',
    label: 'Workshops',
    icon: 'business-outline',
    kind: 'stack',
    screen: 'LeadManagerWorkshops',
  },
  {
    type: 'group',
    id: 'app_ops_group',
    label: 'App customers',
    icon: 'phone-portrait-outline',
    children: [
      {
        id: 'app_bookings',
        label: 'Leads',
        icon: 'clipboard-outline',
        kind: 'stack',
        screen: 'LeadManagerLeads',
      },
      {
        id: 'app_customers',
        label: 'App Customers',
        icon: 'people-outline',
        kind: 'stack',
        screen: 'LeadManagerAppCustomers',
      },
      {
        id: 'workshop_proximity',
        label: 'Workshop Proximity',
        icon: 'navigate-outline',
        kind: 'stack',
        screen: 'LeadManagerWorkshopProximity',
      },
      {
        id: 'membership_customers',
        label: 'Membership Customers',
        icon: 'ribbon-outline',
        kind: 'stack',
        screen: 'LeadManagerMembershipCustomers',
      },
      {
        id: 'refer_and_rise',
        label: 'Refer & Rise',
        icon: 'gift-outline',
        kind: 'stack',
        screen: 'LeadManagerReferral',
      },
    ],
  },
  {
    type: 'group',
    id: 'team_group',
    label: 'Team',
    icon: 'people-circle-outline',
    children: [
      {
        id: 'floor',
        label: 'Live floor',
        icon: 'pulse-outline',
        kind: 'stack',
        screen: 'LeadManagerFloor',
      },
      {
        id: 'login_activity',
        label: 'Login activity',
        icon: 'time-outline',
        kind: 'stack',
        screen: 'LeadManagerLoginActivity',
      },
      {
        id: 'team_wa',
        label: 'Team WA',
        icon: 'chatbubbles-outline',
        kind: 'stack',
        screen: 'LeadManagerTeamWhatsApp',
      },
      {
        id: 'wa_dnd',
        label: 'WA DND',
        icon: 'ban-outline',
        kind: 'stack',
        screen: 'LeadManagerWhatsAppDnd',
      },
      {
        id: 'team',
        label: 'Team phones',
        icon: 'call-outline',
        kind: 'stack',
        screen: 'LeadManagerTeam',
      },
      {
        id: 'telecaller_ids',
        label: 'Telecaller IDs',
        icon: 'person-add-outline',
        kind: 'stack',
        screen: 'LeadManagerTelecallerIds',
      },
      {
        id: 'ctc',
        label: 'Click to Call',
        icon: 'phone-portrait-outline',
        kind: 'stack',
        screen: 'LeadManagerClickToCall',
      },
    ],
  },
  {
    type: 'group',
    id: 'labels_group',
    label: 'Labels',
    icon: 'pricetag-outline',
    children: [
      {
        id: 'tags',
        label: 'Lead tags',
        icon: 'pricetags-outline',
        kind: 'stack',
        screen: 'LeadManagerTags',
      },
      {
        id: 'statuses',
        label: 'Lead status',
        icon: 'ellipse-outline',
        kind: 'stack',
        screen: 'LeadManagerStatuses',
      },
    ],
  },
  {
    type: 'group',
    id: 'templates_group',
    label: 'Msg Templates',
    icon: 'chatbox-ellipses-outline',
    children: [
      {
        id: 'scripts',
        label: 'Call scripts',
        icon: 'document-text-outline',
        kind: 'stack',
        screen: 'TelecallerScripts',
      },
      {
        id: 'wa_templates',
        label: 'WhatsApp templates',
        icon: 'logo-whatsapp',
        kind: 'stack',
        screen: 'CrmWhatsAppTemplates',
      },
    ],
  },
  {
    type: 'group',
    id: 'reports_group',
    label: 'Reports',
    icon: 'trophy-outline',
    children: [
      {
        id: 'reports_lb',
        label: 'Leaderboard',
        icon: 'trophy-outline',
        kind: 'stack',
        screen: 'CrmReports',
        params: { tab: 'leaderboard' },
      },
      {
        id: 'reports_calls',
        label: 'Call activity',
        icon: 'call-outline',
        kind: 'stack',
        screen: 'CrmReports',
        params: { tab: 'calls' },
      },
      {
        id: 'reports_export',
        label: 'Exports',
        icon: 'download-outline',
        kind: 'stack',
        screen: 'CrmReports',
        params: { tab: 'exports' },
      },
      {
        id: 'reports_dup',
        label: 'Duplicates',
        icon: 'git-network-outline',
        kind: 'stack',
        screen: 'CrmReports',
        params: { tab: 'duplicates' },
      },
      {
        id: 'reports_lm',
        label: 'Analytics',
        icon: 'analytics-outline',
        kind: 'stack',
        screen: 'LeadManagerReports',
      },
    ],
  },
  {
    type: 'item',
    id: 'pipeline',
    label: 'Pipeline',
    icon: 'stats-chart-outline',
    kind: 'stack',
    screen: 'CrmReports',
    params: { tab: 'pipeline' },
  },
  {
    type: 'group',
    id: 'settings_group',
    label: 'Settings',
    icon: 'settings-outline',
    children: [
      { id: 'me', label: 'My Profile', icon: 'person-outline', kind: 'tab' },
      {
        id: 'readme',
        label: 'ReadMe',
        icon: 'book-outline',
        kind: 'stack',
        screen: 'CrmReadMe',
        params: { role: 'LEAD_MANAGER' },
      },
    ],
  },
];


/** TeleCRM-style nav for Telecaller role. */
const TC_NAV: NavRow[] = [
  { type: 'item', id: 'home', label: 'Home', icon: 'home-outline', kind: 'tab' },
  { type: 'item', id: 'queue', label: 'Leads', icon: 'clipboard-outline', kind: 'tab' },
  {
    type: 'item',
    id: 'reminders',
    label: 'Reminders',
    icon: 'alarm-outline',
    kind: 'stack',
    screen: 'TelecallerFollowUps',
  },
  {
    type: 'item',
    id: 'whatsapp',
    label: 'WhatsApp Chat',
    icon: 'logo-whatsapp',
    kind: 'whatsapp',
  },
  { type: 'item', id: 'book', label: 'Add lead / Book', icon: 'person-add-outline', kind: 'tab' },
  {
    type: 'item',
    id: 'dialer',
    label: 'Dialer',
    icon: 'keypad-outline',
    kind: 'stack',
    screen: 'CrmDialer',
  },
  {
    type: 'item',
    id: 'workshops',
    label: 'Workshops',
    icon: 'location-outline',
    kind: 'tab',
  },
  {
    type: 'item',
    id: 'zone_prices',
    label: 'Zone Prices',
    icon: 'pricetag-outline',
    kind: 'stack',
    screen: 'ZoneServicePrices',
  },
  {
    type: 'item',
    id: 'scripts',
    label: 'Call scripts',
    icon: 'document-text-outline',
    kind: 'stack',
    screen: 'TelecallerScripts',
  },
  {
    type: 'group',
    id: 'settings_group',
    label: 'Settings',
    icon: 'settings-outline',
    children: [
      { id: 'me', label: 'My Profile', icon: 'person-outline', kind: 'tab' },
      {
        id: 'readme',
        label: 'ReadMe',
        icon: 'book-outline',
        kind: 'stack',
        screen: 'CrmReadMe',
        params: { role: 'TELECALLER' },
      },
    ],
  },
];

/**
 * Advanced Telecaller CRM — hamburger menu + Home | Leads | Book | Workshops | Me
 * Date + status filters are shared between Home and Leads and persisted.
 */
function chimeWavBase64() {
  const rate = 16000;
  const n = Math.floor(rate * 0.36);
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 5.5);
    const a = Math.sin(2 * Math.PI * 740 * t);
    const b = t > 0.1 ? Math.sin(2 * Math.PI * 988 * (t - 0.1)) : 0;
    const s = Math.max(-1, Math.min(1, (a * 0.55 + b * 0.4) * env));
    pcm[i] = (s * 28000) | 0;
  }
  const dataLen = pcm.length * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buf);
  const writeStr = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLen, true);
  let offset = 44;
  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(offset, pcm[i], true);
    offset += 2;
  }
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

let chimePlayer: { play: () => void; remove?: () => void } | null = null;
let chimeReady: Promise<string> | null = null;

async function playFollowUpChime() {
  try {
    const FileSystem = await import('expo-file-system');
    const audio = (await import('expo-audio')) as {
      createAudioPlayer: (source: { uri: string }) => { play: () => void; remove?: () => void };
    };
    if (!chimeReady) {
      chimeReady = (async () => {
        const uri = `${FileSystem.cacheDirectory}fu-chime.wav`;
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) {
          await FileSystem.writeAsStringAsync(uri, chimeWavBase64(), {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
        return uri;
      })();
    }
    const uri = await chimeReady;
    chimePlayer?.remove?.();
    const player = audio.createAudioPlayer({ uri });
    chimePlayer = player;
    player.play();
  } catch {
    /* sound is optional */
  }
}

function FollowUpFloatCard({
  note,
  onOpen,
  onClose,
}: {
  note: { key: string; name: string; reason: string; whenLabel: string; title: string };
  onOpen: () => void;
  onClose: () => void;
}) {
  const slide = useRef(new Animated.Value(28)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 8, tension: 80 }),
    ]).start();
  }, [fade, slide]);
  return (
    <Animated.View style={[styles.floatCard, { opacity: fade, transform: [{ translateX: slide }] }]}>
      <View style={styles.floatAccent} />
      <View style={styles.floatIcon}>
        <Ionicons name="time-outline" size={16} color="#8A6A2F" />
      </View>
      <TouchableOpacity style={{ flex: 1 }} onPress={onOpen}>
        <Text style={styles.floatKicker}>{note.title}</Text>
        <Text style={styles.floatName} numberOfLines={1}>{note.name}</Text>
        <Text style={styles.floatReason} numberOfLines={1}>
          {note.whenLabel}{note.reason ? ` · ${note.reason}` : ''}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color="#A8A29E" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function TelecallerAdvancedCRM() {
  const stackNav = useNavigation<any>();
  const route = useRoute();
  const { unreadCount, refreshNotifications } = useNotifications();
  const { logout: authLogout, user } = useAuth();
  const isLeadManager = String(route?.name || '').includes('LeadManager');
  const preview = isPartnerPreview();
  const insets = useSafeAreaInsets();
  const drawerNav = isLeadManager ? LM_NAV : TC_NAV;
  const drawerTopPad =
    Math.max(
      insets.top,
      Platform.OS === 'android' ? StatusBar.currentHeight || 28 : 50,
    ) + 12;
  const defaults = defaultTelecallerCrmFilterPrefs();
  const [tab, setTab] = useState('home');
  const [previewGate, setPreviewGate] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [queueFilter, setQueueFilter] = useState(defaults.statusFilter);
  const [queueQuery, setQueueQuery] = useState('');
  const [engageSegment, setEngageSegment] = useState('followups');
  const [bookMode, setBookMode] = useState<'book' | 'lead' | null>(null);
  const [bookPrefillPhone, setBookPrefillPhone] = useState<string | null>(null);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>(defaults.datePreset);
  const [customStart, setCustomStart] = useState(defaults.customStart || istYmd());
  const [customEnd, setCustomEnd] = useState(defaults.customEnd || istYmd());
  const [prefsReady, setPrefsReady] = useState(false);
  const [drawerOpenGroups, setDrawerOpenGroups] = useState<Record<string, boolean>>({
    leads_group: true,
  });
  const [drawerUser, setDrawerUser] = useState<{
    name: string;
    email: string;
  } | null>(null);
  const [reminderBadge, setReminderBadge] = useState(0);
  const [floatNotes, setFloatNotes] = useState<
    Array<{ key: string; leadId: string; name: string; reason: string; whenLabel: string; title: string }>
  >([]);
  const firedSlots = useRef(new Set<string>());

  const checkSameDayFloats = useCallback(async () => {
    if (preview) {
      setFloatNotes([]);
      setReminderBadge(0);
      return;
    }
    try {
      const email = String(user?.email || '').trim();
      let profileId: string | null = null;
      if (email) {
        const { data: profile } = await supabase
          .from('users_login')
          .select('id')
          .ilike('email', email)
          .maybeSingle();
        profileId = profile?.id ? String(profile.id) : null;
      }
      const ymd = istYmd();
      const bounds = istDayBounds(ymd);
      let q = supabase
        .from('telecaller_follow_ups')
        .select(
          'id, lead_id, reason, scheduled_time, lead:lead_id(customer_name, status, coupon_meta, deleted_at)',
        )
        .eq('status', 'PENDING')
        .gte('scheduled_time', bounds.start)
        .lte('scheduled_time', bounds.end)
        .order('scheduled_time', { ascending: true })
        .limit(60);
      if (!isLeadManager && profileId) q = q.eq('telecaller_id', profileId);
      const { data } = await q;
      const now = Date.now();
      const morningKey = `myfng-fu-morning:${ymd}`;
      const showMorning = (await AsyncStorage.getItem(morningKey)) !== '1';
      if (showMorning) await AsyncStorage.setItem(morningKey, '1');
      const fresh: Array<{ key: string; leadId: string; name: string; reason: string; whenLabel: string; title: string }> = [];
      let upcoming = 0;
      for (const row of data || []) {
        const lead = (row as any).lead;
        if (!lead || lead.deleted_at || crmLeadClosedForFollowUp(lead)) continue;
        const at = String((row as any).scheduled_time || '');
        const when = new Date(at).getTime();
        if (!Number.isFinite(when)) continue;
        const remaining = when - now;
        if (remaining <= 0) continue;
        upcoming += 1;
        const slot: 30 | 15 | 5 | null =
          remaining <= 5 * 60 * 1000 ? 5 : remaining <= 15 * 60 * 1000 ? 15 : remaining <= 30 * 60 * 1000 ? 30 : null;
        const id = String((row as any).id || '');
        const whenLabel = new Date(at).toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        const leadId = String((row as any).lead_id || '');
        const name = String(lead.customer_name || 'Customer');
        const reason = String((row as any).reason || 'Follow-up');
        if (showMorning && id) {
          const key = `${id}:morning`;
          if (!firedSlots.current.has(key)) {
            firedSlots.current.add(key);
            fresh.push({ key, leadId, name, reason, whenLabel, title: "Today's follow-up" });
          }
          if (slot) firedSlots.current.add(`${id}:${slot}`);
        }
        if (!slot || !id) continue;
        const key = `${id}:${slot}`;
        if (firedSlots.current.has(key)) continue;
        firedSlots.current.add(key);
        fresh.push({ key, leadId, name, reason, whenLabel, title: `Follow-up in ${slot} min` });
      }
      if (fresh.length) {
        void playFollowUpChime();
        setFloatNotes((prev) => [...fresh, ...prev].slice(0, 8));
        const drop = new Set(fresh.map((note) => note.key));
        setTimeout(() => {
          setFloatNotes((prev) => prev.filter((row) => !drop.has(row.key)));
        }, 30_000);
      }
      setReminderBadge(Math.min(upcoming, 99));
    } catch {
      /* keep last cards */
    }
  }, [isLeadManager, preview, user?.email]);

  useEffect(() => {
    void checkSameDayFloats();
    const t = setInterval(() => void checkSameDayFloats(), 20_000);
    return () => clearInterval(t);
  }, [checkSameDayFloats]);

  useFocusEffect(
    useCallback(() => {
      void refreshNotifications();
    }, [refreshNotifications]),
  );

  useEffect(() => {
    const phone = String((route.params as any)?.openAddLeadPhone || '')
      .replace(/\D/g, '')
      .slice(-10);
    if (phone.length !== 10) return;
    setBookPrefillPhone(phone);
    setBookMode('lead');
    setTab('book');
    setDetailLeadId(null);
    try {
      stackNav.setParams({ openAddLeadPhone: undefined });
    } catch {
      /* ignore */
    }
  }, [(route.params as any)?.openAddLeadPhone, stackNav]);

  const consumeInnerBack = useCallback(() => {
    if (menuOpen) {
      setMenuOpen(false);
      return true;
    }
    if (whatsAppOpen) {
      setWhatsAppOpen(false);
      return true;
    }
    if (preview && previewGate) {
      setPreviewGate(null);
      return true;
    }
    if (detailLeadId) {
      setDetailLeadId(null);
      setDetailEditing(false);
      return true;
    }
    if (bookMode) {
      setBookMode(null);
      setTab('home');
      return true;
    }
    if (tab !== 'home') {
      setTab('home');
      return true;
    }
    return false;
  }, [menuOpen, whatsAppOpen, preview, previewGate, detailLeadId, bookMode, tab]);

  const consumeRef = useRef(consumeInnerBack);
  consumeRef.current = consumeInnerBack;
  const edgeSwipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (evt, g) => {
        const startX = evt.nativeEvent.pageX - g.dx;
        return startX < 28 && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2;
      },
      onPanResponderRelease: (_evt, g) => {
        if (g.dx > 64 && g.dx > Math.abs(g.dy)) consumeRef.current();
      },
    }),
  ).current;

  const onAndroidBack = useCallback(() => {
    if (consumeInnerBack()) return true;
    if (stackNav.canGoBack()) {
      stackNav.goBack();
      return true;
    }
    return false;
  }, [consumeInnerBack, stackNav]);

  useEffect(() => {
    setAndroidShellBackHandler(onAndroidBack);
    const sub = BackHandler.addEventListener('hardwareBackPress', onAndroidBack);
    // Native stack can finish the activity on Android even when JS BackHandler
    // returns true. Catch the CRM root screen being popped and keep the user in-app.
    const unsub = stackNav.addListener('beforeRemove', (e: any) => {
      const type = String(e?.data?.action?.type || '');
      if (type && !['GO_BACK', 'POP', 'POP_TO_TOP'].includes(type)) return;
      e.preventDefault();
      consumeInnerBack();
    });
    return () => {
      setAndroidShellBackHandler(null);
      sub.remove();
      unsub();
    };
  }, [onAndroidBack, consumeInnerBack, stackNav]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = await loadTelecallerCrmFilterPrefs();
      if (cancelled) return;
      setDatePreset(prefs.datePreset);
      setCustomStart(prefs.customStart);
      setCustomEnd(prefs.customEnd);
      setQueueFilter(prefs.statusFilter || 'all');
      setPrefsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await supabase
          .from('users_login')
          .select('full_name, email')
          .eq('id', user.id)
          .maybeSingle();
        const name = String(data?.full_name || 'MyFNG').trim() || 'MyFNG';
        const email = String(data?.email || user.email || '').trim();
        if (!cancelled) setDrawerUser({ name, email });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [menuOpen]);

  const persistDatePreset = useCallback((value: CrmDatePreset) => {
    setDatePreset(value);
    void saveTelecallerCrmFilterPrefs({ datePreset: value });
  }, []);
  const persistCustomStart = useCallback((value: string) => {
    setCustomStart(value);
    void saveTelecallerCrmFilterPrefs({ customStart: value, datePreset: 'custom' });
  }, []);
  const persistCustomEnd = useCallback((value: string) => {
    setCustomEnd(value);
    void saveTelecallerCrmFilterPrefs({ customEnd: value, datePreset: 'custom' });
  }, []);
  const persistQueueFilter = useCallback((value: string) => {
    setQueueFilter(value);
    void saveTelecallerCrmFilterPrefs({ statusFilter: value });
  }, []);

  const goHome = () => {
    setMenuOpen(false);
    setWhatsAppOpen(false);
    setDetailLeadId(null);
    setDetailEditing(false);
    setBookMode(null);
    setBookPrefillPhone(null);
    setTab('home');
  };

  const openLead = (leadId: string, _editing = true) => {
    const id = String(leadId || '').trim();
    if (!id) return;
    setWhatsAppOpen(false);
    setMenuOpen(false);
    setBookMode(null);
    setDetailEditing(true);
    setDetailLeadId(id);
  };

  useEffect(() => {
    const pending = takePendingOpenCrmLead();
    if (pending) openLead(pending, true);
    const sub = DeviceEventEmitter.addListener(CRM_OPEN_LEAD_EVENT, (payload: { leadId?: string }) => {
      const id = String(payload?.leadId || '').trim();
      if (id) openLead(id, true);
    });
    return () => sub.remove();
  }, []);

  const dateProps = {
    datePreset,
    customStart,
    customEnd,
    onDatePresetChange: persistDatePreset,
    onCustomStartChange: persistCustomStart,
    onCustomEndChange: persistCustomEnd,
  };

  const navigation = {
    navigate: (screen: string, params?: any) => {
      if (
        (screen === 'TelecallerLeadDetail' || screen === 'TelecallerEditLead') &&
        params?.leadId
      ) {
        openLead(params.leadId, screen === 'TelecallerEditLead' || Boolean(params?.editing));
        return;
      }
      if (
        screen === 'TelecallerRSA' ||
        screen === 'telecallerRsa' ||
        screen === 'TelecallerRSACreateComplaint' ||
        screen === 'TelecallerRSAComplaintDetail'
      ) {
        // Engage / RSA entry disabled from CRM menu
        return;
      }
      if (screen === 'followups' || screen === 'TelecallerFollowUps') {
        try {
          stackNav.navigate('TelecallerFollowUps', params);
        } catch {
          /* ignore */
        }
        return;
      }
      if (screen === 'Notifications' || screen === 'notifications') {
        try {
          stackNav.navigate('Notifications');
        } catch {
          /* ignore */
        }
        return;
      }
      if (screen === 'scripts' || screen === 'TelecallerScripts') {
        try {
          stackNav.navigate('TelecallerScripts', params);
        } catch {
          /* ignore */
        }
        return;
      }
      if (screen === 'queue' || screen === 'leads' || screen === 'TelecallerLeads') {
        setQueueFilter(params?.filter || 'all');
        if (typeof params?.q === 'string') setQueueQuery(params.q);
        setTab('queue');
        return;
      }
      if (screen === 'book' || screen === 'createLead' || screen === 'TelecallerCreateLead') {
        setBookMode(
          params?.mode === 'lead' || screen === 'createLead'
            ? 'lead'
            : params?.mode === 'book'
              ? 'book'
              : null,
        );
        setTab('book');
        return;
      }
      if (screen === 'profile' || screen === 'TelecallerProfile') {
        setTab('me');
        return;
      }
      if (screen === 'home' || screen === 'dashboard' || screen === 'TelecallerDashboard') {
        setTab('home');
        setDetailLeadId(null);
        setDetailEditing(false);
        return;
      }
      if (screen === 'CrmReports' || screen === 'reports' || screen === 'LeadManagerReports') {
        try {
          stackNav.navigate('CrmReports', params);
        } catch {
          /* ignore if stack unavailable */
        }
        return;
      }
      try {
        stackNav.navigate(screen, params);
      } catch {
        /* ignore */
      }
    },
    goBack: () => {
      if (detailLeadId) {
        setDetailLeadId(null);
        setDetailEditing(false);
        return;
      }
      if (bookMode) {
        setBookMode(null);
        setTab('home');
        return;
      }
      if (tab !== 'home') {
        setTab('home');
        return;
      }
    },
  };

  const handleTabChange = (id: string) => {
    if (id === 'engage') {
      setMenuOpen(false);
      return;
    }
    setDetailLeadId(null);
    setDetailEditing(false);
    setBookMode(null);
    setTab(id);
    setMenuOpen(false);
  };

  const runNavLeaf = (item: NavLeaf) => {
    if (item.kind === 'whatsapp') {
      setMenuOpen(false);
      setWhatsAppOpen(true);
      return;
    }
    if (item.kind === 'stack' && item.screen) {
      setMenuOpen(false);
      try {
        stackNav.navigate(item.screen, item.params || undefined);
      } catch {
        /* missing */
      }
      return;
    }
    handleTabChange(item.id);
  };

  const toggleGroup = (id: string) => {
    setDrawerOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Logout karna hai?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          setMenuOpen(false);
          void authLogout();
        },
      },
    ]);
  };

  const showHome = prefsReady;
  const showQueue = prefsReady;
  const homeActive = tab === 'home' && !detailLeadId;
  const queueActive = tab === 'queue' && !detailLeadId;

  return (
    <SafeAreaView style={styles.container} edges={['top']} {...edgeSwipe.panHandlers}>
      <StatusBar barStyle={detailLeadId ? 'light-content' : 'dark-content'} />

      {!detailLeadId ? (
        <View style={styles.topBar}>
          <View style={styles.topSide} pointerEvents="box-none">
            {preview ? (
              <Image
                source={require('../../../../assets/logo.png')}
                style={styles.previewLogo}
                resizeMode="contain"
              />
            ) : (
            <>
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => setMenuOpen(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
            >
              <Ionicons name="menu" size={26} color={COLORS.primary} />
            </TouchableOpacity>
            </>
            )}
          </View>
          {preview ? null : (
          <View style={styles.topCenter} pointerEvents="box-none">
            <TouchableOpacity
              onPress={goHome}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Go to home"
            >
              <Image
                source={require('../../../../assets/logo.png')}
                style={styles.topLogo}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
          )}
          <View style={styles.topSideRight} pointerEvents="box-none">
            {preview ? (
              <TouchableOpacity
                style={styles.previewLoginBtn}
                onPress={() => exitPartnerPreview()}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Login"
              >
                <Text style={styles.previewLoginText}>Login</Text>
              </TouchableOpacity>
            ) : (
            <>
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => navigation.navigate('TelecallerFollowUps')}
              accessibilityLabel="Reminders"
            >
              <Ionicons name="alarm-outline" size={22} color={COLORS.primary} />
              {reminderBadge > 0 ? (
                <View style={styles.topBadge}>
                  <Text style={styles.topBadgeText}>
                    {reminderBadge > 99 ? '99+' : String(reminderBadge)}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => {
                try {
                  stackNav.navigate('Notifications');
                } catch {
                  /* ignore */
                }
              }}
              accessibilityLabel={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : 'Notifications'
              }
            >
              <Ionicons name="notifications-outline" size={22} color={COLORS.primary} />
              {unreadCount > 0 ? (
                <View style={styles.topBadge}>
                  <Text style={styles.topBadgeText}>
                    {unreadCount > 99 ? '99+' : String(unreadCount)}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={handleLogout}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Logout"
              accessibilityRole="button"
            >
              <Ionicons name="log-out-outline" size={22} color="#DC2626" />
            </TouchableOpacity>
            </>
            )}
          </View>
        </View>
      ) : null}

      <View style={styles.body}>
        {showHome ? (
          <View
            style={[styles.body, homeActive ? styles.activeTab : HIDDEN_TAB]}
            pointerEvents={homeActive ? 'auto' : 'none'}
          >
            <CrmHomeTab
              {...dateProps}
              embedInShell
              isActive={homeActive}
              onRemindersCount={undefined}
              onNavigate={(screen, params) => {
                if (preview) {
                  if (screen === 'queue' || screen === 'engage' || screen === 'me') {
                    setPreviewGate(screen);
                  }
                  return;
                }
                if (screen === 'queue') {
                  setQueueFilter(params?.filter || 'all');
                  if (typeof params?.q === 'string') setQueueQuery(params.q);
                  setTab('queue');
                  return;
                }
                if (screen === 'book') {
                  setBookMode(
                    params?.mode === 'lead' ? 'lead' : params?.mode === 'book' ? 'book' : null,
                  );
                  setTab('book');
                  return;
                }
                if (screen === 'engage') {
                  // Engage / RSA temporarily disabled from CRM shell
                  return;
                }
                if (screen === 'workshops' || screen === 'workshopLocator') {
                  setTab('workshops');
                  return;
                }
                if (screen === 'reports' || screen === 'CrmReports' || screen === 'LeadManagerReports') {
                  stackNav.navigate('CrmReports', params);
                  return;
                }
                navigation.navigate(screen, params);
              }}
              onOpenWhatsApp={() => setWhatsAppOpen(true)}
            />
          </View>
        ) : null}

        {showQueue ? (
          <View
            style={[styles.body, queueActive ? styles.activeTab : HIDDEN_TAB]}
            pointerEvents={queueActive ? 'auto' : 'none'}
            collapsable={false}
          >
            <CrmQueueTab
              {...dateProps}
              managerOps={isLeadManager}
              initialFilter={queueFilter}
              initialQuery={queueQuery}
              onFilterChange={persistQueueFilter}
              onOpenLead={(id) => openLead(id, true)}
              onEditLead={(id) => openLead(id, true)}
            />
          </View>
        ) : null}

        {detailLeadId ? (
          <View style={styles.body}>
            <TelecallerLeadDetailScreen
              key={`${detailLeadId}-${detailEditing ? 'edit' : 'view'}`}
              navigation={navigation}
              route={{ params: { leadId: detailLeadId } }}
              embedded
              initialEditing={detailEditing}
              showLeadIq={isLeadManager}
            />
          </View>
        ) : null}

        {tab === 'book' && !bookMode && !detailLeadId && (
          <CrmBookChooser
            onPick={(mode) => setBookMode(mode)}
            onCancel={() => setTab('home')}
          />
        )}
        {tab === 'book' && bookMode && !detailLeadId && (
          <CrmBookWizard
            key={`${bookMode}-${bookPrefillPhone || 'x'}`}
            initialMode={bookMode}
            initialPhone={bookPrefillPhone}
            hideModeSwitch
            onDone={(leadId) => {
              setBookMode(null);
              setBookPrefillPhone(null);
              openLead(leadId, true);
            }}
            onCancel={() => {
              setBookMode(null);
              setBookPrefillPhone(null);
            }}
          />
        )}
        {tab === 'workshops' && !detailLeadId && <CrmWorkshopLocatorTab navigation={navigation} />}
        {tab === 'engage' && !detailLeadId && (
          <CrmEngageTab navigation={navigation} initialSegment={engageSegment} />
        )}
        {tab === 'me' && !detailLeadId && (
          <CrmMeTab
            isLeadManager={isLeadManager}
            navigation={{
              ...navigation,
              navigate: (screen: string, params?: any) => {
                if (screen === 'CrmReports' || screen === 'reports' || screen === 'LeadManagerReports') {
                  stackNav.navigate('CrmReports', params);
                  return;
                }
                if (
                  screen === 'LeadManagerFloor' ||
                  screen === 'LeadManagerLoginActivity' ||
                  screen === 'LeadManagerTeamWhatsApp' ||
                  screen === 'LeadManagerWhatsAppDnd' ||
                  screen === 'LeadManagerStatuses' ||
                  screen === 'LeadManagerTeam' ||
                  screen === 'LeadManagerTags' ||
                  screen === 'LeadManagerClickToCall' ||
                  screen === 'LeadManagerEscalations' ||
                  screen === 'LeadManagerDashboard' ||
                  screen === 'LeadManagerWorkshops' ||
                  screen === 'LeadManagerReports' ||
                  screen === 'CrmReports'
                ) {
                  stackNav.navigate(screen, params);
                  return;
                }
                navigation.navigate(screen, params);
              },
            }}
            active
          />
        )}
        {preview && previewGate ? (
          <View style={styles.loginRequired}>
            <Ionicons name="lock-closed-outline" size={40} color="#004AAD" />
            <Text style={styles.loginRequiredTitle}>Login required</Text>
            <Text style={styles.loginRequiredBody}>
              Sign in to open {PREVIEW_TABS.find((item) => item.id === previewGate)?.label || 'this page'}.
            </Text>
            <TouchableOpacity style={styles.loginRequiredBtn} onPress={() => exitPartnerPreview()} activeOpacity={0.9}>
              <Text style={styles.loginRequiredBtnText}>Login</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <TelecallerWhatsAppInbox
        visible={whatsAppOpen}
        onClose={() => setWhatsAppOpen(false)}
        onOpenLead={(leadId) => {
          setWhatsAppOpen(false);
          navigation.navigate('TelecallerLeadDetail', { leadId });
        }}
      />

      {preview && !detailLeadId ? (
        <View style={[styles.previewBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {PREVIEW_TABS.map((item) => {
            const active = (previewGate || 'home') === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.previewTab}
                onPress={() => {
                  if (item.id === 'home') {
                    setPreviewGate(null);
                    setDetailLeadId(null);
                    setBookMode(null);
                    setTab('home');
                    return;
                  }
                  setPreviewGate(item.id);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name={item.icon} size={22} color={active ? '#FFFFFF' : 'rgba(255,255,255,0.72)'} />
                <Text style={[styles.previewTabText, active && styles.previewTabTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {floatNotes.length > 0 ? (
        <View style={styles.floatStack} pointerEvents="box-none">
          {floatNotes.map((note) => (
            <FollowUpFloatCard
              key={note.key}
              note={note}
              onOpen={() => {
                setFloatNotes((prev) => prev.filter((row) => row.key !== note.key));
                if (note.leadId) navigation.navigate('TelecallerLeadDetail', { leadId: note.leadId });
              }}
              onClose={() => setFloatNotes((prev) => prev.filter((row) => row.key !== note.key))}
            />
          ))}
        </View>
      ) : null}

      {preview ? null : (
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.drawerRoot}>
          <View style={styles.drawerPanel}>
            <View style={styles.drawerSafe}>
              {/* Brand avatar — always MyFNG icon for telecaller / LM CRM */}
              <View style={[styles.tcHeader, { paddingTop: drawerTopPad }]}>
                <View style={styles.tcAvatar}>
                  <Image
                    source={require('../../../../assets/profile-default.png')}
                    style={styles.tcAvatarLogo}
                    resizeMode="cover"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.tcName} numberOfLines={1}>
                    {drawerUser?.name || (isLeadManager ? 'Lead Manager' : 'Telecaller')}
                  </Text>
                  <Text style={styles.tcEmail} numberOfLines={1}>
                    {drawerUser?.email || '—'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setMenuOpen(false)}
                  hitSlop={12}
                  style={styles.tcClose}
                >
                  <Ionicons name="close" size={20} color="#E0F2FE" />
                </TouchableOpacity>
              </View>

              <View style={styles.tcQuickRow}>
                <TouchableOpacity
                  style={styles.tcQuick}
                  onPress={() => runNavLeaf({ id: 'queue', label: 'Leads', icon: 'search', kind: 'tab' })}
                >
                  <Ionicons name="search-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.tcQuickLbl}>Search</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tcQuick}
                  onPress={() =>
                    runNavLeaf({
                      id: 'book',
                      label: 'Book',
                      icon: 'person-add',
                      kind: 'tab',
                    })
                  }
                >
                  <Ionicons name="person-add-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.tcQuickLbl}>Add lead</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.tcDivider} />

              <ScrollView
                contentContainerStyle={[styles.drawerList, { paddingBottom: 32 + insets.bottom }]}
                keyboardShouldPersistTaps="handled"
              >
                {drawerNav.map((row) => {
                  if (row.type === 'item') {
                    const active = row.kind === 'tab' && tab === row.id && !detailLeadId;
                    return (
                      <TouchableOpacity
                        key={row.id}
                        style={[styles.tcRow, active && styles.tcRowActive]}
                        onPress={() => runNavLeaf(row)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={row.icon}
                          size={20}
                          color={
                            active
                              ? '#FFFFFF'
                              : row.id === 'whatsapp'
                                ? '#86EFAC'
                                : 'rgba(255,255,255,0.92)'
                          }
                        />
                        <Text style={[styles.tcRowText, active && styles.tcRowTextActive]}>
                          {row.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                  const open = Boolean(drawerOpenGroups[row.id]);
                  return (
                    <View key={row.id}>
                      <TouchableOpacity
                        style={styles.tcRow}
                        onPress={() => toggleGroup(row.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={row.icon} size={20} color="rgba(255,255,255,0.92)" />
                        <Text style={styles.tcRowText}>{row.label}</Text>
                        <Ionicons
                          name={open ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color="rgba(255,255,255,0.65)"
                        />
                      </TouchableOpacity>
                      {open
                        ? row.children.map((child) => {
                            const active =
                              child.kind === 'tab' && tab === child.id && !detailLeadId;
                            return (
                              <TouchableOpacity
                                key={child.id}
                                style={[styles.tcChild, active && styles.tcRowActive]}
                                onPress={() => runNavLeaf(child)}
                                activeOpacity={0.7}
                              >
                                <Ionicons
                                  name={child.icon}
                                  size={18}
                                  color={
                                    child.id === 'wa_templates' || child.icon === 'logo-whatsapp'
                                      ? '#86EFAC'
                                      : 'rgba(226,232,240,0.95)'
                                  }
                                />
                                <Text
                                  style={[
                                    styles.tcChildText,
                                    active && styles.tcRowTextActive,
                                  ]}
                                >
                                  {child.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })
                        : null}
                    </View>
                  );
                })}

                <View style={styles.tcDivider} />
                <TouchableOpacity
                  style={styles.tcLogoutRow}
                  onPress={handleLogout}
                  activeOpacity={0.75}
                  accessibilityLabel="Logout"
                >
                  <Ionicons name="log-out-outline" size={20} color="#FECACA" />
                  <Text style={styles.tcLogoutText}>Logout</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
          <Pressable style={styles.drawerScrim} onPress={() => setMenuOpen(false)} />
        </View>
      </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, position: 'relative' },
  previewBar: {
    flexDirection: 'row',
    backgroundColor: '#004AAD',
    paddingTop: 8,
  },
  previewTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  previewTabText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '600',
  },
  previewTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  loginRequired: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  loginRequiredTitle: {
    marginTop: 12,
    color: '#023D95',
    fontSize: 22,
    fontWeight: '700',
  },
  loginRequiredBody: {
    marginTop: 8,
    color: '#3A3F45',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  loginRequiredBtn: {
    marginTop: 20,
    backgroundColor: '#004AAD',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  loginRequiredBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  body: { flex: 1, minHeight: 0, overflow: 'hidden' },
  activeTab: { zIndex: 2, overflow: 'visible' },
  topBar: {
    zIndex: 20,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
    position: 'relative',
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBadge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  topBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  topSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    zIndex: 6,
    elevation: 8,
  },
  topSideRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 6,
    elevation: 8,
  },
  topCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
    elevation: 0,
  },
  topLogo: {
    width: 108,
    height: 32,
  },
  previewLogo: {
    width: 108,
    height: 32,
    marginLeft: 10,
  },
  previewLoginBtn: {
    marginRight: 10,
    backgroundColor: '#004AAD',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  previewLoginText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  drawerRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  drawerScrim: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  drawerPanel: {
    width: 278,
    maxWidth: '80%',
    backgroundColor: COLORS.primary,
    elevation: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 4, height: 0 },
    overflow: 'hidden',
  },
  drawerSafe: { flex: 1, backgroundColor: COLORS.primary },
  drawerList: { paddingBottom: 32, paddingTop: 4 },
  tcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  tcAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  tcAvatarImg: { width: 48, height: 48 },
  tcAvatarLogo: { width: 48, height: 48 },
  tcName: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  tcEmail: { fontSize: 11, color: 'rgba(226,232,240,0.85)', marginTop: 2 },
  tcClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tcQuickRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tcQuick: { alignItems: 'center', gap: 5, minWidth: 68 },
  tcQuickLbl: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  tcDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginHorizontal: 12,
    marginBottom: 4,
  },
  tcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tcRowActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  tcRowText: { flex: 1, fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.95)' },
  tcRowTextActive: { color: '#FFFFFF', fontWeight: '800' },
  tcChild: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 44,
    paddingRight: 16,
  },
  tcChildText: { flex: 1, fontSize: 13, fontWeight: '500', color: 'rgba(226,232,240,0.92)' },
  tcLogoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  floatStack: {
    position: 'absolute',
    top: 72,
    left: 28,
    right: 36,
    zIndex: 40,
    gap: 8,
  },
  floatCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFDF8',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#EADFC4',
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  floatAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#C4A35A',
  },
  floatIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6EFE0',
  },
  floatKicker: { fontSize: 10, fontWeight: '800', color: '#8A6A2F', textTransform: 'uppercase', letterSpacing: 0.8 },
  floatName: { fontSize: 14, fontWeight: '700', color: '#1C1917', marginTop: 2 },
  floatReason: { fontSize: 12, color: '#78716C', marginTop: 2 },
  tcLogoutText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#FECACA',
  },
});
