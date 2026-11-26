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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  loadRecordingFolder,
  pickRecordingFolder,
  checkRecordingFolder,
  NOT_PHONE_FOLDER_MESSAGE,
  RECORDING_FOLDER_PICK_HINT,
  loadRecordingSyncHistory,
  queueManualRecordingSync,
  subscribeRecordingSyncHistory,
  subscribeRecordingSyncProgress,
  type RecordingFolder,
  type RecordingSyncHistoryRow,
  type RecordingSyncProgress,
} from '../../lib/callRecordingSync';

const PURPLE = '#5B2EE6';
const IS_ANDROID = Platform.OS === 'android';

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

const STATUS_STYLE: Record<RecordingSyncHistoryRow['status'], { label: string; fg: string; bg: string }> = {
  success: { label: 'Success', fg: '#047857', bg: '#D1FAE5' },
  partial: { label: 'Partial', fg: '#B45309', bg: '#FEF3C7' },
  failed: { label: 'Failed', fg: '#B91C1C', bg: '#FEE2E2' },
};

function formatHistoryTime(ts: number) {
  return new Date(ts).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function Count({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.countBox}>
      <Text style={[styles.countValue, { color }]}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

function phaseText(p: RecordingSyncProgress) {
  if (p.phase === 'listing') return 'Folder padh rahe hain…';
  if (p.phase === 'checking') return `Files check ho rahi hain… ${p.checked}/${p.scanned}`;
  if (p.phase === 'uploading') {
    return p.found ? `Upload ho raha hai… ${p.processed}/${p.found}` : 'Is time range mein koi recording nahi';
  }
  return 'Sync complete';
}

export default function CallRecordingCard() {
  const [folder, setFolder] = useState<RecordingFolder | null>(null);
  const [folderCheck, setFolderCheck] = useState<{ ok: boolean; audio: number; error?: string } | null>(null);
  const [sheet, setSheet] = useState(false);
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('15m');
  const [unit, setUnit] = useState<(typeof UNITS)[number]['id']>('minutes');
  const [customAmount, setCustomAmount] = useState('15');
  const [picking, setPicking] = useState(false);
  const [progress, setProgress] = useState<RecordingSyncProgress | null>(null);
  const [history, setHistory] = useState<RecordingSyncHistoryRow[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [toast, setToast] = useState('');
  const [, setTick] = useState(0);

  const verifyFolder = (row: RecordingFolder | null) => {
    if (!row?.uri || !IS_ANDROID) {
      setFolderCheck(null);
      return;
    }
    void checkRecordingFolder(row.uri).then(setFolderCheck);
  };

  useEffect(() => {
    let alive = true;
    void loadRecordingFolder()
      .then((row) => {
        if (!alive) return;
        setFolder(row);
        verifyFolder(row);
      })
      .catch(() => alive && setFolder(null));
    void loadRecordingSyncHistory().then((rows) => {
      if (!alive) return;
      setHistory(rows);
      setHistoryLoaded(true);
    });
    const unsubHistory = subscribeRecordingSyncHistory(setHistory);
    const unsubProgress = subscribeRecordingSyncProgress(setProgress);
    return () => {
      alive = false;
      unsubHistory();
      unsubProgress();
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3200);
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
    setPicking(true);
    try {
      const next = await pickRecordingFolder();
      if (next) {
        setFolder(next);
        verifyFolder(next);
        setToast('Folder saved ✓');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not open the folder picker';
      setToast(msg);
      // Drive / cloud folder picked: keep the warning on the card, not just a short toast.
      if (msg === NOT_PHONE_FOLDER_MESSAGE) setFolderCheck({ ok: false, audio: 0, error: msg });
    } finally {
      setPicking(false);
    }
  };

  const running = Boolean(progress?.running);

  const runSync = () => {
    setSheet(false);
    if (!IS_ANDROID) {
      setToast('Call recording sync sirf Android phone par chalta hai.');
      return;
    }
    if (!folderCheck?.ok) {
      setToast('Pehle Recording folder select karein (Internal storage → Recordings → Call).');
      return;
    }
    const label = windowLabel();
    const state = queueManualRecordingSync({ sinceMs: windowMs(), windowLabel: label });
    setToast(state === 'queued' ? `Ek sync chal raha hai — uske baad ${label} wala chalega.` : `Sync started (${label})`);
  };

  const lastRun = history[0];
  const folderName = folder?.label || '';
  const pct = (() => {
    if (!progress) return 0;
    if (progress.phase === 'done') return 1;
    if (progress.phase === 'checking') return progress.scanned ? (progress.checked / progress.scanned) * 0.3 : 0.05;
    if (progress.phase === 'uploading') return 0.3 + (progress.found ? (progress.processed / progress.found) * 0.7 : 0.7);
    return 0.03;
  })();

  return (
    <View>
      <Text style={styles.pageTitle}>Call Recording</Text>

      {!IS_ANDROID ? (
        <View style={styles.iosNote}>
          <Ionicons name="information-circle" size={18} color="#1D4ED8" />
          <Text style={styles.iosNoteText}>
            Call recording sync sirf Android phone par chalta hai. iPhone par history dekh sakte hain.
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recording's Folder</Text>
        <View style={styles.folderBlock}>
          <Ionicons
            name={folderName ? 'folder-open' : 'folder-outline'}
            size={54}
            color={folderName ? (folderCheck && !folderCheck.ok ? '#F59E0B' : '#5B2EE6') : '#C5CAD3'}
          />
          <Text style={[styles.folderState, folderName ? styles.folderStateOn : null]}>
            {folderName || 'No folder selected'}
          </Text>
          {folderName && folderCheck ? (
            folderCheck.ok ? (
              <Text style={styles.folderOk}>
                ✓ Access OK · {folderCheck.audio} recording{folderCheck.audio === 1 ? '' : 's'} in folder
              </Text>
            ) : (
              <Text style={styles.folderErr}>
                {folderCheck.error === NOT_PHONE_FOLDER_MESSAGE
                  ? NOT_PHONE_FOLDER_MESSAGE
                  : 'Folder access nahi mila. "Change folder" dabakar wahi folder dobara chunein aur "Use this folder" → Allow karein.'}
              </Text>
            )
          ) : null}
          <TouchableOpacity
            style={[styles.selectBtn, !IS_ANDROID && styles.btnOff]}
            onPress={selectFolder}
            disabled={picking || !IS_ANDROID}
          >
            {picking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.selectBtnText}>{folderName ? 'Change folder' : 'Select folder'}</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.suggestRow}>
          <Text style={styles.suggest}>Suggested folder: Internal storage / Recordings / Call</Text>
          <Text style={styles.suggestHint}>{RECORDING_FOLDER_PICK_HINT}</Text>
        </View>
      </View>

      <View style={styles.syncBar}>
        <Text style={styles.syncTitle}>Manually sync calls for last</Text>
        <View style={styles.syncRow}>
          <TouchableOpacity style={styles.timeBtn} onPress={() => setSheet(true)} disabled={running}>
            <Text style={styles.timeBtnText} numberOfLines={1}>
              {windowLabel()}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.syncBtn, (running || !IS_ANDROID || !folderCheck?.ok) && styles.btnOff]}
            onPress={runSync}
            disabled={running || !IS_ANDROID || !folderCheck?.ok}
          >
            {running ? <ActivityIndicator color="#fff" /> : <Text style={styles.syncBtnText}>SYNC</Text>}
          </TouchableOpacity>
        </View>

        {progress ? (
          <View style={styles.progressBox}>
            <View style={styles.progressHead}>
              {progress.running ? (
                <ActivityIndicator size="small" color={PURPLE} />
              ) : (
                <Ionicons
                  name={progress.result?.status === 'failed' ? 'close-circle' : 'checkmark-circle'}
                  size={18}
                  color={progress.result?.status === 'failed' ? '#DC2626' : '#16A34A'}
                />
              )}
              <Text style={styles.progressText} numberOfLines={2}>
                {progress.running
                  ? `${phaseText(progress)}`
                  : `Sync ${STATUS_STYLE[progress.result?.status || 'success'].label.toLowerCase()} · ${progress.windowLabel || ''}`}
              </Text>
              {!progress.running ? (
                <TouchableOpacity onPress={() => setProgress(null)} hitSlop={8}>
                  <Ionicons name="close" size={16} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round(Math.min(1, Math.max(0.03, pct)) * 100)}%`,
                    backgroundColor: progress.result?.status === 'failed' ? '#DC2626' : PURPLE,
                  },
                ]}
              />
            </View>
            {progress.running && progress.current ? (
              <Text style={styles.progressFile} numberOfLines={1}>
                {progress.current}
              </Text>
            ) : null}
            <View style={styles.countRow}>
              <Count label="Found" value={progress.found} color="#0F172A" />
              <Count label="Uploaded" value={progress.uploaded} color="#047857" />
              <Count label="No match" value={progress.noMatch} color="#B45309" />
              <Count label="Skipped" value={progress.skipped} color="#64748B" />
              <Count label="Failed" value={progress.failed} color="#DC2626" />
            </View>
            {!progress.running && progress.result ? (
              <>
                <Text style={styles.progressMeta}>
                  {progress.result.scanned ?? 0} audio files in folder · {progress.result.found ?? 0} in last{' '}
                  {progress.windowLabel || 'range'}
                </Text>
                {progress.result.noMatch ? (
                  <Text style={styles.progressMeta}>
                    No match = is number ki koi call log aapke naam par nahi mili.
                  </Text>
                ) : null}
                {progress.result.skipNote ? (
                  <Text style={styles.progressMeta}>Skipped: {progress.result.skipNote}</Text>
                ) : null}
                {progress.result.error ? <Text style={styles.historyErr}>{progress.result.error}</Text> : null}
              </>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.lastSync}>
          {running ? 'Sync chal raha hai — screen band kar sakte hain, background mein chalta rahega.' : `Last synced: ${lastRun ? agoLabel(lastRun.at) : '—'}`}
        </Text>
      </View>

      <View style={styles.historyCard}>
        <Text style={styles.historyTitle}>Sync history</Text>
        {!historyLoaded ? (
          <ActivityIndicator color={PURPLE} style={{ marginVertical: 10 }} />
        ) : history.length === 0 ? (
          <Text style={styles.historyEmpty}>Abhi tak koi sync nahi hua. SYNC dabayein.</Text>
        ) : (
          history.slice(0, 15).map((row) => {
            const st = STATUS_STYLE[row.status] || STATUS_STYLE.success;
            return (
              <View key={row.id} style={styles.historyRow}>
                <View style={styles.historyTop}>
                  <Text style={styles.historyWhen}>{formatHistoryTime(row.at)}</Text>
                  <Text style={styles.historyRange} numberOfLines={1}>
                    {row.manual ? row.windowLabel || 'Manual' : 'Auto'}
                  </Text>
                  <View style={[styles.pill, { backgroundColor: st.bg }]}>
                    <Text style={[styles.pillText, { color: st.fg }]}>{st.label}</Text>
                  </View>
                </View>
                <Text style={styles.historyMeta}>
                  {row.found != null ? `${row.found} found · ` : ''}
                  {row.uploaded} uploaded
                  {row.noMatch ? ` · ${row.noMatch} no match` : ''}
                  {row.skipped ? ` · ${row.skipped} skipped` : ''}
                  {row.failed ? ` · ${row.failed} failed` : ''}
                </Text>
                {row.skipNote ? (
                  <Text style={styles.historySub} numberOfLines={2}>
                    {row.skipNote}
                  </Text>
                ) : null}
                {row.error ? (
                  <Text style={styles.historyErr} numberOfLines={3}>
                    {row.error}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>

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
                <TouchableOpacity style={styles.syncBtn} onPress={runSync} disabled={running}>
                  <Text style={styles.syncBtnText}>SYNC</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSheet(false)}>
                  <Ionicons name="close" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={styles.lastSync}>Last synced: {lastRun ? agoLabel(lastRun.at) : '—'}</Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {toast ? (
        <View style={styles.toast}>
          {toast.includes('✓') ? <Ionicons name="checkmark-circle" size={18} color="#16A34A" /> : null}
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
  folderState: { marginTop: 8, fontSize: 14, color: '#64748B', fontWeight: '600', textAlign: 'center', paddingHorizontal: 16 },
  folderStateOn: { color: '#0F172A', fontWeight: '800' },
  folderOk: { marginTop: 4, fontSize: 12, color: '#047857', fontWeight: '700' },
  folderErr: { marginTop: 6, fontSize: 12, color: '#B45309', textAlign: 'center', paddingHorizontal: 20 },
  btnOff: { opacity: 0.5 },
  iosNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  iosNoteText: { flex: 1, fontSize: 13, color: '#1E3A8A', fontWeight: '600' },
  progressBox: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  progressHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#0F172A' },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: '#E2E8F0', overflow: 'hidden', marginTop: 10 },
  progressFill: { height: 8, borderRadius: 99 },
  progressFile: { fontSize: 11, color: '#64748B', marginTop: 6 },
  progressMeta: { fontSize: 12, color: '#475569', marginTop: 6 },
  countRow: { flexDirection: 'row', marginTop: 10, gap: 6 },
  countBox: { flex: 1, alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingVertical: 8 },
  countValue: { fontSize: 17, fontWeight: '900' },
  countLabel: { fontSize: 10, color: '#64748B', fontWeight: '700', marginTop: 2 },
  historyEmpty: { fontSize: 13, color: '#64748B', paddingVertical: 6 },
  historyTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyRange: { flex: 1, fontSize: 12, color: '#64748B', fontWeight: '600' },
  historySub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  pill: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: '800' },
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
  suggestHint: { marginTop: 8, color: '#64748B', fontSize: 12, fontWeight: '600', lineHeight: 17 },
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
