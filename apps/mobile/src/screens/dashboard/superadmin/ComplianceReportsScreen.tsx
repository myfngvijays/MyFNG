import React, { useState, useEffect } from 'react';
import {
import { formatDateDMY } from "@/lib/dateFormat";
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

export default function ComplianceReportsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    fetchComplianceReports();
  }, []);

  const fetchComplianceReports = async () => {
    try {
      setLoading(true);
      // Fetch compliance data - adjust table name as needed
      const { data: workshops, error } = await supabase
        .from('workshops')
        .select('id, name, is_verified, created_at, compliance_status')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform to compliance reports format
      const complianceReports = (workshops || []).map((w: any) => ({
        id: w.id,
        workshop_name: w.name,
        status: w.compliance_status || (w.is_verified ? 'COMPLIANT' : 'PENDING'),
        last_audit: w.created_at,
        issues_found: 0,
      }));
      
      setReports(complianceReports);
    } catch (error) {
      console.error('Error fetching compliance reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchComplianceReports();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'COMPLIANT':
        return COLORS.success;
      case 'PENDING':
        return COLORS.warning;
      case 'NON_COMPLIANT':
        return COLORS.danger;
      default:
        return COLORS.textSecondary;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading compliance reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Compliance Reports" onBack={() => navigation.goBack()} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {reports.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No compliance reports found</Text>
          </View>
        ) : (
          reports.map((report, index) => (
            <View key={report.id || index} style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportTitle}>{report.workshop_name}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(report.status) }
                  ]}
                >
                  <Text style={styles.statusText}>{report.status}</Text>
                </View>
              </View>
              
              <View style={styles.reportDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last Audit:</Text>
                  <Text style={styles.detailValue}>
                    {formatDateDMY(report.last_audit)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Issues Found:</Text>
                  <Text style={[styles.detailValue, { color: report.issues_found > 0 ? COLORS.danger : COLORS.success }]}>
                    {report.issues_found}
                  </Text>
                </View>
              </View>
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
  reportCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  reportTitle: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: SIZES.xs,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  reportDetails: {
    gap: SPACING.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
