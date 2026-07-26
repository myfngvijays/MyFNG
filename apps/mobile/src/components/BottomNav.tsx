import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import { Icon } from './Icon';

interface BottomNavProps {
  activeTab: string;
  onTabChange?: (tab: string) => void;
  onTabPress?: (tab: string) => void;
  tabs: Array<{
    id: string;
    label: string;
    icon: string;
  }>;
}

export default function BottomNav({ activeTab, onTabChange, onTabPress, tabs }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const handlePress = (tabId: string) => {
    (onTabChange || onTabPress)?.(tabId);
  };

  const isCrmFive =
    tabs.length === 5 &&
    tabs.some((t) => t.id === 'book') &&
    tabs.some((t) => t.id === 'home');

  if (isCrmFive) {
    const bookTab = tabs.find((t) => t.id === 'book')!;
    const sideTabs = tabs.filter((t) => t.id !== 'book');
    const left = sideTabs.slice(0, 2);
    const right = sideTabs.slice(2);

    return (
      <View style={[styles.crmShell, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={styles.crmBar}>
          {left.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={styles.crmTab}
                onPress={() => handlePress(tab.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.crmIconWrap, active && styles.crmIconWrapActive]}>
                  <Icon name={tab.icon} size={20} color={active ? '#FFFFFF' : 'rgba(255,255,255,0.85)'} />
                </View>
                <Text style={[styles.crmLabel, active && styles.crmLabelActive]} numberOfLines={1}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.crmCenterSlot}>
            <TouchableOpacity
              style={[styles.crmFab, activeTab === 'book' && styles.crmFabActive]}
              onPress={() => handlePress(bookTab.id)}
              activeOpacity={0.85}
            >
              <Icon name={bookTab.icon || 'plus'} size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <Text
              style={[
                styles.crmLabel,
                styles.crmFabLabel,
                activeTab === 'book' && styles.crmLabelActive,
              ]}
            >
              {bookTab.label}
            </Text>
          </View>

          {right.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={styles.crmTab}
                onPress={() => handlePress(tab.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.crmIconWrap, active && styles.crmIconWrapActive]}>
                  <Icon name={tab.icon} size={20} color={active ? '#FFFFFF' : 'rgba(255,255,255,0.85)'} />
                </View>
                <Text style={[styles.crmLabel, active && styles.crmLabelActive]} numberOfLines={1}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.activeTab]}
          onPress={() => handlePress(tab.id)}
        >
          <Icon
            name={tab.icon}
            size={24}
            color={activeTab === tab.id ? COLORS.primary : COLORS.textSecondary}
          />
          <Text style={[styles.label, activeTab === tab.id && styles.activeLabel]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
    paddingTop: SPACING.sm,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
    zIndex: 30,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
    borderRadius: 12,
    marginHorizontal: SPACING.xs,
  },
  activeTab: {
    backgroundColor: COLORS.primary + '10',
  },
  label: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
    fontFamily: 'Poppins',
    marginTop: SPACING.xs,
  },
  activeLabel: {
    color: COLORS.primary,
    fontWeight: '600',
  },

  crmShell: {
    backgroundColor: 'transparent',
    zIndex: 40,
    // Room so the Book FAB can sit slightly above the bar without clipping
    paddingTop: 12,
  },
  crmBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    marginHorizontal: 12,
    marginBottom: 2,
    borderRadius: 24,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#003A8C',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
      },
      android: { elevation: 14 },
    }),
  },
  crmTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 2,
  },
  crmIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crmIconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  crmLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    fontFamily: 'Poppins',
  },
  crmLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  // Same flex as side tabs so Engage/Me don't get extra empty width
  crmCenterSlot: {
    flex: 1,
    alignItems: 'center',
    marginTop: -10,
  },
  crmFab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    ...Platform.select({
      ios: {
        shadowColor: '#001F4D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  crmFabActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  crmFabLabel: {
    marginTop: 1,
  },
});
