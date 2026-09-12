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
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api';
import DashboardHeader from '../../components/DashboardHeader';
import BottomNav from '../../components/BottomNav';
import { COLORS, SPACING } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function DigitalMarketingDashboard() {
  const navigation = useNavigation();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    categories: 0,
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
      const data = await apiFetch<any>('/api/blogs/dashboard-stats');
      const summary = data?.summary || {};
      const inventory = data?.inventory || {};
      setStats({
        total: Number(summary.total || 0),
        published: Number(summary.published || 0),
        draft: Number(summary.draft || 0),
        categories: Number(inventory.categories || 0),
      });
    } catch (error) {
      if (__DEV__) console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const handleNavigation = (screen: string) => {
    if (screen === 'dashboard') {
      // Already on dashboard
      return;
    }
    navigation.navigate(screen as never);
  };

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'DMContent', label: 'Blogs', icon: 'document' },
    { id: 'DMCategories', label: 'Categories', icon: 'tag' },
    { id: 'DMProfile', label: 'Profile', icon: 'account' },
  ];

  const renderDashboard = () => (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <DashboardHeader 
        title="📱 Digital Marketing"
        subtitle="Blogs, categories & profile"
        userProfile={userProfile}
      />

      <View style={styles.statsGrid}>
        <View style={styles.statRow}>
          <StatCard title="Blogs" value={stats.total.toLocaleString()} color={COLORS.primary} />
          <StatCard title="Published" value={stats.published.toLocaleString()} color={COLORS.success} />
        </View>
        <View style={styles.statRow}>
          <StatCard title="Drafts" value={stats.draft.toLocaleString()} color={COLORS.warning} />
          <StatCard title="Categories" value={stats.categories.toLocaleString()} color={COLORS.info} />
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleNavigation('DMContent')}
          >
            <Text style={styles.actionEmoji}>📝</Text>
            <Text style={styles.actionText}>Blogs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleNavigation('DMCategories')}
          >
            <Text style={styles.actionEmoji}>🏷️</Text>
            <Text style={styles.actionText}>Categories</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleNavigation('DMProfile')}
          >
            <Text style={styles.actionEmoji}>👤</Text>
            <Text style={styles.actionText}>Profile</Text>
          </TouchableOpacity>
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
      {renderDashboard()}
      <BottomNav
        activeTab="dashboard"
        onTabChange={handleNavigation}
        tabs={tabs}
      />
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
});
