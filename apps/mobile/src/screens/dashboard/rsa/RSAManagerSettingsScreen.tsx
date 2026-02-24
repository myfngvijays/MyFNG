import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';

const PREF_KEY = 'rsa_manager_settings_v1';

export default function RSAManagerSettingsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string>('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notifyNew, setNotifyNew] = useState(true);
  const [notifyStatus, setNotifyStatus] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(false);
  const [compactCards, setCompactCards] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { data } = await supabase
          .from('users_login')
          .select('id, full_name, phone, email')
          .eq('id', user.id)
          .single();
        setProfileId(String(data?.id || user.id));
        setName(String(data?.full_name || ''));
        setPhone(String(data?.phone || ''));
        setEmail(String(data?.email || user.email || ''));
      }

      const raw = await AsyncStorage.getItem(PREF_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setNotifyNew(Boolean(parsed.notifyNew));
        setNotifyStatus(Boolean(parsed.notifyStatus));
        setSoundAlerts(Boolean(parsed.soundAlerts));
        setCompactCards(Boolean(parsed.compactCards));
      }
    } catch (e) {
      console.error('rsa settings load failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      if (profileId) {
        await supabase.from('users_login').update({ full_name: name, phone }).eq('id', profileId);
      }
      await AsyncStorage.setItem(PREF_KEY, JSON.stringify({ notifyNew, notifyStatus, soundAlerts, compactCards }));
    } catch (e) {
      console.error('rsa settings save failed', e);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (typeof navigation?.canGoBack === 'function' && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (typeof navigation?.goBack === 'function') {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.('RSAManagerDashboard');
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="RSA Settings" onBack={handleBack} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <TextInput style={[styles.input, styles.disabled]} editable={false} value={email} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <SwitchRow label="New complaint alerts" value={notifyNew} onValueChange={setNotifyNew} />
            <SwitchRow label="Status update alerts" value={notifyStatus} onValueChange={setNotifyStatus} />
            <SwitchRow label="Sound alerts" value={soundAlerts} onValueChange={setSoundAlerts} />
            <SwitchRow label="Compact cards" value={compactCards} onValueChange={setCompactCards} />
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={save} disabled={saving}>
            <Text style={styles.primaryBtnText}>{saving ? 'Saving...' : 'Save Settings'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

function SwitchRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.rowText}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
  card: { backgroundColor: COLORS.white, borderRadius: 10, padding: SPACING.sm, gap: SPACING.xs },
  sectionTitle: { fontSize: SIZES.sm, color: COLORS.textHeading, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: SPACING.sm, backgroundColor: COLORS.white },
  disabled: { backgroundColor: COLORS.gray[100], color: COLORS.textSecondary },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.xs, marginTop: SPACING.xs },
  rowText: { fontSize: SIZES.sm, color: COLORS.textHeading },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: SPACING.md, alignItems: 'center' },
  primaryBtnText: { color: COLORS.white, fontSize: SIZES.sm, fontWeight: '700' },
});
