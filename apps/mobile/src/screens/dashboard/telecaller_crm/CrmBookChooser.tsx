import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SHADOWS } from '../../../constants/theme';

type Props = {
  onPick: (mode: 'book' | 'lead') => void;
  onCancel?: () => void;
};

/** Book tab hub — Booking on top, Add Lead below (no Follow-ups). */
export default function CrmBookChooser({ onPick, onCancel }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Book / Lead</Text>
      <Text style={styles.sub}>Choose what you want to do</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => onPick('book')}
        activeOpacity={0.88}
      >
        <View style={[styles.iconWrap, { backgroundColor: COLORS.green + '18' }]}>
          <Ionicons name="calendar" size={28} color={COLORS.green} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Booking</Text>
          <Text style={styles.cardSub}>Full booking flow — city, car, services, pickup</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => onPick('lead')}
        activeOpacity={0.88}
      >
        <View style={[styles.iconWrap, { backgroundColor: COLORS.primary + '18' }]}>
          <Ionicons name="person-add" size={28} color={COLORS.primary} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Add Lead</Text>
          <Text style={styles.cardSub}>Quick save — name, phone, pin, call notes & status</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {onCancel ? (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.85}>
          <Text style={styles.cancelText}>Close</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingTop: 16,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textHeading },
  sub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, marginBottom: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  cardSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3, lineHeight: 16 },
  cancelBtn: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.gray[100],
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
});
