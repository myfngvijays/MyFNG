import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
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
  const value = resolveAdminCrmStatusId(lead);
  const label = adminCrmStatusLabel(lead);
  const tint = leadStatusCardColors(label);

  const pickStatus = (statusId: string) => {
    setOpen(false);
    if (statusId === value && statusId !== 'LOST') return;
    if (statusId === 'LOST') {
      setLostOpen(true);
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
});
