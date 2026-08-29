import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
  Alert,
  Linking,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../../lib/api';
import CarLoading from '../../../components/CarLoading';
import { clickToCallCustomer } from '../../../lib/clickToCall';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';
import {
  CRM_DATE_PRESETS,
  resolveCrmDateRange,
  type CrmDatePreset,
  istYmd,
} from '../../../lib/crmDateRange';
import {
  loadTelecallerCrmFilterPrefs,
  saveTelecallerCrmFilterPrefs,
} from '../../../lib/crmFilterPrefs';
import { leadStatusCardColors, leadStatusKpiColors, statusAccentColor } from '../../../lib/telecaller/leadStatusColors';
import { mergeCrmStatusFilters } from '../../../lib/telecaller/crmStatusFilters';
import SimpleBarChart from '../../../components/telecaller/SimpleBarChart';

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'NORMAL', label: 'NORMAL' },
  { value: 'HIGH', label: 'HIGH' },
  { value: 'URGENT', label: 'URGENT' },
];

type Props = {
  initialFilter?: string;
  onOpenLead: (leadId: string) => void;
  onEditLead?: (leadId: string) => void;
  onFilterChange?: (filter: string) => void;
  datePreset?: CrmDatePreset;
  customStart?: string;
  customEnd?: string;
  onDatePresetChange?: (v: CrmDatePreset) => void;
  onCustomStartChange?: (v: string) => void;
  onCustomEndChange?: (v: string) => void;
  /** Lead Manager ops: multi-select, bulk assign, bulk WA */
  managerOps?: boolean;
};

type DropdownKey = 'date' | 'dateField' | 'status' | 'lostReason' | 'city' | 'priority' | null;

/** Match lead detail "Select status" — one Fresh, one Follow-up. */
const DEFAULT_STATUS_FILTERS = mergeCrmStatusFilters([]);

const LOST_REASON_FILTERS = [
  { id: '', label: 'All lost reasons' },
  { id: 'Not Interested', label: 'Not Interested' },
  { id: 'Unqualified Lead', label: 'Unqualified Lead' },
  { id: 'No-Response to Calls', label: 'No-Response to Calls' },
  { id: 'Already Service Done', label: 'Already Service Done' },
  { id: 'Under Warranty', label: 'Under Warranty' },
  { id: 'Looking For Authorised Service Center', label: 'Looking For Authorised Service Center' },
  { id: 'Other Reasons', label: 'Other Reasons' },
];

/** UI badge only — keep full "Lost · reason" in meta for filters/history. */
function shortLeadStatusLabel(label: string): string {
  const s = String(label || '').trim();
  if (/^lost\b/i.test(s) || /^lost\s*[·•\-:|]/i.test(s)) return 'Lost';
  if (/^callback\b/i.test(s)) return 'Follow-up';
  const beforeDot = s.split(/\s*[·•|]\s*/)[0]?.trim();
  if (beforeDot && /^lost\b/i.test(beforeDot)) return 'Lost';
  return s;
}

function leadDisplayStatus(lead: any): string {
  if (lead && Boolean(lead.is_incomplete)) {
    const result = String(lead?.coupon_meta?.last_call_result || '').toUpperCase();
    const mapResultEarly: Record<string, string> = {
      INTERESTED: 'Interested',
      WILL_VISIT: 'He will visit',
      CALLBACK: 'Follow-up',
      BOOKING_CONFIRMED: 'Booking confirmed',
      IN_SERVICE: 'In Service',
      SERVICE_DONE: 'Service Done',
      LOST: 'Lost',
      FRESH: 'Fresh',
    };
    if (result && mapResultEarly[result] && result !== 'FRESH') return mapResultEarly[result];
    return 'Fresh';
  }
  const label = String(lead?.coupon_meta?.last_call_label || '').trim();
  // Keep "Web OTP Verified" / "Mob OTP Verified" as-is (don't shorten)
  if (label && /otp verified/i.test(label)) return label;
  if (label) return shortLeadStatusLabel(label);
  const result = String(lead?.coupon_meta?.last_call_result || '').toUpperCase();
  const mapResult: Record<string, string> = {
    FRESH: 'Fresh',
    INTERESTED: 'Interested',
    WILL_VISIT: 'He will visit',
    CALLBACK: 'Follow-up',
    BOOKING_CONFIRMED: 'Booking confirmed',
    IN_SERVICE: 'In Service',
    SERVICE_DONE: 'Service Done',
    LOST: 'Lost',
    RINGING: 'Ringing',
    OTP_VERIFIED: 'OTP Verified',
  };
  if (result && mapResult[result]) return mapResult[result];
  const hist = Array.isArray(lead?.coupon_meta?.profile_history)
    ? lead.coupon_meta.profile_history
    : [];
  for (const entry of hist) {
    const s = String(entry?.status || '').toUpperCase();
    if (s && mapResult[s]) return mapResult[s];
  }
  const status = String(lead?.status || '').toUpperCase();
  const mapStatus: Record<string, string> = {
    NEW: 'Fresh',
    VALIDATED: 'Booking confirmed',
    IN_PROGRESS: 'In Service',
    COMPLETED: 'Service Done',
    REJECTED: 'Lost',
    CONTACTED: 'Contacted',
    ASSIGNED: 'Assigned',
    ACCEPTED: 'Accepted',
  };
  return shortLeadStatusLabel(mapStatus[status] || status.replace(/_/g, ' ') || 'Fresh');
}

