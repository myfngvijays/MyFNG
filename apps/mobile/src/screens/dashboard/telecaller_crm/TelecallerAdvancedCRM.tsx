import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
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
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { apiFetch } from '../../../lib/api';
import { setAndroidShellBackHandler } from '../../../lib/androidShellBack';
import TelecallerWhatsAppInbox, {
  TelecallerWhatsAppFab,
} from '../../../components/telecaller/TelecallerWhatsAppInbox';
import TelecallerLeadDetailScreen from '../telecaller/TelecallerLeadDetailScreen';
import CrmHomeTab from './CrmHomeTab';
import CrmQueueTab from './CrmQueueTab';
import CrmBookWizard from './CrmBookWizard';
import CrmBookChooser from './CrmBookChooser';
import CrmEngageTab from './CrmEngageTab';
import CrmWorkshopLocatorTab from './CrmWorkshopLocatorTab';
import CrmMeTab from './CrmMeTab';
import { COLORS } from '../../../constants/theme';
import { istYmd, type CrmDatePreset } from '../../../lib/crmDateRange';
import {
  defaultTelecallerCrmFilterPrefs,
  loadTelecallerCrmFilterPrefs,
  saveTelecallerCrmFilterPrefs,
} from '../../../lib/crmFilterPrefs';

