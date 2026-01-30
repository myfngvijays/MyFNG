import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { apiFetch } from '../../../lib/api';

const CATEGORIES = [
  { value: 'PARTS_REPLACEMENT', label: 'Parts Replacement' },
  { value: 'ADDITIONAL_SERVICE', label: 'Additional Service' },
  { value: 'URGENT_REPAIR', label: 'Urgent Repair' },
  { value: 'EXTENDED_WORK', label: 'Extended Work' },
  { value: 'OTHER', label: 'Other' },
];

export default function MechanicExtraWorkRequestScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { leadId } = route.params as { leadId: string };

  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [category, setCategory] = useState('PARTS_REPLACEMENT');
  const [isUrgent, setIsUrgent] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim() || !reason.trim() || !estimatedCost.trim()) {
      Alert.alert('Required', 'Please fill all required fields');
      return;
    }

    const cost = Number(estimatedCost);
    if (Number.isNaN(cost) || cost <= 0) {
      Alert.alert('Invalid cost', 'Please enter a valid estimated cost');
      return;
    }

    try {
      setSaving(true);
      await apiFetch(`/api/mechanic/jobs/${leadId}/request-extra-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          reason: reason.trim(),
          estimated_cost: cost,
          category,
          is_urgent: isUrgent,
        }),
      });

      Alert.alert('Success', 'Extra work request submitted', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Additional Job Request</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the additional work required..."
          multiline
        />

        <Text style={styles.label}>Reason *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={reason}
          onChangeText={setReason}
          placeholder="Why is this work necessary?"
          multiline
        />

        <Text style={styles.label}>Estimated Cost (₹) *</Text>
        <TextInput
          style={styles.input}
          value={estimatedCost}
          onChangeText={setEstimatedCost}
          placeholder="0.00"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.optionRow}>
          {CATEGORIES.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.optionChip,
                category === item.value && styles.optionChipActive,
              ]}
              onPress={() => setCategory(item.value)}
            >
              <Text
                style={[
                  styles.optionText,
                  category === item.value && styles.optionTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.label}>Mark as urgent</Text>
          <Switch value={isUrgent} onValueChange={setIsUrgent} />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={saving}>
          <Text style={styles.submitText}>{saving ? 'Submitting...' : 'Submit Request'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  content: { padding: 16 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  optionChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  optionText: { fontSize: 12, color: '#111827', fontWeight: '600' },
  optionTextActive: { color: '#fff' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: '#f97316',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