const ASSIGNEE_COLORS = [
  '#7C3AED',
  '#DB2777',
  '#059669',
  '#D97706',
  '#2563EB',
  '#DC2626',
  '#0891B2',
  '#4F46E5',
  '#CA8A04',
  '#0D9488',
];

function colorForAssignee(seed: string): string {
  const s = String(seed || '').trim() || '?';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return ASSIGNEE_COLORS[h % ASSIGNEE_COLORS.length];
}

function assigneeInitials(name: string): string {
  const n = String(name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}


export default function CrmQueueTab({
  initialFilter = 'all',
  onOpenLead,
  onEditLead,
  onFilterChange,
  datePreset: datePresetProp,
  customStart: customStartProp,
  customEnd: customEndProp,
  onDatePresetChange,
  onCustomStartChange,
  onCustomEndChange,
  managerOps = false,
}: Props) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  /** Debounced search text (matches web ~350ms) — drives API loads */
  const [appliedQ, setAppliedQ] = useState('');
  const [filter, setFilter] = useState(initialFilter);
  const [statusFilters, setStatusFilters] = useState(DEFAULT_STATUS_FILTERS);
  const [lostReason, setLostReason] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [city, setCity] = useState('');
  const [priority, setPriority] = useState('');
  const [dateField, setDateField] = useState<'created' | 'modified'>('created');
  const [advIncomplete, setAdvIncomplete] = useState(false);
  const [advFollowUp, setAdvFollowUp] = useState(false);
  const [advHasVehicle, setAdvHasVehicle] = useState(false);
  const [advHasCoupon, setAdvHasCoupon] = useState(false);
  const [datePresetLocal, setDatePresetLocal] = useState<CrmDatePreset>('last_7_days');
  const [customStartLocal, setCustomStartLocal] = useState(istYmd());
  const [customEndLocal, setCustomEndLocal] = useState(istYmd());
  const [cities, setCities] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
  const [shareLead, setShareLead] = useState<any>(null);
  const [peers, setPeers] = useState<any[]>([]);
  const [sharing, setSharing] = useState(false);
  const [localPrefsReady, setLocalPrefsReady] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [telecallers, setTelecallers] = useState<Array<{ id: string; full_name: string | null }>>(
    [],
  );
  const [bulkTcId, setBulkTcId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkWaOpen, setBulkWaOpen] = useState(false);
  const [bulkWaText, setBulkWaText] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');

  const datePreset = datePresetProp ?? datePresetLocal;
  const customStart = customStartProp ?? customStartLocal;
  const customEnd = customEndProp ?? customEndLocal;
  const setDatePreset = onDatePresetChange || setDatePresetLocal;
  const setCustomStart = onCustomStartChange || setCustomStartLocal;
  const setCustomEnd = onCustomEndChange || setCustomEndLocal;

  const dateRange = resolveCrmDateRange(datePreset, customStart, customEnd);
  const statusLabel = statusFilters.find((c) => c.id === filter)?.label || 'Lead Status';
  const lostReasonLabel =
    LOST_REASON_FILTERS.find((c) => c.id === lostReason)?.label || 'All lost reasons';
  const dateLabel = CRM_DATE_PRESETS.find((p) => p.value === datePreset)?.label || dateRange.label;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<any>('/api/lead-manager/statuses');
        const rows = Array.isArray(data?.statuses) ? data.statuses : [];
        if (cancelled || !rows.length) return;
        setStatusFilters(mergeCrmStatusFilters(rows));
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = await loadTelecallerCrmFilterPrefs();
      if (cancelled) return;
      const nextQ = prefs.q || '';
      setQ(nextQ);
      setAppliedQ(nextQ.trim());
      setCity(prefs.city || '');
      setPriority(prefs.priority || '');
      setDateField(prefs.dateField === 'modified' ? 'modified' : 'created');
      setLostReason(prefs.lostReason || '');
      setAdvIncomplete(Boolean(prefs.advIncomplete));
      setAdvFollowUp(Boolean(prefs.advFollowUp));
      setAdvHasVehicle(Boolean(prefs.advHasVehicle));
      setAdvHasCoupon(Boolean(prefs.advHasCoupon));
      setLocalPrefsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [onFilterChange]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('cities')
          .select('name')
          .eq('is_active', true)
          .order('name');
        const names = Array.from(
          new Set((data || []).map((c: any) => String(c.name || '').trim()).filter(Boolean)),
        );
        setCities(names);
      } catch {
        setCities([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!managerOps) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('users_login')
          .select('id, full_name, roles!role_id(role_code)')
          .eq('is_active', true)
          .order('full_name');
        setTelecallers(
          (data || [])
            .filter((t: any) => String(t?.roles?.role_code || '').toUpperCase() === 'TELECALLER')
            .map((t: any) => ({
              id: String(t.id),
              full_name: t.full_name ? String(t.full_name) : null,
            })),
        );
      } catch {
        setTelecallers([]);
      }
    })();
  }, [managerOps]);

  const toggleSelect = (id: string) => {
    if (!managerOps) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulkAssign = async (clear = false) => {
    if (!managerOps || selectedIds.size === 0) return;
    if (!clear && !bulkTcId) {
      Alert.alert('Pick telecaller');
      return;
    }
    setBulkBusy(true);
    try {
      const data = await apiFetch<any>('/api/lead-manager/bulk-assign-telecaller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_ids: Array.from(selectedIds),
          telecaller_id: clear ? undefined : bulkTcId,
          clear,
        }),
      });
      Alert.alert('Done', data?.message || 'Updated');
      setSelectedIds(new Set());
      setRefreshing(true);
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Bulk assign failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkWa = async () => {
    if (!managerOps || selectedIds.size === 0) return;
    if (!bulkWaText.trim()) {
      Alert.alert('Enter message');
      return;
    }
    setBulkBusy(true);
    try {
      const data = await apiFetch<any>('/api/lead-manager/bulk-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_ids: Array.from(selectedIds),
          message_type: 'text',
          text: bulkWaText.trim(),
        }),
      });
      Alert.alert(
        'Bulk WhatsApp',
        `Sent ${data?.sent || 0} · DND ${data?.dnd_skipped || 0} · Failed ${data?.failed || 0}`,
      );
      setBulkWaOpen(false);
      setBulkWaText('');
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Bulk WA failed');
    } finally {
      setBulkBusy(false);
    }
  };

  // Search-as-you-type (debounce) — same as web CRM leads
  useEffect(() => {
    if (!localPrefsReady) return;
    const handle = setTimeout(() => {
      const nextQ = q.trim();
      setAppliedQ((prev) => (prev === nextQ ? prev : nextQ));
      void saveTelecallerCrmFilterPrefs({ q: nextQ });
    }, 350);
    return () => clearTimeout(handle);
  }, [q, localPrefsReady]);

  const load = useCallback(async () => {
    if (!localPrefsReady) return;
    try {
      const range = resolveCrmDateRange(datePreset, customStart, customEnd);
      const params = new URLSearchParams({
        limit: viewMode === 'chart' ? '500' : '80',
      });
      if (viewMode === 'chart') params.set('for_chart', '1');
      if (filter && filter !== 'all') params.set('filter', filter);
      if (filter === 'lost' && lostReason.trim()) params.set('lost_reason', lostReason.trim());
      if (appliedQ.trim()) params.set('q', appliedQ.trim());
      if (city.trim()) params.set('city', city.trim());
      if (priority.trim()) params.set('priority', priority.trim());
      if (dateField === 'modified') params.set('date_field', 'updated_at');
      // Name / phone / lead# search must not be limited by Last 7 Days — match web
      const searching = Boolean(appliedQ.trim());
      if (!searching && !range.allTime) {
        params.set('from', range.start);
        params.set('to', range.end);
      }
      const data = await apiFetch<any>(`/api/telecaller/crm/leads?${params.toString()}`);
      setLeads(Array.isArray(data?.leads) ? data.leads : []);
    } catch (e) {
      console.error('queue load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    localPrefsReady,
    filter,
    lostReason,
    appliedQ,
    city,
    priority,
    dateField,
    datePreset,
    customStart,
    customEnd,
    viewMode,
  ]);

  useEffect(() => {
    if (!localPrefsReady) return;
    setLoading(true);
    load();
  }, [load, localPrefsReady]);

  useEffect(() => {
    if (initialFilter) {
      setFilter(initialFilter);
      if (initialFilter !== 'lost') setLostReason('');
    }
  }, [initialFilter]);

  const persistLocalFilters = (partial: {
    q?: string;
    city?: string;
    priority?: string;
    dateField?: 'created' | 'modified';
    lostReason?: string;
    statusFilter?: string;
    advIncomplete?: boolean;
    advFollowUp?: boolean;
    advHasVehicle?: boolean;
    advHasCoupon?: boolean;
  }) => {
    void saveTelecallerCrmFilterPrefs(partial);
  };

  const displayedLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (advIncomplete && !lead.is_incomplete) return false;
      if (advFollowUp && !lead.follow_up_required && !lead.next_follow_up_at && !lead.reminder?.at) {
        return false;
      }
      if (advHasVehicle) {
        const reg = String(lead.vehicle_number || '')
          .trim()
          .toUpperCase();
        if (!reg || reg === 'NA' || reg === '—') return false;
      }
      if (advHasCoupon) {
        const code = String(lead.coupon_code || lead.coupon_meta?.coupon_code || '').trim();
        if (!code) return false;
      }
      return true;
    });
  }, [leads, advIncomplete, advFollowUp, advHasVehicle, advHasCoupon]);

  const statusChartData = useMemo(() => {
    const counts = new Map<string, number>();
    const order = [
      'Fresh',
      'Interested',
      'He will visit',
      'Follow-up',
      'Booking confirmed',
      'In Service',
      'Service Done',
      'Lost',
    ];
    for (const key of order) counts.set(key, 0);
    for (const lead of displayedLeads) {
      const label = leadDisplayStatus(lead) || 'Fresh';
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    const known = new Set(order);
    const extras = [...counts.keys()].filter((k) => !known.has(k)).sort();
    return [...order, ...extras].map((label) => {
      const tint = leadStatusKpiColors(label);
      return {
        label,
        fullLabel: label,
        value: counts.get(label) || 0,
        color: statusAccentColor(tint),
      };
    });
  }, [displayedLeads]);

  const cityChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of displayedLeads) {
      const cityName = String(lead.city || '').trim() || 'Unknown';
      counts.set(cityName, (counts.get(cityName) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], i) => ({
        label,
        fullLabel: label,
        value,
        color: ASSIGNEE_COLORS[i % ASSIGNEE_COLORS.length],
      }));
  }, [displayedLeads]);

  const openShare = async (lead: any) => {
    setShareLead(lead);
    try {
      const data = await apiFetch<any>('/api/telecaller/crm/transfer?peers=1');
      setPeers(Array.isArray(data?.peers) ? data.peers : []);
    } catch {
      setPeers([]);
    }
  };

  const doTransfer = async (toId: string) => {
    if (!shareLead) return;
    setSharing(true);
    try {
      await apiFetch('/api/telecaller/crm/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: shareLead.id,
          to_telecaller_id: toId,
          transfer_type: 'TRANSFER',
          reason: 'Transferred from MyFNG',
        }),
      });
      Alert.alert('Done', 'Lead transferred');
      setShareLead(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed');
    } finally {
      setSharing(false);
    }
  };

  const cityOptions = useMemo(
    () => [{ value: '', label: 'All cities' }, ...cities.map((c) => ({ value: c, label: c }))],
    [cities],
  );

  const closeFilters = () => {
    setShowFilters(false);
    setOpenDropdown(null);
  };

  const renderSelect = (
    key: Exclude<DropdownKey, 'date' | 'status' | null>,
    label: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    onSelect: (v: string) => void,
  ) => {
    const selected = options.find((o) => o.value === value)?.label || options[0]?.label || 'Select';
    const open = openDropdown === key;
    return (
      <View style={styles.selectWrap}>
        <Text style={styles.filterLabel}>{label}</Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setOpenDropdown(open ? null : key)}
          activeOpacity={0.85}
        >
          <Text style={styles.selectBtnText} numberOfLines={1}>{selected}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
        {open ? (
          <View style={styles.selectMenu}>
            <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {options.map((opt) => (
                <TouchableOpacity
                  key={`${key}-${opt.value || 'all'}`}
                  style={[styles.selectItem, value === opt.value && styles.selectItemActive]}
                  onPress={() => {
                    onSelect(opt.value);
                    setOpenDropdown(null);
                  }}
                >
                  <Text style={[styles.selectItemText, value === opt.value && styles.selectItemTextActive]}>
                    {opt.label}
                  </Text>
                  {value === opt.value ? (
                    <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={COLORS.textSecondary} />
        <TextInput
          style={styles.search}
          placeholder="Search name / phone / lead #"
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => {
            const nextQ = q.trim();
            setAppliedQ(nextQ);
            persistLocalFilters({ q: nextQ });
          }}
          placeholderTextColor={COLORS.textSecondary}
          returnKeyType="search"
        />
        {q.length > 0 ? (
          <TouchableOpacity
            onPress={() => {
              setQ('');
              setAppliedQ('');
              persistLocalFilters({ q: '' });
            }}
            style={styles.searchClearBtn}
            accessibilityLabel="Clear search"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnOn]}
            onPress={() => setViewMode('list')}
            accessibilityLabel="List view"
          >
            <Ionicons
              name="list"
              size={16}
              color={viewMode === 'list' ? '#fff' : COLORS.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === 'chart' && styles.viewToggleBtnOn]}
            onPress={() => setViewMode('chart')}
            accessibilityLabel="Chart view"
          >
            <Ionicons
              name="bar-chart"
              size={16}
              color={viewMode === 'chart' ? '#fff' : COLORS.primary}
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setShowFilters(true)} style={styles.filterBtn}>
          <Ionicons name="options-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Status + Date — menus overlay leads (absolute), don't push list down */}
      <View style={styles.filterSection} pointerEvents="box-none">
        <View style={styles.filterRow} pointerEvents="box-none">
          <View
            style={[
              styles.dateDropdownWrap,
              styles.filterHalf,
              openDropdown === 'status' && styles.dropdownOpen,
            ]}
          >
            <TouchableOpacity
              style={styles.dateDropdownBtn}
              onPress={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
              activeOpacity={0.85}
            >
              <Ionicons name="funnel-outline" size={16} color={COLORS.primary} />
              <Text style={styles.dateDropdownText} numberOfLines={1}>
                {statusLabel}
              </Text>
              <Ionicons
                name={openDropdown === 'status' ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
            {openDropdown === 'status' ? (
              <View style={styles.dateMenu}>
                <ScrollView
                  style={styles.dateMenuScroll}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {statusFilters.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.selectItem, filter === c.id && styles.selectItemActive]}
                      onPress={() => {
                        setFilter(c.id);
                        onFilterChange?.(c.id);
                        const nextLost = c.id === 'lost' ? lostReason : '';
                        if (c.id !== 'lost') setLostReason('');
                        persistLocalFilters({
                          statusFilter: c.id,
                          lostReason: nextLost,
                        });
                        setOpenDropdown(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.selectItemText,
                          filter === c.id && styles.selectItemTextActive,
                        ]}
                      >
                        {c.label}
                      </Text>
                      {filter === c.id ? (
                        <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <View
            style={[
              styles.dateDropdownWrap,
              styles.filterHalf,
              openDropdown === 'date' && styles.dropdownOpen,
            ]}
          >
            <TouchableOpacity
              style={styles.dateDropdownBtn}
              onPress={() => setOpenDropdown(openDropdown === 'date' ? null : 'date')}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
              <Text style={styles.dateDropdownText} numberOfLines={1}>
                {datePreset === 'custom' ? dateRange.label : dateLabel}
              </Text>
              <Ionicons
                name={openDropdown === 'date' ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
            {openDropdown === 'date' ? (
              <View style={styles.dateMenu}>
                {CRM_DATE_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.selectItem, datePreset === p.value && styles.selectItemActive]}
                    onPress={() => {
                      setDatePreset(p.value);
                      setOpenDropdown(null);
                      if (p.value === 'custom') setShowFilters(true);
                    }}
                  >
                    <Text
                      style={[
                        styles.selectItemText,
                        datePreset === p.value && styles.selectItemTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                    {datePreset === p.value ? (
                      <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {filter === 'lost' ? (
          <View
            style={[
              styles.dateDropdownWrap,
              styles.lostReasonWrap,
              openDropdown === 'lostReason' && styles.dropdownOpen,
            ]}
          >
            <TouchableOpacity
              style={styles.dateDropdownBtn}
              onPress={() => setOpenDropdown(openDropdown === 'lostReason' ? null : 'lostReason')}
              activeOpacity={0.85}
            >
              <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
              <Text style={styles.dateDropdownText} numberOfLines={1}>
                {lostReasonLabel}
              </Text>
              <Ionicons
                name={openDropdown === 'lostReason' ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
            {openDropdown === 'lostReason' ? (
              <View style={styles.dateMenu}>
                <ScrollView
                  style={styles.dateMenuScroll}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {LOST_REASON_FILTERS.map((c) => (
                    <TouchableOpacity
                      key={c.id || 'all-lost'}
                      style={[styles.selectItem, lostReason === c.id && styles.selectItemActive]}
                      onPress={() => {
                        setLostReason(c.id);
                        persistLocalFilters({ lostReason: c.id });
                        setOpenDropdown(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.selectItemText,
                          lostReason === c.id && styles.selectItemTextActive,
                        ]}
                      >
                        {c.label}
                      </Text>
                      {lostReason === c.id ? (
                        <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {loading && leads.length === 0 ? (
        <View style={{ marginTop: 36, alignItems: 'center' }}>
          <CarLoading size="compact" label="Loading leads..." />
        </View>
      ) : viewMode === 'chart' ? (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          onScrollBeginDrag={() => {
            if (openDropdown) setOpenDropdown(null);
          }}
        >
          <View style={styles.chartSummary}>
            <Text style={styles.chartSummaryValue}>{displayedLeads.length}</Text>
            <Text style={styles.chartSummaryLabel}>Leads in current filters</Text>
            <TouchableOpacity onPress={() => setViewMode('list')} style={styles.chartBackBtn}>
              <Text style={styles.chartBackText}>View list</Text>
            </TouchableOpacity>
          </View>
          <SimpleBarChart title="By status" data={statusChartData} layout="horizontal" />
          {managerOps && cityChartData.length > 0 ? (
            <SimpleBarChart title="By city" data={cityChartData} layout="horizontal" />
          ) : null}
          {displayedLeads.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="bar-chart-outline" size={40} color={COLORS.gray[300]} />
              <Text style={styles.emptyText}>No leads for chart</Text>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <FlatList
          data={displayedLeads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}
          style={styles.list}
          onScrollBeginDrag={() => {
            if (openDropdown) setOpenDropdown(null);
          }}
          onTouchStart={() => {
            if (openDropdown) setOpenDropdown(null);
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={
            managerOps && selectedIds.size > 0 ? (
              <View style={styles.bulkBar}>
                <View style={styles.bulkTopRow}>
                  <Text style={styles.bulkTitle}>{selectedIds.size} selected</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const all = new Set(displayedLeads.map((l) => String(l.id)));
                      const allSelected =
                        displayedLeads.length > 0 &&
                        displayedLeads.every((l) => selectedIds.has(String(l.id)));
                      setSelectedIds(allSelected ? new Set() : all);
                    }}
                  >
                    <Text style={styles.bulkSelectAll}>
                      {displayedLeads.length > 0 &&
                      displayedLeads.every((l) => selectedIds.has(String(l.id)))
                        ? 'Clear all'
                        : 'Select all'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {telecallers.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.bulkChip, bulkTcId === t.id && styles.bulkChipOn]}
                      onPress={() => setBulkTcId(t.id)}
                    >
                      <Text style={[styles.bulkChipText, bulkTcId === t.id && styles.bulkChipTextOn]}>
                        {t.full_name || t.id.slice(0, 6)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.bulkActions}>
                  <TouchableOpacity
                    style={styles.bulkBtn}
                    disabled={bulkBusy}
                    onPress={() => void runBulkAssign(false)}
                  >
                    <Text style={styles.bulkBtnText}>Assign</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.bulkBtn, styles.bulkBtnOutline]}
                    disabled={bulkBusy}
                    onPress={() => void runBulkAssign(true)}
                  >
                    <Text style={styles.bulkBtnOutlineText}>Unassign</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.bulkBtn, { backgroundColor: '#25D366' }]}
                    disabled={bulkBusy}
                    onPress={() => setBulkWaOpen(true)}
                  >
                    <Text style={styles.bulkBtnText}>Bulk WA</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setSelectedIds(new Set())}>
                    <Text style={styles.bulkClear}>Clear</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="file-tray-outline" size={40} color={COLORS.gray[300]} />
              <Text style={styles.emptyText}>No leads in this queue</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusLabel = leadDisplayStatus(item);
            const tint = leadStatusCardColors(
              item.is_incomplete
                ? { is_incomplete: true, display_status: statusLabel }
                : statusLabel,
            );
            const selected = selectedIds.has(String(item.id));
            const selectionMode = managerOps && selectedIds.size > 0;
            const assigneeName = String(
              item.assigned_telecaller?.full_name ||
                item.assigned_telecaller_name ||
                '',
            ).trim();
            const assigneeSeed =
              String(item.assigned_telecaller_id || item.assigned_telecaller?.id || '') ||
              assigneeName;
            return (
            <TouchableOpacity
              style={[
                styles.card,
                { backgroundColor: tint.cardBg, borderColor: tint.border, borderWidth: 1 },
                selected ? { borderColor: COLORS.primary, borderWidth: 2 } : null,
              ]}
              activeOpacity={0.9}
              delayLongPress={350}
              onLongPress={() => {
                if (!managerOps) return;
                toggleSelect(String(item.id));
              }}
              onPress={() => {
                if (selectionMode) {
                  toggleSelect(String(item.id));
                  return;
                }
                onOpenLead(item.id);
              }}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  {(() => {
                    const full = String(item.customer_name || 'Unknown').trim();
                    return (
                      <Text style={styles.name} numberOfLines={1}>
                        {full}
                      </Text>
                    );
                  })()}
                  <Text style={styles.meta}>{item.customer_phone || '—'}</Text>
                </View>
                <View style={styles.cardRightCol}>
                  <View style={[styles.statusCornerInline, { backgroundColor: tint.badgeBg }]}>
                    <Text style={[styles.statusText, { color: tint.badgeText }]} numberOfLines={1}>
                      {statusLabel}
                    </Text>
                  </View>
                  {managerOps ? (
                    <View style={styles.assigneeWrap}>
                      <View
                        style={[
                          styles.assigneeAvatar,
                          { backgroundColor: colorForAssignee(assigneeSeed) },
                        ]}
                      >
                        <Text style={styles.assigneeInitials}>
                          {assigneeInitials(assigneeName)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
                  )}
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.act, { backgroundColor: COLORS.primary }]}
                  onPress={() =>
                    void clickToCallCustomer({
                      customerPhone: item.customer_phone,
                      leadId: item.id,
                    })
                  }
                >
                  <Ionicons name="call" size={14} color="#fff" />
                  <Text style={styles.actText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.act, styles.actOutline]}
                  onPress={() => onOpenLead(item.id)}
                >
                  <Text style={styles.actOutlineText}>Open</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.act, styles.actOutline]}
                  onPress={() => openShare(item)}
                >
                  <Ionicons name="swap-horizontal-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.actOutlineText}>Transfer</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Advanced filters */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={closeFilters}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeFilters} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Advanced Filters</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={closeFilters} activeOpacity={0.85}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {renderSelect(
                'dateField',
                'Date type',
                dateField,
                [
                  { value: 'created', label: 'Created on' },
                  { value: 'modified', label: 'Modified' },
                ],
                (v) => {
                  const next = v === 'modified' ? 'modified' : 'created';
                  setDateField(next);
                  persistLocalFilters({ dateField: next });
                },
              )}

              <View style={styles.selectWrap}>
                <Text style={styles.filterLabel}>Date range</Text>
                <TouchableOpacity
                  style={styles.selectBtn}
                  onPress={() => setOpenDropdown(openDropdown === 'date' ? null : 'date')}
                >
                  <Text style={styles.selectBtnText}>
                    {datePreset === 'custom' ? dateRange.label : dateLabel}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
                {openDropdown === 'date' ? (
                  <View style={styles.selectMenu}>
                    {CRM_DATE_PRESETS.map((p) => (
                      <TouchableOpacity
                        key={p.value}
                        style={[styles.selectItem, datePreset === p.value && styles.selectItemActive]}
                        onPress={() => {
                          setDatePreset(p.value);
                          setOpenDropdown(null);
                        }}
                      >
                        <Text style={[styles.selectItemText, datePreset === p.value && styles.selectItemTextActive]}>
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>

              {datePreset === 'custom' ? (
                <View style={styles.customRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.filterLabel}>From (YYYY-MM-DD)</Text>
                    <TextInput style={styles.input} value={customStart} onChangeText={setCustomStart} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.filterLabel}>To (YYYY-MM-DD)</Text>
                    <TextInput style={styles.input} value={customEnd} onChangeText={setCustomEnd} />
                  </View>
                </View>
              ) : null}

              {renderSelect('city', 'City', city, cityOptions, (v) => {
                setCity(v);
                persistLocalFilters({ city: v });
              })}
              {renderSelect('priority', 'Priority', priority, PRIORITY_OPTIONS, (v) => {
                setPriority(v);
                persistLocalFilters({ priority: v });
              })}

              <Text style={[styles.filterLabel, { marginTop: 10 }]}>Quick filters</Text>
              {(
                [
                  {
                    key: 'advIncomplete' as const,
                    label: 'Fresh only',
                    value: advIncomplete,
                    set: setAdvIncomplete,
                  },
                  {
                    key: 'advFollowUp' as const,
                    label: 'Follow-up / reminder',
                    value: advFollowUp,
                    set: setAdvFollowUp,
                  },
                  {
                    key: 'advHasVehicle' as const,
                    label: 'Has reg. number',
                    value: advHasVehicle,
                    set: setAdvHasVehicle,
                  },
                  {
                    key: 'advHasCoupon' as const,
                    label: 'Has coupon',
                    value: advHasCoupon,
                    set: setAdvHasCoupon,
                  },
                ] as const
              ).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.advChip, opt.value && styles.advChipOn]}
                  onPress={() => {
                    const next = !opt.value;
                    opt.set(next);
                    persistLocalFilters({ [opt.key]: next });
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={opt.value ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={opt.value ? COLORS.primary : COLORS.textSecondary}
                  />
                  <Text style={[styles.advChipText, opt.value && styles.advChipTextOn]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.secondary}
                  onPress={() => {
                    setCity('');
                    setPriority('');
                    setAdvIncomplete(false);
                    setAdvFollowUp(false);
                    setAdvHasVehicle(false);
                    setAdvHasCoupon(false);
                    setDateField('created');
                    setDatePreset('today');
                    setCustomStart(istYmd());
                    setCustomEnd(istYmd());
                    persistLocalFilters({
                      city: '',
                      priority: '',
                      advIncomplete: false,
                      advFollowUp: false,
                      advHasVehicle: false,
                      advHasCoupon: false,
                      dateField: 'created',
                    });
                    setOpenDropdown(null);
                  }}
                >
                  <Text style={styles.secondaryText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primary}
                  onPress={() => {
                    persistLocalFilters({
                      city,
                      priority,
                      q: q.trim(),
                      advIncomplete,
                      advFollowUp,
                      advHasVehicle,
                      advHasCoupon,
                      dateField,
                    });
                    closeFilters();
                    setLoading(true);
                    load();
                  }}
                >
                  <Text style={styles.primaryText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Transfer */}
      <Modal visible={!!shareLead} transparent animationType="slide" onRequestClose={() => setShareLead(null)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShareLead(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Transfer Lead</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShareLead(null)}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.meta}>{shareLead?.customer_name} · #{shareLead?.lead_number}</Text>
            <ScrollView style={{ maxHeight: 320, marginTop: 12 }}>
              {peers.length === 0 ? (
                <Text style={styles.emptyText}>No peer telecallers found</Text>
              ) : (
                peers.map((p) => (
                  <View key={p.id} style={styles.peerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{p.full_name || 'Telecaller'}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.miniBtn, styles.miniPrimary, { opacity: sharing ? 0.5 : 1 }]}
                      disabled={sharing}
                      onPress={() => doTransfer(p.id)}
                    >
                      <Text style={[styles.miniBtnText, { color: '#fff' }]}>Transfer</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={bulkWaOpen} transparent animationType="slide" onRequestClose={() => setBulkWaOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setBulkWaOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Bulk WhatsApp · {selectedIds.size}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setBulkWaOpen(false)}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.meta}>Manager only · DND numbers skipped</Text>
            <TextInput
              style={[styles.search, { marginTop: 12, minHeight: 100, textAlignVertical: 'top' }]}
              multiline
              placeholder="Message text…"
              value={bulkWaText}
              onChangeText={setBulkWaText}
            />
            <TouchableOpacity
              style={[styles.bulkBtn, { marginTop: 12, backgroundColor: '#25D366', alignItems: 'center' }]}
              disabled={bulkBusy}
              onPress={() => void runBulkWa()}
            >
              <Text style={styles.bulkBtnText}>{bulkBusy ? 'Sending…' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, overflow: 'visible' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: SPACING.md,
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    ...SHADOWS.small,
  },
  search: { flex: 1, paddingVertical: 10, color: COLORS.textPrimary },
  searchClearBtn: {
    padding: 2,
    marginRight: 2,
  },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  viewToggleBtn: {
    width: 30,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleBtnOn: {
    backgroundColor: COLORS.primary,
  },
  filterBtn: { padding: 6 },
  chartSummary: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  chartSummaryValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
  },
  chartSummaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  chartBackBtn: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  chartBackText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  filterSection: {
    zIndex: 50,
    elevation: 50,
    marginBottom: 8,
    overflow: 'visible',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: SPACING.md,
    alignItems: 'flex-start',
    zIndex: 60,
    elevation: 60,
    overflow: 'visible',
  },
  list: {
    flex: 1,
    zIndex: 1,
  },
  filterHalf: {
    flex: 1,
    marginHorizontal: 0,
    marginBottom: 0,
  },
  lostReasonWrap: {
    marginHorizontal: SPACING.md,
    marginTop: 8,
  },
  dateDropdownWrap: {
    position: 'relative',
    zIndex: 20,
    elevation: 20,
  },
  dropdownOpen: {
    zIndex: 70,
    elevation: 70,
  },
  dateDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...SHADOWS.small,
  },
  dateDropdownText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  dateMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    zIndex: 80,
    elevation: 24,
    ...SHADOWS.large,
  },
  dateMenuScroll: {
    maxHeight: 320,
  },
  selectWrap: { marginTop: 10, zIndex: 5 },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  selectBtnText: { flex: 1, color: COLORS.textPrimary, fontWeight: '600', fontSize: 13 },
  selectMenu: {
    marginTop: 6,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  selectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  selectItemActive: { backgroundColor: COLORS.primary + '10' },
  selectItemText: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  selectItemTextActive: { color: COLORS.primary, fontWeight: '700' },
  filterLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6 },
  customRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  card: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    ...SHADOWS.small,
  },
  statusCornerInline: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 110,
    alignSelf: 'flex-end',
  },
  bulkTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bulkSelectAll: {
    color: '#BFDBFE',
    fontWeight: '800',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  bulkBar: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  bulkTitle: { color: '#fff', fontWeight: '800', fontSize: 13 },
  bulkChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 6,
  },
  bulkChipOn: { backgroundColor: '#fff' },
  bulkChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bulkChipTextOn: { color: COLORS.primary },
  bulkActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  bulkBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bulkBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 12 },
  bulkBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  bulkBtnOutlineText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  bulkClear: { color: '#fff', fontWeight: '600', fontSize: 12, marginLeft: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  cardRightCol: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  assigneeWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  assigneeAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigneeInitials: { color: '#fff', fontSize: 10, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  nameSecond: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginTop: 1 },
  status: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, maxWidth: 120, flexShrink: 1 },
  statusText: { fontSize: 10, fontWeight: '700' },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray[200] || '#E5E7EB',
  },
  msgPreview: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textPrimary,
    lineHeight: 16,
  },
  histBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray[200] || '#E5E7EB',
  },
  histTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  histLine: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
    marginBottom: 2,
  },
  coupon: { fontSize: 12, color: COLORS.orange, fontWeight: '600', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  act: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  actOutline: { backgroundColor: COLORS.primary + '12' },
  actOutlineText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  actIcon: {
    flex: 0,
    width: 40,
    paddingHorizontal: 0,
    backgroundColor: COLORS.primary + '12',
  },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { color: COLORS.textSecondary },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textHeading, flex: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    backgroundColor: COLORS.gray[50],
  },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 8 },
  primary: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  advChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border || '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: COLORS.white,
  },
  advChipOn: {
    borderColor: COLORS.primary,
    backgroundColor: '#EFF6FF',
  },
  advChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  advChipTextOn: { color: COLORS.primary },
  secondary: {
    flex: 1,
    backgroundColor: COLORS.gray[100],
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryText: { color: COLORS.textPrimary, fontWeight: '600' },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  miniBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  miniPrimary: { backgroundColor: COLORS.primary },
  miniBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
});
