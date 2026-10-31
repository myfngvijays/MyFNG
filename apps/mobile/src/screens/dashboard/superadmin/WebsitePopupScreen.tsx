import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

type PopupConfig = {
  enabled: boolean;
  starts_at: string;
  ends_at: string;
  headline: string;
  subtitle: string;
  coupon_code: string;
  offer_label: string;
  badge_text: string;
  button_text: string;
  button_href: string;
  image_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  max_views: number;
};

const FIELDS: Array<{ key: keyof PopupConfig; label: string }> = [
  { key: 'headline', label: 'Headline' },
  { key: 'subtitle', label: 'Line under headline' },
  { key: 'coupon_code', label: 'Coupon code' },
  { key: 'offer_label', label: 'Offer label' },
  { key: 'badge_text', label: 'Badge' },
  { key: 'button_text', label: 'Button text' },
  { key: 'button_href', label: 'Button page' },
  { key: 'image_url', label: 'Banner image' },
  { key: 'starts_at', label: 'Start (YYYY-MM-DDTHH:mm)' },
  { key: 'ends_at', label: 'Expiry (YYYY-MM-DDTHH:mm)' },
  { key: 'utm_source', label: 'UTM source' },
  { key: 'utm_medium', label: 'UTM medium' },
  { key: 'utm_campaign', label: 'UTM campaign' },
  { key: 'max_views', label: 'Show times per browser' },
];

export default function WebsitePopupScreen({ navigation }: any) {
  const [config, setConfig] = useState<PopupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiFetch<any>('/api/super_admin/website-popup');
      setConfig(json?.config || null);
    } catch (error: any) {
      Alert.alert('Website popup', error?.message || 'Could not load popup');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const json = await apiFetch<any>('/api/super_admin/website-popup', {
        method: 'PATCH',
        body: JSON.stringify({ config }),
      });
      setConfig(json?.config || config);
      Alert.alert('Website popup', 'Saved');
    } catch (error: any) {
      Alert.alert('Website popup', error?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <DashboardHeader title="Website Popup" onBack={() => navigation?.goBack?.()} />
      {loading || !config ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.row}>
            <Text style={styles.label}>Popup on</Text>
            <Switch value={config.enabled} onValueChange={(enabled) => setConfig({ ...config, enabled })} />
          </View>
          {FIELDS.map((field) => (
            <View key={field.key} style={styles.field}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                value={String(config[field.key] ?? '')}
                onChangeText={(value) =>
                  setConfig({
                    ...config,
                    [field.key]: field.key === 'max_views' ? Number(value.replace(/\D/g, '') || 0) : value,
                  })
                }
                style={styles.input}
                autoCapitalize={field.key === 'coupon_code' ? 'characters' : 'sentences'}
              />
            </View>
          ))}
          <TouchableOpacity style={styles.save} onPress={save} disabled={saving}>
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  body: { padding: SPACING.md, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  save: { marginTop: 8, backgroundColor: '#6B1224', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: '#FFE14A', fontWeight: '800', fontSize: 16 },
});
