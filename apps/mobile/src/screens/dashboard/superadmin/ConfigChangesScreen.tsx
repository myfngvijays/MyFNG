import React, { useState, useEffect } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
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

export default function ConfigChangesScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [changes, setChanges] = useState<any[]>([]);

  useEffect(() => {
    fetchConfigChanges();
  }, []);

  const fetchConfigChanges = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('config_changes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setChanges(data || []);
    } catch (error) {
      console.error('Error fetching config changes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchConfigChanges();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading config changes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Configuration Changes" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {changes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No configuration changes found</Text>
          </View>
        ) : (
          changes.map((change, index) => (
            <View key={change.id || index} style={styles.changeCard}>
              <View style={styles.changeHeader}>
                <Text style={styles.changeKey}>{change.config_key || 'Unknown'}</Text>
                <Text style={styles.changeTime}>
                  {formatDateTime(change.created_at)}
                </Text>
              </View>
              
              <View style={styles.changeValues}>
                <View style={styles.changeValueRow}>
                  <Text style={styles.changeLabel}>Old Value:</Text>
                  <Text style={styles.changeValue}>{String(change.old_value || 'N/A')}</Text>
                </View>
                <View style={styles.changeValueRow}>
                  <Text style={styles.changeLabel}>New Value:</Text>
                  <Text style={styles.changeValueNew}>{String(change.new_value || 'N/A')}</Text>
                </View>
              </View>
              
              {change.changed_by && (
                <Text style={styles.changedBy}>Changed by: {change.changed_by}</Text>
              )}
              
              {change.reason && (
                <Text style={styles.changeReason}>Reason: {change.reason}</Text>
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
  changeCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  changeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  changeKey: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    flex: 1,
  },
  changeTime: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
  changeValues: {
    marginBottom: SPACING.sm,
  },
  changeValueRow: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
    alignItems: 'center',
  },
  changeLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    width: 100,
  },
  changeValue: {
    fontSize: SIZES.sm,
    color: COLORS.danger,
    flex: 1,
  },
  changeValueNew: {
    fontSize: SIZES.sm,
    color: COLORS.success,
    fontWeight: '600',
    flex: 1,
  },
  changedBy: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  changeReason: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
});
