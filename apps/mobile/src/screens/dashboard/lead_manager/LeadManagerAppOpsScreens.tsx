import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';
import CrmSavedViewsSheet, { type MobileSavedViewFilters } from '../../../components/CrmSavedViewsSheet';
import { leadStatusKpiColors } from '../../../lib/telecaller/leadStatusColors';
import { formatDateDMY } from '@/lib/dateFormat';

function OpsShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.shellBody}>{children}</View>
    </SafeAreaView>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value)?.label || label;
  return (
    <View style={styles.ddWrap}>
      <Text style={styles.ddLbl}>{label}</Text>
      <TouchableOpacity style={styles.ddBtn} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={styles.ddVal} numberOfLines={1}>
          {selected}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#64748B" />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.ddBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.ddSheet} onPress={() => undefined}>
            <Text style={styles.ddSheetTitle}>{label}</Text>
            {options.map((opt) => {
              const on = opt.id === value;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.ddOpt, on && styles.ddOptOn]}
                  onPress={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.ddOptTxt, on && styles.ddOptTxtOn]}>{opt.label}</Text>
                  {on ? <Ionicons name="checkmark" size={16} color={COLORS.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#94A3B8"
      style={styles.input}
      autoCorrect={false}
    />
  );
}

const STATUS_CHIPS = [
  { id: 'ALL', label: 'All' },
  { id: 'NEW', label: 'New' },
  { id: 'ASSIGNED', label: 'Assigned' },
  { id: 'ACCEPTED', label: 'Accepted' },
  { id: 'IN_PROGRESS', label: 'In progress' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'HOLD', label: 'Hold' },
  { id: 'CANCELLED', label: 'Cancelled' },
] as const;

const DATE_CHIPS = [
  { id: 'today', label: 'Today' },
  { id: 'last_7_days', label: '7 days' },
  { id: 'last_30_days', label: '30 days' },
  { id: 'this_month', label: 'This month' },
  { id: 'all_time', label: 'All time' },
] as const;

const SOURCE_CHIPS = [
  { id: 'ALL', label: 'All sources' },
  { id: 'APP', label: 'App' },
  { id: 'WEBSITE', label: 'Website' },
  { id: 'MISA', label: 'MISA AI' },
  { id: 'GOOGLE', label: 'Google Ads' },
  { id: 'META', label: 'Meta / Insta' },
  { id: 'WHATSAPP', label: 'WhatsApp' },
] as const;

const COUPON_CHIPS = [
  { id: 'ALL', label: 'All coupons' },
  { id: 'YES', label: 'Any coupon' },
  { id: 'PROMO', label: 'Promo' },
  { id: 'REFERRAL', label: 'Refer & Rise' },
  { id: 'NO', label: 'No coupon' },
] as const;

function leadServiceLabel(item: any): string {
  return String(
    item.service_display ||
      item.service_type ||
      item.package_name ||
      item.lead_type ||
      '—',
  );
}

function leadAmount(item: any): string {
  const n = Number(item.display_amount ?? item.final_amount ?? item.estimated_amount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function LeadManagerAppBookingsScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [statusChip, setStatusChip] = useState('ALL');
  const [rows, setRows] = useState<any[]>([]);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [viewName, setViewName] = useState('All Leads');
  const [applied, setApplied] = useState<MobileSavedViewFilters>({});
  const [tagLeadIds, setTagLeadIds] = useState<Set<string> | null>(null);
  const [sourceChip, setSourceChip] = useState('ALL');
  const [couponChip, setCouponChip] = useState('ALL');
  const [dateChip, setDateChip] = useState('all_time');
  const [summary, setSummary] = useState<{
    total_fetched?: number;
    total_filtered?: number;
    total_in_range?: number | null;
    truncated?: boolean;
  } | null>(null);

  const datePreset = String(applied.datePreset || dateChip || 'all_time');
  const sourceFilter = String(applied.source || sourceChip || 'ALL').toUpperCase();
  const couponFilter = String(applied.coupon || couponChip || 'ALL').toUpperCase();

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: '5000',
        preset: datePreset || 'all_time',
      });
      if (applied.customStart) params.set('start', String(applied.customStart));
      if (applied.customEnd) params.set('end', String(applied.customEnd));
      if (statusChip && statusChip !== 'ALL') params.set('status', statusChip);
      if (sourceFilter && sourceFilter !== 'ALL') params.set('source', sourceFilter);
      if (couponFilter && couponFilter !== 'ALL') params.set('has_coupon', couponFilter);
      const data = await apiFetch<any>(`/api/super_admin/leads?${params.toString()}`);
      setRows(Array.isArray(data?.leads) ? data.leads : []);
      setSummary(data?.summary || null);
    } catch (e: any) {
      Alert.alert('Bookings', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [datePreset, applied.customStart, applied.customEnd, statusChip, sourceFilter, couponFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const tagIds = Array.isArray(applied.tagIds) ? applied.tagIds.filter(Boolean) : [];
    if (tagIds.length === 0) {
      setTagLeadIds(null);
      return;
    }
    let cancelled = false;
    apiFetch<any>(`/api/lead-manager/tags?map_tag_ids=${encodeURIComponent(tagIds.join(','))}`)
      .then((json) => {
        if (cancelled) return;
        const ids = new Set<string>();
        const mode = applied.tagMode === 'all' ? 'all' : 'any';
        const byLead = new Map<string, Set<string>>();
        for (const row of Array.isArray(json?.maps) ? json.maps : []) {
          const leadId = String(row?.lead_id || '');
          const tagId = String(row?.tag_id || '');
          if (!leadId || !tagId) continue;
          const set = byLead.get(leadId) || new Set<string>();
          set.add(tagId);
          byLead.set(leadId, set);
        }
        for (const [leadId, have] of byLead) {
          const ok = mode === 'all' ? tagIds.every((id) => have.has(id)) : tagIds.some((id) => have.has(id));
          if (ok) ids.add(leadId);
        }
        setTagLeadIds(ids);
      })
      .catch(() => {
        if (!cancelled) setTagLeadIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [applied.tagIds, applied.tagMode]);

  const filtered = rows.filter((item) => {
    const needle = (applied.search || q).trim().toLowerCase();
    if (needle) {
      const hit = [item.customer_name, item.customer_phone, item.lead_number, item.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
      if (!hit) return false;
    }
    const status = String(applied.status || statusChip || 'ALL').toUpperCase();
    if (status && status !== 'ALL' && String(item.status || 'NEW').toUpperCase() !== status) return false;
    const source = String(applied.source || 'ALL').toUpperCase();
    if (source && source !== 'ALL') {
      const leadSource = String(item.lead_source || item.source || '').toUpperCase();
      if (!leadSource.includes(source) && source !== 'ALL') {
        if (source === 'WEBSITE' && !/WEB|SITE/.test(leadSource)) return false;
        if (source === 'APP' && !leadSource.includes('APP')) return false;
        if (source !== 'WEBSITE' && source !== 'APP' && !leadSource.includes(source)) return false;
      }
    }
    const assignees = Array.isArray(applied.assignees) ? applied.assignees : [];
    if (assignees.length > 0) {
      const name = String(item.assigned_telecaller_name || '').trim();
      const selected = new Set(assignees.map((a) => a.trim().toLowerCase()));
      if (!name) {
        if (!selected.has('unassigned')) return false;
      } else if (!selected.has(name.toLowerCase())) {
        return false;
      }
    }
    if (tagLeadIds) {
      if (!tagLeadIds.has(String(item.id))) return false;
    }
    const rec = String(applied.recording || 'ALL').toUpperCase();
    if (rec === 'YES' && !(item.has_recording || item.call_recording_url || item.has_call_recording)) {
      return false;
    }
    if (rec === 'NO' && (item.has_recording || item.call_recording_url || item.has_call_recording)) {
      return false;
    }
    const triggers = Array.isArray(applied.messageTriggers) ? applied.messageTriggers : [];
    if (triggers.length > 0) {
      const meta = item.coupon_meta && typeof item.coupon_meta === 'object' ? item.coupon_meta : {};
      const id = String(meta.message_trigger_id || '').trim();
      const label = String(meta.message_trigger_label || '').trim();
      const selected = new Set(triggers);
      if (!id && !label) {
        if (!selected.has('NONE')) return false;
      } else if (!selected.has(id) && !selected.has(label)) {
        return false;
      }
    }
    return true;
  });

  const kpis = {
    total: rows.length,
    fresh: rows.filter((r) => String(r.status || '').toUpperCase() === 'NEW').length,
    assigned: rows.filter((r) => String(r.status || '').toUpperCase() === 'ASSIGNED').length,
    completed: rows.filter((r) => String(r.status || '').toUpperCase() === 'COMPLETED').length,
    sla: rows.filter((r) => String(r.sla_state || '').toUpperCase() === 'BREACHED').length,
  };

  const goBack = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('SuperAdminDashboard');
  };

  return (
    <SafeAreaView style={styles.bookingsSafe} edges={['top']}>
      <View style={styles.bookingsHeader}>
        <TouchableOpacity style={styles.bookingsBack} onPress={goBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookingsTitle}>Bookings & Leads</Text>
          <Text style={styles.bookingsSub}>
            {summary?.truncated
              ? `Showing ${filtered.length.toLocaleString('en-IN')} of ${(summary.total_in_range || 0).toLocaleString('en-IN')}`
              : `${filtered.length.toLocaleString('en-IN')} records`}
          </Text>
        </View>
        <TouchableOpacity style={styles.bookingsViewBtn} onPress={() => setViewsOpen(true)}>
          <Ionicons name="funnel-outline" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.kpiRow}>
        <View style={[styles.kpi, { backgroundColor: '#EFF6FF' }]}>
          <Text style={styles.kpiVal}>{kpis.total}</Text>
          <Text style={styles.kpiLbl}>Total</Text>
        </View>
        <View style={[styles.kpi, { backgroundColor: '#FEF3C7' }]}>
          <Text style={styles.kpiVal}>{kpis.fresh}</Text>
          <Text style={styles.kpiLbl}>New</Text>
        </View>
        <View style={[styles.kpi, { backgroundColor: '#ECFDF5' }]}>
          <Text style={styles.kpiVal}>{kpis.completed}</Text>
          <Text style={styles.kpiLbl}>Done</Text>
        </View>
        <View style={[styles.kpi, { backgroundColor: '#FEF2F2' }]}>
          <Text style={styles.kpiVal}>{kpis.sla}</Text>
          <Text style={styles.kpiLbl}>SLA</Text>
        </View>
      </View>

      <View style={styles.toolbar}>
        <Text style={styles.viewChip}>{viewName}</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search name, phone, L-number"
          placeholderTextColor="#94A3B8"
          style={styles.bookingsSearch}
          autoCorrect={false}
        />
      </View>

      <View style={styles.filterRow}>
        <FilterDropdown
          label="Date"
          value={datePreset}
          options={DATE_CHIPS}
          onChange={(id) => {
            setDateChip(id);
            setApplied((prev) => ({ ...prev, datePreset: id }));
          }}
        />
        <FilterDropdown
          label="Source"
          value={sourceFilter}
          options={SOURCE_CHIPS}
          onChange={(id) => {
            setSourceChip(id);
            setApplied((prev) => ({ ...prev, source: id }));
          }}
        />
      </View>
      <View style={styles.filterRow}>
        <FilterDropdown
          label="Coupon"
          value={couponFilter}
          options={COUPON_CHIPS}
          onChange={(id) => {
            setCouponChip(id);
            setApplied((prev) => ({ ...prev, coupon: id }));
          }}
        />
        <FilterDropdown
          label="Status"
          value={statusChip}
          options={STATUS_CHIPS}
          onChange={(id) => setStatusChip(id)}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          renderItem={({ item }) => {
            const tint = leadStatusKpiColors(item);
            const status = String(item.status || 'NEW').replace(/_/g, ' ');
            return (
              <TouchableOpacity
                style={[styles.leadCard, { backgroundColor: tint.cardBg, borderColor: tint.border }]}
                onPress={() => navigation.navigate('LeadManagerLeadDetail', { leadId: item.id })}
                activeOpacity={0.85}
              >
                <View style={styles.row}>
                  <Text style={styles.leadNo} numberOfLines={1}>
                    {item.lead_number || `#${String(item.id).slice(0, 8)}`}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: tint.badgeBg }]}>
                    <Text style={[styles.statusPillTxt, { color: tint.badgeText }]}>{status}</Text>
                  </View>
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {item.customer_name || item.customer_phone || 'Lead'}
                </Text>
                <Text style={styles.meta}>
                  {[item.customer_phone, item.city].filter(Boolean).join(' · ') || '—'}
                </Text>
                <View style={styles.leadGrid}>
                  <View style={styles.leadCell}>
                    <Text style={styles.leadCellLbl}>Service</Text>
                    <Text style={styles.leadCellVal} numberOfLines={1}>
                      {leadServiceLabel(item)}
                    </Text>
                  </View>
                  <View style={styles.leadCell}>
                    <Text style={styles.leadCellLbl}>Amount</Text>
                    <Text style={styles.leadCellVal}>{leadAmount(item)}</Text>
                  </View>
                  <View style={styles.leadCell}>
                    <Text style={styles.leadCellLbl}>Date</Text>
                    <Text style={styles.leadCellVal}>{formatDateDMY(item.created_at) || '—'}</Text>
                  </View>
                </View>
                {item.assigned_telecaller_name ? (
                  <Text style={styles.assignee}>Assignee · {item.assigned_telecaller_name}</Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No bookings found for this filter.</Text>}
        />
      )}
      <CrmSavedViewsSheet
        visible={viewsOpen}
        onClose={() => setViewsOpen(false)}
        currentFilters={{
          ...applied,
          search: q,
          datePreset: datePreset,
          status: statusChip,
          source: sourceFilter,
          coupon: couponFilter,
        }}
        onApply={(filters, name) => {
          setApplied(filters || {});
          setViewName(name || 'Saved view');
          if (filters?.search) setQ(String(filters.search));
          if (filters?.status) setStatusChip(String(filters.status).toUpperCase());
          if (filters?.source) setSourceChip(String(filters.source).toUpperCase());
          if (filters?.coupon) setCouponChip(String(filters.coupon).toUpperCase());
          if (filters?.datePreset) setDateChip(String(filters.datePreset));
          if (!filters || Object.keys(filters).length === 0) {
            setQ('');
            setStatusChip('ALL');
            setSourceChip('ALL');
            setCouponChip('ALL');
            setDateChip('all_time');
            setViewName('All Leads');
          }
        }}
      />
    </SafeAreaView>
  );
}

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function fmtWhen(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function addressLine(a: any) {
  return [a?.line1, a?.line2, a?.city, a?.state, a?.pincode].filter(Boolean).join(', ');
}

export function LeadManagerAppCustomersScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [eventsExpanded, setEventsExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50', page: '1' });
      if (q.trim()) params.set('search', q.trim());
      const data = await apiFetch<any>(`/api/super_admin/customers?${params.toString()}`);
      setRows(Array.isArray(data?.customers) ? data.customers : []);
      setOverview(data?.overview || null);
    } catch (e: any) {
      Alert.alert('App Customers', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCustomer = async (row: any) => {
    setSelected(row);
    setDetail(null);
    setEventsExpanded(false);
    setDetailLoading(true);
    try {
      const data = await apiFetch<any>(`/api/super_admin/customers/${row.id}`);
      setDetail(data);
    } catch (e: any) {
      Alert.alert('Customer', e?.message || 'Failed to load profile');
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeCustomer = () => {
    setSelected(null);
    setDetail(null);
  };

  const activeMembership = (detail?.memberships || []).find(
    (m: any) => m.status === 'ACTIVE' && new Date(String(m.ends_at || 0)).getTime() > Date.now(),
  );
  const customer = detail?.customer || selected;

  return (
    <OpsShell title="App Customers">
      <SearchBox value={q} onChange={setQ} placeholder="Search name / phone / email" />
      {overview ? (
        <View style={styles.stats}>
          <View style={[styles.stat, { backgroundColor: '#EEF2FF' }]}>
            <Text style={styles.statVal}>{overview.total ?? overview.total_customers ?? '—'}</Text>
            <Text style={styles.statLbl}>Customers</Text>
          </View>
        </View>
      ) : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
          contentContainerStyle={{ padding: SPACING.md }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => void openCustomer(item)} activeOpacity={0.8}>
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.full_name || item.phone || 'Customer'}
                </Text>
                <Text style={[styles.badge, item.is_active ? styles.badgeOn : styles.badgeOff]}>
                  {item.is_active ? 'Active' : 'Off'}
                </Text>
              </View>
              <Text style={styles.meta}>
                {[item.phone, item.email, item.app_platform].filter(Boolean).join(' · ')}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No customers found.</Text>}
        />
      )}

      <Modal visible={!!selected} animationType="slide" onRequestClose={closeCustomer}>
        <SafeAreaView style={styles.shell} edges={['top']}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={closeCustomer} hitSlop={12}>
              <Ionicons name="close" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.topTitle} numberOfLines={1}>
              {customer?.full_name || customer?.phone || 'Customer'}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          {detailLoading || !detail ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.primary} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}>
              <Text style={styles.meta}>{[customer?.phone, customer?.email].filter(Boolean).join(' · ')}</Text>

              <View style={styles.kpiRow}>
                <View style={[styles.kpi, { backgroundColor: '#ECFDF5' }]}>
                  <Text style={styles.kpiVal}>
                    {inr(Number(detail.wallet?.spendable_balance ?? detail.wallet?.current_balance ?? 0))}
                  </Text>
                  <Text style={styles.kpiLbl}>Wallet</Text>
                </View>
                <View style={[styles.kpi, { backgroundColor: '#F5F3FF' }]}>
                  <Text style={styles.kpiVal} numberOfLines={1}>
                    {activeMembership ? activeMembership.plan?.name || 'Active' : 'None'}
                  </Text>
                  <Text style={styles.kpiLbl}>Membership</Text>
                </View>
                <View style={[styles.kpi, { backgroundColor: '#EFF6FF' }]}>
                  <Text style={styles.kpiVal}>{detail.service_bookings?.length || 0}</Text>
                  <Text style={styles.kpiLbl}>Bookings</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Addresses</Text>
              {(detail.addresses || []).length ? (
                (detail.addresses || []).map((a: any) => (
                  <View key={a.id} style={styles.card}>
                    <Text style={styles.name}>{a.label || 'Address'}{a.is_default ? ' · Default' : ''}</Text>
                    <Text style={styles.meta}>{addressLine(a) || '—'}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyHint}>No address saved</Text>
              )}

              <Text style={styles.sectionTitle}>Vehicles</Text>
              {(detail.vehicles || []).length ? (
                (detail.vehicles || []).map((v: any) => (
                  <View key={v.id} style={styles.card}>
                    <Text style={styles.name}>{v.vehicle_number}</Text>
                    <Text style={styles.meta}>
                      {[v.make, v.model, v.year, v.fuel_type].filter(Boolean).join(' · ')}
                      {v.odometer_km != null ? ` · ${Number(v.odometer_km).toLocaleString('en-IN')} km` : ''}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyHint}>No vehicles saved</Text>
              )}

              <Text style={styles.sectionTitle}>Cart / incomplete</Text>
              {(detail.cart?.items || []).length ? (
                (detail.cart.items || []).map((item: any) => (
                  <View key={item.id} style={styles.card}>
                    <Text style={styles.name}>{item.service_type}</Text>
                    <Text style={styles.meta}>
                      Qty {item.quantity} · {inr(Number(item.total_price || item.unit_price || 0))}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyHint}>No open cart</Text>
              )}

              <Text style={styles.sectionTitle}>Referral</Text>
              <View style={styles.card}>
                <Text style={styles.name}>{detail.referral?.code || 'No code'}</Text>
                <Text style={styles.meta}>
                  Used {detail.referral?.usage_count || 0} time(s)
                </Text>
              </View>

              <Text style={styles.sectionTitle}>WhatsApp</Text>
              {(detail.whatsapp_messages || []).length ? (
                (detail.whatsapp_messages || []).slice(0, 8).map((m: any) => (
                  <View key={m.id} style={styles.card}>
                    <Text style={styles.name} numberOfLines={1}>
                      {m.direction} · {m.template_name || m.message_type}
                    </Text>
                    <Text style={styles.meta}>{fmtWhen(m.created_at)} · {m.status}</Text>
                    {m.text_body ? (
                      <Text style={[styles.meta, { marginTop: 6 }]} numberOfLines={4}>
                        {m.text_body}
                      </Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyHint}>No WhatsApp messages</Text>
              )}

              <Text style={styles.sectionTitle}>Bookings</Text>
              {(detail.service_bookings || []).length ? (
                (detail.service_bookings || []).map((b: any) => (
                  <View key={b.id} style={styles.card}>
                    <Text style={styles.name}>{b.lead_number || 'Lead'}</Text>
                    <Text style={styles.meta}>{[b.status, b.service_type, b.vehicle_number].filter(Boolean).join(' · ')}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyHint}>No service bookings</Text>
              )}

              <Text style={styles.sectionTitle}>Recent App Events</Text>
              {(detail.analytics_events || []).length ? (
                <>
                  {(eventsExpanded
                    ? detail.analytics_events
                    : detail.analytics_events.slice(0, 5)
                  ).map((ev: any) => (
                    <View key={ev.id} style={styles.row}>
                      <Text style={[styles.meta, { flex: 1, color: COLORS.textPrimary, fontWeight: '600' }]}>
                        {String(ev.event_name || '').replace(/_/g, ' ')}
                      </Text>
                      <Text style={styles.meta}>{fmtWhen(ev.created_at)}</Text>
                    </View>
                  ))}
                  {detail.analytics_events.length > 5 ? (
                    <TouchableOpacity onPress={() => setEventsExpanded((v) => !v)} style={{ paddingVertical: 8 }}>
                      <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 13 }}>
                        {eventsExpanded
                          ? 'Show less'
                          : `Show more (${detail.analytics_events.length - 5})`}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                <Text style={styles.emptyHint}>No app events</Text>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </OpsShell>
  );
}

export function LeadManagerWorkshopProximityScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/app_operations/workshop-proximity?limit=80');
      setRows(Array.isArray(data?.events) ? data.events : []);
      setStats(data?.stats || null);
    } catch (e: any) {
      Alert.alert('Proximity', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <OpsShell title="Workshop Proximity">
      {stats ? (
        <View style={styles.stats}>
          <View style={[styles.stat, { backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.statVal}>{stats.walk_in_alerts_24h ?? 0}</Text>
            <Text style={styles.statLbl}>Walk-ins 24h</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: '#E0F2FE' }]}>
            <Text style={styles.statVal}>{stats.geofence_radius_m ?? '—'}m</Text>
            <Text style={styles.statLbl}>Geofence</Text>
          </View>
        </View>
      ) : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
          contentContainerStyle={{ padding: SPACING.md }}
          renderItem={({ item }) => {
            const customer = item.customer || {};
            const workshop = item.workshop || {};
            return (
              <View style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.name} numberOfLines={1}>
                    {customer.full_name || customer.phone || 'Customer'}
                  </Text>
                  <Text style={[styles.badge, styles.badgeOn]}>{item.event_type || 'event'}</Text>
                </View>
                <Text style={styles.meta}>
                  {[
                    workshop.workshop_name || workshop.name,
                    workshop.city,
                    item.distance_m != null ? `${Math.round(item.distance_m)}m` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No proximity events.</Text>}
        />
      )}
    </OpsShell>
  );
}

export function LeadManagerMembershipCustomersScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50', page: '1', filter: 'ACTIVE' });
      if (q.trim()) params.set('search', q.trim());
      const data = await apiFetch<any>(`/api/super_admin/membership-customers?${params.toString()}`);
      setRows(Array.isArray(data?.memberships) ? data.memberships : []);
    } catch (e: any) {
      Alert.alert('Membership', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <OpsShell title="Membership Customers">
      <SearchBox value={q} onChange={setQ} placeholder="Search member name / phone" />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, idx) => String(item.id || item.customer_id || idx)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
          contentContainerStyle={{ padding: SPACING.md }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.full_name || item.customer_name || item.phone || 'Member'}
                </Text>
                <Text style={[styles.badge, styles.badgeOn]}>{item.status || item.plan_name || 'Active'}</Text>
              </View>
              <Text style={styles.meta}>
                {[item.phone, item.plan_name, item.expires_at || item.valid_till].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No membership customers.</Text>}
        />
      )}
    </OpsShell>
  );
}

export function LeadManagerReferralScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [tab, setTab] = useState<'users' | 'activity' | 'manual'>('users');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/super_admin/referral');
      setPayload(data);
    } catch (e: any) {
      Alert.alert('Refer & Rise', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = payload?.stats || {};
  const leaderboard = Array.isArray(payload?.leaderboard) ? payload.leaderboard : [];
  const events = Array.isArray(payload?.recent_events) ? payload.recent_events : [];
  const manualRefs = Array.isArray(payload?.manual_references) ? payload.manual_references : [];
  const listData = tab === 'users' ? leaderboard : tab === 'manual' ? manualRefs : events;

  return (
    <OpsShell title="Refer & Rise">
      {loading && !payload ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, idx) =>
            String(item.customer_id || item.id || item.phone || idx)
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
          ListHeaderComponent={
            <View>
              <View style={styles.stats}>
                <View style={[styles.stat, { backgroundColor: '#ECFDF5' }]}>
                  <Text style={styles.statVal}>{stats.total_referrals ?? 0}</Text>
                  <Text style={styles.statLbl}>Referrals</Text>
                </View>
                <View style={[styles.stat, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={styles.statVal}>{stats.pending ?? 0}</Text>
                  <Text style={styles.statLbl}>Pending</Text>
                </View>
                <View style={[styles.stat, { backgroundColor: '#E0F2FE' }]}>
                  <Text style={styles.statVal}>{stats.rewarded ?? 0}</Text>
                  <Text style={styles.statLbl}>Rewarded</Text>
                </View>
              </View>
              <View style={styles.refTabs}>
                <TouchableOpacity
                  style={[styles.refTab, tab === 'users' && styles.refTabOn]}
                  onPress={() => setTab('users')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="people-outline" size={16} color={tab === 'users' ? '#fff' : '#475569'} />
                  <Text style={[styles.refTabTxt, tab === 'users' && styles.refTabTxtOn]}>Users</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.refTab, tab === 'activity' && styles.refTabOn]}
                  onPress={() => setTab('activity')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="phone-portrait-outline" size={16} color={tab === 'activity' ? '#fff' : '#475569'} />
                  <Text style={[styles.refTabTxt, tab === 'activity' && styles.refTabTxtOn]}>App</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.refTab, tab === 'manual' && styles.refTabOn]}
                  onPress={() => setTab('manual')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call-outline" size={16} color={tab === 'manual' ? '#fff' : '#475569'} />
                  <Text style={[styles.refTabTxt, tab === 'manual' && styles.refTabTxtOn]}>Manual</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          contentContainerStyle={{ paddingBottom: SPACING.lg }}
          renderItem={({ item }) =>
            tab === 'users' ? (
              <View style={[styles.card, { marginHorizontal: SPACING.md }]}>
                <Text style={styles.name}>{item.full_name || item.phone || 'Referrer'}</Text>
                <Text style={styles.meta}>
                  {item.total_referrals ?? 0} referrals
                  {item.total_earned != null ? ` · ₹${item.total_earned}` : item.total_rewards != null ? ` · ₹${item.total_rewards}` : ''}
                </Text>
              </View>
            ) : tab === 'manual' ? (
              <View style={[styles.card, { marginHorizontal: SPACING.md }]}>
                <Text style={styles.name}>
                  {item.customer_name || item.customer_phone || 'Lead'}
                </Text>
                <Text style={styles.meta}>
                  Manual: {item.referred_by?.customer_name || item.referred_by?.customer_phone || '—'}
                </Text>
                <Text style={styles.meta}>
                  Telecaller: {item.telecaller_name || '—'}
                  {item.lead_number ? ` · ${item.lead_number}` : ''}
                </Text>
              </View>
            ) : (
              <View style={[styles.card, { marginHorizontal: SPACING.md }]}>
                <Text style={styles.name}>
                  {item.referrer?.full_name || item.referrer?.phone || 'Referrer'}
                  {' → '}
                  {item.referee?.full_name || item.referee?.phone || 'Friend'}
                </Text>
                <Text style={styles.meta}>
                  {item.referral_code ? `${item.referral_code} · ` : ''}
                  {item.status || 'PENDING'}
                  {item.created_at ? ` · ${formatDateDMY(item.created_at)}` : ''}
                </Text>
              </View>
            )
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === 'users'
                ? 'No referral leaderboard yet.'
                : tab === 'manual'
                  ? 'No manual CRM references yet.'
                  : 'No app referral activity yet.'}
            </Text>
          }
        />
      )}
    </OpsShell>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: COLORS.background || '#F8FAFC' },
  shellBody: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
  },
  refTabs: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  refTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  refTabOn: { backgroundColor: COLORS.primary },
  refTabTxt: { fontSize: 12, fontWeight: '800', color: '#475569' },
  refTabTxtOn: { color: '#fff' },
  stats: { flexDirection: 'row', gap: 10, padding: SPACING.md },
  stat: { flex: 1, borderRadius: 14, padding: 14 },
  statVal: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary },
  statLbl: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginTop: 2 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, flex: 1 },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  badgeOn: { backgroundColor: '#D1FAE5', color: '#065F46' },
  badgeOff: { backgroundColor: '#E2E8F0', color: '#475569' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    color: COLORS.textPrimary,
  },
  empty: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: 24,
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyHint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
  bookingsSafe: { flex: 1, backgroundColor: '#F5F7FA' },
  bookingsHeader: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  bookingsBack: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingsTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  bookingsSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  bookingsViewBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  kpi: { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' },
  kpiVal: { fontSize: 16, fontWeight: '800', color: '#111827' },
  kpiLbl: { fontSize: 10, fontWeight: '700', color: '#6B7280', marginTop: 2 },
  toolbar: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  viewChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    color: COLORS.heading,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bookingsSearch: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  ddWrap: { flex: 1 },
  ddLbl: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  ddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
  },
  ddVal: { flex: 1, fontSize: 13, fontWeight: '700', color: '#111827' },
  ddBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'flex-end',
  },
  ddSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
  },
  ddSheetTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  ddOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  ddOptOn: {},
  ddOptTxt: { fontSize: 15, fontWeight: '600', color: '#334155' },
  ddOptTxtOn: { color: COLORS.primary, fontWeight: '800' },
  leadCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  leadNo: { fontSize: 11, fontWeight: '800', color: '#64748B', flex: 1 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillTxt: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  leadGrid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  leadCell: { flex: 1 },
  leadCellLbl: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
  leadCellVal: { fontSize: 12, fontWeight: '700', color: '#111827', marginTop: 2 },
  assignee: { marginTop: 8, fontSize: 12, fontWeight: '600', color: '#004AAD' },
});
