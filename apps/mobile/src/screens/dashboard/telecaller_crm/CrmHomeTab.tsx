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
  TextInput,
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

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const IST_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatReminderClock(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const now = new Date(Date.now() + IST_OFFSET_MS);
  let hours = ist.getUTCHours();
  const minutes = String(ist.getUTCMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  const time = `${hours}:${minutes} ${ampm}`;
  const sameDay =
    ist.getUTCFullYear() === now.getUTCFullYear() &&
    ist.getUTCMonth() === now.getUTCMonth() &&
    ist.getUTCDate() === now.getUTCDate();
  if (sameDay) return time;
  return `${String(ist.getUTCDate()).padStart(2, '0')} ${IST_MONTHS[ist.getUTCMonth()]} ${time}`;
}

function leadInitials(name?: string | null): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0];
  if (/^\d/.test(first)) return first.slice(0, 2);
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return `${first[0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function greetingLabel() {
  const hour = new Date(Date.now() + IST_OFFSET_MS).getUTCHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function homeDateChip() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[ist.getUTCDay()]}, ${ist.getUTCDate()} ${IST_MONTHS[ist.getUTCMonth()]}`;
}

function shiftDuration(iso?: string | null) {
  if (!iso) return '';
  const start = new Date(iso).getTime();
  if (!Number.isFinite(start)) return '';
  const mins = Math.max(0, Math.floor((Date.now() - start) / 60000));
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`;
}

function checkInClock(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  let hours = ist.getUTCHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${String(ist.getUTCMinutes()).padStart(2, '0')} ${ampm}`;
}

