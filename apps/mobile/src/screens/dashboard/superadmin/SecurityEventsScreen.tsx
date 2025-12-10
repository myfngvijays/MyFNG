import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function SecurityEventsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  useEffect(() => {
    fetchSecurityEvents();
  }, [filter]);

  const fetchSecurityEvents = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('severity', filter.toUpperCase());
      }

      const { data, error } = await query;

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching security events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSecurityEvents();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return COLORS.danger;
      case 'WARNING':
        return COLORS.warning;
      case 'INFO':
        return COLORS.info;
      default:
        return COLORS.textSecondary;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading security events...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Security Events" onBack={() => navigation.goBack()} />
      
      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterButton,
              filter === f && styles.filterButtonActive
            ]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.filterButtonText,
              filter === f && styles.filterButtonTextActive
            ]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {events.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No security events found</Text>
          </View>
        ) : (
          events.map((event, index) => (
            <View key={event.id || index} style={styles.eventCard}>
              <View style={styles.eventHeader}>
                <View style={styles.eventHeaderLeft}>
                  <View
                    style={[
                      styles.severityBadge,
                      { backgroundColor: getSeverityColor(event.severity) }
                    ]}
                  >
                    <Text style={styles.severityText}>
                      {event.severity || 'INFO'}
                    </Text>
                  </View>
                  <Text style={styles.eventType}>{event.event_type || 'Unknown'}</Text>
                </View>
                <Text style={styles.eventTime}>
                  {new Date(event.created_at).toLocaleDateString()}
                </Text>
              </View>
              
              {event.description && (
                <Text style={styles.eventDescription}>{event.description}</Text>
              )}
              
              {event.user_id && (
                <Text style={styles.eventUser}>User ID: {event.user_id}</Text>
              )}
              
              {event.ip_address && (
                <Text style={styles.eventIp}>IP: {event.ip_address}</Text>
              )}
            </View>
          ))
        )}
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
  filterContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
  eventCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  eventHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  severityText: {
    fontSize: SIZES.xs,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  eventType: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.textHeading,
    flex: 1,
  },
  eventTime: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
  eventDescription: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  eventUser: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  eventIp: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
});
