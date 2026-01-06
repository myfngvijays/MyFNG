import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { Icon } from './Icon';

interface BottomNavProps {
  activeTab: string;
  onTabChange?: (tab: string) => void;
  // Legacy prop name used by some screens
  onTabPress?: (tab: string) => void;
  tabs: Array<{
    id: string;
    label: string;
    icon: string; // Icon name for Icon component
  }>;
}

export default function BottomNav({ activeTab, onTabChange, onTabPress, tabs }: BottomNavProps) {
  const handlePress = (tabId: string) => {
    (onTabChange || onTabPress)?.(tabId);
  };
  return (
    <View style={styles.container}>
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
          <Text style={[
            styles.label,
            activeTab === tab.id && styles.activeLabel
          ]}>
            {tab.label}
          </Text>
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
    paddingBottom: SPACING.md + 4,
    paddingTop: SPACING.sm,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
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
});

