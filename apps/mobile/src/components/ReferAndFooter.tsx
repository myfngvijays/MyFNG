import React, { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/theme';
import {
  DEFAULT_APP_FOOTER_CONFIG,
  fetchAppFooterConfig,
  type AppFooterConfig,
} from '../lib/appFooterConfig';

type Props = {
  hideRefer?: boolean;
};

export default function ReferAndFooter({ hideRefer = false }: Props) {
  const [footer, setFooter] = useState<AppFooterConfig>(DEFAULT_APP_FOOTER_CONFIG);

  useEffect(() => {
    let active = true;
    fetchAppFooterConfig()
      .then((config) => {
        if (active) setFooter(config);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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
              activeOpacity={1}
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

      <View style={[s.section, s.footerSection]}>
        <Text style={s.headline}>
          {footer.headline_line1}
          {'\n'}
          {footer.headline_line2}
        </Text>
        <View style={s.numbers}>
          {footer.stats.map((stat, index) => (
            <React.Fragment key={`${stat.value}-${index}`}>
              {index > 0 ? <View style={s.divider} /> : null}
              <View style={s.col}>
                <Text style={s.numBold}>{stat.value}</Text>
                <Text style={s.numLabel}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
        {footer.bottom_line ? (
          <Text style={s.bottomLine}>{footer.bottom_line}</Text>
        ) : null}
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
