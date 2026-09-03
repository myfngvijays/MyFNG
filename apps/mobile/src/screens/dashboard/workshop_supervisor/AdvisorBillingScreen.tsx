import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  BackHandler,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS } from '../../../constants/theme';
import { AC } from '../../../components/workshop/advisorCrmUi';
import { apiFetch } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { formatDateDMY } from '@/lib/dateFormat';

type LineItem = {
  description?: string;
  qty?: number;
  quantity?: number;
  rate?: number;
  amount?: number;
  category?: string;
  service_type_id?: string;
  included_items?: Array<{ name?: string; quantity?: number; unit_price?: number; amount?: number }>;
};

type Invoice = {
  id: string;
  invoice_number?: string;
  invoice_type?: string;
  invoice_date?: string;
  created_at?: string;
  total_amount?: number;
  final_amount?: number;
  sub_total?: number;
  subtotal?: number;
  base_amount?: number;
  parts_cost?: number;
  parts_amount?: number;
  extra_charges?: number;
  extra_charges_amount?: number;
  discount_amount?: number;
  total_tax?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  round_off_amount?: number;
  amount_in_words?: string;
  payment_status?: string;
  payment_mode?: string;
  visible_to_customer?: boolean;
  paid_amount?: number;
  balance_due?: number;
  show_gst_breakup?: boolean;
  line_items?: LineItem[];
};

type IncludedService = {
  service_type_id?: string;
  service_name?: string;
  service_price?: number;
  items?: Array<{ name?: string; quantity?: number; unit_price?: number; amount?: number }>;
};

