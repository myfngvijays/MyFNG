import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadRecordingFolder,
  pickRecordingFolder,
  loadRecordingSyncHistory,
  queueManualRecordingSync,
  subscribeRecordingSyncHistory,
  isRecordingSyncRunning,
  type RecordingFolder,
  type RecordingSyncHistoryRow,
} from '../../lib/callRecordingSync';

const LAST_SYNC_KEY = 'myfng.telecaller.lastRecordingSync';
const PURPLE = '#5B2EE6';

const PRESETS = [
  { id: '15m', label: '15 minutes', ms: 15 * 60 * 1000 },
  { id: '1h', label: '1 Hour', ms: 60 * 60 * 1000 },
  { id: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'custom', label: 'Custom', ms: 0 },
] as const;

const UNITS = [
  { id: 'minutes', label: 'Minutes', ms: 60 * 1000 },
  { id: 'hours', label: 'Hours', ms: 60 * 60 * 1000 },
  { id: 'days', label: 'Days', ms: 24 * 60 * 60 * 1000 },
  { id: 'weeks', label: 'Weeks', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'months', label: 'Months', ms: 30 * 24 * 60 * 60 * 1000 },
] as const;

function agoLabel(ts: number) {
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export default function CallRecordingCard() {
  const [folder, setFolder] = useState<RecordingFolder | null>(null);
  const [sheet, setSheet] = useState(false);
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('15m');
  const [unit, setUnit] = useState<(typeof UNITS)[number]['id']>('minutes');
  const [customAmount, setCustomAmount] = useState('15');
  const [busy, setBusy] = useState<'pick' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(0);
  const [history, setHistory] = useState<RecordingSyncHistoryRow[]>([]);
  const [toast, setToast] = useState('');
  const [, setTick] = useState(0);

  useEffect(() => {
    void loadRecordingFolder().then(setFolder).catch(() => setFolder(null));
    void AsyncStorage.getItem(LAST_SYNC_KEY).then((raw) => {
      const n = Number(raw || 0);
      if (n) setLastSync(n);
    });
    void loadRecordingSyncHistory().then(setHistory);
    const unsub = subscribeRecordingSyncHistory(setHistory);
    const syncPoll = setInterval(() => setSyncing(isRecordingSyncRunning()), 1200);
    return () => {
      unsub();
      clearInterval(syncPoll);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const windowMs = () => {
    if (preset !== 'custom') return PRESETS.find((row) => row.id === preset)?.ms || PRESETS[0].ms;
    const count = Math.max(1, Number(customAmount) || 1);
    const unitMs = UNITS.find((row) => row.id === unit)?.ms || UNITS[0].ms;
    return count * unitMs;
  };

  const windowLabel = () => {
    if (preset !== 'custom') return PRESETS.find((row) => row.id === preset)?.label || '15 minutes';
    const count = Math.max(1, Number(customAmount) || 1);
    const unitLabel = UNITS.find((row) => row.id === unit)?.label || 'Minutes';
    return `${count} ${unitLabel}`;
  };

  const selectFolder = async () => {
    setBusy('pick');
    try {
      const next = await pickRecordingFolder();
      if (next) setFolder(next);
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : 'Could not open the folder picker');
    } finally {
      setBusy(null);
    }
  };

  const runSync = () => {
    setSheet(false);
    const label = windowLabel();
    queueManualRecordingSync({ sinceMs: windowMs(), windowLabel: label });
    setSyncing(true);
    setToast(`Sync started (${label}) — app chalega, background mein upload hoga.`);
    const now = Date.now();
    setLastSync(now);
    void AsyncStorage.setItem(LAST_SYNC_KEY, String(now));
  };

  const formatHistoryTime = (ts: number) =>
    new Date(ts).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

  const statusLabel = (row: RecordingSyncHistoryRow) => {
    if (row.status === 'failed') return 'Failed';
    if (row.status === 'partial') return 'Partial';
    return 'Success';
  };

  const folderName = folder?.label && !folder.label.startsWith('content://') ? folder.label : '';

  return (
    <View>
      <Text style={styles.pageTitle}>Call Recording</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recording's Folder</Text>
        <View style={styles.folderBlock}>
          <Ionicons name="folder-outline" size={54} color="#C5CAD3" />
          <Text style={styles.folderState}>{folderName || 'No folder selected'}</Text>
          <TouchableOpacity style={styles.selectBtn} onPress={selectFolder} disabled={busy != null}>
            {busy === 'pick' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.selectBtnText}>{folderName ? 'Change folder' : 'Select folder'}</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.suggestRow}>
          <Text style={styles.suggest}>Suggested folder: Internal storage / Recordings / Call</Text>
        </View>
      </View>

      <View style={styles.syncBar}>
        <Text style={styles.syncTitle}>Manually sync calls for last</Text>
        <View style={styles.syncRow}>
          <TouchableOpacity style={styles.timeBtn} onPress={() => setSheet(true)}>
            <Text style={styles.timeBtnText} numberOfLines={1}>
              {windowLabel()}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.syncBtn} onPress={runSync} disabled={busy != null}>
            {syncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.syncBtnText}>SYNC</Text>}
          </TouchableOpacity>
        </View>
        <Text style={styles.lastSync}>
          {syncing ? 'Sync running in background…' : `Last synced: ${lastSync ? agoLabel(lastSync) : '—'}`}
        </Text>
      </View>

      {history.length ? (
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Sync history</Text>
          {history.slice(0, 8).map((row) => (
            <View key={row.id} style={styles.historyRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.historyWhen}>{formatHistoryTime(row.at)}</Text>
                <Text style={styles.historyMeta} numberOfLines={1}>
                  {row.manual ? row.windowLabel || 'Manual' : 'Auto'} · {statusLabel(row)} · +{row.uploaded} uploaded
                  {row.noMatch ? ` · ${row.noMatch} no match` : ''}
                  {row.skipped ? ` · ${row.skipped} skipped` : ''}
                </Text>
                {row.error ? (
                  <Text style={styles.historyErr} numberOfLines={2}>
                    {row.error}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <Pressable style={styles.scrim} onPress={() => setSheet(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {preset === 'custom' ? (
              UNITS.map((row) => {
                const on = unit === row.id;
                return (
                  <TouchableOpacity
                    key={row.id}
                    style={[styles.option, on && styles.optionOn]}
                    onPress={() => setUnit(row.id)}
                  >
                    <Text style={styles.optionText}>{row.label}</Text>
                    <View style={[styles.radio, on && styles.radioOn]}>
                      {on ? <View style={styles.radioDot} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              PRESETS.map((row) => {
                const on = preset === row.id;
                return (
                  <TouchableOpacity
                    key={row.id}
                    style={[styles.option, on && styles.optionOn]}
                    onPress={() => setPreset(row.id)}
                  >
                    <Text style={styles.optionText}>{row.label}</Text>
                    <View style={[styles.radio, on && styles.radioOn]}>
                      {on ? <View style={styles.radioDot} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            <View style={styles.sheetBar}>
              <Text style={styles.syncTitle}>Manually sync calls for last</Text>
              <View style={styles.syncRow}>
                {preset === 'custom' ? (
                  <TextInput
                    style={styles.amount}
                    value={customAmount}
                    onChangeText={(v) => setCustomAmount(v.replace(/[^\d]/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                  />
                ) : null}
                <TouchableOpacity
                  style={styles.timeBtn}
                  onPress={() => {
                    if (preset === 'custom') setPreset('15m');
                  }}
                >
                  <Text style={styles.timeBtnText} numberOfLines={1}>
                    {preset === 'custom' ? UNITS.find((row) => row.id === unit)?.label : windowLabel()}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.syncBtn} onPress={runSync} disabled={busy != null}>
                  <Text style={styles.syncBtnText}>SYNC</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSheet(false)}>
                  <Ionicons name="close" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={styles.lastSync}>Last synced: {lastSync ? agoLabel(lastSync) : '—'}</Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {toast ? (
        <View style={styles.toast}>
          {toast.startsWith('Added') ? <Ionicons name="checkmark-circle" size={18} color="#16A34A" /> : null}
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    paddingHorizontal: 16,
  },
  folderBlock: { alignItems: 'center', paddingTop: 18, paddingBottom: 16 },
  folderState: { marginTop: 8, fontSize: 14, color: '#64748B', fontWeight: '600' },
  selectBtn: {
    marginTop: 14,
    backgroundColor: PURPLE,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minWidth: 140,
    alignItems: 'center',
  },
  selectBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  suggestRow: {
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  suggest: { color: '#7C3AED', fontSize: 13, fontWeight: '600' },
  syncBar: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    marginBottom: 16,
  },
  syncTitle: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#0F172A' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  timeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  timeBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A' },
  syncBtn: {
    backgroundColor: PURPLE,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
    minWidth: 84,
    alignItems: 'center',
  },
  syncBtnText: { color: '#fff', fontWeight: '800', letterSpacing: 0.4 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  lastSync: { marginTop: 8, textAlign: 'center', color: '#94A3B8', fontSize: 12 },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  historyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  historyRow: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEF2F6',
  },
  historyWhen: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  historyMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  historyErr: { fontSize: 11, color: '#DC2626', marginTop: 2 },
  scrim: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingBottom: 18,
  },
  option: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionOn: { backgroundColor: '#E5E7EB' },
  optionText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: '#22C55E' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E' },
  sheetBar: {
    marginTop: 12,
    marginHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
  },
  amount: {
    width: 64,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 10,
    textAlign: 'center',
    fontWeight: '800',
    color: '#0F172A',
  },
  toastText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    top: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
});
