import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../../lib/api';
import { useNotifications } from '../../../context/NotificationContext';
import CarLoading from '../../../components/CarLoading';
import SimpleBarChart from '../../../components/telecaller/SimpleBarChart';
import TelecallerAanshBar from '../../../components/telecaller/TelecallerAanshBar';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';
import { clickToCallCustomer } from '../../../lib/clickToCall';
import {
  CRM_DATE_PRESETS,
  resolveCrmDateRange,
  type CrmDatePreset,
  istYmd,
} from '../../../lib/crmDateRange';
import {
  leadStatusKpiColors,
  statusAccentColor,
} from '../../../lib/telecaller/leadStatusColors';

function formatReminderClock(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatLeadAgo(iso?: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

type FreshLead = {
  id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  city?: string | null;
  created_at?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
};

type HomeReminder = {
  id: string;
  scheduled_time?: string | null;
  reason?: string | null;
  lead_id?: string | null;
  lead?: {
    id?: string;
    customer_name?: string | null;
    customer_phone?: string | null;
  } | null;
};

type Props = {
  onNavigate: (screen: string, params?: any) => void;
  onOpenWhatsApp: () => void;
  /** When true, hide notif/alarm (parent top bar already has them). */
  embedInShell?: boolean;
  datePreset?: CrmDatePreset;
  customStart?: string;
  customEnd?: string;
  onDatePresetChange?: (v: CrmDatePreset) => void;
  onCustomStartChange?: (v: string) => void;
  onCustomEndChange?: (v: string) => void;
  /** Poll latest Fresh leads only while Home is visible. */
  isActive?: boolean;
  onRemindersCount?: (count: number) => void;
};

export default function CrmHomeTab({
  onNavigate,
  onOpenWhatsApp,
  embedInShell = false,
  datePreset: datePresetProp,
  customStart: customStartProp,
  customEnd: customEndProp,
  onDatePresetChange,
  onCustomStartChange,
  onCustomEndChange,
  isActive = true,
  onRemindersCount,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [datePresetLocal, setDatePresetLocal] = useState<CrmDatePreset>('last_7_days');
  const [customStartLocal, setCustomStartLocal] = useState(istYmd());
  const [customEndLocal, setCustomEndLocal] = useState(istYmd());
  const [dateOpen, setDateOpen] = useState(false);
  const [aanshActive, setAanshActive] = useState(false);
  const { unreadCount } = useNotifications();

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
      onRemindersCount?.(Number(res?.kpis?.reminders_pending || 0));
    } catch (e) {
      console.error('CRM dashboard failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [datePreset, customStart, customEnd, onRemindersCount]);

  useEffect(() => {
    if (!isActive) return;
    void load();
    const id = setInterval(() => {
      void load();
    }, 20000);
    return () => clearInterval(id);
  }, [load, isActive]);

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <CarLoading size="compact" label="Loading MyFNG CRM..." />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Could not load CRM. Check your connection.</Text>
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            void load();
          }}
          style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10 }}
        >
          <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const kpis = data?.kpis || {};
  const trend = Array.isArray(data?.trend) ? data.trend : [];
  const freshLeads: FreshLead[] = Array.isArray(data?.fresh_leads) ? data.fresh_leads : [];
  const reminders: HomeReminder[] = Array.isArray(data?.upcoming_reminders)
    ? data.upcoming_reminders.slice(0, 3)
    : [];
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
    {
      label: 'Workshops',
      icon: 'map' as const,
      color: '#0EA5E9',
      go: () => onNavigate('workshops'),
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
          <Text style={styles.name}>{data?.profile?.name || 'Telecaller'}</Text>
        </View>
        {!embedInShell ? (
          <>
            <TouchableOpacity
              style={styles.remindBtn}
              onPress={() => onNavigate('Notifications')}
              activeOpacity={0.85}
            >
              <Ionicons name="notifications-outline" size={18} color="#0369A1" />
              {unreadCount > 0 ? (
                <View style={styles.remindBadge}>
                  <Text style={styles.remindBadgeText}>
                    {unreadCount > 99 ? '99+' : String(unreadCount)}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.remindBtn}
              onPress={() => onNavigate('TelecallerFollowUps')}
              activeOpacity={0.85}
            >
              <Ionicons name="alarm-outline" size={18} color="#0369A1" />
              {Number(kpis.reminders_pending || kpis.followups_today || 0) > 0 ? (
                <View style={styles.remindBadge}>
                  <Text style={styles.remindBadgeText}>
                    {kpis.reminders_pending || kpis.followups_today}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </>
        ) : null}
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
          { label: 'Fresh', value: kpis.new_leads || 0, statusKey: 'Fresh', filter: 'new' },
          {
            label: 'Interested',
            value: kpis.interested,
            statusKey: 'Interested',
            filter: 'interested',
          },
          {
            label: 'He will visit',
            value: kpis.will_visit,
            statusKey: 'He will visit',
            filter: 'will_visit',
          },
          {
            label: 'Follow-up',
            value: kpis.callbacks,
            statusKey: 'Follow-up',
            filter: 'callback',
          },
          {
            label: 'Booking confirmed',
            value: kpis.booking_confirmed ?? kpis.booked,
            statusKey: 'Booking confirmed',
            filter: 'booking_confirmed',
          },
          {
            label: 'In Service',
            value: kpis.in_service,
            statusKey: 'In Service',
            filter: 'in_service',
          },
          {
            label: 'Service Done',
            value: kpis.service_done,
            statusKey: 'Service Done',
            filter: 'service_done',
          },
          {
            label: 'Today due',
            value: kpis.followups_today,
            statusKey: 'Follow-up',
            filter: 'followups',
          },
          {
            label: 'Lost',
            value: kpis.lost ?? kpis.rejected,
            statusKey: 'Lost',
            filter: 'lost',
          },
        ].map((k) => {
          const tint = leadStatusKpiColors(k.statusKey);
          const accent = statusAccentColor(tint);
          return (
            <TouchableOpacity
              key={k.label}
              style={[
                styles.kpiCard,
                { backgroundColor: tint.cardBg, borderColor: tint.border, borderWidth: 1 },
              ]}
              onPress={() => {
                if (k.filter === 'followups') {
                  onNavigate('TelecallerFollowUps');
                  return;
                }
                onNavigate('queue', { filter: k.filter });
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.kpiValue, { color: accent }]}>{k.value ?? 0}</Text>
              <Text style={[styles.kpiLabel, { color: accent }]} numberOfLines={2}>
                {k.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.navyCard}>
        <View style={styles.navyHead}>
          <Text style={styles.navyTitle}>Fresh leads</Text>
          <TouchableOpacity onPress={() => onNavigate('queue', { filter: 'new' })} activeOpacity={0.8}>
            <Text style={styles.navyViewAll}>View all</Text>
          </TouchableOpacity>
        </View>
        {freshLeads.length === 0 ? (
          <Text style={styles.navyEmpty}>No fresh leads right now</Text>
        ) : (
          freshLeads.map((lead, idx) => {
            const vehicle = [lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ');
            const meta = [lead.city, vehicle].filter(Boolean).join(' · ');
            return (
              <View
                key={String(lead.id)}
                style={[styles.navyRow, idx === freshLeads.length - 1 && styles.navyRowLast]}
              >
                <TouchableOpacity
                  style={styles.navyBody}
                  onPress={() => onNavigate('TelecallerLeadDetail', { leadId: lead.id })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.navyName} numberOfLines={1}>
                    {String(lead.customer_name || 'Customer').trim()}
                  </Text>
                  <Text style={styles.navyMeta} numberOfLines={1}>
                    {lead.customer_phone || '—'}
                    {meta ? ` · ${meta}` : ''}
                  </Text>
                  <Text style={styles.navyAgo}>{formatLeadAgo(lead.created_at)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navyCall}
                  onPress={() =>
                    void clickToCallCustomer({
                      customerPhone: lead.customer_phone,
                      leadId: lead.id,
                    })
                  }
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="call" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.navyCard}>
        <View style={styles.navyHead}>
          <Text style={styles.navyTitle}>Upcoming reminders</Text>
          <TouchableOpacity onPress={() => onNavigate('TelecallerFollowUps')} activeOpacity={0.8}>
            <Text style={styles.navyViewAll}>View all</Text>
          </TouchableOpacity>
        </View>
        {reminders.length === 0 ? (
          <Text style={styles.navyEmpty}>No reminders today</Text>
        ) : (
          reminders.map((r, idx) => {
            const leadId = String(r.lead_id || r.lead?.id || '');
            const phone = r.lead?.customer_phone;
            const overdue = r.scheduled_time ? new Date(r.scheduled_time).getTime() < Date.now() : false;
            return (
              <View
                key={String(r.id)}
                style={[styles.navyRow, idx === reminders.length - 1 && styles.navyRowLast]}
              >
                <TouchableOpacity
                  style={styles.navyBody}
                  onPress={() => {
                    if (leadId) onNavigate('TelecallerLeadDetail', { leadId });
                    else onNavigate('TelecallerFollowUps');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.navyName} numberOfLines={1}>
                    {String(r.lead?.customer_name || 'Customer').trim()}
                  </Text>
                  <Text style={styles.navyMeta} numberOfLines={1}>
                    {r.reason || 'Follow-up'}
                    {phone ? ` · ${phone}` : ''}
                  </Text>
                  <Text style={[styles.navyAgo, overdue && { color: '#FECACA' }]}>
                    {overdue ? 'Overdue · ' : ''}
                    {formatReminderClock(r.scheduled_time)}
                  </Text>
                </TouchableOpacity>
                {phone ? (
                  <TouchableOpacity
                    style={styles.navyCall}
                    onPress={() =>
                      void clickToCallCustomer({
                        customerPhone: phone,
                        leadId: leadId || null,
                      })
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="call" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })
        )}
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
        layout="vertical"
        data={trend.map((t: any) => ({
          label: t.label || t.date?.slice(5) || '',
          value: Number(t.calls || 0),
          color: COLORS.primary,
        }))}
      />

      <View style={{ height: 12 }} />

      <SimpleBarChart
        title="7-Day Bookings Created"
        layout="vertical"
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
    position: 'relative',
  },
  remindBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
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
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  kpiCard: {
    width: '32%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 78,
    ...SHADOWS.small,
  },
  kpiValue: { fontSize: 20, fontWeight: '800', textAlign: 'center', width: '100%' },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
    width: '100%',
    lineHeight: 13,
  },
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
  navyCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  navyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  navyTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  navyViewAll: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.85)' },
  navyEmpty: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    paddingVertical: 16,
  },
  navyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.18)',
  },
  navyRowLast: { borderBottomWidth: 0 },
  navyBody: { flex: 1, minWidth: 0 },
  navyName: { fontSize: 14, fontWeight: '800', color: '#fff' },
  navyMeta: { fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  navyAgo: { fontSize: 11, fontWeight: '700', color: '#BFDBFE', marginTop: 3 },
  navyCall: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
