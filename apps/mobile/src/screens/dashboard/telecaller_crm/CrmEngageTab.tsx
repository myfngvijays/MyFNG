import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import TelecallerFollowUpsScreen from '../telecaller/TelecallerFollowUpsScreen';
import { COLORS } from '../../../constants/theme';

type Props = {
  navigation: any;
  initialSegment?: string;
};

/** Reminders-only engage surface (Scripts / RSA removed from this flow). */
export default function CrmEngageTab({ navigation }: Props) {
  const nestedNav = {
    ...navigation,
    goBack: () => navigation?.navigate?.('home'),
    navigate: (screen: string, params?: any) => {
      if (screen === 'followups' || screen === 'TelecallerFollowUps') return;
      navigation?.navigate?.(screen, params);
    },
  };

  return (
    <View style={styles.container}>
      <TelecallerFollowUpsScreen navigation={nestedNav} route={{ params: {} }} embedded />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
});
