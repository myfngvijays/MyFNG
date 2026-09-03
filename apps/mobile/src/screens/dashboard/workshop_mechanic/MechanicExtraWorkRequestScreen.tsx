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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { apiFetch } from '../../../lib/api';
import CustomPicker from '../../../components/CustomPicker';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../../constants/theme';

const CATEGORIES = [
  { value: 'PARTS_REPLACEMENT', label: 'Parts Replacement' },
  { value: 'ADDITIONAL_SERVICE', label: 'Additional Service' },
  { value: 'URGENT_REPAIR', label: 'Urgent Repair' },
  { value: 'EXTENDED_WORK', label: 'Extended Work' },
  { value: 'OTHER', label: 'Other' },
];

export default function MechanicExtraWorkRequestScreen({ hideChrome = false }: { hideChrome?: boolean }) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { leadId } = route.params as { leadId: string };

  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [category, setCategory] = useState('PARTS_REPLACEMENT');
  const [otherCategory, setOtherCategory] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCategoryChange = (value: string | number) => {
    const next = String(value);
    setCategory(next);
    if (next !== 'OTHER') setOtherCategory('');
  };

  const handleSubmit = async () => {
    if (!description.trim() || !reason.trim() || !estimatedCost.trim()) {
      Alert.alert('Required', 'Please fill description, reason, and estimated cost');
      return;
    }

    if (category === 'OTHER' && !otherCategory.trim()) {
      Alert.alert('Required', 'Please type the other category');
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
          other_category: category === 'OTHER' ? otherCategory.trim() : undefined,
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
    <SafeAreaView style={styles.container} edges={hideChrome ? [] : ['top']}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.inPageBack}
        activeOpacity={0.7}
      >
        <Text style={styles.backButton}>← Back to job</Text>
      </TouchableOpacity>
      {!hideChrome ? (
        <View style={styles.header}>
          <Text style={styles.title}>Additional Job Request</Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={hideChrome ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.hint}>
            Request extra work for advisor approval. Job stays on hold until this is approved or rejected.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>
              Description <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the additional work required..."
              placeholderTextColor={COLORS.gray[400]}
              multiline
            />

            <Text style={styles.label}>
              Reason <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={reason}
              onChangeText={setReason}
              placeholder="Why is this work necessary?"
              placeholderTextColor={COLORS.gray[400]}
              multiline
            />

            <Text style={styles.label}>
              Estimated cost <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.costRow}>
              <Text style={styles.costPrefix}>₹</Text>
              <TextInput
                style={styles.costInput}
                value={estimatedCost}
                onChangeText={setEstimatedCost}
                placeholder="e.g. 1500"
                placeholderTextColor={COLORS.gray[400]}
                keyboardType="decimal-pad"
              />
            </View>

            <Text style={styles.label}>Category</Text>
            <CustomPicker
              selectedValue={category}
              onValueChange={handleCategoryChange}
              items={CATEGORIES}
              placeholder="Select category"
              style={styles.picker}
            />

            {category === 'OTHER' ? (
              <>
                <Text style={styles.label}>
                  Specify other category <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={otherCategory}
                  onChangeText={setOtherCategory}
                  placeholder="e.g. Wheel alignment, AC gas refill"
                  placeholderTextColor={COLORS.gray[400]}
                  autoFocus
                />
              </>
            ) : null}

            <View style={styles.urgentRow}>
              <View style={styles.urgentCopy}>
                <Text style={styles.urgentTitle}>Mark as urgent</Text>
                <Text style={styles.urgentSub}>Needs immediate advisor approval</Text>
              </View>
              <Switch
                value={isUrgent}
                onValueChange={setIsUrgent}
                trackColor={{ false: COLORS.gray[300], true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, saving && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>{saving ? 'Submitting...' : 'Submit request'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  inPageBack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: 10,
    paddingBottom: 6,
  },
  backButton: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '700',
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginTop: 6,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  hint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: 6,
  },
  required: { color: COLORS.danger },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: COLORS.gray[50],
    marginBottom: 16,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[50],
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  costPrefix: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 8,
  },
  costInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  picker: {
    marginBottom: 16,
    backgroundColor: COLORS.gray[50],
  },
  urgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 4,
  },
  urgentCopy: { flex: 1 },
  urgentTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  urgentSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  footer: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  submitDisabled: { backgroundColor: COLORS.gray[300] },
  submitText: { color: COLORS.white, fontWeight: '800', fontSize: FONT_SIZES.md },
});
