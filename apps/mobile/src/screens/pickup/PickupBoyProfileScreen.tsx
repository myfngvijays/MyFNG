import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';

export default function PickupBoyProfileScreen({ userId }) {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    successRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // ✅ FIX: Fetch userId if not provided
    if (!userId) {
      fetchUserId();
    } else {
      fetchProfile();
    }
  }, [userId]);

  // ✅ FIX: Fetch user ID by email (like web)
  const fetchUserId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (userProfile?.id) {
        fetchProfile(userProfile.id);
      }
    } catch (error) {
      // Error handled silently
    }
  };

  const fetchProfile = async (pickupBoyId?: string) => {
    const idToUse = pickupBoyId || userId;
    if (!idToUse) return;

    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users_login')
        .select(`
          *,
          role:roles!role_id(role_name),
          workshop:workshops!workshop_id(name, city)
        `)
        .eq('id', idToUse)
        .single();

      if (profileError) throw profileError;

      // ✅ FIX: Fetch task stats from service_leads (like web)
      const { data: allTasks, error: tasksError } = await supabase
        .from('service_leads')
        .select('pickup_status, status')
        .eq('assigned_pickup_boy_id', idToUse)
        .eq('pickup_required', true);

      if (tasksError) {
        // Error handled silently
      }

      const totalCount = allTasks?.length || 0;
      const completedCount = allTasks?.filter(t => 
        t.pickup_status === 'PICKED_UP' || t.pickup_status === 'DELIVERED'
      ).length || 0;

      const successRate = totalCount > 0 ? ((completedCount / totalCount) * 100).toFixed(1) : 0;

      setProfile(profileData);
      setStats({
        totalTasks: totalCount || 0,
        completedTasks: completedCount || 0,
        successRate: parseFloat(successRate as string),
      });
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No profile found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>Personal information & stats</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.full_name?.charAt(0) || 'P'}
            </Text>
          </View>
          <Text style={styles.name}>{profile.full_name}</Text>
          <Text style={styles.role}>{profile.role?.role_name || 'Pickup Boy'}</Text>
          {profile.workshop && (
            <Text style={styles.workshop}>
              🏭 {profile.workshop.name}, {profile.workshop.city}
            </Text>
          )}
        </View>

        {/* Stats Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Stats</Text>
          
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalTasks}</Text>
              <Text style={styles.statLabel}>Total Tasks</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.completedTasks}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.successRate}%</Text>
              <Text style={styles.statLabel}>Success Rate</Text>
            </View>
          </View>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile.email}</Text>
          </View>
          
          {profile.phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{profile.phone}</Text>
            </View>
          )}
          
          {profile.department && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Department</Text>
              <Text style={styles.infoValue}>{profile.department}</Text>
            </View>
          )}
        </View>

        {/* Account Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Status</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: profile.is_active ? COLORS.success : COLORS.danger }
            ]}>
              <Text style={styles.statusText}>
                {profile.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>
              {new Date(profile.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </ScrollView>
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
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[600],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    opacity: 0.9,
    marginTop: SPACING.xs,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl + SPACING.lg,
  },
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  name: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.xs,
  },
  role: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  workshop: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[600],
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  infoLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    fontWeight: '500',
  },
  infoValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.heading,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.white,
    fontWeight: '600',
  },
});

