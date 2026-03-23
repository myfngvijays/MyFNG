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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
import { apiFetch } from '../../lib/api';

export default function RSAManagerDashboard() {
  const { userProfile, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [screenHistory, setScreenHistory] = useState<string[]>([]);
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
  const [filter, setFilter] = useState<'assigned' | 'pending' | 'completed' | 'cancelled'>('assigned');
  const [callReports, setCallReports] = useState<any[]>([]);
  const [fromDate, setFromDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [toDate, setToDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const getTabForScreen = (screen: string) => {
    if (screen === 'RSAMechanics' || screen === 'RSAMechanicDetail') return 'mechanics';
    if (screen === 'AddMechanic') return 'add_mechanic';
    if (screen === 'RSAMore') return 'more';
    return 'dashboard';
  };

  // Update activeTab when screen changes
  useEffect(() => {
    if (currentScreen === 'dashboard') {
      setActiveTab('dashboard');
    } else if (currentScreen === 'RSAMechanics' || currentScreen === 'RSAMechanicDetail') {
      setActiveTab('mechanics');
    } else if (currentScreen === 'AddMechanic') {
      setActiveTab('add_mechanic');
    } else if (currentScreen === 'RSAMore') {
      setActiveTab('more');
    }
  }, [currentScreen]);

  useEffect(() => {
    fetchData();
    fetchCallReports();
  }, [filter, userProfile, fromDate, toDate]);

  const fetchData = async () => {
    if (!userProfile?.id) return;
    
    setLoading(true);
    try {
      const managerId = userProfile.id;
      const { data: leadsData, error } = await supabase.rpc('rsa_manager_get_all_leads', {
        p_manager_id: managerId,
        p_status: '',
        p_show_all: false, // match web: "My Complaints" baseline
      });
      if (error) throw error;

      const allLeads = Array.isArray(leadsData) ? leadsData : [];

      const fromStart = new Date(fromDate);
      fromStart.setHours(0, 0, 0, 0);
      const toEnd = new Date(toDate);
      toEnd.setHours(23, 59, 59, 999);

      const normalizeStatus = (lead: any) =>
        String(lead?.lead_status || lead?.complaint_status || '').toLowerCase();
      const isCompleted = (s: string) => s === 'completed' || s === 'closed';
      const isCancelled = (s: string) => s === 'cancelled';
      const isPending = (s: string) => !isCompleted(s) && !isCancelled(s);

      const leadsInRange = allLeads.filter((lead: any) => {
        const dt = lead?.lead_registered_at || lead?.requested_at || lead?.created_at;
        if (!dt) return false;
        const ts = new Date(dt).getTime();
        if (!Number.isFinite(ts)) return false;
        return ts >= fromStart.getTime() && ts <= toEnd.getTime();
      });

      const filteredLeads = leadsInRange.filter((lead: any) => {
        const s = normalizeStatus(lead);
        if (filter === 'assigned') return true;
        if (filter === 'pending') return isPending(s);
        if (filter === 'completed') return isCompleted(s);
        if (filter === 'cancelled') return isCancelled(s);
        return true;
      });

      setLeads(filteredLeads);
      setStats({
        total_leads: leadsInRange.length,
        pending_leads: leadsInRange.filter((l: any) => isPending(normalizeStatus(l))).length,
        completed_leads: leadsInRange.filter((l: any) => isCompleted(normalizeStatus(l))).length,
        cancelled_leads: leadsInRange.filter((l: any) => isCancelled(normalizeStatus(l))).length,
        assigned_to_me: leadsInRange.length,
        unassigned_leads: 0,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), fetchCallReports()]);
    setRefreshing(false);
  };

  const fetchCallReports = async () => {
    try {
      const data = await apiFetch<any>('/api/rsa/sarv-calls?limit=50');
      setCallReports(Array.isArray(data?.calls) ? data.calls : []);
    } catch (error) {
      console.error('Error fetching call reports:', error);
      setCallReports([]);
    }
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
      setScreenHistory((prev) => (screen !== currentScreen ? [...prev, currentScreen] : prev));
      setCurrentScreen(screen);
      if (params?.leadId) {
        setSelectedLeadId(params.leadId);
      }
      if (params?.mechanicId) {
        setSelectedMechanicId(params.mechanicId);
      }
      setActiveTab(getTabForScreen(screen));
    },
    goBack: () => {
      setScreenHistory((prev) => {
        if (prev.length === 0) {
          setCurrentScreen('dashboard');
          setActiveTab('dashboard');
          setSelectedLeadId(null);
          setSelectedMechanicId(null);
          return prev;
        }

        const previousScreen = prev[prev.length - 1];
        setCurrentScreen(previousScreen);
        setActiveTab(getTabForScreen(previousScreen));
        if (previousScreen !== 'RSALeadDetail') setSelectedLeadId(null);
        if (previousScreen !== 'RSAMechanicDetail') setSelectedMechanicId(null);
        return prev.slice(0, -1);
      });
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

  if (currentScreen === 'RSACreateComplaint') {
    const Screen = require('./rsa/RSACreateComplaintScreen').default;
    return <Screen navigation={navigation} route={{ params: {} }} />;
  }

  if (currentScreen === 'RSAPayments') {
    const Screen = require('./rsa/RSAPaymentsScreen').default;
    return <Screen navigation={navigation} route={{ params: {} }} />;
  }

  if (currentScreen === 'RSARegistered') {
    const Screen = require('./rsa/RSARegisteredScreen').default;
    return <Screen navigation={navigation} route={{ params: {} }} />;
  }

  if (currentScreen === 'RSACarServiceEnquiry') {
    const Screen = require('./rsa/RSACarServiceEnquiryScreen').default;
    return <Screen navigation={navigation} route={{ params: {} }} />;
  }

  if (currentScreen === 'RSAManagerReports') {
    const Screen = require('./rsa/RSAManagerReportsScreen').default;
    return <Screen navigation={navigation} route={{ params: {} }} />;
  }

  if (currentScreen === 'RSAManagerSettings') {
    const Screen = require('./rsa/RSAManagerSettingsScreen').default;
    return <Screen navigation={navigation} route={{ params: {} }} />;
  }

  if (currentScreen === 'RSASessions') {
    const Screen = require('./rsa/RSASessionsScreen').default;
    return <Screen navigation={navigation} route={{ params: {} }} />;
  }

  if (currentScreen === 'RSAMembershipCustomer') {
    const Screen = require('./rsa/RSAMembershipCustomerScreen').default;
    return <Screen navigation={navigation} route={{ params: {} }} />;
  }

  // Render Mechanic Detail Screen
  if (currentScreen === 'RSAMechanicDetail' && selectedMechanicId) {
    return <RSAMechanicDetailScreen navigation={navigation} route={{ params: { mechanicId: selectedMechanicId } }} />;
  }

  if (currentScreen === 'RSAMore') {
    const moreItems: Array<{ screen: string; label: string; subtitle: string; icon: string }> = [
      { screen: 'RSACreateComplaint', label: 'Create Complaint', subtitle: 'Register new RSA request', icon: 'plus' },
      { screen: 'RSARegistered', label: 'Registered', subtitle: 'View newly registered complaints', icon: 'clipboard' },
      { screen: 'RSAPayments', label: 'Payments', subtitle: 'Payment links and refunds', icon: 'cash' },
      { screen: 'RSACarServiceEnquiry', label: 'Car Service', subtitle: 'Manage car service enquiries', icon: 'car' },
      { screen: 'RSAManagerReports', label: 'Reports', subtitle: 'Performance and analytics', icon: 'chart-line' },
      { screen: 'RSAManagerSettings', label: 'Settings', subtitle: 'Profile and notification preferences', icon: 'settings' },
      { screen: 'RSASessions', label: 'Sessions', subtitle: 'Monitor active Aansh sessions', icon: 'clock' },
      { screen: 'RSAMembershipCustomer', label: 'Membership', subtitle: 'Membership customer module', icon: 'account' },
    ];

    return (
      <View style={styles.container}>
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
          contentContainerStyle={styles.moreContent}
        >
          <View style={styles.moreOptionsList}>
            {moreItems.map((item) => (
              <TouchableOpacity key={item.screen} style={styles.moreOptionCard} onPress={() => navigation.navigate(item.screen)}>
                <View style={styles.moreOptionLeft}>
                  <View style={styles.moreOptionIconWrap}>
                    <Icon name={item.icon} size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.moreOptionTextWrap}>
                    <Text style={styles.moreOptionTitle}>{item.label}</Text>
                    <Text style={styles.moreOptionSubtitle}>{item.subtitle}</Text>
                  </View>
                </View>
                <Icon name="chevron-right" size={18} color={COLORS.gray[500]} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <BottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabs={[
            { id: 'dashboard', label: 'Dashboard', icon: 'home' },
            { id: 'mechanics', label: 'Mechanics', icon: 'wrench' },
            { id: 'add_mechanic', label: 'Add', icon: 'plus' },
            { id: 'more', label: 'More', icon: 'menu' },
          ]}
        />
      </View>
    );
  }

  function handleTabChange(tab: string) {
    setScreenHistory([]);
    if (tab === 'mechanics') {
      setCurrentScreen('RSAMechanics');
      setActiveTab('mechanics');
    } else if (tab === 'add_mechanic') {
      setCurrentScreen('AddMechanic');
      setActiveTab('add_mechanic');
    } else if (tab === 'more') {
      setCurrentScreen('RSAMore');
      setActiveTab('more');
    } else {
      setCurrentScreen('dashboard');
      setActiveTab('dashboard');
    }
  }

  function handleLogout() {
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
  }

  const resetLast7Days = () => {
    const d = new Date();
    const from = new Date(d);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    const to = new Date(d);
    to.setHours(23, 59, 59, 999);
    setFromDate(from);
    setToDate(to);
  };

  const formatDateLabel = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
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
        navigation.navigate('RSALeadDetail', { leadId: lead.id });
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
        <View style={styles.dateFilterCard}>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowFromPicker(true)}>
              <Text style={styles.dateBtnLabel}>From: {formatDateLabel(fromDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowToPicker(true)}>
              <Text style={styles.dateBtnLabel}>To: {formatDateLabel(toDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateResetBtn} onPress={resetLast7Days}>
              <Text style={styles.dateResetText}>Last 7 Days</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <StatCard
              icon={<Icon name="alert-circle" size={24} color={COLORS.primary} />}
              label="Total Leads"
              value={stats.total_leads.toString()}
              color={COLORS.primary}
            />
          </View>
          <View style={styles.statCell}>
            <StatCard
              icon={<Icon name="clock" size={24} color={COLORS.warning} />}
              label="Pending"
              value={stats.pending_leads.toString()}
              color={COLORS.warning}
            />
          </View>
          <View style={styles.statCell}>
            <StatCard
              icon={<Icon name="users" size={24} color={COLORS.secondary} />}
              label="Assigned to Me"
              value={stats.assigned_to_me.toString()}
              color={COLORS.secondary}
            />
          </View>
          <View style={styles.statCell}>
            <StatCard
              icon={<Icon name="alert-circle" size={24} color={COLORS.orange} />}
              label="Unassigned"
              value={stats.unassigned_leads.toString()}
              color={COLORS.orange}
            />
          </View>
          <View style={styles.statCell}>
            <StatCard
              icon={<Icon name="check-circle" size={24} color={COLORS.success} />}
              label="Completed"
              value={stats.completed_leads.toString()}
              color={COLORS.success}
            />
          </View>
          <View style={styles.statCell}>
            <StatCard
              icon={<Icon name="x-circle" size={24} color={COLORS.error} />}
              label="Cancelled"
              value={stats.cancelled_leads.toString()}
              color={COLORS.error}
            />
          </View>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          {(['assigned', 'pending', 'completed', 'cancelled'] as const).map((f) => (
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
                {f === 'assigned' ? 'My Complaints' : f.charAt(0).toUpperCase() + f.slice(1)}
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

        <View style={styles.callReportSection}>
          <Text style={styles.callReportTitle}>Call Report</Text>
          <TouchableOpacity style={styles.callReportRefresh} onPress={fetchCallReports}>
            <Text style={styles.callReportRefreshText}>Refresh Calls</Text>
          </TouchableOpacity>
          {callReports.slice(0, 20).map((row: any, idx: number) => (
            <View key={row.id || idx} style={styles.callReportCard}>
              <Text style={styles.callReportMain}>{row.customer_phone || row.from_number || 'Call'}</Text>
              <Text style={styles.callReportMeta}>Disposition: {row.disposition || '—'} • Duration: {row.duration_seconds || 0}s</Text>
              {row.recording_url ? (
                <TouchableOpacity onPress={() => Linking.openURL(String(row.recording_url))}>
                  <Text style={styles.callReportLink}>Open Recording</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
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
          { id: 'more', label: 'More', icon: 'menu' },
        ]}
      />

      {showFromPicker && (
        <DateTimePicker
          value={fromDate}
          mode="date"
          onChange={(_, selectedDate) => {
            setShowFromPicker(false);
            if (selectedDate) {
              const normalized = new Date(selectedDate);
              normalized.setHours(0, 0, 0, 0);
              setFromDate(normalized);
            }
          }}
        />
      )}

      {showToPicker && (
        <DateTimePicker
          value={toDate}
          mode="date"
          onChange={(_, selectedDate) => {
            setShowToPicker(false);
            if (selectedDate) {
              const normalized = new Date(selectedDate);
              normalized.setHours(23, 59, 59, 999);
              setToDate(normalized);
            }
          }}
        />
      )}
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    justifyContent: 'space-between',
  },
  statCell: {
    width: '48%',
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
  shortcutsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  moreContent: {
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: 96,
  },
  moreOptionsList: {
    gap: SPACING.sm,
  },
  moreOptionCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moreOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  moreOptionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  moreOptionTextWrap: {
    flex: 1,
  },
  moreOptionTitle: {
    color: COLORS.textHeading,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    fontFamily: 'Poppins',
  },
  moreOptionSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
    fontFamily: 'Poppins',
  },
  dateFilterCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  dateRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  dateBtn: {
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flex: 1,
  },
  dateBtnLabel: {
    color: COLORS.textHeading,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  dateResetBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minWidth: 110,
    alignItems: 'center',
  },
  dateResetText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    fontFamily: 'Poppins',
  },
  shortcutBtn: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  shortcutText: {
    color: COLORS.textHeading,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
  callReportSection: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 96,
  },
  callReportTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: SPACING.sm,
    fontFamily: 'Poppins',
  },
  callReportRefresh: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  callReportRefreshText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    fontFamily: 'Poppins',
  },
  callReportCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  callReportMain: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.textHeading,
    fontFamily: 'Poppins',
  },
  callReportMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontFamily: 'Poppins',
  },
  callReportLink: {
    marginTop: SPACING.xs,
    color: COLORS.primary,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    fontFamily: 'Poppins',
  },
});

