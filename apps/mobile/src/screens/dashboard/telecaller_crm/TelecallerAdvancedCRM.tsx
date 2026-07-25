import React, { useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../../../components/BottomNav';
import TelecallerWhatsAppInbox, { TelecallerWhatsAppFab } from '../../../components/telecaller/TelecallerWhatsAppInbox';
import TelecallerLeadDetailScreen from '../telecaller/TelecallerLeadDetailScreen';
import CrmHomeTab from './CrmHomeTab';
import CrmQueueTab from './CrmQueueTab';
import CrmBookWizard from './CrmBookWizard';
import CrmEngageTab from './CrmEngageTab';
import CrmMeTab from './CrmMeTab';
import { COLORS } from '../../../constants/theme';

/**
 * Advanced Telecaller CRM — new interconnected agent workspace.
 * Tabs: Home | Queue | Book | Engage | Me
 */
export default function TelecallerAdvancedCRM() {
  const [tab, setTab] = useState('home');
  const [queueFilter, setQueueFilter] = useState('all');
  const [engageSegment, setEngageSegment] = useState('followups');
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);

  const navigation = {
    navigate: (screen: string, params?: any) => {
      if (screen === 'TelecallerLeadDetail' && params?.leadId) {
        setDetailLeadId(params.leadId);
        return;
      }
      if (screen === 'TelecallerEditLead' && params?.leadId) {
        setDetailLeadId(params.leadId);
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
      }
    },
    goBack: () => {
      if (detailLeadId) {
        setDetailLeadId(null);
        return;
      }
      setTab('home');
    },
  };

  const handleTabChange = (id: string) => {
    setDetailLeadId(null);
    setTab(id);
    if (id === 'queue') setQueueFilter('all');
  };

  const showFab = tab !== 'book' && tab !== 'engage' && !detailLeadId;

  if (detailLeadId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.body}>
          <TelecallerLeadDetailScreen
            navigation={navigation}
            route={{ params: { leadId: detailLeadId } }}
            embedded
          />
        </View>
        <BottomNav
          activeTab="queue"
          onTabChange={handleTabChange}
          tabs={tabs}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.body}>
        {tab === 'home' && (
          <CrmHomeTab
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
              navigation.navigate(screen, params);
            }}
            onOpenWhatsApp={() => setWhatsAppOpen(true)}
          />
        )}
        {tab === 'queue' && (
          <CrmQueueTab
            initialFilter={queueFilter}
            onOpenLead={(id) => setDetailLeadId(id)}
          />
        )}
        {tab === 'book' && (
          <CrmBookWizard
            onDone={(leadId) => {
              setDetailLeadId(leadId);
            }}
            onCancel={() => setTab('home')}
          />
        )}
        {tab === 'engage' && (
          <CrmEngageTab navigation={navigation} initialSegment={engageSegment} />
        )}
        {tab === 'me' && <CrmMeTab navigation={navigation} />}
      </View>

      {showFab ? <TelecallerWhatsAppFab onPress={() => setWhatsAppOpen(true)} /> : null}
      <TelecallerWhatsAppInbox visible={whatsAppOpen} onClose={() => setWhatsAppOpen(false)} />

      <BottomNav activeTab={tab} onTabChange={handleTabChange} tabs={tabs} />
    </SafeAreaView>
  );
}

const tabs = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'queue', label: 'Leads', icon: 'clipboard' },
  { id: 'book', label: 'Book', icon: 'plus' },
  { id: 'engage', label: 'Engage', icon: 'phone' },
  { id: 'me', label: 'Me', icon: 'account' },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, minHeight: 0 },
});
