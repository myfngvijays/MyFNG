import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { COLORS, SHADOWS } from '../../constants/theme';

const TIME_SLOTS = Array.from({ length: 6 }, (_, i) => {
  const hour = 10 + i;
  const time24 = `${String(hour).padStart(2, '0')}:00`;
  const nextHour = hour + 1;
  const startH = hour === 12 ? 12 : hour > 12 ? hour - 12 : hour;
  const startSuffix = hour >= 12 ? 'PM' : 'AM';
  const endH = nextHour === 12 ? 12 : nextHour > 12 ? nextHour - 12 : nextHour;
  const endSuffix = nextHour >= 12 ? 'PM' : 'AM';
  return {
    value: time24,
    label: `${startH} ${startSuffix} - ${endH} ${endSuffix}`,
  };
});

const ADDR_TYPES = [
  { key: 'home' as const, label: 'Home', icon: 'home' as const },
  { key: 'work' as const, label: 'Work', icon: 'briefcase' as const },
  { key: 'other' as const, label: 'Other', icon: 'ellipsis-horizontal' as const },
];

function getIndiaDate(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 3600000);
}

function formatDateYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDMShort(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const dt = new Date(dateStr + 'T00:00:00');
    return `${dt.getDate()} ${dt.toLocaleString('en-US', { month: 'short' })}`;
  } catch {
    return dateStr;
  }
}

function parseYmdToDate(ymd: string): Date {
  if (!ymd) return getIndiaDate();
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return getIndiaDate();
  return new Date(y, m - 1, d);
}

function getIndiaNowMinutes(): number {
  const d = getIndiaDate();
  return d.getHours() * 60 + d.getMinutes();
}

function isTimeSlotPastForDate(slotValue: string, pickupDate: string, todayYmd: string): boolean {
  if (!pickupDate || pickupDate !== todayYmd) return false;
  const hour = Number(String(slotValue).split(':')[0]);
  if (!Number.isFinite(hour)) return false;
  return getIndiaNowMinutes() >= (hour + 1) * 60;
}

export type CrmPickupVisitValue = {
  pickup_required: boolean;
  vehicle_number: string;
  pickup_date: string;
  pickup_time: string;
  pickup_address: string;
  address_type: 'home' | 'work' | 'other';
  flat_number: string;
  landmark: string;
  workshop_id: string;
  workshop_name?: string;
};

function normalizePincodeList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || '').trim()).filter((p) => /^\d{6}$/.test(p));
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        return normalizePincodeList(JSON.parse(trimmed));
      } catch {
        // fall through
      }
    }
    return trimmed
      .split(/[|,;\s]+/)
      .map((p) => p.trim())
      .filter((p) => /^\d{6}$/.test(p));
  }
  return [];
}

function workshopCoversPincode(workshop: any, pincode: string): boolean {
  const target = String(pincode || '').trim();
  if (!/^\d{6}$/.test(target)) return false;
  if (String(workshop?.pincode || '').trim() === target) return true;
  const servicePin = String(workshop?.service_pincode || '').trim();
  if (servicePin === target) return true;
  if (servicePin && normalizePincodeList(servicePin.replace(/\|/g, ',')).includes(target)) {
    return true;
  }
  return normalizePincodeList(workshop?.mapping_pincodes).includes(target);
}

type Props = {
  value: CrmPickupVisitValue;
  onChange: (patch: Partial<CrmPickupVisitValue>) => void;
  city?: string;
  cityId?: string;
  pincode?: string;
  /** Home service: force pickup, hide Visit */
  forcePickup?: boolean;
  quoteTotal?: number;
  /** Hide reg# field when shown elsewhere (e.g. Vehicle section) */
  hideVehicleNumber?: boolean;
  /** Hide nearby workshop list when already selected above */
  hideWorkshopPicker?: boolean;
};

