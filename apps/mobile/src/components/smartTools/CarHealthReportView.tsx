import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, ToolCard } from '../smartTools/HealthCheckShell';
import { COLORS } from '../../constants/theme';
import {
  accuracyHint,
  CATEGORY_LABELS,
  CTA_LABELS,
  SCORE_COLORS,
  type Category,
  type HealthReport,
  type RcData,
} from '../../lib/vehicleHealthScore';

type Props = {
  report: HealthReport;
  rc: RcData;
  onCta: (ctaType: string, title: string, category?: Category | 'PREDICTIVE') => void;
  onRestart: () => void;
};

function bandColor(band: 'GREEN' | 'AMBER' | 'RED'): string {
  if (band === 'GREEN') return SCORE_COLORS.GREEN;
  if (band === 'AMBER') return SCORE_COLORS.AMBER;
  return SCORE_COLORS.RED;
}

export default function CarHealthReportView({ report, rc, onCta, onRestart }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const preventive = report.predictive.filter((p) => p.status === 'due_soon');
  const priorityRecs = report.recommendations.filter((r) => r.severity !== 'INFO' || r.category !== 'PREDICTIVE');
  const infoRecs = report.recommendations.filter((r) => r.severity === 'INFO');

  return (
    <>
      <View style={[styles.hero, { borderColor: report.band.color }]}>
        <View style={styles.heroGlow} />
        <Text style={styles.heroLabel}>Vehicle Risk Score</Text>
        <Text style={[styles.heroScore, { color: report.band.color }]}>{report.composite}</Text>
        <Text style={[styles.heroBand, { color: report.band.color }]}>{report.band.label}</Text>
        <Text style={styles.heroSummary}>{report.band.summary}</Text>
        <Text style={styles.vehicleLine}>
          {rc.make} {rc.model} · {rc.regNumber}
        </Text>
      </View>

      <ToolCard>
        <Text style={styles.sectionTitle}>Risk dimensions</Text>
        {report.dimensions.map((d) => (
          <View key={d.name} style={styles.dimRow}>
            <View style={styles.dimHeader}>
              <Text style={styles.dimLabel}>{d.label}</Text>
              <Text style={[styles.dimScore, { color: bandColor(d.band) }]}>{d.score}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${d.score}%`, backgroundColor: bandColor(d.band) }]} />
            </View>
          </View>
        ))}
      </ToolCard>

      <ToolCard>
        <Text style={styles.sectionTitle}>Category breakdown</Text>
        {report.categories.map((c) => {
          const open = expanded === c.category;
          return (
            <TouchableOpacity
              key={c.category}
              style={styles.catRow}
              onPress={() => setExpanded(open ? null : c.category)}
              activeOpacity={0.85}
            >
              <View style={[styles.catDot, { backgroundColor: bandColor(c.band) }]} />
              <View style={styles.catBody}>
                <View style={styles.catHeader}>
                  <Text style={styles.catName}>{CATEGORY_LABELS[c.category]}</Text>
                  <Text style={[styles.catScore, { color: bandColor(c.band) }]}>{c.score}</Text>
                </View>
                <Text style={styles.catReason}>{c.reason}</Text>
                {open && c.band !== 'GREEN' ? (
                  <Text style={styles.catHint}>Free pickup & drop on booking via MyFNG.</Text>
                ) : null}
              </View>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
            </TouchableOpacity>
          );
        })}
      </ToolCard>

      {priorityRecs.length > 0 ? (
        <ToolCard>
          <Text style={styles.sectionTitle}>Priority actions</Text>
          {priorityRecs.map((rec, i) => (
            <View key={`${rec.title}-${i}`} style={styles.recCard}>
              <View style={styles.recHeader}>
                <View style={[styles.sevBadge, { backgroundColor: rec.severity === 'RED' ? '#FEE2E2' : '#FEF3C7' }]}>
                  <Text style={[styles.sevText, { color: rec.severity === 'RED' ? SCORE_COLORS.RED : SCORE_COLORS.AMBER }]}>
                    {rec.severity}
                  </Text>
                </View>
                <Text style={styles.recTitle}>{rec.title}</Text>
              </View>
              <Text style={styles.recReason}>{rec.reason}</Text>
              <TouchableOpacity style={styles.recBtn} onPress={() => onCta(rec.ctaType, rec.title, rec.category)} activeOpacity={0.88}>
                <Text style={styles.recBtnText}>{CTA_LABELS[rec.ctaType] || 'Book Now'}</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
        </ToolCard>
      ) : null}

      {preventive.length > 0 ? (
        <ToolCard>
          <Text style={styles.sectionTitle}>Coming up - preventive</Text>
          <Text style={styles.preventiveNote}>Likely due based on age & km, not a detected fault.</Text>
          {preventive.map((p, i) => (
            <View key={`${p.item}-${i}`} style={styles.preventiveRow}>
              <Ionicons name="time-outline" size={16} color={COLORS.primary} />
              <View style={styles.preventiveText}>
                <Text style={styles.preventiveItem}>{p.item}</Text>
                <Text style={styles.preventiveStatus}>{p.status === 'overdue' ? 'Overdue' : 'Due soon'}</Text>
              </View>
            </View>
          ))}
        </ToolCard>
      ) : null}

      <ToolCard>
        <Text style={styles.sectionTitle}>Report accuracy</Text>
        <View style={styles.accuracyRow}>
          {(['BASIC', 'GOOD', 'DETAILED'] as const).map((lvl) => (
            <View key={lvl} style={[styles.accChip, report.accuracy === lvl ? styles.accChipActive : null]}>
              <Text style={[styles.accChipText, report.accuracy === lvl ? styles.accChipTextActive : null]}>{lvl}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.accHint}>{accuracyHint(report.accuracy)}</Text>
      </ToolCard>

      {infoRecs.length > 0 && priorityRecs.length === 0 ? (
        <ToolCard>
          {infoRecs.map((rec, i) => (
            <Text key={i} style={styles.okLine}>
              ✓ {rec.reason}
            </Text>
          ))}
        </ToolCard>
      ) : null}

      <View style={styles.footerActions}>
        <PrimaryButton label="Book Free Inspection" icon="car" onPress={() => onCta('BOOK_INSPECTION', 'Free Inspection')} />
        <Text style={styles.footerHint}>Free pickup & drop on booking via MyFNG</Text>
        <TouchableOpacity style={styles.linkBtn} onPress={onRestart}>
          <Text style={styles.linkText}>Run Check Again</Text>
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
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  heroLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  heroScore: { fontSize: 56, fontWeight: '900', marginVertical: 4 },
  heroBand: { fontSize: 18, fontWeight: '900' },
  heroSummary: { marginTop: 10, fontSize: 13, fontWeight: '600', color: '#CBD5E1', textAlign: 'center', lineHeight: 20 },
  vehicleLine: { marginTop: 12, fontSize: 11, fontWeight: '700', color: '#93C5FD' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  dimRow: { marginBottom: 12 },
  dimHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dimLabel: { fontSize: 13, fontWeight: '700', color: '#334155' },
  dimScore: { fontSize: 13, fontWeight: '900' },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  catRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  catDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  catBody: { flex: 1 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  catName: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  catScore: { fontSize: 13, fontWeight: '900' },
  catReason: { marginTop: 4, fontSize: 12, fontWeight: '600', color: '#64748B', lineHeight: 18 },
  catHint: { marginTop: 6, fontSize: 11, fontWeight: '600', color: COLORS.primary },
  recCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  recHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  sevText: { fontSize: 10, fontWeight: '900' },
  recTitle: { flex: 1, fontSize: 14, fontWeight: '900', color: '#0F172A' },
  recReason: { fontSize: 12, fontWeight: '600', color: '#64748B', lineHeight: 18, marginBottom: 10 },
  recBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 11,
    minHeight: 42,
  },
  recBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  preventiveNote: { fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 10, lineHeight: 16 },
  preventiveRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
  preventiveText: { flex: 1 },
  preventiveItem: { fontSize: 13, fontWeight: '700', color: '#334155' },
  preventiveStatus: { fontSize: 11, fontWeight: '600', color: '#0088E8', marginTop: 2 },
  accuracyRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  accChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  accChipActive: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: COLORS.primary },
  accChipText: { fontSize: 11, fontWeight: '800', color: '#9CA3AF' },
  accChipTextActive: { color: COLORS.primary },
  accHint: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  okLine: { fontSize: 13, fontWeight: '600', color: SCORE_COLORS.GREEN, lineHeight: 20, marginBottom: 6 },
  footerActions: { marginTop: 4, gap: 10 },
  footerHint: { fontSize: 11, fontWeight: '600', color: '#64748B', textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
});
