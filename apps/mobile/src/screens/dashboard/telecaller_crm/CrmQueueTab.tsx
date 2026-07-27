import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  Linking,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';
import {
  CRM_DATE_PRESETS,
  resolveCrmDateRange,
  type CrmDatePreset,
  istYmd,
} from '../../../lib/crmDateRange';

const SOURCE_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'WHATSAPP_META', label: 'Meta Ads (WA)' },
  { value: 'MOBILE_APP', label: 'App' },
  { value: 'WEB', label: 'Website' },
  { value: 'TELECALLER_CRM', label: 'CRM' },
  { value: 'TELECALLER', label: 'Telecaller' },
  { value: 'ENQUIRY', label: 'Enquiry' },
];

function formatCrmSource(lead: any): string {
  const from = String(lead?.created_from || '').toUpperCase();
  const src = String(lead?.lead_source || '').trim();
  if (from.includes('META') || /instagram|facebook|meta ads/i.test(src)) {
    return src || 'Meta Ads';
  }
  if (from.includes('WHATSAPP') || /whatsapp/i.test(src)) return src || 'WhatsApp';
  if (from.includes('TELECALLER_CRM')) return 'CRM';
  if (from.includes('MOBILE') || from.includes('APP')) return 'App';
  if (from === 'WEB' || from.includes('WEBSITE')) return 'Website';
  return src || lead?.created_from || '—';
}

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
  datePreset?: CrmDatePreset;
  customStart?: string;
  customEnd?: string;
  onDatePresetChange?: (v: CrmDatePreset) => void;
  onCustomStartChange?: (v: string) => void;
  onCustomEndChange?: (v: string) => void;
};

type DropdownKey = 'date' | 'status' | 'lostReason' | 'city' | 'source' | 'priority' | null;

/** Match lead detail "Select status" + All / New */
const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'incomplete', label: 'Incomplete' },
  { id: 'interested', label: 'Interested' },
  { id: 'will_visit', label: 'He will visit' },
  { id: 'booking_confirmed', label: 'Booking confirmed' },
  { id: 'in_service', label: 'In Service' },
  { id: 'service_done', label: 'Service Done' },
  { id: 'lost', label: 'Lost' },
];

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
  if (/^lost\b/i.test(s)) return 'Lost';
  return s;
}

function leadDisplayStatus(lead: any): string {
  const label = String(lead?.coupon_meta?.last_call_label || '').trim();
  // Keep "Web OTP Verified" / "Mob OTP Verified" as-is (don't shorten)
  if (label && /otp verified/i.test(label)) return label;
  if (label) return shortLeadStatusLabel(label);
  const result = String(lead?.coupon_meta?.last_call_result || '').toUpperCase();
  const mapResult: Record<string, string> = {
    INTERESTED: 'Interested',
    WILL_VISIT: 'He will visit',
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
    NEW: 'New',
    VALIDATED: 'Booking confirmed',
    IN_PROGRESS: 'In Service',
    COMPLETED: 'Service Done',
    REJECTED: 'Lost',
    CONTACTED: 'Contacted',
    ASSIGNED: 'Assigned',
    ACCEPTED: 'Accepted',
  };
  return shortLeadStatusLabel(mapStatus[status] || status.replace(/_/g, ' ') || 'New');
}

/** Whole-card light tint by display status */
function leadStatusCardColors(label: string): {
  cardBg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
} {
  const s = String(label || '').toUpperCase();
  // Lost first — labels like "Lost · Already Service Done" must not match Service Done green
  if (s.includes('LOST') || s === 'REJECTED') {
    return { cardBg: '#FEF2F2', border: '#FECACA', badgeBg: '#FEE2E2', badgeText: '#B91C1C' };
  }
  if (s.includes('BOOKING') || s === 'SERVICE DONE' || s.startsWith('SERVICE DONE') || s === 'COMPLETED') {
    return { cardBg: '#ECFDF5', border: '#A7F3D0', badgeBg: '#D1FAE5', badgeText: '#047857' };
  }
  if (s.includes('IN SERVICE') || s === 'IN_PROGRESS') {
    return { cardBg: '#EFF6FF', border: '#BFDBFE', badgeBg: '#DBEAFE', badgeText: '#1D4ED8' };
  }
  if (s.includes('WILL VISIT')) {
    return { cardBg: '#F5F3FF', border: '#DDD6FE', badgeBg: '#EDE9FE', badgeText: '#6D28D9' };
  }
  if (s.includes('INTERESTED')) {
    return { cardBg: '#FFF7ED', border: '#FED7AA', badgeBg: '#FFEDD5', badgeText: '#C2410C' };
  }
  if (s.includes('OTP')) {
    return { cardBg: '#FFFBEB', border: '#FDE68A', badgeBg: '#FEF3C7', badgeText: '#B45309' };
  }
  if (s === 'NEW' || s.includes('INCOMPLETE')) {
    return { cardBg: '#F8FAFC', border: '#E2E8F0', badgeBg: '#E2E8F0', badgeText: '#475569' };
  }
  return { cardBg: COLORS.white, border: COLORS.border || '#E5E7EB', badgeBg: '#F1F5F9', badgeText: '#475569' };
}