export default function CrmPickupVisitStep({
  value,
  onChange,
  city,
  cityId,
  pincode = '',
  forcePickup = false,
  quoteTotal,
  hideVehicleNumber = false,
  hideWorkshopPicker = false,
}: Props) {
  const pickupRequired = forcePickup ? true : value.pickup_required;
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [loadingWs, setLoadingWs] = useState(false);
  const [showAllWorkshops, setShowAllWorkshops] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const todayStr = formatDateYMD(getIndiaDate());
  const tomorrow = new Date(getIndiaDate());
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateYMD(tomorrow);
  const dayAfter = new Date(getIndiaDate());
  dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterStr = formatDateYMD(dayAfter);

  const slots = pickupRequired ? TIME_SLOTS : TIME_SLOTS.filter((s) => s.value < '13:00');
  const todayClosed = !slots.some((s) => !isTimeSlotPastForDate(s.value, todayStr, todayStr));
  const minDate = parseYmdToDate(todayClosed ? tomorrowStr : todayStr);

  const dateOptions = useMemo(() => {
    if (todayClosed) {
      return [
        { key: 'tomorrow', dateStr: tomorrowStr, label: `Tomorrow, ${formatDateDMShort(tomorrowStr)}` },
        { key: 'day-after', dateStr: dayAfterStr, label: formatDateDMShort(dayAfterStr) },
      ];
    }
    return [
      { key: 'today', dateStr: todayStr, label: `Today, ${formatDateDMShort(todayStr)}` },
      { key: 'tomorrow', dateStr: tomorrowStr, label: `Tomorrow, ${formatDateDMShort(tomorrowStr)}` },
    ];
  }, [todayClosed, todayStr, tomorrowStr, dayAfterStr]);

  const isQuickDate = dateOptions.some((o) => o.dateStr === value.pickup_date);

  useEffect(() => {
    if (forcePickup && !value.pickup_required) {
      onChange({ pickup_required: true, workshop_id: '' });
    }
  }, [forcePickup]);

  useEffect(() => {
    if (pickupRequired) return;
    if (hideWorkshopPicker && value.workshop_id) {
      setWorkshops([]);
      setLoadingWs(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingWs(true);
      try {
        const pin = String(pincode || '').trim();
        const params = new URLSearchParams();
        if (pin) params.set('pincode', pin);
        if (city) params.set('city', city);

        // Prefer server lookup (correct pincode coverage + no is_active column issues)
        const apiData = await apiFetch<any>(
          `/api/telecaller/crm/workshops?${params.toString()}`,
        ).catch(() => null);

        let list = Array.isArray(apiData?.workshops) ? apiData.workshops : [];

        // Client fallback if API unavailable
        if (list.length === 0) {
          const { data: rows } = await supabase
            .from('workshops')
            .select(
              'id, name, city, address, pincode, service_pincode, mapping_pincodes, phone, is_verified',
            )
            .eq('is_verified', true)
            .limit(500);

          let all = Array.isArray(rows) ? rows : [];
          if (/^\d{6}$/.test(pin)) {
            const nearby = all.filter((w) => workshopCoversPincode(w, pin));
            list =
              nearby.length > 0
                ? nearby
                : city
                  ? all.filter((w) => String(w.city || '').toLowerCase().includes(city.toLowerCase()))
                  : [];
          } else if (city) {
            list = all
              .filter((w) => String(w.city || '').toLowerCase().includes(city.toLowerCase()))
              .slice(0, 40);
          }
        }

        if (!cancelled) setWorkshops(list);
      } catch {
        if (!cancelled) setWorkshops([]);
      } finally {
        if (!cancelled) setLoadingWs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickupRequired, city, cityId, pincode, hideWorkshopPicker, value.workshop_id]);

  const setMode = (pickup: boolean) => {
    if (forcePickup && !pickup) return;
    onChange({
      pickup_required: pickup,
      ...(pickup
        ? {}
        : { pickup_address: '', flat_number: '', landmark: '' }),
    });
  };

  const onCalendarChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowCalendar(false);
    if (event.type === 'dismissed') {
      setShowCalendar(false);
      return;
    }
    if (!selected) return;
    const ymd = formatDateYMD(selected);
    onChange({ pickup_date: ymd, pickup_time: '' });
    if (Platform.OS === 'ios') {
      // keep open until Done; Android auto-closes
    }
  };

  return (
    <View>
      <Text style={styles.title}>Pickup Details</Text>
      <Text style={styles.sub}>Same as mobile / website booking — choose Pickup or Visit workshop.</Text>

      {!forcePickup ? (
        <View style={styles.prefCard}>
          <Text style={styles.cardLabel}>Service Preference *</Text>
          <View style={styles.prefRow}>
            <TouchableOpacity style={styles.prefSide} onPress={() => setMode(true)} activeOpacity={0.85}>
              <View style={[styles.prefIco, pickupRequired ? { backgroundColor: '#6366F1' } : { backgroundColor: '#D1D5DB' }]}>
                <Ionicons name="navigate" size={18} color={pickupRequired ? '#fff' : '#6B7280'} />
              </View>
              <Text style={[styles.prefLabel, pickupRequired && { color: '#4338CA' }]}>Pickup</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggle, { backgroundColor: pickupRequired ? '#6366F1' : '#10B981' }]}
              onPress={() => setMode(!pickupRequired)}
              activeOpacity={0.85}
            >
              <View style={[styles.knob, pickupRequired ? { left: 3 } : { right: 3 }]}>
                <Ionicons
                  name={pickupRequired ? 'navigate' : 'location'}
                  size={16}
                  color={pickupRequired ? '#6366F1' : '#10B981'}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.prefSide, { justifyContent: 'flex-end' }]} onPress={() => setMode(false)} activeOpacity={0.85}>
              <Text style={[styles.prefLabel, !pickupRequired && { color: '#047857' }]}>Visit</Text>
              <View style={[styles.prefIco, !pickupRequired ? { backgroundColor: '#10B981' } : { backgroundColor: '#D1D5DB' }]}>
                <Ionicons name="location" size={18} color={!pickupRequired ? '#fff' : '#6B7280'} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.homeBanner}>
          <Ionicons name="home-outline" size={18} color={COLORS.primary} />
          <Text style={styles.homeBannerText}>Home Service — doorstep pickup is required.</Text>
        </View>
      )}

      {!hideVehicleNumber ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Vehicle Number *</Text>
          <TextInput
            style={[styles.input, { letterSpacing: 1.2, fontWeight: '700', textTransform: 'uppercase' }]}
            value={value.vehicle_number}
            onChangeText={(t) =>
              onChange({ vehicle_number: t.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12) })
            }
            placeholder="e.g. MH01BJ7842"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="characters"
            maxLength={12}
          />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>{pickupRequired ? 'Pickup Date *' : 'Visit Date *'}</Text>
        <View style={styles.dateRow}>
          {dateOptions.map((opt) => {
            const active = value.pickup_date === opt.dateStr;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.dateChip, active && styles.dateChipActive]}
                onPress={() => {
                  setShowCalendar(false);
                  onChange({ pickup_date: opt.dateStr, pickup_time: '' });
                }}
              >
                <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.dateChip, styles.calChip, !isQuickDate && value.pickup_date ? styles.dateChipActive : null]}
            onPress={() => setShowCalendar((v) => !v)}
            accessibilityLabel="Open calendar"
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={!isQuickDate && value.pickup_date ? '#fff' : COLORS.primary}
            />
          </TouchableOpacity>
        </View>
        {!isQuickDate && value.pickup_date ? (
          <Text style={[styles.hint, { marginTop: 8 }]}>Selected: {formatDateDMShort(value.pickup_date)}</Text>
        ) : null}
        {showCalendar ? (
          <View style={styles.calWrap}>
            <DateTimePicker
              value={parseYmdToDate(value.pickup_date || todayStr)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={minDate}
              onChange={onCalendarChange}
            />
            {Platform.OS === 'ios' ? (
              <TouchableOpacity style={styles.calDone} onPress={() => setShowCalendar(false)}>
                <Text style={styles.calDoneText}>Done</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      {value.pickup_date ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{pickupRequired ? 'Pickup Time *' : 'Visit Time *'}</Text>
          <View style={styles.timeGrid}>
            {slots.map((slot) => {
              const past = isTimeSlotPastForDate(slot.value, value.pickup_date, todayStr);
              const active = value.pickup_time === slot.value;
              return (
                <TouchableOpacity
                  key={slot.value}
                  disabled={past}
                  style={[styles.timeTile, active && styles.timeTileActive, past && styles.timeTileDisabled]}
                  onPress={() => onChange({ pickup_time: slot.value })}
                >
                  <Text style={[styles.timeText, active && styles.timeTextActive, past && styles.timeTextDisabled]}>
                    {slot.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {pickupRequired ? (
        <View style={styles.card}>
          <View style={styles.addrTypeRow}>
            {ADDR_TYPES.map(({ key, label, icon }) => {
              const active = (value.address_type || 'home') === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.addrTypePill, active && styles.addrTypePillActive]}
                  onPress={() => onChange({ address_type: key })}
                  activeOpacity={0.85}
                >
                  <Ionicons name={icon} size={14} color={active ? '#fff' : '#6B7280'} />
                  <Text style={[styles.addrTypeText, active && styles.addrTypeTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.fieldHead}>
            <View style={styles.fieldIco}>
              <Ionicons name="location" size={14} color="#fff" />
            </View>
            <Text style={styles.fieldTitle}>
              Address <Text style={styles.req}>*</Text>
            </Text>
          </View>
          <TextInput
            style={[
              styles.input,
              { minHeight: 72, textAlignVertical: 'top' },
              value.pickup_address.trim() ? styles.inputFilled : null,
            ]}
            value={value.pickup_address}
            onChangeText={(t) => onChange({ pickup_address: t })}
            placeholder="Street / area only (no flat, landmark, city)"
            placeholderTextColor={COLORS.textSecondary}
            multiline
          />
          {value.pickup_address.trim() ? (
            <View style={styles.checkRow}>
              <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
              <Text style={styles.checkText}>Address ready</Text>
            </View>
          ) : null}

          {value.pickup_address.trim() ? (
            <>
              <View style={[styles.fieldHead, { marginTop: 14 }]}>
                <View style={styles.fieldIco}>
                  <Text style={styles.hash}>#</Text>
                </View>
                <Text style={styles.fieldTitle}>
                  Flat / House Number <Text style={styles.opt}>(Optional)</Text>
                </Text>
              </View>
              <TextInput
                style={[styles.input, value.flat_number.trim() ? styles.inputFilled : null]}
                value={value.flat_number}
                onChangeText={(t) => onChange({ flat_number: t })}
                placeholder="e.g. 21 / B-302"
                placeholderTextColor={COLORS.textSecondary}
              />

              <View style={[styles.fieldHead, { marginTop: 14 }]}>
                <View style={styles.fieldIco}>
                  <Ionicons name="navigate" size={14} color="#fff" />
                </View>
                <Text style={styles.fieldTitle}>
                  Landmark <Text style={styles.req}>*</Text>{' '}
                  <Text style={styles.opt}>(Mandatory)</Text>
                </Text>
              </View>
              <TextInput
                style={[styles.input, value.landmark.trim() ? styles.inputFilled : null]}
                value={String(value.landmark || '').replace(/^Near\s+/i, '')}
                onChangeText={(t) => onChange({ landmark: t.replace(/^Near\s+/i, '') })}
                placeholder="e.g. AB Mall"
                placeholderTextColor={COLORS.textSecondary}
              />
            </>
          ) : null}
        </View>
      ) : hideWorkshopPicker && value.workshop_id ? null : (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Nearby Workshops</Text>
          {!/^\d{6}$/.test(String(pincode || '').trim()) ? (
            <Text style={styles.hint}>Enter a 6-digit pincode in customer details to find nearby workshops.</Text>
          ) : loadingWs ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : workshops.length === 0 ? (
            <Text style={styles.hint}>
              No workshops near PIN {pincode}. You can still continue and assign later.
            </Text>
          ) : (
            <>
              <View style={styles.wsHeadRow}>
                <Text style={[styles.hint, { flex: 1 }]}>Showing workshops for PIN {pincode}</Text>
                {workshops.length > 1 ? (
                  <TouchableOpacity onPress={() => setShowAllWorkshops(true)} hitSlop={8}>
                    <Text style={styles.viewAllText}>View all</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {(() => {
                const w = workshops.find((x) => x.id === value.workshop_id) || workshops[0];
                const active = value.workshop_id === w.id;
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={[styles.wsCard, active && styles.wsCardActive]}
                    onPress={() => onChange({ workshop_id: w.id, workshop_name: w.name })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.wsName}>{w.name}</Text>
                      <Text style={styles.hint}>
                        {[w.address, w.city || city, w.pincode].filter(Boolean).join(' · ')}
                      </Text>
                      {w.capacity_status ? (
                        <Text style={[styles.hint, { color: COLORS.primary, fontWeight: '600' }]}>
                          {w.capacity_status}
                          {w.active_leads != null ? ` · ${w.active_leads} active` : ''}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={active ? COLORS.primary : COLORS.gray[400]}
                    />
                  </TouchableOpacity>
                );
              })()}
            </>
          )}
        </View>
      )}

      {quoteTotal != null && quoteTotal > 0 ? (
        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>Estimated total</Text>
          <Text style={styles.totalValue}>₹{Math.round(quoteTotal).toLocaleString('en-IN')}</Text>
        </View>
      ) : null}

      <Modal
        visible={showAllWorkshops}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllWorkshops(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowAllWorkshops(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Nearby workshops</Text>
              <TouchableOpacity onPress={() => setShowAllWorkshops(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {workshops.map((w) => {
                const active = value.workshop_id === w.id;
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={[styles.wsCard, active && styles.wsCardActive]}
                    onPress={() => {
                      onChange({ workshop_id: w.id, workshop_name: w.name });
                      setShowAllWorkshops(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.wsName}>{w.name}</Text>
                      <Text style={styles.hint}>
                        {[w.address, w.city || city, w.pincode].filter(Boolean).join(' · ')}
                      </Text>
                      {w.capacity_status ? (
                        <Text style={[styles.hint, { color: COLORS.primary, fontWeight: '600' }]}>
                          {w.capacity_status}
                          {w.active_leads != null ? ` · ${w.active_leads} active` : ''}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={active ? COLORS.primary : COLORS.gray[400]}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export { TIME_SLOTS };

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '800', color: COLORS.textHeading },
  sub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, marginBottom: 12, lineHeight: 17 },
  hint: { fontSize: 12, color: COLORS.textSecondary },
  prefCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...SHADOWS.small,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...SHADOWS.small,
  },
  cardLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textHeading, marginBottom: 10 },
  prefRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prefSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  prefIco: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  prefLabel: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  toggle: { width: 56, height: 32, borderRadius: 16, justifyContent: 'center' },
  knob: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    top: 3,
  },
  homeBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: COLORS.primary + '12',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  homeBannerText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.primary },
  input: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: COLORS.textPrimary,
  },
  inputFilled: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
  },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.gray[100],
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calChip: {
    width: 42,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dateChipText: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  dateChipTextActive: { color: '#fff' },
  calWrap: { marginTop: 10, alignItems: 'center' },
  calDone: {
    marginTop: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  calDoneText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeTile: {
    width: '47%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  timeTileActive: { backgroundColor: '#A855F7', borderColor: '#A855F7' },
  timeTileDisabled: { opacity: 0.4 },
  timeText: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  timeTextActive: { color: '#fff' },
  timeTextDisabled: { color: COLORS.textSecondary },
  addrTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  addrTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addrTypePillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  addrTypeText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  addrTypeTextActive: { color: '#fff' },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  fieldIco: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hash: { color: '#fff', fontWeight: '800', fontSize: 12 },
  fieldTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textHeading },
  req: { color: '#EF4444' },
  opt: { fontSize: 11, fontWeight: '500', color: COLORS.textSecondary },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  checkText: { fontSize: 12, fontWeight: '600', color: '#16A34A' },
  wsHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  viewAllText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  wsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  wsCardActive: { backgroundColor: COLORS.primary + '08', borderRadius: 8, paddingHorizontal: 8 },
  wsName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 8,
    maxHeight: '75%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.gray[300],
    marginBottom: 10,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textHeading },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary + '12',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  totalLabel: { fontWeight: '600', color: COLORS.textSecondary },
  totalValue: { fontWeight: '800', color: COLORS.primary, fontSize: 16 },
});
