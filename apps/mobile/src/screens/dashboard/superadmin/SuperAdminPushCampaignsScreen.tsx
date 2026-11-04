import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

type Campaign = {
  id: string;
  name?: string;
  status?: string;
  scheduled_at?: string;
  sent_at?: string | null;
  ab_enabled?: boolean;
  error_message?: string | null;
  payload?: { title?: string; message?: string; category?: string };
  variant_b?: { title?: string; message?: string } | null;
  engagement?: { opens?: number; clicks?: number };
};

const FESTIVAL_RE =
  /diwali|deepavali|दिवाळी|दिवाली|navratri|नवरात्र|garba|durga|dasara|dussehra|दसर|होली|\bholi\b|christmas|eid|ramzan|ramadan|ganesh|गणेश|ganpati|pongal|onam|baisakhi|rakhi|raksha|janmashtami|festiv|new year|नववर्ष/i;

function campaignCategory(campaign: Campaign): 'festival' | 'normal' {
  const explicit = String(campaign.payload?.category || '').toLowerCase();
  if (explicit === 'festival' || explicit === 'normal') return explicit;
  const text = `${campaign.name || ''} ${campaign.payload?.title || ''} ${campaign.payload?.message || ''}`;
  return FESTIVAL_RE.test(text) ? 'festival' : 'normal';
}

function formatDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocalInput(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) return null;
  const when = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  return Number.isNaN(when.getTime()) ? null : when;
}

export function SuperAdminPushCampaignsScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editWhen, setEditWhen] = useState('');
  const [editTitleB, setEditTitleB] = useState('');
  const [editMessageB, setEditMessageB] = useState('');
  const [tab, setTab] = useState<'all' | 'festival' | 'normal'>('all');

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<{ campaigns?: Campaign[]; error?: string }>(
        '/api/super_admin/notifications/campaigns',
      );
      setCampaigns(Array.isArray(data?.campaigns) ? data.campaigns : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    const id = String(body.id || '');
    setBusyId(id);
    try {
      await apiFetch('/api/super_admin/notifications/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setEditingId(null);
      await load();
    } catch (e: any) {
      Alert.alert('Could not update', e?.message || 'Request failed');
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (campaign: Campaign) => {
    setEditingId(campaign.id);
    setEditTitle(campaign.payload?.title || campaign.name || '');
    setEditMessage(campaign.payload?.message || '');
    setEditWhen(toLocalInput(campaign.scheduled_at));
    setEditTitleB(campaign.variant_b?.title || '');
    setEditMessageB(campaign.variant_b?.message || '');
  };

  const saveEdit = (campaign: Campaign) => {
    const when = parseLocalInput(editWhen);
    if (!editTitle.trim() || !editMessage.trim()) {
      Alert.alert('Missing text', 'Title and message are required');
      return;
    }
    if (!when) {
      Alert.alert('Time', 'Use YYYY-MM-DD HH:MM');
      return;
    }
    void patch({
      id: campaign.id,
      action: 'update',
      name: editTitle.trim(),
      title: editTitle.trim(),
      message: editMessage.trim(),
      scheduled_at: when.toISOString(),
      variant_b: campaign.ab_enabled
        ? { title: editTitleB.trim(), message: editMessageB.trim() }
        : undefined,
    });
  };

  const overdueCount = campaigns.filter(
    (c) => c.status === 'scheduled' && c.scheduled_at && new Date(c.scheduled_at).getTime() < Date.now(),
  ).length;

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Push Campaigns</Text>
        <View style={{ width: 40 }} />
      </View>
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
          {overdueCount > 0 ? (
            <Text style={styles.note}>
              {overdueCount} campaign{overdueCount === 1 ? '' : 's'} missed their time because the sender did not run.
              Send now, or edit the time. Auto-send only covers the last 6 hours.
            </Text>
          ) : null}
          <View style={styles.tabs}>
            {([
              ['all', 'All', campaigns.length],
              ['festival', 'Festival', campaigns.filter((c) => campaignCategory(c) === 'festival').length],
              ['normal', 'Normal', campaigns.filter((c) => campaignCategory(c) === 'normal').length],
            ] as const).map(([id, label, count]) => (
              <TouchableOpacity
                key={id}
                onPress={() => setTab(id)}
                style={[styles.tab, tab === id && styles.tabOn]}
              >
                <Text style={[styles.tabText, tab === id && styles.tabTextOn]}>
                  {label} {count}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {campaigns.length === 0 && !error ? <Text style={styles.empty}>No campaigns yet.</Text> : null}
          {campaigns.filter((c) => tab === 'all' || campaignCategory(c) === tab).map((campaign) => {
            const overdue =
              campaign.status === 'scheduled' &&
              !!campaign.scheduled_at &&
              new Date(campaign.scheduled_at).getTime() < Date.now();
            const busy = busyId === campaign.id;
            const editing = editingId === campaign.id;
            return (
              <View key={campaign.id} style={styles.card}>
                <View style={styles.row}>
                  <Text style={[styles.cardTitle, { flex: 1 }]} numberOfLines={1}>
                    {campaign.name || campaign.payload?.title || 'Campaign'}
                  </Text>
                  <Text style={styles.badge}>{(campaign.status || '').toUpperCase()}</Text>
                </View>
                {campaign.payload?.message && !editing ? (
                  <Text style={styles.message} numberOfLines={1}>
                    {campaign.payload.message}
                  </Text>
                ) : null}
                <Text style={styles.meta} numberOfLines={1}>
                  {campaign.scheduled_at ? formatDate(campaign.scheduled_at) : ''}
                  {overdue ? ' · LATE' : ''}
                </Text>
                {campaign.error_message ? <Text style={styles.error}>{campaign.error_message}</Text> : null}
                <Text style={styles.meta}>
                  {campaign.engagement?.opens ?? 0} opens · {campaign.engagement?.clicks ?? 0} clicks
                </Text>
                <TouchableOpacity
                  disabled={busy}
                  onPress={() =>
                    void patch({
                      id: campaign.id,
                      action: 'set_category',
                      category: campaignCategory(campaign) === 'festival' ? 'normal' : 'festival',
                    })
                  }
                >
                  <Text style={styles.link}>
                    {campaignCategory(campaign) === 'festival' ? 'Move to Normal' : 'Move to Festival'}
                  </Text>
                </TouchableOpacity>
                {campaign.status === 'scheduled' && !editing ? (
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.secondary} disabled={busy} onPress={() => startEdit(campaign)}>
                      <Text style={styles.secondaryText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.primary}
                      disabled={busy}
                      onPress={() =>
                        Alert.alert('Send now', campaign.payload?.title || campaign.name || 'Send this campaign?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Send', onPress: () => void patch({ id: campaign.id, action: 'send_now' }) },
                        ])
                      }
                    >
                      <Text style={styles.primaryText}>{busy ? 'Sending…' : 'Send now'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={busy}
                      onPress={() =>
                        Alert.alert('Cancel campaign', 'This scheduled send will not go out.', [
                          { text: 'Keep', style: 'cancel' },
                          {
                            text: 'Cancel campaign',
                            style: 'destructive',
                            onPress: () => void patch({ id: campaign.id, action: 'cancel' }),
                          },
                        ])
                      }
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {editing ? (
                  <View style={{ marginTop: 10 }}>
                    <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} placeholder="Title" />
                    <TextInput
                      style={[styles.input, { minHeight: 72 }]}
                      value={editMessage}
                      onChangeText={setEditMessage}
                      placeholder="Message"
                      multiline
                    />
                    <TextInput
                      style={styles.input}
                      value={editWhen}
                      onChangeText={setEditWhen}
                      placeholder="YYYY-MM-DD HH:MM"
                      autoCapitalize="none"
                    />
                    {campaign.ab_enabled ? (
                      <>
                        <TextInput style={styles.input} value={editTitleB} onChangeText={setEditTitleB} placeholder="Variant B title" />
                        <TextInput
                          style={[styles.input, { minHeight: 64 }]}
                          value={editMessageB}
                          onChangeText={setEditMessageB}
                          placeholder="Variant B message"
                          multiline
                        />
                      </>
                    ) : null}
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.primary} disabled={busy} onPress={() => saveEdit(campaign)}>
                        <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Save'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.secondary} disabled={busy} onPress={() => setEditingId(null)}>
                        <Text style={styles.secondaryText}>Close</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
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
  note: {
    backgroundColor: '#FFFBEB',
    color: '#92400E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  empty: { color: '#64748B', textAlign: 'center', marginTop: 24 },
  error: { color: '#B91C1C', fontSize: 12, marginTop: 6 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tab: { borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tabOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  tabTextOn: { color: '#fff' },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 8, marginBottom: 8 },
  link: { color: COLORS.primary, fontWeight: '700', fontSize: 12, marginTop: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  badge: { fontSize: 10, fontWeight: '800', color: '#047857', backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  meta: { fontSize: 12, color: '#64748B', marginTop: 4 },
  message: { fontSize: 13, color: '#334155', marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' },
  primary: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  secondary: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  secondaryText: { color: '#334155', fontWeight: '700', fontSize: 13 },
  cancelText: { color: '#B91C1C', fontWeight: '700', fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    color: '#0F172A',
    backgroundColor: '#fff',
  },
});
