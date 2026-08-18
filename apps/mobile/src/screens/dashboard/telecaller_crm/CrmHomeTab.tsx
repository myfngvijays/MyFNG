import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../../lib/api';
import SimpleBarChart from '../../../components/telecaller/SimpleBarChart';
import TelecallerAanshBar from '../../../components/telecaller/TelecallerAanshBar';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';
import {
  CRM_DATE_PRESETS,
  resolveCrmDateRange,
  type CrmDatePreset,
  istYmd,
} from '../../../lib/crmDateRange';

type Props = {
  onNavigate: (screen: string, params?: any) => void;
  onOpenWhatsApp: () => void;
  datePreset?: CrmDatePreset;
  customStart?: string;
  customEnd?: string;
  onDatePresetChange?: (v: CrmDatePreset) => void;
  onCustomStartChange?: (v: string) => void;
  onCustomEndChange?: (v: string) => void;
};

export default function CrmHomeTab({
  onNavigate,
  onOpenWhatsApp,
  datePreset: datePresetProp,
  customStart: customStartProp,
  customEnd: customEndProp,
  onDatePresetChange,
  onCustomStartChange,
  onCustomEndChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [datePresetLocal, setDatePresetLocal] = useState<CrmDatePreset>('last_7_days');
  const [customStartLocal, setCustomStartLocal] = useState(istYmd());
  const [customEndLocal, setCustomEndLocal] = useState(istYmd());
  const [dateOpen, setDateOpen] = useState(false);
  const [aanshActive, setAanshActive] = useState(false);

  const datePreset = datePresetProp ?? datePresetLocal;
  const customStart = customStartProp ?? customStartLocal;
  const customEnd = customEndProp ?? customEndLocal;
  const setDatePreset = onDatePresetChange || setDatePresetLocal;
  const setCustomStart = onCustomStartChange || setCustomStartLocal;
  const setCustomEnd = onCustomEndChange || setCustomEndLocal;

  const dateRange = resolveCrmDateRange(datePreset, customStart, customEnd);
  const dateLabel = CRM_DATE_PRESETS.find((p) => p.value === datePreset)?.label || dateRange.label;

  const load = useCallback(async () => {
    try {
      const range = resolveCrmDateRange(datePreset, customStart, customEnd);
      const params = new URLSearchParams();
      if (range.allTime) {
        params.set('all', '1');
      } else {
        params.set('from', range.start);
        params.set('to', range.end);
      }
      const res = await apiFetch<any>(`/api/telecaller/crm/dashboard?${params.toString()}`);
      setData(res);
    } catch (e) {
      console.error('CRM dashboard failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [datePreset, customStart, customEnd]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.muted}>Loading MyFNG CRM...</Text>
      </View>
    );
  }

  const kpis = data?.kpis || {};
  const trend = Array.isArray(data?.trend) ? data.trend : [];
  const punchedIn = Boolean(data?.attendance?.is_punched_in);
  const onFloor = punchedIn;

  const quickActions = [
    {
      label: 'Booking',
      icon: 'calendar' as const,
      color: COLORS.green,
      go: () => onNavigate('book', { mode: 'book' }),
    },
    {
      label: 'Add Lead',
      icon: 'person-add' as const,
      color: COLORS.primary,
      go: () => onNavigate('book', { mode: 'lead' }),
    },
    { label: 'Open Leads', icon: 'list' as const, color: COLORS.orange, go: () => onNavigate('queue') },
    {
      label: 'Reports',
      icon: 'bar-chart' as const,
      color: COLORS.textHeading,
      go: () => onNavigate('CrmReports'),
    },
    { label: 'WhatsApp', icon: 'logo-whatsapp' as const, color: '#25D366', go: onOpenWhatsApp },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.hello}>Advanced CRM</Text>
          <Text style={styles.name}>{data?.profile?.name || 'Telecaller'}</Text>
        </View>
        <TouchableOpacity
          style={styles.remindBtn}
          onPress={() => onNavigate('Notifications')}
          activeOpacity={0.85}
        >
          <Ionicons name="notifications-outline" size={18} color="#0369A1" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.remindBtn}
          onPress={() => onNavigate('TelecallerFollowUps')}
          activeOpacity={0.85}
        >
          <Ionicons name="alarm-outline" size={18} color="#0369A1" />
          {Number(kpis.followups_today || 0) > 0 ? (
            <View style={styles.remindBadge}>
              <Text style={styles.remindBadgeText}>{kpis.followups_today}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <View style={[styles.badge, onFloor ? styles.badgeOn : styles.badgeOff]}>
          <View style={[styles.dot, { backgroundColor: onFloor ? COLORS.green : COLORS.orange }]} />
          <Text style={styles.badgeText}>{onFloor ? 'On Floor' : 'Off Duty'}</Text>
        </View>
      </View>

      {/* Date filter (same as Leads) */}
      <View style={styles.dateDropdownWrap}>
        <TouchableOpacity
          style={styles.dateDropdownBtn}
          onPress={() => setDateOpen((v) => !v)}
          activeOpacity={0.85}
        >
          <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
          <Text style={styles.dateDropdownText} numberOfLines={1}>
            {datePreset === 'custom' ? dateRange.label : dateLabel}
          </Text>
          <Ionicons name={dateOpen ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
        {dateOpen ? (
          <View style={styles.dateMenu}>
            {CRM_DATE_PRESETS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[styles.dateItem, datePreset === p.value && styles.dateItemActive]}
                onPress={() => {
                  setDatePreset(p.value);
                  if (p.value !== 'custom') setDateOpen(false);
                }}
              >
                <Text style={[styles.dateItemText, datePreset === p.value && styles.dateItemTextActive]}>
                  {p.label}
                </Text>
                {datePreset === p.value ? (
                  <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                ) : null}
              </TouchableOpacity>
            ))}
            {datePreset === 'custom' ? (
              <View style={styles.customRow}>
                <TouchableOpacity
                  style={styles.customChip}
                  onPress={() => {
                    /* keep simple text entry via presets; custom dates from Leads advanced */
                    setCustomStart(istYmd());
                    setCustomEnd(istYmd());
                  }}
                >
                  <Text style={styles.customChipText}>
                    {customStart} → {customEnd}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={() => {
                    setDateOpen(false);
                    load();
                  }}
                >
                  <Text style={styles.applyBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <TelecallerAanshBar
        onSessionChange={(s) => setAanshActive(Boolean(s?.session_token))}
        onClaimed={() => {
          setRefreshing(true);
          load();
        }}
      />

      <View style={styles.kpiGrid}>
        {[
          { label: 'New', value: kpis.new_leads, color: '#475569', filter: 'new' },
          { label: 'Incomplete', value: kpis.incomplete, color: '#B45309', filter: 'incomplete' },
          { label: 'Interested', value: kpis.interested, color: '#C2410C', filter: 'interested' },
          { label: 'He will visit', value: kpis.will_visit, color: '#6D28D9', filter: 'will_visit' },
          { label: 'Follow-up', value: kpis.callbacks, color: '#0369A1', filter: 'callback' },
          {
            label: 'Booking confirmed',
            value: kpis.booking_confirmed ?? kpis.booked,
            color: '#047857',
            filter: 'booking_confirmed',
          },
          { label: 'In Service', value: kpis.in_service, color: '#1D4ED8', filter: 'in_service' },
          { label: 'Service Done', value: kpis.service_done, color: '#059669', filter: 'service_done' },
          { label: 'Lost', value: kpis.lost ?? kpis.rejected, color: '#B91C1C', filter: 'lost' },
        ].map((k) => (
          <TouchableOpacity
            key={k.label}
            style={styles.kpiCard}
            onPress={() => onNavigate('queue', { filter: k.filter })}
          >
            <Text style={[styles.kpiValue, { color: k.color }]}>{k.value ?? 0}</Text>
            <Text style={styles.kpiLabel}>{k.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.perfCard}>
        <Text style={styles.sectionTitle}>Calls in range</Text>
        <View style={styles.perfRow}>
          <View style={styles.perfItem}>
            <Text style={styles.perfValue}>{kpis.today_calls ?? 0}</Text>
            <Text style={styles.perfLabel}>Total</Text>
          </View>
          <View style={styles.perfItem}>
            <Text style={styles.perfValue}>{kpis.answered_calls ?? 0}</Text>
            <Text style={styles.perfLabel}>Answered</Text>
          </View>
          <View style={styles.perfItem}>
            <Text style={[styles.perfValue, { color: COLORS.green }]}>{kpis.answer_rate ?? 0}%</Text>
            <Text style={styles.perfLabel}>Answer Rate</Text>
          </View>
        </View>
      </View>

      <SimpleBarChart
        title="7-Day Call Trend"
        data={trend.map((t: any) => ({
          label: t.label || t.date?.slice(5) || '',
          value: Number(t.calls || 0),
          color: COLORS.primary,
        }))}
      />

      <View style={{ height: 12 }} />

      <SimpleBarChart
        title="7-Day Bookings Created"
        data={trend.map((t: any) => ({
          label: t.label || t.date?.slice(5) || '',
          value: Number(t.leads_created || 0),
          color: COLORS.green,
        }))}
      />

      <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        {quickActions.map((a) => (
          <TouchableOpacity key={a.label} style={styles.actionCard} onPress={a.go} activeOpacity={0.85}>
            <View style={[styles.actionIcon, { backgroundColor: a.color + '18' }]}>
              <Ionicons name={a.icon} size={22} color={a.color} />
            </View>
            <Text style={styles.actionText}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.md, paddingTop: 4, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  muted: { color: COLORS.textSecondary },
  hero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hello: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.textHeading, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeOn: { backgroundColor: COLORS.green + '18' },
  badgeOff: { backgroundColor: COLORS.orange + '18' },
  badgeText: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  dot: { width: 8, height: 8, borderRadius: 4 },
  remindBtn: {
    marginRight: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remindBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0369A1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  remindBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  dateDropdownWrap: { marginBottom: 10, zIndex: 5 },
  dateDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  dateDropdownText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  dateMenu: {
    marginTop: 6,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[100],
  },
  dateItemActive: { backgroundColor: COLORS.primary + '08' },
  dateItemText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  dateItemTextActive: { color: COLORS.primary },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  customChip: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  customChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  applyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 12 },
  kpiCard: {
    width: '31.5%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  kpiValue: { fontSize: 20, fontWeight: '800' },
  kpiLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontWeight: '600' },
  perfCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textHeading, marginBottom: 10 },
  perfRow: { flexDirection: 'row' },
  perfItem: { flex: 1, alignItems: 'center' },
  perfValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  perfLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    width: '47.5%',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
    ...SHADOWS.small,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
});
