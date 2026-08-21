import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiFetch } from '../../lib/api';
import { filterTagsForTelecaller } from '../../lib/telecallerLeadTags';

type TagRow = { id: string; name: string; color?: string };

type Props = {
  leadId?: string | null;
  canManage?: boolean;
  /** When no leadId yet (Add Lead), parent keeps selection and applies on save. */
  onSelectionChange?: (tagIds: string[]) => void;
};

/**
 * TeleCRM-style lead tags for mobile CRM (apply existing; managers can create).
 */
export default function LeadTagsPicker({
  leadId,
  canManage = false,
  onSelectionChange,
}: Props) {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const hasLead = Boolean(leadId && String(leadId).trim());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const path = hasLead
        ? `/api/lead-manager/tags?lead_id=${encodeURIComponent(String(leadId))}`
        : '/api/lead-manager/tags';
      const json = await apiFetch<any>(path);
      const allTags: TagRow[] = Array.isArray(json?.tags) ? json.tags : [];
      setTags(canManage ? allTags : filterTagsForTelecaller(allTags));
      if (hasLead) {
        setSelected(
          new Set(
            Array.isArray(json?.lead_tag_ids) ? json.lead_tag_ids.map(String) : [],
          ),
        );
      }
    } catch {
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [hasLead, leadId, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (next: Set<string>) => {
    if (!hasLead) return;
    setSaving(true);
    try {
      await apiFetch('/api/lead-manager/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_lead_tags',
          lead_id: leadId,
          tag_ids: Array.from(next),
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      void persist(next);
      onSelectionChange?.(Array.from(next));
      return next;
    });
  };

  const createTag = async () => {
    if (!canManage || !newName.trim()) return;
    setSaving(true);
    try {
      const json = await apiFetch<any>('/api/lead-manager/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_tag', name: newName.trim() }),
      });
      const createdId = String(json?.tag?.id || '');
      setNewName('');
      await load();
      if (createdId) {
        setSelected((prev) => {
          const next = new Set(prev);
          next.add(createdId);
          void persist(next);
          onSelectionChange?.(Array.from(next));
          return next;
        });
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const selectedTags = useMemo(
    () => tags.filter((t) => selected.has(t.id)),
    [tags, selected],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tags.filter((t) => !q || t.name.toLowerCase().includes(q));
  }, [tags, query]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Lead tags</Text>
        {saving ? <ActivityIndicator size="small" color="#004AAD" /> : null}
      </View>
      <Text style={styles.hint}>Google / Meta / WhatsApp reference tags</Text>

      <View style={styles.pills}>
        {selectedTags.length === 0 ? (
          <Text style={styles.empty}>No tags selected</Text>
        ) : (
          selectedTags.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => toggle(t.id)}
              style={[styles.pill, { backgroundColor: t.color || '#E2E8F0' }]}
            >
              <Text style={styles.pillText}>{t.name} ×</Text>
            </Pressable>
          ))
        )}
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search tags…"
        placeholderTextColor="#94A3B8"
        value={query}
        onChangeText={setQuery}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 8 }} color="#004AAD" />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listRow}
        >
          {filtered.map((t) => {
            const on = selected.has(t.id);
            return (
              <Pressable
                key={t.id}
                onPress={() => toggle(t.id)}
                style={[
                  styles.choice,
                  on && styles.choiceOn,
                  { borderColor: t.color || '#CBD5E1' },
                ]}
              >
                <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{t.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {canManage ? (
        <View style={styles.createRow}>
          <TextInput
            style={[styles.search, { flex: 1, marginBottom: 0 }]}
            placeholder="Create new tag…"
            placeholderTextColor="#94A3B8"
            value={newName}
            onChangeText={setNewName}
          />
          <Pressable
            style={[styles.addBtn, (!newName.trim() || saving) && { opacity: 0.5 }]}
            disabled={!newName.trim() || saving}
            onPress={() => void createTag()}
          >
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  hint: { fontSize: 11, color: '#94A3B8', marginTop: 2, marginBottom: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 28, marginBottom: 8 },
  empty: { fontSize: 12, color: '#94A3B8' },
  pill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700', color: '#1E293B' },
  search: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  listRow: { gap: 8, paddingVertical: 4 },
  choice: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  choiceOn: { backgroundColor: '#004AAD' },
  choiceText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  choiceTextOn: { color: '#fff' },
  createRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  addBtn: {
    backgroundColor: '#004AAD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
