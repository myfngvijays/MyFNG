import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Share,
  Platform,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { isVoiceRecordingAvailable, startVoiceNote, stopVoiceNote } from '../../../lib/pickupVoiceNote';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
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
      {children}
    </SafeAreaView>
  );
}

function flattenRows(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  const keys = [
    'rows',
    'items',
    'data',
    'leads',
    'customers',
    'mechanics',
    'plans',
    'faqs',
    'templates',
    'campaigns',
    'history',
    'checks',
    'links',
    'popups',
    'services',
    'overrides',
    'headers',
    'setupSteps',
    'contentTemplates',
    'consentTemplates',
    'telemarketers',
    'logs',
  ];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  const firstArray = Object.values(payload).find((v) => Array.isArray(v));
  return Array.isArray(firstArray) ? firstArray : [];
}

function rowTitle(row: any, index: number): string {
  return String(
    row?.name ||
      row?.title ||
      row?.label ||
      row?.full_name ||
      row?.customer_name ||
      row?.lead_number ||
      row?.code ||
      row?.phone ||
      row?.category ||
      `Item ${index + 1}`,
  );
}

function rowMeta(row: any): string {
  return [
    row?.status,
    row?.message,
    row?.reason,
    row?.city,
    row?.phone,
    row?.email,
    row?.plan_name,
    row?.created_at,
  ]
    .filter(Boolean)
    .map((v) => String(v))
    .slice(0, 3)
    .join(' · ');
}

