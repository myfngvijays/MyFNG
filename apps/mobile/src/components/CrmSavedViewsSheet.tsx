import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../lib/api';
import { COLORS, SPACING } from '../constants/theme';

export type MobileSavedViewFilters = {
  source?: string;
  status?: string;
  coupon?: string;
  recording?: string;
  assignees?: string[];
  search?: string;
  datePreset?: string;
  customStart?: string;
  customEnd?: string;
  tagIds?: string[];
  tagMode?: 'any' | 'all';
  messageTriggers?: string[];
};

export type SavedViewRow = {
  id: string;
  name: string;
  owner_id: string;
  is_shared: boolean;
  filters: MobileSavedViewFilters;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  currentFilters: MobileSavedViewFilters;
  onApply: (filters: MobileSavedViewFilters, name: string) => void;
};

export default function CrmSavedViewsSheet({ visible, onClose, currentFilters, onApply }: Props) {
  const [views, setViews] = useState<SavedViewRow[]>([]);
  const [me, setMe] = useState('');
  const [canShare, setCanShare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [share, setShare] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiFetch<any>('/api/lead-manager/saved-views');
      setViews(Array.isArray(json?.views) ? json.views : []);
      setMe(String(json?.me || ''));
      setCanShare(Boolean(json?.can_share));
    } catch (e: any) {
      Alert.alert('Saved views', e?.message || 'Could not load views');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const saveCurrent = async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Saved views', 'Enter a view name first');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/lead-manager/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          filters: currentFilters,
          is_shared: canShare && share,
        }),
      });
      setNewName('');
      await load();
      Alert.alert('Saved', `View “${name}” is ready.`);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not save view');
    } finally {
      setSaving(false);
    }
  };

  const remove = (view: SavedViewRow) => {
    Alert.alert('Delete view', `Delete “${view.name}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/lead-manager/saved-views?id=${encodeURIComponent(view.id)}`, {
              method: 'DELETE',
            });
            await load();
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Could not delete');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Saved views</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.iconBtn}>
              <Ionicons name="close" size={22} color="#334155" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                onApply({}, 'All Leads');
                onClose();
              }}
            >
              <Ionicons name="funnel-outline" size={18} color={COLORS.primary} />
              <Text style={styles.rowText}>All Leads</Text>
            </TouchableOpacity>

            {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} /> : null}

            {views.map((view) => (
              <View key={view.id} style={styles.rowWrap}>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    onApply(view.filters || {}, view.name);
                    onClose();
                  }}
                >
                  <Ionicons name="funnel-outline" size={18} color="#6366F1" />
                  <Text style={styles.rowText} numberOfLines={1}>
                    {view.name}
                  </Text>
                  {view.is_shared ? <Ionicons name="share-outline" size={14} color="#818CF8" /> : null}
                </TouchableOpacity>
                {me && view.owner_id === me ? (
                  <TouchableOpacity onPress={() => remove(view)} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={18} color="#E11D48" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}

            <View style={styles.saveBox}>
              <Text style={styles.saveLabel}>Save current filters</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. Aug active leads"
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />
              {canShare ? (
                <View style={styles.shareRow}>
                  <Text style={styles.shareLbl}>Share with team</Text>
                  <Switch value={share} onValueChange={setShare} />
                </View>
              ) : null}
              <TouchableOpacity style={styles.saveBtn} onPress={() => void saveCurrent()} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>Save view</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '86%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  title: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  rowWrap: { flexDirection: 'row', alignItems: 'center' },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1E293B' },
  saveBox: {
    margin: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    gap: 10,
  },
  saveLabel: { fontSize: 12, fontWeight: '800', color: '#4338CA', textTransform: 'uppercase' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
  },
  shareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shareLbl: { fontSize: 13, fontWeight: '600', color: '#334155' },
  saveBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '800' },
});
