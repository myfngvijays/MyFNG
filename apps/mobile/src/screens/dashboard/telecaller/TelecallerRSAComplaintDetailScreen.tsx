import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Linking } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';
import { apiFetch } from '../../../lib/api';

export default function TelecallerRSAComplaintDetailScreen({ navigation, route }: any) {
  const complaintId = route?.params?.complaintId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lead, setLead] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [cancelRemark, setCancelRemark] = useState('');

  const load = async () => {
    if (!complaintId) return;
    setLoading(true);
    try {
      const data = await apiFetch<any>(`/api/telecaller/rsa-complaints/${complaintId}`);
      setLead(data?.complaint || data?.lead || null);
      setTimeline(Array.isArray(data?.timeline) ? data.timeline : []);
      setPayments(Array.isArray(data?.payments) ? data.payments : []);
      const callsData = await apiFetch<any>(`/api/telecaller/rsa-complaints/${complaintId}/sarv-calls`);
      setCalls(Array.isArray(callsData?.calls) ? callsData.calls : []);
    } catch (e) {
      console.error('load complaint detail failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [complaintId]);

  const cancelComplaint = async () => {
    if (!cancelRemark.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/telecaller/rsa-complaints/${complaintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', cancel_remark: cancelRemark.trim() }),
      });
      setCancelRemark('');
      load();
    } catch (e) {
      console.error('cancel complaint failed', e);
    } finally {
      setSaving(false);
    }
  };

  const canEdit = !lead?.assigned_mechanic_id;
  const handleBack = () => {
    if (typeof navigation?.canGoBack === 'function' && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (typeof navigation?.goBack === 'function') {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.('TelecallerRSA');
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="RSA Complaint Detail" onBack={handleBack} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.title}>{lead?.customer_name || 'Customer'}</Text>
            <Text style={styles.subtle}>Phone: {lead?.contact_number || '—'}</Text>
            <Text style={styles.subtle}>Vehicle: {lead?.vehicle_number || '—'} {lead?.vehicle_model ? `(${lead.vehicle_model})` : ''}</Text>
            <Text style={styles.subtle}>Status: {lead?.lead_status || lead?.complaint_status || '—'}</Text>
            {lead?.location_link ? (
              <TouchableOpacity onPress={() => Linking.openURL(String(lead.location_link))}>
                <Text style={styles.link}>Open Location</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.row}>
            {canEdit ? (
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('TelecallerRSACreateComplaint', { complaintId })}>
                <Text style={styles.secondaryBtnText}>Edit</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.primaryBtn} onPress={load}>
              <Text style={styles.primaryBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Cancel Complaint</Text>
            <TextInput
              style={styles.input}
              placeholder="Cancel remark"
              value={cancelRemark}
              onChangeText={setCancelRemark}
            />
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelComplaint} disabled={saving}>
              <Text style={styles.cancelBtnText}>{saving ? 'Cancelling...' : 'Cancel Complaint'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            {timeline.length === 0 ? <Text style={styles.subtle}>No timeline entries.</Text> : null}
            {timeline.map((row: any, idx: number) => (
              <View key={idx} style={styles.listItem}>
                <Text style={styles.listTitle}>{row?.status || row?.event || 'Update'}</Text>
                <Text style={styles.subtle}>{row?.created_at || row?.at || ''}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payments</Text>
            {payments.length === 0 ? <Text style={styles.subtle}>No payments yet.</Text> : null}
            {payments.map((row: any, idx: number) => (
              <View key={idx} style={styles.listItem}>
                <Text style={styles.listTitle}>Amount: {row?.amount || row?.paid_amount || 0}</Text>
                <Text style={styles.subtle}>Status: {row?.status || '—'}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Linked SARV Calls</Text>
            {calls.length === 0 ? <Text style={styles.subtle}>No calls linked.</Text> : null}
            {calls.map((row: any, idx: number) => (
              <View key={idx} style={styles.listItem}>
                <Text style={styles.listTitle}>{row?.customer_phone || row?.from_number || 'Call'}</Text>
                <Text style={styles.subtle}>Disposition: {row?.disposition || '—'}</Text>
                {row?.recording_url ? (
                  <TouchableOpacity onPress={() => Linking.openURL(String(row.recording_url))}>
                    <Text style={styles.link}>Open Recording</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
  card: { backgroundColor: COLORS.white, borderRadius: 10, padding: SPACING.sm },
  title: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  subtle: { fontSize: SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  link: { marginTop: 6, color: COLORS.primary, fontSize: SIZES.xs, fontWeight: '600' },
  row: { flexDirection: 'row', gap: SPACING.sm },
  primaryBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
  primaryBtnText: { color: COLORS.white, fontSize: SIZES.sm, fontWeight: '700' },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
  secondaryBtnText: { color: COLORS.primary, fontSize: SIZES.sm, fontWeight: '700' },
  sectionTitle: { fontSize: SIZES.sm, fontWeight: '700', color: COLORS.textHeading, marginBottom: SPACING.xs },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.white, padding: SPACING.sm },
  cancelBtn: { marginTop: SPACING.sm, backgroundColor: COLORS.error, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
  cancelBtnText: { color: COLORS.white, fontSize: SIZES.sm, fontWeight: '700' },
  listItem: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.xs, marginTop: SPACING.xs },
  listTitle: { fontSize: SIZES.sm, color: COLORS.textHeading, fontWeight: '600' },
});
