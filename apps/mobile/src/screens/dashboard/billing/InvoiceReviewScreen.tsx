/**
 * Invoice Review Screen - Mobile
 * Billing team reviews and approves/rejects invoices
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';
import { ENV } from '../../../config/environment';

export default function InvoiceReviewScreen({ route, navigation }: any) {
  const { invoiceId } = route.params;
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Review checklist
  const [itemsVerified, setItemsVerified] = useState(false);
  const [taxesVerified, setTaxesVerified] = useState(false);
  const [customerDetailsVerified, setCustomerDetailsVerified] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  const fetchInvoice = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          lead:service_leads!lead_id(
            id,
            lead_number,
            customer_name,
            customer_phone,
            vehicle_number,
            vehicle_make,
            vehicle_model
          ),
          workshop:workshops!workshop_id(
            name,
            gst_number
          )
        `)
        .eq('id', invoiceId)
        .single();

      if (error) throw error;
      setInvoice(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const approveInvoice = async () => {
    if (!itemsVerified || !taxesVerified || !customerDetailsVerified) {
      Alert.alert('Validation Required', 'Please verify all items before approving');
      return;
    }

    setReviewing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${ENV.API_URL}/api/billing/invoices/${invoiceId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          review_notes: reviewNotes || 'Invoice verified and approved',
          items_verified: itemsVerified,
          taxes_verified: taxesVerified,
          customer_details_verified: customerDetailsVerified,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to approve invoice');

      Alert.alert('Success', 'Invoice approved successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to approve invoice');
    } finally {
      setReviewing(false);
    }
  };

  const rejectInvoice = async () => {
    if (!reviewNotes.trim()) {
      Alert.alert('Notes Required', 'Please provide rejection reason');
      return;
    }

    setReviewing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${ENV.API_URL}/api/billing/invoices/${invoiceId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          rejection_reason: reviewNotes,
          review_notes: reviewNotes,
          items_verified: false,
          taxes_verified: false,
          customer_details_verified: false,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reject invoice');

      Alert.alert('Success', 'Invoice rejected', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject invoice');
    } finally {
      setReviewing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading invoice...</Text>
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Invoice not found</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const lineItems = invoice.line_items || [];
  const subtotal = invoice.base_amount + (invoice.extra_charges || 0) + (invoice.parts_cost || 0) - (invoice.discount_amount || 0);
  const totalTax = (invoice.cgst_amount || 0) + (invoice.sgst_amount || 0) + (invoice.igst_amount || 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchInvoice} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Invoice</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Invoice Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Invoice Details</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Invoice Number:</Text>
          <Text style={styles.value}>{invoice.invoice_number}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Status:</Text>
          <Text style={[styles.value, styles.statusBadge, { backgroundColor: invoice.status === 'APPROVED' ? COLORS.success : COLORS.warning }]}>
            {invoice.status}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Amount:</Text>
          <Text style={[styles.value, styles.amountText]}>₹{invoice.final_amount?.toFixed(2)}</Text>
        </View>
      </View>

      {/* Customer Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer Details</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Name:</Text>
          <Text style={styles.value}>{invoice.lead?.customer_name || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Phone:</Text>
          <Text style={styles.value}>{invoice.lead?.customer_phone || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Vehicle:</Text>
          <Text style={styles.value}>
            {invoice.lead?.vehicle_number || 'N/A'} - {invoice.lead?.vehicle_make} {invoice.lead?.vehicle_model}
          </Text>
        </View>
      </View>

      {/* Line Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Line Items</Text>
        {lineItems.map((item: any, index: number) => (
          <View key={index} style={styles.lineItem}>
            <Text style={styles.itemDescription}>{item.description}</Text>
            <View style={styles.itemDetails}>
              <Text style={styles.itemText}>Qty: {item.qty} × ₹{item.rate?.toFixed(2)}</Text>
              <Text style={styles.itemAmount}>₹{item.amount?.toFixed(2)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Amount Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Amount Breakdown</Text>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Subtotal:</Text>
          <Text style={styles.breakdownValue}>₹{subtotal.toFixed(2)}</Text>
        </View>
        {invoice.cgst_amount > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>CGST (9%):</Text>
            <Text style={styles.breakdownValue}>₹{invoice.cgst_amount.toFixed(2)}</Text>
          </View>
        )}
        {invoice.sgst_amount > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>SGST (9%):</Text>
            <Text style={styles.breakdownValue}>₹{invoice.sgst_amount.toFixed(2)}</Text>
          </View>
        )}
        {invoice.igst_amount > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>IGST (18%):</Text>
            <Text style={styles.breakdownValue}>₹{invoice.igst_amount.toFixed(2)}</Text>
          </View>
        )}
        {invoice.discount_amount > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Discount:</Text>
            <Text style={[styles.breakdownValue, styles.discountText]}>-₹{invoice.discount_amount.toFixed(2)}</Text>
          </View>
        )}
        <View style={[styles.breakdownRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalValue}>₹{invoice.final_amount?.toFixed(2)}</Text>
        </View>
      </View>

      {/* Review Checklist */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Review Checklist</Text>
        
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setItemsVerified(!itemsVerified)}
        >
          <Ionicons
            name={itemsVerified ? 'checkbox' : 'square-outline'}
            size={24}
            color={itemsVerified ? COLORS.success : COLORS.gray[400]}
          />
          <Text style={styles.checkboxLabel}>Items verified against pricing</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setTaxesVerified(!taxesVerified)}
        >
          <Ionicons
            name={taxesVerified ? 'checkbox' : 'square-outline'}
            size={24}
            color={taxesVerified ? COLORS.success : COLORS.gray[400]}
          />
          <Text style={styles.checkboxLabel}>Tax calculations verified</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setCustomerDetailsVerified(!customerDetailsVerified)}
        >
          <Ionicons
            name={customerDetailsVerified ? 'checkbox' : 'square-outline'}
            size={24}
            color={customerDetailsVerified ? COLORS.success : COLORS.gray[400]}
          />
          <Text style={styles.checkboxLabel}>Customer details verified</Text>
        </TouchableOpacity>
      </View>

      {/* Review Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Review Notes</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Add review notes or rejection reason..."
          multiline
          numberOfLines={4}
          value={reviewNotes}
          onChangeText={setReviewNotes}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.button, styles.rejectButton]}
          onPress={rejectInvoice}
          disabled={reviewing}
        >
          {reviewing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="close-circle" size={20} color={COLORS.white} />
              <Text style={styles.buttonText}>Reject</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.approveButton]}
          onPress={approveInvoice}
          disabled={reviewing}
        >
          {reviewing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
              <Text style={styles.buttonText}>Approve</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  section: {
    backgroundColor: COLORS.white,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: SIZES.sm,
  },
  sectionTitle: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    color: COLORS.gray[800],
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  label: {
    fontSize: SIZES.sm,
    color: COLORS.gray[600],
  },
  value: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray[800],
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 4,
    color: COLORS.white,
    fontSize: SIZES.xs,
  },
  amountText: {
    fontSize: SIZES.lg,
    color: COLORS.primary,
  },
  lineItem: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  itemDescription: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemText: {
    fontSize: SIZES.xs,
    color: COLORS.gray[600],
  },
  itemAmount: {
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  breakdownLabel: {
    fontSize: SIZES.sm,
    color: COLORS.gray[600],
  },
  breakdownValue: {
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  discountText: {
    color: COLORS.success,
  },
  totalRow: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[300],
  },
  totalLabel: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  checkboxLabel: {
    marginLeft: SPACING.sm,
    fontSize: SIZES.sm,
    color: COLORS.gray[700],
  },
  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: SIZES.sm,
    padding: SPACING.sm,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: SIZES.sm,
    gap: SPACING.xs,
  },
  rejectButton: {
    backgroundColor: COLORS.danger,
  },
  approveButton: {
    backgroundColor: COLORS.success,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: SIZES.md,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.gray[600],
  },
  errorText: {
    fontSize: SIZES.md,
    color: COLORS.danger,
    marginBottom: SPACING.md,
  },
});

