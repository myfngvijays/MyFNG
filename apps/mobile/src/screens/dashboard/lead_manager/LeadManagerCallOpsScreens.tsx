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
  Modal,
  ScrollView,
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
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'iq' | 'agents' | 'issues' | 'sop'>('iq');
  const [recent, setRecent] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [iqAgents, setIqAgents] = useState<any[]>([]);
  const [iqOpen, setIqOpen] = useState<any | null>(null);
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
      setRecent(Array.isArray(data?.recent) ? data.recent : []);
      setAnalytics(data?.analytics || null);
      try {
        const iq = await apiFetch<any>('/api/super_admin/call-iq-agents');
        setIqAgents(Array.isArray(iq?.agents) ? iq.agents : []);
      } catch {
        setIqAgents([]);
      }
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
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{analytics.sop_avg ?? '—'}</Text>
            <Text style={styles.kpiLbl}>SOP</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'iq' && styles.tabOn]}
          onPress={() => setTab('iq')}
        >
          <Text style={[styles.tabText, tab === 'iq' && styles.tabTextOn]}>Call-IQ</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'agents' && styles.tabOn]}
          onPress={() => setTab('agents')}
        >
          <Text style={[styles.tabText, tab === 'agents' && styles.tabTextOn]}>Team</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'issues' && styles.tabOn]}
          onPress={() => setTab('issues')}
        >
          <Text style={[styles.tabText, tab === 'issues' && styles.tabTextOn]}>
            Query gaps
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'sop' && styles.tabOn]}
          onPress={() => setTab('sop')}
        >
          <Text style={[styles.tabText, tab === 'sop' && styles.tabTextOn]}>SOP</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : tab === 'iq' ? (
        <FlatList
          data={iqAgents}
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
          contentContainerStyle={{ paddingBottom: 40, gap: 8 }}
          ListEmptyComponent={<Text style={styles.empty}>No Call-IQ agents</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.agentRow} onPress={() => setIqOpen(item)}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text
                    style={[
                      styles.badge,
                      item.is_active ? styles.badgeOn : styles.badgeOff,
                    ]}
                  >
                    {item.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
                <Text style={styles.cardSub}>
                  {/openai/i.test(String(item.provider || '')) ? 'Deep AI' : item.provider || 'Deep AI'} ·{' '}
                  {item.agent_type || 'Call-IQ'} · v{item.current_version}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        />
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
      ) : tab === 'issues' ? (
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
                {item.sop_audit?.overall_score != null
                  ? ` · SOP ${item.sop_audit.overall_score}`
                  : ''}
              </Text>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={recent}
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
          ListEmptyComponent={<Text style={styles.empty}>No SOP audits in range</Text>}
          renderItem={({ item }) => {
            const sop = item.sop_audit || {};
            return (
              <View style={[styles.card, { paddingVertical: 8 }]}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.customer_name || item.phone_number || 'Call'}
                </Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  SOP {sop.overall_score ?? '—'} · {sop.suggested_lead_status || '—'} ·{' '}
                  {sop.customer_intent_level || '—'}
                </Text>
              </View>
            );
          }}
        />
      )}
      <Modal visible={!!iqOpen} animationType="slide" onRequestClose={() => setIqOpen(null)}>
        <SafeAreaView style={styles.shell} edges={['top']}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setIqOpen(null)}>
              <Ionicons name="close" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.topTitle} numberOfLines={1}>
              {iqOpen?.name || 'Call-IQ'}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}>
            <Text style={styles.cardSub}>Version {iqOpen?.current_version || 1}</Text>
            <Text style={[styles.cardTitle, { marginTop: 12 }]}>Instruction</Text>
            <Text style={styles.cardSub}>
              {(iqOpen?.versions || []).find((v: any) => v.version === iqOpen?.current_version)
                ?.instruction ||
                iqOpen?.versions?.[0]?.instruction ||
                '—'}
            </Text>
            <Text style={[styles.cardTitle, { marginTop: 16 }]}>Output fields</Text>
            {(
              (iqOpen?.versions || []).find((v: any) => v.version === iqOpen?.current_version)
                ?.fields ||
              iqOpen?.versions?.[0]?.fields ||
              []
            ).map((field: any) => (
              <View key={String(field.id || field.key)} style={[styles.card, { marginTop: 8 }]}>
                <Text style={styles.cardSub}>{String(field.response_type || 'text').toUpperCase()}</Text>
                <Text style={styles.cardTitle}>{field.name}</Text>
                {Array.isArray(field.options) && field.options.length ? (
                  <Text style={styles.cardSub}>{field.options.join(' · ')}</Text>
                ) : null}
              </View>
            ))}
            <TouchableOpacity
              style={[styles.card, { marginTop: 16 }]}
              onPress={() => {
                setIqOpen(null);
                navigation.navigate('LeadManagerWorkflow');
              }}
            >
              <Text style={styles.cardTitle}>Automation Flowchart</Text>
              <Text style={styles.cardSub}>AI Workflow - Call Audit · View Flowchart</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </OpsShell>
  );
}