/** Keep Home / Leads mounted so idle resume does not remount into a hung spinner. */
const HIDDEN_TAB: ViewStyle = {
  position: 'absolute',
  width: 0,
  height: 0,
  opacity: 0,
  overflow: 'hidden',
  left: 0,
  top: 0,
};

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
    id: 'scripts',
    label: 'Call scripts',
    icon: 'document-text-outline',
    kind: 'stack',
    screen: 'TelecallerScripts',
  },
  {
    type: 'group',
    id: 'reports_group',
    label: 'Reports',
    icon: 'trophy-outline',
    children: [
      {
        id: 'reports_lb',
        label: 'Your leaderboard',
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
        id: 'reports_dup',
        label: 'Duplicates',
        icon: 'git-network-outline',
        kind: 'stack',
        screen: 'CrmReports',
        params: { tab: 'duplicates' },
      },
    ],
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
export default function TelecallerAdvancedCRM() {
  const stackNav = useNavigation<any>();
  const route = useRoute();
  const isLeadManager = String(route?.name || '').includes('LeadManager');
  const insets = useSafeAreaInsets();
  const drawerNav = isLeadManager ? LM_NAV : TC_NAV;
  const drawerTopPad =
    Math.max(
      insets.top,
      Platform.OS === 'android' ? StatusBar.currentHeight || 28 : 50,
    ) + 12;
  const defaults = defaultTelecallerCrmFilterPrefs();
  const [tab, setTab] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [queueFilter, setQueueFilter] = useState(defaults.statusFilter);
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

  useEffect(() => {
    const onBack = () => {
      if (menuOpen) {
        setMenuOpen(false);
        return true;
      }
      if (whatsAppOpen) {
        setWhatsAppOpen(false);
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
      if (stackNav.canGoBack()) {
        stackNav.goBack();
        return true;
      }
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    };
    setAndroidShellBackHandler(onBack);
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => {
      setAndroidShellBackHandler(null);
      sub.remove();
    };
  }, [menuOpen, whatsAppOpen, detailLeadId, bookMode, tab, stackNav]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = await loadTelecallerCrmFilterPrefs();
      if (cancelled) return;
      setDatePreset(prefs.datePreset);
      setCustomStart(prefs.customStart);
      setCustomEnd(prefs.customEnd);
      setQueueFilter('all');
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

  const persistDatePreset = (value: CrmDatePreset) => {
    setDatePreset(value);
    void saveTelecallerCrmFilterPrefs({ datePreset: value });
  };
  const persistCustomStart = (value: string) => {
    setCustomStart(value);
    void saveTelecallerCrmFilterPrefs({ customStart: value, datePreset: 'custom' });
  };
  const persistCustomEnd = (value: string) => {
    setCustomEnd(value);
    void saveTelecallerCrmFilterPrefs({ customEnd: value, datePreset: 'custom' });
  };
  const persistQueueFilter = (value: string) => {
    setQueueFilter(value);
    void saveTelecallerCrmFilterPrefs({ statusFilter: value });
  };

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
    setDetailEditing(true);
    setDetailLeadId(leadId);
  };

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
    if (id === 'queue') {
      setQueueFilter('all');
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
        onPress: async () => {
          setMenuOpen(false);
          try {
            await apiFetch('/api/telecaller/crm/attendance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'punch_out' }),
            });
          } catch {
            /* continue */
          }
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const showHome = prefsReady;
  const showQueue = prefsReady;
  const homeActive = tab === 'home' && !detailLeadId;
  const queueActive = tab === 'queue' && !detailLeadId;
  const activeTitle =
    MENU_TABS.find((t) => t.id === (detailLeadId ? 'queue' : tab))?.label ||
    (isLeadManager ? 'Lead Manager' : 'Telecaller CRM');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={detailLeadId ? 'light-content' : 'dark-content'} />

      {!detailLeadId ? (
        <View style={styles.topBar}>
          <View style={styles.topSide} pointerEvents="box-none">
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
            <Text
              style={[styles.topTitle, tab === 'home' && styles.topTitleHome]}
              numberOfLines={1}
            >
              {activeTitle}
            </Text>
          </View>
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
          <View style={styles.topSideRight} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => {
                try {
                  stackNav.navigate('TelecallerFollowUps');
                } catch {
                  /* Follow-ups screen unavailable */
                }
              }}
              accessibilityLabel="Reminders"
            >
              <Ionicons name="alarm-outline" size={22} color={COLORS.primary} />
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
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={handleLogout}
              accessibilityLabel="Logout"
              accessibilityRole="button"
            >
              <Ionicons name="log-out-outline" size={22} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.body}>
        {showHome ? (
          <View
            style={[styles.body, homeActive ? null : HIDDEN_TAB]}
            pointerEvents={homeActive ? 'auto' : 'none'}
          >
            <CrmHomeTab
              {...dateProps}
              embedInShell
              onNavigate={(screen, params) => {
                if (screen === 'queue') {
                  setQueueFilter(params?.filter || 'all');
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
            style={[styles.body, queueActive ? null : HIDDEN_TAB]}
            pointerEvents={queueActive ? 'auto' : 'none'}
          >
            <CrmQueueTab
              {...dateProps}
              managerOps={isLeadManager}
              initialFilter={queueFilter}
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
      </View>

      <TelecallerWhatsAppInbox visible={whatsAppOpen} onClose={() => setWhatsAppOpen(false)} />
      {!detailLeadId && tab !== 'book' ? (
        <TelecallerWhatsAppFab
          onPress={() => setWhatsAppOpen(true)}
          onCallPress={
            isLeadManager ? undefined : () => stackNav.navigate('CrmDialer')
          }
          bottomOffset={28}
        />
      ) : null}

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
                      id: 'reports',
                      label: 'Reports',
                      icon: 'trophy',
                      kind: 'stack',
                      screen: 'CrmReports',
                      params: { tab: 'leaderboard' },
                    })
                  }
                >
                  <Ionicons name="trophy-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.tcQuickLbl}>Leaderboard</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, position: 'relative' },
  body: { flex: 1, minHeight: 0, overflow: 'hidden' },
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
  topSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    zIndex: 1,
  },
  topSideRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  topCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
    elevation: 6,
  },
  topLogo: {
    width: 108,
    height: 32,
  },
  topTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textHeading,
    textAlign: 'left',
    maxWidth: 96,
  },
  topTitleHome: {
    color: COLORS.primary,
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
  tcLogoutText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#FECACA',
  },
});
