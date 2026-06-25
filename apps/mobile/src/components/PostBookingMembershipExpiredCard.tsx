import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  membershipOfferExpiredMessage,
  membershipOfferExpiredSubtitle,
  membershipOfferExpiredTitle,
  type MembershipOfferExpiredView,
} from '../lib/postBookingMembershipOffer';

type Props = {
  expiredView: MembershipOfferExpiredView;
  compact?: boolean;
};

export default function PostBookingMembershipExpiredCard({ expiredView, compact }: Props) {
  const payable = Math.round(expiredView.currentPayable).toLocaleString('en-IN');

  return (
    <View style={[styles.card, compact ? styles.cardCompact : null]}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="time-outline" size={16} color="#92400E" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{membershipOfferExpiredTitle()}</Text>
          <Text style={styles.sub}>{membershipOfferExpiredSubtitle(expiredView)}</Text>
        </View>
      </View>
      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Updated payable</Text>
        <Text style={styles.amountValue}>₹{payable}</Text>
      </View>
      {!compact ? (
        <Text style={styles.note}>{membershipOfferExpiredMessage(expiredView)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 10,
  },
  cardCompact: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  sub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#78350F',
    lineHeight: 17,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  note: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 16,
    opacity: 0.9,
  },
});
