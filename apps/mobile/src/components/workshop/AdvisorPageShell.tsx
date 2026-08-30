import React from 'react';
import { View, StyleSheet } from 'react-native';
import WorkshopCrmShell from './WorkshopCrmShell';
import {
  ADVISOR_CRM_NAV,
  ADVISOR_CRM_QUICK,
  ADVISOR_SHELL_BY_SCREEN,
} from '../../constants/workshopCrmNav';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';

type Props = {
  title: string;
  navId: string;
  navigation: any;
  children: React.ReactNode;
};

export function AdvisorPageShell({ title, navId, navigation, children }: Props) {
  const { userProfile } = useAuth();
  const joined = [userProfile?.first_name, userProfile?.last_name]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' ');

  return (
    <WorkshopCrmShell
      title={title}
      userName={joined || userProfile?.full_name}
      userEmail={userProfile?.email}
      roleFallback="Workshop Advisor"
      navigation={navigation}
      drawerItems={ADVISOR_CRM_NAV}
      quickItems={ADVISOR_CRM_QUICK}
      activeTab={navId}
      homeScreen="WorkshopSupervisorDashboard"
      trapBackToHome={false}
    >
      <View style={styles.body}>{children}</View>
    </WorkshopCrmShell>
  );
}

export function withAdvisorShell<P extends { navigation?: any }>(
  Screen: React.ComponentType<P>,
  screenName: string,
) {
  const meta = ADVISOR_SHELL_BY_SCREEN[screenName] || { title: screenName, id: 'dashboard' };

  function Wrapped(props: P) {
    return (
      <AdvisorPageShell
        title={meta.title}
        navId={meta.id}
        navigation={(props as any).navigation}
      >
        <Screen {...props} hideChrome />
      </AdvisorPageShell>
    );
  }

  Wrapped.displayName = `AdvisorShell(${Screen.displayName || Screen.name || screenName})`;
  return Wrapped;
}

const styles = StyleSheet.create({
  body: { flex: 1, minHeight: 0, backgroundColor: COLORS.background },
});
