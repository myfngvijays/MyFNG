import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  CRM_DATE_PRESETS,
  resolveCrmDateRange,
  type CrmDatePreset,
} from '../../lib/crmDateRange';
import { COLORS, SHADOWS } from '../../constants/theme';

function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fromYmd(ymd: string) {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

type Props = {
  preset: CrmDatePreset;
  customStart: string;
  customEnd: string;
  onPreset: (value: CrmDatePreset) => void;
  onCustomStart: (value: string) => void;
  onCustomEnd: (value: string) => void;
};

export default function WorkshopDateFilter({
  preset,
  customStart,
  customEnd,
  onPreset,
  onCustomStart,
  onCustomEnd,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<'start' | 'end' | null>(null);
  const range = resolveCrmDateRange(preset, customStart, customEnd);
  const dateLabel = CRM_DATE_PRESETS.find((p) => p.value === preset)?.label || range.label;

  const onNativeDate = (which: 'start' | 'end') => (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setPick(null);
    if (event.type === 'dismissed' || !date) return;
    const ymd = toYmd(date);
    if (which === 'start') onCustomStart(ymd);
    else onCustomEnd(ymd);
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.btn} onPress={() => setOpen((v) => !v)} activeOpacity={0.85}>
        <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
        <Text style={styles.btnText} numberOfLines={1}>
          {preset === 'custom' ? range.label : dateLabel}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {open ? (
        <View style={styles.menu}>
          {CRM_DATE_PRESETS.map((p) => (
            <TouchableOpacity
              key={p.value}
              style={[styles.item, preset === p.value && styles.itemOn]}
              onPress={() => {
                onPreset(p.value);
                if (p.value !== 'custom') setOpen(false);
              }}
            >
              <Text style={[styles.itemText, preset === p.value && styles.itemTextOn]}>{p.label}</Text>
              {preset === p.value ? <Ionicons name="checkmark" size={16} color={COLORS.primary} /> : null}
            </TouchableOpacity>
          ))}
          {preset === 'custom' ? (
            <View style={styles.customBox}>
              <View style={styles.customRow}>
                <TouchableOpacity style={styles.customChip} onPress={() => setPick('start')}>
                  <Text style={styles.customLbl}>From</Text>
                  <Text style={styles.customVal}>{customStart}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.customChip} onPress={() => setPick('end')}>
                  <Text style={styles.customLbl}>To</Text>
                  <Text style={styles.customVal}>{customEnd}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => {
                  onPreset('custom');
                  setOpen(false);
                }}
              >
                <Text style={styles.applyTxt}>Apply</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}

      {pick ? (
        <DateTimePicker
          value={fromYmd(pick === 'start' ? customStart : customEnd)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onNativeDate(pick)}
        />
      ) : null}
    </View>
  );
}

export function isoInRange(iso: string | null | undefined, startIso: string, endIso: string, allTime?: boolean) {
  if (allTime) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= new Date(startIso).getTime() && t <= new Date(endIso).getTime();
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10, zIndex: 8 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  btnText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  menu: {
    marginTop: 6,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[100],
  },
  itemOn: { backgroundColor: '#EFF6FF' },
  itemText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  itemTextOn: { color: COLORS.primary },
  customBox: { padding: 10, gap: 8, backgroundColor: '#F8FAFC' },
  customRow: { flexDirection: 'row', gap: 8 },
  customChip: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  customLbl: { fontSize: 10, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase' },
  customVal: { fontSize: 13, fontWeight: '800', color: '#023D95', marginTop: 2 },
  applyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  applyTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