export default function CrmQueueTab({
  initialFilter = 'all',
  onOpenLead,
  onEditLead,
  datePreset: datePresetProp,
  customStart: customStartProp,
  customEnd: customEndProp,
  onDatePresetChange,
  onCustomStartChange,
  onCustomEndChange,
}: Props) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(initialFilter);
  const [lostReason, setLostReason] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [city, setCity] = useState('');
  const [source, setSource] = useState('');
  const [priority, setPriority] = useState('');
  const [datePresetLocal, setDatePresetLocal] = useState<CrmDatePreset>('today');
  const [customStartLocal, setCustomStartLocal] = useState(istYmd());
  const [customEndLocal, setCustomEndLocal] = useState(istYmd());
  const [cities, setCities] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
  const [shareLead, setShareLead] = useState<any>(null);
  const [peers, setPeers] = useState<any[]>([]);
  const [sharing, setSharing] = useState(false);

  const datePreset = datePresetProp ?? datePresetLocal;
  const customStart = customStartProp ?? customStartLocal;
  const customEnd = customEndProp ?? customEndLocal;
  const setDatePreset = onDatePresetChange || setDatePresetLocal;
  const setCustomStart = onCustomStartChange || setCustomStartLocal;
  const setCustomEnd = onCustomEndChange || setCustomEndLocal;

  const dateRange = resolveCrmDateRange(datePreset, customStart, customEnd);
  const statusLabel = STATUS_FILTERS.find((c) => c.id === filter)?.label || 'All';
  const lostReasonLabel =
    LOST_REASON_FILTERS.find((c) => c.id === lostReason)?.label || 'All lost reasons';
  const dateLabel = CRM_DATE_PRESETS.find((p) => p.value === datePreset)?.label || dateRange.label;

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

  const load = useCallback(async () => {
    try {
      const range = resolveCrmDateRange(datePreset, customStart, customEnd);
      const params = new URLSearchParams({ limit: '80' });
      if (filter && filter !== 'all') params.set('filter', filter);
      if (filter === 'lost' && lostReason.trim()) params.set('lost_reason', lostReason.trim());
      if (q.trim()) params.set('q', q.trim());
      if (city.trim()) params.set('city', city.trim());
      if (source.trim()) params.set('source', source.trim());
      if (priority.trim()) params.set('priority', priority.trim());
      if (!range.allTime) {
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
  }, [filter, lostReason, q, city, source, priority, datePreset, customStart, customEnd]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (initialFilter) {
      setFilter(initialFilter);
      if (initialFilter !== 'lost') setLostReason('');
    }
  }, [initialFilter]);

  const openShare = async (lead: any) => {
    setShareLead(lead);
    try {
      const data = await apiFetch<any>('/api/telecaller/crm/transfer?peers=1');
      setPeers(Array.isArray(data?.peers) ? data.peers : []);
    } catch {
      setPeers([]);
    }
  };

  const doTransfer = async (toId: string, type: 'TRANSFER' | 'SHARE') => {
    if (!shareLead) return;
    setSharing(true);
    try {
      await apiFetch('/api/telecaller/crm/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: shareLead.id,
          to_telecaller_id: toId,
          transfer_type: type,
          reason: type === 'SHARE' ? 'Shared from Advanced CRM' : 'Transferred from Advanced CRM',
        }),
      });
      Alert.alert('Done', type === 'SHARE' ? 'Lead shared' : 'Lead transferred');
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
          onSubmitEditing={load}
          placeholderTextColor={COLORS.textSecondary}
        />
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
                  {STATUS_FILTERS.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.selectItem, filter === c.id && styles.selectItemActive]}
                      onPress={() => {
                        setFilter(c.id);
                        if (c.id !== 'lost') setLostReason('');
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

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={leads}
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="file-tray-outline" size={40} color={COLORS.gray[300]} />
              <Text style={styles.emptyText}>No leads in this queue</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusLabel = leadDisplayStatus(item);
            const tint = leadStatusCardColors(statusLabel);
            return (
            <View
              style={[
                styles.card,
                { backgroundColor: tint.cardBg, borderColor: tint.border, borderWidth: 1 },
              ]}
            >
              <TouchableOpacity onPress={() => onOpenLead(item.id)}>
                <View style={styles.cardTop}>
                  <Text style={styles.name} numberOfLines={1}>{item.customer_name}</Text>
                  <View style={[styles.status, { backgroundColor: tint.badgeBg }]}>
                    <Text style={[styles.statusText, { color: tint.badgeText }]} numberOfLines={1}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>
                <Text style={styles.meta}>#{item.lead_number} · {item.customer_phone}</Text>
                <Text style={styles.meta}>
                  {item.city || '—'} · {item.workshop?.name || 'No workshop'} · {formatCrmSource(item)}
                </Text>
                {item.vehicle_number && String(item.vehicle_number).toUpperCase() !== 'NA' ? (
                  <Text style={styles.meta}>
                    {[item.vehicle_number, item.vehicle_make, item.vehicle_model].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                {item.message_preview || item.coupon_meta?.last_inbound_message || item.problem_description ? (
                  <View style={styles.msgRow}>
                    <Ionicons
                      name={item.is_whatsapp_lead ? 'logo-whatsapp' : 'chatbubble-ellipses-outline'}
                      size={13}
                      color={item.is_whatsapp_lead ? '#25D366' : COLORS.textSecondary}
                    />
                    <Text style={styles.msgPreview} numberOfLines={2}>
                      {item.message_preview ||
                        item.coupon_meta?.last_inbound_message ||
                        item.problem_description}
                    </Text>
                  </View>
                ) : null}
                {Array.isArray(item.history_preview) && item.history_preview.length > 0 ? (
                  <View style={styles.histBox}>
                    <Text style={styles.histTitle}>History</Text>
                    {item.history_preview.slice(0, 2).map((h: any, idx: number) => (
                      <Text key={`${h.at || idx}`} style={styles.histLine} numberOfLines={2}>
                        • {h.summary || 'Updated'}
                        {h.previous_label ? ` (was ${h.previous_label})` : ''}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {item.coupon_code ? (
                  <Text style={styles.coupon}>Coupon: {item.coupon_code}</Text>
                ) : null}
              </TouchableOpacity>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.act, { backgroundColor: COLORS.primary }]}
                  onPress={() => Linking.openURL(`tel:${item.customer_phone}`)}
                >
                  <Ionicons name="call" size={14} color="#fff" />
                  <Text style={styles.actText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.act, styles.actOutline]} onPress={() => onOpenLead(item.id)}>
                  <Text style={styles.actOutlineText}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.act, styles.actIcon]}
                  onPress={() => (onEditLead ? onEditLead(item.id) : onOpenLead(item.id))}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="pencil" size={15} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.act, styles.actOutline]} onPress={() => openShare(item)}>
                  <Ionicons name="share-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.actOutlineText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
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

              {renderSelect('city', 'City', city, cityOptions, setCity)}
              {renderSelect('source', 'Source', source, SOURCE_OPTIONS, setSource)}
              {renderSelect('priority', 'Priority', priority, PRIORITY_OPTIONS, setPriority)}

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.secondary}
                  onPress={() => {
                    setCity('');
                    setSource('');
                    setPriority('');
                    setDatePreset('today');
                    setCustomStart(istYmd());
                    setCustomEnd(istYmd());
                    setOpenDropdown(null);
                  }}
                >
                  <Text style={styles.secondaryText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primary}
                  onPress={() => {
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

      {/* Share / Transfer */}
      <Modal visible={!!shareLead} transparent animationType="slide" onRequestClose={() => setShareLead(null)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShareLead(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Share / Transfer Lead</Text>
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
                      <Text style={styles.meta}>{p.phone || p.email}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.miniBtn, { opacity: sharing ? 0.5 : 1 }]}
                      disabled={sharing}
                      onPress={() => doTransfer(p.id, 'SHARE')}
                    >
                      <Text style={styles.miniBtnText}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.miniBtn, styles.miniPrimary, { opacity: sharing ? 0.5 : 1 }]}
                      disabled={sharing}
                      onPress={() => doTransfer(p.id, 'TRANSFER')}
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
  filterBtn: { padding: 6 },
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
    padding: 14,
    marginBottom: 10,
    ...SHADOWS.small,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1, minWidth: 0 },
  status: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, maxWidth: '46%', flexShrink: 0 },
  statusText: { fontSize: 10, fontWeight: '700' },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
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
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  act: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
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
