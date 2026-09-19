import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Modal,
  Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';
import {
  ADS_COLUMNS,
  COLUMNS_STORAGE_KEY,
  DEFAULT_CAMPAIGN_COLUMNS,
  DEFAULT_LIST_COLUMNS,
  UNAVAILABLE_COLUMN_GROUPS,
  sanitizeCampaignColumns,
  type AdsColumn,
} from '../../../lib/googleAdsColumns';

type Section = 'overview' | 'ask' | 'reports' | 'campaigns' | 'ad_groups' | 'ads' | 'keywords' | 'search_terms' | 'conversions' | 'connect';
const DATE_PRESETS = [
  { id: 'TODAY', label: 'Today' },
  { id: 'YESTERDAY', label: 'Yesterday' },
  { id: 'THIS_WEEK_SUN_TODAY', label: 'This week' },
  { id: 'LAST_7_DAYS', label: 'Last 7 days' },
  { id: 'LAST_WEEK_SUN_SAT', label: 'Last week' },
  { id: 'LAST_14_DAYS', label: 'Last 14 days' },
  { id: 'THIS_MONTH', label: 'This month' },
  { id: 'LAST_MONTH', label: 'Last month' },
  { id: 'LAST_30_DAYS', label: 'Last 30 days' },
  { id: 'LAST_30_TO_TODAY', label: '30d to today' },
  { id: 'ALL_TIME', label: 'All time' },
] as const;

const SECTION_LABEL: Record<Section, string> = {
  overview: 'Overview',
  ask: 'Ask AI',
  reports: 'Reports',
  campaigns: 'Campaigns',
  ad_groups: 'Ad groups',
  ads: 'Ads',
  keywords: 'Keywords',
  search_terms: 'Search terms',
  conversions: 'Conversions',
  connect: 'Connect',
};

const ASK_CHIPS = ['Kaunsi copy chalaun?', 'Aaj kitna spend?', '7 din ki report', 'Keywords se headlines suggest kar'];

const LIST_ACTIONS: Partial<Record<Section, string>> = {
  campaigns: 'campaigns',
  ad_groups: 'ad_groups',
  ads: 'ads',
  keywords: 'keywords',
  search_terms: 'search_terms',
};

function inr(n: number, currency = 'INR') {
  const value = Math.round(Number(n) || 0);
  return `${currency} ${value.toLocaleString('en-IN')}`;
}

function formatAdsCell(col: AdsColumn, row: any, currency: string) {
  if (col.key === 'name') return String(row.name || row.text || '—');
  if (col.key === 'channel') return [row.channel, row.match, row.type].filter(Boolean).join(' · ') || '—';
  if (col.key === 'budget') {
    const amount = Number(row.budget || 0);
    if (!amount) return '—';
    return `${inr(amount, currency)}${String(row.budget_period || 'DAILY') === 'DAILY' ? '/day' : ''}`;
  }
  const value = row[col.key];
  if (col.fmt === 'status') return value || '—';
  if (col.fmt === 'money') return value != null && !Number.isNaN(Number(value)) ? inr(Number(value), currency) : '—';
  if (col.fmt === 'pct') return value != null ? `${Number(value).toFixed(2)}%` : '—';
  if (col.fmt === 'score') return value != null ? `${Number(value).toFixed(1)}%` : '—';
  if (value == null || value === '') return '—';
  return String(value);
}

export function SuperAdminGoogleAdsMcpScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [conversionReport, setConversionReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [loginCustomerId, setLoginCustomerId] = useState('');
  const [section, setSection] = useState<Section>('overview');
  const [during, setDuring] = useState('LAST_7_DAYS');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [status, setStatus] = useState('ALL');
  const [query, setQuery] = useState('');
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [campaignColumns, setCampaignColumns] = useState<string[]>(DEFAULT_CAMPAIGN_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [reportBusy, setReportBusy] = useState(false);

  const postAction = async (body: Record<string, unknown>, timeoutMs = 30000) =>
    apiFetch<any>('/api/super_admin/google-ads-mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs,
    });

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<any>('/api/super_admin/google-ads-mcp');
      setPayload(data);
      setCustomerId(String(data?.settings?.customer_id_display || data?.settings?.customer_id || ''));
      setLoginCustomerId(String(data?.settings?.login_customer_id_display || data?.settings?.login_customer_id || ''));
      setOverview(null);
      setRows([]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load Google Ads');
      setPayload(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void AsyncStorage.getItem(COLUMNS_STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        setCampaignColumns(sanitizeCampaignColumns(JSON.parse(raw)));
      } catch {
        /* keep default */
      }
    });
  }, [load]);

  const setAndSaveColumns = (next: string[]) => {
    const clean = sanitizeCampaignColumns(next);
    setCampaignColumns(clean);
    void AsyncStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(clean));
  };

  useEffect(() => {
    if (!payload?.settings?.ready) return;
    const run = async () => {
      try {
        if (section === 'overview') {
          setOverview(await postAction({ action: 'overview', during, since, until }).catch(() => null));
        }
        if (section === 'conversions') {
          setConversionReport(await postAction({ action: 'conversions', during, since, until }).catch(() => null));
        }
        const action = LIST_ACTIONS[section];
        if (action) {
          const json = await postAction({ action, during, since, until, status, limit: 40 }).catch(() => null);
          setRows(json?.campaigns || json?.ad_groups || json?.ads || json?.keywords || json?.search_terms || []);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load section');
      }
    };
    void run();
  }, [section, during, since, until, status, payload?.settings?.ready]);

  const save = async () => {
    setSaving(true);
    try {
      await postAction({
        action: 'save_settings',
        customer_id: customerId,
        login_customer_id: loginCustomerId,
      });
      await load();
      Alert.alert('Saved', 'Google Ads customer IDs updated');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    try {
      const json = await postAction({ action: 'test_connection' });
      Alert.alert('Connected', json?.account?.name || 'Google Ads API reachable');
      await load();
    } catch (e: any) {
      Alert.alert('Test failed', e?.message || 'Could not reach Google Ads');
    }
  };

  const sendChat = async (preset?: string) => {
    const message = String(preset || chatInput).trim();
    if (!message || chatBusy) return;
    setChatBusy(true);
    setChatInput('');
    setChat((prev) => [...prev, { role: 'user', content: message }]);
    try {
      const json = await postAction({ action: 'chat', message, history: chat.slice(-6) }, 70000);
      const report = json?.report;
      const extra = report
        ? `\n${report.label || ''}\nSpend ${inr(report.metrics?.spend || 0, 'INR')} · ${report.metrics?.clicks || 0} clicks · ${report.metrics?.conversions || 0} results · ${report.metrics?.all_conversions || 0} all conv.`
        : '';
      setChat((prev) => [...prev, { role: 'assistant', content: `${json?.reply || 'No reply'}${extra}` }]);
    } catch (e: any) {
      setChat((prev) => [...prev, { role: 'assistant', content: e?.message || 'Ask AI failed' }]);
    } finally {
      setChatBusy(false);
    }
  };

  const openCampaign = async (id?: string) => {
    if (!id) return;
    setDetailLoading(true);
    try {
      const json = await postAction({ action: 'campaign_detail', campaign_id: id, during, since, until }, 45000);
      setDetail(json);
    } catch (e: any) {
      Alert.alert('Campaign', e?.message || 'Could not load campaign');
    } finally {
      setDetailLoading(false);
    }
  };

  const connectGoogle = async () => {
    const url = String(payload?.oauth_url || '');
    if (!url) {
      Alert.alert('OAuth', 'Connect URL missing. Open the website admin instead.');
      return;
    }
    const ok = await Linking.canOpenURL(url);
    if (!ok) {
      Alert.alert('OAuth', 'Open Super Admin → Google Ads on the website to connect.');
      return;
    }
    await Linking.openURL(url);
  };

  const currency = overview?.currency || 'INR';
  const periods = overview?.periods || {};
  const ready = Boolean(payload?.settings?.ready);
  const visible = query.trim()
    ? rows.filter((row) =>
        [row.name, row.text, row.campaign, row.ad_group].join(' ').toLowerCase().includes(query.trim().toLowerCase()),
      )
    : rows;
  const tableCols = useMemo(() => {
    const keys = section === 'campaigns' ? campaignColumns : DEFAULT_LIST_COLUMNS;
    return keys.map((key) => ADS_COLUMNS.find((c) => c.key === key)).filter((c): c is AdsColumn => Boolean(c));
  }, [section, campaignColumns]);

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          Google Ads
        </Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            setRefreshing(true);
            void load();
          }}
          hitSlop={12}
        >
          <Ionicons name="refresh" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {(Object.keys(SECTION_LABEL) as Section[]).map((id) => (
              <TouchableOpacity
                key={id}
                style={[styles.chip, section === id && styles.chipActive]}
                onPress={() => setSection(id)}
              >
                <Text style={[styles.chipText, section === id && styles.chipTextActive]}>{SECTION_LABEL[id]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView
            contentContainerStyle={styles.body}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void load();
                }}
              />
            }
          >
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {section !== 'connect' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {DATE_PRESETS.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.chip, during === item.id && styles.chipActive]}
                    onPress={() => {
                      setDuring(item.id);
                      setSince('');
                      setUntil('');
                      setRows([]);
                      setOverview(null);
                    }}
                  >
                    <Text style={[styles.chipText, during === item.id && styles.chipTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}
            {section === 'overview' && (
              <>
                {!ready ? (
                  <Text style={styles.hint}>Connect Google Ads on the Connect tab first.</Text>
                ) : null}
                {overview?.account ? (
                  <Text style={styles.hint}>
                    {overview.account.name} · {overview.account.id}
                  </Text>
                ) : null}
                <View style={styles.summaryGrid}>
                  {[
                    ['Today', periods.today],
                    ['Last 7d', periods.last_7d],
                    ['Last 30d', periods.last_30d],
                  ].map(([label, period]: any) => (
                    <View key={String(label)} style={styles.summaryCard}>
                      <Text style={styles.summaryLbl}>{String(label)}</Text>
                      <Text style={styles.summaryVal}>{inr(period?.spend || 0, currency)}</Text>
                      <Text style={styles.cardMeta}>
                        {period?.clicks || 0} clicks · {period?.conversions || 0} conv.
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {section === 'reports' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Generate report</Text>
                <Text style={styles.hint}>Enabled campaigns only. Ek campaign tap karke uski report kholo.</Text>
                <View style={styles.chipRow}>
                  {[
                    ['today', 'Today'],
                    ['last_7d', '7 days'],
                    ['last_30d', '30 days'],
                    ['briefing', 'Briefing'],
                  ].map(([id, label]) => (
                    <TouchableOpacity
                      key={id}
                      style={styles.chip}
                      disabled={reportBusy}
                      onPress={async () => {
                        setReportBusy(true);
                        try {
                          const json = await postAction(
                            { action: 'generate_report', period: id, campaign_id: report?.campaign_id || '' },
                            70000,
                          );
                          setReport(json?.report || null);
                        } catch (e: any) {
                          Alert.alert('Report', e?.message || 'Failed');
                        } finally {
                          setReportBusy(false);
                        }
                      }}
                    >
                      <Text style={styles.chipText}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {reportBusy ? <ActivityIndicator color={COLORS.primary} /> : null}
                {report ? (
                  <>
                    {(report.campaigns || []).length ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                        <TouchableOpacity
                          style={[styles.chip, !report.campaign_id ? styles.chipActive : null]}
                          disabled={reportBusy}
                          onPress={async () => {
                            setReportBusy(true);
                            try {
                              const json = await postAction(
                                { action: 'generate_report', period: report.period || 'last_7d', campaign_id: '' },
                                70000,
                              );
                              setReport(json?.report || null);
                            } catch (e: any) {
                              Alert.alert('Report', e?.message || 'Failed');
                            } finally {
                              setReportBusy(false);
                            }
                          }}
                        >
                          <Text style={[styles.chipText, !report.campaign_id ? styles.chipTextActive : null]}>All enabled</Text>
                        </TouchableOpacity>
                        {(report.campaigns || []).map((c: any) => (
                          <TouchableOpacity
                            key={c.id}
                            style={[styles.chip, String(report.campaign_id) === String(c.id) ? styles.chipActive : null]}
                            disabled={reportBusy}
                            onPress={async () => {
                              setReportBusy(true);
                              try {
                                const json = await postAction(
                                  { action: 'generate_report', period: report.period || 'last_7d', campaign_id: c.id },
                                  70000,
                                );
                                setReport(json?.report || null);
                              } catch (e: any) {
                                Alert.alert('Report', e?.message || 'Failed');
                              } finally {
                                setReportBusy(false);
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                String(report.campaign_id) === String(c.id) ? styles.chipTextActive : null,
                              ]}
                            >
                              {c.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    ) : null}
                    <Text style={styles.sectionTitle}>{report.label || report.title}</Text>
                    <Text style={styles.summaryVal}>{inr(report.metrics?.spend || 0, currency)}</Text>
                    <Text style={styles.cardMeta}>
                      {report.metrics?.clicks || 0} clicks · {report.metrics?.conversions || 0} results
                    </Text>
                    {(report.insights?.lines || []).map((line: string) => (
                      <Text key={line} style={styles.cardMeta}>
                        • {line}
                      </Text>
                    ))}
                    {(report.campaign_id ? [report.campaign] : report.campaigns || [])
                      .filter(Boolean)
                      .map((c: any) => (
                        <Text key={c.id} style={styles.cardMeta}>
                          {c.name} · {inr(c.spend || 0, currency)} · {c.conversions || 0} results
                        </Text>
                      ))}
                    {(report.ad_groups || []).map((g: any) => (
                      <Text key={g.id || g.name} style={styles.cardMeta}>
                        {g.name} · {inr(g.spend || 0, currency)}
                      </Text>
                    ))}
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={() => void Share.share({ message: report.markdown || report.title || 'Google Ads report' })}
                    >
                      <Text style={styles.saveBtnText}>Export text</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            )}

            {section === 'ask' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Ask Google Ads</Text>
                <View style={styles.chipRow}>
                  {ASK_CHIPS.map((chip) => (
                    <TouchableOpacity key={chip} style={styles.chip} onPress={() => void sendChat(chip)} disabled={chatBusy}>
                      <Text style={styles.chipText}>{chip}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {chat.map((m, i) => (
                  <Text key={`${m.role}-${i}`} style={m.role === 'user' ? styles.cardTitle : styles.cardMeta}>
                    {m.role === 'user' ? 'You: ' : 'AI: '}
                    {m.content}
                  </Text>
                ))}
                <TextInput
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Sawaal likho…"
                  style={styles.input}
                />
                <TouchableOpacity style={styles.saveBtn} onPress={() => void sendChat()} disabled={chatBusy}>
                  <Text style={styles.saveBtnText}>{chatBusy ? 'Thinking…' : 'Send'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {section === 'conversions' && (
              <>
                <View style={styles.summaryGrid}>
                  {[
                    ['Results', String(conversionReport?.totals?.conversions || 0)],
                    ['All conv.', String(conversionReport?.totals?.all_conversions || 0)],
                    ['Value', inr(conversionReport?.totals?.conversion_value || 0, currency)],
                  ].map(([label, value]) => (
                    <View key={String(label)} style={styles.summaryCard}>
                      <Text style={styles.summaryLbl}>{String(label)}</Text>
                      <Text style={styles.summaryVal}>{value}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Fired this range</Text>
                  <Text style={styles.hint}>Results = Include in Conversions on. Baaki All conv. me.</Text>
                  {(conversionReport?.fired || []).length === 0 ? (
                    <Text style={styles.empty}>Is range me conversion nahi aayi.</Text>
                  ) : (
                    (conversionReport.fired as any[]).map((row) => (
                      <View key={row.id || row.name} style={{ marginTop: 10 }}>
                        <Text style={styles.cardTitle}>{row.name}</Text>
                        <Text style={styles.cardMeta}>
                          Results {row.conversions || 0} · All {row.all_conversions || 0}
                          {row.in_results ? ' · In Results' : ' · Secondary'}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}

            {LIST_ACTIONS[section] && (
              <>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search…"
                  style={styles.input}
                  autoCapitalize="none"
                />
                <View style={styles.chipRow}>
                  {(['ALL', 'ENABLED', 'PAUSED'] as const).map((id) => (
                    <TouchableOpacity
                      key={id}
                      style={[styles.chip, status === id && styles.chipActive]}
                      onPress={() => {
                        setStatus(id);
                        setRows([]);
                      }}
                    >
                      <Text style={[styles.chipText, status === id && styles.chipTextActive]}>{id === 'ALL' ? 'All' : id}</Text>
                    </TouchableOpacity>
                  ))}
                  {section === 'campaigns' ? (
                    <TouchableOpacity style={styles.chip} onPress={() => setColumnsOpen(true)}>
                      <Text style={styles.chipText}>Columns</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={styles.row}>
                  <TextInput
                    value={since}
                    onChangeText={(v) => {
                      setSince(v);
                      setDuring('CUSTOM');
                    }}
                    placeholder="From YYYY-MM-DD"
                    style={[styles.input, { flex: 1 }]}
                    autoCapitalize="none"
                  />
                  <TextInput
                    value={until}
                    onChangeText={(v) => {
                      setUntil(v);
                      setDuring('CUSTOM');
                    }}
                    placeholder="To YYYY-MM-DD"
                    style={[styles.input, { flex: 1 }]}
                    autoCapitalize="none"
                  />
                </View>
                {visible.length === 0 ? (
                  <Text style={styles.empty}>No rows for this range.</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator>
                    <View>
                      <View style={styles.tableHead}>
                        {tableCols.map((col) => (
                          <Text
                            key={col.key}
                            style={[styles.th, col.key === 'name' || col.fmt === 'text' || col.fmt === 'status' ? styles.thName : styles.thNum]}
                          >
                            {col.label}
                          </Text>
                        ))}
                      </View>
                      {visible.map((item, index) => {
                        const row = (
                          <View key={item.id || item.text || String(index)} style={styles.tableRow}>
                            {tableCols.map((col) => (
                              <Text
                                key={col.key}
                                style={[
                                  styles.td,
                                  col.key === 'name' || col.fmt === 'text' || col.fmt === 'status' ? styles.thName : styles.thNum,
                                  section === 'campaigns' && col.key === 'name' ? { color: COLORS.primary } : null,
                                ]}
                                numberOfLines={col.key === 'name' ? 2 : 1}
                              >
                                {formatAdsCell(col, item, currency)}
                              </Text>
                            ))}
                          </View>
                        );
                        return section === 'campaigns' && item.id ? (
                          <TouchableOpacity key={item.id} onPress={() => void openCampaign(String(item.id))}>
                            {row}
                          </TouchableOpacity>
                        ) : (
                          row
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
              </>
            )}

            {section === 'connect' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Account IDs</Text>
                <Text style={styles.hint}>Developer token stays on the server. Save customer + MCC here if needed.</Text>
                <TextInput
                  value={customerId}
                  onChangeText={setCustomerId}
                  placeholder="Customer ID"
                  style={styles.input}
                  autoCapitalize="none"
                />
                <TextInput
                  value={loginCustomerId}
                  onChangeText={setLoginCustomerId}
                  placeholder="MCC / login-customer-id"
                  style={styles.input}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.saveBtn} onPress={() => void save()} disabled={saving}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save IDs'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, styles.secondaryBtn]} onPress={() => void test()}>
                  <Text style={styles.secondaryText}>Test connection</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, styles.secondaryBtn]} onPress={() => void connectGoogle()}>
                  <Text style={styles.secondaryText}>Connect with Google</Text>
                </TouchableOpacity>
                <Text style={styles.hint}>
                  Token {payload?.settings?.developer_token_hint || 'missing'} · Refresh{' '}
                  {payload?.settings?.refresh_token_hint || 'not connected'}
                </Text>
              </View>
            )}
          </ScrollView>
        </>
      )}
      <Modal visible={columnsOpen} animationType="slide" transparent onRequestClose={() => setColumnsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.row}>
              <Text style={styles.sectionTitle}>Modify columns</Text>
              <TouchableOpacity onPress={() => setColumnsOpen(false)}>
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 440 }}>
              {(['Recommended', 'Performance', 'Results', 'Conversions', 'Attributes'] as const).map((cat) => (
                <View key={cat} style={{ marginBottom: 10 }}>
                  <Text style={styles.summaryLbl}>{cat}</Text>
                  {ADS_COLUMNS.filter((col) => col.category === cat).map((col) => {
                    const on = campaignColumns.includes(col.key);
                    return (
                      <TouchableOpacity
                        key={col.key}
                        style={styles.colRow}
                        disabled={col.always}
                        onPress={() =>
                          setAndSaveColumns(on ? campaignColumns.filter((k) => k !== col.key) : [...campaignColumns, col.key])
                        }
                      >
                        <Ionicons
                          name={on ? 'checkbox' : 'square-outline'}
                          size={18}
                          color={on ? COLORS.primary : '#94A3B8'}
                        />
                        <Text style={styles.colLabel}>{col.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
              {UNAVAILABLE_COLUMN_GROUPS.map((line) => (
                <Text key={line} style={styles.hint}>
                  {line}
                </Text>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.saveBtn} onPress={() => setAndSaveColumns(DEFAULT_CAMPAIGN_COLUMNS)}>
              <Text style={styles.saveBtnText}>Recommended</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, styles.secondaryBtn]} onPress={() => setColumnsOpen(false)}>
              <Text style={styles.secondaryText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={Boolean(detail) || detailLoading} animationType="slide" onRequestClose={() => setDetail(null)}>
        <SafeAreaView style={styles.shell} edges={['top']}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setDetail(null)} hitSlop={12}>
              <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.topTitle} numberOfLines={1}>
              {detail?.campaign?.name || 'Campaign'}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          {detailLoading && !detail ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
          ) : (
            <ScrollView contentContainerStyle={styles.body}>
              <Text style={styles.hint}>
                {[detail?.campaign?.status, detail?.campaign?.channel, detail?.campaign?.bidding].filter(Boolean).join(' · ')}
              </Text>
              <View style={styles.summaryGrid}>
                {[
                  ['Budget', detail?.campaign?.budget ? `${inr(detail.campaign.budget, currency)}${detail.campaign.budget_period === 'DAILY' ? '/day' : ''}` : '—'],
                  ['Cost', inr(detail?.campaign?.spend || 0, currency)],
                  ['Clicks', String(detail?.campaign?.clicks || 0)],
                  ['Results', String(detail?.campaign?.conversions || 0)],
                  ['CTR', detail?.campaign?.ctr != null ? `${Number(detail.campaign.ctr).toFixed(2)}%` : '—'],
                  ['CPC', detail?.campaign?.cpc != null ? inr(detail.campaign.cpc, currency) : '—'],
                ].map(([label, value]) => (
                  <View key={String(label)} style={styles.summaryCard}>
                    <Text style={styles.summaryLbl}>{String(label)}</Text>
                    <Text style={styles.summaryVal}>{value}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Conversions · {Array.isArray(detail?.conversions) ? detail.conversions.length : 0}</Text>
                {Array.isArray(detail?.conversions) && detail.conversions.length ? (
                  detail.conversions.map((row: any, i: number) => (
                    <Text key={row.name || String(i)} style={styles.cardMeta}>
                      {row.name} · Results {row.conversions || 0} · All {row.all_conversions || 0}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.hint}>Is range me conversion event nahi aaya.</Text>
                )}
              </View>
              {[
                ['Ad groups', detail?.ad_groups],
                ['Ads', detail?.ads],
                ['Keywords', detail?.keywords],
                ['Search terms', detail?.search_terms],
              ].map(([title, rows]) => (
                <View key={String(title)} style={styles.card}>
                  <Text style={styles.sectionTitle}>
                    {String(title)} · {Array.isArray(rows) ? rows.length : 0}
                  </Text>
                  {Array.isArray(rows) && rows.length ? (
                    rows.slice(0, 20).map((row: any, i: number) => (
                      <Text key={row.id || row.text || String(i)} style={styles.cardMeta}>
                        {row.name || row.text} · {inr(row.spend || 0, currency)} · {row.conversions || 0} conv.
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.hint}>No rows for this range.</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: COLORS.primary },
  body: { padding: SPACING.md, paddingBottom: 40 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  hint: { fontSize: 12, color: '#64748B', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.md, paddingVertical: 10, gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  chipTextActive: { color: COLORS.primary },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  summaryCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryLbl: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'capitalize' },
  summaryVal: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', flex: 1 },
  cardMeta: { fontSize: 12, color: '#64748B', marginTop: 4 },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#F1F5F9',
    color: '#475569',
  },
  empty: { textAlign: 'center', color: '#64748B', marginTop: 24 },
  error: { color: '#B91C1C', marginBottom: 12, fontWeight: '700' },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  saveBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  secondaryBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  secondaryText: { color: COLORS.primary, fontWeight: '800', fontSize: 14 },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tableRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  th: { paddingHorizontal: 10, paddingVertical: 10, fontSize: 11, fontWeight: '800', color: '#64748B' },
  thName: { width: 180 },
  thNum: { width: 110, textAlign: 'right' },
  td: { paddingHorizontal: 10, paddingVertical: 12, fontSize: 12, color: '#0F172A', fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
  },
  colRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  colLabel: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
});
