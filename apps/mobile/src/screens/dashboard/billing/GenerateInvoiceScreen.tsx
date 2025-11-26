/**
 * Generate Invoice Screen - Billing
 * Create and send invoices to customers
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function GenerateInvoiceScreen({ route, navigation }: any) {
  const leadId = route?.params?.leadId;
  const [lead, setLead] = useState<any>(null);
  const [items, setItems] = useState([{ description: '', quantity: 1, rate: 0, amount: 0 }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLead();
  }, [leadId]);

  const fetchLead = async () => {
    try {
      const { data } = await supabase.from('leads').select('*, workshop:workshop_id(workshop_name, gst_number)').eq('id', leadId).single();
      setLead(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, rate: 0, amount: 0 }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = newItems[index].quantity * newItems[index].rate;
    }
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.amount, 0);
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const total = calculateTotal();
      const gst = total * 0.18;
      const grandTotal = total + gst;

      const { error } = await supabase.from('invoices').insert({
        lead_id: leadId,
        invoice_number: `INV-${Date.now()}`,
        items: items,
        subtotal: total,
        gst_amount: gst,
        total_amount: grandTotal,
        status: 'PENDING',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (error) throw error;

      Alert.alert('Success', 'Invoice generated successfully!');
      navigation?.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}><Ionicons name="arrow-back" size={24} /></TouchableOpacity>
        <Text style={styles.title}>Generate Invoice</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Lead Number</Text>
        <Text style={styles.value}>{lead?.lead_number}</Text>
        <Text style={styles.label}>Customer</Text>
        <Text style={styles.value}>{lead?.customer_name}</Text>
        <Text style={styles.label}>Vehicle</Text>
        <Text style={styles.value}>{lead?.vehicle_number}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Invoice Items</Text>
        {items.map((item, index) => (
          <View key={index} style={styles.itemCard}>
            <TextInput style={styles.input} placeholder="Description" value={item.description} onChangeText={text => updateItem(index, 'description', text)} />
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.inputSmall]} placeholder="Qty" value={String(item.quantity)} onChangeText={text => updateItem(index, 'quantity', parseInt(text) || 0)} keyboardType="numeric" />
              <TextInput style={[styles.input, styles.inputSmall]} placeholder="Rate" value={String(item.rate)} onChangeText={text => updateItem(index, 'rate', parseFloat(text) || 0)} keyboardType="numeric" />
              <Text style={styles.amount}>₹{item.amount.toFixed(2)}</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={addItem}><Ionicons name="add-circle" size={24} color={COLORS.primary} /><Text style={styles.addText}>Add Item</Text></TouchableOpacity>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal:</Text><Text style={styles.summaryValue}>₹{calculateTotal().toFixed(2)}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>GST (18%):</Text><Text style={styles.summaryValue}>₹{(calculateTotal() * 0.18).toFixed(2)}</Text></View>
        <View style={[styles.summaryRow, styles.totalRow]}><Text style={styles.totalLabel}>Total:</Text><Text style={styles.totalValue}>₹{(calculateTotal() * 1.18).toFixed(2)}</Text></View>
      </View>

      <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={loading}>
        <Text style={styles.generateText}>{loading ? 'Generating...' : 'Generate Invoice'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, backgroundColor: COLORS.white, gap: SPACING.md },
  title: { fontSize: SIZES.xl, fontWeight: 'bold' },
  card: { backgroundColor: COLORS.white, margin: SPACING.md, padding: SPACING.lg, borderRadius: SIZES.sm },
  label: { fontSize: SIZES.sm, color: COLORS.gray[600], marginTop: SPACING.sm },
  value: { fontSize: SIZES.md, color: COLORS.gray[900], marginTop: 4, fontWeight: '600' },
  section: { padding: SPACING.md },
  sectionTitle: { fontSize: SIZES.lg, fontWeight: 'bold', marginBottom: SPACING.md },
  itemCard: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: SIZES.sm, marginBottom: SPACING.md },
  input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[300], borderRadius: SIZES.sm, padding: SPACING.sm, marginBottom: SPACING.sm, fontSize: SIZES.sm },
  row: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  inputSmall: { flex: 1 },
  amount: { fontSize: SIZES.md, fontWeight: 'bold', color: COLORS.primary, minWidth: 80, textAlign: 'right' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
  addText: { fontSize: SIZES.md, color: COLORS.primary, fontWeight: '600' },
  summary: { backgroundColor: COLORS.white, margin: SPACING.md, padding: SPACING.lg, borderRadius: SIZES.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  summaryLabel: { fontSize: SIZES.md, color: COLORS.gray[600] },
  summaryValue: { fontSize: SIZES.md, color: COLORS.gray[900], fontWeight: '600' },
  totalRow: { borderTopWidth: 2, borderTopColor: COLORS.gray[200], paddingTop: SPACING.md, marginTop: SPACING.sm },
  totalLabel: { fontSize: SIZES.lg, fontWeight: 'bold', color: COLORS.gray[900] },
  totalValue: { fontSize: SIZES.lg, fontWeight: 'bold', color: COLORS.primary },
  generateBtn: { backgroundColor: COLORS.success, margin: SPACING.md, padding: SPACING.lg, borderRadius: SIZES.sm, alignItems: 'center' },
  generateText: { color: COLORS.white, fontSize: SIZES.md, fontWeight: 'bold' },
});

