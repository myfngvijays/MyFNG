import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Share,
  Alert,
  useWindowDimensions,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../../lib/api';
import { apiFetchRaw } from '../../../lib/apiRaw';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';
import { istYmd } from '../../../lib/crmDateRange';

type Period = 'day' | 'week' | 'month' | 'year';
type TabId = 'leaderboard' | 'calls' | 'exports' | 'duplicates' | 'pipeline';

type Props = {
  navigation: any;
  route?: { params?: { tab?: string } };
};

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

function initials(name: string) {
  const p = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return `${p[0][0] || ''}${p[1][0] || ''}`.toUpperCase();
}

function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function dateToYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function periodLabel(period: Period, date: string): string {
  const today = istYmd();
  if (period === 'day') return date === today ? 'Today' : date;
  if (period === 'week') return 'Last 7 days';
  if (period === 'month') return 'This month';
  return date.slice(0, 4) || 'Year';
}

function normalizeTab(raw?: string): TabId {
  const v = String(raw || '').toLowerCase();
  if (v === 'calls') return 'calls';
  if (v === 'exports' || v === 'export') return 'exports';
  if (v === 'duplicates' || v === 'dupes') return 'duplicates';
  if (v === 'pipeline' || v === 'pipe') return 'pipeline';
  return 'leaderboard';
}

type CrmPerms = {
  reports: boolean;
  reports_export: boolean;
  reports_team_leaderboard: boolean;
  reports_duplicates: boolean;
};

const DEFAULT_PERMS: CrmPerms = {
  reports: true,
  reports_export: false,
  reports_team_leaderboard: false,
  reports_duplicates: true,
};

