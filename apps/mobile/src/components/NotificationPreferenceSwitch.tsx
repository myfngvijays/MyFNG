import React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

type Props = {
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  hint?: string | null;
  contactsValue?: boolean;
  onContactsValueChange?: (val: boolean) => void;
  contactsDisabled?: boolean;
  contactsLoading?: boolean;
  contactsHint?: string | null;
  workshopProximityValue?: boolean;
  onWorkshopProximityValueChange?: (val: boolean) => void;
  workshopProximityDisabled?: boolean;
  workshopProximityLoading?: boolean;
  workshopProximityHint?: string | null;
};

function SwitchRow({
  label,
  sub,
  value,
  onValueChange,
  disabled,
  loading,
}: {
  label: string;
  sub: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchTextWrap}>
        <Text style={styles.switchLabel}>{label}</Text>
        <Text style={styles.switchSub}>{sub}</Text>
      </View>
      <View style={styles.switchControlWrap}>
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Switch
            style={Platform.OS === 'ios' ? styles.switchIos : styles.switchAndroid}
            value={value}
            onValueChange={onValueChange}
            disabled={disabled || loading}
            trackColor={{ false: '#D1D5DB', true: '#34D399' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D5DB"
          />
        )}
      </View>
    </View>
  );
}

export default function NotificationPreferenceSwitch({
  value,
  onValueChange,
  disabled = false,
  loading = false,
  hint,
  contactsValue,
  onContactsValueChange,
  contactsDisabled = false,
  contactsLoading = false,
  contactsHint,
  workshopProximityValue,
  onWorkshopProximityValueChange,
  workshopProximityDisabled = false,
  workshopProximityLoading = false,
  workshopProximityHint,
}: Props) {
  const showContacts = onContactsValueChange != null;
  const showWorkshopProximity = onWorkshopProximityValueChange != null;

  return (
    <View style={styles.card}>
      <View style={styles.heroRow}>
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroTitle}>Notification Preferences</Text>
          <Text style={styles.heroSub}>Control where and when we notify you.</Text>
        </View>
        <View style={styles.heroIconWrap}>
          <Ionicons name="notifications-outline" size={20} color={COLORS.primary} />
        </View>
      </View>

      <View style={styles.divider} />

      <SwitchRow
        label="Push Notifications"
        sub="Booking updates, offers and wallet alerts"
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        loading={loading}
      />

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {showContacts ? (
        <>
          <View style={styles.rowDivider} />
          <SwitchRow
            label="Allow Contacts"
            sub="For Refer & Rise invites from your phonebook"
            value={Boolean(contactsValue)}
            onValueChange={onContactsValueChange!}
            disabled={contactsDisabled}
            loading={contactsLoading}
          />
          {contactsHint ? <Text style={styles.hint}>{contactsHint}</Text> : null}
        </>
      ) : null}

      {showWorkshopProximity ? (
        <>
          <View style={styles.rowDivider} />
          <SwitchRow
            label="Nearby Workshop Alerts"
            sub="Opt in to detect when you're near a MyFNG service center"
            value={Boolean(workshopProximityValue)}
            onValueChange={onWorkshopProximityValueChange!}
            disabled={workshopProximityDisabled}
            loading={workshopProximityLoading}
          />
          {workshopProximityHint ? <Text style={styles.hint}>{workshopProximityHint}</Text> : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  heroTextWrap: { flex: 1, minWidth: 0 },
  heroTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  heroSub: { marginTop: 2, fontSize: 13, color: '#6B7280', fontWeight: '500', lineHeight: 18 },
  heroIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: '#EEF2F7' },
  rowDivider: { height: 1, backgroundColor: '#EEF2F7', marginHorizontal: 16 },
  switchRow: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchTextWrap: { flex: 1, minWidth: 0, paddingRight: 8 },
  switchLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  switchSub: { marginTop: 2, fontSize: 12, color: '#6B7280', lineHeight: 16 },
  switchControlWrap: {
    width: Platform.OS === 'ios' ? 58 : 52,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchIos: {
    transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }],
  },
  switchAndroid: {
    transform: [{ scaleX: 1.05 }, { scaleY: 1.05 }],
  },
  hint: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontSize: 12,
    lineHeight: 17,
    color: '#B45309',
    fontWeight: '500',
  },
});
