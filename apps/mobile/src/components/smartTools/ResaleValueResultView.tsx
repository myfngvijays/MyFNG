import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, ToolCard } from './HealthCheckShell';
import { COLORS } from '../../constants/theme';
import { formatModelLabel } from '../../lib/compareServicePricing';
import type { ResaleEstimate, ResaleFormInput } from '../../lib/resaleValueHelpers';
import { resaleTips } from '../../lib/resaleValueHelpers';
import { formatInr, formatInrRange } from '../../lib/smartToolsLogic';

type Props = {
  formInput: ResaleFormInput;
  estimate: ResaleEstimate;
  cityName: string;
  onBookInspection: () => void;
  onLoanAgainstCar: () => void;
  onRestart: () => void;
};

export default function ResaleValueResultView({
  formInput,
  estimate,
  cityName,
  onBookInspection,
  onLoanAgainstCar,
  onRestart,
}: Props) {
  const tips = resaleTips(formInput);

  return (
    <>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.heroLabel}>Estimated Resale Value</Text>
        <Text style={styles.heroRange}>{formatInrRange(estimate.low, estimate.high)}</Text>
        <Text style={styles.heroMid}>Mid estimate: {formatInr(estimate.mid)}</Text>
        <Text style={styles.heroMeta}>
          {formInput.make} {formatModelLabel(formInput.model)}
          {formInput.variant ? ` · ${formInput.variant}` : ''} · {formInput.regYear} · {formInput.km.toLocaleString('en-IN')} km
        </Text>
        <Text style={styles.heroCity}>{cityName}</Text>
      </View>

      <ToolCard>
        <Text style={styles.sectionTitle}>Valuation summary</Text>
        {[
          { label: 'Condition', value: formInput.condition },
          { label: 'Owners', value: String(formInput.owners) },
          { label: 'Fuel', value: formInput.fuel },
          { label: 'Transmission', value: formInput.transmission },
          { label: 'Tyres', value: formInput.tyreCondition },
          { label: 'Body & paint', value: formInput.bodyPaint },
          { label: 'Accident', value: formInput.hadAccident ? 'Yes' : 'No' },
          { label: 'Insurance', value: formInput.insuranceValid ? 'Valid' : 'Expired' },
          { label: 'Loan active', value: formInput.hypothecation ? 'Yes' : 'No' },
        ].map((row) => (
          <View key={row.label} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{row.label}</Text>
            <Text style={styles.summaryValue}>{row.value}</Text>
          </View>
        ))}
      </ToolCard>

      <ToolCard variant="soft">
        <Text style={styles.sectionTitle}>Tips to improve resale</Text>
        {tips.map((tip) => (
          <View key={tip} style={styles.tipRow}>
            <Ionicons name="bulb-outline" size={14} color={COLORS.primary} />
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </ToolCard>

      <ToolCard variant="soft">
        <Text style={styles.disclaimerTitle}>How we calculate</Text>
        <Text style={styles.disclaimerBody}>
          This range uses brand demand, age, mileage, condition, tyres, body work, ownership, accident history, insurance, service records, loan status and your city market tier. Final price may change after physical inspection.
        </Text>
      </ToolCard>

      <View style={styles.footerActions}>
        <PrimaryButton label="Book Free Inspection" icon="car-outline" onPress={onBookInspection} />
        <Text style={styles.footerHint}>Free pickup & drop on booking via MyFNG</Text>
        <TouchableOpacity style={styles.loanBtn} onPress={onLoanAgainstCar} activeOpacity={0.9}>
          <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
          <Text style={styles.loanBtnText}>Loan Against Car</Text>
        </TouchableOpacity>
        <Text style={styles.loanHint}>Need funds instead of selling? Check eligibility in minutes.</Text>
        <TouchableOpacity style={styles.linkBtn} onPress={onRestart}>
          <Text style={styles.linkText}>Check Again</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: '#0B1F44',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  heroLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5, textTransform: 'uppercase' },
  heroRange: { marginTop: 8, fontSize: 28, fontWeight: '900', color: '#34D399', textAlign: 'center' },
  heroMid: { marginTop: 6, fontSize: 13, fontWeight: '700', color: '#A7F3D0' },
  heroMeta: { marginTop: 12, fontSize: 12, fontWeight: '600', color: '#CBD5E1', textAlign: 'center', lineHeight: 18 },
  heroCity: { marginTop: 6, fontSize: 12, fontWeight: '700', color: '#93C5FD' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  summaryValue: { fontSize: 12, fontWeight: '800', color: '#0F172A', textTransform: 'capitalize' },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  tipText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#475569', lineHeight: 18 },
  disclaimerTitle: { fontSize: 13, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
  disclaimerBody: { fontSize: 12, fontWeight: '600', color: '#64748B', lineHeight: 18 },
  footerActions: { marginTop: 4, gap: 10 },
  footerHint: { fontSize: 11, fontWeight: '600', color: '#64748B', textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },
  loanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 14,
    minHeight: 48,
  },
  loanBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  loanHint: { fontSize: 11, fontWeight: '600', color: '#64748B', textAlign: 'center', lineHeight: 16, paddingHorizontal: 8, marginTop: -4 },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
});
