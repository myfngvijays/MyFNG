import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import BottomNav from '../../../components/BottomNav';
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

/**
 * Advanced Telecaller CRM — Home | Leads | Book | Workshops | Me
 * Date + status filters are shared between Home and Leads and persisted.
 */
export default function TelecallerAdvancedCRM() {
  const stackNav = useNavigation<any>();
  const defaults = defaultTelecallerCrmFilterPrefs();
  const [tab, setTab] = useState('home');
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
        setTab('engage');
        setEngageSegment('rsa');
        return;
      }
      if (screen === 'followups' || screen === 'TelecallerFollowUps') {
        setTab('engage');
        setEngageSegment('followups');
        return;
      }
      if (screen === 'scripts' || screen === 'TelecallerScripts') {
        setTab('engage');
        setEngageSegment('scripts');
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
    setDetailLeadId(null);
    setDetailEditing(false);
    setBookMode(null);
    setTab(id);
    // Do not reset queueFilter — keep Home/Leads selection in sync
  };

  if (detailLeadId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.body}>
          <TelecallerLeadDetailScreen
            key={`${detailLeadId}-${detailEditing ? 'edit' : 'view'}`}
            navigation={navigation}
            route={{ params: { leadId: detailLeadId } }}
            embedded
            initialEditing={detailEditing}
          />
        </View>
        <BottomNav activeTab="queue" onTabChange={handleTabChange} tabs={tabs} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.body}>
        {prefsReady && tab === 'home' && (
          <CrmHomeTab
            {...dateProps}
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
                setEngageSegment(params?.segment || 'followups');
                setTab('engage');
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
        {prefsReady && tab === 'queue' && (
          <CrmQueueTab
            {...dateProps}
            initialFilter={queueFilter}
            onFilterChange={persistQueueFilter}
            onOpenLead={(id) => openLead(id, true)}
            onEditLead={(id) => openLead(id, true)}
          />
        )}
        {tab === 'book' && !bookMode && (
          <CrmBookChooser
            onPick={(mode) => setBookMode(mode)}
            onCancel={() => setTab('home')}
          />
        )}
        {tab === 'book' && bookMode && (
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
        {tab === 'workshops' && <CrmWorkshopLocatorTab navigation={navigation} />}
        {tab === 'engage' && (
          <CrmEngageTab navigation={navigation} initialSegment={engageSegment} />
        )}
        {tab === 'me' && (
          <CrmMeTab
            navigation={{
              ...navigation,
              navigate: (screen: string, params?: any) => {
                if (screen === 'CrmReports' || screen === 'reports' || screen === 'LeadManagerReports') {
                  stackNav.navigate('CrmReports', params);
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
        <TelecallerWhatsAppFab onPress={() => setWhatsAppOpen(true)} bottomOffset={108} />
      ) : null}

      <BottomNav
        activeTab={tab === 'engage' ? 'workshops' : tab}
        onTabChange={handleTabChange}
        tabs={tabs}
      />
    </SafeAreaView>
  );
}

const tabs = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'queue', label: 'Leads', icon: 'clipboard' },
  { id: 'book', label: 'Book', icon: 'plus' },
  { id: 'workshops', label: 'Workshops', icon: 'map-marker' },
  { id: 'me', label: 'Me', icon: 'account' },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, position: 'relative' },
  body: { flex: 1, minHeight: 0 },
});
