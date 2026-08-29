import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useNotifications } from '../../context/NotificationContext';
import { setAndroidShellBackHandler } from '../../lib/androidShellBack';
import { COLORS } from '../../constants/theme';
import type { WorkshopCrmNavItem } from '../../constants/workshopCrmNav';

type Props = {
  title: string;
  userName?: string | null;
  userEmail?: string | null;
  roleFallback: string;
  navigation: any;
  homeTabId?: string;
  drawerItems: WorkshopCrmNavItem[];
  quickItems?: WorkshopCrmNavItem[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  children: React.ReactNode;
};

export default function WorkshopCrmShell({
  title,
  userName,
  userEmail,
  roleFallback,
  navigation,
  homeTabId = 'dashboard',
  drawerItems,
  quickItems,
  activeTab = 'dashboard',
  onTabChange,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);

  const drawerTopPad =
    Math.max(
      insets.top,
      Platform.OS === 'android' ? StatusBar.currentHeight || 28 : 50,
    ) + 12;

  const goHome = useCallback(() => {
    setMenuOpen(false);
    if (onTabChange) {
      onTabChange(homeTabId);
      return;
    }
    if (navigation?.canGoBack?.()) {
      navigation.popToTop?.();
    }
  }, [homeTabId, navigation, onTabChange]);

  const runNav = useCallback(
    (item: WorkshopCrmNavItem) => {
      setMenuOpen(false);
      if (item.kind === 'tab') {
        onTabChange?.(item.id);
        return;
      }
      if (item.screen) {
        try {
          navigation.navigate(item.screen);
        } catch {
          /* screen missing from this stack */
        }
      }
    },
    [navigation, onTabChange],
  );

  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Logout karna hai?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          setMenuOpen(false);
          await supabase.auth.signOut();
        },
      },
    ]);
  }, []);

  const consumeInnerBack = useCallback(() => {
    if (menuOpen) {
      setMenuOpen(false);
      return true;
    }
    if (onTabChange && activeTab !== homeTabId) {
      onTabChange(homeTabId);
      return true;
    }
    return false;
  }, [activeTab, homeTabId, menuOpen, onTabChange]);

  useEffect(() => {
    setAndroidShellBackHandler(consumeInnerBack);
    return () => setAndroidShellBackHandler(null);
  }, [consumeInnerBack]);

  const displayName = userName?.trim() || roleFallback;
  const displayEmail = userEmail?.trim() || '—';
  const isHome = activeTab === homeTabId;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.topBar}>
        <View style={styles.topSide} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setMenuOpen(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            <Ionicons name="menu" size={26} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={[styles.topTitle, isHome && styles.topTitleHome]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.topCenter} pointerEvents="box-none">
          <TouchableOpacity
            onPress={goHome}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Go to home"
          >
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.topLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
        <View style={styles.topSideRight} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => {
              try {
                navigation.navigate('Notifications');
              } catch {
                /* ignore */
              }
            }}
            accessibilityLabel={
              unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
            }
          >
            <Ionicons name="notifications-outline" size={22} color={COLORS.primary} />
            {unreadCount > 0 ? (
              <View style={styles.topBadge}>
                <Text style={styles.topBadgeText}>
                  {unreadCount > 99 ? '99+' : String(unreadCount)}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={handleLogout}
            accessibilityLabel="Logout"
            accessibilityRole="button"
          >
            <Ionicons name="log-out-outline" size={22} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>{children}</View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.drawerRoot}>
          <View style={styles.drawerPanel}>
            <View style={styles.drawerSafe}>
              <View style={[styles.tcHeader, { paddingTop: drawerTopPad }]}>
                <View style={styles.tcAvatar}>
                  <Image
                    source={require('../../../assets/profile-default.png')}
                    style={styles.tcAvatarLogo}
                    resizeMode="cover"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.tcName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={styles.tcEmail} numberOfLines={1}>
                    {displayEmail}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setMenuOpen(false)}
                  hitSlop={12}
                  style={styles.tcClose}
                >
                  <Ionicons name="close" size={20} color="#E0F2FE" />
                </TouchableOpacity>
              </View>

              {quickItems && quickItems.length > 0 ? (
                <View style={styles.tcQuickRow}>
                  {quickItems.map((q) => (
                    <TouchableOpacity
                      key={q.id}
                      style={styles.tcQuick}
                      onPress={() => runNav(q)}
                    >
                      <Ionicons name={q.icon} size={22} color="#FFFFFF" />
                      <Text style={styles.tcQuickLbl}>{q.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <View style={styles.tcDivider} />

              <ScrollView
                contentContainerStyle={[styles.drawerList, { paddingBottom: 32 + insets.bottom }]}
                keyboardShouldPersistTaps="handled"
              >
                {drawerItems.map((row) => {
                  const active = row.kind === 'tab' && activeTab === row.id;
                  return (
                    <TouchableOpacity
                      key={`${row.kind}-${row.id}-${row.screen || ''}`}
                      style={[styles.tcRow, active && styles.tcRowActive]}
                      onPress={() => runNav(row)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={row.icon}
                        size={20}
                        color={active ? '#FFFFFF' : 'rgba(255,255,255,0.92)'}
                      />
                      <Text style={[styles.tcRowText, active && styles.tcRowTextActive]}>
                        {row.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <View style={styles.tcDivider} />
                <TouchableOpacity
                  style={styles.tcLogoutRow}
                  onPress={handleLogout}
                  activeOpacity={0.75}
                  accessibilityLabel="Logout"
                >
                  <Ionicons name="log-out-outline" size={20} color="#FECACA" />
                  <Text style={styles.tcLogoutText}>Logout</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
          <Pressable style={styles.drawerScrim} onPress={() => setMenuOpen(false)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, position: 'relative' },
  body: { flex: 1, minHeight: 0 },
  topBar: {
    zIndex: 20,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
    position: 'relative',
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBadge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  topBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  topSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    zIndex: 1,
  },
  topSideRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  topCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
    elevation: 6,
  },
  topLogo: {
    width: 108,
    height: 32,
  },
  topTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textHeading,
    textAlign: 'left',
    maxWidth: 96,
  },
  topTitleHome: {
    color: COLORS.primary,
  },
  drawerRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  drawerScrim: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  drawerPanel: {
    width: 278,
    maxWidth: '80%',
    backgroundColor: COLORS.primary,
    elevation: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 4, height: 0 },
    overflow: 'hidden',
  },
  drawerSafe: { flex: 1, backgroundColor: COLORS.primary },
  drawerList: { paddingBottom: 32, paddingTop: 4 },
  tcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  tcAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  tcAvatarLogo: { width: 48, height: 48 },
  tcName: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  tcEmail: { fontSize: 11, color: 'rgba(226,232,240,0.85)', marginTop: 2 },
  tcClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tcQuickRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tcQuick: { alignItems: 'center', gap: 5, minWidth: 68 },
  tcQuickLbl: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  tcDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginHorizontal: 12,
    marginBottom: 4,
  },
  tcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tcRowActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  tcRowText: { flex: 1, fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.95)' },
  tcRowTextActive: { color: '#FFFFFF', fontWeight: '800' },
  tcLogoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  tcLogoutText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#FECACA',
  },
});
