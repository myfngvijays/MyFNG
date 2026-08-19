import React, { useState, useEffect } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import BottomNav from '../../components/BottomNav';
import TelecallerLeadsScreen from './telecaller/TelecallerLeadsScreen';
import TelecallerCreateLeadScreen from './telecaller/TelecallerCreateLeadScreen';
import TelecallerLeadDetailScreen from './telecaller/TelecallerLeadDetailScreen';
import TelecallerFollowUpsScreen from './telecaller/TelecallerFollowUpsScreen';
import TelecallerScriptsScreen from './telecaller/TelecallerScriptsScreen';
import TelecallerProfileScreen from './telecaller/TelecallerProfileScreen';
import TelecallerAanshBar from '../../components/telecaller/TelecallerAanshBar';
import TelecallerWhatsAppInbox, { TelecallerWhatsAppFab } from '../../components/telecaller/TelecallerWhatsAppInbox';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = SPACING.md;
const GAP = 10;
const KPI_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;

export default function TelecallerDashboard() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [screenHistory, setScreenHistory] = useState<string[]>([]);
  const [screenParamsHistory, setScreenParamsHistory] = useState<any[]>([]);
  const [screenParams, setScreenParams] = useState<any>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    newLeads: 0,
    pendingCallbacks: 0,
    followUpToday: 0,
    incompleteLeads: 0,
    bookedLeads: 0,
    rejectedLeads: 0,
    todayCalls: 0,
    answeredCalls: 0,
    answerRate: 0
  });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<any[]>([]);
  const [rescheduleTarget, setRescheduleTarget] = useState<any | null>(null);
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);

  useEffect(() => {
    fetchUserProfile();
    fetchDashboardData();
  }, []);

  const fetchUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('users_login')
        .select('*')
        .eq('id', user.id)
        .single();
      if (data) setUserProfile(data);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get telecaller profile
      const { data: profile } = await supabase
        .from('users_login')
        .select('id')
        .eq('id', user.id)
        .single();

      const teleCallerId = profile?.id;
      const today = new Date().toISOString().split('T')[0];

      // Fetch all stats in parallel
      const [
        newLeadsResult,
        callbacksResult,
        followUpsResult,
        incompleteResult,
        bookedResult,
        rejectedResult,
        callStatsResult,
        recentLeadsResult,
        followUpsListResult
      ] = await Promise.all([
        // New leads
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_telecaller_id', teleCallerId)
          .eq('status', 'NEW')
          .eq('is_incomplete', false)
          .is('last_call_at', null),

        // Pending callbacks
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_telecaller_id', teleCallerId)
          .eq('follow_up_required', true)
          .lte('next_follow_up_at', new Date().toISOString()),

        // Follow-ups today
        supabase
          .from('telecaller_follow_ups')
          .select('id', { count: 'exact', head: true })
          .eq('telecaller_id', teleCallerId)
          .eq('status', 'PENDING')
          .gte('scheduled_time', `${today}T00:00:00`)
          .lte('scheduled_time', `${today}T23:59:59`),

        // Incomplete leads
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_telecaller_id', teleCallerId)
          .eq('is_incomplete', true),

        // Booked leads
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('created_by_id', teleCallerId)
          .in('status', ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS']),

        // Rejected leads
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_telecaller_id', teleCallerId)
          .eq('status', 'REJECTED'),

        // Today's call stats
        supabase
          .from('telecaller_call_logs')
          .select('call_status')
          .eq('telecaller_id', teleCallerId)
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`),

        // Recent leads
        supabase
          .from('service_leads')
          .select('id, lead_number, customer_name, customer_phone, status, created_at')
          .eq('assigned_telecaller_id', teleCallerId)
          .order('created_at', { ascending: false })
          .limit(5),

        // Upcoming follow-ups
        supabase
          .from('telecaller_follow_ups')
          .select(`
            id,
            scheduled_time,
            follow_up_type,
            priority,
            lead:lead_id(lead_number, customer_name, customer_phone)
          `)
          .eq('telecaller_id', teleCallerId)
          .eq('status', 'PENDING')
          .gte('scheduled_time', new Date().toISOString())
          .order('scheduled_time', { ascending: true })
          .limit(5)
      ]);

      // Calculate stats
      const callsData = callStatsResult.data || [];
      const answeredCount = callsData.filter((c: any) => c.call_status === 'ANSWERED').length;

      setStats({
        newLeads: newLeadsResult.count || 0,
        pendingCallbacks: callbacksResult.count || 0,
        followUpToday: followUpsResult.count || 0,
        incompleteLeads: incompleteResult.count || 0,
        bookedLeads: bookedResult.count || 0,
        rejectedLeads: rejectedResult.count || 0,
        todayCalls: callsData.length,
        answeredCalls: answeredCount,
        answerRate: callsData.length > 0 ? Math.round((answeredCount / callsData.length) * 100) : 0
      });

      setRecentLeads(recentLeadsResult.data || []);
      setUpcomingFollowUps(followUpsListResult.data || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleCallNow = (phone?: string | null) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const handleReschedule = (followUp: any) => {
    setRescheduleTarget(followUp);
    setShowReschedulePicker(true);
  };

  const handleRescheduleChange = async (_event: any, selectedDate?: Date) => {
    if (!selectedDate || !rescheduleTarget) {
      setShowReschedulePicker(false);
      return;
    }

    setShowReschedulePicker(false);
    try {
      await supabase
        .from('telecaller_follow_ups')
        .update({ scheduled_time: selectedDate.toISOString() })
        .eq('id', rescheduleTarget.id);
      fetchDashboardData();
    } catch (error) {
      console.error('Error rescheduling follow-up:', error);
    } finally {
      setRescheduleTarget(null);
    }
  };

  const handleLogout = async () => {
    try {
      const { apiFetch } = await import('../../lib/api');
      await apiFetch('/api/telecaller/crm/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'punch_out' }),
      });
    } catch {
      /* best-effort */
    }
    await supabase.auth.signOut();
  };

  const getTabForScreen = (screen: string) => {
    if (
      screen === 'leads' ||
      screen === 'TelecallerLeads' ||
      screen === 'TelecallerLeadDetail' ||
      screen === 'TelecallerEditLead' ||
      screen === 'createLead' ||
      screen === 'TelecallerCreateLead' ||
      screen === 'followups' ||
      screen === 'TelecallerFollowUps' ||
      screen === 'scripts' ||
      screen === 'TelecallerScripts'
    ) {
      return 'leads';
    }
    if (screen === 'enquiryLeads' || screen === 'TelecallerEnquiryLeads' || screen === 'TelecallerEnquiryLeadDetail') {
      return 'enquiryLeads';
    }
    if (
      screen === 'telecallerRsa' ||
      screen === 'TelecallerRSA' ||
      screen === 'TelecallerRSACreateComplaint' ||
      screen === 'TelecallerRSAComplaintDetail'
    ) {
      return 'telecallerRsa';
    }
    if (screen === 'profile' || screen === 'TelecallerProfile') return 'profile';
    return 'dashboard';
  };

  // Simple navigation object
  const navigation = {
    navigate: (screen: string, params?: any) => {
      setScreenHistory((prev) => (screen !== currentScreen ? [...prev, currentScreen] : prev));
      setScreenParamsHistory((prev) => (screen !== currentScreen ? [...prev, screenParams || {}] : prev));
      setCurrentScreen(screen);
      setScreenParams(params || {});
      if (params?.leadId) {
        setSelectedLeadId(params.leadId);
      }
    },
    goBack: () => {
      if (screenHistory.length === 0) {
        setCurrentScreen('dashboard');
        setSelectedLeadId(null);
        setScreenParams({});
        return;
      }
      const previousScreen = screenHistory[screenHistory.length - 1];
      const previousParams = screenParamsHistory[screenParamsHistory.length - 1] || {};
      setScreenHistory((prev) => prev.slice(0, -1));
      setScreenParamsHistory((prev) => prev.slice(0, -1));
      setCurrentScreen(previousScreen);
      setScreenParams(previousParams);
      if (previousParams?.leadId) {
        setSelectedLeadId(previousParams.leadId);
      } else if (previousScreen !== 'TelecallerLeadDetail') {
        setSelectedLeadId(null);
      }
    }
  };

  const handleTabChange = (tab: string) => {
    setScreenHistory([]);
    setScreenParamsHistory([]);
    setCurrentScreen(tab);
    setScreenParams({});
    if (tab !== 'leads') {
      setSelectedLeadId(null);
    }
  };

  const bottomTabs = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'leads', label: 'Leads', icon: 'clipboard' },
    { id: 'enquiryLeads', label: 'Enquiry', icon: 'file' },
    { id: 'telecallerRsa', label: 'RSA', icon: 'alert-circle' },
    { id: 'profile', label: 'Profile', icon: 'account' },
  ];

  const wrapWithBottomNav = (screen: React.ReactNode) => (
    <View style={styles.container}>
      <View style={styles.content}>{screen}</View>
      <BottomNav
        activeTab={getTabForScreen(currentScreen)}
        onTabChange={handleTabChange}
        tabs={bottomTabs}
      />
    </View>
  );

  // Normalize stack-style names used by child screens into custom-nav screen keys
  const resolvedScreen = (() => {
    if (currentScreen === 'TelecallerCreateLead') return 'createLead';
    if (currentScreen === 'TelecallerLeads') return 'leads';
    if (currentScreen === 'TelecallerFollowUps') return 'followups';
    if (currentScreen === 'TelecallerScripts') return 'scripts';
    if (currentScreen === 'TelecallerProfile') return 'profile';
    if (currentScreen === 'TelecallerEnquiryLeads') return 'enquiryLeads';
    if (currentScreen === 'TelecallerRSA') return 'telecallerRsa';
    return currentScreen;
  })();

  // Render different screens based on currentScreen state
  if (resolvedScreen === 'leads') {
    return wrapWithBottomNav(
      <TelecallerLeadsScreen navigation={navigation} route={{ params: screenParams || {} }} />
    );
  }

  if (resolvedScreen === 'createLead') {
    return wrapWithBottomNav(
      <TelecallerCreateLeadScreen navigation={navigation} route={{ params: screenParams || {} }} />
    );
  }

  if (resolvedScreen === 'TelecallerLeadDetail' && (selectedLeadId || screenParams?.leadId)) {
    const id = selectedLeadId || screenParams?.leadId;
    return wrapWithBottomNav(
      <TelecallerLeadDetailScreen navigation={navigation} route={{ params: { leadId: id } }} />
    );
  }

  if (resolvedScreen === 'TelecallerEditLead') {
    const EditScreen = require('./telecaller/TelecallerEditLeadScreen').default;
    return wrapWithBottomNav(
      <EditScreen navigation={navigation} route={{ params: screenParams || { leadId: selectedLeadId } }} />
    );
  }

  if (resolvedScreen === 'TelecallerEnquiryLeadDetail') {
    const Screen = require('./telecaller/TelecallerEnquiryLeadDetailScreen').default;
    return wrapWithBottomNav(
      <Screen navigation={navigation} route={{ params: screenParams || {} }} />
    );
  }

  if (resolvedScreen === 'followups') {
    return wrapWithBottomNav(
      <TelecallerFollowUpsScreen navigation={navigation} route={{ params: screenParams || {} }} />
    );
  }

  if (resolvedScreen === 'scripts') {
    return wrapWithBottomNav(<TelecallerScriptsScreen navigation={navigation} />);
  }

  if (resolvedScreen === 'profile') {
    return wrapWithBottomNav(<TelecallerProfileScreen navigation={navigation} />);
  }

  if (resolvedScreen === 'enquiryLeads') {
    const Screen = require('./telecaller/TelecallerEnquiryLeadsScreen').default;
    return wrapWithBottomNav(<Screen navigation={navigation} route={{ params: screenParams || {} }} />);
  }

  if (resolvedScreen === 'telecallerRsa') {
    const Screen = require('./telecaller/TelecallerRSAScreen').default;
    return wrapWithBottomNav(<Screen navigation={navigation} route={{ params: screenParams || {} }} />);
  }

  if (resolvedScreen === 'TelecallerRSACreateComplaint') {
    const Screen = require('./telecaller/TelecallerRSACreateComplaintScreen').default;
    return wrapWithBottomNav(<Screen navigation={navigation} route={{ params: screenParams || {} }} />);
  }

  if (resolvedScreen === 'TelecallerRSAComplaintDetail') {
    const Screen = require('./telecaller/TelecallerRSAComplaintDetailScreen').default;
    return wrapWithBottomNav(<Screen navigation={navigation} route={{ params: screenParams || {} }} />);
  }

  // Main Dashboard Screen
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  const kpiItems = [
    {
      key: 'new',
      label: 'New Leads',
      value: stats.newLeads,
      icon: 'call-outline' as const,
      color: COLORS.primary,
      bg: '#E8F1FF',
      onPress: () => navigation.navigate('leads', { filter: 'new' }),
    },
    {
      key: 'callback',
      label: 'Callbacks',
      value: stats.pendingCallbacks,
      icon: 'phone-portrait-outline' as const,
      color: COLORS.orange,
      bg: '#FFF4E5',
      urgent: stats.pendingCallbacks > 0,
      onPress: () => navigation.navigate('leads', { filter: 'callback' }),
    },
    {
      key: 'followups',
      label: "Today's Follow-ups",
      value: stats.followUpToday,
      icon: 'calendar-outline' as const,
      color: COLORS.indigo,
      bg: '#EEF0FF',
      onPress: () => navigation.navigate('followups', { filter: 'today' }),
    },
    {
      key: 'booked',
      label: 'Booked Leads',
      value: stats.bookedLeads,
      icon: 'checkmark-circle-outline' as const,
      color: COLORS.green,
      bg: '#E8F8F0',
      onPress: () => navigation.navigate('leads', { filter: 'completed' }),
    },
    {
      key: 'incomplete',
      label: 'Incomplete Leads',
      value: stats.incompleteLeads,
      icon: 'warning-outline' as const,
      color: COLORS.warning,
      bg: '#FFF8E6',
      onPress: () => navigation.navigate('leads', { filter: 'incomplete' }),
    },
    {
      key: 'rejected',
      label: 'Rejected Leads',
      value: stats.rejectedLeads,
      icon: 'close-circle-outline' as const,
      color: COLORS.red,
      bg: '#FEECEC',
      onPress: () => navigation.navigate('leads', { filter: 'rejected' }),
    },
  ];

  const quickActions = [
    { key: 'queue', label: 'View Queue', icon: 'list-outline' as const, color: COLORS.primary, onPress: () => navigation.navigate('leads', { filter: 'new' }) },
    { key: 'create', label: 'Create Lead', icon: 'add-circle-outline' as const, color: COLORS.green, onPress: () => navigation.navigate('createLead') },
    { key: 'enquiry', label: 'Enquiry', icon: 'document-text-outline' as const, color: COLORS.indigo, onPress: () => navigation.navigate('enquiryLeads') },
    { key: 'followups', label: 'Follow-ups', icon: 'calendar-outline' as const, color: COLORS.orange, onPress: () => navigation.navigate('followups') },
    { key: 'scripts', label: 'Call Scripts', icon: 'reader-outline' as const, color: COLORS.purple, onPress: () => navigation.navigate('scripts') },
    { key: 'rsa', label: 'RSA Module', icon: 'alert-circle-outline' as const, color: COLORS.red, onPress: () => navigation.navigate('telecallerRsa') },
  ];

  return (
    <View style={styles.container}>
      <DashboardHeader
        title="Telecaller Dashboard"
        userProfile={userProfile}
        onLogout={handleLogout}
      />

      <TelecallerAanshBar />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          {kpiItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.kpiCard,
                { backgroundColor: item.bg },
                item.urgent && styles.kpiUrgent,
              ]}
              onPress={item.onPress}
              activeOpacity={0.75}
            >
              <View style={[styles.kpiIconWrap, { backgroundColor: item.color + '18' }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={[styles.kpiValue, { color: item.color }]}>{item.value}</Text>
              <Text style={styles.kpiLabel} numberOfLines={2}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Today's Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Performance</Text>
          <View style={styles.performanceCard}>
            <View style={styles.performanceItem}>
              <Text style={styles.performanceValue}>{stats.todayCalls}</Text>
              <Text style={styles.performanceLabel}>Total Calls</Text>
            </View>
            <View style={styles.performanceDivider} />
            <View style={styles.performanceItem}>
              <Text style={styles.performanceValue}>{stats.answeredCalls}</Text>
              <Text style={styles.performanceLabel}>Answered</Text>
            </View>
            <View style={styles.performanceDivider} />
            <View style={styles.performanceItem}>
              <Text style={[styles.performanceValue, { color: COLORS.green }]}>
                {stats.answerRate}%
              </Text>
              <Text style={styles.performanceLabel}>Answer Rate</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.actionButton}
                onPress={action.onPress}
                activeOpacity={0.75}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: action.color + '15' }]}>
                  <Ionicons name={action.icon} size={22} color={action.color} />
                </View>
                <Text style={styles.actionButtonText} numberOfLines={1}>{action.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.gray[400]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Leads */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Leads</Text>
            <TouchableOpacity onPress={() => navigation.navigate('leads', { filter: 'all' })}>
              <Text style={styles.viewAll}>View All →</Text>
            </TouchableOpacity>
          </View>
          {recentLeads.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="clipboard-outline" size={28} color={COLORS.gray[300]} />
              <Text style={styles.emptyText}>No leads yet</Text>
            </View>
          ) : (
            recentLeads.map((lead) => (
              <TouchableOpacity
                key={lead.id}
                style={styles.leadCard}
                onPress={() => navigation.navigate('TelecallerLeadDetail', { leadId: lead.id })}
                activeOpacity={0.75}
              >
                <View style={styles.leadInfo}>
                  <View style={styles.leadTopRow}>
                    <Text style={styles.leadName} numberOfLines={1}>{lead.customer_name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBg(lead.status) }]}>
                      <Text style={[styles.statusText, { color: getStatusFg(lead.status) }]}>
                        {lead.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.leadNumber}>#{lead.lead_number}</Text>
                  <View style={styles.leadMetaRow}>
                    <Ionicons name="call-outline" size={13} color={COLORS.textSecondary} />
                    <Text style={styles.leadPhone}>{lead.customer_phone}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.leadCallBtn}
                  onPress={() => handleCallNow(lead.customer_phone)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="call" size={18} color={COLORS.white} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Upcoming Follow-ups */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Follow-ups</Text>
            <TouchableOpacity onPress={() => navigation.navigate('followups')}>
              <Text style={styles.viewAll}>View All →</Text>
            </TouchableOpacity>
          </View>
          {upcomingFollowUps.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={28} color={COLORS.gray[300]} />
              <Text style={styles.emptyText}>No upcoming follow-ups</Text>
            </View>
          ) : (
            upcomingFollowUps.map((followUp) => (
              <View key={followUp.id} style={styles.followUpCard}>
                <View style={styles.followUpHeader}>
                  <View style={styles.followUpAvatar}>
                    <Ionicons name="person" size={16} color={COLORS.primary} />
                  </View>
                  <View style={styles.followUpInfo}>
                    <Text style={styles.followUpName} numberOfLines={1}>
                      {followUp.lead?.customer_name}
                    </Text>
                    <Text style={styles.followUpTime}>
                      {formatDateTime(followUp.scheduled_time)}
                    </Text>
                  </View>
                  {followUp.priority === 'URGENT' && (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.urgentText}>URGENT</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.followUpType}>{followUp.follow_up_type}</Text>
                <View style={styles.followUpActions}>
                  <TouchableOpacity
                    style={[styles.followUpActionButton, styles.followUpPrimary]}
                    onPress={() => handleCallNow(followUp.lead?.customer_phone)}
                  >
                    <Ionicons name="call" size={14} color={COLORS.white} />
                    <Text style={styles.followUpActionText}>Call Now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.followUpActionButton, styles.followUpSecondary]}
                    onPress={() => handleReschedule(followUp)}
                  >
                    <Ionicons name="time-outline" size={14} color={COLORS.textPrimary} />
                    <Text style={styles.followUpSecondaryText}>Reschedule</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {showReschedulePicker && (
        <DateTimePicker
          value={rescheduleTarget?.scheduled_time ? new Date(rescheduleTarget.scheduled_time) : new Date()}
          mode="datetime"
          display="default"
          onChange={handleRescheduleChange}
        />
      )}

      <TelecallerWhatsAppFab onPress={() => setWhatsAppOpen(true)} />
      <TelecallerWhatsAppInbox visible={whatsAppOpen} onClose={() => setWhatsAppOpen(false)} />

      <BottomNav
        activeTab={getTabForScreen(currentScreen)}
        onTabChange={handleTabChange}
        tabs={bottomTabs}
      />
    </View>
  );
}

function getStatusBg(status: string): string {
  switch (status) {
    case 'NEW': return '#DBEAFE';
    case 'ASSIGNED': return '#E0E7FF';
    case 'ACCEPTED': return '#D1FAE5';
    case 'REJECTED': return '#FEE2E2';
    case 'BOOKED': return '#EDE9FE';
    default: return COLORS.gray[100];
  }
}

function getStatusFg(status: string): string {
  switch (status) {
    case 'NEW': return COLORS.primary;
    case 'ASSIGNED': return COLORS.indigo;
    case 'ACCEPTED': return COLORS.green;
    case 'REJECTED': return COLORS.red;
    case 'BOOKED': return COLORS.purple;
    default: return COLORS.textSecondary;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl + 8,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: H_PAD,
    gap: GAP,
    marginBottom: SPACING.lg,
  },
  kpiCard: {
    width: KPI_WIDTH,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  kpiUrgent: {
    borderWidth: 1.5,
    borderColor: COLORS.orange,
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 30,
  },
  kpiLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 16,
  },
  section: {
    paddingHorizontal: H_PAD,
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: SPACING.sm,
  },
  viewAll: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  performanceCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 18,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  performanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  performanceDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.gray[200],
  },
  performanceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
  },
  performanceLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  actionsGrid: {
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...SHADOWS.small,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  leadCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  leadInfo: {
    flex: 1,
    marginRight: 10,
  },
  leadTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  leadName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  leadNumber: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  leadMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  leadPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  leadCallBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  followUpCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: 14,
    marginBottom: 8,
    ...SHADOWS.small,
  },
  followUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  followUpAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  followUpInfo: {
    flex: 1,
  },
  followUpName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  urgentBadge: {
    backgroundColor: COLORS.red + '18',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  urgentText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.red,
  },
  followUpTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  followUpType: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 10,
  },
  followUpActions: {
    flexDirection: 'row',
    gap: 8,
  },
  followUpActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
  },
  followUpPrimary: {
    backgroundColor: COLORS.primary,
  },
  followUpSecondary: {
    backgroundColor: COLORS.gray[100],
  },
  followUpActionText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  followUpSecondaryText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 28,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    gap: 8,
    ...SHADOWS.small,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
});
