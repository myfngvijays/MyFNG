import React, { useState, useEffect } from 'react';
import {
import { formatDateTime } from "@/lib/dateFormat";
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

export default function FinanceAuditTrailScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);

  useEffect(() => {
    fetchAuditTrail();
  }, []);

  const fetchAuditTrail = async () => {
    try {
      setLoading(true);
      // Fetch financial audit trail - adjust table name as needed
      const { data, error } = await supabase
        .from('finance_audit_trail')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error && error.code !== 'PGRST116') throw error;
      
      // Fallback to general audit logs if finance_audit_trail doesn't exist
      if (!data || data.length === 0) {
        const { data: auditData } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('audit_type', 'FINANCE')
          .order('created_at', { ascending: false })
          .limit(100);
        
        setAuditTrail(auditData || []);
      } else {
        setAuditTrail(data);
      }
    } catch (error) {
      console.error('Error fetching audit trail:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAuditTrail();
  };

  const getActionColor = (action: string) => {
    switch (action?.toUpperCase()) {
      case 'CREATE':
      case 'APPROVE':
        return COLORS.success;
      case 'UPDATE':
        return COLORS.info;
      case 'DELETE':
      case 'REJECT':
        return COLORS.danger;
      default:
        return COLORS.textSecondary;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading audit trail...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Finance Audit Trail" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {auditTrail.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No audit trail entries found</Text>
          </View>
        ) : (
          auditTrail.map((entry, index) => (
            <View key={entry.id || index} style={styles.auditCard}>
              <View style={styles.auditHeader}>
                <View
                  style={[
                    styles.actionBadge,
                    { backgroundColor: getActionColor(entry.action || entry.event_type) }
                  ]}
                >
                  <Text style={styles.actionText}>
                    {entry.action || entry.event_type || 'ACTION'}
                  </Text>
                </View>
                <Text style={styles.auditDate}>
                  {formatDateTime(entry.created_at)}
                </Text>
              </View>
              
              <Text style={styles.auditDescription}>
                {entry.description || entry.event_description || 'No description'}
              </Text>
              
              {entry.user_id && (
                <Text style={styles.auditUser}>User: {entry.user_id}</Text>
              )}
              
              {entry.entity_type && (
                <Text style={styles.auditEntity}>Entity: {entry.entity_type}</Text>
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
  auditCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  auditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  actionBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  actionText: {
    fontSize: SIZES.xs,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  auditDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
  auditDescription: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  auditUser: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  auditEntity: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
});
