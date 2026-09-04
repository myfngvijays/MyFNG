import React, { useEffect, useState } from 'react';
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
  const [partRows, setPartRows] = useState<
    Array<{ name: string; qty: string; kind: 'PART' | 'LABOUR' }>
  >([]);
  const [jobQuery, setJobQuery] = useState('');
  const [jobHits, setJobHits] = useState<Array<{ id: string; name: string; category: string }>>([]);
  const [relatedParts, setRelatedParts] = useState<Array<{ name: string; kind: 'PART' | 'LABOUR' }>>([]);
  const [pickedRelated, setPickedRelated] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => {
      const q = jobQuery.trim() || description.trim();
      apiFetch<{
        jobs?: Array<{ id: string; name: string; category: string }>;
        related_parts?: Array<{ name: string; kind: 'PART' | 'LABOUR' }>;
        kit_title?: string;
      }>(`/api/mechanic/additional-job-kits?q=${encodeURIComponent(q)}&job=${encodeURIComponent(description.trim())}`)
        .then((json) => {
          setJobHits(Array.isArray(json.jobs) ? json.jobs : []);
          const rel = Array.isArray(json.related_parts) ? json.related_parts : [];
          setRelatedParts(rel);
          setPickedRelated((prev) => {
            const sameSet =
              rel.length > 0 &&
              rel.every((p) => Object.prototype.hasOwnProperty.call(prev, p.name)) &&
              Object.keys(prev).length === rel.length;
            const next: Record<string, boolean> = {};
            rel.forEach((p) => {
              next[p.name] = sameSet ? Boolean(prev[p.name]) : true;
            });
            return next;
          });
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [jobQuery, description]);

  const handleCategoryChange = (value: string | number) => {
    const next = String(value);
    setCategory(next);
    if (next !== 'OTHER') setOtherCategory('');
  };

  const handleSubmit = async () => {
    const fromKit = relatedParts
      .filter((p) => pickedRelated[p.name])
      .map((p) => ({ name: p.name, qty: 1, unit_price: 0, amount: 0, kind: p.kind }));
    const extraLines = partRows
      .map((row) => {
        const name = row.name.trim();
        if (!name) return null;
        const qty = Math.max(0.01, Number(row.qty) || 1);
        return { name, qty, unit_price: 0, amount: 0, kind: row.kind };
      })
      .filter(Boolean);
    const parts_breakdown = [...fromKit, ...extraLines];

    if (!description.trim() || !reason.trim()) {
      Alert.alert('Required', 'Please fill description and reason');
      return;
    }

    if (category === 'OTHER' && !otherCategory.trim()) {
      Alert.alert('Required', 'Please type the other category');
      return;
    }

    const cost = estimatedCost.trim() ? Number(estimatedCost) : 0;
    if (estimatedCost.trim() && (Number.isNaN(cost) || cost < 0)) {
      Alert.alert('Invalid cost', 'Please enter a valid estimated cost');
      return;
    }
    if (cost <= 0 && parts_breakdown.length === 0) {
      Alert.alert('Required', 'Parts list daalo (pricing optional) ya estimated cost.');
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
          parts_breakdown,
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
            Job select karo (jaise Clutch). Related parts tick karo, advisor prices check karke customer approval bhejega. Customer OK ke baad additional kaam start.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>
              Additional job <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={jobQuery}
              onChangeText={setJobQuery}
              placeholder="Search e.g. Clutch, Brake, AC"
              placeholderTextColor={COLORS.gray[400]}
            />
            {jobHits.length > 0 ? (
              <View style={styles.hitList}>
                {jobHits.slice(0, 8).map((hit) => (
                  <TouchableOpacity
                    key={hit.id}
                    style={[styles.hitRow, description === hit.name && styles.hitRowOn]}
                    onPress={() => {
                      setDescription(hit.name);
                      setJobQuery(hit.name);
                      setPickedRelated({});
                    }}
                  >
                    <Text style={styles.hitName}>{hit.name}</Text>
                    {hit.category ? <Text style={styles.hitCat}>{hit.category}</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Or type job name (e.g. Clutch Replace)"
              placeholderTextColor={COLORS.gray[400]}
              multiline
            />

            {relatedParts.length > 0 ? (
              <>
                <Text style={styles.label}>Related parts / labour — select what is needed</Text>
                <Text style={styles.partHint}>Prices advisor bharega. Customer approval ke baad kaam start.</Text>
                {relatedParts.map((p) => {
                  const on = Boolean(pickedRelated[p.name]);
                  return (
                    <TouchableOpacity
                      key={p.name}
                      style={styles.checkRow}
                      onPress={() => setPickedRelated((prev) => ({ ...prev, [p.name]: !on }))}
                    >
                      <View style={[styles.checkBox, on && styles.checkBoxOn]}>
                        <Text style={styles.checkMark}>{on ? '✓' : ''}</Text>
                      </View>
                      <Text style={styles.checkLabel}>
                        {p.name} <Text style={styles.kindTag}>{p.kind}</Text>
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            ) : null}

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
              Estimated cost <Text style={styles.optional}>(optional — advisor prices)</Text>
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

            <Text style={styles.label}>Parts / labour used</Text>
            <Text style={styles.partHint}>Clutch jaise job pe har item alag line: name + qty. Rate advisor bharega.</Text>
            {partRows.map((row, i) => (
              <View key={`mech-part-${i}`} style={styles.partBlock}>
                <TextInput
                  style={styles.input}
                  value={row.name}
                  onChangeText={(txt) =>
                    setPartRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, name: txt } : r)))
                  }
                  placeholder="e.g. Flywheel / Clutch plate / Clutch wire"
                  placeholderTextColor={COLORS.gray[400]}
                />
                <View style={styles.partMeta}>
                  <TextInput
                    style={[styles.input, styles.qtyInput]}
                    value={row.qty}
                    onChangeText={(txt) =>
                      setPartRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, qty: txt } : r)))
                    }
                    placeholder="Qty"
                    placeholderTextColor={COLORS.gray[400]}
                    keyboardType="decimal-pad"
                  />
                  <TouchableOpacity
                    style={styles.kindBtn}
                    onPress={() =>
                      setPartRows((prev) =>
                        prev.map((r, idx) =>
                          idx === i ? { ...r, kind: r.kind === 'LABOUR' ? 'PART' : 'LABOUR' } : r,
                        ),
                      )
                    }
                  >
                    <Text style={styles.kindBtnTxt}>{row.kind}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => setPartRows((prev) => [...prev, { name: '', qty: '1', kind: 'PART' }])}
            >
              <Text style={styles.addPart}>+ Add part / labour line</Text>
            </TouchableOpacity>

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
  optional: { color: COLORS.textSecondary, fontWeight: '500' },
  partHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  partBlock: { marginBottom: 8 },
  partMeta: { flexDirection: 'row', gap: 8, marginTop: -8, marginBottom: 8 },
  qtyInput: { flex: 1, marginBottom: 0 },
  kindBtn: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  kindBtnTxt: { color: COLORS.white, fontWeight: '800', fontSize: 12 },
  addPart: { color: COLORS.primary, fontWeight: '800', fontSize: 13, marginBottom: 16 },
  hitList: {
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.md,
    marginBottom: 10,
    overflow: 'hidden',
  },
  hitRow: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  hitRowOn: { backgroundColor: '#EFF6FF' },
  hitName: { fontWeight: '700', color: COLORS.textHeading },
  hitCat: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: COLORS.primary },
  checkMark: { color: COLORS.white, fontWeight: '800', fontSize: 12 },
  checkLabel: { flex: 1, fontSize: 14, color: COLORS.textHeading, fontWeight: '600' },
  kindTag: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '700' },
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
