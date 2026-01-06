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
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function CustomerInvoicesScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');

  useEffect(() => {
    fetchInvoices();
  }, [filter]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('email, phone')
        .eq('id', user.id)
        .single();

      if (!userProfile) return;

      // NEW FLOW: Fetch visible customer documents from invoices (OS/CI/TI)
      const { data: leadsData, error: leadsErr } = await supabase
        .from('service_leads')
        .select('id')
        .or(`customer_email.eq.${userProfile.email},customer_phone.eq.${userProfile.phone}`);

      if (leadsErr) throw leadsErr;
      const leadIds = (leadsData || []).map((l: any) => l.id);
      if (leadIds.length === 0) {
        setInvoices([]);
        return;
      }

      const { data: invData, error: invErr } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_type,
          final_amount,
          paid_amount,
          payment_status,
          created_at,
          lead:service_leads!lead_id(
            id,
            lead_number,
            service_type,
            vehicle_number,
            workshop:workshops(name)
          )
        `)
        .in('lead_id', leadIds)
        .eq('visible_to_customer', true)
        .order('created_at', { ascending: false });

      if (invErr) throw invErr;

      let filteredData = invData || [];
      if (filter === 'paid') {
        filteredData = filteredData.filter((inv: any) => inv.payment_status === 'PAID');
      } else if (filter === 'pending') {
        filteredData = filteredData.filter((inv: any) => inv.payment_status !== 'PAID');
      } else if (filter === 'overdue') {
        filteredData = filteredData.filter((inv: any) => inv.payment_status === 'OVERDUE');
      }

      setInvoices(filteredData as any[]);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchInvoices();
  };

  const handleDownloadInvoice = async (invoice: any) => {
    // Navigate to invoice detail or generate PDF
    navigation.navigate('CustomerInvoiceDetail', { invoiceId: invoice.id });
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PAID':
        return COLORS.success;
      case 'PENDING':
        return COLORS.warning;
      case 'OVERDUE':
        return COLORS.danger;
      default:
        return COLORS.textSecondary;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading invoices...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="My Invoices" onBack={() => navigation.goBack()} />
      
      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {(['all', 'paid', 'pending', 'overdue'] as const).map((f) => (
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
        {invoices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No invoices found</Text>
          </View>
        ) : (
          invoices.map((invoice, index) => (
            <View key={invoice.id || index} style={styles.invoiceCard}>
              <View style={styles.invoiceHeader}>
                <View style={styles.invoiceLeft}>
                  <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                  <Text style={styles.invoiceDate}>
                    {formatDateDMY(invoice.created_at)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getPaymentStatusColor(invoice.payment_status) }
                  ]}
                >
                  <Text style={styles.statusText}>
                    {invoice.payment_status || 'PENDING'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.invoiceDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Service:</Text>
                  <Text style={styles.detailValue}>{invoice.lead?.service_type || 'General Service'}</Text>
                </View>
                {invoice.lead?.workshop?.name && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Workshop:</Text>
                    <Text style={styles.detailValue}>{invoice.lead.workshop.name}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount:</Text>
                  <Text style={[styles.amountValue]}>
                    ₹{invoice.final_amount || 0}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>{invoice.invoice_type || 'INVOICE'}</Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => handleDownloadInvoice(invoice)}
              >
                <Text style={styles.downloadButtonText}>View Invoice</Text>
              </TouchableOpacity>
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
    paddingHorizontal: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: SIZES.xs,
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
  invoiceCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  invoiceLeft: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.xs,
  },
  invoiceDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
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
  invoiceDetails: {
    marginBottom: SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  detailLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  amountValue: {
    fontSize: SIZES.md,
    color: COLORS.success,
    fontWeight: 'bold',
  },
  downloadButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  downloadButtonText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
});
