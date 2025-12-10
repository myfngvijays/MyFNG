import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CSERatingsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ratings, setRatings] = useState<any[]>([]);
  const [stats, setStats] = useState({
    averageRating: 0,
    totalRatings: 0,
    fiveStar: 0,
    fourStar: 0,
    threeStar: 0,
    twoStar: 0,
    oneStar: 0,
  });

  useEffect(() => {
    fetchRatings();
  }, []);

  const fetchRatings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('service_leads')
        .select('customer_satisfaction_score, customer_feedback, customer_name, lead_number, created_at')
        .not('customer_satisfaction_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      const ratingsData = data || [];
      setRatings(ratingsData);

      // Calculate stats
      const totalRatings = ratingsData.length;
      const sumRating = ratingsData.reduce((sum: number, r: any) => sum + (r.customer_satisfaction_score || 0), 0);
      const averageRating = totalRatings > 0 ? sumRating / totalRatings : 0;

      const starCounts = {
        fiveStar: ratingsData.filter((r: any) => r.customer_satisfaction_score === 5).length,
        fourStar: ratingsData.filter((r: any) => r.customer_satisfaction_score === 4).length,
        threeStar: ratingsData.filter((r: any) => r.customer_satisfaction_score === 3).length,
        twoStar: ratingsData.filter((r: any) => r.customer_satisfaction_score === 2).length,
        oneStar: ratingsData.filter((r: any) => r.customer_satisfaction_score === 1).length,
      };

      setStats({
        averageRating,
        totalRatings,
        ...starCounts,
      });
    } catch (error) {
      console.error('Error fetching ratings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRatings();
  };

  const renderStars = (rating: number) => {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading ratings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Customer Ratings" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.averageRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Average Rating</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalRatings}</Text>
            <Text style={styles.statLabel}>Total Ratings</Text>
          </View>
        </View>

        {/* Star Distribution */}
        <View style={styles.distributionContainer}>
          <Text style={styles.sectionTitle}>Rating Distribution</Text>
          <View style={styles.distributionRow}>
            <Text style={styles.distributionLabel}>5 ⭐</Text>
            <View style={styles.distributionBar}>
              <View
                style={[
                  styles.distributionBarFill,
                  {
                    width: `${stats.totalRatings > 0 ? (stats.fiveStar / stats.totalRatings) * 100 : 0}%`,
                    backgroundColor: COLORS.success,
                  },
                ]}
              />
            </View>
            <Text style={styles.distributionCount}>{stats.fiveStar}</Text>
          </View>
          <View style={styles.distributionRow}>
            <Text style={styles.distributionLabel}>4 ⭐</Text>
            <View style={styles.distributionBar}>
              <View
                style={[
                  styles.distributionBarFill,
                  {
                    width: `${stats.totalRatings > 0 ? (stats.fourStar / stats.totalRatings) * 100 : 0}%`,
                    backgroundColor: COLORS.success,
                  },
                ]}
              />
            </View>
            <Text style={styles.distributionCount}>{stats.fourStar}</Text>
          </View>
          <View style={styles.distributionRow}>
            <Text style={styles.distributionLabel}>3 ⭐</Text>
            <View style={styles.distributionBar}>
              <View
                style={[
                  styles.distributionBarFill,
                  {
                    width: `${stats.totalRatings > 0 ? (stats.threeStar / stats.totalRatings) * 100 : 0}%`,
                    backgroundColor: COLORS.warning,
                  },
                ]}
              />
            </View>
            <Text style={styles.distributionCount}>{stats.threeStar}</Text>
          </View>
          <View style={styles.distributionRow}>
            <Text style={styles.distributionLabel}>2 ⭐</Text>
            <View style={styles.distributionBar}>
              <View
                style={[
                  styles.distributionBarFill,
                  {
                    width: `${stats.totalRatings > 0 ? (stats.twoStar / stats.totalRatings) * 100 : 0}%`,
                    backgroundColor: COLORS.warning,
                  },
                ]}
              />
            </View>
            <Text style={styles.distributionCount}>{stats.twoStar}</Text>
          </View>
          <View style={styles.distributionRow}>
            <Text style={styles.distributionLabel}>1 ⭐</Text>
            <View style={styles.distributionBar}>
              <View
                style={[
                  styles.distributionBarFill,
                  {
                    width: `${stats.totalRatings > 0 ? (stats.oneStar / stats.totalRatings) * 100 : 0}%`,
                    backgroundColor: COLORS.danger,
                  },
                ]}
              />
            </View>
            <Text style={styles.distributionCount}>{stats.oneStar}</Text>
          </View>
        </View>

        {/* Recent Ratings */}
        <View style={styles.ratingsList}>
          <Text style={styles.sectionTitle}>Recent Ratings</Text>
          {ratings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No ratings yet</Text>
            </View>
          ) : (
            ratings.map((rating, index) => (
              <View key={index} style={styles.ratingCard}>
                <View style={styles.ratingHeader}>
                  <Text style={styles.leadNumber}>{rating.lead_number}</Text>
                  <Text style={styles.ratingStars}>
                    {renderStars(rating.customer_satisfaction_score)}
                  </Text>
                </View>
                <Text style={styles.customerName}>{rating.customer_name}</Text>
                {rating.customer_feedback && (
                  <Text style={styles.feedback}>{rating.customer_feedback}</Text>
                )}
                <Text style={styles.ratingDate}>
                  {new Date(rating.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))
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
  distributionContainer: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.md,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  distributionLabel: {
    fontSize: SIZES.sm,
    width: 50,
    color: COLORS.text,
  },
  distributionBar: {
    flex: 1,
    height: 20,
    backgroundColor: COLORS.gray[200],
    borderRadius: 4,
    overflow: 'hidden',
  },
  distributionBarFill: {
    height: '100%',
  },
  distributionCount: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    width: 40,
    textAlign: 'right',
  },
  ratingsList: {
    padding: SPACING.md,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
  ratingCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: 8,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  leadNumber: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
  },
  ratingStars: {
    fontSize: SIZES.sm,
  },
  customerName: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  feedback: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    fontStyle: 'italic',
  },
  ratingDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
});
