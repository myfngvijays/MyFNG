import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Dimensions,
} from 'react-native';
import { Icon } from '../../components/Icon';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import DashboardHeader from '../../components/DashboardHeader';
import BottomNav from '../../components/BottomNav';
import { COLORS, SPACING } from '../../constants/theme';
import { formatDateDMY } from '@/lib/dateFormat';

const { width } = Dimensions.get('window');

const SUMMARY_DEFAULT = {
  total_pending: 0,
  new_leads: 0,
  incomplete_leads: 0,
  validated_leads: 0,
};

type DashboardFilter = 'all' | 'new' | 'validated';

export default function LeadManagerDashboard({ navigation }: any) {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<DashboardFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [summary, setSummary] = useState(SUMMARY_DEFAULT);
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [filter]);

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
      const data = await apiFetch<{ success: boolean; leads: any[]; summary: typeof SUMMARY_DEFAULT }>(
        `/api/lead-manager/pending-leads?status=${filter}&limit=50`
      );
      if (data?.success) {
        setLeads(data.leads || []);
        setSummary({ ...SUMMARY_DEFAULT, ...(data.summary || {}) });
      }
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

  const filteredLeads = useMemo(() => {
    if (!searchTerm.trim()) return leads;
    const term = searchTerm.toLowerCase();
    return leads.filter((lead) =>
      lead.customer_name?.toLowerCase().includes(term) ||
      lead.customer_phone?.includes(term) ||
      lead.vehicle_number?.toLowerCase().includes(term) ||
      lead.lead_number?.toLowerCase().includes(term)
    );
  }, [leads, searchTerm]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return COLORS.blue;
      case 'INCOMPLETE': return COLORS.orange;
      case 'VALIDATED': return COLORS.green;
      default: return COLORS.gray[500];
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return COLORS.red;
      case 'URGENT': return COLORS.red;
      case 'HIGH': return COLORS.orange;
      case 'MEDIUM': return COLORS.blue;
      case 'LOW': return COLORS.gray[500];
      default: return COLORS.blue;
    }
  };

  const renderLeadCard = (lead: any) => {
    const statusColor = getStatusColor(lead.status);
    const priority = lead.priority || lead.lead_priority || 'MEDIUM';
    const priorityColor = getPriorityColor(priority);
    return (
      <TouchableOpacity
        key={lead.id}
        style={styles.leadCard}
        onPress={() => navigation.navigate('LeadManagerLeadDetail', { leadId: lead.id })}
      >
        <View style={styles.leadHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.leadNumber}>#{lead.lead_number}</Text>
            <Text style={styles.leadName}>{lead.customer_name}</Text>
            <Text style={styles.leadPhone}>{lead.customer_phone}</Text>
          </View>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{lead.status}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: priorityColor + '20' }]}>
              <Text style={[styles.badgeText, { color: priorityColor }]}>{priority}</Text>
            </View>
          </View>
        </View>
        <View style={styles.leadMeta}>
          <Text style={styles.metaText}>Vehicle: {lead.model?.make || lead.vehicle_make} {lead.model?.model_name || lead.vehicle_model}</Text>
          <Text style={styles.metaText}>City: {lead.city?.name || lead.city || 'N/A'}</Text>
          <Text style={styles.metaText}>Created: {formatDateDMY(lead.created_at)}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewText}>Review Lead</Text>
          <Icon name="chevron-right" size={16} color={COLORS.primary} />
        </View>
      </TouchableOpacity>
    );
  };

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
        {/* Summary Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Pending Summary</Text>
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { backgroundColor: COLORS.blue + '15' }]}>
              <Icon name="clock" size={28} color={COLORS.blue} />
              <Text style={styles.kpiValue}>{summary.total_pending}</Text>
              <Text style={styles.kpiLabel}>Total Pending</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: COLORS.blue + '10' }]}>
              <Icon name="chart-line" size={28} color={COLORS.blue} />
              <Text style={styles.kpiValue}>{summary.new_leads}</Text>
              <Text style={styles.kpiLabel}>New Leads</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: COLORS.orange + '15' }]}>
              <Icon name="alert-circle" size={28} color={COLORS.orange} />
              <Text style={styles.kpiValue}>{summary.incomplete_leads}</Text>
              <Text style={styles.kpiLabel}>Incomplete</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: COLORS.green + '15' }]}>
              <Icon name="check-circle" size={28} color={COLORS.green} />
              <Text style={styles.kpiValue}>{summary.validated_leads}</Text>
              <Text style={styles.kpiLabel}>Validated</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
              onPress={() => navigation.navigate('LeadManagerLeads')}
            >
              <Icon name="clipboard" size={28} color="#fff" />
              <Text style={styles.actionButtonText}>Manage Leads</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.orange }]}
              onPress={() => navigation.navigate('LeadManagerEscalations')}
            >
              <Icon name="alert-circle" size={28} color="#fff" />
              <Text style={styles.actionButtonText}>Escalations</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.indigo }]}
              onPress={() => navigation.navigate('LeadManagerWorkshops')}
            >
              <Icon name="wrench" size={28} color="#fff" />
              <Text style={styles.actionButtonText}>Workshops</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.green }]}
              onPress={() => navigation.navigate('LeadManagerReports')}
            >
              <Icon name="chart-line" size={28} color="#fff" />
              <Text style={styles.actionButtonText}>Reports</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filters and Search */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔎 Pending Leads</Text>
          <View style={styles.searchRow}>
            <Icon name="magnify" size={18} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, phone, lead #, vehicle..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                All ({summary.total_pending})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'new' && styles.filterButtonActive]}
              onPress={() => setFilter('new')}
            >
              <Text style={[styles.filterText, filter === 'new' && styles.filterTextActive]}>
                New ({summary.new_leads})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'validated' && styles.filterButtonActive]}
              onPress={() => setFilter('validated')}
            >
              <Text style={[styles.filterText, filter === 'validated' && styles.filterTextActive]}>
                Validated ({summary.validated_leads})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          {filteredLeads.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="inbox" size={64} color={COLORS.gray} />
              <Text style={styles.emptyTitle}>No leads found</Text>
              <Text style={styles.emptyText}>
                {searchTerm ? 'Try adjusting your search' : 'All pending leads are handled'}
              </Text>
            </View>
          ) : (
            filteredLeads.map(renderLeadCard)
          )}
        </View>
      </ScrollView>

      <BottomNav
        activeTab="dashboard"
        onTabChange={(tabId: string) => {
          if (tabId === 'dashboard') return;
          if (tabId === 'leads') navigation.navigate('LeadManagerLeads');
          if (tabId === 'workshops') navigation.navigate('LeadManagerWorkshops');
          if (tabId === 'reports') navigation.navigate('LeadManagerReports');
        }}
        tabs={[
          { id: 'dashboard', label: 'Home', icon: 'home' },
          { id: 'leads', label: 'Leads', icon: 'clipboard' },
          { id: 'workshops', label: 'Workshops', icon: 'wrench' },
          { id: 'reports', label: 'Reports', icon: 'chart-line' },
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    elevation: 2,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  filterButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 16,
    backgroundColor: COLORS.background,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  leadCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    elevation: 2,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  leadNumber: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  leadName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  leadPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badges: {
    alignItems: 'flex-end',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  leadMeta: {
    marginTop: SPACING.sm,
    gap: 2,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  reviewRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  reviewText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
});
