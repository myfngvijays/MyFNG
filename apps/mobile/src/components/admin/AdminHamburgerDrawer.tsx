import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { SA_NAV, SA_QUICK, type SaNavLeaf } from '../../constants/superAdminNav';

type Props = {
  visible: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
  activeId?: string;
  onSelect: (leaf: SaNavLeaf) => void;
  onLogout: () => void;
};

export default function AdminHamburgerDrawer({
  visible,
  onClose,
  userName,
  userEmail,
  activeId,
  onSelect,
  onLogout,
}: Props) {
  const insets = useSafeAreaInsets();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    operations: true,
  });

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const run = (leaf: SaNavLeaf) => {
    onSelect(leaf);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.drawerRoot}>
        <View style={styles.drawerPanel}>
          <View style={styles.drawerSafe}>
            <View style={[styles.tcHeader, { paddingTop: Math.max(insets.top, 16) + 6 }]}>
              <View style={styles.tcAvatar}>
                <Image
                  source={require('../../../assets/logo.png')}
                  style={styles.tcAvatarLogo}
                  resizeMode="cover"
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.tcName} numberOfLines={1}>
                  {userName || 'Super Admin'}
                </Text>
                <Text style={styles.tcEmail} numberOfLines={1}>
                  {userEmail || 'Super Admin Control Panel'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.tcClose}>
                <Ionicons name="close" size={20} color="#E0F2FE" />
              </TouchableOpacity>
            </View>

            <View style={styles.tcQuickRow}>
              {SA_QUICK.map((q) => (
                <TouchableOpacity key={q.id} style={styles.tcQuick} onPress={() => run(q)}>
                  <Ionicons name={q.icon} size={22} color="#FFFFFF" />
                  <Text style={styles.tcQuickLbl}>{q.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.tcDivider} />

            <ScrollView
              contentContainerStyle={[styles.drawerList, { paddingBottom: 32 + insets.bottom }]}
              keyboardShouldPersistTaps="handled"
            >
              {SA_NAV.map((row) => {
                if (row.type === 'item') {
                  const active = activeId === row.id || (row.kind === 'home' && activeId === 'home');
                  return (
                    <TouchableOpacity
                      key={row.id}
                      style={[styles.tcRow, active && styles.tcRowActive]}
                      onPress={() => run(row)}
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
                }

                const open = Boolean(openGroups[row.id]);
                return (
                  <View key={row.id}>
                    <TouchableOpacity
                      style={styles.tcRow}
                      onPress={() => toggleGroup(row.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={row.icon} size={20} color="rgba(255,255,255,0.92)" />
                      <Text style={styles.tcRowText}>{row.label}</Text>
                      <Ionicons
                        name={open ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="rgba(255,255,255,0.65)"
                      />
                    </TouchableOpacity>
                    {open
                      ? row.children.map((child) => {
                          const active = activeId === child.id;
                          return (
                            <TouchableOpacity
                              key={child.id}
                              style={[styles.tcChild, active && styles.tcRowActive]}
                              onPress={() => run(child)}
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={child.icon}
                                size={18}
                                color="rgba(226,232,240,0.95)"
                              />
                              <Text style={[styles.tcChildText, active && styles.tcRowTextActive]}>
                                {child.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })
                      : null}
                  </View>
                );
              })}

              <View style={styles.tcDivider} />
              <TouchableOpacity style={styles.tcLogoutRow} onPress={onLogout} activeOpacity={0.75}>
                <Ionicons name="log-out-outline" size={20} color="#FECACA" />
                <Text style={styles.tcLogoutText}>Logout</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        <Pressable style={styles.drawerScrim} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  tcChild: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 44,
    paddingRight: 16,
  },
  tcChildText: { flex: 1, fontSize: 13, fontWeight: '500', color: 'rgba(226,232,240,0.92)' },
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
