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
  Switch,
  Platform,
  AppState,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

function istTodayYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function localDateToYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.shellBody}>{children}</View>
    </SafeAreaView>
  );
}

export function LeadManagerFloorScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [summary, setSummary] = useState({ on: 0, off: 0, date: '' });

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/lead-manager/floor');
      setAgents(data?.agents || []);
      setSummary({
        on: data?.on_floor || 0,
        off: data?.off_duty || 0,
        date: data?.date || '',
      });
    } catch (e: any) {
      Alert.alert('Floor', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <OpsShell title="Live floor">
      <View style={styles.stats}>
        <View style={[styles.stat, { backgroundColor: '#ECFDF5' }]}>
          <Text style={styles.statVal}>{summary.on}</Text>
          <Text style={styles.statLbl}>On floor</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: '#F8FAFC' }]}>
          <Text style={styles.statVal}>{summary.off}</Text>
          <Text style={styles.statLbl}>Off duty</Text>
        </View>
      </View>
      <Text style={styles.hint}>{summary.date ? `IST ${summary.date}` : ''}</Text>
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={agents}
          keyExtractor={(a) => a.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.name}</Text>
                <Text
                  style={[
                    styles.badge,
                    item.punched_in ? styles.badgeOn : styles.badgeOff,
                  ]}
                >
                  {item.punched_in ? 'On floor' : 'Off duty'}
                </Text>
              </View>
              <Text style={styles.meta}>{item.phone || item.email || '—'}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No telecallers found</Text>
          }
        />
      )}
    </OpsShell>
  );
}

export function LeadManagerLoginActivityScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(14);
  const [summary, setSummary] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [filterId, setFilterId] = useState('');

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ days: String(days), limit: '200' });
      if (filterId) q.set('telecaller_id', filterId);
      const data = await apiFetch<any>(`/api/lead-manager/telecaller-logins?${q}`);
      setSummary(data?.summary || []);
      setEvents(data?.events || []);
    } catch (e: any) {
      Alert.alert('Login activity', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days, filterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const fmt = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <OpsShell title="Login activity">
      <View style={styles.daysRow}>
        {[7, 14, 30].map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.dayChip, days === d && styles.dayChipOn]}
            onPress={() => setDays(d)}
          >
            <Text style={[styles.dayChipText, days === d && styles.dayChipTextOn]}>
              {d}d
            </Text>
          </TouchableOpacity>
        ))}
        {filterId ? (
          <TouchableOpacity
            style={styles.dayChip}
            onPress={() => setFilterId('')}
          >
            <Text style={styles.dayChipText}>Clear filter</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          ListHeaderComponent={
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.sectionTitle}>Counts · last {days} days</Text>
              {summary.map((s) => (
                <TouchableOpacity
                  key={s.telecaller_id}
                  style={styles.card}
                  onPress={() =>
                    setFilterId(filterId === s.telecaller_id ? '' : s.telecaller_id)
                  }
                >
                  <View style={styles.row}>
                    <Text style={styles.name}>{s.name}</Text>
                    <Text style={styles.badgeOn}>Today {s.logins_today}</Text>
                  </View>
                  <Text style={styles.meta}>
                    Total {s.logins_in_range} · Mobile {s.logins_mobile} · Web {s.logins_web}
                  </Text>
                  <Text style={styles.meta}>Last: {fmt(s.last_login)}</Text>
                </TouchableOpacity>
              ))}
              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Timeline</Text>
            </View>
          }
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.telecaller_name}</Text>
                <Text style={styles.meta}>{String(item.platform || '').toUpperCase()}</Text>
              </View>
              <Text style={styles.meta}>{fmt(item.logged_in_at)}</Text>
              <Text style={styles.meta}>📍 {item.where || '—'}</Text>
              {item.ip_address ? (
                <Text style={styles.meta}>IP {item.ip_address}</Text>
              ) : null}
              {item.device_label ? (
                <Text style={styles.meta}>{item.device_label}</Text>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No login events in this range yet</Text>
          }
        />
      )}
    </OpsShell>
  );
}

export function LeadManagerWhatsAppDndScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/lead-manager/whatsapp-dnd');
      setRows(data?.numbers || []);
    } catch (e: any) {
      Alert.alert('WA DND', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const p = phone.replace(/\D/g, '').slice(-10);
    if (p.length < 10) {
      Alert.alert('WA DND', 'Enter valid 10-digit phone');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/lead-manager/whatsapp-dnd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: p }),
      });
      setPhone('');
      await load();
    } catch (e: any) {
      Alert.alert('WA DND', e?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OpsShell title="WA DND">
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Phone to block WhatsApp"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => void add()}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addBtnText}>Add to DND</Text>
          )}
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => String(r.id || r.phone_last10 || i)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.phone_e164 || item.phone_last10}</Text>
              <Text style={styles.meta}>{item.reason || item.source || 'DND'}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No DND numbers</Text>}
        />
      )}
    </OpsShell>
  );
}

export function LeadManagerTeamWhatsAppScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chats, setChats] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/lead-manager/team-whatsapp');
      setChats(data?.chats || data?.items || []);
    } catch (e: any) {
      Alert.alert('Team WA', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <OpsShell title="Team WhatsApp">
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c, i) => String(c.id || c.phone || i)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name}>
                  {item.customer_name || item.name || item.phone}
                </Text>
                <Text style={styles.meta}>
                  {item.assigned_telecaller_name || item.assignee || 'Unassigned'}
                </Text>
              </View>
              <Text style={styles.meta} numberOfLines={2}>
                {item.last_message?.preview || item.preview || 'No messages'}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No team chats</Text>}
        />
      )}
    </OpsShell>
  );
}

