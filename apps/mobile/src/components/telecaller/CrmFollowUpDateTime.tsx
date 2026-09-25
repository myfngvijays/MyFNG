import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '../Icon';
import { COLORS } from '../../constants/theme';
import { istWeekday, istYmd } from '../../lib/crmDateRange';

const MINUTE_STEPS = [0, 10, 20, 30, 40, 50] as const;
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYmd(ymd: string): Date | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function snapTimeToTenMinutes(hm: string): string {
  if (!hm) return '';
  const [hStr, mStr] = hm.split(':');
  let h = Number(hStr);
  let m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  m = Math.round(m / 10) * 10;
  if (m === 60) {
    m = 0;
    h = (h + 1) % 24;
  }
  return `${pad(h)}:${pad(m)}`;
}

function formatDisplayDate(ymd: string): string {
  const d = parseYmd(ymd);
  if (!d) return 'Select date';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDisplayTime(hm: string): string {
  const snapped = snapTimeToTenMinutes(hm);
  if (!snapped) return 'Select time';
  const [hStr, mStr] = snapped.split(':');
  let h = Number(hStr);
  const m = Number(mStr);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${pad(m)} ${ampm}`;
}

function monthTitle(d: Date) {
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function chunkWeeks<T>(cells: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function buildMonthCells(month: Date): Array<Date | null> {
  const year = month.getFullYear();
  const month0 = month.getMonth();
  const firstDow = istWeekday(year, month0, 1);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month0, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function timeSlots() {
  const out: Array<{ value: string; label: string }> = [];
  for (let h = 8; h <= 22; h += 1) {
    for (const m of MINUTE_STEPS) {
      if (h === 22 && m > 0) break;
      const value = `${pad(h)}:${pad(m)}`;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      out.push({ value, label: `${h12}:${pad(m)} ${ampm}` });
    }
  }
  return out;
}

const TIME_SLOTS = timeSlots();

type Props = {
  date: string;
  time: string;
  onChange: (next: { date: string; time: string }) => void;
  required?: boolean;
};

export default function CrmFollowUpDateTime({ date, time, onChange, required }: Props) {
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => parseYmd(date) || parseYmd(istYmd()) || new Date());

  const cells = useMemo(() => buildMonthCells(monthCursor), [monthCursor]);
  const todayYmd = istYmd();
  const selectedTime = snapTimeToTenMinutes(time);

  useEffect(() => {
    const d = parseYmd(date);
    if (d) setMonthCursor(d);
  }, [date]);

  return (
    <View>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.fieldBtn}
          onPress={() => {
            setMonthCursor(parseYmd(date) || parseYmd(istYmd()) || new Date());
            setShowDate(true);
          }}
        >
          <Icon name="calendar" size={16} color={COLORS.primary} />
          <Text style={[styles.fieldText, !date && styles.placeholder]}>{formatDisplayDate(date)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fieldBtn} onPress={() => setShowTime(true)}>
          <Icon name="clock-outline" size={16} color={COLORS.primary} />
          <Text style={[styles.fieldText, !time && styles.placeholder]}>{formatDisplayTime(time)}</Text>
        </TouchableOpacity>
      </View>
      {required ? (
        <Text style={styles.hint}>Follow-up ke liye date aur time dono select karo.</Text>
      ) : null}
      {date || time ? (
        <TouchableOpacity
          onPress={() => onChange({ date: '', time: '' })}
          style={styles.clearBtn}
        >
          <Text style={styles.clearText}>Clear date & time</Text>
        </TouchableOpacity>
      ) : null}

      <Modal
        visible={showDate}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowDate(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowDate(false)} />
          <View style={styles.sheet} pointerEvents="auto" collapsable={false}>
            <Text style={styles.title}>Select date</Text>
            <View style={styles.monthNav}>
              <TouchableOpacity
                onPress={() =>
                  setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
                style={styles.navBtn}
              >
                <Icon name="chevron-left" size={22} color={COLORS.primary} />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{monthTitle(monthCursor)}</Text>
              <TouchableOpacity
                onPress={() =>
                  setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
                style={styles.navBtn}
              >
                <Icon name="chevron-right" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.weekRow}>
              {WEEKDAYS.map((d) => (
                <Text key={d} style={styles.weekday}>
                  {d}
                </Text>
              ))}
            </View>
            {chunkWeeks(cells).map((week, wi) => (
              <View key={`w-${wi}`} style={styles.weekRow}>
                {week.map((cell, idx) => {
                  if (!cell) return <View key={`e-${wi}-${idx}`} style={styles.dayCell} />;
                  const value = toYmd(cell);
                  const selected = date === value;
                  const isToday = value === todayYmd;
                  const isPast = value < todayYmd;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.dayCell,
                        selected && styles.daySelected,
                        isToday && !selected && styles.dayToday,
                        isPast && !selected && styles.dayPast,
                      ]}
                      onPress={() => {
                        onChange({ date: value, time });
                        setShowDate(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          selected && styles.dayTextSelected,
                          isToday && !selected && styles.dayTextToday,
                          isPast && !selected && styles.dayTextPast,
                        ]}
                      >
                        {cell.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <TouchableOpacity
              style={styles.todayLink}
              onPress={() => {
                onChange({ date: todayYmd, time });
                setShowDate(false);
              }}
            >
              <Text style={styles.clearText}>Today (IST)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTime}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowTime(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowTime(false)} />
          <View style={styles.sheet} pointerEvents="auto" collapsable={false}>
            <Text style={styles.title}>Select time (IST)</Text>
            <Text style={styles.sub}>Tap a slot · every 10 minutes · 8:00 AM – 10:00 PM</Text>
            <ScrollView style={styles.slotList} keyboardShouldPersistTaps="handled">
              <View style={styles.slotGrid}>
                {TIME_SLOTS.map((slot) => {
                  const active = selectedTime === slot.value;
                  return (
                    <View key={slot.value} style={styles.slotCell}>
                      <TouchableOpacity
                        style={[styles.slotChip, active && styles.slotChipActive]}
                        onPress={() => {
                          onChange({ date: date || todayYmd, time: slot.value });
                          setShowTime(false);
                        }}
                      >
                        <Text style={[styles.slotText, active && styles.slotTextActive]} numberOfLines={1}>
                          {slot.label}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  fieldBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  fieldText: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  placeholder: { color: COLORS.textSecondary, fontWeight: '500' },
  hint: { color: COLORS.textSecondary, fontSize: 11, marginBottom: 8 },
  clearBtn: { marginBottom: 8 },
  clearText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  sub: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 12 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navBtn: { padding: 6 },
  monthTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  dayCell: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: COLORS.primary, borderRadius: 20 },
  dayToday: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 20 },
  dayPast: { opacity: 0.85 },
  dayText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  dayTextSelected: { color: '#fff' },
  dayTextToday: { color: COLORS.primary },
  dayTextPast: { color: '#94A3B8' },
  todayLink: { alignSelf: 'center', marginTop: 10 },
  slotList: { maxHeight: 380 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 8 },
  slotCell: { width: '25%', paddingHorizontal: 5, paddingVertical: 5 },
  slotChip: {
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  slotText: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  slotTextActive: { color: '#fff' },
});
