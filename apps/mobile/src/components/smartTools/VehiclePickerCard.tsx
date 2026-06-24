import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import type { CustomerVehicle } from '../../lib/smartToolsVehicle';
import { vehicleLabel } from '../../lib/smartToolsVehicle';

type Props = {
  vehicles: CustomerVehicle[];
  selectedId?: string | null;
  onSelect: (vehicle: CustomerVehicle | null) => void;
  onAddOther: () => void;
};

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  android: { elevation: 2 },
  default: {},
});

export default function VehiclePickerCard({ vehicles, selectedId, onSelect, onAddOther }: Props) {
  if (vehicles.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your saved cars</Text>
      {vehicles.map((v) => {
        const active = selectedId === (v.id || vehicleLabel(v));
        return (
          <TouchableOpacity
            key={v.id || vehicleLabel(v)}
            style={[styles.row, active ? styles.rowActive : null]}
            onPress={() => onSelect(v)}
            activeOpacity={0.85}
          >
            <View style={[styles.iconWrap, active ? styles.iconWrapActive : null]}>
              <Ionicons name="car-sport" size={18} color={active ? '#FFFFFF' : COLORS.primary} />
            </View>
            <View style={styles.meta}>
              <Text style={[styles.name, active ? styles.nameActive : null]}>{vehicleLabel(v)}</Text>
              <Text style={[styles.sub, active ? styles.subActive : null]}>
                {[v.registration_number || v.vehicle_number, v.fuel_type, v.year ? String(v.year) : null]
                  .filter(Boolean)
                  .join(' • ')}
              </Text>
            </View>
            {v.is_default ? (
              <View style={[styles.badge, active ? styles.badgeActive : null]}>
                <Text style={[styles.badgeText, active ? styles.badgeTextActive : null]}>Default</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity style={styles.otherBtn} onPress={onAddOther}>
        <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
        <Text style={styles.otherText}>Check another car</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    gap: 8,
    ...cardShadow,
  },
  title: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  rowActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  iconWrapActive: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' },
  meta: { flex: 1 },
  name: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  nameActive: { color: '#FFFFFF' },
  sub: { marginTop: 2, fontSize: 11, fontWeight: '600', color: '#64748B' },
  subActive: { color: 'rgba(255,255,255,0.85)' },
  badge: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: '#A7F3D0' },
  badgeActive: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#059669' },
  badgeTextActive: { color: '#FFFFFF' },
  otherBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  otherText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
});
