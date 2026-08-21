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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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

const MENU_TABS = [
  { id: 'home', label: 'Home', icon: 'home-outline' as const },
  { id: 'queue', label: 'Leads', icon: 'clipboard-outline' as const },
  { id: 'book', label: 'Book', icon: 'add-circle-outline' as const },
  { id: 'workshops', label: 'Workshops', icon: 'location-outline' as const },
  { id: 'me', label: 'My Profile', icon: 'person-outline' as const },
];

/**
 * Advanced Telecaller CRM — hamburger menu + Home | Leads | Book | Workshops | Me
 * Date + status filters are shared between Home and Leads and persisted.
 */
export default function TelecallerAdvancedCRM() {
  const stackNav = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const isLeadManager = String(route?.name || '').includes('LeadManager');
  const defaults = defaultTelecallerCrmFilterPrefs();
  const [tab, setTab] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [queueFilter, setQueueFilter] = useState(defaults.statusFilter);
  const [engageSegment, setEngageSegment] = useState('followups');
  const [bookMode, setBookMode] = useState<'book' | 'lead' | null>(null);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>(defaults.datePreset);
  const [customStart, setCustomStart] = useState(defaults.customStart || istYmd());
  const [customEnd, setCustomEnd] = useState(defaults.customEnd || istYmd());
  const [prefsReady, setPrefsReady] = useState(false);

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

  const openLead = (leadId: string, editing = true) => {
    setDetailEditing(editing);
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
        // Engage / scripts entry disabled from CRM menu
        return;
      }
      if (screen === 'queue' || screen === 'leads' || screen === 'TelecallerLeads') {
        setTab('queue');
        if (params?.filter) persistQueueFilter(params.filter);
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
      setTab('home');
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

  const showQueue = prefsReady && tab === 'queue';
  const activeTitle =
    MENU_TABS.find((t) => t.id === (detailLeadId ? 'queue' : tab))?.label ||
    (isLeadManager ? 'Lead Manager' : 'Telecaller CRM');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={detailLeadId ? 'light-content' : 'dark-content'} />

      {!detailLeadId ? (
        <View style={styles.topBar}>
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
        </View>
      ) : null}

      <View style={styles.body}>
        {prefsReady && tab === 'home' && !detailLeadId && (
          <CrmHomeTab
            {...dateProps}
            embedInShell
            onNavigate={(screen, params) => {
              if (screen === 'queue') {
                persistQueueFilter(params?.filter || 'all');
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
        )}

        {showQueue ? (
          <View
            style={[
              styles.body,
              detailLeadId
                ? {
                    position: 'absolute',
                    width: 0,
                    height: 0,
                    opacity: 0,
                    overflow: 'hidden',
                    left: 0,
                    top: 0,
                  }
                : null,
            ]}
            pointerEvents={detailLeadId ? 'none' : 'auto'}
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
            key={bookMode}
            initialMode={bookMode}
            hideModeSwitch
            onDone={(leadId) => {
              setBookMode(null);
              openLead(leadId, true);
            }}
            onCancel={() => setBookMode(null)}
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
                  screen === 'LeadManagerTeamWhatsApp' ||
                  screen === 'LeadManagerWhatsAppDnd'
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
        <TelecallerWhatsAppFab onPress={() => setWhatsAppOpen(true)} bottomOffset={28} />
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
            <View style={[styles.drawerHead, { paddingTop: Math.max(insets.top, 12) + 12 }]}>
              <View style={styles.drawerHeadSafe}>
                <View>
                  <Text style={styles.drawerEyebrow}>MyFNG</Text>
                  <Text style={styles.drawerBrand}>
                    {isLeadManager ? 'Lead Manager' : 'Telecaller CRM'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setMenuOpen(false)}
                  hitSlop={12}
                  style={styles.drawerClose}
                >
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView
              style={styles.drawerSafe}
              contentContainerStyle={styles.drawerList}
              keyboardShouldPersistTaps="handled"
            >
              {MENU_TABS.map((item) => {
                const active = tab === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.drawerItem, active && styles.drawerItemActive]}
                    onPress={() => handleTabChange(item.id)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.drawerIconWrap, active && styles.drawerIconWrapActive]}>
                      <Ionicons
                        name={item.icon}
                        size={18}
                        color={active ? '#fff' : COLORS.primary}
                      />
                    </View>
                    <Text
                      style={[styles.drawerItemText, active && styles.drawerItemTextActive]}
                    >
                      {item.label}
                    </Text>
                    {active ? (
                      <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textHeading,
    textAlign: 'center',
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
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  drawerPanel: {
    width: 300,
    maxWidth: '82%',
    backgroundColor: '#F8FAFC',
    elevation: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 6, height: 0 },
    overflow: 'hidden',
  },
  drawerHead: {
    backgroundColor: COLORS.primary,
    paddingBottom: 20,
    paddingHorizontal: 18,
  },
  drawerHeadSafe: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  drawerEyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  drawerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  drawerBrand: { color: '#fff', fontSize: 20, fontWeight: '800' },
  drawerSafe: { flex: 1, backgroundColor: '#F8FAFC' },
  drawerList: { padding: 14, paddingBottom: 40 },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  drawerItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: COLORS.primary + '55',
  },
  drawerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary + '14',
  },
  drawerIconWrapActive: {
    backgroundColor: COLORS.primary,
  },
  drawerItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0F172A' },
  drawerItemTextActive: { color: COLORS.primary, fontWeight: '800' },
});
