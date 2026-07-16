import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import BotFace from './BotFace';

export type PublicPillNavTab = 'home' | 'services' | 'ai' | 'roadside' | 'account' | 'search' | 'profile' | 'settings';

type Props = {
  activeTab: PublicPillNavTab;
  onPressTab: (tab: PublicPillNavTab) => void;
};

const MAX_WIDTH = 420;

export default function PublicBottomNav({ activeTab, onPressTab }: Props) {
  const insets = useSafeAreaInsets();
  const w = Dimensions.get('window').width;
  const barWidth = Math.min(MAX_WIDTH, Math.round(w - SPACING.md * 2));
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const glowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });
  const glowScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });

  const normalizedActive: PublicPillNavTab =
    activeTab === 'search'
      ? 'services'
      : activeTab === 'profile' || activeTab === 'settings'
        ? 'account'
        : activeTab;

  const tabs: Array<{
    id: PublicPillNavTab;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconActive: keyof typeof Ionicons.glyphMap;
    special?: boolean;
  }> = [
    { id: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
    { id: 'services', label: 'Services', icon: 'construct-outline', iconActive: 'construct' },
    { id: 'ai', label: 'Misa AI', icon: 'sparkles-outline', iconActive: 'sparkles', special: true },
    { id: 'roadside', label: 'Roadside', icon: 'car-sport-outline', iconActive: 'car-sport' },
    { id: 'account', label: 'Account', icon: 'person-outline', iconActive: 'person' },
  ];

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={[styles.bar, { width: barWidth }]}>
        {tabs.map((tab) => {
          const isActive = normalizedActive === tab.id;
          if (tab.special) {
            return (
              <View key={tab.id} style={styles.aiWrap}>
                <View style={styles.aiButtonHolder}>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.aiGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
                  />
                  <TouchableOpacity
                    style={styles.aiButton}
                    onPress={() => onPressTab(tab.id)}
                    activeOpacity={0.85}
                    hitSlop={{ top: 20, bottom: 16, left: 20, right: 20 }}
                  >
                    <BotFace size={64} scale={0.52} surface="blue" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => onPressTab(tab.id)} activeOpacity={0.85} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <Text style={styles.aiLabel} numberOfLines={1}>{tab.label}</Text>
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive ? styles.tabButtonActive : null]}
              onPress={() => onPressTab(tab.id)}
              activeOpacity={0.85}
              hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
            >
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={22}
                color={isActive ? '#2563EB' : COLORS.secondary}
              />
              <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]} numberOfLines={1}>{tab.label}</Text>
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
    bottom: 0,
    alignItems: 'center',
    zIndex: 999,
    elevation: 24,
  },
  bar: {
    height: 64,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -10 },
    elevation: 12,
    overflow: 'visible',
  },
  tabButton: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabButtonActive: {},
  tabLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#2563EB',
  },
  aiWrap: {
    flex: 1,
    alignItems: 'center',
  },
  aiButtonHolder: {
    width: 64,
    height: 64,
    marginTop: -24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiGlow: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563EB',
  },
  aiButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#F9FAFB',
    shadowColor: '#2563EB',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  aiLabel: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
