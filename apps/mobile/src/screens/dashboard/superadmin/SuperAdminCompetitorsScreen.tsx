import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

type TabId = 'overview' | 'pages' | 'keywords' | 'changes' | 'aio';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'pages', label: 'Pages' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'changes', label: 'Changes' },
  { id: 'aio', label: 'AIO' },
];

function fmtWhen(value?: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function SuperAdminCompetitorsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const eyebrow = 'ADVANCED SEO';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [checkUrl, setCheckUrl] = useState('');
  const [focusedUrl, setFocusedUrl] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [tab, setTab] = useState<TabId>('overview');
  const [missing, setMissing] = useState('');

  const load = useCallback(async (id?: string, url?: string | null) => {
    try {
      const data = await apiFetch<any>('/api/super_admin/competitors');
      if (data?.missing) {
        setMissing(data.error || 'Run database/371_competitor_intel.sql');
        setList([]);
        setDetail(null);
        return;
      }
      setMissing('');
      const rows = Array.isArray(data.competitors) ? data.competitors : [];
      setList(rows);
      const nextId = id || selectedId || rows[0]?.id || '';
      setSelectedId(nextId);
      if (nextId) {
        const focus = url === undefined ? focusedUrl : url;
        const qs = focus ? `?url=${encodeURIComponent(focus)}` : '';
        const one = await apiFetch<any>(`/api/super_admin/competitors/${nextId}${qs}`);
        setDetail(one);
      } else {
        setDetail(null);
      }
    } catch (e: any) {
      setMissing(e?.message || 'Could not load competitors');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [focusedUrl, selectedId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanBusy = scanning || detail?.last_run?.status === 'running' || detail?.last_run?.status === 'cancelling';

  useEffect(() => {
    if (!selectedId || !scanBusy) return;
    const timer = setInterval(() => {
      void load(selectedId);
    }, 4000);
    return () => clearInterval(timer);
  }, [selectedId, scanBusy, load]);

  const scanNow = async (url?: string) => {
    if (!selectedId) return;
    const target = String(url || '').trim();
    setScanning(true);
    if (target) {
      setFocusedUrl(target);
      setTab('overview');
    } else {
      setFocusedUrl('');
    }
    try {
      const data = await apiFetch<any>(`/api/super_admin/competitors/${selectedId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(target ? { url: target } : {}),
      });
      const nextFocus = data?.page?.url || data?.checked_url || target || '';
      if (nextFocus) {
        setFocusedUrl(nextFocus);
        setCheckUrl(nextFocus);
      } else {
        setFocusedUrl('');
      }
      await load(selectedId, nextFocus || null);
      if (data?.stopped) Alert.alert('Scan stopped', `${data.pages_scanned || 0} page(s) saved before stop.`);
      else Alert.alert('Scan finished', nextFocus ? `Showing only ${nextFocus}` : 'Latest public pages, keywords and AIO gaps are updated.');
    } catch (e: any) {
      Alert.alert('Scan failed', e?.message || 'Could not crawl public pages');
    } finally {
      setScanning(false);
      setStopping(false);
    }
  };

  const clearFocus = async () => {
    setFocusedUrl('');
    setCheckUrl('');
    await load(selectedId, null);
  };

  const stopScan = async () => {
    if (!selectedId) return;
    setStopping(true);
    try {
      await apiFetch(`/api/super_admin/competitors/${selectedId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      await load(selectedId);
    } catch (e: any) {
      Alert.alert('Stop failed', e?.message || 'Could not stop scan');
      setStopping(false);
    }
  };

  const updateGap = async (gapId: string, status: string) => {
    if (!selectedId) return;
    try {
      await apiFetch(`/api/super_admin/competitors/${selectedId}/aio-gaps`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: gapId, status }),
      });
      await load(selectedId);
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Could not update gap');
    }
  };

  const page = (detail?.pages || [])[0];

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Competitors</Text>
        {scanBusy ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => void stopScan()} disabled={stopping || !selectedId}>
            <Ionicons name="stop-circle-outline" size={22} color="#DC2626" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.backBtn} onPress={() => void scanNow()} disabled={!selectedId}>
            <Ionicons name="scan-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(selectedId); }} />}
        >
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>Public SEO + AIO monitor</Text>
          <Text style={styles.meta}>Under Advanced SEO. Public MyFNG copy never names the brand.</Text>

          {missing ? <Text style={styles.warn}>{missing}</Text> : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compRow}>
            {list.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => { setSelectedId(item.id); setFocusedUrl(''); setCheckUrl(''); void load(item.id, null); }}
                style={[styles.compChip, selectedId === item.id && styles.compChipOn]}
              >
                <Text style={[styles.compName, selectedId === item.id && styles.compNameOn]}>{item.name}</Text>
                <Text style={styles.compMeta}>{item.changes_24h || 0} changes · {item.open_aio_gaps || 0} gaps</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {detail ? (
            <>
              <TextInput
                value={checkUrl}
                onChangeText={setCheckUrl}
                placeholder={`https://${detail.competitor?.domain || 'caryaar.com'}/services`}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!scanBusy}
                style={styles.urlInput}
              />
              <View style={styles.actions}>
                {scanBusy ? (
                  <TouchableOpacity style={styles.stopBtn} onPress={() => void stopScan()} disabled={stopping}>
                    <Text style={styles.stopBtnText}>{stopping ? 'Stopping…' : 'Stop'}</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => void scanNow()}>
                      <Text style={styles.primaryBtnText}>Scan all</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      disabled={!checkUrl.trim()}
                      onPress={() => void scanNow(checkUrl.trim())}
                    >
                      <Text style={styles.secondaryBtnText}>Check this URL</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          ) : null}

          <View style={styles.tabRow}>
            {TABS.map((item) => (
              <TouchableOpacity key={item.id} onPress={() => setTab(item.id)} style={[styles.tab, tab === item.id && styles.tabOn]}>
                <Text style={[styles.tabText, tab === item.id && styles.tabTextOn]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {focusedUrl ? (
            <View style={styles.focusBar}>
              <Text style={styles.focusText}>
                {scanning && !page ? 'Fetching this page live…' : `Only ${detail?.focus?.url || page?.url || focusedUrl}`}
              </Text>
              <TouchableOpacity onPress={() => void clearFocus()}>
                <Text style={styles.focusClear}>Show all</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!detail ? (
            <Text style={styles.meta}>No competitor loaded.</Text>
          ) : tab === 'overview' && focusedUrl ? (
            <View style={styles.card}>
              {page ? (
                <>
                  <Text style={styles.cardTitle}>{page.title || page.path}</Text>
                  <Text style={styles.meta}>{page.url}</Text>
                  <Text style={styles.stat}>H1: {page.h1 || '—'}</Text>
                  <Text style={styles.stat}>Meta: {page.meta_description || '—'}</Text>
                  <Text style={styles.stat}>{page.word_count || 0} words · {page.http_status || 'ok'}</Text>
                  <Text style={styles.meta}>Seen {fmtWhen(page.last_seen_at)} · Changed {fmtWhen(page.last_changed_at)}</Text>
                  <View style={styles.wrapRow}>
                    {(detail.keywords || []).map((row: any) => (
                      <View key={row.id} style={styles.keyword}>
                        <Text style={styles.keywordText}>{row.keyword}</Text>
                      </View>
                    ))}
                  </View>
                  {(page.aio_claims || []).map((claim: any, index: number) => (
                    <Text key={`${claim.dimension}-${index}`} style={styles.stat}>{claim.dimension}: {claim.text}</Text>
                  ))}
                  {(detail.changes || []).map((row: any) => (
                    <View key={row.id} style={styles.changeRow}>
                      <Text style={styles.chip}>{row.change_type}</Text>
                      <Text style={styles.stat}>{row.after_value || '—'}</Text>
                      <Text style={styles.meta}>{fmtWhen(row.detected_at)}</Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={styles.meta}>{scanning ? 'Fetching live title, H1, meta, keywords and AIO claims…' : 'Could not fetch this URL. Check this URL again.'}</Text>
              )}
            </View>
          ) : tab === 'overview' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{detail.competitor?.name}</Text>
              <Text style={styles.meta}>{detail.competitor?.domain}</Text>
              <Text style={styles.stat}>Pages {detail.stats?.pages || 0} · Keywords {detail.stats?.keywords || 0}</Text>
              <Text style={styles.stat}>Today {detail.stats?.changes_today || 0} · Open AIO {detail.stats?.open_aio_gaps || 0}</Text>
              <Text style={styles.meta}>Last crawl {fmtWhen(detail.last_run?.finished_at || detail.last_run?.started_at)}</Text>
            </View>
          ) : tab === 'pages' ? (
            (detail.pages || []).map((row: any) => (
              <View key={row.id} style={styles.card}>
                <Text style={styles.cardTitle}>{row.title || row.path}</Text>
                <Text style={styles.meta}>{row.path}</Text>
                <Text style={styles.stat}>{row.h1 || row.meta_description || '—'}</Text>
              </View>
            ))
          ) : tab === 'keywords' ? (
            <View style={styles.wrapRow}>
              {(detail.keywords || []).length ? (detail.keywords || []).map((row: any) => (
                <View key={row.id} style={styles.keyword}>
                  <Text style={styles.keywordText}>{row.keyword} · {row.hit_count}×</Text>
                </View>
              )) : <Text style={styles.meta}>No keywords yet. Scan the site first.</Text>}
            </View>
          ) : tab === 'changes' ? (
            (detail.changes || []).length ? (detail.changes || []).map((row: any) => (
              <View key={row.id} style={styles.card}>
                <Text style={styles.chip}>{row.change_type}</Text>
                <Text style={styles.cardTitle}>{row.url}</Text>
                <Text style={styles.stat}>{row.after_value || '—'}</Text>
                <Text style={styles.meta}>{fmtWhen(row.detected_at)}</Text>
              </View>
            )) : <Text style={styles.meta}>No changes in 7 days. First scan is the baseline.</Text>
          ) : (
            (detail.aio_gaps || []).map((gap: any) => (
              <View key={gap.id} style={styles.card}>
                <Text style={styles.chip}>{gap.dimension} · {gap.status}</Text>
                <Text style={styles.stat}>They say: {gap.competitor_claim}</Text>
                <Text style={styles.stat}>MyFNG: {gap.myfng_counter}</Text>
                <View style={styles.actions}>
                  {['open', 'covered', 'ignored'].map((status) => (
                    <TouchableOpacity key={status} style={styles.secondaryBtn} onPress={() => void updateGap(gap.id, status)}>
                      <Text style={styles.secondaryBtnText}>{status}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '800', color: COLORS.heading },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: SPACING.md, paddingBottom: 40 },
  eyebrow: { fontSize: 10, fontWeight: '800', color: '#C2410C', letterSpacing: 0.5 },
  title: { marginTop: 4, fontSize: 20, fontWeight: '800', color: COLORS.heading },
  meta: { marginTop: 6, fontSize: 13, color: COLORS.textSecondary },
  warn: { marginTop: 10, color: '#B45309', fontSize: 13, fontWeight: '600' },
  compRow: { gap: 8, paddingVertical: 12 },
  compChip: { minWidth: 160, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', borderRadius: 12, padding: 10 },
  compChipOn: { borderColor: '#EA580C', backgroundColor: '#FFF7ED' },
  compName: { fontWeight: '800', color: COLORS.heading },
  compNameOn: { color: '#C2410C' },
  compMeta: { marginTop: 4, fontSize: 11, color: COLORS.textSecondary },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tab: { borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 6 },
  tabOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: COLORS.heading },
  tabTextOn: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.heading },
  stat: { marginTop: 6, fontSize: 13, color: COLORS.textSecondary },
  chip: { alignSelf: 'flex-start', backgroundColor: '#FFF7ED', color: '#C2410C', overflow: 'hidden', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  keyword: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  keywordText: { fontSize: 12, fontWeight: '700', color: COLORS.heading },
  primaryBtn: { marginTop: 0, backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  secondaryBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff' },
  secondaryBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.heading },
  focusBar: {
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  focusText: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.heading },
  focusClear: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  changeRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  urlInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.heading,
    backgroundColor: '#fff',
  },
  stopBtn: { backgroundColor: '#DC2626', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  stopBtnText: { color: '#fff', fontWeight: '800' },
});