export default function CrmReportsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 400;

  const [isLeadManager, setIsLeadManager] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [permissions, setPermissions] = useState<CrmPerms>(DEFAULT_PERMS);
  const [tab, setTab] = useState<TabId>(normalizeTab(route?.params?.tab));
  const [period, setPeriod] = useState<Period>('day');
  const [date, setDate] = useState(istYmd());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [calls, setCalls] = useState<any>(null);
  const [duplicates, setDuplicates] = useState<any>(null);
  const [pipeline, setPipeline] = useState<any>(null);
  const [selectedMember, setSelectedMember] = useState<string | 'total'>('total');
  const [selectedDup, setSelectedDup] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [exportKind, setExportKind] = useState<'leads' | 'calls'>('leads');
  const [exporting, setExporting] = useState(false);

  const teamMode = Boolean(isLeadManager || permissions.reports_team_leaderboard);
  const canExport = Boolean(isLeadManager || permissions.reports_export);
  const canDupes = Boolean(isLeadManager || permissions.reports_duplicates);
  const firstName = displayName.split(/\s+/).filter(Boolean)[0];
  const personalBoard = firstName ? `${firstName}'s stats` : 'Your stats';
  const rangeLabel = periodLabel(period, date);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await supabase
          .from('users_login')
          .select('full_name, roles!role_id(role_code)')
          .eq('id', user.id)
          .maybeSingle();
        const code = String((data as any)?.roles?.role_code || '').toUpperCase();
        const lm = code === 'LEAD_MANAGER' || code === 'SUPER_ADMIN' || code === 'SUB_ADMIN';
        const name = String((data as any)?.full_name || '').trim();
        if (!cancelled && name) setDisplayName(name);
        if (!cancelled) setIsLeadManager(lm);
        if (lm) {
          if (!cancelled) {
            setPermissions({
              reports: true,
              reports_export: true,
              reports_team_leaderboard: true,
              reports_duplicates: true,
            });
          }
          return;
        }
        const res = await apiFetch<any>('/api/telecaller/crm/permissions');
        if (!cancelled && res?.permissions) {
          setPermissions({ ...DEFAULT_PERMS, ...res.permissions });
        }
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs = useMemo(() => {
    const base: Array<{ id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
      { id: 'leaderboard', label: teamMode ? 'Leaderboard' : 'My stats', icon: 'trophy-outline' },
      { id: 'calls', label: 'Calls', icon: 'call-outline' },
    ];
    if (canExport) base.push({ id: 'exports', label: 'Export', icon: 'download-outline' });
    if (canDupes) base.push({ id: 'duplicates', label: 'Duplicates', icon: 'git-network-outline' });
    if (isLeadManager) base.push({ id: 'pipeline', label: 'Pipeline', icon: 'stats-chart-outline' });
    return base;
  }, [isLeadManager, teamMode, canExport, canDupes]);

  useEffect(() => {
    if (tab === 'exports' && !canExport) setTab('leaderboard');
    if (tab === 'duplicates' && !canDupes) setTab('leaderboard');
    if (tab === 'pipeline' && !isLeadManager) setTab('leaderboard');
  }, [tab, canExport, canDupes, isLeadManager]);

  const loadTab = useCallback(async () => {
    if (tab === 'exports') return;
    setLoading(true);
    setLoadError('');
    try {
      if (tab === 'leaderboard') {
        const params = new URLSearchParams({ period, date });
        const res = await apiFetch<any>(`/api/telecaller/crm/reports/leaderboard?${params}`);
        setLeaderboard(res);
      } else if (tab === 'calls') {
        const params = new URLSearchParams({ period, date });
        if (searchDebounced) params.set('q', searchDebounced);
        const res = await apiFetch<any>(`/api/telecaller/crm/reports/calls?${params}`);
        setCalls(res);
      } else if (tab === 'duplicates') {
        const res = await apiFetch<any>('/api/telecaller/crm/reports/duplicates?channel=phone');
        setDuplicates(res);
        if (!selectedDup && res?.groups?.[0]?.key) setSelectedDup(res.groups[0].key);
      } else if (tab === 'pipeline' && isLeadManager) {
        const end = date;
        const startDate = new Date(`${date}T12:00:00`);
        startDate.setDate(startDate.getDate() - 6);
        const start = startDate.toISOString().slice(0, 10);
        const params = new URLSearchParams({ from: start, to: end });
        const res = await apiFetch<any>(`/api/telecaller/crm/reports/pipeline?${params}`);
        setPipeline(res);
      }
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load');
      Alert.alert('Reports', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, period, date, searchDebounced, isLeadManager]);

  useEffect(() => {
    void loadTab();
  }, [loadTab]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadTab();
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ kind: exportKind, period, date });
      const res = await apiFetchRaw(`/api/telecaller/crm/reports/export?${params}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as any)?.error || 'Export failed');
      }
      const text = await res.text();
      const filename = `crm_${exportKind}_${period}_${date}.csv`;
      await Share.share({
        message: text.slice(0, 100000),
        title: filename,
      });
    } catch (e: any) {
      Alert.alert('Export', e?.message || 'Failed');
    } finally {
      setExporting(false);
    }
  };

  const members = Array.isArray(leaderboard?.members) ? leaderboard.members : [];
  const totals = leaderboard?.totals || { calls: 0, duration_seconds: 0, bookings: 0 };
  const selected =
    selectedMember === 'total' ? null : members.find((m: any) => m.id === selectedMember) || null;
  const hourly = Array.isArray(calls?.hourly) ? calls.hourly : [];
  const maxHour = Math.max(1, ...hourly.map((h: any) => h.count || 0));
  const callRows = Array.isArray(calls?.calls) ? calls.calls : [];
  const dupGroups = Array.isArray(duplicates?.groups) ? duplicates.groups : [];
  const dupSelected = dupGroups.find((g: any) => g.key === selectedDup) || null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textHeading} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Advanced CRM</Text>
          <Text style={styles.title}>Reports</Text>
          <Text style={styles.subtitle}>{rangeLabel}</Text>
        </View>
        {tab !== 'exports' ? (
          <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
            <Ionicons name="refresh" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
        style={styles.tabsScroll}
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tabChip, active && styles.tabChipOn]}
              onPress={() => setTab(t.id)}
            >
              <Ionicons name={t.icon} size={14} color={active ? '#fff' : COLORS.textSecondary} />
              <Text style={[styles.tabChipText, active && styles.tabChipTextOn]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {(tab === 'leaderboard' || tab === 'calls' || tab === 'exports') && (
        <View style={styles.filterBlock}>
          <View style={styles.periodRow}>
            {(['day', 'week', 'month', 'year'] as Period[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.periodChip, period === p && styles.periodChipOn]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.periodText, period === p && styles.periodTextOn]}>
                  {p === 'day' ? 'Day' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Year'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {period === 'day' ? (
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
              <Text style={styles.dateBtnText}>{date === istYmd() ? `Today · ${date}` : date}</Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        refreshControl={
          tab !== 'exports' ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
      >
        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : null}

        {!loading && loadError && tab !== 'exports' ? (
          <View style={styles.emptyCard}>
            <Text style={styles.empty}>{loadError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => void loadTab()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {tab === 'leaderboard' && !loading && !loadError ? (
          <View>
            {teamMode ? (
            <TouchableOpacity
              style={[styles.memberCard, selectedMember === 'total' && styles.memberCardOn]}
              onPress={() => setSelectedMember('total')}
            >
              <Text style={styles.memberName}>Team totals</Text>
              <Text style={styles.muted}>{leaderboard.team_size || 0} people</Text>
              <View style={styles.metricsRow}>
                <Metric label="Calls" value={String(totals.calls || 0)} />
                <Metric label="Talk" value={formatDuration(totals.duration_seconds || 0)} />
                <Metric label="Bookings" value={String(totals.bookings || 0)} />
              </View>
            </TouchableOpacity>
            ) : (
            <View style={styles.memberCard}>
              <Text style={styles.memberName}>{personalBoard}</Text>
              <Text style={styles.muted}>{rangeLabel} · your calls & bookings</Text>
              <View style={styles.metricsRow}>
                <Metric label="Calls" value={String(totals.calls || members[0]?.calls || 0)} />
                <Metric
                  label="Talk"
                  value={formatDuration(
                    totals.duration_seconds || members[0]?.duration_seconds || 0,
                  )}
                />
                <Metric
                  label="Bookings"
                  value={String(totals.bookings || members[0]?.bookings || 0)}
                />
              </View>
            </View>
            )}
            {teamMode
              ? members.map((m: any) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.memberCard, selectedMember === m.id && styles.memberCardOn]}
                onPress={() => setSelectedMember(m.id)}
              >
                <View style={styles.memberTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(m.full_name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>
                      #{m.rank} {m.full_name}
                    </Text>
                    <Text style={styles.muted}>Telecaller</Text>
                  </View>
                </View>
                <View style={styles.metricsRow}>
                  <Metric label="Calls" value={String(m.calls)} />
                  <Metric label="Talk" value={formatDuration(m.duration_seconds)} />
                  <Metric label="Bookings" value={String(m.bookings)} />
                </View>
              </TouchableOpacity>
            ))
              : null}
            {teamMode ? (
            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>{selected ? selected.full_name : 'Team totals'}</Text>
              {(selected
                ? [
                    ['Calls', String(selected.calls)],
                    ['Answered', String(selected.answered)],
                    ['Talk', formatDuration(selected.duration_seconds)],
                    ['Bookings', String(selected.bookings)],
                  ]
                : [
                    ['Calls', String(totals.calls || 0)],
                    ['Talk', formatDuration(totals.duration_seconds || 0)],
                    ['Bookings', String(totals.bookings || 0)],
                  ]
              ).map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.muted}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}
            </View>
            ) : null}
          </View>
        ) : null}

        {tab === 'calls' && !loading && !loadError ? (
          <View>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Filter name / phone"
                placeholderTextColor={COLORS.textSecondary}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
            </View>
            <View style={styles.summaryRow}>
              <SummaryTile
                primary
                label="Calls"
                value={String(calls?.summary?.total_calls ?? 0)}
                compact={compact}
              />
              <SummaryTile
                label="Talk"
                value={formatDuration(calls?.summary?.duration_seconds ?? 0)}
                compact={compact}
              />
              <SummaryTile
                label="Leads"
                value={String(calls?.summary?.unique_leads ?? 0)}
                compact={compact}
              />
            </View>
            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Calls by hour (IST)</Text>
              <View style={styles.bars}>
                {hourly.map((h: any) => (
                  <View key={h.hour} style={styles.barCol}>
                    <View
                      style={[
                        styles.bar,
                        { height: Math.max(4, ((h.count || 0) / maxHour) * 72) },
                      ]}
                    />
                  </View>
                ))}
              </View>
            </View>
            {callRows.map((c: any) => (
              <TouchableOpacity
                key={c.id}
                style={styles.callCard}
                onPress={() => {
                  if (c.lead?.id) {
                    navigation.navigate('TelecallerLeadDetail', { leadId: c.lead.id });
                  }
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{c.lead?.customer_name || 'Unknown'}</Text>
                  <Text style={styles.muted}>{c.lead?.customer_phone || c.lead?.lead_number || '—'}</Text>
                  <View style={styles.badgeRow}>
                    <Badge text={c.call_status || '—'} />
                    <Badge text={formatDuration(c.call_duration || 0)} soft />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))}
            {callRows.length === 0 ? <Text style={styles.empty}>No calls in this period</Text> : null}
          </View>
        ) : null}

        {tab === 'exports' ? (
          <View style={styles.exportCard}>
            <Text style={styles.sectionTitle}>Download CSV</Text>
            <Text style={styles.muted}>Share leads or call logs · {rangeLabel}</Text>
            <View style={styles.kindRow}>
              {(['leads', 'calls'] as const).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.periodChip, exportKind === k && styles.periodChipOn]}
                  onPress={() => setExportKind(k)}
                >
                  <Text style={[styles.periodText, exportKind === k && styles.periodTextOn]}>
                    {k.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => void doExport()}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="share-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Share CSV</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {tab === 'duplicates' && !loading && !loadError ? (
          <View>
            <Text style={styles.muted}>
              {duplicates?.total_groups || 0} groups · {duplicates?.total_extra_leads || 0} extras
            </Text>
            {dupGroups.map((g: any) => (
              <TouchableOpacity
                key={g.key}
                style={[styles.memberCard, selectedDup === g.key && styles.memberCardOn]}
                onPress={() => setSelectedDup(g.key)}
              >
                <Text style={styles.memberName}>{g.phone}</Text>
                <Text style={styles.muted}>{g.count} leads</Text>
              </TouchableOpacity>
            ))}
            {dupSelected ? (
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>{dupSelected.phone}</Text>
                {(dupSelected.leads || []).map((lead: any) => (
                  <TouchableOpacity
                    key={lead.id}
                    style={styles.detailRow}
                    onPress={() => navigation.navigate('TelecallerLeadDetail', { leadId: lead.id })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailValue}>{lead.customer_name || 'Unknown'}</Text>
                      <Text style={styles.muted}>{lead.lead_number}</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {dupGroups.length === 0 ? <Text style={styles.empty}>No duplicates found</Text> : null}
          </View>
        ) : null}

        {tab === 'pipeline' && !loading && !loadError ? (
          <View>
            <View style={styles.summaryRow}>
              <SummaryTile primary label="Leads" value={String(pipeline?.stats?.total_leads ?? 0)} />
              <SummaryTile label="Validated" value={String(pipeline?.stats?.validated_leads ?? 0)} />
              <SummaryTile label="Rate" value={`${pipeline?.stats?.validation_rate ?? 0}%`} />
            </View>
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Status</Text>
            {(pipeline?.status_breakdown || []).slice(0, 8).map((s: any) => (
              <View key={s.status} style={styles.detailRow}>
                <Text style={styles.muted}>{s.status}</Text>
                <Text style={styles.detailValue}>
                  {s.count} ({s.percentage}%)
                </Text>
              </View>
            ))}
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Top cities</Text>
            {(pipeline?.city_distribution || []).map((c: any) => (
              <View key={c.city} style={styles.detailRow}>
                <Text style={styles.muted}>{c.city}</Text>
                <Text style={styles.detailValue}>{c.count}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {showDatePicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={ymdToDate(date)}
          mode="date"
          display="default"
          onChange={(_e, selected) => {
            setShowDatePicker(false);
            if (selected) setDate(dateToYmd(selected));
          }}
        />
      ) : null}

      <Modal
        visible={showDatePicker && Platform.OS === 'ios'}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sectionTitle}>Pick date</Text>
            <DateTimePicker
              value={ymdToDate(date)}
              mode="date"
              display="spinner"
              themeVariant="light"
              onChange={(_e, selected) => {
                if (selected) setDate(dateToYmd(selected));
              }}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function SummaryTile({
  label,
  value,
  primary,
  compact,
}: {
  label: string;
  value: string;
  primary?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[styles.summaryTile, primary && styles.summaryTilePrimary, compact && { paddingVertical: 10 }]}>
      <Text style={[styles.metricLabel, primary && { color: '#BFDBFE' }]}>{label}</Text>
      <Text style={[styles.summaryValue, primary && { color: '#fff' }]}>{value}</Text>
    </View>
  );
}

function Badge({ text, soft }: { text: string; soft?: boolean }) {
  return (
    <View style={[styles.badge, soft && styles.badgeSoft]}>
      <Text style={[styles.badgeText, soft && styles.badgeTextSoft]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
    gap: 8,
  },
  backBtn: { padding: 4 },
  iconBtn: { padding: 8 },
  kicker: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textHeading, fontFamily: 'Poppins' },
  subtitle: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginTop: 1 },
  tabsScroll: { maxHeight: 48, flexGrow: 0 },
  tabsRow: { paddingHorizontal: SPACING.md, gap: 8, paddingBottom: 8 },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabChipText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  tabChipTextOn: { color: '#fff' },
  filterBlock: { paddingHorizontal: SPACING.md, marginBottom: 8, gap: 8 },
  periodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  periodChipOn: { backgroundColor: COLORS.textHeading, borderColor: COLORS.textHeading },
  periodText: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary },
  periodTextOn: { color: '#fff' },
  dateBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.textHeading },
  body: { flex: 1 },
  bodyContent: { padding: SPACING.md, paddingBottom: 40 },
  center: { paddingVertical: 40, alignItems: 'center' },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontWeight: '800' },
  memberCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  memberCardOn: { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' },
  memberTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.textHeading,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  memberName: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  muted: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metric: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  metricLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase' },
  metricValue: { marginTop: 2, fontSize: 13, fontWeight: '800', color: COLORS.text },
  detailCard: {
    marginTop: 8,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    ...SHADOWS.small,
  },
  detailTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textHeading, marginBottom: 8 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  detailValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: COLORS.text },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryTile: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  summaryTilePrimary: { backgroundColor: COLORS.textHeading, borderColor: COLORS.textHeading },
  summaryValue: { marginTop: 4, fontSize: 16, fontWeight: '900', color: COLORS.text },
  chartCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textHeading, marginBottom: 10 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 2 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: COLORS.primary, borderTopLeftRadius: 3, borderTopRightRadius: 3, opacity: 0.85 },
  callCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  badge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeSoft: { backgroundColor: '#F1F5F9' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#1E40AF' },
  badgeTextSoft: { color: COLORS.textSecondary },
  exportCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    ...SHADOWS.small,
  },
  kindRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 16 },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  empty: { textAlign: 'center', color: COLORS.textSecondary, paddingVertical: 28 },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
  },
});
