import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CSEProfileScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalTickets: 0,
    resolvedTickets: 0,
    avgRating: 0,
    callbacksCompleted: 0,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData, error: profileError } = await supabase
        .from('users_login')
        .select('*, role:roles(role_name)')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch stats
      const { data: tickets } = await supabase
        .from('service_leads')
        .select('id, status, customer_satisfaction_score, cse_followup_completed')
        .not('assigned_cse_id', 'is', null);

      const totalTickets = tickets?.length || 0;
      const resolvedTickets = tickets?.filter((t: any) => t.status === 'CLOSED').length || 0;
      const ratings = tickets?.filter((t: any) => t.customer_satisfaction_score).map((t: any) => t.customer_satisfaction_score) || [];
      const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;
      const callbacksCompleted = tickets?.filter((t: any) => t.cse_followup_completed).length || 0;

      setStats({
        totalTickets,
        resolvedTickets,
        avgRating,
        callbacksCompleted,
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="My Profile" onBack={() => navigation.goBack()} />
      
      <ScrollView style={styles.scrollView}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {profile?.name?.charAt(0)?.toUpperCase() || 'C'}
            </Text>
          </View>
          <Text style={styles.profileName}>{profile?.name || 'CSE User'}</Text>
          <Text style={styles.profileRole}>{profile?.role?.role_name || 'Customer Service Executive'}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalTickets}</Text>
            <Text style={styles.statLabel}>Total Tickets</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.resolvedTickets}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.avgRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Rating</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.callbacksCompleted}</Text>
            <Text style={styles.statLabel}>Callbacks</Text>
          </View>
        </View>

        {/* Profile Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email</Text>
            <Text style={styles.detailValue}>{profile?.email || 'N/A'}</Text>
          </View>
          {profile?.phone && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{profile.phone}</Text>
            </View>
          )}
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
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    backgroundColor: COLORS.white,
    padding: SPACING.xl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: {
    fontSize: SIZES.xxl,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.xs,
  },
  profileRole: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  statCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  detailsSection: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
});
