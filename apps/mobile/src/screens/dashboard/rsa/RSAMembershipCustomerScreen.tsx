import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

export default function RSAMembershipCustomerScreen({ navigation }: any) {
  const handleBack = () => {
    if (typeof navigation?.canGoBack === 'function' && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (typeof navigation?.goBack === 'function') {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.('RSAManagerDashboard');
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="Membership Customer" onBack={handleBack} />
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Membership Customer Module</Text>
          <Text style={styles.subtle}>
            This module is now wired in mobile navigation for parity. Business-specific list/actions can be expanded as backend contract finalizes.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md },
  card: { backgroundColor: COLORS.white, borderRadius: 10, padding: SPACING.md },
  title: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  subtle: { marginTop: SPACING.xs, fontSize: SIZES.sm, color: COLORS.textSecondary },
});
