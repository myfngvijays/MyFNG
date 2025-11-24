import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions
} from 'react-native';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../components/Icon';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import BottomNav from '../../components/BottomNav';
import LeadManagerLeadsScreen from './leadmanager/LeadManagerLeadsScreen';
import LeadManagerLeadDetailScreen from './leadmanager/LeadManagerLeadDetailScreen';
import LeadManagerAssignWorkshopScreen from './leadmanager/LeadManagerAssignWorkshopScreen';
import LeadManagerEscalationsScreen from './leadmanager/LeadManagerEscalationsScreen';
import { COLORS, SPACING } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function LeadManagerDashboard() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [stats, setStats] = useState({
    newLeads: 0,
    incompleteLeads: 0,
    pendingAssignment: 0,
    awaitingAcceptance: 0,
    slaAtRisk: 0,
    slaBreached: 0,
    workshopRejected: 0,
    reopenedLeads: 0,
    telecallerPending: 0,
    pickupPending: 0,
    totalLeads: 0,
    assignmentAccuracy: 0,
    avgAssignmentTime: 0
  });

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

      const now = new Date().toISOString();
      const today = new Date().toISOString().split('T')[0];

      // Fetch all stats in parallel
      const [
        newLeadsResult,
        incompleteResult,
        pendingAssignmentResult,
        awaitingAcceptanceResult,
        slaAtRiskResult,
        slaBreachedResult,
        rejectedResult,
        reopenedResult,
        telecallerPendingResult,
        pickupPendingResult,
        totalLeadsResult
      ] = await Promise.all([
        // New unassigned leads
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'NEW')
          .is('assigned_workshop_id', null),

        // Incomplete leads
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('is_incomplete', true),

        // Pending assignment (validated but not assigned)
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .in('status', ['NEW', 'VALIDATED'])
          .is('assigned_workshop_id', null)
          .eq('is_incomplete', false),

        // Awaiting workshop acceptance
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'ASSIGNED')
          .not('assigned_workshop_id', 'is', null),

        // SLA at risk (approaching deadline)
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('sla_state', 'AT_RISK')
          .not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)'),

        // SLA breached
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('sla_state', 'BREACHED')
          .not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)'),

        // Workshop rejected
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'REJECTED'),

        // Reopened leads
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .gt('reopen_count', 0)
          .not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)'),

        // Telecaller pending follow-up
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('follow_up_required', true)
          .not('assigned_telecaller_id', 'is', null),

        // Pickup pending
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('pickup_required', true)
          .eq('pickup_status', 'PENDING'),

        // Total active leads
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)')
      ]);

      setStats({
        newLeads: newLeadsResult.count || 0,
        incompleteLeads: incompleteResult.count || 0,
        pendingAssignment: pendingAssignmentResult.count || 0,
        awaitingAcceptance: awaitingAcceptanceResult.count || 0,
        slaAtRisk: slaAtRiskResult.count || 0,
        slaBreached: slaBreachedResult.count || 0,
        workshopRejected: rejectedResult.count || 0,
        reopenedLeads: reopenedResult.count || 0,
        telecallerPending: telecallerPendingResult.count || 0,
        pickupPending: pickupPendingResult.count || 0,
        totalLeads: totalLeadsResult.count || 0,
        assignmentAccuracy: 94, // Calculate from historical data
        avgAssignmentTime: 12 // Calculate average in minutes
      });

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleFilterClick = (filter: string) => {
    setSelectedFilter(filter);
    setCurrentScreen('leads');
  };

  // Simple navigation object
  const navigation = {
    navigate: (screen: string, params?: any) => {
      setCurrentScreen(screen);
      if (params?.leadId) {
        setSelectedLeadId(params.leadId);
      }
      if (params?.filter) {
        setSelectedFilter(params.filter);
      }
    },
    goBack: () => {
      setCurrentScreen('dashboard');
      setSelectedLeadId(null);
    }
  };

  // Render different screens based on currentScreen state
  if (currentScreen === 'leads') {
    return <LeadManagerLeadsScreen navigation={navigation} route={{ params: { filter: selectedFilter } }} />;
  }

  if (currentScreen === 'LeadManagerLeadDetail' && selectedLeadId) {
    return <LeadManagerLeadDetailScreen navigation={navigation} route={{ params: { leadId: selectedLeadId } }} />;
  }

  if (currentScreen === 'assignWorkshop' && selectedLeadId) {
    return <LeadManagerAssignWorkshopScreen navigation={navigation} route={{ params: { leadId: selectedLeadId } }} />;
  }

  if (currentScreen === 'escalations') {
    return <LeadManagerEscalationsScreen navigation={navigation} />;
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
        title="Lead Manager Control Panel"
        userProfile={userProfile}
        onLogout={handleLogout}
      />
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* Critical Alerts Section */}
        {(stats.slaBreached > 0 || stats.workshopRejected > 0 || stats.slaAtRisk > 0) && (
          <View style={styles.alertSection}>
            <Text style={styles.alertTitle}>🚨 Critical Alerts</Text>
            
            {stats.slaBreached > 0 && (
              <TouchableOpacity
                style={[styles.alertCard, { backgroundColor: COLORS.red + '20' }]}
                onPress={() => handleFilterClick('SLA_BREACHED')}
              >
                <Icon name="alert-circle" size={24} color={COLORS.red} />
                <View style={styles.alertContent}>
                  <Text style={[styles.alertValue, { color: COLORS.red }]}>{stats.slaBreached}</Text>
                  <Text style={styles.alertLabel}>SLA BREACHED</Text>
                </View>
                <Icon name="chevron-right" size={20} color={COLORS.red} />
              </TouchableOpacity>
            )}

            {stats.slaAtRisk > 0 && (
              <TouchableOpacity
                style={[styles.alertCard, { backgroundColor: COLORS.orange + '20' }]}
                onPress={() => handleFilterClick('SLA_AT_RISK')}
              >
                <Icon name="clock-alert" size={24} color={COLORS.orange} />
                <View style={styles.alertContent}>
                  <Text style={[styles.alertValue, { color: COLORS.orange }]}>{stats.slaAtRisk}</Text>
                  <Text style={styles.alertLabel}>SLA AT RISK</Text>
                </View>
                <Icon name="chevron-right" size={20} color={COLORS.orange} />
              </TouchableOpacity>
            )}

            {stats.workshopRejected > 0 && (
              <TouchableOpacity
                style={[styles.alertCard, { backgroundColor: COLORS.red + '15' }]}
                onPress={() => handleFilterClick('WORKSHOP_REJECTED')}
              >
                <Icon name="close-circle" size={24} color={COLORS.red} />
                <View style={styles.alertContent}>
                  <Text style={[styles.alertValue, { color: COLORS.red }]}>{stats.workshopRejected}</Text>
                  <Text style={styles.alertLabel}>WORKSHOP REJECTED</Text>
                </View>
                <Icon name="chevron-right" size={20} color={COLORS.red} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Main KPI Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Operational Overview</Text>
          
          <View style={styles.kpiGrid}>
            {/* New Leads */}
            <TouchableOpacity
              style={[styles.kpiCard, { backgroundColor: COLORS.blue + '15' }]}
              onPress={() => handleFilterClick('NEW')}
            >
              <Icon name="new-box" size={32} color={COLORS.blue} />
              <Text style={styles.kpiValue}>{stats.newLeads}</Text>
              <Text style={styles.kpiLabel}>New Leads</Text>
            </TouchableOpacity>

            {/* Incomplete */}
            <TouchableOpacity
              style={[styles.kpiCard, { backgroundColor: COLORS.orange + '15' }]}
              onPress={() => handleFilterClick('INCOMPLETE')}
            >
              <Icon name="clipboard-alert" size={32} color={COLORS.orange} />
              <Text style={styles.kpiValue}>{stats.incompleteLeads}</Text>
              <Text style={styles.kpiLabel}>Incomplete</Text>
            </TouchableOpacity>

            {/* Pending Assignment */}
            <TouchableOpacity
              style={[styles.kpiCard, { backgroundColor: COLORS.purple + '15' }]}
              onPress={() => handleFilterClick('NEED_ASSIGNMENT')}
            >
              <Icon name="hand-pointing-right" size={32} color={COLORS.purple} />
              <Text style={styles.kpiValue}>{stats.pendingAssignment}</Text>
              <Text style={styles.kpiLabel}>Need Assignment</Text>
            </TouchableOpacity>

            {/* Awaiting Acceptance */}
            <TouchableOpacity
              style={[styles.kpiCard, { backgroundColor: COLORS.indigo + '15' }]}
              onPress={() => handleFilterClick('AWAITING_ACCEPTANCE')}
            >
              <Icon name="clock-check-outline" size={32} color={COLORS.indigo} />
              <Text style={styles.kpiValue}>{stats.awaitingAcceptance}</Text>
              <Text style={styles.kpiLabel}>Awaiting Accept</Text>
            </TouchableOpacity>

            {/* Reopened */}
            <TouchableOpacity
              style={[styles.kpiCard, { backgroundColor: COLORS.red + '15' }]}
              onPress={() => handleFilterClick('REOPENED')}
            >
              <Icon name="refresh-circle" size={32} color={COLORS.red} />
              <Text style={styles.kpiValue}>{stats.reopenedLeads}</Text>
              <Text style={styles.kpiLabel}>Reopened</Text>
            </TouchableOpacity>

            {/* Telecaller Pending */}
            <TouchableOpacity
              style={[styles.kpiCard, { backgroundColor: COLORS.teal + '15' }]}
              onPress={() => handleFilterClick('TELECALLER_PENDING')}
            >
              <Icon name="phone-forward" size={32} color={COLORS.teal} />
              <Text style={styles.kpiValue}>{stats.telecallerPending}</Text>
              <Text style={styles.kpiLabel}>Tel. Pending</Text>
            </TouchableOpacity>

            {/* Pickup Pending */}
            <TouchableOpacity
              style={[styles.kpiCard, { backgroundColor: COLORS.green + '15' }]}
              onPress={() => handleFilterClick('PICKUP_PENDING')}
            >
              <Icon name="car-pickup" size={32} color={COLORS.green} />
              <Text style={styles.kpiValue}>{stats.pickupPending}</Text>
              <Text style={styles.kpiLabel}>Pickup Pending</Text>
            </TouchableOpacity>

            {/* Total Active */}
            <TouchableOpacity
              style={[styles.kpiCard, { backgroundColor: COLORS.gray + '15' }]}
              onPress={() => handleFilterClick('all')}
            >
              <Icon name="format-list-bulleted" size={32} color={COLORS.gray} />
              <Text style={styles.kpiValue}>{stats.totalLeads}</Text>
              <Text style={styles.kpiLabel}>Total Active</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Performance Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 Performance Metrics</Text>
          <View style={styles.performanceCard}>
            <View style={styles.performanceRow}>
              <View style={styles.performanceItem}>
                <Text style={[styles.performanceValue, { color: COLORS.green }]}>
                  {stats.assignmentAccuracy}%
                </Text>
                <Text style={styles.performanceLabel}>Assignment Accuracy</Text>
              </View>
              <View style={styles.performanceDivider} />
              <View style={styles.performanceItem}>
                <Text style={[styles.performanceValue, { color: COLORS.blue }]}>
                  {stats.avgAssignmentTime}m
                </Text>
                <Text style={styles.performanceLabel}>Avg Assignment Time</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
              onPress={() => handleFilterClick('all')}
            >
              <Icon name="format-list-bulleted-square" size={32} color="#fff" />
              <Text style={styles.actionButtonText}>All Leads</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.orange }]}
              onPress={() => setCurrentScreen('escalations')}
            >
              <Icon name="alert-octagon" size={32} color="#fff" />
              <Text style={styles.actionButtonText}>Escalations</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.purple }]}
              onPress={() => handleFilterClick('NEED_ASSIGNMENT')}
            >
              <Icon name="account-arrow-right" size={32} color="#fff" />
              <Text style={styles.actionButtonText}>Assign Leads</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.green }]}
              onPress={() => handleFilterClick('INCOMPLETE')}
            >
              <Icon name="clipboard-check" size={32} color="#fff" />
              <Text style={styles.actionButtonText}>Fix Incomplete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <BottomNav 
        activeTab="dashboard" 
        onTabChange={setCurrentScreen}
        tabs={[
          { id: 'dashboard', label: 'Home', icon: '🏠' },
          { id: 'leads', label: 'Leads', icon: '📋' },
          { id: 'workshops', label: 'Workshops', icon: '🏭' },
          { id: 'reports', label: 'Reports', icon: '📊' },
        ]}
      />
    </View>
  );
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
  alertSection: {
    padding: SPACING.md,
    backgroundColor: '#fff',
    marginBottom: SPACING.sm,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
  },
  alertContent: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  alertValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  alertLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  kpiCard: {
    width: (width - SPACING.md * 3) / 2,
    aspectRatio: 1.2,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  performanceLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  actionButton: {
    width: (width - SPACING.md * 3) / 2,
    aspectRatio: 1.5,
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
});
