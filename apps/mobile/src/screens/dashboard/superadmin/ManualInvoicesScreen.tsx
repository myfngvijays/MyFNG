import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

type ManualInvoice = {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number | null;
  currency: string | null;
  status: string | null;
  created_at: string | null;
  payment_mode?: string | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  customer_gstin?: string | null;
  car_number?: string | null;
  car_model?: string | null;
};

type LineItem = {
  item_name: string;
  item_description: string;
  hsn_sac_code?: string;
  qty: string;
  unit_price: string;
  tax_percent: string;
  discount: string;
};

const emptyLine: LineItem = {
  item_name: '',
  item_description: '',
  hsn_sac_code: '',
  qty: '1',
  unit_price: '0',
  tax_percent: '18',
  discount: '0',
};

export default function ManualInvoicesScreen({ navigation }: any) {
  const [invoices, setInvoices] = useState<ManualInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [saving, setSaving] = useState(false);
  const [csvText, setCsvText] = useState('');

  const [form, setForm] = useState<any>({
    invoice_number: '',
    invoice_date: '',
    due_date: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    customer_city: '',
    customer_state: '',
    customer_pincode: '',
    customer_gstin: '',
    customer_tax_type: '',
    place_of_supply: '',
    car_number: '',
    car_model: '',
    payment_mode: 'UPI',
    payment_reference: '',
    payment_notes: '',
    items: [{ ...emptyLine }],
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const data = await apiFetch<{ invoices: ManualInvoice[] }>('/api/admin/manual-invoices');
      setInvoices(data.invoices || []);
    } catch (e: any) {
      setMessage(e?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }

  const totalCount = useMemo(() => invoices.length, [invoices]);

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setForm((prev: any) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], ...patch };
      return { ...prev, items };
    });
  }

  async function handleCreate() {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...form,
        line_items: form.items.map((it: LineItem) => ({
          item_name: it.item_name,
          item_description: it.item_description,
          hsn_sac_code: it.hsn_sac_code || null,
          qty: Number(it.qty || 0),
          unit_price: Number(it.unit_price || 0),
          tax_percent: Number(it.tax_percent || 0),
          discount: Number(it.discount || 0),
        })),
      };
      await apiFetch('/api/admin/manual-invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setShowCreate(false);
      setForm({ ...form, items: [{ ...emptyLine }] });
      await fetchInvoices();
      setMessage('Manual invoice created.');
    } catch (e: any) {
      setMessage(e?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleCsvImport() {
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch('/api/admin/manual-invoices/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText }),
      });
      setShowCsv(false);
      setCsvText('');
      await fetchInvoices();
      setMessage('CSV imported successfully.');
    } catch (e: any) {
      setMessage(e?.message || 'Upload failed');
    } finally {
      setSaving(false);
    }
  }

  const renderItem = ({ item }: { item: ManualInvoice }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.invoice_number}</Text>
      <Text style={styles.cardMeta}>Customer: {item.customer_name || 'N/A'}</Text>
      <Text style={styles.cardMeta}>Phone: {item.customer_phone || 'N/A'}</Text>
      <Text style={styles.cardMeta}>Total: {item.total_amount ?? '-'} {item.currency || 'INR'}</Text>
      <Text style={styles.cardMeta}>Status: {item.status || '-'}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <DashboardHeader title="Manual Invoices" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.primaryText}>Create</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowCsv(true)}>
            <Text style={styles.secondaryText}>Import CSV</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.countText}>Total: {totalCount}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <FlatList
            data={invoices}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
          />
        )}
      </View>

      <Modal visible={showCreate} animationType="slide">
        <View style={styles.modalContainer}>
          <DashboardHeader title="Create Manual Invoice" onBack={() => setShowCreate(false)} />
          <ScrollView style={styles.modalBody}>
            <Text style={styles.label}>Invoice Number</Text>
            <TextInput style={styles.input} value={form.invoice_number} onChangeText={(v) => setForm((p: any) => ({ ...p, invoice_number: v }))} />
            <Text style={styles.label}>Invoice Date</Text>
            <TextInput style={styles.input} value={form.invoice_date} onChangeText={(v) => setForm((p: any) => ({ ...p, invoice_date: v }))} />
            <Text style={styles.label}>Due Date</Text>
            <TextInput style={styles.input} value={form.due_date} onChangeText={(v) => setForm((p: any) => ({ ...p, due_date: v }))} />
            <Text style={styles.label}>Customer Name</Text>
            <TextInput style={styles.input} value={form.customer_name} onChangeText={(v) => setForm((p: any) => ({ ...p, customer_name: v }))} />
            <Text style={styles.label}>Customer Phone</Text>
            <TextInput style={styles.input} value={form.customer_phone} onChangeText={(v) => setForm((p: any) => ({ ...p, customer_phone: v }))} />
            <Text style={styles.label}>Customer Email</Text>
            <TextInput style={styles.input} value={form.customer_email} onChangeText={(v) => setForm((p: any) => ({ ...p, customer_email: v }))} />
            <Text style={styles.label}>Car Number</Text>
            <TextInput style={styles.input} value={form.car_number} onChangeText={(v) => setForm((p: any) => ({ ...p, car_number: v }))} />
            <Text style={styles.label}>Car Model</Text>
            <TextInput style={styles.input} value={form.car_model} onChangeText={(v) => setForm((p: any) => ({ ...p, car_model: v }))} />
            <Text style={styles.label}>Payment Mode</Text>
            <TextInput style={styles.input} value={form.payment_mode} onChangeText={(v) => setForm((p: any) => ({ ...p, payment_mode: v }))} />

            <Text style={styles.sectionTitle}>Line Items</Text>
            {form.items.map((item: LineItem, idx: number) => (
              <View key={`item-${idx}`} style={styles.itemBlock}>
                <Text style={styles.label}>Item Name</Text>
                <TextInput style={styles.input} value={item.item_name} onChangeText={(v) => updateItem(idx, { item_name: v })} />
                <Text style={styles.label}>Description</Text>
                <TextInput style={styles.input} value={item.item_description} onChangeText={(v) => updateItem(idx, { item_description: v })} />
                <Text style={styles.label}>HSN/SAC</Text>
                <TextInput style={styles.input} value={item.hsn_sac_code} onChangeText={(v) => updateItem(idx, { hsn_sac_code: v })} />
                <Text style={styles.label}>Qty</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={item.qty} onChangeText={(v) => updateItem(idx, { qty: v })} />
                <Text style={styles.label}>Unit Price</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={item.unit_price} onChangeText={(v) => updateItem(idx, { unit_price: v })} />
                <Text style={styles.label}>Tax Percent</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={item.tax_percent} onChangeText={(v) => updateItem(idx, { tax_percent: v })} />
                <Text style={styles.label}>Discount</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={item.discount} onChangeText={(v) => updateItem(idx, { discount: v })} />
              </View>
            ))}
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setForm((p: any) => ({ ...p, items: [...p.items, { ...emptyLine }] }))}
            >
              <Text style={styles.secondaryText}>Add Line Item</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleCreate} disabled={saving}>
              <Text style={styles.primaryText}>{saving ? 'Saving...' : 'Create'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showCsv} animationType="slide">
        <View style={styles.modalContainer}>
          <DashboardHeader title="Import CSV" onBack={() => setShowCsv(false)} />
          <View style={styles.modalBody}>
            <Text style={styles.label}>Paste CSV data</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={csvText}
              onChangeText={setCsvText}
              multiline
              numberOfLines={10}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleCsvImport} disabled={saving}>
              <Text style={styles.primaryText}>{saving ? 'Uploading...' : 'Upload CSV'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, padding: SPACING.md },
  actionsRow: { flexDirection: 'row', gap: SPACING.sm },
  countText: { marginTop: SPACING.sm, color: COLORS.textSecondary },
  message: { marginTop: SPACING.sm, color: COLORS.primary },
  primaryBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 8, marginTop: SPACING.sm },
  primaryText: { color: COLORS.white, fontWeight: '600', textAlign: 'center' },
  secondaryBtn: { backgroundColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 8, marginTop: SPACING.sm },
  secondaryText: { color: COLORS.text, fontWeight: '600', textAlign: 'center' },
  list: { paddingVertical: SPACING.sm },
  card: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 8, marginBottom: SPACING.sm },
  cardTitle: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  cardMeta: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
  loading: { alignItems: 'center', marginTop: SPACING.lg },
  loadingText: { marginTop: SPACING.sm, color: COLORS.textSecondary },
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalBody: { padding: SPACING.md },
  label: { marginTop: SPACING.sm, color: COLORS.textSecondary, fontSize: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm, marginTop: 4, backgroundColor: COLORS.white, color: COLORS.text },
  textArea: { minHeight: 160, textAlignVertical: 'top' },
  sectionTitle: { marginTop: SPACING.md, fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  itemBlock: { marginTop: SPACING.sm, padding: SPACING.sm, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
});