function formatTalk(seconds?: number | null) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function formatClockShort(seconds?: number | null) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function reminderDay(iso?: string | null) {
  if (!iso) return { d: '—', m: '' };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { d: '—', m: '' };
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return { d: String(ist.getUTCDate()), m: IST_MONTHS[ist.getUTCMonth()] };
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
  vehicle_number?: string | null;
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
  const [leadQ, setLeadQ] = useState('');
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
  const { userProfile, role } = useAuth();
  const showTeam = String(role || '').toUpperCase() === 'LEAD_MANAGER';

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
  const rawReminders: HomeReminder[] = Array.isArray(data?.upcoming_reminders) ? data.upcoming_reminders : [];
  const todayEndMs = (() => {
    const ist = new Date(Date.now() + IST_OFFSET_MS);
    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
    const d = String(ist.getUTCDate()).padStart(2, '0');
    return new Date(`${y}-${m}-${d}T23:59:59.999+05:30`).getTime();
  })();
  const serverSplit = Array.isArray(data?.followups_due);
  const sortedReminders = [...rawReminders].sort(
    (a, b) => new Date(a.scheduled_time || 0).getTime() - new Date(b.scheduled_time || 0).getTime(),
  );
  const fallbackDue = sortedReminders.filter((r) => new Date(r.scheduled_time || 0).getTime() <= todayEndMs);
  const fallbackLater = sortedReminders.filter((r) => new Date(r.scheduled_time || 0).getTime() > todayEndMs);
  const nextCall: HomeReminder | null = data?.next_call || fallbackDue[0] || fallbackLater[0] || null;
  const followupsDue: HomeReminder[] = serverSplit
    ? data.followups_due.slice(0, 4)
    : (nextCall && fallbackDue[0]?.id === nextCall.id ? fallbackDue.slice(1) : fallbackDue).slice(0, 4);
  const reminders: HomeReminder[] = (serverSplit ? rawReminders : fallbackLater.length ? fallbackLater : sortedReminders.filter((r) => r.id !== nextCall?.id)).slice(0, 5);
  const homeReminders: HomeReminder[] = (() => {
    const seen = new Map<string, HomeReminder>();
    for (const row of [...followupsDue, ...reminders]) {
      if (row?.id) seen.set(String(row.id), row);
    }
    return [...seen.values()]
      .filter((row) => String(row.id) !== String(nextCall?.id || ''))
      .sort((a, b) => new Date(a.scheduled_time || 0).getTime() - new Date(b.scheduled_time || 0).getTime())
      .slice(0, 5);
  })();
  const inServiceLeads: FreshLead[] = Array.isArray(data?.in_service_leads) ? data.in_service_leads.slice(0, 4) : [];
  const recentCalls: Array<{
    id: string;
    call_status?: string | null;
    call_duration?: number | null;
    created_at?: string | null;
    phone_number?: string | null;
    lead_id?: string | null;
    lead?: { id?: string; customer_name?: string | null; customer_phone?: string | null } | null;
  }> = Array.isArray(data?.recent_calls) ? data.recent_calls.slice(0, 4) : [];
  const leaderboard: Array<{
    rank: number;
    name?: string;
    total_calls?: number;
    leads_completed?: number;
    is_me?: boolean;
  }> = Array.isArray(data?.leaderboard) ? data.leaderboard.slice(0, 5) : [];
  const pipeline = [
    { label: 'Follow-up', value: Number(kpis.callbacks || 0), filter: 'callback', color: '#F59E0B' },
    { label: 'Fresh', value: Number(kpis.new_leads || 0), filter: 'new', color: '#3B82F6' },
    { label: 'Interested', value: Number(kpis.interested || 0), filter: 'interested', color: '#22C55E' },
    { label: 'In Service', value: Number(kpis.in_service || 0), filter: 'in_service', color: '#8B5CF6' },
  ];
  const pipelineMax = Math.max(1, ...pipeline.map((row) => row.value));
  const punchedIn = Boolean(data?.attendance?.is_punched_in);
  const onFloor = punchedIn;
  const punchAt = data?.attendance?.open_session?.punch_in_at as string | undefined;
  const displayName = String(data?.profile?.name || userProfile?.full_name || 'Telecaller');

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
    { label: 'Reminders', icon: 'alarm-outline' as const, color: '#D97706', go: () => onNavigate('TelecallerFollowUps') },
    { label: 'Book service', icon: 'calendar-outline' as const, color: '#16A34A', go: () => onNavigate('book', { mode: 'book' }) },
    { label: 'WhatsApp', icon: 'logo-whatsapp' as const, color: '#25D366', go: onOpenWhatsApp },
    { label: 'Workshops', icon: 'location-outline' as const, color: '#0284C7', go: () => onNavigate('workshops') },
    { label: 'Leads', icon: 'people-outline' as const, color: '#7C3AED', go: () => onNavigate('queue') },
    { label: 'Reports', icon: 'bar-chart-outline' as const, color: '#004AAD', go: () => onNavigate('reports') },
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
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>{leadInitials(displayName)}</Text>
          </View>
          <View style={styles.heroNameWrap}>
            <Text style={styles.heroGreet}>{greetingLabel()},</Text>
            <Text style={styles.heroName} numberOfLines={1}>{displayName}</Text>
          </View>
          <View style={styles.heroDate}>
            <Text style={styles.heroDateText}>{homeDateChip()}</Text>
          </View>
        </View>
        {preview ? null : (
          <View style={styles.shiftCard}>
            <View style={styles.shiftCopy}>
              <View style={styles.shiftTitleRow}>
                <View style={[styles.floorDot, { backgroundColor: onFloor ? '#4ADE80' : '#FDBA74' }]} />
                <Text style={styles.shiftTitle} numberOfLines={1}>
                  {onFloor ? `On shift${shiftDuration(punchAt) ? ` · ${shiftDuration(punchAt)}` : ''}` : 'Off shift'}
                </Text>
              </View>
              <Text style={styles.shiftMeta} numberOfLines={2}>
                {onFloor && checkInClock(punchAt) ? `Checked in ${checkInClock(punchAt)}` : 'Tap start when you begin'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.breakBtn}
              onPress={() => void toggleFloor()}
              disabled={punching}
              activeOpacity={0.85}
            >
              <Text style={styles.breakBtnText}>{onFloor ? 'Take break' : 'Start shift'}</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.heroSearch}>
          <Ionicons name="search" size={16} color="#64748B" />
          <TextInput
            value={leadQ}
            onChangeText={setLeadQ}
            placeholder="Search name, mobile, car number"
            placeholderTextColor="#94A3B8"
            style={styles.heroSearchInput}
            returnKeyType="search"
            onSubmitEditing={() => {
              const q = leadQ.trim();
              if (!q) return;
              onNavigate('queue', { q });
            }}
          />
          <TouchableOpacity style={styles.leadsChip} onPress={() => onNavigate('queue')} activeOpacity={0.85}>
            <Text style={styles.leadsChipText}>Leads</Text>
          </TouchableOpacity>
        </View>
      </View>
      {loading && !data ? (
        <View style={{ paddingVertical: 8 }}>
          <CarLoading size="compact" label="Loading MyFNG CRM..." />
        </View>
      ) : null}

      {nextCall ? (
        <View style={styles.nextCard}>
          <View style={styles.nextTop}>
            <Text style={styles.nextEyebrow}>NEXT CALL</Text>
            <View style={styles.dueChip}>
              <Text style={styles.dueChipText}>Due {formatReminderClock(nextCall.scheduled_time) || 'now'}</Text>
            </View>
          </View>
          <Text style={styles.nextName} numberOfLines={1}>
            {String(nextCall.lead?.customer_name || 'Customer').trim()}
          </Text>
          <Text style={styles.nextMeta} numberOfLines={1}>
            {[nextCall.lead?.customer_phone, (nextCall.lead as { city?: string } | undefined)?.city].filter(Boolean).join(' · ') || 'Follow-up'}
          </Text>
          {nextCall.reason ? (
            <Text style={styles.nextNote} numberOfLines={2}>{nextCall.reason}</Text>
          ) : null}
          <View style={styles.nextActions}>
            <TouchableOpacity
              style={styles.nextCallBtn}
              onPress={() =>
                void clickToCallCustomer({
                  customerPhone: nextCall.lead?.customer_phone,
                  leadId: nextCall.lead_id || nextCall.lead?.id,
                  customerName: nextCall.lead?.customer_name,
                })
              }
            >
              <Ionicons name="call" size={15} color="#fff" />
              <Text style={styles.nextCallBtnText}>Call now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextGhost} onPress={onOpenWhatsApp}>
              <Ionicons name="logo-whatsapp" size={16} color="#86EFAC" />
              <Text style={styles.nextGhostText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.nextGhost}
              onPress={() => {
                const leadId = nextCall.lead_id || nextCall.lead?.id;
                if (leadId) onNavigate('TelecallerLeadDetail', { leadId });
              }}
            >
              <Ionicons name="create-outline" size={16} color="#CBD5E1" />
              <Text style={styles.nextGhostText}>Note</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <Text style={styles.blockTitle}>Quick actions</Text>
      <View style={styles.actionsGrid}>
        {quickActions.map((a) => (
          <TouchableOpacity key={a.label} style={styles.actionCard} onPress={a.go} activeOpacity={0.85}>
            <View style={[styles.actionIcon, { backgroundColor: a.color + '18' }]}>
              <Ionicons name={a.icon} size={18} color={a.color} />
            </View>
            <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
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

      <View style={styles.pipeCard}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>My pipeline</Text>
          <TouchableOpacity onPress={() => onNavigate('queue')} activeOpacity={0.8}>
            <Text style={styles.linkText}>All leads</Text>
          </TouchableOpacity>
        </View>
        {pipeline.map((row) => (
          <TouchableOpacity
            key={row.label}
            style={styles.pipeRow}
            onPress={() => onNavigate('queue', { filter: row.filter })}
            activeOpacity={0.85}
          >
            <Text style={styles.pipeLabel}>{row.label}</Text>
            <View style={styles.pipeTrack}>
              <View style={[styles.pipeFill, { width: `${Math.max(6, Math.round((row.value / pipelineMax) * 100))}%`, backgroundColor: row.color }]} />
            </View>
            <Text style={styles.pipeValue}>{row.value}</Text>
          </TouchableOpacity>
        ))}
      </View>


      <View style={styles.listCardFresh}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Fresh leads</Text>
          <TouchableOpacity onPress={() => onNavigate('queue', { filter: 'new' })} activeOpacity={0.8}>
            <Text style={styles.linkText}>View all</Text>
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
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Reminders</Text>
          <TouchableOpacity onPress={() => onNavigate('TelecallerFollowUps')} activeOpacity={0.8}>
            <Text style={styles.linkText}>View all</Text>
          </TouchableOpacity>
        </View>
        {homeReminders.length === 0 ? (
          <Text style={styles.navyEmpty}>No reminders</Text>
        ) : (
          homeReminders.map((r, idx) => {
            const leadId = String(r.lead_id || r.lead?.id || '');
            const phone = r.lead?.customer_phone;
            const overdue = r.scheduled_time ? new Date(r.scheduled_time).getTime() < Date.now() : false;
            const tone = overdue ? '#DC2626' : '#16A34A';
            const name = String(r.lead?.customer_name || 'Customer').trim();
            return (
              <View
                key={String(r.id)}
                style={[styles.navyRow, idx === homeReminders.length - 1 && styles.navyRowLast]}
              >
                <View style={[styles.remindAccent, { backgroundColor: tone }]} />
                <TouchableOpacity
                  style={styles.navyBody}
                  onPress={() => {
                    if (leadId) onNavigate('TelecallerLeadDetail', { leadId });
                    else onNavigate('TelecallerFollowUps');
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.dayBadge}>
                    <Text style={[styles.dayBadgeNum, { color: tone }]}>{reminderDay(r.scheduled_time).d}</Text>
                    <Text style={[styles.dayBadgeMon, { color: tone }]}>{reminderDay(r.scheduled_time).m}</Text>
                  </View>
                  <View style={styles.navyCopy}>
                    <Text style={styles.navyName} numberOfLines={1}>{name}</Text>
                    <Text style={styles.navyMeta} numberOfLines={1}>
                      {r.reason || 'Follow-up'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <Text style={[styles.timePill, { color: tone }]}>
                  {formatReminderClock(r.scheduled_time)}
                </Text>
                {phone ? (
                  <TouchableOpacity
                    style={[styles.remindCall, { backgroundColor: overdue ? '#FEE2E2' : '#DCFCE7' }]}
                    onPress={() =>
                      void clickToCallCustomer({
                        customerPhone: phone,
                        leadId: leadId || null,
                      })
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="call" size={16} color={tone} />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      <View style={styles.listCardFresh}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Cars in service</Text>
          <TouchableOpacity onPress={() => onNavigate('queue', { filter: 'in_service' })} activeOpacity={0.8}>
            <Text style={styles.linkText}>View all</Text>
          </TouchableOpacity>
        </View>
        {inServiceLeads.length === 0 ? (
          <Text style={styles.navyEmpty}>No cars in service</Text>
        ) : (
          inServiceLeads.map((lead, idx) => {
            const vehicle = [lead.vehicle_number, lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' · ');
            const name = String(lead.customer_name || 'Customer').trim();
            return (
              <TouchableOpacity
                key={String(lead.id)}
                style={[styles.navyRow, idx === inServiceLeads.length - 1 && styles.navyRowLast]}
                onPress={() => onNavigate('TelecallerLeadDetail', { leadId: lead.id })}
                activeOpacity={0.85}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{leadInitials(name)}</Text>
                </View>
                <View style={styles.navyCopy}>
                  <Text style={styles.navyName} numberOfLines={1}>{name}</Text>
                  <Text style={styles.navyMeta} numberOfLines={1}>{vehicle || lead.city || 'In service'}</Text>
                </View>
                <View style={styles.statusPillBlue}>
                  <Text style={styles.statusPillTextBlue}>In service</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Recent calls</Text>
        </View>
        {recentCalls.length === 0 ? (
          <Text style={styles.navyEmpty}>No calls yet</Text>
        ) : (
          recentCalls.map((call, idx) => {
            const name = String(call.lead?.customer_name || call.phone_number || 'Customer').trim();
            const leadId = call.lead?.id || call.lead_id;
            return (
              <TouchableOpacity
                key={String(call.id)}
                style={[styles.navyRow, idx === recentCalls.length - 1 && styles.navyRowLast]}
                onPress={() => {
                  if (leadId) onNavigate('TelecallerLeadDetail', { leadId });
                }}
                activeOpacity={0.85}
              >
                <View style={[styles.callDot, { backgroundColor: String(call.call_status || '').toUpperCase() === 'ANSWERED' ? '#16A34A' : '#F59E0B' }]} />
                <View style={styles.navyCopy}>
                  <Text style={styles.navyName} numberOfLines={1}>{name}</Text>
                  <Text style={styles.navyMeta} numberOfLines={1}>
                    {String(call.call_status || 'Call').split('_').join(' ')}
                  </Text>
                </View>
                <View style={styles.callSide}>
                  <Text style={styles.callDur}>{formatTalk(call.call_duration)}</Text>
                  <Text style={styles.callWhen}>{formatLeadAgo(call.created_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {showTeam ? (
      <View style={styles.sectionCard}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Team today</Text>
          <TouchableOpacity onPress={() => onNavigate('reports')} activeOpacity={0.8}>
            <Text style={styles.linkText}>Full board</Text>
          </TouchableOpacity>
        </View>
        {leaderboard.length === 0 ? (
          <Text style={styles.navyEmpty}>No calls logged today</Text>
        ) : (
          leaderboard.map((row) => (
            <View key={String(row.rank)} style={[styles.boardRow, row.is_me && styles.boardRowMe]}>
              <View style={[styles.rankBadge, row.is_me && styles.rankBadgeMe]}>
                <Text style={[styles.rankBadgeText, row.is_me && styles.rankBadgeTextMe]}>{row.rank}</Text>
              </View>
              <Text style={[styles.boardName, row.is_me && styles.boardMe]} numberOfLines={1}>
                {row.is_me ? 'You' : row.name}
              </Text>
              <Text style={styles.boardMeta}>{row.total_calls || 0} calls</Text>
            </View>
          ))
        )}
      </View>
      ) : null}

      <View style={styles.perfCard}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Performance</Text>
          <Text style={styles.perfHint}>{dateLabel}</Text>
        </View>
        <View style={styles.perfTop}>
          <View>
            <Text style={styles.perfBig}>{kpis.today_calls ?? 0}</Text>
            <Text style={styles.perfBigLabel}>calls</Text>
          </View>
          <View style={styles.perfSide}>
            <Text style={styles.perfSideLine}>Connected  {kpis.answered_calls ?? 0}/{kpis.today_calls ?? 0}</Text>
            <Text style={styles.perfSideLine}>Bookings  {kpis.booking_confirmed ?? kpis.booked ?? 0}</Text>
            <Text style={styles.perfSideLine}>Follow-ups  {kpis.followups_today ?? 0}</Text>
          </View>
        </View>
        <View style={styles.perfChips}>
          <Text style={styles.perfChip}>{kpis.answer_rate ?? 0}% pickup</Text>
          <Text style={styles.perfChip}>{formatClockShort(kpis.avg_call_seconds)} avg</Text>
          <Text style={styles.perfChip}>{formatTalk(kpis.talk_duration_seconds)} talk</Text>
          <Text style={styles.perfChip}>{kpis.overdue_callbacks ?? 0} overdue</Text>
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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F6FB' },
  content: { paddingHorizontal: SPACING.md, paddingTop: 0, paddingBottom: 40 },
  hero: {
    marginHorizontal: -SPACING.md,
    marginBottom: 12,
    backgroundColor: '#004AAD',
    paddingHorizontal: SPACING.md,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    gap: 10,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: { color: '#004AAD', fontSize: 14, fontWeight: '800' },
  heroNameWrap: { flex: 1, minWidth: 0 },
  heroGreet: { color: '#DBEAFE', fontSize: 12, fontWeight: '600' },
  heroName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  heroDate: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  heroDateText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  shiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  shiftCopy: { flex: 1, minWidth: 0, gap: 2 },
  shiftTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shiftTitle: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '800' },
  shiftMeta: { color: '#DBEAFE', fontSize: 11, fontWeight: '600', marginLeft: 13 },
  breakBtn: {
    flexShrink: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  breakBtnText: { color: '#004AAD', fontSize: 13, fontWeight: '800' },
  heroSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 6,
    height: 44,
  },
  heroSearchInput: { flex: 1, fontSize: 13, color: '#0F172A', paddingVertical: 0 },
  leadsChip: { backgroundColor: '#E8F1FF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  leadsChipText: { color: '#004AAD', fontSize: 12, fontWeight: '800' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  searchInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6E4FF',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  searchBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6E4FF',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  dateDropdownWrap: { marginBottom: 10, zIndex: 30, elevation: 30 },
  dateDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E6EDF5',
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
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E6EDF5',
  },
  listCardRemind: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E6EDF5',
  },
  navyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  navyTitle: { fontSize: 15, fontWeight: '800', color: '#0F2744' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F2744' },
  linkText: { fontSize: 13, fontWeight: '700', color: '#004AAD' },
  blockTitle: { fontSize: 16, fontWeight: '800', color: '#0F2744', marginBottom: 8 },
  navyViewAllBtn: {
    backgroundColor: '#E4EDFF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  navyViewAll: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  remindTitle: { fontSize: 13, fontWeight: '800', color: '#9A3412' },
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
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15, 23, 42, 0.08)',
  },
  navyRowLast: { borderBottomWidth: 0 },
  navyBody: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  navyCopy: { flex: 1, minWidth: 0 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRemind: { backgroundColor: '#FFEDD5' },
  avatarText: { fontSize: 11, fontWeight: '800', color: '#004AAD' },
  avatarTextRemind: { color: '#C2410C' },
  navyName: { fontSize: 13, fontWeight: '700', color: '#0F2744' },
  navyMeta: { fontSize: 11, color: '#64748B', marginTop: 1 },
  navyAgo: { width: 70, textAlign: 'right', fontSize: 11, lineHeight: 14, fontWeight: '600', color: COLORS.primary },
  navyCall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8F0FE',
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
    marginBottom: 14,
  },
  actionCard: {
    width: '31.5%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6EDF5',
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 8,
    minHeight: 84,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 11, fontWeight: '700', color: '#0F2744', textAlign: 'center' },
  nextCard: { backgroundColor: '#0F2744', borderRadius: 18, padding: 16, marginBottom: 14, gap: 3 },
  nextTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  nextEyebrow: { color: '#93C5FD', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  dueChip: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  dueChipText: { color: '#FDE68A', fontSize: 11, fontWeight: '800' },
  nextName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  nextMeta: { color: '#CBD5E1', fontSize: 13, fontWeight: '600', marginTop: 2 },
  nextNote: { color: '#94A3B8', fontSize: 12, lineHeight: 16, marginTop: 4 },
  nextActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  nextCallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#16A34A', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  nextCallBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  nextGhost: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, paddingVertical: 8 },
  nextGhostText: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },
  pipeCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E6EDF5', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, marginBottom: 12 },
  pipeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  pipeLabel: { width: 86, fontSize: 13, fontWeight: '700', color: '#334155' },
  pipeTrack: { flex: 1, height: 10, borderRadius: 99, backgroundColor: '#EEF2F7', overflow: 'hidden' },
  pipeFill: { height: 10, borderRadius: 99 },
  pipeValue: { width: 42, textAlign: 'right', fontSize: 14, fontWeight: '800', color: '#0F2744' },
  sectionCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E6EDF5', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, marginBottom: 12 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderRadius: 12, paddingHorizontal: 4 },
  boardRowMe: { backgroundColor: '#EEF4FF' },
  rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  rankBadgeMe: { backgroundColor: '#004AAD' },
  rankBadgeText: { fontSize: 12, fontWeight: '800', color: '#475569' },
  rankBadgeTextMe: { color: '#fff' },
  boardName: { flex: 1, fontSize: 13, fontWeight: '700', color: '#0F2744' },
  boardMeta: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  boardMe: { color: '#004AAD' },
  perfHint: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  perfTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 12 },
  perfBig: { fontSize: 36, fontWeight: '800', color: '#0F2744', lineHeight: 40 },
  perfBigLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  perfSide: { gap: 4, alignItems: 'flex-end' },
  perfSideLine: { fontSize: 13, fontWeight: '700', color: '#334155' },
  perfChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  perfChip: { backgroundColor: '#F1F5F9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden', fontSize: 11, fontWeight: '700', color: '#334155' },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillRed: { backgroundColor: '#FEE2E2' },
  statusPillAmber: { backgroundColor: '#FEF3C7' },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  statusPillTextRed: { color: '#DC2626' },
  statusPillTextAmber: { color: '#B45309' },
  statusPillBlue: { backgroundColor: '#E0F2FE', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillTextBlue: { color: '#0369A1', fontSize: 11, fontWeight: '700' },
  remindAccent: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginRight: 2 },
  dayBadge: { width: 36, alignItems: 'center', justifyContent: 'center' },
  dayBadgeNum: { fontSize: 13, fontWeight: '800', color: '#004AAD', lineHeight: 16 },
  dayBadgeMon: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  timePill: { width: 78, textAlign: 'right', fontSize: 11, fontWeight: '600', color: '#004AAD' },
  callDot: { width: 10, height: 10, borderRadius: 5 },
  callSide: { alignItems: 'flex-end' },
  callDur: { fontSize: 11, fontWeight: '700', color: '#0F2744' },
  callWhen: { fontSize: 11, color: '#64748B', marginTop: 2 },
});

