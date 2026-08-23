import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import CallRecordingInlinePlayer from '../../../components/telecaller/CallRecordingInlinePlayer';

function OpsShell({
  title,
  children,
  onRefresh,
}: {
  title: string;
  children: React.ReactNode;
  onRefresh?: () => void;
}) {
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          {title}
        </Text>
        {onRefresh ? (
          <TouchableOpacity style={styles.backBtn} onPress={onRefresh} hitSlop={12}>
            <Ionicons name="refresh" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>
      <View style={styles.shellBody}>{children}</View>
    </SafeAreaView>
  );
}

function fmtDur(sec?: number | null) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Lead Manager — call recordings browser (same API as web). */
export function LeadManagerRecordingsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ total?: number; answered?: number | null } | null>(
    null,
  );
  const [playingId, setPlayingId] = useState<string | null>(null);

  const load = useCallback(
    async (pageNum = 1, replace = true) => {
      try {
        const params = new URLSearchParams({
          preset: 'last_7_days',
          page: String(pageNum),
          limit: '30',
        });
        if (appliedQ.trim()) params.set('q', appliedQ.trim());
        const data = await apiFetch<any>(`/api/super_admin/recordings?${params}`);
        const next = Array.isArray(data?.rows) ? data.rows : Array.isArray(data?.data) ? data.data : [];
        setRows((prev) => (replace ? next : [...prev, ...next]));
        setPage(Number(data?.page || pageNum) || pageNum);
        setTotalPages(Math.max(1, Number(data?.total_pages || 1) || 1));
        setSummary(data?.stats || { total: data?.total });
      } catch (e: any) {
        Alert.alert('Recordings', e?.message || 'Failed to load');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedQ],
  );

  useEffect(() => {
    setLoading(true);
    void load(1, true);
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setAppliedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <OpsShell
      title="Recordings"
      onRefresh={() => {
        setRefreshing(true);
        void load(1, true);
      }}
    >
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={COLORS.textSecondary} />
        <TextInput
          style={styles.search}
          placeholder="Search name / phone / lead #"
          value={q}
          onChangeText={setQ}
          placeholderTextColor={COLORS.textSecondary}
        />
        {q.length > 0 ? (
          <TouchableOpacity
            onPress={() => {
              setQ('');
              setAppliedQ('');
            }}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {summary ? (
        <Text style={styles.metaLine}>
          {summary.total ?? rows.length} calls
          {summary.answered != null ? ` · ${summary.answered} answered` : ''}
          {' · Last 7 days'}
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(1, true);
              }}
            />
          }
          contentContainerStyle={{ paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No recordings in this range</Text>
          }
          onEndReached={() => {
            if (page < totalPages && !loading) void load(page + 1, false);
          }}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => {
            const id = String(item.id);
            const hasRec = Boolean(item.has_recording || item.call_recording_url);
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.customer_name || item.phone_number || 'Call'}
                    </Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {item.telecaller_name || '—'}
                      {item.lead_number ? ` · #${item.lead_number}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.dur}>{fmtDur(item.call_duration)}</Text>
                </View>
                <Text style={styles.statusLine}>
                  {String(item.call_status || item.outcome || '—').replace(/_/g, ' ')}
                </Text>
                {hasRec ? (
                  playingId === id ? (
                    <CallRecordingInlinePlayer callLogId={id} onClose={() => setPlayingId(null)} />
                  ) : (
                    <TouchableOpacity
                      style={styles.playBtn}
                      onPress={() => setPlayingId(id)}
                    >
                      <Ionicons name="play-circle" size={20} color={COLORS.primary} />
                      <Text style={styles.playText}>Play recording</Text>
                    </TouchableOpacity>
                  )
                ) : (
                  <Text style={styles.noRec}>No recording file</Text>
                )}
              </View>
            );
          }}
        />
      )}
    </OpsShell>
  );
}

/** Lead Manager — Call Intelligence (agents + query gaps). */
export function LeadManagerCallIntelligenceScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'agents' | 'issues'>('agents');
  const [agents, setAgents] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentDetail, setAgentDetail] = useState<any>(null);
  const [agentLoading, setAgentLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ preset: 'last_7_days', limit: '800' });
      const data = await apiFetch<any>(`/api/super_admin/call-intelligence?${params}`);
      setAgents(Array.isArray(data?.agents) ? data.agents : []);
      setIssues(Array.isArray(data?.top_issues) ? data.top_issues : []);
      setAnalytics(data?.analytics || null);
    } catch (e: any) {
      Alert.alert('Call Intelligence', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadAgent = useCallback(async (telecallerId: string) => {
    setSelectedAgentId(telecallerId);
    setAgentLoading(true);
    try {
      const params = new URLSearchParams({
        preset: 'last_7_days',
        limit: '800',
        telecaller_id: telecallerId,
      });
      const data = await apiFetch<any>(`/api/super_admin/call-intelligence?${params}`);
      setAgentDetail(data?.agent_detail || null);
    } catch (e: any) {
      Alert.alert('Agent report', e?.message || 'Failed');
      setAgentDetail(null);
    } finally {
      setAgentLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const agentCalls = useMemo(
    () => (Array.isArray(agentDetail?.calls) ? agentDetail.calls : []),
    [agentDetail],
  );

  if (selectedAgentId) {
    const ag = agentDetail?.agent;
    return (
      <OpsShell
        title={ag?.telecaller_name || 'Agent report'}
        onRefresh={() => void loadAgent(selectedAgentId)}
      >
        <TouchableOpacity
          style={styles.backLink}
          onPress={() => {
            setSelectedAgentId(null);
            setAgentDetail(null);
          }}
        >
          <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
          <Text style={styles.backLinkText}>All agents</Text>
        </TouchableOpacity>

        {agentLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : ag ? (
          <FlatList
            data={agentCalls}
            keyExtractor={(item) => String(item.call_log_id)}
            ListHeaderComponent={
              <View style={styles.agentHeader}>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreText}>{ag.performance_score}</Text>
                </View>
                <Text style={styles.agentMeta}>
                  {ag.total_calls} calls · {Math.round((ag.connect_rate || 0) * 100)}% connect ·
                  quality {ag.quality_avg}
                </Text>
                {(agentDetail?.top_coaching_tips || []).slice(0, 3).map((t: any) => (
                  <Text key={t.tip || t} style={styles.tip}>
                    → {t.tip || t}
                  </Text>
                ))}
              </View>
            }
            contentContainerStyle={{ paddingBottom: 40, gap: 10 }}
            ListEmptyComponent={<Text style={styles.empty}>No calls for this agent</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {item.customer_name || item.phone_number || 'Call'}
                </Text>
                <Text style={styles.cardSub}>
                  {String(item.overall_resolution || item.solution_adequacy || '—').replace(
                    /_/g,
                    ' ',
                  )}
                  {item.queries_total
                    ? ` · ${item.queries_resolved || 0}/${item.queries_total}`
                    : ''}
                  {` · Q ${item.quality_score ?? '—'}`}
                </Text>
                {item.customer_problem ? (
                  <Text style={styles.prob}>P: {item.customer_problem}</Text>
                ) : null}
                {item.agent_solution ? (
                  <Text style={styles.sol}>S: {item.agent_solution}</Text>
                ) : null}
              </View>
            )}
          />
        ) : (
          <Text style={styles.empty}>Agent report unavailable</Text>
        )}
      </OpsShell>
    );
  }

  return (
    <OpsShell
      title="Call Intelligence"
      onRefresh={() => {
        setRefreshing(true);
        void load();
      }}
    >
      {analytics ? (
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{analytics.total_calls ?? 0}</Text>
            <Text style={styles.kpiLbl}>Calls</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>
              {Math.round((analytics.query_resolve_rate || 0) * 100)}%
            </Text>
            <Text style={styles.kpiLbl}>Resolved</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{analytics.quality_avg ?? '—'}</Text>
            <Text style={styles.kpiLbl}>Quality</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'agents' && styles.tabOn]}
          onPress={() => setTab('agents')}
        >
          <Text style={[styles.tabText, tab === 'agents' && styles.tabTextOn]}>Agents</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'issues' && styles.tabOn]}
          onPress={() => setTab('issues')}
        >
          <Text style={[styles.tabText, tab === 'issues' && styles.tabTextOn]}>
            Query gaps
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : tab === 'agents' ? (
        <FlatList
          data={agents}
          keyExtractor={(item) => String(item.telecaller_id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          contentContainerStyle={{ paddingBottom: 40, gap: 8 }}
          ListEmptyComponent={<Text style={styles.empty}>No agents in range</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.agentRow}
              onPress={() => void loadAgent(String(item.telecaller_id))}
            >
              <View style={styles.scoreBadgeSm}>
                <Text style={styles.scoreTextSm}>{item.performance_score}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardTitle}>{item.telecaller_name}</Text>
                <Text style={styles.cardSub}>
                  {item.total_calls} calls · {Math.round((item.connect_rate || 0) * 100)}% · Q{' '}
                  {item.quality_avg}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={issues}
          keyExtractor={(item) => String(item.call_log_id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          contentContainerStyle={{ paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={<Text style={styles.empty}>No gaps in this range</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {item.customer_name || item.phone_number || 'Call'}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  item.telecaller_id ? void loadAgent(String(item.telecaller_id)) : undefined
                }
              >
                <Text style={styles.linkAgent}>{item.telecaller_name || '—'}</Text>
              </TouchableOpacity>
              <Text style={styles.prob}>P: {item.customer_problem || '—'}</Text>
              <Text style={styles.sol}>S: {item.agent_solution || '—'}</Text>
              <Text style={styles.cardSub}>
                {String(item.overall_resolution || item.solution_adequacy || '').replace(
                  /_/g,
                  ' ',
                )}
                {` · Grade ${item.quality_grade} ${item.quality_score}`}
              </Text>
            </View>
          )}
        />
      )}
    </OpsShell>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
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
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.heading || COLORS.primary,
  },
  shellBody: { flex: 1, paddingHorizontal: SPACING.md, paddingTop: 10 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  search: { flex: 1, paddingVertical: 10, color: COLORS.textPrimary },
  metaLine: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 40, fontSize: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  cardSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  dur: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  statusLine: { fontSize: 11, color: '#64748B', marginTop: 6, textTransform: 'capitalize' },
  playBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  playText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  noRec: { marginTop: 6, fontSize: 11, color: '#94A3B8' },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  kpi: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  kpiVal: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  kpiLbl: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  tabOn: { backgroundColor: '#4C1D95', borderColor: '#4C1D95' },
  tabText: { fontSize: 12, fontWeight: '800', color: '#475569' },
  tabTextOn: { color: '#fff' },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scoreBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#4C1D95',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  scoreText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  scoreBadgeSm: {
    backgroundColor: '#4C1D95',
    borderRadius: 999,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreTextSm: { color: '#fff', fontWeight: '800', fontSize: 12 },
  agentHeader: { marginBottom: 12 },
  agentMeta: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 },
  tip: { fontSize: 12, color: '#5B21B6', marginBottom: 2 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 10 },
  backLinkText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  linkAgent: { fontSize: 12, fontWeight: '700', color: '#5B21B6', marginTop: 2, marginBottom: 4 },
  prob: { fontSize: 12, color: '#9A3412', marginTop: 4 },
  sol: { fontSize: 12, color: '#047857', marginTop: 2 },
});
