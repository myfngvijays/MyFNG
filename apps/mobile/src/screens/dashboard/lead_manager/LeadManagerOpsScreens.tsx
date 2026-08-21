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
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/super_admin/click-to-call');
      const list = (data?.telecallers || []) as any[];
      setRows(list);
      const d: Record<string, string> = {};
      for (const t of list) d[t.id] = String(t.phone || '').replace(/\D/g, '').slice(-10);
      setDrafts(d);
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

  const savePhone = async (id: string) => {
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
        Telecaller calling numbers (click-to-call `from`). Same as website Team / CTC phones.
      </Text>
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
      const data = await apiFetch<any>('/api/lead-manager/telecallers');
      setRows(Array.isArray(data?.telecallers) ? data.telecallers : []);
    } catch (e: any) {
      Alert.alert('Telecaller IDs', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
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
                DID pool / gateway secrets Super Admin set karta hai. Yahan phones + overview.
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
                  {tc?.full_name || (item.telecaller_id ? 'Assigned' : 'Unassigned')}
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
