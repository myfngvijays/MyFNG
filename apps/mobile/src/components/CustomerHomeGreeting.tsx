import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getVehicleImageCandidates } from '../lib/vehicleImages';

export type HomeVehicle = {
  make?: string | null;
  model?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_number?: string | null;
  fuel_type?: string | null;
};

type Props = {
  name?: string | null;
  city?: string | null;
  vehicle: HomeVehicle | null;
  vehicleCount?: number;
  loading?: boolean;
  hasUnread?: boolean;
  onPressBell?: () => void;
  onPressChangeCar?: () => void;
  onPressAddCar?: () => void;
  /** Full-width blue block that continues the blue header above it. */
  attached?: boolean;
  /** Active Prime member → gold "Prime" badge; otherwise a "Get Prime" badge. */
  isPrime?: boolean;
  onPressPrime?: () => void;
};

const BRAND_BLUE = '#2754C8';
const INVALID_PLATES = new Set(['', 'NA', 'N/A', 'NONE', 'NULL', 'UNDEFINED']);

function greetingForNow(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Good night,';
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPlate(raw?: string | null) {
  const plate = String(raw || '').replace(/\s+/g, '').toUpperCase();
  if (INVALID_PLATES.has(plate)) return '';
  // MH04AB1234 → MH 04 AB 1234
  const m = plate.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  if (!m) return plate;
  return [m[1], m[2], m[3], m[4]].filter(Boolean).join(' ');
}

export function vehicleTitle(v: HomeVehicle | null) {
  if (!v) return '';
  const make = String(v.make || v.vehicle_make || '').trim();
  const model = String(v.model || v.vehicle_model || '').trim();
  return [make, model].filter(Boolean).map(titleCase).join(' ');
}

/** Real car photo for the saved car; falls back to the car icon when no image loads. */
function CarPhoto({ vehicle }: { vehicle: HomeVehicle }) {
  const make = String(vehicle.make || vehicle.vehicle_make || '').trim();
  const model = String(vehicle.model || vehicle.vehicle_model || '').trim();
  // default-car.png is not in storage, so stop before it and show the icon instead.
  const candidates = useMemo(
    () => getVehicleImageCandidates(make, model).filter((u) => !u.endsWith('/default-car.png')),
    [make, model],
  );
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [candidates.join('|')]);

  if (index >= candidates.length) {
    return <Ionicons name="car-sport" size={26} color={BRAND_BLUE} />;
  }
  return (
    <Image
      source={{ uri: candidates[index] }}
      style={styles.carPhoto}
      resizeMode="contain"
      onError={() => setIndex((i) => i + 1)}
    />
  );
}

