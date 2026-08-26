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
  Switch,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';
import { formatDateTime } from '@/lib/dateFormat';

function Shell({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
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
        {right || <View style={{ width: 40 }} />}
      </View>
      {children}
    </SafeAreaView>
  );
}

function NumField({
  label,
  hint,
  value,
  onChange,
  suffix,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLbl}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <View style={styles.numWrap}>
        <TextInput
          style={styles.numInput}
          keyboardType="numeric"
          value={String(value ?? 0)}
          onChangeText={(t) => onChange(Number(t.replace(/[^0-9.]/g, '')) || 0)}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function SuperAdminWalletLogicScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'global' | 'android' | 'ios'>('global');
  const [settings, setSettings] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/super_admin/wallet-logic');
      setSettings(data?.settings || null);
    } catch (e: any) {
      Alert.alert('Wallet Logic', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rules =
    tab === 'global'
      ? settings?.global
      : tab === 'android'
        ? settings?.android?.rules
        : settings?.ios?.rules;

  const patchRule = (key: string, value: any) => {
    setSettings((prev: any) => {
      if (!prev) return prev;
      if (tab === 'global') return { ...prev, global: { ...prev.global, [key]: value } };
      return {
        ...prev,
        [tab]: { ...prev[tab], rules: { ...(prev[tab]?.rules || {}), [key]: value } },
      };
    });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await apiFetch('/api/super_admin/wallet-logic', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      Alert.alert('Saved', 'Wallet logic updated');
      await load();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell
      title="Wallet Logic"
      right={
        <TouchableOpacity style={styles.saveTop} onPress={() => void save()} disabled={saving || !settings}>
          <Text style={styles.saveTopTxt}>{saving ? '…' : 'Save'}</Text>
        </TouchableOpacity>
      }
    >
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : !settings ? (
        <Text style={styles.empty}>Could not load wallet settings.</Text>
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
          <Text style={styles.intro}>Same rules as web admin — welcome bonus, cashback and how much wallet a customer can use.</Text>
          <View style={styles.tabs}>
            {(['global', 'android', 'ios'] as const).map((id) => (
              <TouchableOpacity key={id} style={[styles.tab, tab === id && styles.tabOn]} onPress={() => setTab(id)}>
                <Text style={[styles.tabTxt, tab === id && styles.tabTxtOn]}>
                  {id === 'global' ? 'Default / Web' : id === 'android' ? 'Android' : 'iOS'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab !== 'global' ? (
            <View style={styles.card}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Use default rules</Text>
                  <Text style={styles.hint}>Off = this platform has its own numbers</Text>
                </View>
                <Switch
                  value={settings[tab]?.use_global !== false}
                  onValueChange={(v) =>
                    setSettings((prev: any) => ({ ...prev, [tab]: { ...prev[tab], use_global: v } }))
                  }
                />
              </View>
            </View>
          ) : null}

          {rules ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Service booking — max wallet</Text>
                <View style={styles.modeRow}>
                  {(['PERCENT', 'AMOUNT'] as const).map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.modeBtn, rules.service_usage_mode === mode && styles.modeOn]}
                      onPress={() => patchRule('service_usage_mode', mode)}
                    >
                      <Text style={[styles.modeTxt, rules.service_usage_mode === mode && styles.modeTxtOn]}>
                        {mode === 'PERCENT' ? 'Percentage' : 'Fixed ₹'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {rules.service_usage_mode === 'AMOUNT' ? (
                  <NumField label="Max wallet (₹)" value={rules.service_usage_amount} onChange={(n) => patchRule('service_usage_amount', n)} suffix="₹" />
                ) : (
                  <NumField label="Max wallet" hint="Kitna wallet service bill par use ho sakta hai" value={rules.service_usage_percent} onChange={(n) => patchRule('service_usage_percent', n)} suffix="%" />
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Membership — max wallet</Text>
                <View style={styles.modeRow}>
                  {(['PERCENT', 'AMOUNT'] as const).map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.modeBtn, rules.membership_usage_mode === mode && styles.modeOn]}
                      onPress={() => patchRule('membership_usage_mode', mode)}
                    >
                      <Text style={[styles.modeTxt, rules.membership_usage_mode === mode && styles.modeTxtOn]}>
                        {mode === 'PERCENT' ? 'Percentage' : 'Fixed ₹'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {rules.membership_usage_mode === 'AMOUNT' ? (
                  <NumField label="Max wallet (₹)" value={rules.membership_usage_amount} onChange={(n) => patchRule('membership_usage_amount', n)} suffix="₹" />
                ) : (
                  <NumField label="Max wallet" value={rules.membership_usage_percent} onChange={(n) => patchRule('membership_usage_percent', n)} suffix="%" />
                )}
              </View>

              <View style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Welcome bonus</Text>
                    <Text style={styles.hint}>Login par naye users ko wallet credit</Text>
                  </View>
                  <Switch
                    value={rules.welcome_bonus_enabled !== false}
                    onValueChange={(v) => patchRule('welcome_bonus_enabled', v)}
                  />
                </View>
                <NumField label="Welcome bonus amount" value={rules.welcome_bonus_amount} onChange={(n) => patchRule('welcome_bonus_amount', n)} suffix="₹" />
                <NumField label="Welcome bonus expiry" hint="Unused bonus kitne din baad expire" value={rules.welcome_expiry_days} onChange={(n) => patchRule('welcome_expiry_days', n)} suffix="days" />
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Prime cashback</Text>
                <NumField label="Cashback rate" hint="Paid service bill par cashback %" value={rules.membership_cashback_rate_percent} onChange={(n) => patchRule('membership_cashback_rate_percent', n)} suffix="%" />
                <NumField label="Max cashback per bill" value={rules.membership_cashback_max} onChange={(n) => patchRule('membership_cashback_max', n)} suffix="₹" />
              </View>
            </>
          ) : null}

          {tab === 'global' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Referral rewards</Text>
              <NumField label="First referral reward" value={settings.referral_first_reward} onChange={(n) => setSettings((p: any) => ({ ...p, referral_first_reward: n }))} suffix="₹" />
              <NumField label="Repeat referral reward" value={settings.referral_repeat_reward} onChange={(n) => setSettings((p: any) => ({ ...p, referral_repeat_reward: n }))} suffix="₹" />
              <NumField label="Friend bonus" value={settings.referral_friend_bonus} onChange={(n) => setSettings((p: any) => ({ ...p, referral_friend_bonus: n }))} suffix="₹" />
            </View>
          ) : null}

          <TouchableOpacity style={styles.saveBtn} onPress={() => void save()} disabled={saving}>
            <Text style={styles.saveBtnTxt}>{saving ? 'Saving…' : 'Save wallet logic'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </Shell>
  );
}

export function SuperAdminWalletHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);

  const load = useCallback(async (search = '') => {
    try {
      const params = new URLSearchParams({ limit: '150' });
      if (search.trim()) params.set('q', search.trim());
      const data = await apiFetch<any>(`/api/super_admin/wallet/credits/history?${params}`);
      setRows(Array.isArray(data?.transactions) ? data.transactions : []);
      setBatches(Array.isArray(data?.bulk_batches) ? data.bulk_batches : []);
    } catch (e: any) {
      Alert.alert('Wallet history', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const inr = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
  const phone = (v: any) => {
    const d = String(v || '').replace(/\D/g, '');
    return d.length > 10 ? d.slice(-10) : d || '—';
  };

  return (
    <Shell title="Wallet Credit History">
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Search phone, name, campaign…"
          placeholderTextColor="#94A3B8"
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => void load(q)}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => void load(q)}>
          <Ionicons name="search" size={18} color="#fff" />
        </TouchableOpacity>
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
                void load(q);
              }}
            />
          }
        >
          {batches.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Bulk batches</Text>
              {batches.map((b) => (
                <View key={b.batch_id} style={styles.batchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{b.campaign_label || 'Bulk'}</Text>
                    <Text style={styles.hint}>
                      {b.user_count} users · {formatDateTime(b.created_at)}
                    </Text>
                  </View>
                  <Text style={styles.amountPos}>{inr(b.total_amount)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {rows.length === 0 ? (
            <Text style={styles.empty}>No wallet credits yet.</Text>
          ) : (
            rows.map((row) => {
              const debit = String(row.source || '').includes('DEBIT') || Number(row.amount) < 0;
              return (
                <View key={row.id} style={styles.card}>
                  <View style={styles.switchRow}>
                    <Text style={styles.rowTitle}>{row.customer_name || row.label || 'Wallet entry'}</Text>
                    <Text style={debit ? styles.amountNeg : styles.amountPos}>{inr(row.amount)}</Text>
                  </View>
                  <Text style={styles.hint}>{phone(row.phone)}</Text>
                  <Text style={styles.hint}>
                    {row.label || row.source}
                    {row.campaign_label ? ` · ${row.campaign_label}` : ''}
                  </Text>
                  <Text style={styles.hint}>
                    Balance after {inr(row.balance_after)} · {formatDateTime(row.created_at)}
                  </Text>
                </View>
              );
            })
          )}
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
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: COLORS.primary },
  saveTop: { paddingHorizontal: 10, paddingVertical: 6 },
  saveTopTxt: { color: COLORS.primary, fontWeight: '800' },
  body: { padding: SPACING.md, paddingBottom: 40 },
  intro: { fontSize: 13, color: '#64748B', marginBottom: 12, lineHeight: 18 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { flex: 1, borderRadius: 10, paddingVertical: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  tabOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabTxt: { fontSize: 12, fontWeight: '800', color: '#475569' },
  tabTxtOn: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  hint: { fontSize: 12, color: '#64748B', marginTop: 3 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: { marginTop: 10 },
  fieldLbl: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  fieldHint: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  numWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 6, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10 },
  numInput: { flex: 1, height: 42, color: '#0F172A', fontWeight: '700' },
  suffix: { color: '#64748B', fontWeight: '800' },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  modeBtn: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 8, alignItems: 'center' },
  modeOn: { backgroundColor: '#4C1D95', borderColor: '#4C1D95' },
  modeTxt: { fontSize: 12, fontWeight: '800', color: '#475569' },
  modeTxtOn: { color: '#fff' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnTxt: { color: '#fff', fontWeight: '800' },
  empty: { textAlign: 'center', color: '#64748B', marginTop: 24 },
  searchRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  search: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, height: 42, color: '#0F172A' },
  searchBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  batchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', flex: 1 },
  amountPos: { fontSize: 15, fontWeight: '800', color: '#047857' },
  amountNeg: { fontSize: 15, fontWeight: '800', color: '#B91C1C' },
});
