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
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

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
    <View style={styles.container}>
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
                  {item.punched_in ? 'On floor' : 'Off'}
                </Text>
              </View>
              <Text style={styles.meta}>
                Assigned today {item.assigned_today} · Updates {item.updates_today} · Overdue FU{' '}
                {item.overdue_followups}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

export function LeadManagerWhatsAppDndScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/lead-manager/whatsapp-dnd');
      setRows(data?.numbers || []);
    } catch (e: any) {
      Alert.alert('DND', e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/lead-manager/whatsapp-dnd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, reason }),
      });
      setPhone('');
      setReason('');
      await load();
    } catch (e: any) {
      Alert.alert('DND', e?.message || 'Add failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await apiFetch(`/api/lead-manager/whatsapp-dnd?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      await load();
    } catch (e: any) {
      Alert.alert('DND', e?.message || 'Remove failed');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Phone (10 digit)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="Reason (optional)"
          value={reason}
          onChangeText={setReason}
        />
        <TouchableOpacity style={styles.primaryBtn} disabled={saving} onPress={() => void add()}>
          <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Add to DND'}</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator color={COLORS.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: SPACING.md }}
          ListEmptyComponent={<Text style={styles.meta}>No DND numbers</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.phone_last10}</Text>
                <TouchableOpacity onPress={() => void remove(item.id)}>
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
              <Text style={styles.meta}>{item.reason || item.source}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

export function LeadManagerTeamWhatsAppScreen() {
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/lead-manager/team-whatsapp?unanswered_hours=0');
      setChats(data?.chats || []);
    } catch (e: any) {
      Alert.alert('Team WA', e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => c.phone}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.meta}>No assigned chats</Text>}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => void load()} />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.phone}</Text>
                {item.unanswered_inbound ? (
                  <Text style={[styles.badge, styles.badgeWarn]}>
                    Unanswered{item.unanswered_hours != null ? ` ${item.unanswered_hours}h` : ''}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.meta}>
                {(item.assignees || []).map((a: any) => a.full_name || a.id?.slice(0, 6)).join(', ') ||
                  'Unassigned'}
              </Text>
              <Text style={styles.meta} numberOfLines={2}>
                {item.last_message?.preview || 'No messages'}
              </Text>
            </View>
          )}
        />
      )}
    </View>
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
      if (data?.warning) {
        Alert.alert('Lead status', String(data.warning));
      }
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
    <View style={styles.container}>
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
            <View style={styles.card}>
              <View style={styles.row}>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: item.color || '#E2E8F0' },
                  ]}
                >
                  <Text style={styles.statusPillText}>{item.name}</Text>
                </View>
                {!item.is_system ? (
                  <TouchableOpacity onPress={() => remove(item)}>
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.meta}>system</Text>
                )}
              </View>
              <Text style={styles.meta}>
                {item.code}
                {item.is_active === false ? ' · off' : ''}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background || '#F8FAFC' },
  stats: { flexDirection: 'row', gap: 10, padding: SPACING.md },
  stat: { flex: 1, borderRadius: 14, padding: 14 },
  statVal: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary },
  statLbl: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginTop: 2 },
  hint: { paddingHorizontal: SPACING.md, fontSize: 12, color: COLORS.textSecondary },
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
  badge: { fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeOn: { backgroundColor: '#D1FAE5', color: '#065F46' },
  badgeOff: { backgroundColor: '#E2E8F0', color: '#475569' },
  badgeWarn: { backgroundColor: '#FEF3C7', color: '#92400E' },
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
  statusPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillText: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
});
