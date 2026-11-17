import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  AppState,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isPartnerPreview } from '../../../lib/partnerPreview';
import { apiFetch } from '../../../lib/api';
import { shouldKeepPreviousDashboard } from '../../../lib/crmDashboardGuard';
import { useAuth } from '../../../context/AuthContext';
import CarLoading from '../../../components/CarLoading';
import SimpleBarChart from '../../../components/telecaller/SimpleBarChart';
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
  const time = d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const day = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
  const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
  return day === today ? time : `${day} ${time}`;
}

function leadInitials(name?: string | null): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0];
  if (/^\d/.test(first)) return first.slice(0, 2);
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return `${first[0]}${parts[parts.length - 1][0]}`.toUpperCase();
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
  embedInShell: _embedInShell = false,
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
  const [loadError, setLoadError] = useState('');
  const inFlight = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;
  const [datePresetLocal, setDatePresetLocal] = useState<CrmDatePreset>('last_7_days');
  const [customStartLocal, setCustomStartLocal] = useState(istYmd());
  const [customEndLocal, setCustomEndLocal] = useState(istYmd());
  const [dateOpen, setDateOpen] = useState(false);
  const [punching, setPunching] = useState(false);
  const { userProfile } = useAuth();

  const datePreset = datePresetProp ?? datePresetLocal;
  const customStart = customStartProp ?? customStartLocal;
  const customEnd = customEndProp ?? customEndLocal;
  const setDatePreset = onDatePresetChange || setDatePresetLocal;
  const setCustomStart = onCustomStartChange || setCustomStartLocal;
  const setCustomEnd = onCustomEndChange || setCustomEndLocal;

  const dateRange = resolveCrmDateRange(datePreset, customStart, customEnd);
  const dateLabel = CRM_DATE_PRESETS.find((p) => p.value === datePreset)?.label || dateRange.label;

  const load = useCallback(async (force = false) => {
    if (isPartnerPreview()) {
      setData({ kpis: {}, trend: [], fresh_leads: [], upcoming_reminders: [] });
      setLoadError('');
      onRemindersCount?.(0);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (inFlight.current && !force) return;
    inFlight.current = true;
    try {
      const range = resolveCrmDateRange(datePreset, customStart, customEnd);
      const params = new URLSearchParams();
      if (range.allTime) {
        params.set('all', '1');
      } else {
        params.set('from', range.start);
        params.set('to', range.end);
      }
      const res = await apiFetch<any>(`/api/telecaller/crm/dashboard?${params.toString()}`, {
        timeoutMs: 25000,
      });
      if (force || !shouldKeepPreviousDashboard(dataRef.current, res)) {
        setData(res);
      }
      setLoadError('');
      onRemindersCount?.(Number(res?.kpis?.reminders_pending || 0));
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Could not load CRM';
      const message = /unauthorized|not authenticated/i.test(raw)
        ? 'Could not reach the server. Pull to refresh or tap Retry.'
        : raw;
      setLoadError(message);
      if (!dataRef.current) {
        console.warn('CRM dashboard failed', message);
      }
    } finally {
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [datePreset, customStart, customEnd, onRemindersCount]);

  useEffect(() => {
    if (!isActive) return;
    void load(true);
    const id = setInterval(() => {
      void load(false);
    }, 40000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load(false);
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [load, isActive]);

  const kpis = data?.kpis || {};
  const preview = isPartnerPreview();
  const trend = preview
    ? [
        { label: 'Mon', calls: 6, leads_created: 2 },
        { label: 'Tue', calls: 9, leads_created: 3 },
        { label: 'Wed', calls: 4, leads_created: 1 },
        { label: 'Thu', calls: 11, leads_created: 4 },
        { label: 'Fri', calls: 8, leads_created: 2 },
        { label: 'Sat', calls: 5, leads_created: 1 },
        { label: 'Sun', calls: 3, leads_created: 1 },
      ]
    : Array.isArray(data?.trend)
      ? data.trend
      : [];
  const freshLeads: FreshLead[] = Array.isArray(data?.fresh_leads) ? data.fresh_leads : [];
  const reminders: HomeReminder[] = Array.isArray(data?.upcoming_reminders)
    ? data.upcoming_reminders.slice(0, 5)
    : [];
  const punchedIn = Boolean(data?.attendance?.is_punched_in);
  const onFloor = punchedIn;
  const floorPlace = userProfile?.workshop?.name || '';

  const toggleFloor = async () => {
    if (punching) return;
    const next = !onFloor;
    setPunching(true);
    try {
      await apiFetch('/api/telecaller/crm/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: next ? 'punch_in' : 'punch_out' }),
      });
      setData((prev: any) =>
        prev
          ? { ...prev, attendance: { ...(prev.attendance || {}), is_punched_in: next } }
          : prev,
      );
    } catch (e: any) {
      Alert.alert('Attendance', e?.message || 'Could not update floor status');
    } finally {
      setPunching(false);
    }
  };

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
    { label: 'Leads', icon: 'list' as const, color: COLORS.orange, go: () => onNavigate('queue') },
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} colors={[COLORS.primary]} />}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {loadError && !data ? (
        <View style={styles.loadBanner}>
          <Text style={styles.loadBannerText}>{loadError}</Text>
          <TouchableOpacity
            onPress={() => {
              setLoading(true);
              void load(true);
            }}
          >
            <Text style={styles.loadBannerRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {loading && !data ? (
        <View style={{ paddingVertical: 12 }}>
          <CarLoading size="compact" label="Loading MyFNG CRM..." />
        </View>
      ) : null}

      {preview ? null : (
      <View style={styles.floorCard}>
        <View style={styles.floorCopy}>
          <View style={styles.floorNameRow}>
            <View style={[styles.floorDot, { backgroundColor: onFloor ? '#16A34A' : '#D97706' }]} />
            <Text style={styles.floorName} numberOfLines={1}>
              {data?.profile?.name || 'Telecaller'}
            </Text>
          </View>
          {floorPlace ? (
            <View style={styles.floorPlaceRow}>
              <Ionicons name="location-sharp" size={12} color="#64748B" />
              <Text style={styles.floorPlace} numberOfLines={1}>{floorPlace}</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.onlineWrap}
          onPress={() => void toggleFloor()}
          disabled={punching}
          activeOpacity={0.85}
        >
          <View style={[styles.onlineTrack, onFloor && styles.onlineTrackOn]}>
            <View style={[styles.onlineKnob, onFloor && styles.onlineKnobOn]} />
          </View>
          <Text style={[styles.onlineLabel, onFloor && styles.onlineLabelOn]}>
            {onFloor ? 'Online' : 'Offline'}
          </Text>
        </TouchableOpacity>
      </View>
      )}

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
                    load(true);
                  }}
                >
                  <Text style={styles.applyBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.kpiGrid}>
        {[
          { label: 'All', value: kpis.total_leads || 0, statusKey: 'All', filter: 'all', icon: 'apps' as const },
          { label: 'Ringing', value: kpis.ringing || 0, statusKey: 'Ringing', filter: 'ringing', icon: 'call' as const },
          { label: 'Fresh', value: kpis.new_leads || 0, statusKey: 'Fresh', filter: 'new', icon: 'flash' as const },
          {
            label: 'Interested',
            value: kpis.interested,
            statusKey: 'Interested',
            filter: 'interested',
            icon: 'heart' as const,
          },
          {
            label: 'He will visit',
            value: kpis.will_visit,
            statusKey: 'He will visit',
            filter: 'will_visit',
            icon: 'walk' as const,
          },
          {
            label: 'Follow-up',
            value: kpis.callbacks,
            statusKey: 'Follow-up',
            filter: 'callback',
            icon: 'time' as const,
          },
          {
            label: 'Booking confirmed',
            value: kpis.booking_confirmed ?? kpis.booked,
            statusKey: 'Booking confirmed',
            filter: 'booking_confirmed',
            icon: 'calendar' as const,
          },
          {
            label: 'In Service',
            value: kpis.in_service,
            statusKey: 'In Service',
            filter: 'in_service',
            icon: 'construct' as const,
          },
          {
            label: 'Service Done',
            value: kpis.service_done,
            statusKey: 'Service Done',
            filter: 'service_done',
            icon: 'checkmark-circle' as const,
          },
          {
            label: 'Today due',
            value: kpis.followups_today,
            statusKey: 'Follow-up',
            filter: 'followups',
            icon: 'alarm' as const,
          },
          {
            label: 'Lost',
            value: kpis.lost ?? kpis.rejected,
            statusKey: 'Lost',
            filter: 'lost',
            icon: 'close-circle' as const,
          },
          {
            label: 'Other',
            value: kpis.other || 0,
            statusKey: 'Other',
            filter: 'other',
            icon: 'ellipsis-horizontal' as const,
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
              <Ionicons name={k.icon} size={16} color={accent} style={styles.kpiIcon} />
              <Text style={[styles.kpiValue, { color: accent }]}>{k.value ?? 0}</Text>
              <Text style={styles.kpiLabel} numberOfLines={2}>
                {k.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.listCardFresh}>
        <View style={styles.navyHead}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionMark} />
            <Text style={styles.navyTitle}>Fresh leads</Text>
          </View>
          <TouchableOpacity
            style={styles.navyViewAllBtn}
            onPress={() => onNavigate('queue', { filter: 'new' })}
            activeOpacity={0.8}
          >
            <Text style={styles.navyViewAll}>View all</Text>
          </TouchableOpacity>
        </View>
        {freshLeads.length === 0 ? (
          <Text style={styles.navyEmpty}>No fresh leads right now</Text>
        ) : (
          freshLeads.map((lead, idx) => {
            const vehicle = [lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ');
            const meta = [lead.city, vehicle].filter(Boolean).join(' · ');
            const name = String(lead.customer_name || 'Customer').trim();
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
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{leadInitials(name)}</Text>
                  </View>
                  <View style={styles.navyCopy}>
                    <Text style={styles.navyName} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={styles.navyMeta} numberOfLines={1}>
                      {lead.customer_phone || '—'}
                      {meta ? ` · ${meta}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
                <Text style={styles.navyAgo}>{formatLeadAgo(lead.created_at)}</Text>
                <TouchableOpacity
                  style={styles.navyCall}
                  onPress={() =>
                    void clickToCallCustomer({
                      customerPhone: lead.customer_phone,
                      leadId: lead.id,
                      customerName: lead.customer_name,
                      leadNumber: lead.lead_number,
                    })
                  }
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="call" size={14} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.listCardRemind}>
        <View style={styles.navyHead}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionMark, { backgroundColor: '#EA580C' }]} />
            <Text style={styles.remindTitle}>Upcoming reminders</Text>
          </View>
          <TouchableOpacity
            style={styles.remindViewAllBtn}
            onPress={() => onNavigate('TelecallerFollowUps')}
            activeOpacity={0.8}
          >
            <Text style={styles.remindViewAll}>View all</Text>
          </TouchableOpacity>
        </View>
        {reminders.length === 0 ? (
          <Text style={styles.navyEmpty}>No reminders</Text>
        ) : (
          reminders.map((r, idx) => {
            const leadId = String(r.lead_id || r.lead?.id || '');
            const phone = r.lead?.customer_phone;
            const overdue = r.scheduled_time ? new Date(r.scheduled_time).getTime() < Date.now() : false;
            const name = String(r.lead?.customer_name || 'Customer').trim();
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
                  <View style={[styles.avatar, styles.avatarRemind]}>
                    <Text style={[styles.avatarText, styles.avatarTextRemind]}>{leadInitials(name)}</Text>
                  </View>
                  <View style={styles.navyCopy}>
                    <Text style={styles.navyName} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={styles.navyMeta} numberOfLines={1}>
                      {r.reason || 'Follow-up'}
                      {phone ? ` · ${phone}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
                <Text style={[styles.navyAgo, overdue ? { color: '#DC2626' } : { color: '#C2410C' }]}>
                  {formatReminderClock(r.scheduled_time)}
                </Text>
                {phone ? (
                  <TouchableOpacity
                    style={styles.remindCall}
                    onPress={() =>
                      void clickToCallCustomer({
                        customerPhone: phone,
                        leadId: leadId || null,
                      })
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="call" size={16} color="#C2410C" />
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

      {preview ? null : (
      <>
      <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        {quickActions.map((a) => (
          <TouchableOpacity key={a.label} style={styles.actionCard} onPress={a.go} activeOpacity={0.85}>
            <View style={[styles.actionIcon, { backgroundColor: a.color + '18' }]}>
              <Ionicons name={a.icon} size={15} color={a.color} />
            </View>
            <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.md, paddingTop: 12, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  muted: { color: COLORS.textSecondary },
  loadBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 6,
  },
  loadBannerText: { color: '#991B1B', fontSize: 13, fontWeight: '600' },
  loadBannerRetry: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },
  floorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#E7F8EF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C9EBD8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 10,
  },
  floorCopy: { flex: 1, minWidth: 0 },
  floorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  floorDot: { width: 7, height: 7, borderRadius: 4 },
  floorName: { flexShrink: 1, fontSize: 14, fontWeight: '800', color: '#0F2744' },
  floorPlaceRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 13 },
  floorPlace: { flexShrink: 1, fontSize: 11, color: '#64748B', fontWeight: '600' },
  onlineWrap: { alignItems: 'center', gap: 2 },
  onlineTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D1D5DB',
    padding: 2,
    justifyContent: 'center',
  },
  onlineTrackOn: { backgroundColor: '#86EFAC' },
  onlineKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  onlineKnobOn: { alignSelf: 'flex-end', backgroundColor: '#15803D' },
  onlineLabel: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  onlineLabelOn: { color: '#15803D' },
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
  dateDropdownWrap: { marginBottom: 0, zIndex: 30, elevation: 30 },
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
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    zIndex: 40,
    elevation: 24,
    ...SHADOWS.medium,
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
    position: 'relative',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 10,
    paddingRight: 28,
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 68,
    ...SHADOWS.small,
  },
  kpiIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  kpiValue: { fontSize: 20, fontWeight: '800' },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 13,
  },
  sectionMark: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginRight: 6,
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
  listCardFresh: {
    backgroundColor: '#F3F7FF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#C7D7F5',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    ...SHADOWS.small,
  },
  listCardRemind: {
    backgroundColor: '#FFF8F1',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3D5B5',
    borderLeftWidth: 4,
    borderLeftColor: '#EA580C',
    ...SHADOWS.small,
  },
  navyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  navyTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textHeading },
  navyViewAllBtn: {
    backgroundColor: '#E4EDFF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  navyViewAll: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  remindTitle: { fontSize: 14, fontWeight: '800', color: '#9A3412' },
  remindViewAllBtn: {
    backgroundColor: '#FFEDD5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  remindViewAll: { fontSize: 11, fontWeight: '700', color: '#C2410C' },
  navyEmpty: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  navyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15, 23, 42, 0.08)',
  },
  navyRowLast: { borderBottomWidth: 0 },
  navyBody: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  navyCopy: { flex: 1, minWidth: 0 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DCE8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRemind: { backgroundColor: '#FFEDD5' },
  avatarText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  avatarTextRemind: { color: '#C2410C' },
  navyName: { fontSize: 13, fontWeight: '700', color: COLORS.textHeading },
  navyMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  navyAgo: { width: 64, textAlign: 'right', fontSize: 11, fontWeight: '600', color: COLORS.primary },
  navyCall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCE8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remindCall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionCard: {
    width: '31.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6EDF5',
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 4,
  },
  actionIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1, fontSize: 11, fontWeight: '700', color: '#0F2744' },
});
