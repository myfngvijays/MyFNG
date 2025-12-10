import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CMRSAProfileScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalJobs: 0,
    completedJobs: 0,
    activeJobs: 0,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('users_login')
        .select('*, role:roles(role_name)')
        .eq('id', user.id)
        .single();

      setProfile(profileData);

      const { data: jobs } = await supabase
        .from('service_leads')
        .select('id, status')
        .eq('service_type', 'RSA')
        .eq('assigned_mechanic_id', user.id);

      setStats({
        totalJobs: jobs?.length || 0,
        completedJobs: jobs?.filter((j: any) => j.status === 'COMPLETED').length || 0,
        activeJobs: jobs?.filter((j: any) => 
          ['ASSIGNED', 'IN_PROGRESS'].includes(j.status)
        ).length || 0,
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
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {profile?.name?.charAt(0)?.toUpperCase() || 'M'}
            </Text>
          </View>
          <Text style={styles.profileName}>{profile?.name || profile?.full_name || 'RSA Mechanic'}</Text>
          <Text style={styles.profileRole}>{profile?.role?.role_name || 'Company Mechanic RSA'}</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalJobs}</Text>
            <Text style={styles.statLabel}>Total Jobs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.completedJobs}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.activeJobs}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>

        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <Text style={styles.detailText}>Email: {profile?.email || 'N/A'}</Text>
          {profile?.phone && <Text style={styles.detailText}>Phone: {profile.phone}</Text>}
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
    padding: SPACING.md,
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
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
  },
  detailsSection: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    margin: SPACING.md,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.md,
  },
  detailText: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
});
