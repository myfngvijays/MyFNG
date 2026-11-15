import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { apiFetch } from '../../lib/api';
import { leadStatusCardColors } from '../../lib/telecaller/leadStatusColors';
import {
  ADMIN_CRM_LOST_REASONS,
  ADMIN_CRM_STATUS_OPTIONS,
  adminCrmStatusLabel,
  resolveAdminCrmStatusId,
} from '../../lib/telecaller/adminCrmStatus';

export default function AdminCrmStatusPicker({
  lead,
  updating,
  onChange,
}: {
  lead: any;
  updating?: boolean;
  onChange: (statusId: string, lostReason?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherItems, setOtherItems] = useState<string[]>([]);
  const [otherDraft, setOtherDraft] = useState('');
  const value = resolveAdminCrmStatusId(lead);
  const label = adminCrmStatusLabel(lead);
  const tint = leadStatusCardColors(label);

  const openOther = async () => {
    setOtherOpen(true);
    try {
      const data = await apiFetch<any>('/api/lead-manager/statuses');
      const names = (Array.isArray(data?.other_reasons) ? data.other_reasons : [])
        .map((r: { name?: string }) => String(r?.name || '').trim())
        .filter(Boolean);
      setOtherItems(names);
    } catch {
      setOtherItems([]);
    }
  };

  const pickStatus = (statusId: string) => {
    setOpen(false);
    if (statusId === value && statusId !== 'LOST' && statusId !== 'OTHER') return;
    if (statusId === 'LOST') {
      setLostOpen(true);
      return;
    }
    if (statusId === 'OTHER') {
      void openOther();
      return;
    }
    onChange(statusId);
  };

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.btn,
          { backgroundColor: tint.badgeBg, borderColor: tint.border },
        ]}
        onPress={() => setOpen(true)}
        disabled={updating}
        activeOpacity={0.8}
      >
        {updating ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <>
            <Text style={[styles.btnTxt, { color: tint.badgeText }]} numberOfLines={1}>
              {label}
            </Text>
            <Ionicons name="chevron-down" size={14} color={tint.badgeText} />
          </>
        )}
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Lead status</Text>
            <ScrollView style={styles.sheetList}>
              {ADMIN_CRM_STATUS_OPTIONS.map((opt) => {
                const on = opt.id === value;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.opt, on && styles.optOn]}
                    onPress={() => pickStatus(opt.id)}
                  >
                    <Text style={[styles.optTxt, on && styles.optTxtOn]}>{opt.label}</Text>
                    {on ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={lostOpen} transparent animationType="fade" onRequestClose={() => setLostOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLostOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Lost reason</Text>
            <ScrollView style={styles.sheetList}>
              {ADMIN_CRM_LOST_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={styles.opt}
                  onPress={() => {
                    setLostOpen(false);
                    onChange('LOST', reason);
                  }}
                >
                  <Text style={styles.optTxt}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={otherOpen} transparent animationType="fade" onRequestClose={() => setOtherOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOtherOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Other</Text>
            <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={styles.opt}
                onPress={() => {
                  setOtherOpen(false);
                  onChange('OTHER');
                }}
              >
                <Text style={styles.optTxt}>Other only</Text>
              </TouchableOpacity>
              {otherItems.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={styles.opt}
                  onPress={() => {
                    setOtherOpen(false);
                    onChange('OTHER', reason);
                  }}
                >
                  <Text style={styles.optTxt}>{reason}</Text>
                </TouchableOpacity>
              ))}
              {otherItems.length === 0 ? (
                <Text style={styles.empty}>Abhi koi other item nahi.</Text>
              ) : null}
            </ScrollView>
            <View style={styles.addRow}>
              <TextInput
                value={otherDraft}
                onChangeText={setOtherDraft}
                placeholder="Naya item"
                placeholderTextColor="#94A3B8"
                style={styles.addInput}
              />
              <TouchableOpacity
                style={styles.addBtn}
                onPress={async () => {
                  const name = otherDraft.trim();
                  if (!name) return;
                  try {
                    const json = await apiFetch<any>('/api/lead-manager/statuses', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'create_other_reason', name }),
                    });
                    const saved = String(json?.reason?.name || name);
                    setOtherItems((prev) =>
                      prev.some((n) => n.toLowerCase() === saved.toLowerCase()) ? prev : [...prev, saved],
                    );
                    setOtherDraft('');
                    setOtherOpen(false);
                    onChange('OTHER', saved);
                  } catch (e: any) {
                    Alert.alert('Other', e?.message || 'Could not add');
                  }
                }}
              >
                <Text style={styles.addBtnTxt}>Add</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 180,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  btnTxt: { flex: 1, fontSize: 11, fontWeight: '700', color: '#1E293B' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  sheetList: { maxHeight: 360 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  optOn: {},
  optTxt: { fontSize: 15, fontWeight: '600', color: '#334155' },
  optTxtOn: { color: COLORS.primary, fontWeight: '800' },
  empty: { color: '#64748B', fontSize: 13, paddingVertical: 10 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  addBtnTxt: { color: '#fff', fontWeight: '800' },
});
