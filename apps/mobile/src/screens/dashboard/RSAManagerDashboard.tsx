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
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Alert } from 'react-native';
// Using direct Supabase RPC calls
import { COLORS, SIZES, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../constants/theme';
import StatCard from '../../components/StatCard';
import LeadCard from '../../components/LeadCard';
import RSALeadDetailScreen from './rsa/RSALeadDetailScreen';
import RSAMechanicsScreen from './rsa/RSAMechanicsScreen';
import RSAMechanicDetailScreen from './rsa/RSAMechanicDetailScreen';
import AddMechanicScreen from './rsa/AddMechanicScreen';
import { Icon } from '../../components/Icon';
import BottomNav from '../../components/BottomNav';

export default function RSAManagerDashboard() {
  const { userProfile, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    total_leads: 0,
    pending_leads: 0,
    completed_leads: 0,
    cancelled_leads: 0,
    assigned_to_me: 0,
    unassigned_leads: 0,
  });
  const [filter, setFilter] = useState<'all' | 'assigned' | 'unassigned' | 'pending' | 'completed'>('all');

  // Update activeTab when screen changes
  useEffect(() => {
    if (currentScreen === 'dashboard') {
      setActiveTab('dashboard');
    } else if (currentScreen === 'RSAMechanics' || currentScreen === 'RSAMechanicDetail') {
      setActiveTab('mechanics');
    } else if (currentScreen === 'AddMechanic') {
      setActiveTab('add_mechanic');
    }
  }, [currentScreen]);

  useEffect(() => {
    fetchData();
  }, [filter, userProfile]);

  const fetchData = async () => {
    if (!userProfile?.id) return;
    
    setLoading(true);
    try {
      const managerId = userProfile.id;
      const status = filter === 'all' ? '' : filter === 'assigned' ? 'assigned' : filter;
      const showAll = filter === 'all' || filter === 'unassigned';
      
      const [leadsResult, statsResult] = await Promise.all([
        supabase.rpc('rsa_manager_get_all_leads', {
          p_manager_id: managerId,
          p_status: status,
          p_show_all: showAll,
        }),
        supabase.rpc('rsa_manager_get_statistics', {
          p_manager_id: managerId,
        }),
      ]);
      
      const leadsData = leadsResult.data || [];
      const statsData = statsResult.data && statsResult.data.length > 0 ? statsResult.data[0] : stats;
      
      setLeads(leadsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleClaimLead = async (e: any, leadId: string) => {
    e?.stopPropagation?.();
    if (!userProfile) return;
    
    try {
      const { data, error } = await supabase.rpc('rsa_manager_self_assign_lead', {
        p_lead_id: leadId,
        p_manager_id: userProfile.id,
        p_manager_name: userProfile.full_name || userProfile.email,
      });
      
      if (error) {
        alert(`Error: ${error.message}`);
        return;
      }
      
      if (data && data.length > 0 && data[0].success) {
        alert('Lead claimed successfully!');
        fetchData();
      } else {
        alert(`Error: ${data?.[0]?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error claiming lead:', error);
      alert('Failed to claim lead');
    }
  };

  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(null);

  // Simple navigation object
  const navigation = {
    navigate: (screen: string, params?: any) => {
      setCurrentScreen(screen);
      if (params?.leadId) {
        setSelectedLeadId(params.leadId);
      }
      if (params?.mechanicId) {
        setSelectedMechanicId(params.mechanicId);
      }
      // Update active tab based on screen
      if (screen === 'RSAMechanics') {
        setActiveTab('mechanics');
      } else if (screen === 'AddMechanic') {
        setActiveTab('add_mechanic');
      } else {
        setActiveTab('dashboard');
      }
    },
    goBack: () => {
      // If we're on a detail screen, go back to previous screen
      if (currentScreen === 'RSAMechanicDetail') {
        setCurrentScreen('RSAMechanics');
        setSelectedMechanicId(null);
        setActiveTab('mechanics');
      } else if (currentScreen === 'RSALeadDetail') {
        setCurrentScreen('dashboard');
        setSelectedLeadId(null);
        setActiveTab('dashboard');
      } else {
        setCurrentScreen('dashboard');
        setSelectedLeadId(null);
        setSelectedMechanicId(null);
        setActiveTab('dashboard');
      }
    }
  };

  // Create route object for detail screens
  const route = {
    params: {
      leadId: selectedLeadId,
      mechanicId: selectedMechanicId,
    }
  };

  // Render Lead Detail Screen
  if (currentScreen === 'RSALeadDetail' && selectedLeadId) {
    return <RSALeadDetailScreen navigation={navigation} route={{ params: { leadId: selectedLeadId } }} />;
  }

  // Render Mechanics Screen
  if (currentScreen === 'RSAMechanics') {
    return <RSAMechanicsScreen navigation={navigation} route={{ params: {} }} />;
  }

  // Render Add Mechanic Screen
  if (currentScreen === 'AddMechanic') {
    return <AddMechanicScreen navigation={navigation} route={{ params: {} }} />;
  }

  // Render Mechanic Detail Screen
  if (currentScreen === 'RSAMechanicDetail' && selectedMechanicId) {
    return <RSAMechanicDetailScreen navigation={navigation} route={{ params: { mechanicId: selectedMechanicId } }} />;
  }

  const handleTabChange = (tab: string) => {
    if (tab === 'mechanics') {
      setCurrentScreen('RSAMechanics');
      setActiveTab('mechanics');
    } else if (tab === 'add_mechanic') {
      setCurrentScreen('AddMechanic');
      setActiveTab('add_mechanic');
    } else {
      setCurrentScreen('dashboard');
      setActiveTab('dashboard');
    }
  };

  const handleLogout = () => {
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
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': COLORS.warning,
      'assigned': COLORS.primary,
      'assigned_to_manager': COLORS.secondary,
      'assigned_to_mechanic': '#6366f1',
      'in_progress': COLORS.orange,
      'completed': COLORS.success,
      'cancelled': COLORS.error,
    };
    return colors[status] || COLORS.gray[500];
  };

  const renderLeadCard = (lead: any) => (
    <TouchableOpacity
      key={lead.id}
      style={styles.leadCard}
      onPress={() => {
        setSelectedLeadId(lead.id);
        setCurrentScreen('RSALeadDetail');
      }}
    >
      <View style={styles.leadHeader}>
        <View style={styles.leadTitleRow}>
          <Text style={styles.leadName}>{lead.customer_name}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(lead.lead_status || lead.complaint_status) + '20' },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(lead.lead_status || lead.complaint_status) },
              ]}
            >
              {lead.lead_status || lead.complaint_status}
            </Text>
          </View>
        </View>
        {lead.priority && (
          <View
            style={[
              styles.priorityBadge,
              {
                backgroundColor:
                  lead.priority === 'urgent'
                    ? COLORS.error + '20'
                    : lead.priority === 'high'
                    ? COLORS.orange + '20'
                    : COLORS.primary + '20',
              },
            ]}
          >
            <Text
              style={[
                styles.priorityText,
                {
                  color:
                    lead.priority === 'urgent'
                      ? COLORS.error
                      : lead.priority === 'high'
                      ? COLORS.orange
                      : COLORS.primary,
                },
              ]}
            >
              {lead.priority.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.leadInfo}>
        <View style={styles.infoRow}>
          <Icon name="phone" size={16} color={COLORS.gray[500]} />
          <Text style={styles.infoText}>{lead.contact_number}</Text>
        </View>
        {lead.vehicle_number && (
          <View style={styles.infoRow}>
            <Icon name="wrench" size={16} color={COLORS.gray[500]} />
            <Text style={styles.infoText}>
              {lead.vehicle_number} {lead.vehicle_model ? `(${lead.vehicle_model})` : ''}
            </Text>
          </View>
        )}
        {lead.address && (
          <View style={styles.infoRow}>
            <Icon name="map-pin" size={16} color={COLORS.gray[500]} />
            <Text style={styles.infoText} numberOfLines={1}>
              {lead.address} {lead.pincode ? `- ${lead.pincode}` : ''}
            </Text>
          </View>
        )}
        {lead.service_type && (
          <Text style={styles.serviceType}>Service: {lead.service_type}</Text>
        )}
      </View>

      {lead.assigned_manager_name && (
        <View style={styles.assignmentInfo}>
          <Text style={styles.assignmentLabel}>Manager: {lead.assigned_manager_name}</Text>
        </View>
      )}

      {lead.assigned_mechanic_name && (
        <View style={styles.assignmentInfo}>
          <Text style={styles.assignmentLabel}>Mechanic: {lead.assigned_mechanic_name}</Text>
        </View>
      )}

      {!lead.assigned_manager_id && (
        <TouchableOpacity
          style={styles.claimButton}
          onPress={(e) => handleClaimLead(e, lead.id)}
        >
          <Text style={styles.claimButtonText}>Claim Lead</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.timestamp}>
        {formatDateTime(lead.lead_registered_at || lead.requested_at)}
      </Text>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading RSA leads...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>RSA Manager</Text>
            <Text style={styles.headerSubtitle}>Roadside Assistance Management</Text>
          </View>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Icon name="logout" size={18} color={COLORS.white} />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <StatCard
            icon={<Icon name="alert-circle" size={24} color={COLORS.primary} />}
            label="Total Leads"
            value={stats.total_leads.toString()}
            color={COLORS.primary}
          />
          <StatCard
            icon={<Icon name="clock" size={24} color={COLORS.warning} />}
            label="Pending"
            value={stats.pending_leads.toString()}
            color={COLORS.warning}
          />
          <StatCard
            icon={<Icon name="users" size={24} color={COLORS.secondary} />}
            label="Assigned to Me"
            value={stats.assigned_to_me.toString()}
            color={COLORS.secondary}
          />
          <StatCard
            icon={<Icon name="alert-circle" size={24} color={COLORS.orange} />}
            label="Unassigned"
            value={stats.unassigned_leads.toString()}
            color={COLORS.orange}
          />
          <StatCard
            icon={<Icon name="check-circle" size={24} color={COLORS.success} />}
            label="Completed"
            value={stats.completed_leads.toString()}
            color={COLORS.success}
          />
          <StatCard
            icon={<Icon name="x-circle" size={24} color={COLORS.error} />}
            label="Cancelled"
            value={stats.cancelled_leads.toString()}
            color={COLORS.error}
          />
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          {(['all', 'assigned', 'unassigned', 'pending', 'completed'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterButton, filter === f && styles.filterButtonActive]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filter === f && styles.filterButtonTextActive,
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Leads List */}
        <View style={styles.leadsContainer}>
          {leads.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="alert-circle" size={48} color={COLORS.gray[500]} />
              <Text style={styles.emptyText}>No leads found</Text>
            </View>
          ) : (
            leads.map(renderLeadCard)
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        tabs={[
          { id: 'dashboard', label: 'Dashboard', icon: 'home' },
          { id: 'mechanics', label: 'Mechanics', icon: 'wrench' },
          { id: 'add_mechanic', label: 'Add', icon: 'plus' },
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontFamily: 'Poppins',
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingTop: 50,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  headerTextContainer: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.white,
    fontFamily: 'Poppins',
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    marginTop: SPACING.xs,
    opacity: 0.95,
    fontFamily: 'Poppins',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  logoutButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  scrollView: {
    flex: 1,
    paddingBottom: 80, // Space for bottom nav
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  filtersContainer: {
    marginBottom: SPACING.md,
  },
  filtersContent: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  filterButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    fontFamily: 'Poppins',
  },
  filterButtonTextActive: {
    color: COLORS.white,
  },
  leadsContainer: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  leadCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
  },
  leadHeader: {
    marginBottom: SPACING.md,
  },
  leadTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  leadName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textHeading,
    flex: 1,
    fontFamily: 'Poppins',
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    alignSelf: 'flex-start',
  },
  priorityText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  leadInfo: {
    gap: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  infoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    flex: 1,
    fontFamily: 'Poppins',
  },
  serviceType: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textBody,
    fontWeight: '600',
    marginTop: SPACING.xs,
    fontFamily: 'Poppins',
  },
  assignmentInfo: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  assignmentLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontFamily: 'Poppins',
  },
  claimButton: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  claimButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  timestamp: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: SPACING.sm,
    fontFamily: 'Poppins',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    fontFamily: 'Poppins',
  },
});

