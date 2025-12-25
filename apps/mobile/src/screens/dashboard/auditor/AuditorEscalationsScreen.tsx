import React, { useState, useEffect } from 'react';
import { formatDateDMY } from "@/lib/dateFormat";
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

export default function AuditorEscalationsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [escalations, setEscalations] = useState<any[]>([]);

  useEffect(() => {
    fetchEscalations();
  }, []);

  const fetchEscalations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('audit_escalations')
        .select('*, lead:service_leads(lead_number, customer_name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error && error.code !== 'PGRST116') throw error;
      setEscalations(data || []);
    } catch (error) {
      console.error('Error fetching escalations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEscalations();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'HIGH':
        return COLORS.danger;
      case 'MEDIUM':
        return COLORS.warning;
      case 'LOW':
        return COLORS.info;
      default:
        return COLORS.textSecondary;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading escalations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Escalations" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {escalations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No escalations found</Text>
          </View>
        ) : (
          escalations.map((escalation, index) => (
            <View key={escalation.id || index} style={styles.escalationCard}>
              <View style={styles.escalationHeader}>
                <Text style={styles.escalationId}>#{escalation.id?.slice(0, 8)}</Text>
                <View
                  style={[
                    styles.priorityBadge,
                    { backgroundColor: getPriorityColor(escalation.priority) }
                  ]}
                >
                  <Text style={styles.priorityText}>
                    {escalation.priority || 'MEDIUM'}
                  </Text>
                </View>
              </View>
              
              {escalation.lead && (
                <Text style={styles.leadNumber}>
                  Lead: {escalation.lead.lead_number}
                </Text>
              )}
              
              {escalation.description && (
                <Text style={styles.description}>{escalation.description}</Text>
              )}
              
              <Text style={styles.escalationDate}>
                {formatDateDMY(escalation.created_at)}
              </Text>
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
  escalationCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  escalationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  escalationId: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: SIZES.xs,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  leadNumber: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  description: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  escalationDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
});