export function LeadManagerStatusesScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/lead-manager/statuses?all=1');
      setRows(data?.statuses || []);
      if (data?.warning) Alert.alert('Lead status', String(data.warning));
    } catch (e: any) {
      Alert.alert('Lead status', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/api/lead-manager/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_status', name: name.trim() }),
      });
      setName('');
      await load();
    } catch (e: any) {
      Alert.alert('Create', e?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = (row: any) => {
    if (row.is_system) {
      Alert.alert('System', 'System status delete nahi hota — deactivate web pe karo.');
      return;
    }
    Alert.alert('Delete', `Delete "${row.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await apiFetch('/api/lead-manager/statuses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete_status', id: row.id }),
              });
              await load();
            } catch (e: any) {
              Alert.alert('Delete', e?.message || 'Failed');
            }
          })();
        },
      },
    ]);
  };

  return (
    <OpsShell title="Lead status">
      <View style={styles.form}>
        <Text style={styles.name}>Create status</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Hot lead, Quotation sent"
          value={name}
          onChangeText={setName}
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => void create()}
          disabled={saving || !name.trim()}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addBtnText}>Add status</Text>
          )}
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => {
                setLoading(true);
                void load();
              }}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onLongPress={() => remove(item)}>
              <View style={styles.row}>
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: item.color || COLORS.primary },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.code}
                    {item.is_active === false ? ' · off' : ''}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </OpsShell>
  );
}

/** Telecaller from-numbers (same as web Team / Click to Call phones). */
export function LeadManagerTeamScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [hourStarts, setHourStarts] = useState<Record<string, string>>({});
  const [hourEnds, setHourEnds] = useState<Record<string, string>>({});
  const [hourDays, setHourDays] = useState<Record<string, number[]>>({});
  const [leaveFrom, setLeaveFrom] = useState<Record<string, string>>({});
  const [leaveTo, setLeaveTo] = useState<Record<string, string>>({});
  const [onLeave, setOnLeave] = useState<Record<string, boolean>>({});
  const [autoDialOn, setAutoDialOn] = useState<Record<string, boolean>>({});
  const [offCover, setOffCover] = useState<Record<string, string>>({});
  const [leaveCover, setLeaveCover] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [leavePicker, setLeavePicker] = useState<{ id: string; field: 'from' | 'to' } | null>(
    null,
  );
  const [teamTab, setTeamTab] = useState<'phones' | 'days' | 'leave'>('phones');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/super_admin/click-to-call');
      const list = (data?.telecallers || []) as any[];
      setRows(list);
      const d: Record<string, string> = {};
      const hs: Record<string, string> = {};
      const he: Record<string, string> = {};
      const hd: Record<string, number[]> = {};
      const lf: Record<string, string> = {};
      const lt: Record<string, string> = {};
      const ol: Record<string, boolean> = {};
      const ad: Record<string, boolean> = {};
      const oc: Record<string, string> = {};
      const lc: Record<string, string> = {};
      const custom = (data?.config?.telecaller_hours || {}) as Record<
        string,
        {
          start?: string;
          end?: string;
          days?: number[];
          leave_from?: string;
          leave_to?: string;
          on_leave?: boolean;
          auto_dial_enabled?: boolean;
          offday_cover_id?: string;
          leave_cover_id?: string;
        }
      >;
      const defaultDays = (data?.config?.auto_dial_days || [1, 2, 3, 4, 5, 6]) as number[];
      for (const t of list) {
        d[t.id] = String(t.phone || '').replace(/\D/g, '').slice(-10);
        hs[t.id] = custom[t.id]?.start || t.dial_hours?.start || '10:00';
        he[t.id] = custom[t.id]?.end || t.dial_hours?.end || '19:00';
        hd[t.id] = custom[t.id]?.days?.length ? custom[t.id].days! : defaultDays;
        lf[t.id] = custom[t.id]?.leave_from || '';
        lt[t.id] = custom[t.id]?.leave_to || '';
        ol[t.id] = Boolean(custom[t.id]?.on_leave);
        ad[t.id] = custom[t.id]?.auto_dial_enabled !== false;
        oc[t.id] = custom[t.id]?.offday_cover_id || '';
        lc[t.id] = custom[t.id]?.leave_cover_id || '';
      }
      setDrafts(d);
      setHourStarts(hs);
      setHourEnds(he);
      setHourDays(hd);
      setLeaveFrom(lf);
      setLeaveTo(lt);
      setOnLeave(ol);
      setAutoDialOn(ad);
      setOffCover(oc);
      setLeaveCover(lc);
    } catch (e: any) {
      Alert.alert('Team', e?.message || 'Failed to load telecallers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyLeaveDate = (id: string, field: 'from' | 'to', ymd: string) => {
    const today = istTodayYmd();
    const next = ymd < today ? today : ymd;
    if (field === 'from') {
      const currentTo = leaveTo[id] || '';
      setLeaveFrom((prev) => ({ ...prev, [id]: next }));
      setLeaveTo((prev) => ({
        ...prev,
        [id]: currentTo && currentTo >= next ? currentTo : next,
      }));
      return;
    }
    const currentFrom = leaveFrom[id] || '';
    setLeaveTo((prev) => ({ ...prev, [id]: next }));
    setLeaveFrom((prev) => ({
      ...prev,
      [id]: currentFrom && currentFrom <= next ? currentFrom : next,
    }));
  };

  const savePhone = async (id: string) => {
    const today = istTodayYmd();
    let from = leaveFrom[id] || '';
    let to = leaveTo[id] || '';
    const emergency = Boolean(onLeave[id]);
    if (emergency && !from && !to) {
      from = today;
      to = today;
    }
    if (from && from < today && (!to || to < today)) {
      Alert.alert('Leave', 'Past date nahi chalegi — aaj ya aage ki date do');
      return;
    }
    if (to && to < today) {
      Alert.alert('Leave', 'Past date nahi chalegi — aaj ya aage ki date do');
      return;
    }
    if (from && to && from > to) {
      to = from;
    }
    setSavingId(id);
    try {
      await apiFetch('/api/super_admin/click-to-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_telecaller_phone',
          telecaller_id: id,
          phone: drafts[id] || '',
        }),
      });
      await apiFetch('/api/super_admin/click-to-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_telecaller_hours',
          telecaller_id: id,
          start: hourStarts[id] || '',
          end: hourEnds[id] || '',
          days: hourDays[id] || [1, 2, 3, 4, 5, 6],
          leave_from: from,
          leave_to: to,
          on_leave: emergency,
          auto_dial_enabled: autoDialOn[id] !== false,
          offday_cover_id: offCover[id] || '',
          leave_cover_id: leaveCover[id] || '',
        }),
      });
      await load();
    } catch (e: any) {
      Alert.alert('Save', e?.message || 'Failed');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <OpsShell title="Team">
      <Text style={[styles.hint, { paddingTop: 8 }]}>
        Har telecaller ka from-number, shift, weekly off, aur leave alag set hota hai.
      </Text>
      <View style={[styles.phoneRow, { paddingHorizontal: SPACING.md, flexWrap: 'wrap', gap: 6 }]}>
        {([
          { id: 'phones', label: 'From numbers' },
          { id: 'days', label: 'Working days' },
          { id: 'leave', label: 'Leave' },
        ] as const).map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.dayChip, teamTab === tab.id && styles.dayChipOn]}
            onPress={() => setTeamTab(tab.id)}
          >
            <Text style={[styles.dayChipText, teamTab === tab.id && styles.dayChipTextOn]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.full_name || item.email || 'Telecaller'}</Text>
              <Text style={styles.meta}>{item.email || '—'}</Text>
              <Text style={styles.meta}>
                {item.on_floor || item.punched_in ? 'On floor' : 'Off duty'}
                {item.on_leave ? ' · On leave' : ''}
              </Text>
              {teamTab === 'phones' ? (
              <View style={styles.phoneRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  keyboardType="phone-pad"
                  value={drafts[item.id] || ''}
                  onChangeText={(v) =>
                    setDrafts((prev) => ({ ...prev, [item.id]: v.replace(/\D/g, '').slice(-10) }))
                  }
                  placeholder="10-digit phone"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity
                  style={styles.saveMini}
                  onPress={() => void savePhone(item.id)}
                  disabled={savingId === item.id}
                >
                  {savingId === item.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveMiniText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
              ) : null}
              {teamTab === 'days' ? (
              <>
              <View style={[styles.phoneRow, { marginTop: 8 }]}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={hourStarts[item.id] || ''}
                  onChangeText={(v) => setHourStarts((prev) => ({ ...prev, [item.id]: v }))}
                  placeholder="Start 10:00"
                  placeholderTextColor="#94A3B8"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={hourEnds[item.id] || ''}
                  onChangeText={(v) => setHourEnds((prev) => ({ ...prev, [item.id]: v }))}
                  placeholder="End 19:00"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={[styles.phoneRow, { marginTop: 8, flexWrap: 'wrap', gap: 6 }]}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, day) => {
                  const on = (hourDays[item.id] || []).includes(day);
                  return (
                    <TouchableOpacity
                      key={`${item.id}-${day}`}
                      style={[styles.dayChip, on && styles.dayChipOn]}
                      onPress={() =>
                        setHourDays((prev) => {
                          const cur = prev[item.id] || [];
                          const next = cur.includes(day)
                            ? cur.filter((d) => d !== day)
                            : [...cur, day].sort((a, b) => a - b);
                          return { ...prev, [item.id]: next.length ? next : cur };
                        })
                      }
                    >
                      <Text style={[styles.dayChipText, on && styles.dayChipTextOn]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={[styles.phoneRow, { marginTop: 8, justifyContent: 'space-between' }]}>
                <Text style={styles.meta}>Fresh auto-dial</Text>
                <Switch
                  value={autoDialOn[item.id] !== false}
                  onValueChange={(v) => setAutoDialOn((prev) => ({ ...prev, [item.id]: v }))}
                />
              </View>
              </>
              ) : null}
              {teamTab === 'leave' ? (
              <>
              <Text style={[styles.meta, { marginTop: 8 }]}>
                Leave from–to = planned (bol ke). Emergency pe bhi date zaroori.
              </Text>
              <View style={[styles.phoneRow, { marginTop: 8, justifyContent: 'space-between' }]}>
                <Text style={styles.meta}>On leave today (emergency)</Text>
                <Switch
                  value={Boolean(onLeave[item.id])}
                  onValueChange={(v) => {
                    setOnLeave((prev) => ({ ...prev, [item.id]: v }));
                    if (!v) return;
                    const today = istTodayYmd();
                    const from = leaveFrom[item.id] && leaveFrom[item.id] >= today ? leaveFrom[item.id] : today;
                    const to = leaveTo[item.id] && leaveTo[item.id] >= from ? leaveTo[item.id] : from;
                    setLeaveFrom((prev) => ({ ...prev, [item.id]: from }));
                    setLeaveTo((prev) => ({ ...prev, [item.id]: to }));
                  }}
                />
              </View>
              <View style={[styles.phoneRow, { marginTop: 8 }]}>
                <TouchableOpacity
                  style={[styles.input, { flex: 1, justifyContent: 'center' }]}
                  onPress={() => setLeavePicker({ id: item.id, field: 'from' })}
                >
                  <Text style={{ color: leaveFrom[item.id] ? COLORS.text : '#94A3B8' }}>
                    {leaveFrom[item.id] || 'Leave from'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.input, { flex: 1, justifyContent: 'center' }]}
                  onPress={() => setLeavePicker({ id: item.id, field: 'to' })}
                >
                  <Text style={{ color: leaveTo[item.id] ? COLORS.text : '#94A3B8' }}>
                    {leaveTo[item.id] || 'Leave to'}
                  </Text>
                </TouchableOpacity>
              </View>
              </>
              ) : null}
              {teamTab !== 'phones' ? (
              <>
              <Text style={[styles.meta, { marginTop: 8 }]}>
                {teamTab === 'leave' ? 'Leave leads go to' : 'Off-day leads go to'}
              </Text>
              <View style={[styles.phoneRow, { marginTop: 6, flexWrap: 'wrap', gap: 6 }]}>
                {rows
                  .filter((o) => o.id !== item.id && o.is_active)
                  .map((o) => {
                    const selected =
                      teamTab === 'leave'
                        ? leaveCover[item.id] === o.id
                        : offCover[item.id] === o.id;
                    return (
                      <TouchableOpacity
                        key={o.id}
                        style={[styles.dayChip, selected && styles.dayChipOn]}
                        onPress={() => {
                          if (teamTab === 'leave') {
                            setLeaveCover((prev) => ({ ...prev, [item.id]: o.id }));
                          } else {
                            setOffCover((prev) => ({ ...prev, [item.id]: o.id }));
                          }
                        }}
                      >
                        <Text style={[styles.dayChipText, selected && styles.dayChipTextOn]}>
                          {String(o.full_name || o.email || 'TC').split(' ')[0]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
              <TouchableOpacity
                style={[styles.saveMini, { alignSelf: 'flex-end', marginTop: 10 }]}
                onPress={() => void savePhone(item.id)}
                disabled={savingId === item.id}
              >
                {savingId === item.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveMiniText}>Save</Text>
                )}
              </TouchableOpacity>
              </>
              ) : null}
              <Text style={styles.meta}>
                {item.on_leave
                  ? 'On leave — auto-dial off'
                  : item.dial_open_now
                    ? 'Auto-dial open now'
                    : 'Auto-dial paused now'}
              </Text>
              {!item.is_active ? (
                <Text style={[styles.badge, styles.badgeOff, { alignSelf: 'flex-start', marginTop: 8 }]}>
                  Inactive
                </Text>
              ) : null}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No telecallers</Text>}
        />
      )}
      {leavePicker ? (
        <View>
          <DateTimePicker
            value={ymdToLocalDate(
              leavePicker.field === 'from'
                ? leaveFrom[leavePicker.id] || istTodayYmd()
                : leaveTo[leavePicker.id] || leaveFrom[leavePicker.id] || istTodayYmd(),
            )}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={ymdToLocalDate(istTodayYmd())}
            onChange={(_event, selected) => {
              if (Platform.OS !== 'ios') setLeavePicker(null);
              if (!selected) return;
              applyLeaveDate(leavePicker.id, leavePicker.field, localDateToYmd(selected));
            }}
          />
          {Platform.OS === 'ios' ? (
            <TouchableOpacity
              style={[styles.saveMini, { alignSelf: 'flex-end', marginRight: SPACING.md, marginBottom: 8 }]}
              onPress={() => setLeavePicker(null)}
            >
              <Text style={styles.saveMiniText}>Done</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </OpsShell>
  );
}

/** Create telecaller login IDs under this lead manager. */
export function LeadManagerTelecallerIdsScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listFilter, setListFilter] = useState<'active' | 'inactive'>('active');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
  });

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/lead-manager/telecallers', { timeoutMs: 20000 });
      setRows(Array.isArray(data?.telecallers) ? data.telecallers : []);
    } catch (e: any) {
      setRows((prev) => {
        if (!prev.length) {
          Alert.alert('Telecaller IDs', e?.message || 'Failed to load');
        }
        return prev;
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);

  const genPassword = () => {
    const p = `MyFNG${Math.random().toString(36).slice(2, 8)}!`;
    setForm((f) => ({ ...f, password: p }));
  };

  const filteredRows = rows.filter((r) =>
    listFilter === 'active' ? r.is_active !== false : r.is_active === false,
  );
  const activeCount = rows.filter((r) => r.is_active !== false).length;
  const inactiveCount = rows.filter((r) => r.is_active === false).length;

  const create = async () => {
    const first = form.first_name.trim();
    const last = form.last_name.trim();
    if (!first || !form.email.trim() || !form.password) {
      Alert.alert('Required', 'First name, email and password are required');
      return;
    }
    const full_name = [first, last].filter(Boolean).join(' ');
    setSaving(true);
    try {
      await apiFetch('/api/lead-manager/telecallers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: first,
          last_name: last,
          full_name,
          email: form.email.trim(),
          phone: form.phone,
          password: form.password,
        }),
      });
      Alert.alert('Created', `Login: ${form.email}\nPassword: ${form.password}`);
      setForm({ first_name: '', last_name: '', email: '', phone: '', password: '' });
      await load();
    } catch (e: any) {
      Alert.alert('Create', e?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OpsShell title="Telecaller IDs">
      <Text style={[styles.hint, { paddingTop: 8 }]}>
        Create login IDs for your telecallers — they report to you.
      </Text>
      <View style={styles.form}>
        <View style={[styles.phoneRow, { marginTop: 0 }]}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="First name *"
            placeholderTextColor="#94A3B8"
            value={form.first_name}
            onChangeText={(v) => setForm((f) => ({ ...f, first_name: v }))}
          />
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Last name"
            placeholderTextColor="#94A3B8"
            value={form.last_name}
            onChangeText={(v) => setForm((f) => ({ ...f, last_name: v }))}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Email (login) *"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          keyboardType="email-address"
          value={form.email}
          onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone (10-digit)"
          placeholderTextColor="#94A3B8"
          keyboardType="phone-pad"
          value={form.phone}
          onChangeText={(v) =>
            setForm((f) => ({ ...f, phone: v.replace(/\D/g, '').slice(0, 10) }))
          }
        />
        <View style={styles.phoneRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Password *"
            placeholderTextColor="#94A3B8"
            value={form.password}
            onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
          />
          <TouchableOpacity style={styles.saveMini} onPress={genPassword}>
            <Text style={styles.saveMiniText}>Gen</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => void create()} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addBtnText}>Create telecaller ID</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filteredRows}
          keyExtractor={(r) => r.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={{ marginBottom: 10 }}>
              <Text style={[styles.hint, { paddingHorizontal: 0, marginBottom: 8 }]}>
                Your telecallers ({filteredRows.length})
              </Text>
              <View style={styles.filterRow}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    listFilter === 'active' && styles.filterChipOn,
                  ]}
                  onPress={() => setListFilter('active')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      listFilter === 'active' && styles.filterChipTextOn,
                    ]}
                  >
                    Active ({activeCount})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    listFilter === 'inactive' && styles.filterChipOn,
                  ]}
                  onPress={() => setListFilter('inactive')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      listFilter === 'inactive' && styles.filterChipTextOn,
                    ]}
                  >
                    Show inactive ({inactiveCount})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.full_name || 'Telecaller'}</Text>
                <Text
                  style={[
                    styles.badge,
                    item.is_active !== false ? styles.badgeOn : styles.badgeOff,
                  ]}
                >
                  {item.is_active !== false ? 'Active' : 'Inactive'}
                </Text>
              </View>
              <Text style={styles.meta}>
                {item.email || '—'}
                {item.phone ? ` · ${item.phone}` : ''}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {listFilter === 'active' ? 'No active telecallers' : 'No inactive telecallers'}
            </Text>
          }
        />
      )}
    </OpsShell>
  );
}

export function LeadManagerTagsScreen() {
  const [tags, setTags] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/lead-manager/tags');
      setTags(data?.tags || []);
    } catch (e: any) {
      Alert.alert('Lead tags', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/api/lead-manager/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_tag', name: name.trim() }),
      });
      setName('');
      setLoading(true);
      await load();
    } catch (e: any) {
      Alert.alert('Create', e?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = (tag: any) => {
    Alert.alert('Delete', `Delete tag "${tag.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await apiFetch('/api/lead-manager/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete_tag', id: tag.id }),
              });
              setLoading(true);
              await load();
            } catch (e: any) {
              Alert.alert('Delete', e?.message || 'Failed');
            }
          })();
        },
      },
    ]);
  };

  return (
    <OpsShell title="Lead tags">
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="New tag name"
          value={name}
          onChangeText={setName}
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => void create()}
          disabled={saving || !name.trim()}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addBtnText}>Add tag</Text>
          )}
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={tags}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onLongPress={() => remove(item)}>
              <View style={styles.row}>
                <View
                  style={[styles.swatch, { backgroundColor: item.color || '#BFDBFE' }]}
                />
                <Text style={styles.name}>{item.name}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No tags yet</Text>}
        />
      )}
    </OpsShell>
  );
}

