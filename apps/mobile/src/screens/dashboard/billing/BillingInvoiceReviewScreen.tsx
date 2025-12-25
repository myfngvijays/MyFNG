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
  Alert,
  Switch,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function BillingInvoiceReviewScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filter, setFilter] = useState<'GENERATED' | 'PENDING' | 'APPROVED' | 'REJECTED'>('GENERATED');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState({
    review_status: 'APPROVED',
    review_notes: '',
    items_verified: true,
    taxes_verified: true,
    customer_details_verified: true,
  });

  useEffect(() => {
    fetchInvoices();
  }, [filter]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('service_leads')
        .select('*, workshop:workshops(name)')
        .in('status', ['INVOICE_GENERATED', 'INVOICE_REVIEW'])
        .order('created_at', { ascending: false });

      if (filter !== 'GENERATED') {
        query = query.eq('invoice_status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInvoices(data || []);
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

  const handleReview = async () => {
    if (!selectedInvoice) return;

    try {
      const { error } = await supabase
        .from('service_leads')
        .update({
          invoice_status: reviewData.review_status,
          invoice_review_notes: reviewData.review_notes,
          invoice_reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      Alert.alert('Success', 'Invoice reviewed successfully');
      setShowReviewModal(false);
      fetchInvoices();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to review invoice');
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
      <DashboardHeader title="Invoice Review" onBack={() => navigation.goBack()} />
      
      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {(['GENERATED', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((f) => (
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
              {f}
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
            <Text style={styles.emptyText}>No invoices to review</Text>
          </View>
        ) : (
          invoices.map((invoice, index) => (
            <TouchableOpacity
              key={invoice.id || index}
              style={styles.invoiceCard}
              onPress={() => {
                setSelectedInvoice(invoice);
                setShowReviewModal(true);
              }}
            >
              <View style={styles.invoiceHeader}>
                <Text style={styles.invoiceNumber}>{invoice.invoice_number || invoice.lead_number}</Text>
                <Text style={styles.invoiceAmount}>₹{invoice.invoice_amount || 0}</Text>
              </View>
              <Text style={styles.customerName}>{invoice.customer_name}</Text>
              {invoice.workshop?.name && (
                <Text style={styles.workshopName}>{invoice.workshop.name}</Text>
              )}
              <Text style={styles.invoiceDate}>
                {formatDateDMY(invoice.created_at)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Review Modal */}
      {showReviewModal && selectedInvoice && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Review Invoice</Text>
            
            <Text style={styles.modalLabel}>Status</Text>
            <View style={styles.radioGroup}>
              {['APPROVED', 'REJECTED'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.radioButton,
                    reviewData.review_status === status && styles.radioButtonActive
                  ]}
                  onPress={() => setReviewData({ ...reviewData, review_status: status })}
                >
                  <Text style={[
                    styles.radioButtonText,
                    reviewData.review_status === status && styles.radioButtonTextActive
                  ]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={reviewData.review_notes}
              onChangeText={(text) => setReviewData({ ...reviewData, review_notes: text })}
              multiline
              placeholder="Review notes..."
              placeholderTextColor={COLORS.textSecondary}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowReviewModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleReview}
              >
                <Text style={styles.submitButtonText}>Submit Review</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    marginBottom: SPACING.sm,
  },
  invoiceNumber: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textHeading,
  },
  invoiceAmount: {
    fontSize: SIZES.md,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  customerName: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  workshopName: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  invoiceDate: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: 8,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textHeading,
    marginBottom: SPACING.md,
  },
  modalLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  radioButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
  },
  radioButtonActive: {
    backgroundColor: COLORS.primary,
  },
  radioButtonText: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  radioButtonTextActive: {
    color: COLORS.white,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: SIZES.sm,
    color: COLORS.text,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modalButton: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.gray[200],
  },
  submitButton: {
    backgroundColor: COLORS.primary,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontSize: SIZES.md,
    fontWeight: '600',
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: SIZES.md,
    fontWeight: '600',
  },
});
