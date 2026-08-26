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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';
import CrmSavedViewsSheet, { type MobileSavedViewFilters } from '../../../components/CrmSavedViewsSheet';

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

export function LeadManagerAppBookingsScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [viewName, setViewName] = useState('All Leads');
  const [applied, setApplied] = useState<MobileSavedViewFilters>({});
  const [tagLeadIds, setTagLeadIds] = useState<Set<string> | null>(null);

  const datePreset = String(applied.datePreset || 'all_time');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (datePreset && datePreset !== 'all_time') params.set('preset', datePreset);
      if (applied.customStart) params.set('start', String(applied.customStart));
      if (applied.customEnd) params.set('end', String(applied.customEnd));
      const data = await apiFetch<any>(`/api/super_admin/leads?${params.toString()}`);
      setRows(Array.isArray(data?.leads) ? data.leads : []);
    } catch (e: any) {
      Alert.alert('Bookings', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [datePreset, applied.customStart, applied.customEnd]);

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
    const status = String(applied.status || 'ALL').toUpperCase();
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

  return (
    <OpsShell title="Bookings & Leads">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingTop: SPACING.md }}>
        <TouchableOpacity
          onPress={() => setViewsOpen(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#EEF2FF',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Ionicons name="funnel-outline" size={16} color="#4F46E5" />
          <Text style={{ color: '#3730A3', fontWeight: '800', fontSize: 13 }}>{viewName}</Text>
        </TouchableOpacity>
      </View>
      <SearchBox value={q} onChange={setQ} placeholder="Search name / phone / L-number" />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
          contentContainerStyle={{ padding: SPACING.md }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('LeadManagerLeadDetail', { leadId: item.id })}
            >
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.customer_name || item.customer_phone || 'Lead'}
                </Text>
                <Text style={[styles.badge, styles.badgeOn]}>{item.status || '—'}</Text>
              </View>
              <Text style={styles.meta}>
                {[item.lead_number, item.customer_phone, item.city].filter(Boolean).join(' · ')}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No bookings found.</Text>}
        />
      )}
      <CrmSavedViewsSheet
        visible={viewsOpen}
        onClose={() => setViewsOpen(false)}
        currentFilters={{
          ...applied,
          search: q,
          datePreset: datePreset,
        }}
        onApply={(filters, name) => {
          setApplied(filters || {});
          setViewName(name || 'Saved view');
          if (filters?.search) setQ(String(filters.search));
          if (!filters || Object.keys(filters).length === 0) {
            setQ('');
            setViewName('All Leads');
          }
        }}
      />
    </OpsShell>
  );
}

export function LeadManagerAppCustomersScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);

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
            <View style={styles.card}>
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
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No customers found.</Text>}
        />
      )}
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

  return (
    <OpsShell title="Refer & Rise">
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item, idx) => String(item.customer_id || item.phone || idx)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
          ListHeaderComponent={
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
          }
          contentContainerStyle={{ paddingBottom: SPACING.lg }}
          renderItem={({ item }) => (
            <View style={[styles.card, { marginHorizontal: SPACING.md }]}>
              <Text style={styles.name}>{item.full_name || item.phone || 'Referrer'}</Text>
              <Text style={styles.meta}>
                {item.total_referrals ?? 0} referrals
                {item.total_rewards != null ? ` · ₹${item.total_rewards}` : ''}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No referral leaderboard yet.</Text>}
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
});
