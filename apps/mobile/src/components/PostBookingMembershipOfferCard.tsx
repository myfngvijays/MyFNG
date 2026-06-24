import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  formatOfferCountdown,
  formatMembershipPayable,
  membershipOfferFomoMessage,
  membershipOfferCardTitle,
  type MembershipOfferPayView,
} from '../lib/postBookingMembershipOffer';

type Props = {
  offerPayView: MembershipOfferPayView;
  paying?: boolean;
  onPay: () => void;
  tick?: number;
  cardTitle?: string;
  fomoMessage?: string;
};

export default function PostBookingMembershipOfferCard({
  offerPayView,
  paying,
  onPay,
  tick,
  cardTitle,
  fomoMessage,
}: Props) {
  void tick;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{membershipOfferCardTitle(cardTitle)}</Text>
        <View style={styles.timerBadge}>
          <Text style={styles.timerText}>{formatOfferCountdown(offerPayView.offer.expires_at)}</Text>
        </View>
      </View>
      <Text style={styles.sub}>{membershipOfferFomoMessage(offerPayView.saveAmount, fomoMessage)}</Text>
      <TouchableOpacity
        style={[styles.btn, paying ? styles.btnDisabled : null]}
        onPress={onPay}
        disabled={paying}
        activeOpacity={0.85}
      >
        {paying ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.btnText}>
            Pay {formatMembershipPayable(offerPayView.payable)} & Activate Prime
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  timerBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  title: { flex: 1, fontSize: 14, fontWeight: '800', color: '#991B1B' },
  sub: { fontSize: 11, fontWeight: '600', color: '#7F1D1D', lineHeight: 16, opacity: 0.85 },
  btn: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
});