/** Click-to-call overview for LM — DID assignments + enable flag (read + link to Team phones). */
export function LeadManagerClickToCallScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<any>(null);
  const [telecallers, setTelecallers] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/super_admin/click-to-call');
      setCfg(data?.config || null);
      setTelecallers(data?.telecallers || []);
    } catch (e: any) {
      Alert.alert('Click to Call', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <OpsShell title="Click to Call">
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          ListHeaderComponent={
            <View style={{ padding: SPACING.md, gap: 10 }}>
              <View style={styles.card}>
                <Text style={styles.name}>
                  Status: {cfg?.enabled ? 'Enabled' : 'Disabled'}
                </Text>
                <Text style={styles.meta} numberOfLines={2}>
                  Gateway: {cfg?.gateway_url || '—'}
                </Text>
                <Text style={styles.meta}>
                  Auto-dial Fresh:{' '}
                  {cfg?.auto_dial_on_fresh_assign ? 'ON' : 'OFF'}
                </Text>
                <Text style={styles.meta}>
                  Calling hours:{' '}
                  {cfg?.auto_dial_hours_enabled === false
                    ? '24×7'
                    : `${cfg?.auto_dial_start || '10:00'}–${cfg?.auto_dial_end || '19:00'} IST ${cfg?.auto_dial_days_label || 'Mon–Sat'}`}
                </Text>
                {cfg?.clock ? (
                  <Text style={styles.meta}>
                    Now {cfg.clock.weekday_label} {cfg.clock.now_hhmm} IST ·{' '}
                    {cfg.clock.open ? 'auto-dial open' : 'auto-dial paused'}
                  </Text>
                ) : null}
                <Text style={styles.meta}>
                  Fallback DID: {cfg?.did || '—'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => navigation.navigate('LeadManagerTeam')}
              >
                <Text style={styles.addBtnText}>Edit telecaller phones</Text>
              </TouchableOpacity>
              <Text style={styles.hint}>
                Assigned DID exclusive hai — sirf usi telecaller ka caller ID. DID pool /
                gateway Super Admin set karta hai.
              </Text>
              <Text style={[styles.name, { marginTop: 8 }]}>DID assignments</Text>
            </View>
          }
          data={cfg?.did_assignments || []}
          keyExtractor={(a: any) => a.did}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const tc = telecallers.find((t) => t.id === item.telecaller_id);
            return (
              <View style={[styles.card, { marginHorizontal: SPACING.md }]}>
                <Text style={styles.name}>{item.did}</Text>
                <Text style={styles.meta}>
                  {tc?.full_name
                    ? `${tc.full_name} · Exclusive`
                    : item.telecaller_id
                      ? 'Assigned · Exclusive'
                      : 'Unassigned'}
                  {tc?.phone ? ` · ${tc.phone}` : ''}
                </Text>
              </View>
            );
          }}
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
  hint: {
    paddingHorizontal: SPACING.md,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
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
  form: { padding: SPACING.md, gap: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  empty: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: 40,
    fontSize: 14,
  },
  swatch: { width: 14, height: 14, borderRadius: 4, marginRight: 8 },
  phoneRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
  },
  filterChipOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  filterChipTextOn: { color: '#fff' },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 4,
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
  },
  dayChipOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  dayChipTextOn: { color: '#fff' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  saveMini: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 64,
    alignItems: 'center',
  },
  saveMiniText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
