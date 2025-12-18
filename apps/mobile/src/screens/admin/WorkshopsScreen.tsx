import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { formatDateDMY } from "@/lib/dateFormat";

export default function WorkshopsScreen({ onBack }) {
  const [workshops, setWorkshops] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkshops();
  }, []);

  const fetchWorkshops = async () => {
    try {
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .order('created_at', { ascending: false});

      if (error) throw error;
      setWorkshops(data || []);
    } catch (error) {
      console.error('Error fetching workshops:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWorkshops();
    setRefreshing(false);
  };

  const renderWorkshop = ({ item }) => (
    <View style={styles.workshopCard}>
      <View style={styles.workshopHeader}>
        <View style={styles.workshopIcon}>
          <Text style={styles.iconText}>🏭</Text>
        </View>
        <View style={styles.workshopInfo}>
          <Text style={styles.workshopName}>{item.name}</Text>
          <View style={[styles.verifiedBadge, { backgroundColor: item.is_verified ? COLORS.success : COLORS.warning }]}>
            <Text style={styles.badgeText}>
              {item.is_verified ? '✓ Verified' : '⚠ Pending'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.workshopBody}>
        <Text style={styles.contactPerson}>👤 {item.contact_person}</Text>
        <Text style={styles.detail}>📞 {item.phone}</Text>
        <Text style={styles.detail}>📧 {item.email}</Text>
        <Text style={styles.detail}>📍 {item.city}, {item.state} - {item.pincode}</Text>
        {item.audit_score && (
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Audit Score:</Text>
            <View style={styles.scoreStars}>
              <Text style={styles.scoreValue}>⭐ {item.audit_score}/5</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.workshopFooter}>
        <Text style={styles.date}>
          Registered: {formatDateDMY(item.created_at)}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Partner Workshops</Text>
        <Text style={styles.subtitle}>View and manage all partner workshops</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{workshops.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{workshops.filter(w => w.is_verified).length}</Text>
          <Text style={styles.statLabel}>Verified</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{workshops.filter(w => !w.is_verified).length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {(workshops.reduce((sum, w) => sum + (w.audit_score || 0), 0) / workshops.length || 0).toFixed(1)}
          </Text>
          <Text style={styles.statLabel}>Avg Score</Text>
        </View>
      </View>

      <FlatList
        data={workshops}
        renderItem={renderWorkshop}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading workshops...' : 'No workshops found'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[600],
    marginTop: 2,
  },
  listContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl + SPACING.lg, // Extra padding for bottom nav
  },
  workshopCard: {
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
  workshopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  workshopIcon: {
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  iconText: {
    fontSize: 28,
  },
  workshopInfo: {
    flex: 1,
  },
  workshopName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: 4,
  },
  verifiedBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.white,
    fontWeight: '600',
  },
  workshopBody: {
    marginBottom: SPACING.sm,
  },
  contactPerson: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.heading,
    marginBottom: 4,
  },
  detail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: 4,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  scoreLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginRight: SPACING.sm,
  },
  scoreStars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
    color: COLORS.accent,
  },
  workshopFooter: {
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  date: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[400],
  },
  emptyContainer: {
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
  },
});