export function SuperAdminApiModuleScreen() {
  const route = useRoute<any>();
  const title = String(route.params?.title || 'Admin module');
  const path = String(route.params?.path || '');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!path) {
      setError('No API path configured');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await apiFetch<any>(path);
      setPayload(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
      setPayload(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [path]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const rows = useMemo(() => flattenRows(payload).slice(0, 80), [payload]);
  const summaryEntries = useMemo(() => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
    const source =
      payload.settings && typeof payload.settings === 'object' && !Array.isArray(payload.settings)
        ? payload.settings
        : payload;
    return Object.entries(source)
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .slice(0, 12);
  }, [payload]);

  return (
    <Shell title={title}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
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
          {summaryEntries.length > 0 ? (
            <View style={styles.summaryGrid}>
              {summaryEntries.map(([key, value]) => (
                <View key={key} style={styles.summaryCard}>
                  <Text style={styles.summaryLbl}>{key.replace(/_/g, ' ')}</Text>
                  <Text style={styles.summaryVal}>{String(value)}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {rows.length === 0 && !error ? (
            <Text style={styles.empty}>No records on this module yet.</Text>
          ) : (
            rows.map((row, index) => (
              <View key={String(row?.id || `${rowTitle(row, index)}-${index}`)} style={styles.card}>
                <Text style={styles.cardTitle}>{rowTitle(row, index)}</Text>
                {rowMeta(row) ? <Text style={styles.cardMeta}>{rowMeta(row)}</Text> : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </Shell>
  );
}

export function SuperAdminDltSmsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [peId, setPeId] = useState('');
  const [peName, setPeName] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<any>('/api/super_admin/dlt-sms');
      setPayload(data);
      setPeId(String(data?.entity?.pe_id || ''));
      setPeName(String(data?.entity?.pe_name || ''));
    } catch (e: any) {
      setError(e?.message || 'Failed to load DLT SMS');
      setPayload(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveEntity = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/super_admin/dlt-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_entity',
          entity: { ...(payload?.entity || {}), pe_id: peId, pe_name: peName },
        }),
      });
      await load();
      Alert.alert('Saved', 'DLT entity updated');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not save entity');
    } finally {
      setSaving(false);
    }
  };

  const stats = payload?.stats || {};
  const steps: any[] = Array.isArray(payload?.setupSteps) ? payload.setupSteps : [];

  return (
    <Shell title="DLT SMS">
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
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
          <View style={styles.summaryGrid}>
            {[
              ['Entity', stats.entity],
              ['Headers', stats.headers],
              ['Consent', stats.consent],
              ['Content', stats.content],
            ].map(([label, counts]: any) => (
              <View key={String(label)} style={styles.summaryCard}>
                <Text style={styles.summaryLbl}>{label}</Text>
                <Text style={styles.summaryVal}>
                  {counts?.approved ?? 0} ok · {counts?.pending ?? 0} wait
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Principal Entity</Text>
            <Text style={styles.cardMeta}>
              {payload?.entity?.operator || 'JIO'} · {payload?.entity?.entity_status || '—'}
            </Text>
            <TextInput
              style={styles.input}
              value={peId}
              onChangeText={setPeId}
              placeholder="PE ID"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={peName}
              onChangeText={setPeName}
              placeholder="Registered name"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={() => void saveEntity()} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save entity'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Setup checklist</Text>
            {steps.map((step, i) => (
              <Text key={step.id || i} style={styles.cardMeta}>
                {step.done ? '✓' : `${i + 1}.`} {step.label}
              </Text>
            ))}
            <Text style={[styles.cardMeta, { marginTop: 8 }]}>
              Approve header & templates on Jio TrueConnect, then paste DLT IDs on web admin (full editor).
            </Text>
          </View>

          {(payload?.headers || []).slice(0, 8).map((row: any) => (
            <View key={row.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.cardTitle}>{row.header}</Text>
                <Text style={styles.badge}>{row.status}</Text>
              </View>
              <Text style={styles.cardMeta}>
                {row.header_type} · {row.dlt_header_id || 'no DLT id'}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </Shell>
  );
}

function cleanChatMarks(s: string) {
  return String(s || '')
    .replace(/\*\*/g, '')
    .replace(/`+/g, '')
    .trim();
}

function parseCampaignReply(text: string) {
  const raw = String(text || '').replace(/\r/g, '').trim();
  const chunks = raw.split(/\n(?=\s*\d+[\.\)]\s+)/);
  const intro: string[] = [];
  const campaigns: { name: string; metrics: { label: string; value: string }[] }[] = [];
  for (const chunk of chunks) {
    const numbered = chunk.match(/^\s*\d+[\.\)]\s+([\s\S]+)/);
    if (!numbered) {
      intro.push(chunk.trim());
      continue;
    }
    const lines = numbered[1]
      .split('\n')
      .map((l) => cleanChatMarks(l.replace(/^\s*[-•]\s*/, '')))
      .filter(Boolean);
    let name = '';
    const metrics: { label: string; value: string }[] = [];
    for (const line of lines) {
      const kv = line.match(/^([^:]{1,48}):\s*(.+)$/);
      if (!kv) {
        if (!name) name = line;
        continue;
      }
      const label = kv[1].trim();
      const value = kv[2].trim();
      if (/नाम|name|campaign/i.test(label)) name = value;
      else if (/खर्च|spend/i.test(label)) metrics.push({ label: 'Spend', value });
      else if (/इंप्रेशन|impression/i.test(label)) metrics.push({ label: 'Impr', value });
      else if (/क्लिक|clicks/i.test(label)) metrics.push({ label: 'Clicks', value });
      else if (/\bctr\b/i.test(label)) metrics.push({ label: 'CTR', value });
      else if (/परिणाम|रिज़ल्ट|result/i.test(label)) metrics.push({ label: 'Results', value });
      else metrics.push({ label, value });
    }
    if (name || metrics.length) campaigns.push({ name: name || 'Campaign', metrics: metrics.slice(0, 6) });
  }
  return { intro: intro.join('\n').trim(), campaigns };
}

function parseAdvice(text: string) {
  const advice: { kind: string; title: string; reason: string }[] = [];
  let verdict = '';
  for (const line of String(text || '').split('\n')) {
    const v = line.match(/^\s*Verdict:\s*(.+)$/i);
    if (v) {
      verdict = cleanChatMarks(v[1]);
      continue;
    }
    const m = line.match(/^\s*(KEEP|TEST|PAUSE|NEXT COPY|NEXT):\s*(.+)$/i);
    if (!m) continue;
    const raw = m[1].toUpperCase();
    const kind = raw.startsWith('KEEP') ? 'Keep' : raw.startsWith('TEST') ? 'Test' : raw.startsWith('PAUSE') ? 'Pause' : 'Next copy';
    const body = cleanChatMarks(m[2]);
    const bits = body.split(/\s+[—\-]\s+|\s+\|\s+/);
    advice.push({ kind, title: bits[0] || body, reason: bits.slice(1).join(' — ') });
  }
  return { verdict, advice };
}

function prettyMetricLabel(raw: string) {
  const k = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const map: Record<string, string> = {
    'current due': 'Due',
    due: 'Due',
    'spend cap': 'Spend cap',
    cap: 'Spend cap',
    'pay method': 'Pay method',
    'payment method': 'Pay method',
    funding: 'Pay method',
    'prepaid funds': 'Funds',
    funds: 'Funds',
    hint: 'Hint',
    aaj: 'Today',
    today: 'Today',
    'last 7 days': 'Last 7 days',
    'last 30 days': 'Last 30 days',
    chats: 'WA chats',
    'wa chats': 'WA chats',
  };
  if (map[k]) return map[k];
  return raw.trim();
}

function formatMetricValue(v: string) {
  const t = String(v || '').trim().replace(/\.\s*$/, '');
  if (/^no cap$/i.test(t) || /ads manager/i.test(t)) return t;
  const m = t.match(/^₹?\s*([\d,]+(?:\.\d+)?)$/);
  if (m) {
    const n = Number(m[1].replace(/,/g, ''));
    if (Number.isFinite(n)) return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
  return t;
}

function parseKvMetrics(text: string) {
  const metrics: { label: string; value: string }[] = [];
  const hints: string[] = [];
  const pieces = cleanChatMarks(text).split(/\n+/).flatMap((line) => {
    const trimmed = line.trim().replace(/^\s*[-•]\s*/, '');
    if (!trimmed) return [];
    if (/^\s*(Verdict|KEEP|TEST|PAUSE|NEXT COPY|NEXT):/i.test(trimmed)) return [];
    if (/^\s*\d+[\.\)]\s+/.test(trimmed)) return [];
    if ((trimmed.match(/:\s*/g) || []).length >= 2) {
      return trimmed.split(/,(?=\s*[^,:]{1,48}:\s*)/);
    }
    return [trimmed];
  });
  for (const piece of pieces) {
    const m = piece.trim().match(/^([^:]{1,48}):\s*(.+)$/);
    if (!m) {
      if (piece.trim()) hints.push(piece.trim());
      continue;
    }
    const label = prettyMetricLabel(m[1]);
    if (label === 'Hint') {
      hints.push(m[2].trim());
      continue;
    }
    const rest = m[2].trim();
    if (rest.includes('·')) {
      const parts = rest.split('·').map((p) => p.trim()).filter(Boolean);
      metrics.push({ label, value: formatMetricValue(parts[0]) });
      continue;
    }
    const money = rest.match(
      /^(₹\s*[\d,]+(?:\.\d+)?|INR\s*[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?%?|no cap)(?:\.?\s+)(.+)$/i,
    );
    if (money && money[2] && money[2].length > 10) {
      metrics.push({ label, value: formatMetricValue(money[1]) });
      hints.push(money[2].replace(/^\.+\s*/, '').trim());
    } else {
      metrics.push({ label, value: formatMetricValue(rest) });
    }
  }
  return { metrics, hints };
}

function answerKindOf(input: {
  advice: number;
  campaigns: number;
  metrics: { label: string; value: string }[];
  report?: unknown;
}) {
  if (input.report) return { title: 'Report', color: '#0F172A', icon: 'document-text' as const };
  if (input.advice > 0) return { title: 'Copy advice', color: '#047857', icon: 'bulb' as const };
  if (input.metrics.some((m) => /due|cap|fund|pay method|billing/i.test(m.label))) {
    return { title: 'Billing', color: '#D97706', icon: 'wallet' as const };
  }
  if (input.campaigns > 0) return { title: 'Campaigns', color: '#4F46E5', icon: 'megaphone' as const };
  if (input.metrics.length) return { title: 'Spend', color: '#004AAD', icon: 'stats-chart' as const };
  return { title: 'Answer', color: '#004AAD', icon: 'sparkles' as const };
}

function AskAnswerCard({ content, report }: { content: string; report?: any }) {
  const parsed = parseCampaignReply(content);
  const advice = parseAdvice(content);
  const kv = parseKvMetrics(parsed.intro);
  const kind = answerKindOf({
    advice: advice.advice.length,
    campaigns: parsed.campaigns.length,
    metrics: kv.metrics,
    report,
  });
  const tiles = kv.metrics;
  const prose = kv.hints;
  const introText = cleanChatMarks(content);

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        maxWidth: 268,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#fff',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: kind.color, paddingHorizontal: 10, paddingVertical: 6 }}>
        <Ionicons name={kind.icon} size={13} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>{kind.title.toUpperCase()}</Text>
      </View>
      {advice.verdict ? (
        <Text style={{ paddingHorizontal: 10, paddingTop: 8, fontSize: 12, color: '#334155', lineHeight: 16 }}>{advice.verdict}</Text>
      ) : null}
      {tiles.length ? (
        <View style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
          {tiles.map((m) => (
            <View key={`${m.label}-${m.value}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 5 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8' }}>{m.label.toUpperCase()}</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', flexShrink: 1, textAlign: 'right' }} numberOfLines={1}>
                {m.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {advice.advice.map((a) => (
        <View
          key={`${a.kind}-${a.title}`}
          style={{
            marginHorizontal: 8,
            marginBottom: 6,
            backgroundColor: a.kind === 'Keep' ? '#ECFDF5' : a.kind === 'Test' ? '#FFFBEB' : a.kind === 'Pause' ? '#FEF2F2' : '#F0F9FF',
            borderRadius: 10,
            padding: 8,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B' }}>{a.kind.toUpperCase()}</Text>
          <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 13, marginTop: 2 }}>{a.title}</Text>
          {a.reason ? <Text style={{ marginTop: 4, color: '#475569', fontSize: 12 }}>{a.reason}</Text> : null}
        </View>
      ))}
      {parsed.campaigns.slice(0, 8).map((c) => (
        <View
          key={c.name}
          style={{
            marginHorizontal: 10,
            marginBottom: 8,
            backgroundColor: '#F8FAFC',
            borderRadius: 12,
            padding: 10,
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}
        >
          <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 13 }}>{c.name}</Text>
          <Text style={{ marginTop: 4, color: '#475569', fontSize: 12 }}>
            {c.metrics.map((x) => `${x.label} ${x.value}`).join('  ·  ')}
          </Text>
        </View>
      ))}
      {!tiles.length && !advice.advice.length && !parsed.campaigns.length ? (
        <Text style={{ paddingHorizontal: 10, paddingVertical: 8, color: '#0F172A', fontSize: 12, lineHeight: 17 }}>{introText}</Text>
      ) : null}
      {prose.length ? (
        <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
          {prose.map((h) => (
            <Text key={h} numberOfLines={1} style={{ fontSize: 10, color: '#94A3B8' }}>
              {h}
            </Text>
          ))}
        </View>
      ) : null}
      {report ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
          <TouchableOpacity
            onPress={async () => {
              await Clipboard.setStringAsync(report.markdown || content);
              Alert.alert('Copied', 'Report clipboard pe aa gayi');
            }}
          >
            <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 12 }}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void shareMetaAdsFile(report, 'xlsx')}>
            <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 12 }}>Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void shareMetaAdsFile(report, 'csv')}>
            <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 12 }}>CSV</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

async function shareMetaAdsFile(report: any, format: 'xlsx' | 'csv') {
  const json = await apiFetch<any>('/api/super_admin/meta-ads-mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'export_report', format, report, period: report?.period }),
    timeoutMs: 45000,
  });
  const filename = String(json.filename || `myfng-ads.${format}`);
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  const path = `${dir}${filename}`;
  if (format === 'csv') {
    await FileSystem.writeAsStringAsync(path, String(json.content || ''));
  } else {
    await FileSystem.writeAsStringAsync(path, String(json.base64 || ''), {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
  let openUri = path;
  if (Platform.OS === 'android' && typeof (FileSystem as any).getContentUriAsync === 'function') {
    openUri = await (FileSystem as any).getContentUriAsync(path);
  }
  try {
    await Share.share({
      title: filename,
      url: openUri,
      message: Platform.OS === 'android' ? filename : undefined,
    });
  } catch {
    const opened = await Linking.canOpenURL(openUri);
    if (opened) await Linking.openURL(openUri);
    else Alert.alert('Saved', `${filename} cache mein save ho gayi.`);
  }
}

function moneyShort(n: unknown, currency = 'INR') {
  return `${currency} ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
}

function prettyHour(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  if (/\b(am|pm)\b/i.test(raw)) return raw.replace(/\s*[-–—]\s*/g, ' – ');
  const parts = raw.split(/\s*[-–—]\s*/).map((part) => {
    const m = part.trim().match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?$/);
    if (!m) return '';
    const hour24 = Number(m[1]);
    if (!Number.isFinite(hour24) || hour24 < 0 || hour24 > 23) return '';
    const minutes = m[2] || '00';
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour24 % 12 || 12}:${minutes} ${suffix}`;
  }).filter(Boolean);
  return parts.length ? parts.join(' – ') : raw;
}

function bucketStatus(value: unknown) {
  const s = String(value || '').toUpperCase();
  if (s === 'ACTIVE') return 'active';
  if (s.includes('PAUSE')) return 'paused';
  return 'inactive';
}

function scopeReport(report: any, campaignId: string, status: string) {
  let campaigns: any[] = Array.isArray(report?.campaigns) ? [...report.campaigns] : [];
  if (campaignId !== 'all') campaigns = campaigns.filter((c) => String(c.id) === campaignId);
  else if (status !== 'all') campaigns = campaigns.filter((c) => bucketStatus(c.effective_status || c.status) === status);
  const ids = new Set(campaigns.map((c) => String(c.id)));
  const pick = (key: string) =>
    Array.isArray(report?.[key]) ? report[key].filter((row: any) => ids.has(String(row.campaign_id || row.id))) : [];
  return {
    ...report,
    campaigns,
    adsets: pick('adsets'),
    ads: pick('ads'),
    placements: pick('placements'),
    platforms: pick('platforms'),
    ages: pick('ages'),
    genders: pick('genders'),
    countries: pick('countries'),
    devices: pick('devices'),
    hours: pick('hours').map((row: any) => ({ ...row, hour: prettyHour(row.hour) })),
    device_platforms: pick('device_platforms'),
    filename:
      campaignId !== 'all'
        ? String(report?.filename || 'myfng-ads.xlsx').replace(/\.xlsx$/i, `-${campaignId.slice(-6)}.xlsx`)
        : report?.filename,
  };
}

const NESTED_TABS: Record<string, string> = {
  placement: 'publisher_platform,platform_position',
  platform: 'publisher_platform',
  age: 'age',
  gender: 'gender',
  country: 'country',
  device: 'impression_device',
  hour: 'hourly_stats_aggregated_by_advertiser_time_zone',
  device_platform: 'device_platform',
};

function rowTotals(list: any[]) {
  const spend = list.reduce((s, r) => s + Number((r.metrics || r).spend || 0), 0);
  const results = list.reduce((s, r) => s + Number((r.metrics || r).results || 0), 0);
  const clicks = list.reduce((s, r) => s + Number((r.metrics || r).clicks || 0), 0);
  const impressions = list.reduce((s, r) => s + Number((r.metrics || r).impressions || 0), 0);
  return {
    spend,
    results,
    clicks,
    impressions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpr: results > 0 ? spend / results : 0,
  };
}

function MetaAdsReportTables({ report }: { report: any }) {
  const [tab, setTab] = useState('campaigns');
  const [status, setStatus] = useState('active');
  const [campaignId, setCampaignId] = useState('all');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'active' | 'inactive'>('active');
  const [pickerQ, setPickerQ] = useState('');
  const [openCampaigns, setOpenCampaigns] = useState<Record<string, boolean>>({});
  const [openAdsets, setOpenAdsets] = useState<Record<string, boolean>>({});
  const [childCache, setChildCache] = useState<Record<string, { adsets: any[]; ads: any[]; loading?: boolean; error?: string }>>({});
  const currency = report?.account?.currency || 'INR';
  const scoped = scopeReport(report, campaignId, status);
  const campaigns: any[] = scoped.campaigns || [];
  const allCampaigns: any[] = Array.isArray(report?.campaigns) ? report.campaigns : [];
  const summary: any[] = Array.isArray(report?.summary) ? report.summary : [];
  const map: Record<string, any[]> = {
    campaigns,
    adsets: scoped.adsets || [],
    ads: scoped.ads || [],
    placement: scoped.placements || [],
    platform: scoped.platforms || [],
    age: scoped.ages || [],
    gender: scoped.genders || [],
    country: scoped.countries || [],
    device: scoped.devices || [],
    hour: scoped.hours || [],
    device_platform: scoped.device_platforms || [],
  };
  const rows = map[tab] || campaigns;
  const selected = allCampaigns.find((c) => String(c.id) === campaignId);
  const activeCount = allCampaigns.filter((c) => bucketStatus(c.effective_status || c.status) === 'active').length;
  const pickerList = allCampaigns.filter((c) => {
    const bucket = bucketStatus(c.effective_status || c.status);
    if (pickerMode === 'active' ? bucket !== 'active' : bucket === 'active') return false;
    const hay = `${c.name} ${c.id}`.toLowerCase();
    return !pickerQ.trim() || hay.includes(pickerQ.trim().toLowerCase());
  });
  const nested = Boolean(NESTED_TABS[tab]);
  const grouped = nested
    ? Object.values(
        rows.reduce((acc: Record<string, { id: string; name: string; rows: any[] }>, row) => {
          const id = String(row.campaign_id || 'unknown');
          const name = String(row.campaign_name || campaigns.find((c) => String(c.id) === id)?.name || id);
          if (!acc[id]) acc[id] = { id, name, rows: [] };
          acc[id].rows.push(row);
          return acc;
        }, {}),
      ).sort((a, b) => Number(rowTotals(b.rows).spend) - Number(rowTotals(a.rows).spend))
    : [];
  const totals = rowTotals(nested ? grouped.flatMap((g) => g.rows) : rows.map((r) => r.metrics || r.last_7d || r));

  const headers =
    tab === 'campaigns'
      ? ['Campaign', 'Status', 'Spend', 'Results', 'CPR', 'Clicks', 'CTR']
      : tab === 'adsets'
        ? ['Ad set', 'Status', 'Spend', 'Results', 'CTR']
        : tab === 'ads'
          ? ['Ad', 'Status', 'Spend', 'Results', 'CTR']
          : tab === 'placement'
            ? ['Name', 'Platform', 'Placement', 'Spend', 'Results', 'CTR']
            : tab === 'platform'
              ? ['Name', 'Platform', 'Spend', 'Results', 'CTR']
              : tab === 'age'
                ? ['Name', 'Age', 'Spend', 'Results', 'CTR']
                : tab === 'gender'
                  ? ['Name', 'Gender', 'Spend', 'Results', 'CTR']
                  : tab === 'country'
                    ? ['Name', 'Country', 'Spend', 'Results', 'CTR']
                    : tab === 'hour'
                      ? ['Name', 'Hour', 'Spend', 'Results', 'CTR']
                      : ['Name', 'Device', 'Spend', 'Results', 'CTR'];

  const metricCells = (m: any, extra: string[] = []) => [
    ...extra,
    moneyShort(m.spend, currency),
    String(m.results || 0),
    tab === 'campaigns' ? moneyShort(m.cpr, currency) : `${Number(m.ctr || 0).toFixed(2)}%`,
    ...(tab === 'campaigns' ? [String(m.clicks || 0), `${Number(m.ctr || 0).toFixed(2)}%`] : []),
  ];

  const loadChildren = async (id: string) => {
    const key = `${tab}:${id}`;
    if (childCache[key]?.loading || (childCache[key] && !childCache[key].error)) return;
    setChildCache((prev) => ({ ...prev, [key]: { adsets: [], ads: [], loading: true } }));
    try {
      const json = await apiFetch<any>('/api/super_admin/meta-ads-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'insights_breakdown',
          object_id: id,
          breakdowns: NESTED_TABS[tab],
          date_preset: report.date_preset,
          since: report.since,
          until: report.until,
        }),
        timeoutMs: 45000,
      });
      setChildCache((prev) => ({
        ...prev,
        [key]: { adsets: json.adsets || [], ads: json.ads || [], loading: false, error: json.error || '' },
      }));
    } catch (e: any) {
      setChildCache((prev) => ({
        ...prev,
        [key]: { adsets: [], ads: [], loading: false, error: e?.message || 'Failed' },
      }));
    }
  };

  const toggleCampaign = (id: string) => {
    const next = !openCampaigns[id];
    setOpenCampaigns((prev) => ({ ...prev, [id]: next }));
    if (next && nested) void loadChildren(id);
  };

  const renderCells = (cells: string[], key: string, opts?: { bold?: boolean; bg?: string; indent?: number; color?: string }) => (
    <View
      key={key}
      style={{
        flexDirection: 'row',
        backgroundColor: opts?.bg || '#fff',
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        paddingLeft: opts?.indent || 0,
      }}
    >
      {cells.map((cell, i) => (
        <Text
          key={`${key}-${i}`}
          numberOfLines={2}
          style={{ color: opts?.color || '#0F172A', fontSize: 10, width: 92, paddingHorizontal: 6, fontWeight: opts?.bold || i === 0 ? '700' : '500' }}
        >
          {cell}
        </Text>
      ))}
    </View>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{report.title}</Text>
      <Text style={styles.cardMeta}>
        {report.date_preset || report.period} · {campaigns.length} campaigns
      </Text>
      {summary.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          {summary.map((row) => (
            <View key={String(row.period)} style={[styles.summaryCard, { minWidth: 140, marginRight: 8 }]}>
              <Text style={styles.summaryLbl}>{row.period}</Text>
              <Text style={styles.summaryVal}>{moneyShort(row.spend, currency)}</Text>
              <Text style={styles.cardMeta}>
                {row.results || 0} res · {row.clicks || 0} clk · CTR {Number(row.ctr || 0).toFixed(2)}%
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {(['active', 'paused', 'inactive', 'all'] as const).map((id) => (
          <TouchableOpacity
            key={id}
            onPress={() => setStatus(id)}
            style={{
              backgroundColor: status === id ? '#0F172A' : '#F1F5F9',
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: status === id ? '#fff' : '#334155', fontSize: 11, fontWeight: '800', textTransform: 'capitalize' }}>
              {id}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        onPress={() => setPickerOpen((v) => !v)}
        style={{ marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}
      >
        <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F172A' }} numberOfLines={1}>
          {campaignId === 'all' ? 'All campaigns' : selected?.name || 'Campaign'}
        </Text>
      </TouchableOpacity>
      {pickerOpen ? (
        <View style={{ marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, maxHeight: 280, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', gap: 8, padding: 8 }}>
            <TouchableOpacity
              onPress={() => setPickerMode('active')}
              style={{ backgroundColor: pickerMode === 'active' ? '#059669' : '#F1F5F9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}
            >
              <Text style={{ color: pickerMode === 'active' ? '#fff' : '#334155', fontSize: 11, fontWeight: '800' }}>Active {activeCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPickerMode('inactive')}
              style={{ backgroundColor: pickerMode === 'inactive' ? '#0F172A' : '#F1F5F9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}
            >
              <Text style={{ color: pickerMode === 'inactive' ? '#fff' : '#334155', fontSize: 11, fontWeight: '800' }}>
                Inactive {allCampaigns.length - activeCount}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            value={pickerQ}
            onChangeText={setPickerQ}
            placeholder="Search campaign…"
            placeholderTextColor="#94A3B8"
            style={{ borderTopWidth: 1, borderColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 8, fontSize: 12 }}
          />
          <ScrollView style={{ maxHeight: 180 }}>
            <TouchableOpacity
              onPress={() => {
                setCampaignId('all');
                setPickerOpen(false);
              }}
              style={{ paddingHorizontal: 10, paddingVertical: 8 }}
            >
              <Text style={{ fontWeight: '800', fontSize: 12, color: campaignId === 'all' ? COLORS.primary : '#0F172A' }}>All campaigns</Text>
            </TouchableOpacity>
            {pickerList.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => {
                  setCampaignId(String(c.id));
                  setPickerOpen(false);
                }}
                style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: campaignId === String(c.id) ? '#EFF6FF' : '#fff' }}
              >
                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>
                  {c.name}
                </Text>
                <Text style={{ fontSize: 10, color: '#64748B', textTransform: 'capitalize' }}>{bucketStatus(c.effective_status || c.status)}</Text>
              </TouchableOpacity>
            ))}
            {!pickerList.length ? <Text style={[styles.cardMeta, { padding: 10 }]}>No campaigns.</Text> : null}
          </ScrollView>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {(
          [
            ['campaigns', `Campaigns ${campaigns.length}`],
            ['adsets', `Ad sets ${(scoped.adsets || []).length}`],
            ['ads', `Ads ${(scoped.ads || []).length}`],
            ['placement', `Placement ${(scoped.placements || []).length}`],
            ['platform', `Platform ${(scoped.platforms || []).length}`],
            ['age', `Age ${(scoped.ages || []).length}`],
            ['gender', `Gender ${(scoped.genders || []).length}`],
            ['country', `Country ${(scoped.countries || []).length}`],
            ['device', `Device ${(scoped.devices || []).length}`],
            ['hour', `Time ${(scoped.hours || []).length}`],
            ['device_platform', `Platform+device ${(scoped.device_platforms || []).length}`],
          ] as const
        ).map(([id, label]) => (
          <TouchableOpacity
            key={id}
            onPress={() => {
              setTab(id);
              setOpenCampaigns({});
              setOpenAdsets({});
            }}
            style={{
              backgroundColor: tab === id ? COLORS.primary : '#F1F5F9',
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: tab === id ? '#fff' : '#334155', fontSize: 11, fontWeight: '800' }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView horizontal style={{ marginTop: 10 }}>
        <View>
          <View style={{ flexDirection: 'row', backgroundColor: '#0F172A', paddingVertical: 8 }}>
            {headers.map((h) => (
              <Text key={h} style={{ color: '#fff', fontSize: 10, fontWeight: '800', width: 92, paddingHorizontal: 6 }}>
                {h}
              </Text>
            ))}
          </View>
          {tab === 'campaigns' && campaigns.length
            ? campaigns.map((row, idx) => {
                const id = String(row.id);
                const open = Boolean(openCampaigns[id]);
                const m = row.metrics || row.last_7d || row;
                const adsets = (scoped.adsets || []).filter((item: any) => String(item.campaign_id) === id);
                return (
                  <View key={id}>
                    <TouchableOpacity onPress={() => toggleCampaign(id)}>
                      {renderCells(
                        [`${open ? '▾' : '▸'} ${row.name}`, bucketStatus(row.effective_status || row.status), ...metricCells(m).slice(0)],
                        `c-${id}`,
                        { bold: true, bg: idx % 2 ? '#F8FAFC' : '#fff' },
                      )}
                    </TouchableOpacity>
                    {open
                      ? adsets.map((adset: any) => {
                          const aKey = `${id}:${adset.id}`;
                          const aOpen = Boolean(openAdsets[aKey]);
                          const am = adset.metrics || adset;
                          const ads = (scoped.ads || []).filter(
                            (item: any) =>
                              String(item.campaign_id) === id &&
                              (item.adset_id ? String(item.adset_id) === String(adset.id) : String(item.adset_name || '') === String(adset.name || '')),
                          );
                          return (
                            <View key={aKey}>
                              <TouchableOpacity onPress={() => setOpenAdsets((prev) => ({ ...prev, [aKey]: !aOpen }))}>
                                {renderCells(
                                  [`${aOpen ? '▾' : '▸'} Ad set · ${adset.name}`, bucketStatus(adset.effective_status || adset.status), moneyShort(am.spend, currency), String(am.results || 0), moneyShort(am.cpr, currency), String(am.clicks || 0), `${Number(am.ctr || 0).toFixed(2)}%`],
                                  aKey,
                                  { bg: '#EEF2FF', indent: 8 },
                                )}
                              </TouchableOpacity>
                              {aOpen
                                ? ads.map((ad: any) => {
                                    const dm = ad.metrics || ad;
                                    return renderCells(
                                      [`Ad · ${ad.name}`, bucketStatus(ad.effective_status || ad.status), moneyShort(dm.spend, currency), String(dm.results || 0), moneyShort(dm.cpr, currency), String(dm.clicks || 0), `${Number(dm.ctr || 0).toFixed(2)}%`],
                                      `${aKey}-${ad.id}`,
                                      { bg: '#F0F9FF', indent: 16 },
                                    );
                                  })
                                : null}
                            </View>
                          );
                        })
                      : null}
                  </View>
                );
              })
            : nested && grouped.length
              ? grouped.map((group) => {
                  const open = Boolean(openCampaigns[group.id]);
                  const agg = rowTotals(group.rows);
                  const child = childCache[`${tab}:${group.id}`];
                  const adsetGroups: Record<string, { id: string; name: string; rows: any[] }> = {};
                  for (const row of child?.adsets || []) {
                    const id = String(row.adset_id || row.adset_name || 'adset');
                    if (!adsetGroups[id]) adsetGroups[id] = { id, name: String(row.adset_name || id), rows: [] };
                    adsetGroups[id].rows.push(row);
                  }
                  return (
                    <View key={group.id}>
                      <TouchableOpacity onPress={() => toggleCampaign(group.id)}>
                        {renderCells(
                          [`${open ? '▾' : '▸'} ${group.name}`, '', moneyShort(agg.spend, currency), String(agg.results || 0), `${Number(agg.ctr || 0).toFixed(2)}%`],
                          `g-${group.id}`,
                          { bold: true, bg: '#F1F5F9' },
                        )}
                      </TouchableOpacity>
                      {open
                        ? group.rows.map((row, idx) =>
                            renderCells(
                              tab === 'placement'
                                ? [row.publisher_platform || '—', row.publisher_platform || '—', row.platform_position || '—', moneyShort(row.spend, currency), String(row.results || 0), `${Number(row.ctr || 0).toFixed(2)}%`]
                                : tab === 'platform'
                                  ? [row.publisher_platform || '—', row.publisher_platform || '—', moneyShort(row.spend, currency), String(row.results || 0), `${Number(row.ctr || 0).toFixed(2)}%`]
                                  : tab === 'age'
                                    ? [row.age || '—', row.age || '—', moneyShort(row.spend, currency), String(row.results || 0), `${Number(row.ctr || 0).toFixed(2)}%`]
                                    : tab === 'gender'
                                      ? [row.gender || '—', row.gender || '—', moneyShort(row.spend, currency), String(row.results || 0), `${Number(row.ctr || 0).toFixed(2)}%`]
                                      : tab === 'country'
                                        ? [row.country || '—', row.country || '—', moneyShort(row.spend, currency), String(row.results || 0), `${Number(row.ctr || 0).toFixed(2)}%`]
                                        : tab === 'hour'
                                          ? [prettyHour(row.hour), prettyHour(row.hour), moneyShort(row.spend, currency), String(row.results || 0), `${Number(row.ctr || 0).toFixed(2)}%`]
                                          : [row.impression_device || row.device_platform || '—', row.impression_device || row.device_platform || '—', moneyShort(row.spend, currency), String(row.results || 0), `${Number(row.ctr || 0).toFixed(2)}%`],
                              `${group.id}-r-${idx}`,
                              { indent: 8, bg: idx % 2 ? '#F8FAFC' : '#fff' },
                            ),
                          )
                        : null}
                      {open && child?.loading ? <Text style={[styles.cardMeta, { padding: 8 }]}>Ad sets / ads load ho rahe hain…</Text> : null}
                      {open && child?.error ? <Text style={[styles.cardMeta, { padding: 8, color: '#B45309' }]}>{child.error}</Text> : null}
                      {open
                        ? Object.values(adsetGroups).map((adset) => {
                            const aKey = `${group.id}:${adset.id}`;
                            const aOpen = Boolean(openAdsets[aKey]);
                            const am = rowTotals(adset.rows);
                            const ads = (child?.ads || []).filter((row) => String(row.adset_id || '') === adset.id);
                            return (
                              <View key={aKey}>
                                <TouchableOpacity onPress={() => setOpenAdsets((prev) => ({ ...prev, [aKey]: !aOpen }))}>
                                  {renderCells(
                                    [`${aOpen ? '▾' : '▸'} Ad set · ${adset.name}`, '', moneyShort(am.spend, currency), String(am.results || 0), `${Number(am.ctr || 0).toFixed(2)}%`],
                                    aKey,
                                    { bg: '#EEF2FF', indent: 8 },
                                  )}
                                </TouchableOpacity>
                                {aOpen
                                  ? ads.map((row, idx) =>
                                      renderCells(
                                        [`Ad · ${row.ad_name || row.ad || 'Ad'}`, row.publisher_platform || row.age || row.gender || row.country || row.impression_device || prettyHour(row.hour), moneyShort(row.spend, currency), String(row.results || 0), `${Number(row.ctr || 0).toFixed(2)}%`],
                                        `${aKey}-ad-${idx}`,
                                        { bg: '#F0F9FF', indent: 16 },
                                      ),
                                    )
                                  : null}
                              </View>
                            );
                          })
                        : null}
                    </View>
                  );
                })
              : rows.length
                ? rows.slice(0, 40).map((row, idx) => {
                    const m = row.metrics || row.last_7d || row;
                    const cells =
                      tab === 'adsets' || tab === 'ads'
                        ? [row.name, bucketStatus(row.effective_status || row.status), moneyShort(m.spend, currency), String(m.results || 0), `${Number(m.ctr || 0).toFixed(2)}%`]
                        : [row.name || '—', '', moneyShort(m.spend, currency), String(m.results || 0), `${Number(m.ctr || 0).toFixed(2)}%`];
                    return renderCells(cells, `${tab}-${idx}`, { bg: idx % 2 ? '#F8FAFC' : '#fff' });
                  })
                : (
                  <Text style={[styles.cardMeta, { padding: 12 }]}>Is tab pe data nahi aaya.</Text>
                )}
          {rows.length || grouped.length
            ? renderCells(
                ['Total', '', moneyShort(totals.spend, currency), String(totals.results || 0), tab === 'campaigns' ? moneyShort(totals.cpr, currency) : `${Number(totals.ctr || 0).toFixed(2)}%`, ...(tab === 'campaigns' ? [String(totals.clicks || 0), `${Number(totals.ctr || 0).toFixed(2)}%`] : [])],
                'total',
                { bold: true, bg: '#0F172A', color: '#fff' },
              )
            : null}
        </View>
      </ScrollView>
      {rows.length || grouped.length ? (
        <Text style={[styles.cardMeta, { marginTop: 6 }]}>
          Total · {nested ? grouped.length : rows.length} · Campaign click = ad sets / ads
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <TouchableOpacity
          style={[styles.saveBtn, { flex: 1 }]}
          onPress={() => void shareMetaAdsFile(scoped, 'xlsx')}
        >
          <Text style={styles.saveBtnText}>Excel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, { flex: 1, backgroundColor: '#0F172A' }]}
          onPress={() => void shareMetaAdsFile(scoped, 'csv')}
        >
          <Text style={styles.saveBtnText}>CSV</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={{ marginTop: 8 }}
        onPress={async () => {
          await Clipboard.setStringAsync(report.markdown || '');
          Alert.alert('Copied', 'Text report clipboard pe aa gayi');
        }}
      >
        <Text style={{ color: COLORS.primary, fontWeight: '800', textAlign: 'center' }}>Copy text</Text>
      </TouchableOpacity>
    </View>
  );
}

type AdsSection = 'overview' | 'ask' | 'brain' | 'reports' | 'funds' | 'campaigns' | 'assets' | 'connect';

const ADS_SECTIONS: { id: AdsSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'ask', label: 'Ask ads' },
  { id: 'brain', label: 'Brain' },
  { id: 'reports', label: 'Reports' },
  { id: 'funds', label: 'Funds' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'assets', label: 'Pages & Pixel' },
  { id: 'connect', label: 'Connect' },
];

function MetaAdsAskCard({ ready }: { ready: boolean }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [chat, setChat] = useState<Array<{ role: 'user' | 'assistant'; content: string; report?: any }>>([]);

  const send = async (text?: string) => {
    const message = String(text || input).trim();
    if (!message || busy || !ready) return;
    setInput('');
    const next = [...chat, { role: 'user' as const, content: message }];
    setChat(next);
    setBusy(true);
    try {
      const json = await apiFetch<any>('/api/super_admin/meta-ads-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', message, history: next.slice(0, -1).slice(-8) }),
        timeoutMs: 60000,
      });
      setChat([...next, { role: 'assistant', content: json.reply || 'No reply', report: json.report || null }]);
    } catch (e: any) {
      setChat([...next, { role: 'assistant', content: e?.message || 'Chat failed' }]);
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = async () => {
    if (listening) {
      try {
        const uri = await stopVoiceNote();
        setListening(false);
        if (!uri) return;
        setBusy(true);
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const transcribed = await apiFetch<any>('/api/super_admin/meta-ads-mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'transcribe', audio_base64: b64, mime: 'audio/m4a', filename: 'ask-ads.m4a' }),
          timeoutMs: 45000,
        });
        const text = String(transcribed?.text || '').trim();
        setBusy(false);
        if (text) await send(text);
        else Alert.alert('Mic', 'Voice samajh nahi aayi — dubara bolo ya type karo.');
      } catch (e: any) {
        setListening(false);
        setBusy(false);
        Alert.alert('Mic', e?.message || 'Voice failed');
      }
      return;
    }
    if (!isVoiceRecordingAvailable()) {
      Alert.alert('Mic', 'Is build mein recording nahi hai — type karo, ya app rebuild karo.');
      return;
    }
    try {
      await startVoiceNote();
      setListening(true);
    } catch (e: any) {
      Alert.alert('Mic', e?.message || 'Microphone permission chahiye');
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: '#F8FAFC' }]}>
      <Text style={styles.cardTitle}>Ask MyFNG Ads</Text>
      <Text style={styles.cardMeta}>Likho, ya mic dabao — bolke report bhi nikal sakte ho</Text>
      {['Kaunsi copy chalaun?', '7 din ki report banao', 'Due kitna hai?'].map((q) => (
        <TouchableOpacity key={q} onPress={() => void send(q)} disabled={!ready || busy} style={styles.chip}>
          <Text style={styles.chipText}>{q}</Text>
        </TouchableOpacity>
      ))}
      {chat.map((m, i) =>
        m.role === 'user' ? (
          <View
            key={`${m.role}-${i}`}
            style={{
              marginTop: 8,
              alignSelf: 'flex-end',
              maxWidth: '85%',
              backgroundColor: COLORS.primary,
              borderRadius: 16,
              borderBottomRightRadius: 6,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13, lineHeight: 19 }}>
              {m.content.length > 160 ? `${m.content.slice(0, 140)}…` : m.content}
            </Text>
          </View>
        ) : (
          <View key={`${m.role}-${i}`} style={{ marginTop: 8, alignSelf: 'flex-start', maxWidth: 268 }}>
            <AskAnswerCard content={m.content} report={m.report} />
          </View>
        ),
      )}
      {busy ? <Text style={styles.cardMeta}>{listening ? 'Voice bhej raha hoon…' : 'Meta se nikal raha hoon…'}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <TouchableOpacity
          onPress={() => void toggleMic()}
          disabled={!ready || busy}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: listening ? '#E11D48' : '#E2E8F0',
          }}
        >
          <Ionicons name={listening ? 'mic' : 'mic-outline'} size={20} color={listening ? '#fff' : '#0F172A'} />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { flex: 1, marginTop: 0 }]}
          value={input}
          onChangeText={setInput}
          placeholder={listening ? 'Bol rahe ho — stop dabao' : 'Aaj kitna spend hua?'}
          editable={ready && !busy && !listening}
          onSubmitEditing={() => void send()}
        />
      </View>
      <TouchableOpacity
        style={styles.saveBtn}
        onPress={() => (listening ? void toggleMic() : void send())}
        disabled={!ready || (busy && !listening)}
      >
        <Text style={styles.saveBtnText}>{busy && !listening ? '…' : listening ? 'Stop & send' : 'Send'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function SuperAdminMetaAdsMcpScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [pixels, setPixels] = useState<any[]>([]);
  const [funds, setFunds] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [section, setSection] = useState<AdsSection>('overview');
  const [reportBusy, setReportBusy] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [playbook, setPlaybook] = useState({
    goal: '',
    audience: '',
    offers: '',
    copy_rules: '',
    decision_rules: '',
  });
  const [playbookSaving, setPlaybookSaving] = useState(false);
  const fetched = useRef({ overview: false, funds: false, campaigns: false, assets: false, account: '' });

  const postAction = async (body: Record<string, unknown>, timeoutMs = 20000) =>
    apiFetch<any>('/api/super_admin/meta-ads-mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs,
    });

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<any>('/api/super_admin/meta-ads-mcp');
      setPayload(data);
      setAccountId(String(data?.settings?.account_id || ''));
      if (data?.playbook) setPlaybook(data.playbook);
      fetched.current = {
        overview: false,
        funds: false,
        campaigns: false,
        assets: false,
        account: String(data?.settings?.account_id || ''),
      };
      setOverview(null);
      setCampaigns([]);
      setPages([]);
      setPixels([]);
      setFunds(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load Meta Ads');
      setPayload(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!payload?.settings?.ready) return;
    const run = async () => {
      try {
        if (section === 'overview' && !fetched.current.overview) {
          fetched.current.overview = true;
          setOverview(await postAction({ action: 'overview' }).catch(() => null));
        }
        if (section === 'funds' && !fetched.current.funds) {
          fetched.current.funds = true;
          if (!fetched.current.overview) {
            fetched.current.overview = true;
            setOverview(await postAction({ action: 'overview' }).catch(() => null));
          }
          setFunds(await postAction({ action: 'funds' }).catch(() => null));
        }
        if (section === 'campaigns' && !fetched.current.campaigns) {
          fetched.current.campaigns = true;
          const camp = await postAction({ action: 'list_campaigns', status: 'ACTIVE', limit: 20 }).catch(() => null);
          setCampaigns(Array.isArray(camp?.campaigns) ? camp.campaigns : []);
        }
        if (section === 'assets' && !fetched.current.assets) {
          fetched.current.assets = true;
          const [pg, px] = await Promise.all([
            postAction({ action: 'list_pages', limit: 20 }).catch(() => null),
            postAction({ action: 'list_pixels' }).catch(() => null),
          ]);
          setPages(Array.isArray(pg?.pages) ? pg.pages : []);
          setPixels(Array.isArray(px?.pixels) ? px.pixels : []);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load section');
      }
    };
    void run();
  }, [section, payload?.settings?.ready, payload?.settings?.account_id]);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/super_admin/meta-ads-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_settings',
          access_token: token || undefined,
          account_id: accountId,
        }),
      });
      setToken('');
      await load();
      Alert.alert('Saved', 'Meta Ads connection updated');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    try {
      const json = await apiFetch<any>('/api/super_admin/meta-ads-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_connection' }),
      });
      Alert.alert('Connected', json?.account?.name || json?.user?.name || 'Token is valid');
      await load();
    } catch (e: any) {
      Alert.alert('Test failed', e?.message || 'Could not reach Meta');
    }
  };

  const generateReport = async (period: string, datePreset?: string) => {
    setReportBusy(true);
    try {
      const json = await postAction(
        { action: 'generate_report', period, date_preset: datePreset || (period === 'briefing' ? 'last_30d' : period) },
        70000,
      );
      setGeneratedReport(json.report);
    } catch (e: any) {
      Alert.alert('Report', e?.message || 'Could not generate');
    } finally {
      setReportBusy(false);
    }
  };

  const savePlaybook = async () => {
    setPlaybookSaving(true);
    try {
      await postAction({ action: 'save_playbook', playbook }, 20000);
      Alert.alert('Saved', 'Ask ads will use this playbook.');
    } catch (e: any) {
      Alert.alert('Playbook', e?.message || 'Could not save');
    } finally {
      setPlaybookSaving(false);
    }
  };

  const currency = overview?.currency || 'INR';
  const periods = overview?.periods || {};

  return (
    <Shell title="Meta Ads MCP">
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {ADS_SECTIONS.map((item) => {
              const active = section === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setSection(item.id)}
                  style={[styles.chip, active ? styles.chipActive : null]}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
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

            {section === 'overview' ? (
              <>
                <View style={styles.summaryGrid}>
                  {[
                    ['Today', periods.today],
                    ['7 days', periods.last_7d],
                    ['30 days', periods.last_30d],
                  ].map(([label, row]: any) => (
                    <View key={String(label)} style={styles.summaryCard}>
                      <Text style={styles.summaryLbl}>{label}</Text>
                      <Text style={styles.summaryVal}>
                        {row ? `${currency} ${Math.round(row.spend || 0).toLocaleString('en-IN')}` : '—'}
                      </Text>
                      <Text style={styles.cardMeta}>
                        {row
                          ? `${row.leads || 0} leads · ${row.messaging || 0} WA · ${row.clicks || 0} clicks`
                          : 'Connect account'}
                      </Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={styles.saveBtn} onPress={() => setSection('reports')}>
                  <Text style={styles.saveBtnText}>Generate report</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {section === 'funds' && funds ? (
              <>
                <View style={styles.summaryGrid}>
                  {[
                    ['Due', funds.amount_due || funds.balance],
                    ['Spend cap', funds.spend_cap],
                  ].map(([label, value]: any) => (
                    <View key={String(label)} style={styles.summaryCard}>
                      <Text style={styles.summaryLbl}>{label}</Text>
                      <Text style={styles.summaryVal}>
                        {Number(value) > 0
                          ? `${currency} ${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                          : '—'}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLbl}>Funds</Text>
                    <Text style={styles.summaryVal}>
                      {funds.funds_from_api && Number(funds.funds) > 0
                        ? `${currency} ${Number(funds.funds).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                        : 'Ads Manager'}
                    </Text>
                  </View>
                </View>
                {funds.permission_hint ? <Text style={styles.cardMeta}>{funds.permission_hint}</Text> : null}
              </>
            ) : null}

            {section === 'ask' ? <MetaAdsAskCard ready={Boolean(payload?.settings?.ready)} /> : null}

            {section === 'brain' ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Brain</Text>
                <Text style={styles.cardMeta}>
                  Goal, audience, offers, and rules. Ask ads uses this when you ask which copy to run.
                </Text>
                {(
                  [
                    ['goal', 'Goal'],
                    ['audience', 'Audience'],
                    ['offers', 'Offers'],
                    ['copy_rules', 'Copy rules'],
                    ['decision_rules', 'Keep / Test / Pause'],
                  ] as const
                ).map(([key, label]) => (
                  <View key={key} style={{ marginTop: 10 }}>
                    <Text style={styles.cardMeta}>{label}</Text>
                    <TextInput
                      style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
                      multiline
                      value={playbook[key]}
                      onChangeText={(v) => setPlaybook((p) => ({ ...p, [key]: v }))}
                    />
                  </View>
                ))}
                <TouchableOpacity style={styles.saveBtn} onPress={() => void savePlaybook()} disabled={playbookSaving}>
                  <Text style={styles.saveBtnText}>{playbookSaving ? 'Saving…' : 'Save playbook'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {section === 'reports' ? (
              <>
                {(
                  [
                    ['today', 'Today'],
                    ['yesterday', 'Yesterday'],
                    ['last_7d', 'Last 7 days'],
                    ['last_14d', 'Last 14 days'],
                    ['last_28d', 'Last 28 days'],
                    ['last_30d', 'Last 30 days'],
                    ['this_month', 'This month'],
                    ['last_month', 'Last month'],
                    ['briefing', 'Full briefing'],
                  ] as const
                ).map(([id, label]) => (
                  <TouchableOpacity
                    key={id}
                    style={styles.card}
                    onPress={() => void generateReport(id)}
                    disabled={reportBusy || !payload?.settings?.ready}
                  >
                    <Text style={styles.cardTitle}>{label}</Text>
                    <Text style={styles.cardMeta}>{reportBusy ? 'Generating…' : 'Tap to generate live report'}</Text>
                  </TouchableOpacity>
                ))}
                {generatedReport ? <MetaAdsReportTables report={generatedReport} /> : null}
              </>
            ) : null}

            {section === 'connect' ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Connect ad account</Text>
                <Text style={styles.cardMeta}>
                  {payload?.settings?.has_token
                    ? `Token ${payload.settings.token_hint} · ${payload.settings.account_id || 'no account id'}`
                    : 'System User token + act_ account ID'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={token}
                  onChangeText={setToken}
                  placeholder={payload?.settings?.has_token ? 'Paste to replace token' : 'Access token'}
                  autoCapitalize="none"
                  secureTextEntry
                />
                <TextInput
                  style={styles.input}
                  value={accountId}
                  onChangeText={setAccountId}
                  placeholder="act_1234567890"
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.saveBtn} onPress={() => void save()} disabled={saving}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: '#0F172A', marginTop: 8 }]}
                  onPress={() => void test()}
                >
                  <Text style={styles.saveBtnText}>Test connection</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {section === 'campaigns'
              ? campaigns.map((row) => (
                  <View key={row.id} style={styles.card}>
                    <View style={styles.row}>
                      <Text style={styles.cardTitle}>{row.name}</Text>
                      <Text style={styles.badge}>{row.effective_status || row.status}</Text>
                    </View>
                    <Text style={styles.cardMeta}>
                      7d {currency} {Math.round(row.last_7d?.spend || 0).toLocaleString('en-IN')} ·{' '}
                      {row.last_7d?.results || row.last_7d?.leads || 0} results · {row.last_7d?.clicks || 0} clicks
                    </Text>
                  </View>
                ))
              : null}

            {section === 'assets' ? (
              <>
                {(pages || []).map((row: any) => (
                  <View key={row.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{row.name}</Text>
                    <Text style={styles.cardMeta}>
                      Page · {row.fan_count || row.followers_count || 0} fans
                      {row.instagram_business_account?.username ? ` · IG @${row.instagram_business_account.username}` : ''}
                    </Text>
                  </View>
                ))}
                {(pixels || []).map((row: any) => (
                  <View key={row.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{row.name}</Text>
                    <Text style={styles.cardMeta}>
                      Pixel {row.id}
                      {row.last_fired_time ? ` · last fired ${String(row.last_fired_time).slice(0, 16)}` : ''}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>
        </>
      )}
    </Shell>
  );
}

export function SuperAdminDataRightsScreen() {
  const ComplianceReportsScreen = require('./ComplianceReportsScreen').default;
  return <ComplianceReportsScreen />;
}

export function SuperAdminSystemMonitorScreen() {
  const route = useRoute<any>();
  const initialTab = route?.params?.tab;
  const [tab, setTab] = useState<'health' | 'audit' | 'security' | 'fraud'>(
    initialTab === 'audit' || initialTab === 'security' || initialTab === 'fraud' ? initialTab : 'health',
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const AuditLogsScreen = require('./AuditLogsScreen').default;
  const SecurityEventsScreen = require('./SecurityEventsScreen').default;
  const FraudDetectionScreen = require('./FraudDetectionScreen').default;

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<any>('/api/super_admin/system-monitor');
      setPayload(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load monitor');
      setPayload(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checks: any[] = Array.isArray(payload?.checks) ? payload.checks : [];

  return (
    <Shell title="System Monitor">
      <View style={styles.chipRow}>
        {([
          ['health', 'Health'],
          ['audit', 'Audit Logs'],
          ['security', 'Security'],
          ['fraud', 'Fraud'],
        ] as const).map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[styles.chip, tab === id && styles.chipActive]}
            onPress={() => setTab(id)}
          >
            <Text style={[styles.chipText, tab === id && styles.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'audit' ? <AuditLogsScreen embedded /> : null}
      {tab === 'security' ? <SecurityEventsScreen embedded /> : null}
      {tab === 'fraud' ? <FraudDetectionScreen embedded /> : null}
      {tab !== 'health' ? null : loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
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
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLbl}>Health</Text>
              <Text style={styles.summaryVal}>{payload?.healthScore ?? '—'}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLbl}>Status</Text>
              <Text style={styles.summaryVal}>{payload?.overallStatus || '—'}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLbl}>Healthy</Text>
              <Text style={styles.summaryVal}>{payload?.summary?.healthy ?? 0}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLbl}>Down</Text>
              <Text style={styles.summaryVal}>{payload?.summary?.down ?? 0}</Text>
            </View>
          </View>
          {checks.map((check) => {
            const status = String(check.status || 'unknown');
            const tint =
              status === 'healthy' ? '#D1FAE5' : status === 'degraded' ? '#FEF3C7' : '#FEE2E2';
            const color =
              status === 'healthy' ? '#065F46' : status === 'degraded' ? '#92400E' : '#991B1B';
            return (
              <View key={check.name} style={[styles.card, { borderColor: tint }]}>
                <View style={styles.row}>
                  <Text style={styles.cardTitle}>{check.name}</Text>
                  <Text style={[styles.badge, { backgroundColor: tint, color }]}>{status}</Text>
                </View>
                <Text style={styles.cardMeta}>{check.category}</Text>
                {check.message ? <Text style={styles.cardMeta}>{check.message}</Text> : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </Shell>
  );
}

export function SuperAdminTrackingScriptsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gtm, setGtm] = useState('');
  const [ga4, setGa4] = useState('');
  const [pixel, setPixel] = useState('');
  const [openaiAds, setOpenaiAds] = useState('U2kxzksZVZarMY9GCy9jJV');
  const [clarity, setClarity] = useState('');
  const [gtmOn, setGtmOn] = useState(true);
  const [ga4On, setGa4On] = useState(true);
  const [pixelOn, setPixelOn] = useState(true);
  const [openaiOn, setOpenaiOn] = useState(true);
  const [custom, setCustom] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<any>('/api/super_admin/tracking-scripts');
      setGtm(String(data?.analytics?.gtm_container_id || ''));
      setGa4(String(data?.analytics?.web_measurement_id || ''));
      setPixel(String(data?.analytics?.meta_pixel_id || ''));
      setOpenaiAds(String(data?.analytics?.openai_ads_pixel_id || 'U2kxzksZVZarMY9GCy9jJV'));
      setClarity(String(data?.analytics?.clarity_project_id || ''));
      setGtmOn(data?.analytics?.gtm_enabled !== false);
      setGa4On(data?.analytics?.gtag_enabled !== false);
      setPixelOn(data?.analytics?.meta_pixel_enabled !== false);
      setOpenaiOn(data?.analytics?.openai_ads_enabled !== false);
      setCustom(Array.isArray(data?.custom) ? data.custom : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load tracking scripts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/super_admin/tracking-scripts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analytics: {
            gtm_container_id: gtm,
            web_measurement_id: ga4,
            meta_pixel_id: pixel,
            openai_ads_pixel_id: openaiAds,
            clarity_project_id: clarity,
            gtm_enabled: gtmOn,
            gtag_enabled: ga4On,
            meta_pixel_enabled: pixelOn,
            openai_ads_enabled: openaiOn,
          },
          custom,
        }),
      });
      await load();
      Alert.alert('Saved', 'Tracking scripts updated');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell title="Tracking Scripts">
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
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
          <Text style={styles.sectionTitle}>Already live (IDs)</Text>
          <Text style={styles.hint}>GTM / GA4 / Pixel / Clarity. Head-Body full paste website admin pe karo.</Text>
          <TextInput style={styles.input} value={gtm} onChangeText={setGtm} placeholder="GTM-XXXX" autoCapitalize="characters" />
          <TextInput style={styles.input} value={ga4} onChangeText={setGa4} placeholder="G-XXXX" autoCapitalize="characters" />
          <TextInput style={styles.input} value={pixel} onChangeText={setPixel} placeholder="Meta Pixel ID" />
          <TextInput style={styles.input} value={openaiAds} onChangeText={setOpenaiAds} placeholder="OpenAI Ads Pixel ID" />
          <TextInput style={styles.input} value={clarity} onChangeText={setClarity} placeholder="Clarity project ID" />
          <View style={[styles.row, { marginTop: 12 }]}>
            <TouchableOpacity onPress={() => setGtmOn((v) => !v)}>
              <Text style={styles.cardMeta}>GTM {gtmOn ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setGa4On((v) => !v)}>
              <Text style={styles.cardMeta}>GA4 {ga4On ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPixelOn((v) => !v)}>
              <Text style={styles.cardMeta}>Pixel {pixelOn ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOpenaiOn((v) => !v)}>
              <Text style={styles.cardMeta}>OpenAI {openaiOn ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Custom snippets</Text>
          {custom.length === 0 ? (
            <Text style={styles.empty}>Koi extra snippet nahi. Website Tracking Scripts pe Head/Body paste karo.</Text>
          ) : (
            custom.map((row) => (
              <View key={row.id} style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.cardTitle}>{row.name || 'Script'}</Text>
                  <Text style={[styles.badge, { backgroundColor: row.enabled ? '#D1FAE5' : '#FEE2E2', color: row.enabled ? '#065F46' : '#991B1B' }]}>
                    {row.enabled ? 'ON' : 'OFF'}
                  </Text>
                </View>
                <Text style={styles.cardMeta}>
                  {row.placement === 'body' ? 'Body' : 'Head'} · {row.scope === 'pages' ? (row.paths || []).join(', ') || 'pages' : 'All pages'}
                </Text>
              </View>
            ))
          )}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: '#D97706' }]}
            onPress={async () => {
              setTesting(true);
              try {
                const json = await apiFetch<any>('/api/super_admin/tracking-scripts/test', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    analytics: {
                      gtm_container_id: gtm,
                      web_measurement_id: ga4,
                      meta_pixel_id: pixel,
                      openai_ads_pixel_id: openaiAds,
                      gtm_enabled: gtmOn,
                      gtag_enabled: ga4On,
                      meta_pixel_enabled: pixelOn,
                      openai_ads_enabled: openaiOn,
                    },
                    custom,
                  }),
                });
                const lines = (json.checks || []).map((c: any) => `${c.ok ? 'PASS' : 'FAIL'} ${c.name}: ${c.message}`);
                Alert.alert(json.ok ? 'Test pass' : 'Test fail', lines.join('\n') || 'No checks');
              } catch (e: any) {
                Alert.alert('Test failed', e?.message || 'Could not test');
              } finally {
                setTesting(false);
              }
            }}
            disabled={testing}
          >
            <Text style={styles.saveBtnText}>{testing ? 'Testing…' : 'Test IDs'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={() => void save()} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save IDs'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </Shell>
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
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
  },
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
});
