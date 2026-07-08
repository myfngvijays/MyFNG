import React, { useState } from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/theme';
import { useAppFooter } from '../context/AppFooterContext';
import { apiFetch } from '../lib/api';
import { ENV } from '../config/environment';

type Props = {
  hideRefer?: boolean;
};

export default function ReferAndFooter({ hideRefer = false }: Props) {
  const { footer, refreshFooter } = useAppFooter();
  const [referralCode, setReferralCode] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      void refreshFooter();
      apiFetch<{ code: any }>('/api/customer/referral')
        .then((res) => setReferralCode(res?.code?.code || ''))
        .catch(() => {});
    }, [refreshFooter]),
  );

  const shareReferral = () => {
    const code = referralCode || 'MYFNG';
    const link = `https://play.google.com/store/apps/details?id=com.myfng.app&referrer=${encodeURIComponent(`referral_code=${code}`)}`;
    Share.share({
      message: `🚗 Great cars deserve great care!\n\nJoin MyFNG and let's keep your car always performing at its best.\n\nUse my referral code *${code}* to get ₹1,500 wallet bonus instantly.\n\n👉 ${link}`,
    });
  };

  return (
    <>
      {!hideRefer && (
        <View style={s.section}>
          <View style={s.referCard}>
            <View style={s.referLeft}>
              <View style={s.referIconWrap}>
                <Ionicons name="trophy" size={18} color="#F5B942" />
                <Ionicons name="star" size={6} color="#004AAD" style={{ position: 'absolute', top: 5, right: 4 }} />
                <Ionicons name="star" size={5} color="#EF4444" style={{ position: 'absolute', bottom: 6, right: 3 }} />
                <Ionicons name="star" size={5} color="#22D3EE" style={{ position: 'absolute', top: 6, left: 4 }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.referTitle}>Refer & Rise</Text>
                <Text style={s.referSub}>Unlock rewards you love — invite friends!</Text>
              </View>
            </View>
            <TouchableOpacity
              style={s.referBtn}
              activeOpacity={0.85}
              onPress={shareReferral}
            >
              <Ionicons name="share-social" size={14} color={COLORS.primary} />
              <Text style={s.referBtnText}>Invite</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[s.section, s.footerSection]}>
        <Text style={s.headline}>
          {footer.headline_line1}
          {'\n'}
          {footer.headline_line2}
        </Text>
        <View style={s.numbers}>
          {footer.stats.map((stat, index) => (
            <React.Fragment key={`${stat.value}-${stat.label}-${index}`}>
              {index > 0 ? <View style={s.divider} /> : null}
              <View style={s.col}>
                <Text style={s.numBold}>{stat.value}</Text>
                <Text style={s.numLabel}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
        {footer.bottom_line ? <Text style={s.bottomLine}>{footer.bottom_line}</Text> : null}
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  referIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245,185,66,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  referTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  referSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    marginTop: 2,
  },
  referBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  referBtnText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  headline: {
    fontSize: 18,
    fontWeight: '700',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 16,
  },
  footerSection: {
    opacity: 0.82,
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
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(0, 74, 173, 0.58)',
  },
  numLabel: {
    fontSize: 10,
    color: '#A8B0BC',
    fontWeight: '600',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 34,
    backgroundColor: '#B6C0CC',
  },
  bottomLine: {
    marginTop: 12,
    fontSize: 10,
    fontWeight: '600',
    color: '#A8B0BC',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
});
