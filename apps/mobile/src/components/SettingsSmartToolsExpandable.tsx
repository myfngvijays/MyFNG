import React, { useState } from 'react';
import {
  Dimensions,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSmartToolsSlot } from '../hooks/useSmartToolsDisplay';

type Props = {
  navigation: any;
  city?: string;
};

const GAP = 8;
const COLS = 4;
const OUTER_PAD = 16;
const PANEL_PAD = 12;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function formatSettingsSubtitle(text: string): string {
  const normalized = String(text || '').trim();
  const marker = 'health,';
  const idx = normalized.toLowerCase().indexOf(marker);
  if (idx >= 0) {
    const line1 = normalized.slice(0, idx + marker.length).trim();
    const line2 = normalized.slice(idx + marker.length).trim();
    if (line2) return `${line1}\n${line2}`;
  }
  return normalized;
}

export default function SettingsSmartToolsExpandable({ navigation, city }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [gridWidth, setGridWidth] = useState(Dimensions.get('window').width - OUTER_PAD * 2 - PANEL_PAD * 2);
  const { section, tools, loading, visible, openTool } = useSmartToolsSlot({
    screen: 'settings',
    slot: 'before_menu',
    navigation,
    city,
  });

  const tileW = Math.floor((gridWidth - GAP * (COLS - 1)) / COLS);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  if (loading || !visible) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.cardOuter}>
        <View style={styles.shineStrip} />
        <TouchableOpacity style={styles.headerRow} onPress={toggleExpanded} activeOpacity={0.92}>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>
              {tools.length} tool{tools.length === 1 ? '' : 's'}
            </Text>
          </View>

          <View style={styles.headerMain}>
            <View style={styles.iconWrap}>
              <View style={styles.iconInner}>
                <MaterialCommunityIcons name="car-wrench" size={24} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>{section.title}</Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {formatSettingsSubtitle(section.subtitle)}
              </Text>
            </View>
            <View style={styles.chevronWrap}>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#FFFFFF" />
            </View>
          </View>
        </TouchableOpacity>

        {expanded ? (
          <View
            style={styles.toolsPanel}
            onLayout={(event) => {
              const width = event.nativeEvent.layout.width;
              if (width > 0) setGridWidth(width);
            }}
          >
            <View style={[styles.grid, { width: gridWidth }]}>
              {tools.map((tool) => (
                <TouchableOpacity
                  key={tool.id}
                  style={[styles.tile, { width: tileW }]}
                  onPress={() => openTool(tool)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.toolIconWrap, { backgroundColor: tool.bg }]}>
                    <Ionicons name={tool.icon} size={17} color={tool.color} />
                  </View>
                  <Text style={styles.tileTitle} numberOfLines={3}>
                    {tool.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  cardOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1D4ED8',
    borderWidth: 1,
    borderColor: '#60A5FA',
    shadowColor: '#2563EB',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  shineStrip: {
    height: 3,
    backgroundColor: '#93C5FD',
    opacity: 0.95,
  },
  headerRow: {
    position: 'relative',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#2563EB',
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    paddingRight: 2,
  },
  countPill: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  countPillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 6,
    marginTop: -2,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 19,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 12,
  },
  chevronWrap: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginBottom: 0,
  },
  toolsPanel: {
    paddingHorizontal: PANEL_PAD,
    paddingTop: 4,
    paddingBottom: 14,
    backgroundColor: '#EFF6FF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    alignSelf: 'center',
  },
  tile: {
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  toolIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  tileTitle: {
    fontSize: 8,
    fontWeight: '800',
    color: '#1E3A8A',
    textAlign: 'center',
    lineHeight: 10,
  },
});
