import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { formatWelcomeBonusAmount, getWelcomeBonusAmount } from '../lib/welcomeBonus';

type GuestProps = {
  visible: boolean;
  onClose: () => void;
  onLogin: () => void;
  amountLabel?: string;
};

type CreditedProps = {
  visible: boolean;
  onClose: () => void;
  amount?: number;
  expiryDays?: number;
};

export function WelcomeBonusGuestModal({
  visible,
  onClose,
  onLogin,
  amountLabel = formatWelcomeBonusAmount(),
}: GuestProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.iconWrap}>
            <View style={styles.iconRingOuter}>
              <View style={styles.iconRingInner}>
                <Ionicons name="gift" size={34} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <Text style={styles.title}>Login to get {amountLabel}</Text>
          <Text style={styles.subtitle}>
            Welcome Bonus on your first login. Use it on service bookings and membership.
          </Text>

          <View style={styles.highlightPill}>
            <Ionicons name="checkmark-circle" size={16} color="#059669" />
            <Text style={styles.highlightText}>Free wallet credit for new users</Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={onLogin} activeOpacity={0.88}>
            <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Login Now</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>Maybe later</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function WelcomeBonusCreditedModal({
  visible,
  onClose,
  amount = getWelcomeBonusAmount(),
  expiryDays = 90,
}: CreditedProps) {
  const amountLabel = formatWelcomeBonusAmount(amount);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.iconWrap}>
            <View style={[styles.iconRingOuter, styles.iconRingOuterSuccess]}>
              <View style={[styles.iconRingInner, styles.iconRingInnerSuccess]}>
                <Ionicons name="checkmark" size={40} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <Text style={styles.title}>Welcome Bonus Credited!</Text>

          <View style={styles.amountPill}>
            <Ionicons name="wallet-outline" size={14} color="#047857" />
            <Text style={styles.amountPillText}>{amountLabel} added to your wallet</Text>
          </View>

          <Text style={styles.subtitle}>
            Valid for {expiryDays} days. Use up to 10% on your next service booking from wallet balance.
          </Text>

          <TouchableOpacity style={[styles.primaryBtn, styles.primaryBtnSuccess]} onPress={onClose} activeOpacity={0.88}>
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Awesome!</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: 16,
  },
  iconRingOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRingOuterSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  iconRingInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRingInnerSuccess: {
    backgroundColor: '#10B981',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primaryDark,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  highlightPill: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  highlightText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
  },
  amountPill: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  amountPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
  },
  primaryBtn: {
    marginTop: 20,
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnSuccess: {
    backgroundColor: '#10B981',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 8,
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});
