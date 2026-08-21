import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

type WaTemplate = {
  template_name: string;
  display_name?: string | null;
  body?: string | null;
  body_text?: string | null;
  language?: string | null;
  is_active?: boolean;
};

function humanize(name: string): string {
  return String(name || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CrmWhatsAppTemplatesScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ templates?: WaTemplate[] }>('/api/whatsapp/templates');
      const list = Array.isArray(data?.templates) ? data.templates : [];
      setTemplates(
        list.filter((t) => t?.is_active !== false && String(t?.template_name || '').trim()),
      );
    } catch (e: any) {
      Alert.alert('Templates', e?.message || 'Failed to load WhatsApp templates');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      const title = String(t.display_name || t.template_name || '').toLowerCase();
      const body = String(t.body || t.body_text || '').toLowerCase();
      return title.includes(q) || body.includes(q) || t.template_name.toLowerCase().includes(q);
    });
  }, [templates, search]);

  const copyBody = async (row: WaTemplate) => {
    const body = String(row.body || row.body_text || '').trim();
    if (!body) {
      Alert.alert('Copy', 'No body text on this template — use it from WhatsApp chat send.');
      return;
    }
    await Clipboard.setStringAsync(body);
    Alert.alert('Copied', humanize(row.display_name || row.template_name));
  };

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
          WhatsApp templates
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search templates…"
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.template_name}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No WhatsApp templates available.</Text>
          }
          renderItem={({ item }) => {
            const title = String(item.display_name || '').trim() || humanize(item.template_name);
            const body = String(item.body || item.body_text || '').trim();
            const open = expanded === item.template_name;
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.75}
                onPress={() =>
                  setExpanded(open ? null : item.template_name)
                }
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {title}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {item.template_name}
                      {item.language ? ` · ${item.language}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => void copyBody(item)}
                    hitSlop={8}
                  >
                    <Ionicons name="copy-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.copyText}>Copy</Text>
                  </TouchableOpacity>
                </View>
                {open && body ? (
                  <Text style={styles.body}>{body}</Text>
                ) : open ? (
                  <Text style={styles.bodyMuted}>
                    Preview not available — open WhatsApp chat to send this template.
                  </Text>
                ) : body ? (
                  <Text style={styles.preview} numberOfLines={2}>
                    {body}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
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
    color: COLORS.textHeading,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textHeading, padding: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: SPACING.md, paddingBottom: 40, gap: 10 },
  empty: { textAlign: 'center', color: '#64748B', marginTop: 40, fontSize: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#023D95' },
  cardMeta: { fontSize: 11, color: '#94A3B8', marginTop: 3 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
  },
  copyText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  preview: { marginTop: 8, fontSize: 13, color: '#64748B', lineHeight: 18 },
  body: { marginTop: 10, fontSize: 13, color: '#334155', lineHeight: 20 },
  bodyMuted: { marginTop: 10, fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
});
