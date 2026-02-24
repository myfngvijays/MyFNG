import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRoute } from '@react-navigation/native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

const DISPOSITIONS = [
  'CUSTOMER_NOT_INTERESTED',
  'WRONG_NUMBER',
  'DUPLICATE_LEAD',
  'ALREADY_SERVICED_ELSEWHERE',
  'QUALIFIED',
];
const CALL_STATUSES = ['ANSWERED', 'NO_ANSWER', 'BUSY', 'SWITCHED_OFF', 'WRONG_NUMBER'];

export default function TelecallerEnquiryLeadDetailScreen({ navigation }: any) {
  const route = useRoute<any>();
  const leadId = route?.params?.leadId as string;

  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<any>(null);
  const [noteText, setNoteText] = useState('');
  const [callStatus, setCallStatus] = useState('ANSWERED');
  const [callDuration, setCallDuration] = useState('');
  const [callSummary, setCallSummary] = useState('');
  const [callFollowUpAt, setCallFollowUpAt] = useState('');
  const [disposition, setDisposition] = useState('QUALIFIED');
  const [dispositionNote, setDispositionNote] = useState('');
  const [dispositionFollowUpAt, setDispositionFollowUpAt] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCallFollowUpPicker, setShowCallFollowUpPicker] = useState(false);
  const [showDispositionFollowUpPicker, setShowDispositionFollowUpPicker] = useState(false);

  useEffect(() => {
    if (leadId) fetchLead();
  }, [leadId]);

  useEffect(() => {
    if (lead?.meta?.coupon?.code) {
      setCouponCode(lead.meta.coupon.code);
    }
  }, [lead]);

  async function fetchLead() {
    setLoading(true);
    try {
      const data = await apiFetch<{ lead: any }>(`/api/telecaller/enquiry-leads/${leadId}`);
      setLead(data.lead || null);
    } catch (e) {
      console.error('Failed to load lead', e);
    } finally {
      setLoading(false);
    }
  }

  const history = useMemo(() => {
    const list = Array.isArray(lead?.history) ? lead.history : [];
    return [...list].reverse();
  }, [lead]);

  async function addNote() {
    if (!noteText.trim()) return;
    await apiFetch(`/api/telecaller/enquiry-leads/${leadId}/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: noteText.trim() }),
    });
    setNoteText('');
    await fetchLead();
  }

  async function logCall() {
    const payload: any = {
      call_status: callStatus,
      call_duration: callDuration ? Number(callDuration) : null,
      summary: callSummary || null,
      next_follow_up_at: callFollowUpAt ? new Date(callFollowUpAt).toISOString() : null,
    };
    await apiFetch(`/api/telecaller/enquiry-leads/${leadId}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setCallDuration('');
    setCallSummary('');
    setCallFollowUpAt('');
    await fetchLead();
  }

  async function submitDisposition() {
    const payload: any = {
      disposition,
      note: dispositionNote || null,
      next_follow_up_at: dispositionFollowUpAt ? new Date(dispositionFollowUpAt).toISOString() : null,
    };
    await apiFetch(`/api/telecaller/enquiry-leads/${leadId}/disposition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setDispositionNote('');
    setDispositionFollowUpAt('');
    await fetchLead();
  }

  async function saveCoupon(code: string) {
    setSaving(true);
    try {
      await apiFetch(`/api/telecaller/enquiry-leads/${leadId}/coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      await fetchLead();
    } catch (e) {
      console.error('Failed to update coupon', e);
    } finally {
      setSaving(false);
    }
  }

  const handleBack = () => {
    if (typeof navigation?.canGoBack === 'function' && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (typeof navigation?.goBack === 'function') {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.('TelecallerEnquiryLeads');
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.container}>
        <DashboardHeader title="Enquiry Lead" onBack={handleBack} />
        <View style={styles.body}>
          <Text style={styles.emptyText}>Lead not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Enquiry Lead" onBack={handleBack} />
      <ScrollView style={styles.body}>
        <Text style={styles.title}>{lead.lead_number || 'Lead'}</Text>
        <Text style={styles.meta}>{lead.customer_name || 'Customer'} • {lead.customer_phone || ''}</Text>
        <Text style={styles.meta}>Status: {lead.lead_status}</Text>

        <Text style={styles.sectionTitle}>Add Note</Text>
        <TextInput style={styles.input} value={noteText} onChangeText={setNoteText} placeholder="Note" />
        <TouchableOpacity style={styles.primaryBtn} onPress={addNote}>
          <Text style={styles.primaryText}>Save Note</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Log Call</Text>
        <View style={styles.chipRow}>
          {CALL_STATUSES.map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.chip, callStatus === status && styles.chipActive]}
              onPress={() => setCallStatus(status)}
            >
              <Text style={[styles.chipText, callStatus === status && styles.chipTextActive]}>
                {status.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={styles.input} value={callDuration} onChangeText={setCallDuration} placeholder="Duration (sec)" keyboardType="numeric" />
        <TextInput style={styles.input} value={callSummary} onChangeText={setCallSummary} placeholder="Summary" />
        <TouchableOpacity style={styles.datetimeButton} onPress={() => setShowCallFollowUpPicker(true)}>
          <Text style={styles.datetimeButtonText}>
            {callFollowUpAt ? new Date(callFollowUpAt).toLocaleString() : 'Select follow-up time'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={logCall}>
          <Text style={styles.primaryText}>Log Call</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Disposition</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {DISPOSITIONS.map((d) => (
            <TouchableOpacity key={d} style={styles.chip} onPress={() => setDisposition(d)}>
              <Text style={styles.chipText}>{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TextInput style={styles.input} value={dispositionNote} onChangeText={setDispositionNote} placeholder="Note" />
        <TouchableOpacity style={styles.datetimeButton} onPress={() => setShowDispositionFollowUpPicker(true)}>
          <Text style={styles.datetimeButtonText}>
            {dispositionFollowUpAt ? new Date(dispositionFollowUpAt).toLocaleString() : 'Select follow-up time'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={submitDisposition}>
          <Text style={styles.primaryText}>Submit Disposition</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Coupon</Text>
        <TextInput
          style={styles.input}
          value={couponCode}
          onChangeText={(value) => setCouponCode(value.toUpperCase())}
          placeholder="Coupon Code"
        />
        {lead?.meta?.coupon?.code && (
          <View style={styles.couponBanner}>
            <Text style={styles.couponTitle}>Applied: {lead.meta.coupon.code}</Text>
            <Text style={styles.couponText}>
              Discount: ₹{Number(lead?.meta?.coupon?.discount_amount || 0).toFixed(0)}
            </Text>
          </View>
        )}
        <View style={styles.row}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => saveCoupon(couponCode)} disabled={saving}>
            <Text style={styles.primaryText}>Save Coupon</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => saveCoupon('')} disabled={saving}>
            <Text style={styles.secondaryText}>Remove</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>History</Text>
        {history.map((h: any, idx: number) => (
          <View key={`h-${idx}`} style={styles.card}>
            <Text style={styles.cardTitle}>{h.type || 'Event'}</Text>
            <Text style={styles.cardMeta}>{h.at ? new Date(h.at).toLocaleString() : ''}</Text>
            {h.summary && <Text style={styles.cardMeta}>Summary: {h.summary}</Text>}
            {h.text && <Text style={styles.cardMeta}>Text: {h.text}</Text>}
            {h.note && <Text style={styles.cardMeta}>Note: {h.note}</Text>}
            {h.status && <Text style={styles.cardMeta}>Status: {h.status}</Text>}
            {h.disposition && <Text style={styles.cardMeta}>Disposition: {h.disposition}</Text>}
          </View>
        ))}
      </ScrollView>

      {showCallFollowUpPicker && (
        <DateTimePicker
          value={callFollowUpAt ? new Date(callFollowUpAt) : new Date()}
          mode="datetime"
          display="default"
          onChange={(_event, selectedDate) => {
            setShowCallFollowUpPicker(false);
            if (selectedDate) setCallFollowUpAt(selectedDate.toISOString());
          }}
        />
      )}
      {showDispositionFollowUpPicker && (
        <DateTimePicker
          value={dispositionFollowUpAt ? new Date(dispositionFollowUpAt) : new Date()}
          mode="datetime"
          display="default"
          onChange={(_event, selectedDate) => {
            setShowDispositionFollowUpPicker(false);
            if (selectedDate) setDispositionFollowUpAt(selectedDate.toISOString());
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { padding: SPACING.md },
  title: { fontSize: SIZES.lg, fontWeight: '700', color: COLORS.textHeading },
  meta: { color: COLORS.textSecondary, marginTop: 4 },
  sectionTitle: { marginTop: SPACING.md, fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.xs },
  chip: { backgroundColor: COLORS.gray[100], paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: 12, marginRight: SPACING.xs, marginTop: SPACING.sm },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.text, fontSize: 12 },
  chipTextActive: { color: COLORS.white, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: SPACING.sm, marginTop: 4, backgroundColor: COLORS.white, color: COLORS.text },
  datetimeButton: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: SPACING.sm, marginTop: 4, backgroundColor: COLORS.white },
  datetimeButtonText: { color: COLORS.text },
  primaryBtn: { backgroundColor: COLORS.primary, padding: SPACING.sm, borderRadius: 8, marginTop: SPACING.sm, flex: 1 },
  primaryText: { color: COLORS.white, textAlign: 'center', fontWeight: '600' },
  secondaryBtn: { backgroundColor: COLORS.border, padding: SPACING.sm, borderRadius: 8, marginTop: SPACING.sm, flex: 1 },
  secondaryText: { color: COLORS.text, textAlign: 'center', fontWeight: '600' },
  row: { flexDirection: 'row', gap: SPACING.sm },
  card: { backgroundColor: COLORS.white, padding: SPACING.sm, borderRadius: 8, marginTop: SPACING.sm },
  cardTitle: { fontSize: SIZES.sm, fontWeight: '700', color: COLORS.textHeading },
  cardMeta: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
  couponBanner: { backgroundColor: COLORS.gray[100], padding: SPACING.sm, borderRadius: 8, marginTop: SPACING.sm },
  couponTitle: { fontSize: SIZES.sm, fontWeight: '700', color: COLORS.textHeading },
  couponText: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.sm, color: COLORS.textSecondary },
  emptyText: { color: COLORS.textSecondary },
});
