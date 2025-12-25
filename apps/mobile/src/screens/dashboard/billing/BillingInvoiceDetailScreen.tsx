import React, { useState, useEffect } from 'react';
import { formatDateDMY } from "@/lib/dateFormat";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function BillingInvoiceDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { invoiceId, leadId } = route.params as any;
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);

  useEffect(() => {
    fetchInvoiceDetail();
  }, [invoiceId, leadId]);

  const fetchInvoiceDetail = async () => {
    try {
      setLoading(true);
      const query = supabase
        .from('service_leads')
        .select('*, workshop:workshops(name, address, phone, gst_number), customer:users_login(full_name, email, phone)')
        .single();

      if (invoiceId || leadId) {
        query.eq('id', invoiceId || leadId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvoice(data);
    } catch (error) {
      console.error('Error fetching invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading invoice...</Text>
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.container}>
        <DashboardHeader title="Invoice Detail" onBack={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Invoice not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Invoice Detail" onBack={() => navigation.goBack()} />
      
      <ScrollView style={styles.scrollView}>
        {/* Invoice Header */}
        <View style={styles.headerCard}>
          <Text style={styles.invoiceTitle}>Invoice #{invoice.invoice_number || invoice.lead_number}</Text>
          <Text style={styles.invoiceDate}>
            {formatDateDMY(invoice.created_at)}
          </Text>
        </View>

        {/* Customer Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Name:</Text>
            <Text style={styles.detailValue}>{invoice.customer_name}</Text>
          </View>
          {invoice.customer?.email && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email:</Text>
              <Text style={styles.detailValue}>{invoice.customer.email}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone:</Text>
            <Text style={styles.detailValue}>{invoice.customer_phone}</Text>
          </View>
        </View>

        {/* Service Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Service Type:</Text>
            <Text style={styles.detailValue}>{invoice.service_type}</Text>
          </View>
          {invoice.vehicle_number && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Vehicle:</Text>
              <Text style={styles.detailValue}>{invoice.vehicle_number}</Text>
            </View>
          )}
          {invoice.workshop?.name && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Workshop:</Text>
              <Text style={styles.detailValue}>{invoice.workshop.name}</Text>
            </View>
          )}
        </View>

        {/* Amount Details */}
        <View style={styles.amountSection}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Subtotal:</Text>
            <Text style={styles.amountValue}>
              ₹{invoice.estimated_cost || invoice.total_price || 0}
            </Text>
          </View>
          {invoice.gst_amount && (
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>GST:</Text>
              <Text style={styles.amountValue}>₹{invoice.gst_amount}</Text>
            </View>
          )}
          <View style={[styles.amountRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalValue}>
              ₹{invoice.invoice_amount || invoice.actual_amount || invoice.estimated_cost || 0}
            </Text>
          </View>
        </View>

        {/* Payment Status */}
        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>Payment Status</Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: invoice.payment_status === 'PAID' ? COLORS.success : COLORS.warning }
          ]}>
            <Text style={styles.statusText}>
              {invoice.payment_status || 'PENDING'}
            </Text>
          </View>
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
  headerCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    margin: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  invoiceTitle: {
    fontSize: SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.xs,
  },
  invoiceDate: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
  },
  section: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    margin: SPACING.md,
    marginTop: 0,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  detailLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  amountSection: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    margin: SPACING.md,
    marginTop: 0,
    borderRadius: 8,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  amountLabel: {
    fontSize: SIZES.md,
    color: COLORS.text,
  },
  amountValue: {
    fontSize: SIZES.md,
    color: COLORS.text,
    fontWeight: '600',
  },
  totalRow: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 2,
    borderTopColor: COLORS.border,
  },
  totalLabel: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textHeading,
  },
  totalValue: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  statusSection: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    margin: SPACING.md,
    marginTop: 0,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  statusText: {
    fontSize: SIZES.md,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
});
