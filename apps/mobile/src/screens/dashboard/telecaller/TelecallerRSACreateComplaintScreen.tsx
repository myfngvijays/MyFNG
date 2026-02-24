import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';
import { apiFetch } from '../../../lib/api';

export default function TelecallerRSACreateComplaintScreen({ navigation, route }: any) {
  const complaintId = route?.params?.complaintId;
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    contact_number: '',
    alternate_number: '',
    vehicle_number: '',
    vehicle_model: '',
    vehicle_details: '',
    source: '',
    location_link: '',
    drop_location: '',
    service_type: '',
    customer_quoted_amount: '',
    advance_payment: '',
    problem: '',
  });

  const setField = (key: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
  };

  const submit = async () => {
    if (!form.customer_name || !form.contact_number) return;
    setSaving(true);
    try {
      let id = complaintId;
      if (complaintId) {
        await apiFetch(`/api/telecaller/rsa-complaints/${encodeURIComponent(String(complaintId))}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: form.customer_name,
            contact_number: form.contact_number,
            alternate_number: form.alternate_number,
            vehicle_number: form.vehicle_number,
            vehicle_model: form.vehicle_model,
            vehicle_details: form.vehicle_details,
            source: form.source,
            location_link: form.location_link,
            drop_location: form.drop_location,
            service_type: form.service_type,
            customer_quoted_amount: form.customer_quoted_amount,
            advance_payment: form.advance_payment,
            problem: form.problem,
            description: form.problem,
          }),
        });
      } else {
        const body = new FormData();
        body.append('customer_name', form.customer_name);
        body.append('contact_number', form.contact_number);
        body.append('alternate_number', form.alternate_number);
        body.append('vehicle_number', form.vehicle_number);
        body.append('vehicle_model', form.vehicle_model);
        body.append('vehicle_details', form.vehicle_details);
        body.append('source', form.source);
        body.append('location_link', form.location_link);
        body.append('drop_location', form.drop_location);
        body.append('service_type', form.service_type);
        body.append('customer_quoted_amount', form.customer_quoted_amount);
        body.append('advance_payment', form.advance_payment);
        body.append('problem', form.problem);

        const res = await apiFetch<any>('/api/telecaller/rsa-complaints', {
          method: 'POST',
          body,
        });
        id = res?.complaint?.id || res?.id;
      }

      if (id) navigation.navigate('TelecallerRSAComplaintDetail', { complaintId: id });
      else navigation.goBack?.();
    } catch (e) {
      console.error('create telecaller rsa complaint failed', e);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const loadExisting = async () => {
      if (!complaintId) return;
      setLoadingExisting(true);
      try {
        const data = await apiFetch<any>(`/api/telecaller/rsa-complaints/${encodeURIComponent(String(complaintId))}`);
        const lead = data?.lead || data?.complaint || null;
        if (!lead) return;
        setForm((p) => ({
          ...p,
          customer_name: String(lead.customer_name || ''),
          contact_number: String(lead.contact_number || ''),
          alternate_number: String(lead.alternate_number || ''),
          vehicle_number: String(lead.vehicle_number || ''),
          vehicle_model: String(lead.vehicle_model || ''),
          vehicle_details: String(lead.vehicle_details || ''),
          source: String(lead.source || ''),
          location_link: String(lead.location_link || ''),
          drop_location: String(lead.drop_location || ''),
          service_type: String(lead.service_type || ''),
          customer_quoted_amount: lead.customer_quoted_amount != null ? String(lead.customer_quoted_amount) : '',
          advance_payment: String(lead.advance_payment || ''),
          problem: String(lead.problem || lead.description || ''),
        }));
      } catch (e) {
        console.error('load existing complaint failed', e);
      } finally {
        setLoadingExisting(false);
      }
    };
    loadExisting();
  }, [complaintId]);

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
      <DashboardHeader title="Create RSA Complaint" onBack={handleBack} />
      <ScrollView contentContainerStyle={styles.content}>
        {loadingExisting ? <ActivityIndicator color={COLORS.primary} /> : null}
        <Field label="Customer Name *" value={form.customer_name} onChangeText={(v) => setField('customer_name', v)} />
        <Field label="Contact Number *" value={form.contact_number} keyboardType="phone-pad" onChangeText={(v) => setField('contact_number', v)} />
        <Field label="Alternate Number" value={form.alternate_number} keyboardType="phone-pad" onChangeText={(v) => setField('alternate_number', v)} />
        <Field label="Vehicle Number" value={form.vehicle_number} onChangeText={(v) => setField('vehicle_number', v.toUpperCase())} />
        <Field label="Vehicle Model" value={form.vehicle_model} onChangeText={(v) => setField('vehicle_model', v)} />
        <Field label="Vehicle Details" value={form.vehicle_details} onChangeText={(v) => setField('vehicle_details', v)} />
        <Field label="Source" value={form.source} onChangeText={(v) => setField('source', v)} />
        <Field label="Location Link" value={form.location_link} onChangeText={(v) => setField('location_link', v)} />
        <Field label="Drop Location" value={form.drop_location} onChangeText={(v) => setField('drop_location', v)} />
        <Field label="Service Type" value={form.service_type} onChangeText={(v) => setField('service_type', v)} />
        <Field label="Customer Quoted Amount" value={form.customer_quoted_amount} keyboardType="numeric" onChangeText={(v) => setField('customer_quoted_amount', v)} />
        <Field label="Advance Payment" value={form.advance_payment} keyboardType="numeric" onChangeText={(v) => setField('advance_payment', v)} />
        <Field label="Problem" value={form.problem} onChangeText={(v) => setField('problem', v)} multiline />

        <TouchableOpacity style={styles.submit} onPress={submit} disabled={saving}>
          {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitText}>{complaintId ? 'Update Complaint' : 'Create Complaint'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'numeric';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
  field: { gap: 6 },
  label: { fontSize: SIZES.sm, color: COLORS.textHeading, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.white, padding: SPACING.sm },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  submit: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.sm },
  submitText: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.sm },
});