export default function CustomerHomeGreeting({
  name,
  city,
  vehicle,
  vehicleCount = 0,
  loading = false,
  hasUnread = false,
  onPressBell,
  onPressChangeCar,
  onPressAddCar,
  attached = false,
  isPrime = false,
  onPressPrime,
}: Props) {
  const firstName = String(name || '').trim().split(/\s+/)[0] || '';
  const displayName = firstName ? titleCase(firstName) : 'Welcome back';
  const showCity = city && !/detecting/i.test(city);
  const plate = formatPlate(vehicle?.vehicle_number);
  const fuel = vehicle?.fuel_type ? titleCase(String(vehicle.fuel_type)) : '';
  const meta = [plate, fuel].filter(Boolean).join(' · ');

  return (
    <View style={[styles.wrap, attached && styles.wrapAttached]}>
      <View style={[styles.hero, attached && styles.heroAttached]}>
        {attached ? null : (
          <>
            <View pointerEvents="none" style={styles.glowA} />
            <View pointerEvents="none" style={styles.glowB} />
          </>
        )}
        <View style={styles.heroRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.greeting}>{greetingForNow()}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
          </View>
          {attached && onPressPrime ? (
            <TouchableOpacity
              style={[styles.primeBadge, isPrime && styles.primeBadgeActive]}
              activeOpacity={0.85}
              onPress={onPressPrime}
              accessibilityLabel={isPrime ? 'Prime member' : 'Get Prime'}
            >
              <Ionicons name={isPrime ? 'diamond' : 'sparkles'} size={13} color={isPrime ? '#7A4B00' : '#FCD34D'} />
              <Text style={[styles.primeBadgeText, isPrime && styles.primeBadgeTextActive]}>
                {isPrime ? 'Prime' : 'Get Prime'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {attached ? null : (
          <TouchableOpacity
            style={styles.bell}
            activeOpacity={0.8}
            onPress={onPressBell}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
            {hasUnread ? <View style={styles.bellDot} /> : null}
          </TouchableOpacity>
          )}
        </View>
        {showCity ? (
          <View style={styles.cityRow}>
            <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.9)" />
            <Text style={styles.cityText} numberOfLines={1}>
              {city}
            </Text>
          </View>
        ) : null}
      </View>

      {loading && !vehicle ? (
        <View style={[styles.carCard, attached && styles.carCardAttached, styles.carCardLoading]}>
          <ActivityIndicator color={BRAND_BLUE} />
        </View>
      ) : vehicle ? (
        <View style={[styles.carCard, attached && styles.carCardAttached]}>
          <View style={[styles.carIconWrap, styles.carPhotoWrap]}>
            <CarPhoto vehicle={vehicle} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.carEyebrow}>
              MY CAR{vehicleCount > 1 ? ` · ${vehicleCount} SAVED` : ''}
            </Text>
            <Text style={styles.carTitle} numberOfLines={1}>
              {vehicleTitle(vehicle) || 'My Car'}
            </Text>
            {meta ? (
              <Text style={styles.carMeta} numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity style={styles.changeBtn} activeOpacity={0.85} onPress={onPressChangeCar}>
            <Text style={styles.changeBtnText}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={[styles.carCard, attached && styles.carCardAttached]} activeOpacity={0.9} onPress={onPressAddCar}>
          <View style={[styles.carIconWrap, styles.addIconWrap]}>
            <Ionicons name="car-sport-outline" size={24} color={BRAND_BLUE} />
            <View style={styles.addPlus}>
              <Ionicons name="add" size={13} color="#FFFFFF" />
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.carEyebrow}>MY CAR</Text>
            <Text style={styles.carTitle} numberOfLines={1}>
              Add your car
            </Text>
            <Text style={styles.carMeta} numberOfLines={2}>
              Get exact prices & faster bookings
            </Text>
          </View>
          <View style={styles.addBtn}>
            <Ionicons name="add" size={14} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  wrapAttached: {
    marginHorizontal: 0,
    marginTop: 0,
  },
  heroAttached: {
    borderRadius: 0,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  hero: {
    backgroundColor: BRAND_BLUE,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 56,
    overflow: 'hidden',
  },
  glowA: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  glowB: {
    position: 'absolute',
    bottom: -80,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,20,90,0.18)',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  greeting: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 15,
    fontWeight: '500',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  primeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.6)',
    backgroundColor: 'rgba(252,211,77,0.12)',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  primeBadgeActive: {
    backgroundColor: '#FCD34D',
    borderColor: '#FCD34D',
  },
  primeBadgeText: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  primeBadgeTextActive: {
    color: '#7A4B00',
  },
  bell: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 13,
    right: 14,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
    borderWidth: 1.5,
    borderColor: BRAND_BLUE,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
  },
  cityText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  carCard: {
    marginTop: -40,
    marginHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    shadowColor: '#0B1F4D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  carCardAttached: {
    marginHorizontal: 16,
  },
  carCardLoading: {
    minHeight: 74,
    justifyContent: 'center',
  },
  carIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 15,
    backgroundColor: '#E8EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carPhotoWrap: {
    width: 76,
    backgroundColor: '#F1F5FF',
    overflow: 'hidden',
  },
  carPhoto: {
    width: 72,
    height: 48,
  },
  addIconWrap: {
    borderWidth: 1.5,
    borderColor: '#BFD0FF',
    borderStyle: 'dashed',
  },
  addPlus: {
    position: 'absolute',
    right: 7,
    bottom: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  carEyebrow: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  carTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  carMeta: {
    color: '#64748B',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  changeBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6DEF0',
    backgroundColor: '#FFFFFF',
  },
  changeBtnText: {
    color: BRAND_BLUE,
    fontSize: 12.5,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: BRAND_BLUE,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
