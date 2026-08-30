import React from 'react';
import { View, StyleSheet } from 'react-native';
import WorkshopCrmShell from './WorkshopCrmShell';
import type { WorkshopCrmNavItem } from '../../constants/workshopCrmNav';
import { useAuth } from '../../context/AuthContext';
import {
  MECHANIC_CRM_NAV,
  MECHANIC_CRM_QUICK,
  MECHANIC_SHELL_BY_SCREEN,
  OWNER_CRM_NAV,
  OWNER_CRM_QUICK,
  OWNER_SHELL_BY_SCREEN,
  PICKUP_CRM_NAV,
  PICKUP_CRM_QUICK,
  PICKUP_SHELL_BY_SCREEN,
} from '../../constants/workshopCrmNav';
import { COLORS } from '../../constants/theme';

type Props = {
  title: string;
  navId: string;
  navigation: any;
  children: React.ReactNode;
  drawerItems: WorkshopCrmNavItem[];
  quickItems?: WorkshopCrmNavItem[];
  homeScreen: string;
  roleFallback: string;
};

export function WorkshopRoleShell({
  title,
  navId,
  navigation,
  children,
  drawerItems,
  quickItems,
  homeScreen,
  roleFallback,
}: Props) {
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
      roleFallback={roleFallback}
      navigation={navigation}
      drawerItems={drawerItems}
      quickItems={quickItems}
      activeTab={navId}
      homeScreen={homeScreen}
      trapBackToHome={false}
    >
      <View style={styles.body}>{children}</View>
    </WorkshopCrmShell>
  );
}

export function withWorkshopRoleShell<P extends { navigation?: any }>(
  Screen: React.ComponentType<P>,
  meta: { title: string; id: string },
  shell: {
    drawerItems: WorkshopCrmNavItem[];
    quickItems?: WorkshopCrmNavItem[];
    homeScreen: string;
    roleFallback: string;
  },
) {
  function Wrapped(props: P) {
    return (
      <WorkshopRoleShell
        title={meta.title}
        navId={meta.id}
        navigation={(props as any).navigation}
        drawerItems={shell.drawerItems}
        quickItems={shell.quickItems}
        homeScreen={shell.homeScreen}
        roleFallback={shell.roleFallback}
      >
        <Screen {...props} hideChrome embedInShell />
      </WorkshopRoleShell>
    );
  }
  Wrapped.displayName = `RoleShell(${Screen.displayName || Screen.name || meta.title})`;
  return Wrapped;
}

const MECHANIC_SHELL = {
  drawerItems: MECHANIC_CRM_NAV,
  quickItems: MECHANIC_CRM_QUICK,
  homeScreen: 'MechanicDashboard',
  roleFallback: 'Workshop Mechanic',
};

const PICKUP_SHELL = {
  drawerItems: PICKUP_CRM_NAV,
  quickItems: PICKUP_CRM_QUICK,
  homeScreen: 'WorkshopPickupBoyDashboard',
  roleFallback: 'Pickupboy / Driver',
};

export function withMechanicShell<P extends { navigation?: any }>(
  Screen: React.ComponentType<P>,
  screenName: string,
) {
  const meta = MECHANIC_SHELL_BY_SCREEN[screenName] || { title: screenName, id: 'dashboard' };
  return withWorkshopRoleShell(Screen, meta, MECHANIC_SHELL);
}

export function withPickupShell<P extends { navigation?: any }>(
  Screen: React.ComponentType<P>,
  screenName: string,
) {
  const meta = PICKUP_SHELL_BY_SCREEN[screenName] || { title: screenName, id: 'dashboard' };
  return withWorkshopRoleShell(Screen, meta, PICKUP_SHELL);
}

const OWNER_SHELL = {
  drawerItems: OWNER_CRM_NAV,
  quickItems: OWNER_CRM_QUICK,
  homeScreen: 'WorkshopAdminDashboard',
  roleFallback: 'Workshop Owner',
};

export function withOwnerShell<P extends { navigation?: any }>(
  Screen: React.ComponentType<P>,
  screenName: string,
) {
  const meta = OWNER_SHELL_BY_SCREEN[screenName] || { title: screenName, id: 'dashboard' };
  return withWorkshopRoleShell(Screen, meta, OWNER_SHELL);
}

const styles = StyleSheet.create({
  body: { flex: 1, minHeight: 0, backgroundColor: COLORS.background },
});