function money(n: number) {
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function num(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function invoiceTypeOf(inv: Invoice | null) {
  return String(inv?.invoice_type || 'ORDER_SUMMARY').toUpperCase();
}

function categoryLabel(c: string) {
  if (c === 'SERVICE') return 'Service Items';
  if (c === 'ADDON' || c === 'ADD-ON' || c === 'ADD_ON') return 'Add-ons';
  if (c === 'PART' || c === 'PARTS') return 'Additional Parts';
  if (c === 'LABOUR' || c === 'LABOR') return 'Labour';
  if (c === 'EXTRA') return 'Additional Charges';
  return c || 'Items';
}

export default function AdvisorBillingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const leadId = String((route.params as { leadId?: string })?.leadId || '').trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedType, setSelectedType] = useState<'ORDER_SUMMARY' | 'CUSTOMER_INVOICE' | 'TAX_INVOICE'>(
    'ORDER_SUMMARY',
  );
  const [included, setIncluded] = useState<IncludedService[]>([]);
  const [lead, setLead] = useState<any>(null);
  const [error, setError] = useState('');
  const [showPay, setShowPay] = useState(false);
  const [staffName, setStaffName] = useState('Advisor');
  const [remarks, setRemarks] = useState('Dummy test payment');
  const [payMode, setPayMode] = useState<'CASH' | 'UPI' | 'POS' | 'CARD'>('CASH');

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => back.remove();
  }, [navigation]);

  useEffect(() => {
    loadInvoice();
  }, [leadId]);

  async function loadInvoice() {
    if (!leadId) {
      setError('Lead missing');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [json, leadRes] = await Promise.all([
        apiFetch<{ invoice?: Invoice; invoices?: Invoice[]; included_service_items?: IncludedService[] }>(
          `/api/leads/${leadId}/invoice`,
        ),
        supabase
          .from('service_leads')
          .select(
            'id, lead_number, customer_name, customer_phone, vehicle_number, vehicle_make, vehicle_model, service_type',
          )
          .eq('id', leadId)
          .maybeSingle(),
      ]);
      const list = (Array.isArray(json.invoices) ? json.invoices : [json.invoice].filter(Boolean)) as Invoice[];
      setInvoices(list);
      setIncluded(Array.isArray(json.included_service_items) ? json.included_service_items : []);
      setLead(leadRes.data || null);
      const hasOS = list.some((row) => invoiceTypeOf(row) === 'ORDER_SUMMARY');
      const hasCI = list.some((row) => invoiceTypeOf(row) === 'CUSTOMER_INVOICE');
      const hasTI = list.some((row) => invoiceTypeOf(row) === 'TAX_INVOICE');
      if (hasOS) setSelectedType('ORDER_SUMMARY');
      else if (hasCI) setSelectedType('CUSTOMER_INVOICE');
      else if (hasTI) setSelectedType('TAX_INVOICE');
      if (list.length === 0) setError('Order Summary abhi generate nahi hui. QC pass ke baad refresh karo.');
    } catch (e: any) {
      setError(e?.message || 'Failed to load Order Summary');
    } finally {
      setLoading(false);
    }
  }

  const invoice = useMemo(
    () => invoices.find((row) => invoiceTypeOf(row) === selectedType) || invoices[0] || null,
    [invoices, selectedType],
  );

  const type = invoiceTypeOf(invoice);
  const isOS = type === 'ORDER_SUMMARY';
  const isCI = type === 'CUSTOMER_INVOICE';
  const isTI = type === 'TAX_INVOICE';
  const showGst = isTI && invoice?.show_gst_breakup !== false;

  const lines = useMemo(() => {
    const raw = Array.isArray(invoice?.line_items) ? invoice!.line_items! : [];
    const fromIncluded: LineItem[] = (included || [])
      .map((svc) => {
        const name = String(svc?.service_name || '').trim();
        const amount = num(svc?.service_price);
        if (!name && amount <= 0) return null;
        return {
          description: name || 'Service',
          qty: 1,
          rate: amount,
          amount,
          category: 'SERVICE',
          service_type_id: svc?.service_type_id,
          included_items: svc?.items,
        } as LineItem;
      })
      .filter(Boolean) as LineItem[];
    const existingKeys = new Set(
      raw
        .filter((it) => String(it.category || '').toUpperCase() === 'SERVICE')
        .flatMap((it) =>
          [String(it.service_type_id || '').trim(), String(it.description || '').trim().toLowerCase()].filter(Boolean),
        ),
    );
    const missingIncluded = fromIncluded.filter((it) => {
      const sid = String(it.service_type_id || '').trim();
      const name = String(it.description || '').trim().toLowerCase();
      if (sid && existingKeys.has(sid)) return false;
      if (name && existingKeys.has(name)) return false;
      return Boolean(sid || name);
    });
    const merged = missingIncluded.length > 0 ? [...missingIncluded, ...raw] : raw;
    if (merged.length > 0) return merged;
    const fallback: LineItem[] = [...fromIncluded];
    if (fallback.length === 0 && num(invoice?.base_amount) > 0) {
      fallback.push({ description: 'Base Service Charges', qty: 1, rate: num(invoice?.base_amount), amount: num(invoice?.base_amount), category: 'SERVICE' });
    }
    if (num(invoice?.parts_amount || invoice?.parts_cost) > 0) {
      fallback.push({
        description: 'Parts & Materials',
        qty: 1,
        rate: num(invoice?.parts_amount || invoice?.parts_cost),
        amount: num(invoice?.parts_amount || invoice?.parts_cost),
        category: 'PART',
      });
    }
    if (num(invoice?.extra_charges_amount || invoice?.extra_charges) > 0) {
      fallback.push({
        description: 'Additional Charges',
        qty: 1,
        rate: num(invoice?.extra_charges_amount || invoice?.extra_charges),
        amount: num(invoice?.extra_charges_amount || invoice?.extra_charges),
        category: 'EXTRA',
      });
    }
    return fallback;
  }, [invoice, included]);

  const grouped = useMemo(() => {
    const order = ['SERVICE', 'ADDON', 'ADD_ON', 'ADD-ON', 'PART', 'PARTS', 'LABOUR', 'LABOR', 'EXTRA'];
    const map: Record<string, LineItem[]> = {};
    for (const it of lines) {
      const cat = String(it.category || 'ITEMS').toUpperCase();
      if (!map[cat]) map[cat] = [];
      map[cat].push(it);
    }
    return Object.keys(map)
      .sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      })
      .map((key) => ({ key, items: map[key] }));
  }, [lines]);

  const includedFor = (it: LineItem) => {
    const cat = String(it.category || '').toUpperCase();
    if (cat !== 'SERVICE') return it.included_items || [];
    const sid = String(it.service_type_id || '').trim();
    const name = String(it.description || '').trim().toLowerCase();
    const match = included.find((svc) => {
      if (sid && String(svc.service_type_id || '') === sid) return true;
      return String(svc.service_name || '').trim().toLowerCase() === name;
    });
    return (match?.items || it.included_items || []) as IncludedService['items'];
  };

  const lineAmount = (it: LineItem) => {
    const qty = num(it.qty ?? it.quantity ?? 1) || 1;
    const rate = num(it.rate);
    const amount = num(it.amount);
    return amount > 0 ? amount : qty * rate;
  };

  const subTotal = useMemo(
    () => lines.reduce((sum, it) => sum + lineAmount(it), 0) || num(invoice?.sub_total ?? invoice?.subtotal),
    [lines, invoice],
  );
  const discount = num(invoice?.discount_amount);
  const storedPayable = num(invoice?.final_amount ?? invoice?.total_amount);
  const displayPayable = Math.max(0, subTotal - discount + (showGst ? num(invoice?.total_tax) : 0) + num(invoice?.round_off_amount));
  const payable = storedPayable > 0 ? storedPayable : displayPayable;
  const paidAmt = num(invoice?.paid_amount);
  const balanceDue = Math.max(0, num(invoice?.balance_due) || payable - paidAmt);
  const paid = String(invoice?.payment_status || '').toUpperCase() === 'PAID' || (payable > 0 && paidAmt >= payable - 0.05);

  async function finalizeBill() {
    setBusy(true);
    try {
      await apiFetch(`/api/billing/leads/${leadId}/finalize-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      Alert.alert('Bill finalized', 'Customer Invoice ready. Ab payment record karo.');
      await loadInvoice();
      setSelectedType('CUSTOMER_INVOICE');
    } catch (e: any) {
      Alert.alert('Finalize failed', e?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function activateForPayment() {
    if (!invoice?.id) return;
    setBusy(true);
    try {
      await apiFetch(`/api/billing/invoices/${invoice.id}/activate`, { method: 'POST' });
      Alert.alert('Activated', 'Customer Invoice payment ke liye open hai.');
      await loadInvoice();
    } catch (e: any) {
      Alert.alert('Activate failed', e?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function postPayment(amount: number) {
    if (!invoice?.id) return;
    return apiFetch(`/api/payments/invoices/${invoice.id}/record-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_mode: payMode,
        paid_amount: amount,
        payment_remarks: remarks.trim(),
        staff_name: staffName.trim(),
      }),
    });
  }

  async function recordPayment() {
    if (!invoice?.id) return;
    if (!staffName.trim() || !remarks.trim()) {
      Alert.alert('Required', 'Staff name aur remarks daalo.');
      return;
    }
    const amount = Number(balanceDue.toFixed(2));
    if (amount <= 0) {
      Alert.alert('No balance due', 'Is invoice pe kuch pending nahi hai.');
      return;
    }
    setBusy(true);
    try {
      try {
        await postPayment(amount);
      } catch (e: any) {
        const due = num(e?.payload?.balance_due);
        if (due > 0 && due < amount) {
          await postPayment(Number(due.toFixed(2)));
        } else {
          throw e;
        }
      }
      Alert.alert('Payment recorded', 'Tax Invoice generate hogi. Next: delivery.');
      setShowPay(false);
      await loadInvoice();
      setSelectedType('TAX_INVOICE');
    } catch (e: any) {
      Alert.alert('Payment failed', e?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#004AAD" />
        <Text style={styles.muted}>Loading Order Summary…</Text>
      </View>
    );
  }

  const tabs = [
    { key: 'ORDER_SUMMARY' as const, label: 'Order Summary' },
    { key: 'CUSTOMER_INVOICE' as const, label: 'Customer Invoice' },
    { key: 'TAX_INVOICE' as const, label: 'Tax Invoice' },
  ].filter((tab) => invoices.some((row) => invoiceTypeOf(row) === tab.key));

  return (
    <View style={AC.page}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tabs.length > 1 ? (
          <View style={styles.tabRow}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, selectedType === tab.key && styles.tabOn]}
                onPress={() => {
                  setSelectedType(tab.key);
                  setShowPay(false);
                }}
              >
                <Text style={[styles.tabTxt, selectedType === tab.key && styles.tabTxtOn]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={[AC.whiteCard, styles.nextCard]}>
          <Text style={styles.nextEyebrow}>
            {isOS ? 'Order Summary' : isCI ? 'Customer Invoice' : 'Tax Invoice'} · {invoice?.invoice_number || '—'}
          </Text>
          <Text style={styles.nextTitle}>
            {lead?.customer_name || 'Customer'} · {lead?.vehicle_number || '—'}
          </Text>
          <Text style={styles.nextBody}>
            {[lead?.lead_number, lead?.service_type, [lead?.vehicle_make, lead?.vehicle_model].filter(Boolean).join(' ')]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {lead?.customer_phone ? <Text style={styles.nextBody}>Phone: {lead.customer_phone}</Text> : null}
        </View>

        {error ? (
          <View style={AC.whiteCard}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={loadInvoice}>
              <Text style={styles.secondaryTxt}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {invoice ? (
          <View style={AC.whiteCard}>
            <View style={styles.billHead}>
              <Text style={styles.sectionTitle}>{isOS ? 'Detailed bill' : isCI ? 'Customer Invoice' : 'Tax Invoice'}</Text>
              <Text style={styles.invNo}>
                {invoice.invoice_date || invoice.created_at
                  ? formatDateDMY(String(invoice.invoice_date || invoice.created_at))
                  : ''}
              </Text>
            </View>

            {grouped.map((group) => (
              <View key={group.key}>
                <Text style={styles.groupLabel}>{categoryLabel(group.key)}</Text>
                {group.items.map((it, idx) => {
                  const qty = num(it.qty ?? it.quantity ?? 1) || 1;
                  const amt = lineAmount(it);
                  const rate = num(it.rate) || (qty ? amt / qty : amt);
                  const nested = includedFor(it) || [];
                  return (
                    <View key={`${group.key}-${idx}`} style={styles.itemCard}>
                      <Text style={styles.itemName}>
                        {idx + 1}. {it.description || `Item ${idx + 1}`}
                      </Text>
                      <View style={styles.itemMetaRow}>
                        <View style={styles.itemMeta}>
                          <Text style={styles.itemMetaLab}>Qty</Text>
                          <Text style={styles.itemMetaVal}>{qty}</Text>
                        </View>
                        <View style={styles.itemMeta}>
                          <Text style={styles.itemMetaLab}>Rate</Text>
                          <Text style={styles.itemMetaVal}>{money(rate)}</Text>
                        </View>
                        <View style={[styles.itemMeta, styles.itemMetaLast]}>
                          <Text style={styles.itemMetaLab}>Total</Text>
                          <Text style={styles.itemMetaTotal}>{money(amt)}</Text>
                        </View>
                      </View>
                      {nested.length > 0
                        ? nested.map((inc, n) => (
                            <View key={`${idx}-inc-${n}`} style={styles.includedRow}>
                              <Text style={styles.includedTxt} numberOfLines={3}>
                                {inc?.name || 'Included'} · Qty {num(inc?.quantity) || 1}
                              </Text>
                              <Text style={styles.includedAmt}>
                                {money(num(inc?.amount) || num(inc?.unit_price) * (num(inc?.quantity) || 1))}
                              </Text>
                            </View>
                          ))
                        : null}
                    </View>
                  );
                })}
              </View>
            ))}

            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLab}>Sub-Total</Text>
                <Text style={styles.totalVal}>{money(subTotal)}</Text>
              </View>
              {discount > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLab}>Discount</Text>
                  <Text style={[styles.totalVal, { color: '#DC2626' }]}>-{money(discount)}</Text>
                </View>
              ) : null}
              {showGst && num(invoice.cgst_amount) > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLab}>CGST</Text>
                  <Text style={styles.totalVal}>{money(num(invoice.cgst_amount))}</Text>
                </View>
              ) : null}
              {showGst && num(invoice.sgst_amount) > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLab}>SGST</Text>
                  <Text style={styles.totalVal}>{money(num(invoice.sgst_amount))}</Text>
                </View>
              ) : null}
              {showGst && num(invoice.igst_amount) > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLab}>IGST</Text>
                  <Text style={styles.totalVal}>{money(num(invoice.igst_amount))}</Text>
                </View>
              ) : null}
              <View style={[styles.totalRow, styles.grandRow]}>
                <Text style={styles.grandLab}>{isOS ? 'Gross Total' : 'Total to Pay'}</Text>
                <Text style={styles.grandVal}>{money(payable)}</Text>
              </View>
              {invoice.amount_in_words ? (
                <Text style={styles.words}>{invoice.amount_in_words}</Text>
              ) : null}
              <View style={styles.totalRow}>
                <Text style={styles.totalLab}>Paid</Text>
                <Text style={styles.totalVal}>{money(paidAmt)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLab}>Balance due</Text>
                <Text style={[styles.totalVal, { color: balanceDue > 0 ? '#B45309' : '#166534' }]}>
                  {money(balanceDue)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {isCI && showPay ? (
          <View style={AC.whiteCard}>
            <Text style={styles.sectionTitle}>Record offline payment</Text>
            <Text style={styles.payHint}>Paying {money(balanceDue)}</Text>
            <Text style={styles.label}>Staff name</Text>
            <TextInput style={styles.input} value={staffName} onChangeText={setStaffName} />
            <Text style={styles.label}>Remarks</Text>
            <TextInput style={styles.input} value={remarks} onChangeText={setRemarks} />
            <View style={styles.modeRow}>
              {(['CASH', 'UPI', 'POS', 'CARD'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.modeChip, payMode === mode && styles.modeChipOn]}
                  onPress={() => setPayMode(mode)}
                >
                  <Text style={[styles.modeTxt, payMode === mode && styles.modeTxtOn]}>{mode}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 14 }]} onPress={recordPayment} disabled={busy}>
              <Text style={styles.primaryTxt}>{busy ? 'Saving…' : `Save payment · ${money(balanceDue)}`}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      {invoice && !paid ? (
        <View style={styles.actionBar}>
          {isOS ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={finalizeBill} disabled={busy}>
              <Text style={styles.primaryTxt}>{busy ? 'Finalizing…' : 'Finalize Bill (Create CI)'}</Text>
            </TouchableOpacity>
          ) : null}
          {isCI && !invoice.visible_to_customer ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={activateForPayment} disabled={busy}>
              <Text style={styles.secondaryTxt}>{busy ? 'Activating…' : 'Activate for payment'}</Text>
            </TouchableOpacity>
          ) : null}
          {isCI ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowPay((v) => !v)} disabled={busy}>
              <Text style={styles.primaryTxt}>{showPay ? 'Hide payment form' : 'Record payment'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {paid || isTI ? (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('PickupDeliveryTracking')}>
            <Text style={styles.primaryTxt}>Open Pickup & Delivery</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  scroll: { paddingTop: 8, paddingBottom: 160 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabTxt: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary },
  tabTxtOn: { color: '#fff' },
  nextCard: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#BBF7D0' },
  nextEyebrow: { fontSize: 11, fontWeight: '800', color: '#166534', textTransform: 'uppercase' },
  nextTitle: { marginTop: 4, fontSize: 18, fontWeight: '800', color: COLORS.heading },
  nextBody: { marginTop: 4, fontSize: 13, lineHeight: 18, color: COLORS.textPrimary },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.heading },
  billHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  invNo: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  muted: { marginTop: 6, fontSize: 13, color: COLORS.textSecondary },
  error: { fontSize: 14, color: '#B91C1C', lineHeight: 20 },
  groupLabel: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
  },
  itemCard: {
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemName: { fontSize: 14, fontWeight: '800', color: COLORS.heading, lineHeight: 20 },
  itemMetaRow: { marginTop: 8, flexDirection: 'row', gap: 8 },
  itemMeta: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  itemMetaLast: { backgroundColor: '#EFF6FF' },
  itemMetaLab: { fontSize: 10, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase' },
  itemMetaVal: { marginTop: 2, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  itemMetaTotal: { marginTop: 2, fontSize: 13, fontWeight: '800', color: COLORS.primary },
  includedRow: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  includedTxt: { flex: 1, fontSize: 11, color: COLORS.textSecondary },
  includedAmt: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  totals: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalLab: { fontSize: 14, color: COLORS.textSecondary },
  totalVal: { fontSize: 14, fontWeight: '700', color: COLORS.heading },
  grandRow: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  grandLab: { fontSize: 16, fontWeight: '800', color: COLORS.heading },
  grandVal: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  words: { marginTop: 6, fontSize: 12, fontStyle: 'italic', color: COLORS.textSecondary },
  payHint: { marginTop: 4, marginBottom: 8, fontSize: 14, fontWeight: '800', color: COLORS.primary },
  label: { marginTop: 10, fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  input: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 4 },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
  },
  modeChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeTxt: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary },
  modeTxtOn: { color: '#fff' },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryTxt: { color: COLORS.primary, fontSize: 14, fontWeight: '800' },
});