export function LeadManagerAiSuiteScreen() {
  const navigation = useNavigation<any>();
  const cards = [
    { title: 'Call IQ', screen: 'LeadManagerCallIntelligence', body: 'Sales SOP audit on every call' },
    { title: 'Lead IQ', screen: 'LeadManagerLeadIq', body: 'Intent, risk, next move, scripts' },
    { title: 'Workflow', screen: 'LeadManagerWorkflow', body: 'Recording → CRM status → SOP' },
    { title: 'Sales Playbook', screen: 'LeadManagerPlaybook', body: 'ICP, USPs, objections, prompts' },
  ];
  return (
    <OpsShell title="AI Suite">
      <View style={{ gap: 10, paddingBottom: 40 }}>
        {cards.map((c) => (
          <TouchableOpacity
            key={c.screen}
            style={styles.card}
            onPress={() => navigation.navigate(c.screen)}
          >
            <Text style={styles.cardTitle}>{c.title}</Text>
            <Text style={styles.cardSub}>{c.body}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </OpsShell>
  );
}

export function LeadManagerLeadIqScreen() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [crmStatuses, setCrmStatuses] = useState<string[]>([
    'Fresh',
    'Interested',
    'He will visit',
    'Follow-up',
    'Booking confirmed',
    'In Service',
    'Ringing / No answer',
    'Service Done',
    'Lost',
  ]);
  const [leads, setLeads] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ list: '1', limit: '40' });
      if (q.trim()) params.set('q', q.trim());
      if (status !== 'All') params.set('status', status);
      const data = await apiFetch<any>(`/api/super_admin/lead-iq?${params}`);
      setLeads(Array.isArray(data?.leads) ? data.leads : []);
    } catch (e: any) {
      Alert.alert('Lead IQ', e?.message || 'Failed');
    }
  }, [q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const st = await apiFetch<any>('/api/lead-manager/statuses');
        const names = (Array.isArray(st?.statuses) ? st.statuses : [])
          .filter((s: any) => s?.is_active !== false)
          .map((s: any) => String(s.name || '').trim())
          .filter(Boolean);
        if (names.length) setCrmStatuses(names);
      } catch {
        /* keep defaults */
      }
    })();
  }, []);

  async function generate(id: string, deep: boolean) {
    setRunningId(id);
    try {
      const data = await apiFetch<any>('/api/super_admin/lead-iq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: id, deep }),
      });
      setLeads((prev) => prev.map((row) => (row.id === id ? { ...row, brief: data?.brief } : row)));
      setOpenId(id);
    } catch (e: any) {
      Alert.alert('Lead IQ', e?.message || 'Failed');
    } finally {
      setRunningId(null);
    }
  }

  return (
    <OpsShell title="Lead IQ" onRefresh={() => void load()}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={setQ}
          placeholder="Name, phone, or L-number"
          placeholderTextColor="#94A3B8"
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {['All', ...crmStatuses].map((name) => {
          const on = status === name;
          return (
            <TouchableOpacity
              key={name}
              onPress={() => setStatus(name)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <FlatList
        data={leads}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 40, gap: 6 }}
        ListEmptyComponent={<Text style={styles.empty}>No leads in this filter</Text>}
        renderItem={({ item }) => {
          const open = openId === item.id;
          const brief = item.brief;
          return (
            <View style={[styles.card, { paddingVertical: 8 }]}>
              <TouchableOpacity onPress={() => setOpenId(open ? null : item.id)}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.customer_name || item.phone || 'Lead'}
                </Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {item.status || '—'} · {brief?.intent_level || 'no IQ'} · {item.lead_number || ''}
                </Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TouchableOpacity disabled={!!runningId} onPress={() => void generate(item.id, false)}>
                  <Text style={styles.linkAgent}>{runningId === item.id ? '…' : 'Free'}</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={!!runningId} onPress={() => void generate(item.id, true)}>
                  <Text style={styles.linkAgent}>Deep</Text>
                </TouchableOpacity>
              </View>
              {open && brief ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.sol} numberOfLines={3}>
                    {brief.next_move}
                  </Text>
                  <Text style={styles.prob} numberOfLines={2}>
                    {brief.hidden_risk}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </OpsShell>
  );
}

type MobileWorkflow = {
  id: string;
  name: string;
  enabled: boolean;
  min_duration_sec: number;
  lead_statuses: string[];
  use_deep_ai: boolean;
  skip_if_sop_exists: boolean;
  trigger: 'recording_completed';
  canvas?: { nodes: any[]; edges: any[] };
};

function mobileWorkflowId() {
  return `wf_${Math.random().toString(36).slice(2, 10)}`;
}

function listMobileWorkflows(raw: any): MobileWorkflow[] {
  const toOne = (row: any, i: number): MobileWorkflow => ({
    id: String(row?.id || `wf_${i + 1}`),
    name: String(row?.name || `Workflow ${i + 1}`).trim() || `Workflow ${i + 1}`,
    enabled: row?.enabled !== false,
    min_duration_sec: Math.max(0, Number(row?.min_duration_sec) || 90),
    lead_statuses: Array.isArray(row?.lead_statuses)
      ? row.lead_statuses.map(String)
      : ['Fresh', 'Interested', 'He will visit', 'Follow-up', 'Ringing / No answer'],
    use_deep_ai: row?.use_deep_ai !== false,
    skip_if_sop_exists: row?.skip_if_sop_exists !== false,
    trigger: 'recording_completed',
    canvas: row?.canvas,
  });
  if (Array.isArray(raw?.workflows) && raw.workflows.length) {
    return raw.workflows.map(toOne);
  }
  if (raw && typeof raw === 'object') {
    return [toOne({ ...raw, id: 'wf_call_audit', name: raw.name || 'AI Workflow — Call Audit' }, 0)];
  }
  return [toOne({ id: 'wf_call_audit', name: 'AI Workflow — Call Audit' }, 0)];
}

function persistMobileWorkflows(list: MobileWorkflow[]) {
  const workflows = list.length ? list : listMobileWorkflows(null);
  const pick = workflows.find((w) => w.enabled) || workflows[0];
  return {
    enabled: workflows.some((w) => w.enabled),
    min_duration_sec: pick.min_duration_sec,
    lead_statuses: pick.lead_statuses,
    use_deep_ai: pick.use_deep_ai,
    skip_if_sop_exists: pick.skip_if_sop_exists,
    workflows,
  };
}

export function LeadManagerWorkflowScreen() {
  const [workflows, setWorkflows] = useState<MobileWorkflow[]>(() => listMobileWorkflows(null));
  const [crmStatuses, setCrmStatuses] = useState<string[]>([
    'Fresh',
    'Interested',
    'He will visit',
    'Follow-up',
    'Booking confirmed',
    'In Service',
    'Ringing / No answer',
    'Service Done',
    'Lost',
  ]);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<MobileWorkflow | null>(null);
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pb, st] = await Promise.all([
        apiFetch<any>('/api/super_admin/ai-suite/playbook'),
        apiFetch<any>('/api/lead-manager/statuses'),
      ]);
      setWorkflows(listMobileWorkflows(pb?.playbook?.call_iq_workflow));
      const names = (Array.isArray(st?.statuses) ? st.statuses : [])
        .filter((s: any) => s?.is_active !== false)
        .map((s: any) => String(s.name || s.code || '').trim())
        .filter(Boolean);
      if (names.length) setCrmStatuses(names);
    } catch (e: any) {
      Alert.alert('Workflow', e?.message || 'Failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function persist(next: MobileWorkflow[]) {
    setSaving(true);
    try {
      const current = await apiFetch<any>('/api/super_admin/ai-suite/playbook');
      const saved = await apiFetch<any>('/api/super_admin/ai-suite/playbook', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(current?.playbook || {}),
          call_iq_workflow: persistMobileWorkflows(next),
        }),
      });
      setWorkflows(listMobileWorkflows(saved?.playbook?.call_iq_workflow || persistMobileWorkflows(next)));
    } catch (e: any) {
      Alert.alert('Workflow', e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function toggleDraftStatus(name: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const has = prev.lead_statuses.some((s) => s.toLowerCase() === name.toLowerCase());
      return {
        ...prev,
        lead_statuses: has
          ? prev.lead_statuses.filter((s) => s.toLowerCase() !== name.toLowerCase())
          : [...prev.lead_statuses, name],
      };
    });
  }

  return (
    <OpsShell title="Workflow" onRefresh={() => void load()}>
      <Text style={styles.cardSub}>
        Recording complete → CRM lead status → duration → SOP. Add or edit flows.
      </Text>
      <TouchableOpacity
        style={[styles.playBtn, { marginBottom: 10 }]}
        disabled={saving}
        onPress={() => {
          const created: MobileWorkflow = {
            id: mobileWorkflowId(),
            name: `Workflow ${workflows.length + 1}`,
            enabled: false,
            min_duration_sec: 90,
            lead_statuses: ['Fresh', 'Interested', 'He will visit', 'Follow-up', 'Ringing / No answer'],
            use_deep_ai: true,
            skip_if_sop_exists: true,
            trigger: 'recording_completed',
            canvas: { nodes: [], edges: [] },
          };
          setDraft(created);
        }}
      >
        <Ionicons name="add" size={16} color={COLORS.primary} />
        <Text style={styles.playText}>Add workflow</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={{ paddingBottom: 24, gap: 10 }}>
        {workflows.map((flow) => (
          <View key={flow.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{flow.name}</Text>
                <Text style={styles.cardSub}>
                  {flow.enabled ? 'On' : 'Off'} · ≥ {flow.min_duration_sec}s
                  {flow.use_deep_ai ? ' · Deep AI' : ''} · {flow.lead_statuses.length} statuses
                </Text>
              </View>
              <Text style={[styles.badge, flow.enabled ? styles.badgeOn : styles.badgeOff]}>
                {flow.enabled ? 'ON' : 'OFF'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              <TouchableOpacity style={styles.playBtn} onPress={() => setDraft({ ...flow })}>
                <Ionicons name="create-outline" size={14} color={COLORS.primary} />
                <Text style={styles.playText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.playBtn}
                disabled={saving}
                onPress={() => void persist(workflows.map((w) => (w.id === flow.id ? { ...w, enabled: !w.enabled } : w)))}
              >
                <Text style={styles.playText}>{flow.enabled ? 'Turn off' : 'Turn on'}</Text>
              </TouchableOpacity>
              {workflows.length > 1 ? (
                <TouchableOpacity
                  style={styles.playBtn}
                  disabled={saving}
                  onPress={() =>
                    Alert.alert('Delete workflow', `Delete “${flow.name}”?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => void persist(workflows.filter((w) => w.id !== flow.id)),
                      },
                    ])
                  }
                >
                  <Text style={styles.playText}>Delete</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!draft} animationType="slide" onRequestClose={() => setDraft(null)}>
        <SafeAreaView style={styles.shell} edges={['top']}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setDraft(null)} hitSlop={12}>
              <Ionicons name="close" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Edit workflow</Text>
            <View style={{ width: 40 }} />
          </View>
          {draft ? (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              <Text style={styles.cardSub}>Name</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.search}
                  value={draft.name}
                  onChangeText={(name) => setDraft({ ...draft, name })}
                  placeholder="Workflow name"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TouchableOpacity
                  style={[styles.tab, draft.enabled && styles.tabOn]}
                  onPress={() => setDraft({ ...draft, enabled: !draft.enabled })}
                >
                  <Text style={[styles.tabText, draft.enabled && styles.tabTextOn]}>
                    {draft.enabled ? 'Enabled' : 'Off'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, draft.use_deep_ai && styles.tabOn]}
                  onPress={() => setDraft({ ...draft, use_deep_ai: !draft.use_deep_ai })}
                >
                  <Text style={[styles.tabText, draft.use_deep_ai && styles.tabTextOn]}>Deep AI</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.cardSub}>Min seconds</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.search}
                  value={String(draft.min_duration_sec)}
                  onChangeText={(v) => setDraft({ ...draft, min_duration_sec: Number(v) || 0 })}
                  keyboardType="number-pad"
                  placeholder="Min seconds"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <Text style={styles.cardSub}>AI Chat — flow bolo</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.search}
                  value={chatPrompt}
                  onChangeText={setChatPrompt}
                  placeholder="Fresh, Interested, 90s Deep AI ON"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <TouchableOpacity
                style={[styles.playBtn, { marginBottom: 12 }]}
                disabled={chatBusy || !chatPrompt.trim() || !draft}
                onPress={async () => {
                  if (!draft) return;
                  setChatBusy(true);
                  try {
                    const json = await apiFetch<any>('/api/super_admin/call-iq-workflow-chat', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        message: chatPrompt,
                        workflow: draft,
                        crm_statuses: crmStatuses,
                      }),
                    });
                    if (json?.workflow) {
                      setDraft({
                        ...draft,
                        name: String(json.workflow.name || draft.name),
                        enabled: json.workflow.enabled !== false,
                        min_duration_sec: Number(json.workflow.min_duration_sec) || draft.min_duration_sec,
                        lead_statuses: Array.isArray(json.workflow.lead_statuses)
                          ? json.workflow.lead_statuses.map(String)
                          : draft.lead_statuses,
                        use_deep_ai: json.workflow.use_deep_ai !== false,
                        skip_if_sop_exists: json.workflow.skip_if_sop_exists !== false,
                      });
                    }
                    Alert.alert('AI Chat', json?.reply || 'Updated');
                    setChatPrompt('');
                  } catch (e: any) {
                    Alert.alert('AI Chat', e?.message || 'Failed');
                  } finally {
                    setChatBusy(false);
                  }
                }}
              >
                <Text style={styles.playText}>{chatBusy ? 'AI…' : 'Ask AI'}</Text>
              </TouchableOpacity>
              <Text style={[styles.cardSub, { marginBottom: 8 }]}>Lead statuses (CRM)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {crmStatuses.map((name) => {
                  const on = draft.lead_statuses.some((s) => s.toLowerCase() === name.toLowerCase());
                  return (
                    <TouchableOpacity
                      key={name}
                      onPress={() => toggleDraftStatus(name)}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={styles.playBtn}
                disabled={saving}
                onPress={async () => {
                  const next = workflows.some((w) => w.id === draft.id)
                    ? workflows.map((w) => (w.id === draft.id ? draft : w))
                    : [...workflows, draft];
                  await persist(next);
                  setDraft(null);
                }}
              >
                <Text style={styles.playText}>{saving ? 'Saving…' : 'Save flow'}</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </OpsShell>
  );
}

export function LeadManagerPlaybookScreen() {
  const [voice, setVoice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<any>('/api/super_admin/ai-suite/playbook');
        setVoice(String(data?.playbook?.voice_style || ''));
      } catch (e: any) {
        Alert.alert('Playbook', e?.message || 'Failed');
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const current = await apiFetch<any>('/api/super_admin/ai-suite/playbook');
      await apiFetch<any>('/api/super_admin/ai-suite/playbook', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(current?.playbook || {}), voice_style: voice }),
      });
      Alert.alert('Playbook', 'Voice & Style saved. Full editor is on web.');
    } catch (e: any) {
      Alert.alert('Playbook', e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <OpsShell title="Sales Playbook">
      <Text style={styles.cardSub}>Voice & Style (web pe full playbook)</Text>
      <TextInput
        style={[styles.search, { minHeight: 160, textAlignVertical: 'top', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 8 }]}
        multiline
        value={voice}
        onChangeText={setVoice}
      />
      <TouchableOpacity style={[styles.playBtn, { marginTop: 12 }]} disabled={saving} onPress={() => void save()}>
        <Text style={styles.playText}>{saving ? 'Saving…' : 'Save voice'}</Text>
      </TouchableOpacity>
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
  cardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, flexShrink: 1 },
  cardSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  badgeOn: { backgroundColor: '#D1FAE5', color: '#065F46' },
  badgeOff: { backgroundColor: '#E2E8F0', color: '#475569' },
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
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipOn: { backgroundColor: '#4C1D95', borderColor: '#4C1D95' },
  chipText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  chipTextOn: { color: '#fff' },
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
