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
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import BottomNav from '../../components/BottomNav';
import { COLORS, SPACING } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function DigitalMarketingDashboard() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalLeads: 0,
    leadsToday: 0,
    conversionRate: 0,
    activeCampaigns: 0,
    totalImpressions: 0,
    totalClicks: 0,
    clickThroughRate: 0,
    totalSpent: 0
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
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      // Total leads
      const { count: totalLeadsCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true });

      // Leads today
      const { count: leadsTodayCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00`);

      // Booked leads
      const { count: bookedLeads } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .in('status', ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED']);

      const conversionRate = totalLeadsCount && totalLeadsCount > 0 
        ? ((bookedLeads || 0) / totalLeadsCount * 100).toFixed(1)
        : 0;

      // Mock campaign data
      const mockCampaigns = [
        { id: 1, name: 'Summer Service Campaign', status: 'ACTIVE', impressions: 12500, clicks: 320, ctr: 2.56, spent: 15000 },
        { id: 2, name: 'New User Promotion', status: 'ACTIVE', impressions: 8900, clicks: 245, ctr: 2.75, spent: 12000 },
      ];

      setStats({
        totalLeads: totalLeadsCount || 0,
        leadsToday: leadsTodayCount || 0,
        conversionRate: parseFloat(conversionRate as string),
        activeCampaigns: mockCampaigns.filter(c => c.status === 'ACTIVE').length,
        totalImpressions: mockCampaigns.reduce((sum, c) => sum + c.impressions, 0),
        totalClicks: mockCampaigns.reduce((sum, c) => sum + c.clicks, 0),
        clickThroughRate: mockCampaigns.length > 0 
          ? parseFloat((mockCampaigns.reduce((sum, c) => sum + c.clicks, 0) / mockCampaigns.reduce((sum, c) => sum + c.impressions, 0) * 100).toFixed(2))
          : 0,
        totalSpent: mockCampaigns.reduce((sum, c) => sum + c.spent, 0),
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const renderDashboard = () => (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <DashboardHeader 
        title="📱 Digital Marketing"
        subtitle="Manage campaigns & track analytics"
        userProfile={userProfile}
      />

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statRow}>
          <StatCard
            title="Total Leads"
            value={stats.totalLeads.toLocaleString()}
            subtitle={`${stats.leadsToday} today`}
            color={COLORS.primary}
          />
          <StatCard
            title="Conversion"
            value={`${stats.conversionRate}%`}
            color={COLORS.success}
          />
        </View>
        <View style={styles.statRow}>
          <StatCard
            title="Active Campaigns"
            value={stats.activeCampaigns.toString()}
            color={COLORS.warning}
          />
          <StatCard
            title="CTR"
            value={`${stats.clickThroughRate}%`}
            color={COLORS.info}
          />
        </View>
        <View style={styles.statRow}>
          <StatCard
            title="Impressions"
            value={stats.totalImpressions.toLocaleString()}
            color={COLORS.secondary}
          />
          <StatCard
            title="Clicks"
            value={stats.totalClicks.toLocaleString()}
            color={COLORS.primary}
          />
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionEmoji}>📢</Text>
            <Text style={styles.actionText}>Create Campaign</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionEmoji}>📊</Text>
            <Text style={styles.actionText}>Analytics</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionEmoji}>📝</Text>
            <Text style={styles.actionText}>Content</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionEmoji}>👥</Text>
            <Text style={styles.actionText}>Leads</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Campaign Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Campaign Performance</Text>
        <View style={styles.card}>
          <View style={styles.campaignItem}>
            <View style={styles.campaignHeader}>
              <Text style={styles.campaignName}>Summer Service Campaign</Text>
              <View style={[styles.statusBadge, { backgroundColor: COLORS.success + '20' }]}>
                <Text style={[styles.statusText, { color: COLORS.success }]}>ACTIVE</Text>
              </View>
            </View>
            <View style={styles.campaignStats}>
              <View style={styles.campaignStat}>
                <Text style={styles.campaignStatLabel}>Impressions</Text>
                <Text style={styles.campaignStatValue}>12.5K</Text>
              </View>
              <View style={styles.campaignStat}>
                <Text style={styles.campaignStatLabel}>Clicks</Text>
                <Text style={styles.campaignStatValue}>320</Text>
              </View>
              <View style={styles.campaignStat}>
                <Text style={styles.campaignStatLabel}>CTR</Text>
                <Text style={styles.campaignStatValue}>2.56%</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );

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
      {currentScreen === 'dashboard' && renderDashboard()}
      <BottomNav currentScreen={currentScreen} setCurrentScreen={setCurrentScreen} />
    </View>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  color: string;
}

function StatCard({ title, value, subtitle, color }: StatCardProps) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
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
  statsGrid: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  statRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  statSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  section: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
    minWidth: (width - SPACING.md * 3) / 2,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionEmoji: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  actionText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  campaignItem: {
    marginBottom: SPACING.md,
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  campaignName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  campaignStats: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  campaignStat: {
    flex: 1,
  },
  campaignStatLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  campaignStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
});
