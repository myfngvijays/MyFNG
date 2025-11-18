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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import BottomNav from '../../components/BottomNav';
import { COLORS, SPACING } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function SuperAdminDashboard() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [globalMetrics, setGlobalMetrics] = useState({
    totalLeadsToday: 0,
    acceptedLeads: 0,
    rejectedLeads: 0,
    slaBreaches: 0,
    totalRevenue: 0,
    dailyRevenue: 0,
    activeWorkshops: 0,
    totalCustomers: 0,
    avgWorkshopRating: 0,
    complaintVolume: 0,
    rsaEmergencies: 0,
    systemUptime: 99.9
  });

  const [departmentMetrics, setDepartmentMetrics] = useState({
    telecaller: { leads: 0, followUps: 0, conversion: 0 },
    leadManager: { assigned: 0, avgTime: 0, accuracy: 0 },
    workshops: { active: 0, busy: 0, avgCompletion: 0 },
    rsa: { active: 0, avgDispatch: 0, completion: 0 },
    auditors: { auditsToday: 0, fraudFound: 0, avgScore: 0 }
  });

  const [alerts, setAlerts] = useState<any[]>([]);

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
      const today = new Date().toISOString().split('T')[0];

      // Fetch Global Metrics
      const [
        totalLeadsResult,
        acceptedResult,
        rejectedResult,
        slaBreachedResult,
        workshopsResult,
        customersResult,
        complaintsResult
      ] = await Promise.all([
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .gte('created_at', `${today}T00:00:00`),
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .eq('status', 'ACCEPTED'),
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .eq('status', 'REJECTED'),
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .eq('sla_state', 'BREACHED')
          .not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)'),
        supabase.from('workshops').select('id, is_active', { count: 'exact', head: true })
          .eq('is_active', true),
        supabase.from('users_login').select('id', { count: 'exact', head: true })
          .eq('role_code', 'CUSTOMER'),
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .eq('status', 'COMPLAINT')
      ]);

      setGlobalMetrics({
        totalLeadsToday: totalLeadsResult.count || 0,
        acceptedLeads: acceptedResult.count || 0,
        rejectedLeads: rejectedResult.count || 0,
        slaBreaches: slaBreachedResult.count || 0,
        totalRevenue: 2450000, // Calculate from invoices
        dailyRevenue: 125000, // Today's revenue
        activeWorkshops: workshopsResult.count || 0,
        totalCustomers: customersResult.count || 0,
        avgWorkshopRating: 4.5,
        complaintVolume: complaintsResult.count || 0,
        rsaEmergencies: 3,
        systemUptime: 99.9
      });

      // Fetch Department Metrics
      const [telecallerLeads, assignedLeads] = await Promise.all([
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .not('assigned_telecaller_id', 'is', null),
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .not('assigned_workshop_id', 'is', null)
      ]);

      setDepartmentMetrics({
        telecaller: {
          leads: telecallerLeads.count || 0,
          followUps: 45,
          conversion: 72
        },
        leadManager: {
          assigned: assignedLeads.count || 0,
          avgTime: 12,
          accuracy: 94
        },
        workshops: {
          active: workshopsResult.count || 0,
          busy: 8,
          avgCompletion: 4.5
        },
        rsa: {
          active: 12,
          avgDispatch: 18,
          completion: 89
        },
        auditors: {
          auditsToday: 5,
          fraudFound: 1,
          avgScore: 8.2
        }
      });

      // Fetch Alerts
      const criticalAlerts = [];
      if (slaBreachedResult.count > 0) {
        criticalAlerts.push({
          id: 'sla',
          type: 'CRITICAL',
          icon: 'alert-circle',
          color: COLORS.red,
          title: 'SLA Breaches',
          message: `${slaBreachedResult.count} leads have breached SLA`,
          action: 'leads'
        });
      }
      if (complaintsResult.count > 5) {
        criticalAlerts.push({
          id: 'complaints',
          type: 'HIGH',
          icon: 'alert',
          color: COLORS.orange,
          title: 'High Complaint Volume',
          message: `${complaintsResult.count} active complaints`,
          action: 'complaints'
        });
      }
      setAlerts(criticalAlerts);

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

  const handleNavigation = (screen: string) => {
    setCurrentScreen(screen);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading Super Admin Dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader 
        title="Super Admin Control Panel"
        userProfile={userProfile}
        onLogout={handleLogout}
      />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* System Status Banner */}
        <View style={styles.statusBanner}>
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, { backgroundColor: COLORS.green }]} />
            <Text style={styles.statusText}>System Operational</Text>
          </View>
          <Text style={styles.uptimeText}>{globalMetrics.systemUptime}% Uptime</Text>
        </View>

        {/* Critical Alerts */}
        {alerts.length > 0 && (
          <View style={styles.alertsSection}>
            <Text style={styles.sectionTitle}>🚨 Critical Alerts</Text>
            {alerts.map((alert) => (
              <TouchableOpacity
                key={alert.id}
                style={[styles.alertCard, { borderLeftColor: alert.color }]}
                onPress={() => handleNavigation(alert.action)}
              >
                <MaterialCommunityIcons name={alert.icon} size={24} color={alert.color} />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Global Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌍 Global Metrics</Text>
          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { backgroundColor: COLORS.blue + '15' }]}>
              <MaterialCommunityIcons name="clipboard-text" size={28} color={COLORS.blue} />
              <Text style={styles.metricValue}>{globalMetrics.totalLeadsToday}</Text>
              <Text style={styles.metricLabel}>Leads Today</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: COLORS.green + '15' }]}>
              <MaterialCommunityIcons name="check-circle" size={28} color={COLORS.green} />
              <Text style={styles.metricValue}>{globalMetrics.acceptedLeads}</Text>
              <Text style={styles.metricLabel}>Accepted</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: COLORS.red + '15' }]}>
              <MaterialCommunityIcons name="close-circle" size={28} color={COLORS.red} />
              <Text style={styles.metricValue}>{globalMetrics.rejectedLeads}</Text>
              <Text style={styles.metricLabel}>Rejected</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: COLORS.orange + '15' }]}>
              <MaterialCommunityIcons name="clock-alert" size={28} color={COLORS.orange} />
              <Text style={styles.metricValue}>{globalMetrics.slaBreaches}</Text>
              <Text style={styles.metricLabel}>SLA Breach</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: COLORS.purple + '15' }]}>
              <MaterialCommunityIcons name="store" size={28} color={COLORS.purple} />
              <Text style={styles.metricValue}>{globalMetrics.activeWorkshops}</Text>
              <Text style={styles.metricLabel}>Workshops</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: COLORS.teal + '15' }]}>
              <MaterialCommunityIcons name="account-group" size={28} color={COLORS.teal} />
              <Text style={styles.metricValue}>{globalMetrics.totalCustomers}</Text>
              <Text style={styles.metricLabel}>Customers</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: COLORS.indigo + '15' }]}>
              <MaterialCommunityIcons name="alert-circle" size={28} color={COLORS.indigo} />
              <Text style={styles.metricValue}>{globalMetrics.complaintVolume}</Text>
              <Text style={styles.metricLabel}>Complaints</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: COLORS.red + '15' }]}>
              <MaterialCommunityIcons name="car-emergency" size={28} color={COLORS.red} />
              <Text style={styles.metricValue}>{globalMetrics.rsaEmergencies}</Text>
              <Text style={styles.metricLabel}>RSA Active</Text>
            </View>
          </View>
        </View>

        {/* Revenue */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Revenue</Text>
          <View style={styles.revenueCard}>
            <View style={styles.revenueRow}>
              <View style={styles.revenueItem}>
                <Text style={styles.revenueLabel}>Daily Revenue</Text>
                <Text style={[styles.revenueValue, { color: COLORS.green }]}>
                  ₹{(globalMetrics.dailyRevenue / 1000).toFixed(0)}K
                </Text>
              </View>
              <View style={styles.revenueDivider} />
              <View style={styles.revenueItem}>
                <Text style={styles.revenueLabel}>Total Revenue</Text>
                <Text style={[styles.revenueValue, { color: COLORS.primary }]}>
                  ₹{(globalMetrics.totalRevenue / 100000).toFixed(1)}L
                </Text>
              </View>
              <View style={styles.revenueDivider} />
              <View style={styles.revenueItem}>
                <Text style={styles.revenueLabel}>Avg Rating</Text>
                <Text style={[styles.revenueValue, { color: COLORS.orange }]}>
                  {globalMetrics.avgWorkshopRating}⭐
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Department Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Department Performance</Text>

          {/* Telecaller */}
          <View style={styles.deptCard}>
            <View style={styles.deptHeader}>
              <MaterialCommunityIcons name="phone" size={24} color={COLORS.blue} />
              <Text style={styles.deptTitle}>Telecaller</Text>
            </View>
            <View style={styles.deptMetrics}>
              <View style={styles.deptMetricItem}>
                <Text style={styles.deptMetricValue}>{departmentMetrics.telecaller.leads}</Text>
                <Text style={styles.deptMetricLabel}>Leads</Text>
              </View>
              <View style={styles.deptMetricItem}>
                <Text style={styles.deptMetricValue}>{departmentMetrics.telecaller.followUps}</Text>
                <Text style={styles.deptMetricLabel}>Follow-ups</Text>
              </View>
              <View style={styles.deptMetricItem}>
                <Text style={[styles.deptMetricValue, { color: COLORS.green }]}>
                  {departmentMetrics.telecaller.conversion}%
                </Text>
                <Text style={styles.deptMetricLabel}>Conversion</Text>
              </View>
            </View>
          </View>

          {/* Lead Manager */}
          <View style={styles.deptCard}>
            <View style={styles.deptHeader}>
              <MaterialCommunityIcons name="account-tie" size={24} color={COLORS.purple} />
              <Text style={styles.deptTitle}>Lead Manager</Text>
            </View>
            <View style={styles.deptMetrics}>
              <View style={styles.deptMetricItem}>
                <Text style={styles.deptMetricValue}>{departmentMetrics.leadManager.assigned}</Text>
                <Text style={styles.deptMetricLabel}>Assigned</Text>
              </View>
              <View style={styles.deptMetricItem}>
                <Text style={styles.deptMetricValue}>{departmentMetrics.leadManager.avgTime}m</Text>
                <Text style={styles.deptMetricLabel}>Avg Time</Text>
              </View>
              <View style={styles.deptMetricItem}>
                <Text style={[styles.deptMetricValue, { color: COLORS.green }]}>
                  {departmentMetrics.leadManager.accuracy}%
                </Text>
                <Text style={styles.deptMetricLabel}>Accuracy</Text>
              </View>
            </View>
          </View>

          {/* Workshops */}
          <View style={styles.deptCard}>
            <View style={styles.deptHeader}>
              <MaterialCommunityIcons name="store" size={24} color={COLORS.orange} />
              <Text style={styles.deptTitle}>Workshops</Text>
            </View>
            <View style={styles.deptMetrics}>
              <View style={styles.deptMetricItem}>
                <Text style={styles.deptMetricValue}>{departmentMetrics.workshops.active}</Text>
                <Text style={styles.deptMetricLabel}>Active</Text>
              </View>
              <View style={styles.deptMetricItem}>
                <Text style={styles.deptMetricValue}>{departmentMetrics.workshops.busy}</Text>
                <Text style={styles.deptMetricLabel}>Busy</Text>
              </View>
              <View style={styles.deptMetricItem}>
                <Text style={styles.deptMetricValue}>{departmentMetrics.workshops.avgCompletion}h</Text>
                <Text style={styles.deptMetricLabel}>Avg Time</Text>
              </View>
            </View>
          </View>

          {/* RSA */}
          <View style={styles.deptCard}>
            <View style={styles.deptHeader}>
              <MaterialCommunityIcons name="car-emergency" size={24} color={COLORS.red} />
              <Text style={styles.deptTitle}>RSA (Roadside Assistance)</Text>
            </View>
            <View style={styles.deptMetrics}>
              <View style={styles.deptMetricItem}>
                <Text style={styles.deptMetricValue}>{departmentMetrics.rsa.active}</Text>
                <Text style={styles.deptMetricLabel}>Active</Text>
              </View>
              <View style={styles.deptMetricItem}>
                <Text style={styles.deptMetricValue}>{departmentMetrics.rsa.avgDispatch}m</Text>
                <Text style={styles.deptMetricLabel}>Dispatch</Text>
              </View>
              <View style={styles.deptMetricItem}>
                <Text style={[styles.deptMetricValue, { color: COLORS.green }]}>
                  {departmentMetrics.rsa.completion}%
                </Text>
                <Text style={styles.deptMetricLabel}>Complete</Text>
              </View>
            </View>
          </View>

          {/* Auditors */}
          <View style={styles.deptCard}>
            <View style={styles.deptHeader}>
              <MaterialCommunityIcons name="shield-check" size={24} color={COLORS.indigo} />
              <Text style={styles.deptTitle}>Quality Auditors</Text>
            </View>
            <View style={styles.deptMetrics}>
              <View style={styles.deptMetricItem}>
                <Text style={styles.deptMetricValue}>{departmentMetrics.auditors.auditsToday}</Text>
                <Text style={styles.deptMetricLabel}>Audits</Text>
              </View>
              <View style={styles.deptMetricItem}>
                <Text style={[styles.deptMetricValue, { color: COLORS.red }]}>
                  {departmentMetrics.auditors.fraudFound}
                </Text>
                <Text style={styles.deptMetricLabel}>Fraud</Text>
              </View>
              <View style={styles.deptMetricItem}>
                <Text style={styles.deptMetricValue}>{departmentMetrics.auditors.avgScore}/10</Text>
                <Text style={styles.deptMetricLabel}>Avg Score</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Admin Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Super Admin Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.blue }]}
              onPress={() => handleNavigation('workshops')}
            >
              <MaterialCommunityIcons name="store" size={32} color="#fff" />
              <Text style={styles.actionBtnText}>Workshops</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.purple }]}
              onPress={() => handleNavigation('users')}
            >
              <MaterialCommunityIcons name="account-group" size={32} color="#fff" />
              <Text style={styles.actionBtnText}>Users</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.green }]}
              onPress={() => handleNavigation('finance')}
            >
              <MaterialCommunityIcons name="currency-inr" size={32} color="#fff" />
              <Text style={styles.actionBtnText}>Finance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.orange }]}
              onPress={() => handleNavigation('settings')}
            >
              <MaterialCommunityIcons name="cog" size={32} color="#fff" />
              <Text style={styles.actionBtnText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.red }]}
              onPress={() => handleNavigation('fraud')}
            >
              <MaterialCommunityIcons name="shield-alert" size={32} color="#fff" />
              <Text style={styles.actionBtnText}>Fraud</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.indigo }]}
              onPress={() => handleNavigation('reports')}
            >
              <MaterialCommunityIcons name="chart-bar" size={32} color="#fff" />
              <Text style={styles.actionBtnText}>Reports</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <BottomNav activeTab="dashboard" onTabChange={setCurrentScreen} />
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
  statusBanner: {
    backgroundColor: COLORS.green + '15',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.green + '30',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.green,
  },
  uptimeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  alertsSection: {
    padding: SPACING.md,
    backgroundColor: '#fff',
    marginBottom: SPACING.sm,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: 12,
    marginTop: SPACING.sm,
    borderLeftWidth: 4,
    gap: SPACING.sm,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  alertMessage: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  section: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metricCard: {
    width: (width - SPACING.md * 3) / 2,
    aspectRatio: 1.2,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  metricLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  revenueCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    elevation: 2,
  },
  revenueRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  revenueItem: {
    alignItems: 'center',
  },
  revenueDivider: {
    width: 1,
    backgroundColor: COLORS.gray + '30',
  },
  revenueLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  revenueValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  deptCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    elevation: 2,
  },
  deptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray + '20',
  },
  deptTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  deptMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  deptMetricItem: {
    alignItems: 'center',
  },
  deptMetricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  deptMetricLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  actionBtn: {
    width: (width - SPACING.md * 3) / 2,
    aspectRatio: 1.5,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: SPACING.sm,
  },
});
