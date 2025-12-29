import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';

export type PublicPillNavTab = 'ai' | 'search' | 'profile' | 'settings';

type Props = {
  activeTab: PublicPillNavTab;
  onPressTab: (tab: PublicPillNavTab) => void;
};

const MAX_WIDTH = 420;

export default function PublicPillNav({ activeTab, onPressTab }: Props) {
  const w = Dimensions.get('window').width;
  const pillWidth = Math.min(MAX_WIDTH, Math.round(w - SPACING.md * 2));

  // Market-style: AI in the center, Profile at the end (right).
  const tabs: Array<{ id: PublicPillNavTab; icon: string; iconActive: string }> = [
    { id: 'search', icon: 'search-outline', iconActive: 'search' },
    { id: 'ai', icon: 'flash-outline', iconActive: 'flash' },
    { id: 'profile', icon: 'person-outline', iconActive: 'person' },
  ];

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={[styles.pill, { width: pillWidth }]}>
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          const isAi = t.id === 'ai';
          return (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.iconBtn,
                isAi ? styles.aiBtn : null,
                isActive && !isAi ? styles.iconBtnActive : null,
              ]}
              onPress={() => onPressTab(t.id)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={(isActive ? t.iconActive : t.icon) as any}
                size={22}
                color={isAi ? '#fff' : isActive ? COLORS.purple : 'rgba(255,255,255,0.72)'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: SPACING.md,
    alignItems: 'center',
  },
  pill: {
    height: 58,
    borderRadius: 999,
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    backgroundColor: 'rgba(139,92,246,0.14)',
  },
  aiBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.purple,
    marginTop: -12,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
});


