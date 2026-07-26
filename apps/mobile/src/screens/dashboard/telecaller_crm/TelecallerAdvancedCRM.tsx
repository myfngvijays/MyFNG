import React, { useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../../../components/BottomNav';
import TelecallerWhatsAppInbox from '../../../components/telecaller/TelecallerWhatsAppInbox';
import TelecallerLeadDetailScreen from '../telecaller/TelecallerLeadDetailScreen';
import CrmHomeTab from './CrmHomeTab';
import CrmQueueTab from './CrmQueueTab';
import CrmBookWizard from './CrmBookWizard';
import CrmEngageTab from './CrmEngageTab';
import CrmWorkshopLocatorTab from './CrmWorkshopLocatorTab';
import CrmMeTab from './CrmMeTab';
import { COLORS } from '../../../constants/theme';
import { istYmd, type CrmDatePreset } from '../../../lib/crmDateRange';

/**
 * Advanced Telecaller CRM — Home | Leads | Book | Workshops | Me
 * Date filter is shared between Home and Leads.
 */
export default function TelecallerAdvancedCRM() {
  const [tab, setTab] = useState('home');
  const [queueFilter, setQueueFilter] = useState('all');
  const [engageSegment, setEngageSegment] = useState('followups');
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('today');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());

  const openLead = (leadId: string, editing = false) => {
    setDetailEditing(editing);
    setDetailLeadId(leadId);
  };

  const dateProps = {
    datePreset,
    customStart,
    customEnd,
    onDatePresetChange: setDatePreset,
    onCustomStartChange: setCustomStart,
    onCustomEndChange: setCustomEnd,
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
        if (params?.filter) setQueueFilter(params.filter);
        return;
      }
      if (screen === 'book' || screen === 'createLead' || screen === 'TelecallerCreateLead') {
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
    setTab(id);
    if (id === 'queue') setQueueFilter('all');
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
        {tab === 'home' && (
          <CrmHomeTab
            {...dateProps}
            onNavigate={(screen, params) => {
              if (screen === 'queue') {
                setQueueFilter(params?.filter || 'all');
                setTab('queue');
                return;
              }
              if (screen === 'book') {
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
              navigation.navigate(screen, params);
            }}
            onOpenWhatsApp={() => setWhatsAppOpen(true)}
          />
        )}
        {tab === 'queue' && (
          <CrmQueueTab
            {...dateProps}
            initialFilter={queueFilter}
            onOpenLead={(id) => openLead(id, false)}
            onEditLead={(id) => openLead(id, true)}
          />
        )}
        {tab === 'book' && (
          <CrmBookWizard
            onDone={(leadId) => {
              openLead(leadId, false);
            }}
            onCancel={() => setTab('home')}
          />
        )}
        {tab === 'workshops' && <CrmWorkshopLocatorTab navigation={navigation} />}
        {tab === 'engage' && (
          <CrmEngageTab navigation={navigation} initialSegment={engageSegment} />
        )}
        {tab === 'me' && <CrmMeTab navigation={navigation} active />}
      </View>

      <TelecallerWhatsAppInbox visible={whatsAppOpen} onClose={() => setWhatsAppOpen(false)} />

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
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, minHeight: 0 },
});
