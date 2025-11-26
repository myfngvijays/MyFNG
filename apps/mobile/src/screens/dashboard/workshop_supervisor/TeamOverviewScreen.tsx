/**
 * Team Overview Screen - Workshop Supervisor
 * Real-time view of all team members and their current status
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function TeamOverviewScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [teamStats, setTeamStats] = useState({
    totalMembers: 0,
    activeNow: 0,
    avgPerformance: 0,
    totalJobsToday: 0,
  });

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    try {
      // ✅ FIX: Fetch user profile directly like other screens
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ No user found');
        setLoading(false);
        return;
      }

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (!userProfile?.workshop_id) {
        console.log('❌ No workshop_id found');
        setLoading(false);
        return;
      }

      console.log('✅ Workshop ID:', userProfile.workshop_id);
      setWorkshopId(userProfile.workshop_id);
      
      await fetchTeamData(userProfile.workshop_id);
      setupRealtimeSubscription(userProfile.workshop_id);
    } catch (error) {
      console.error('❌ Error initializing screen:', error);
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = (wid: string) => {
    if (!wid) return;

    // Subscribe to real-time updates for team members
    const channel = supabase
      .channel('team_members_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users_login',
          filter: `workshop_id=eq.${wid}`,
        },
        () => {
          fetchTeamData(wid);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mechanic_jobs',
        },
        () => {
          fetchTeamData(wid);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const fetchTeamData = async (wid?: string) => {
    const workshopIdToUse = wid || workshopId;
    
    try {
      if (!workshopIdToUse) {
        console.log('❌ No workshop ID available');
        setLoading(false);
        return;
      }

      console.log('🔍 Fetching team data for workshop:', workshopIdToUse);

      // ✅ FIX: Fetch all team members with correct role relation
      const { data: members, error: membersError } = await supabase
        .from('users_login')
        .select(`
          *,
          role:role_id (
            role_name,
            role_code
          )
        `)
        .eq('workshop_id', workshopIdToUse)
        .eq('is_active', true);

      if (membersError) {
        console.error('❌ Error fetching members:', membersError);
        throw membersError;
      }

      console.log('✅ Found', members?.length || 0, 'team members');

      // Filter mechanics
      const mechanics = members?.filter(m => m.role?.role_code === 'WORKSHOP_MECHANIC') || [];
      const mechanicIds = mechanics.map(m => m.id);

      console.log('👨‍🔧 Found', mechanics.length, 'mechanics');

      // ✅ FIX: Fetch jobs with correct column name (mechanic_status, not status)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: jobs, error: jobsError } = await supabase
        .from('mechanic_jobs')
        .select('*')
        .in('mechanic_id', mechanicIds)
        .gte('assigned_at', today.toISOString());

      if (jobsError) {
        console.error('❌ Error fetching jobs:', jobsError);
        throw jobsError;
      }

      console.log('📊 Found', jobs?.length || 0, 'jobs today');

      // Calculate stats for each member
      const enrichedMembers = members?.map(member => {
        if (member.role?.role_code === 'WORKSHOP_MECHANIC') {
          const memberJobs = jobs?.filter(j => j.mechanic_id === member.id) || [];
          
          // ✅ FIX: Use mechanic_status instead of status
          const activeJobs = memberJobs.filter(j => 
            ['ASSIGNED', 'IN_PROGRESS', 'HOLD'].includes(j.mechanic_status)
          );
          const completedJobs = memberJobs.filter(j => 
            j.mechanic_status === 'COMPLETED'
          );

          return {
            ...member,
            activeJobs: activeJobs.length,
            completedToday: completedJobs.length,
            totalJobs: memberJobs.length,
            status: activeJobs.length > 0 ? 'WORKING' : 'AVAILABLE',
          };
        }
        return member;
      }) || [];

      setTeamMembers(enrichedMembers);

      // Calculate team stats
      const activeMembers = enrichedMembers.filter(m => {
        const lastLogin = m.last_login ? new Date(m.last_login) : null;
        const now = new Date();
        const hoursSinceLogin = lastLogin ? (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60) : 999;
        return hoursSinceLogin < 8; // Active in last 8 hours
      });

      const totalJobsCompleted = enrichedMembers.reduce((sum, m: any) => sum + (m.completedToday || 0), 0);
      const totalJobsAssigned = jobs?.length || 0;
      const performanceRate = totalJobsAssigned > 0 ? Math.round((totalJobsCompleted / totalJobsAssigned) * 100) : 0;

      console.log('📈 Stats calculated:', {
        totalMembers: enrichedMembers.length,
        activeNow: activeMembers.length,
        totalJobsToday: totalJobsAssigned,
        performanceRate
      });

      setTeamStats({
        totalMembers: enrichedMembers.length,
        activeNow: activeMembers.length,
        avgPerformance: performanceRate,
        totalJobsToday: totalJobsAssigned,
      });
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTeamData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WORKING': return COLORS.success;
      case 'AVAILABLE': return COLORS.info;
      case 'BREAK': return COLORS.warning;
      case 'OFFLINE': return COLORS.gray[400];
      default: return COLORS.gray[500];
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'WORKING': return '🔧';
      case 'AVAILABLE': return '✅';
      case 'BREAK': return '☕';
      case 'OFFLINE': return '⭕';
      default: return '❓';
    }
  };

  const getRoleIcon = (roleCode: string) => {
    switch (roleCode) {
      case 'WORKSHOP_MECHANIC': return '🔧';
      case 'WORKSHOP_PICKUP_BOY': return '🚗';
      case 'WORKSHOP_ADMIN': return '👔';
      default: return '👤';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading team data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
      }
    >
      {/* Header Stats */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Team Overview</Text>
        <Text style={styles.headerSubtitle}>Real-time team status & performance</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { borderLeftColor: COLORS.primary }]}>
          <Ionicons name="people" size={24} color={COLORS.primary} />
          <Text style={styles.statValue}>{teamStats.totalMembers}</Text>
          <Text style={styles.statLabel}>Total Team</Text>
        </View>

        <View style={[styles.statCard, { borderLeftColor: COLORS.success }]}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
          <Text style={styles.statValue}>{teamStats.activeNow}</Text>
          <Text style={styles.statLabel}>Active Now</Text>
        </View>

        <View style={[styles.statCard, { borderLeftColor: COLORS.info }]}>
          <Ionicons name="time" size={24} color={COLORS.info} />
          <Text style={styles.statValue}>{teamStats.totalJobsToday}</Text>
          <Text style={styles.statLabel}>Jobs Today</Text>
        </View>

        <View style={[styles.statCard, { borderLeftColor: COLORS.warning }]}>
          <Ionicons name="trending-up" size={24} color={COLORS.warning} />
          <Text style={styles.statValue}>{teamStats.avgPerformance}%</Text>
          <Text style={styles.statLabel}>Avg Performance</Text>
        </View>
      </View>

      {/* Team Members List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Team Members ({teamMembers.length})</Text>

        {teamMembers.map((member) => (
          <TouchableOpacity
            key={member.id}
            style={styles.memberCard}
            onPress={() => {
              // Navigate to member detail
              console.log('View member detail:', member.id);
            }}
          >
            <View style={styles.memberHeader}>
              <View style={styles.memberInfo}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {getRoleIcon(member.role?.role_code)}
                  </Text>
                </View>
                <View style={styles.memberDetails}>
                  <Text style={styles.memberName}>{member.full_name}</Text>
                  <Text style={styles.memberRole}>{member.role?.role_name}</Text>
                  <Text style={styles.memberPhone}>{member.phone}</Text>
                </View>
              </View>

              <View style={styles.memberStatus}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(member.status || 'OFFLINE') }]}>
                  <Text style={styles.statusText}>
                    {getStatusIcon(member.status || 'OFFLINE')} {member.status || 'OFFLINE'}
                  </Text>
                </View>
              </View>
            </View>

            {member.role?.role_code === 'WORKSHOP_MECHANIC' && (
              <View style={styles.memberStats}>
                <View style={styles.memberStatItem}>
                  <Text style={styles.memberStatValue}>{member.activeJobs || 0}</Text>
                  <Text style={styles.memberStatLabel}>Active</Text>
                </View>
                <View style={styles.memberStatItem}>
                  <Text style={styles.memberStatValue}>{member.completedToday || 0}</Text>
                  <Text style={styles.memberStatLabel}>Completed</Text>
                </View>
                <View style={styles.memberStatItem}>
                  <Text style={styles.memberStatValue}>{member.totalJobs || 0}</Text>
                  <Text style={styles.memberStatLabel}>Total Today</Text>
                </View>
              </View>
            )}

            {member.last_login && (
              <View style={styles.lastSeen}>
                <Ionicons name="time-outline" size={12} color={COLORS.gray[500]} />
                <Text style={styles.lastSeenText}>
                  Last seen: {new Date(member.last_login).toLocaleString()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {teamMembers.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={48} color={COLORS.gray[300]} />
            <Text style={styles.emptyText}>No team members found</Text>
          </View>
        )}
      </View>

      <View style={{ height: SPACING.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray[50],
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.gray[600],
    fontSize: SIZES.md,
  },
  header: {
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  headerTitle: {
    fontSize: SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: SIZES.sm,
    color: COLORS.gray[600],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: SIZES.sm,
    borderLeftWidth: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginTop: SPACING.sm,
  },
  statLabel: {
    fontSize: SIZES.sm,
    color: COLORS.gray[600],
    marginTop: SPACING.xs,
  },
  section: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: SPACING.md,
  },
  memberCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.sm,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  memberAvatarText: {
    fontSize: 24,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.gray[900],
  },
  memberRole: {
    fontSize: SIZES.sm,
    color: COLORS.gray[600],
    marginTop: 2,
  },
  memberPhone: {
    fontSize: SIZES.xs,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  memberStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: SIZES.xs,
  },
  statusText: {
    color: COLORS.white,
    fontSize: SIZES.xs,
    fontWeight: '600',
  },
  memberStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  memberStatItem: {
    alignItems: 'center',
  },
  memberStatValue: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  memberStatLabel: {
    fontSize: SIZES.xs,
    color: COLORS.gray[600],
    marginTop: SPACING.xs,
  },
  lastSeen: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  lastSeenText: {
    fontSize: SIZES.xs,
    color: COLORS.gray[500],
  },
  emptyState: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: SIZES.md,
    color: COLORS.gray[500],
    marginTop: SPACING.md,
  },
});

