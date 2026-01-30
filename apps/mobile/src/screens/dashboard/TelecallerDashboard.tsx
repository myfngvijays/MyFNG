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
  Dimensions
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../components/Icon';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import BottomNav from '../../components/BottomNav';
import TelecallerLeadsScreen from './telecaller/TelecallerLeadsScreen';
import TelecallerCreateLeadScreen from './telecaller/TelecallerCreateLeadScreen';
import TelecallerLeadDetailScreen from './telecaller/TelecallerLeadDetailScreen';
import TelecallerFollowUpsScreen from './telecaller/TelecallerFollowUpsScreen';
import TelecallerScriptsScreen from './telecaller/TelecallerScriptsScreen';
import TelecallerProfileScreen from './telecaller/TelecallerProfileScreen';
import { COLORS, SPACING } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function TelecallerDashboard() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
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
          .or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId}`)
          .eq('status', 'NEW')
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
          .or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId}`)
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
          .or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId}`)
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
    await supabase.auth.signOut();
  };

  // Simple navigation object
  const navigation = {
    navigate: (screen: string, params?: any) => {
      setCurrentScreen(screen);
      if (params?.leadId) {
        setSelectedLeadId(params.leadId);
      }
    },
    goBack: () => {
      setCurrentScreen('dashboard');
      setSelectedLeadId(null);
    }
  };

  // Render different screens based on currentScreen state
  if (currentScreen === 'leads') {
    return <TelecallerLeadsScreen navigation={navigation} route={{ params: {} }} />;
  }

  if (currentScreen === 'createLead') {
    return <TelecallerCreateLeadScreen navigation={navigation} route={{ params: {} }} />;
  }

  if (currentScreen === 'TelecallerLeadDetail' && selectedLeadId) {
    return <TelecallerLeadDetailScreen navigation={navigation} route={{ params: { leadId: selectedLeadId } }} />;
  }

  if (currentScreen === 'followups') {
    return <TelecallerFollowUpsScreen navigation={navigation} route={{ params: {} }} />;
  }

  if (currentScreen === 'scripts') {
    return <TelecallerScriptsScreen navigation={navigation} />;
  }

  if (currentScreen === 'profile') {
    return <TelecallerProfileScreen navigation={navigation} />;
  }

  if (currentScreen === 'enquiryLeads') {
    const Screen = require('./telecaller/TelecallerEnquiryLeadsScreen').default;
    return <Screen navigation={navigation} route={{ params: {} }} />;
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

  return (
    <View style={styles.container}>
      <DashboardHeader 
        title="Telecaller Dashboard"
        userProfile={userProfile}
        onLogout={handleLogout}
      />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* KPI Cards */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: COLORS.blue + '15' }]}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>📞</Text>
              <Text style={styles.kpiValue}>{stats.newLeads}</Text>
              <Text style={styles.kpiLabel}>New Leads</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: COLORS.orange + '15' }]}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>📱</Text>
              <Text style={styles.kpiValue}>{stats.pendingCallbacks}</Text>
              <Text style={styles.kpiLabel}>Callbacks</Text>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: COLORS.purple + '15' }]}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>📅</Text>
              <Text style={styles.kpiValue}>{stats.followUpToday}</Text>
              <Text style={styles.kpiLabel}>Today's Follow-ups</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: COLORS.green + '15' }]}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>✅</Text>
              <Text style={styles.kpiValue}>{stats.bookedLeads}</Text>
              <Text style={styles.kpiLabel}>Booked Leads</Text>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: COLORS.yellow + '15' }]}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>⚠️</Text>
              <Text style={styles.kpiValue}>{stats.incompleteLeads}</Text>
              <Text style={styles.kpiLabel}>Incomplete Leads</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: COLORS.red + '15' }]}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>❌</Text>
              <Text style={styles.kpiValue}>{stats.rejectedLeads}</Text>
              <Text style={styles.kpiLabel}>Rejected Leads</Text>
            </View>
          </View>
        </View>

        {/* Call Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Performance</Text>
          <View style={styles.performanceCard}>
            <View style={styles.performanceRow}>
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
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
              onPress={() => setCurrentScreen('leads')}
            >
              <Text style={{ fontSize: 32, color: '#fff', marginBottom: 8 }}>📞</Text>
              <Text style={styles.actionButtonText}>View Queue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.indigo }]}
              onPress={() => setCurrentScreen('enquiryLeads')}
            >
              <Text style={{ fontSize: 32, color: '#fff', marginBottom: 8 }}>🧾</Text>
              <Text style={styles.actionButtonText}>Enquiry Leads</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.green }]}
              onPress={() => setCurrentScreen('createLead')}
            >
              <Text style={{ fontSize: 32, color: '#fff', marginBottom: 8 }}>➕</Text>
              <Text style={styles.actionButtonText}>Create Lead</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.orange }]}
              onPress={() => setCurrentScreen('followups')}
            >
              <Text style={{ fontSize: 32, color: '#fff', marginBottom: 8 }}>📅</Text>
              <Text style={styles.actionButtonText}>Follow-ups</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.purple }]}
              onPress={() => setCurrentScreen('scripts')}
            >
              <Text style={{ fontSize: 32, color: '#fff', marginBottom: 8 }}>📋</Text>
              <Text style={styles.actionButtonText}>Call Scripts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.gray[700] }]}
              onPress={() => setCurrentScreen('profile')}
            >
              <Text style={{ fontSize: 32, color: '#fff', marginBottom: 8 }}>👤</Text>
              <Text style={styles.actionButtonText}>My Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Leads */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Leads</Text>
          {recentLeads.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No leads yet</Text>
            </View>
          ) : (
            recentLeads.map((lead) => (
              <TouchableOpacity
                key={lead.id}
                style={styles.leadCard}
                onPress={() => navigation.navigate('TelecallerLeadDetail', { leadId: lead.id })}
              >
                <View style={styles.leadInfo}>
                  <Text style={styles.leadName}>{lead.customer_name}</Text>
                  <Text style={styles.leadNumber}>#{lead.lead_number}</Text>
                  <Text style={styles.leadPhone}>{lead.customer_phone}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(lead.status) }]}>
                  <Text style={styles.statusText}>{lead.status}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Upcoming Follow-ups */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Follow-ups</Text>
          {upcomingFollowUps.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No upcoming follow-ups</Text>
            </View>
          ) : (
            upcomingFollowUps.map((followUp) => (
              <View key={followUp.id} style={styles.followUpCard}>
                <View style={styles.followUpHeader}>
                  <Text style={{ fontSize: 20, marginRight: 8 }}>👤</Text>
                  <Text style={styles.followUpName}>{followUp.lead?.customer_name}</Text>
                  {followUp.priority === 'URGENT' && (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.urgentText}>URGENT</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.followUpTime}>
                  {formatDateTime(followUp.scheduled_time)}
                </Text>
                <Text style={styles.followUpType}>{followUp.follow_up_type}</Text>
                <View style={styles.followUpActions}>
                  <TouchableOpacity
                    style={[styles.followUpActionButton, styles.followUpPrimary]}
                    onPress={() => handleCallNow(followUp.lead?.customer_phone)}
                  >
                    <Text style={styles.followUpActionText}>Call Now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.followUpActionButton, styles.followUpSecondary]}
                    onPress={() => handleReschedule(followUp)}
                  >
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

      <BottomNav 
        activeTab="dashboard" 
        onTabChange={setCurrentScreen}
        tabs={[
          { id: 'dashboard', label: 'Home', icon: 'home' },
          { id: 'leads', label: 'Leads', icon: 'clipboard' },
          { id: 'enquiryLeads', label: 'Enquiry', icon: 'file' },
          { id: 'followups', label: 'Follow-ups', icon: 'calendar' },
          { id: 'profile', label: 'Profile', icon: 'account' },
        ]}
      />
    </View>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'NEW': return COLORS.blue + '30';
    case 'ASSIGNED': return COLORS.indigo + '30';
    case 'ACCEPTED': return COLORS.green + '30';
    case 'REJECTED': return COLORS.red + '30';
    case 'BOOKED': return COLORS.purple + '30';
    default: return COLORS.gray + '30';
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
  },
  content: {
    flex: 1,
  },
  kpiContainer: {
    padding: SPACING.md,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    marginHorizontal: SPACING.xs,
    alignItems: 'center',
    elevation: 2,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  kpiLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  performanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    elevation: 2,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  performanceItem: {
    alignItems: 'center',
  },
  performanceDivider: {
    width: 1,
    backgroundColor: COLORS.gray + '30',
  },
  performanceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  performanceLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  actionButton: {
    width: (width - SPACING.md * 3) / 2,
    aspectRatio: 1,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  leadCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  leadNumber: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  leadPhone: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  followUpCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    elevation: 2,
  },
  followUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  followUpName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    flex: 1,
  },
  urgentBadge: {
    backgroundColor: COLORS.red + '20',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 8,
  },
  urgentText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.red,
  },
  followUpTime: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  followUpType: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  followUpActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  followUpActionButton: {
    flex: 1,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
    alignItems: 'center',
  },
  followUpPrimary: {
    backgroundColor: COLORS.primary,
  },
  followUpSecondary: {
    backgroundColor: COLORS.gray[200],
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.xl,
    alignItems: 'center',
    elevation: 2,
  },
  emptyText: {
    color: COLORS.textSecondary,
  },
});
