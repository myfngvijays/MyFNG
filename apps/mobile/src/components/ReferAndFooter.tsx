import React from 'react';
import { Linking, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/theme';

type Props = {
  hideRefer?: boolean;
};

export default function ReferAndFooter({ hideRefer = false }: Props) {
  return (
    <>
      {!hideRefer && (
        <View style={s.section}>
          <View style={s.referCard}>
            <View>
              <Text style={s.referTitle}>Refer & Earn ₹500</Text>
              <Text style={s.referSub}>Invite friends and get discounts</Text>
            </View>
            <TouchableOpacity
              style={s.referBtn}
              onPress={() =>
                Share.share({
                  message:
                    'Join MyFNG and get rewards on your first car service booking. Use code MYFNG500.',
                })
              }
            >
              <Text style={s.referBtnText}>Invite Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={s.section}>
        <Text style={s.headline}>
          India&apos;s #1 AI-Powered{'\n'}Car Service Booking Platform
        </Text>
        <View style={s.numbers}>
          <View style={s.col}>
            <Text style={s.numBold}>17k+</Text>
            <Text style={s.numLabel}>Car Serviced</Text>
          </View>
          <View style={s.divider} />
          <View style={s.col}>
            <Text style={s.numBold}>4.8</Text>
            <Text style={s.numLabel}>Top-Rated</Text>
          </View>
          <View style={s.divider} />
          <View style={s.col}>
            <Text style={s.numBold}>100+</Text>
            <Text style={s.numLabel}>A-Grade{'\n'}Workshops</Text>
          </View>
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  referCard: {
    backgroundColor: '#004AAD',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  referSub: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    marginTop: 2,
  },
  referBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  referBtnText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 18,
  },
  numbers: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  col: {
    alignItems: 'center',
  },
  numBold: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
  },
  numLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: '#E5E7EB',
  },
});
