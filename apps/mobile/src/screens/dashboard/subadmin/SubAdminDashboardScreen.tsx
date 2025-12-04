/**
 * SUB_ADMIN Dashboard Screen - React Native
 * Sub Admin Mobile App (CSE Manager, Telecaller Manager, Auditor Manager)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ENV } from '../../../config/environment';

export default function SubAdminDashboardScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // On dashboard, back button can exit app or do nothing
      return false; // Allow default behavior (exit app)
    });
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      // Get user profile with department
      const { data: profile, error: profileError } = await supabase
        .from('users_login')
        .select('id, full_name, department, roles!inner(role_code, role_name)')
        .eq('id', authUser.id)
        .single();

      if (profileError || !profile) {
        Alert.alert('Error', 'Profile not found');
        return;
      }

      if ((profile.roles as any)?.role_code !== 'SUB_ADMIN') {
        Alert.alert('Error', 'Access denied');
        return;
      }

      if (!profile.department || !['CSE', 'TELECALLER', 'AUDITOR'].includes(profile.department)) {
        Alert.alert('Error', 'Department not set. Please contact administrator.');
        return;
      }

      setUserProfile(profile);
      setDepartment(profile.department);

      // Fetch dashboard data from API
      const response = await fetch(`${ENV.API_URL}/api/subadmin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      setDashboardData(data);
    } catch (error: any) {
      console.error('Error fetching dashboard:', error);
      Alert.alert('Error', error.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getDepartmentTitle = () => {
    switch (department) {
      case 'CSE':
        return 'Customer Service Manager';
      case 'TELECALLER':
        return 'Telecalling Manager';
      case 'AUDITOR':
        return 'Audit Manager';
      default:
        return 'Sub Admin';
    }
  };

  const renderCSEWidgets = () => {
    if (department !== 'CSE' || !dashboardData) return null;

    return (
      <View style={styles.widgetsContainer}>
        <TouchableOpacity
          style={styles.widgetCard}
          onPress={() => navigation.navigate('SubAdminTickets')}
        >
          <Ionicons name="document-text" size={32} color="#EF4444" />
          <Text style={styles.widgetValue}>{dashboardData.open_tickets || 0}</Text>
          <Text style={styles.widgetLabel}>Open Tickets</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.widgetCard}
          onPress={() => navigation.navigate('SubAdminTickets', { filter: 'in_progress' })}
        >
          <Ionicons name="time" size={32} color="#F59E0B" />
          <Text style={styles.widgetValue}>{dashboardData.pending_resolutions || 0}</Text>
          <Text style={styles.widgetLabel}>Pending Resolutions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.widgetCard}
          onPress={() => navigation.navigate('SubAdminCallbacks')}
        >
          <Ionicons name="call" size={32} color="#3B82F6" />
          <Text style={styles.widgetValue}>{dashboardData.pending_callbacks || 0}</Text>
          <Text style={styles.widgetLabel}>Pending Callbacks</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.widgetCard}
          onPress={() => navigation.navigate('SubAdminEscalations')}
        >
          <Ionicons name="alert-circle" size={32} color="#DC2626" />
          <Text style={styles.widgetValue}>{dashboardData.escalated_tickets || 0}</Text>
          <Text style={styles.widgetLabel}>Escalated</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTelecallerWidgets = () => {
    if (department !== 'TELECALLER' || !dashboardData) return null;

    return (
      <View style={styles.widgetsContainer}>
        <TouchableOpacity
          style={styles.widgetCard}
          onPress={() => navigation.navigate('SubAdminLeads')}
        >
          <Ionicons name="people" size={32} color="#3B82F6" />
          <Text style={styles.widgetValue}>{dashboardData.followups_pending || 0}</Text>
          <Text style={styles.widgetLabel}>Follow-ups Pending</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.widgetCard}
          onPress={() => navigation.navigate('SubAdminLeads')}
        >
          <Ionicons name="add-circle" size={32} color="#10B981" />
          <Text style={styles.widgetValue}>{dashboardData.leads_created_today || 0}</Text>
          <Text style={styles.widgetLabel}>Leads Created Today</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.widgetCard}
          onPress={() => navigation.navigate('SubAdminPerformance')}
        >
          <Ionicons name="trending-up" size={32} color="#8B5CF6" />
          <Text style={styles.widgetValue}>{dashboardData.conversion_rate || 0}%</Text>
          <Text style={styles.widgetLabel}>Conversion Rate</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.widgetCard}
          onPress={() => navigation.navigate('SubAdminEscalations')}
        >
          <Ionicons name="warning" size={32} color="#F59E0B" />
          <Text style={styles.widgetValue}>{dashboardData.low_accuracy_leads || 0}</Text>
          <Text style={styles.widgetLabel}>Low Accuracy</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderAuditorWidgets = () => {
    if (department !== 'AUDITOR' || !dashboardData) return null;

    return (
      <View style={styles.widgetsContainer}>
        <TouchableOpacity
          style={styles.widgetCard}
          onPress={() => navigation.navigate('SubAdminAudits')}
        >
          <Ionicons name="shield-checkmark" size={32} color="#3B82F6" />
          <Text style={styles.widgetValue}>{dashboardData.pending_audits || 0}</Text>
          <Text style={styles.widgetLabel}>Pending Audits</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.widgetCard}
          onPress={() => navigation.navigate('SubAdminAudits', { filter: 'completed' })}
        >
          <Ionicons name="checkmark-circle" size={32} color="#10B981" />
          <Text style={styles.widgetValue}>{dashboardData.audits_completed_today || 0}</Text>
          <Text style={styles.widgetLabel}>Completed Today</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.widgetCard}
          onPress={() => navigation.navigate('SubAdminPerformance')}
        >
          <Ionicons name="star" size={32} color="#F59E0B" />
          <Text style={styles.widgetValue}>{dashboardData.avg_audit_score || 0}</Text>
          <Text style={styles.widgetLabel}>Avg Audit Score</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.widgetCard}
          onPress={() => navigation.navigate('SubAdminEscalations')}
        >
          <Ionicons name="alert-circle" size={32} color="#DC2626" />
          <Text style={styles.widgetValue}>{dashboardData.fraud_detected || 0}</Text>
          <Text style={styles.widgetLabel}>Fraud Detected</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchDashboardData} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{userProfile?.full_name || 'Sub Admin'}</Text>
            <Text style={styles.department}>{getDepartmentTitle()}</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate('SubAdminProfile')}
            >
              <Ionicons name="person-circle" size={40} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => {
                Alert.alert(
                  'Logout',
                  'Are you sure you want to logout?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Logout',
                      style: 'destructive',
                      onPress: async () => {
                        await supabase.auth.signOut();
                        logout();
                      },
                    },
                  ]
                );
              }}
            >
              <Ionicons name="log-out-outline" size={28} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Cards */}
        {renderCSEWidgets()}
        {renderTelecallerWidgets()}
        {renderAuditorWidgets()}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('SubAdminTeam')}
            >
              <Ionicons name="people" size={24} color="#3B82F6" />
              <Text style={styles.actionLabel}>Team</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('SubAdminLeads')}
            >
              <Ionicons name="document-text" size={24} color="#10B981" />
              <Text style={styles.actionLabel}>Leads</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('SubAdminEscalations')}
            >
              <Ionicons name="alert-circle" size={24} color="#F59E0B" />
              <Text style={styles.actionLabel}>Escalations</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('SubAdminPerformance')}
            >
              <Ionicons name="stats-chart" size={24} color="#8B5CF6" />
              <Text style={styles.actionLabel}>Performance</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Department Specific Actions */}
        {department === 'CSE' && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.fullButton}
              onPress={() => navigation.navigate('SubAdminTickets')}
            >
              <Ionicons name="document-text" size={20} color="#FFF" />
              <Text style={styles.fullButtonText}>View All Tickets</Text>
            </TouchableOpacity>
          </View>
        )}

        {department === 'TELECALLER' && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.fullButton}
              onPress={() => navigation.navigate('SubAdminLeads')}
            >
              <Ionicons name="people" size={20} color="#FFF" />
              <Text style={styles.fullButtonText}>Manage Team Leads</Text>
            </TouchableOpacity>
          </View>
        )}

        {department === 'AUDITOR' && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.fullButton}
              onPress={() => navigation.navigate('SubAdminAudits')}
            >
              <Ionicons name="shield-checkmark" size={20} color="#FFF" />
              <Text style={styles.fullButtonText}>View All Audits</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  greeting: {
    fontSize: 14,
    color: '#6B7280',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 4,
  },
  department: {
    fontSize: 14,
    color: '#3B82F6',
    marginTop: 4,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileButton: {
    padding: 8,
  },
  logoutButton: {
    padding: 8,
  },
  widgetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  widgetCard: {
    width: '47%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  widgetValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  widgetLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionLabel: {
    fontSize: 14,
    color: '#111827',
    marginTop: 8,
    fontWeight: '600',
  },
  fullButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

