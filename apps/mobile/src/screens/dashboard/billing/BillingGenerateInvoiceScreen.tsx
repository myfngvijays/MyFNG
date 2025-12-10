import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function BillingGenerateInvoiceScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { leadId } = route.params as any;
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lead, setLead] = useState<any>(null);
  const [baseAmount, setBaseAmount] = useState(0);
  const [taxRate, setTaxRate] = useState(18);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchLeadDetails();
  }, [leadId]);

  const fetchLeadDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (error) throw error;
      setLead(data);
      setBaseAmount(data.estimated_cost || 0);
    } catch (error) {
      Alert.alert('Error', 'Failed to load lead details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const subtotal = baseAmount;
    let discount = 0;
    if (discountType === 'percentage') {
      discount = (subtotal * discountValue) / 100;
    } else {
      discount = discountValue;
    }
    const afterDiscount = subtotal - discount;
    const tax = (afterDiscount * taxRate) / 100;
    const total = afterDiscount + tax;

    return { subtotal, discount, tax, total };
  };

  const handleGenerateInvoice = async () => {
    const { total } = calculateTotals();

    Alert.alert(
      'Generate Invoice',
      `Generate invoice for ₹${total.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            try {
              setProcessing(true);
              const { error } = await supabase
                .from('service_leads')
                .update({
                  invoice_amount: total,
                  invoice_generated_at: new Date().toISOString(),
                  status: 'INVOICE_GENERATED',
                  invoice_notes: notes,
                })
                .eq('id', leadId);

              if (error) throw error;

              Alert.alert('Success', 'Invoice generated successfully');
              navigation.goBack();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to generate invoice');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading lead details...</Text>
      </View>
    );
  }

  const { subtotal, discount, tax, total } = calculateTotals();

  return (
    <View style={styles.container}>
      <DashboardHeader title="Generate Invoice" onBack={() => navigation.goBack()} />
      
      <ScrollView style={styles.scrollView}>
        {/* Lead Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lead Information</Text>
          <Text style={styles.infoText}>Lead: {lead?.lead_number}</Text>
          <Text style={styles.infoText}>Customer: {lead?.customer_name}</Text>
        </View>

        {/* Amount Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amount Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Base Amount (₹)</Text>
            <TextInput
              style={styles.input}
              value={baseAmount.toString()}
              onChangeText={(text) => setBaseAmount(parseFloat(text) || 0)}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tax Rate (%)</Text>
            <TextInput
              style={styles.input}
              value={taxRate.toString()}
              onChangeText={(text) => setTaxRate(parseFloat(text) || 0)}
              keyboardType="numeric"
              placeholder="18"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Discount Type</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={[
                  styles.radioButton,
                  discountType === 'percentage' && styles.radioButtonActive
                ]}
                onPress={() => setDiscountType('percentage')}
              >
                <Text style={[
                  styles.radioButtonText,
                  discountType === 'percentage' && styles.radioButtonTextActive
                ]}>
                  Percentage
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.radioButton,
                  discountType === 'fixed' && styles.radioButtonActive
                ]}
                onPress={() => setDiscountType('fixed')}
              >
                <Text style={[
                  styles.radioButtonText,
                  discountType === 'fixed' && styles.radioButtonTextActive
                ]}>
                  Fixed
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Discount Value</Text>
            <TextInput
              style={styles.input}
              value={discountValue.toString()}
              onChangeText={(text) => setDiscountValue(parseFloat(text) || 0)}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              placeholder="Invoice notes..."
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
        </View>

        {/* Calculation Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Invoice Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount:</Text>
              <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                -₹{discount.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax ({taxRate}%):</Text>
            <Text style={styles.summaryValue}>₹{tax.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.generateButton, processing && styles.generateButtonDisabled]}
          onPress={handleGenerateInvoice}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.generateButtonText}>Generate Invoice</Text>
          )}
        </TouchableOpacity>
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
  infoText: {
    fontSize: SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: SPACING.sm,
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
  summarySection: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    margin: SPACING.md,
    borderRadius: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  summaryLabel: {
    fontSize: SIZES.md,
    color: COLORS.text,
  },
  summaryValue: {
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
  generateButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    margin: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: COLORS.white,
    fontSize: SIZES.lg,
    fontWeight: 'bold',
  },
});
