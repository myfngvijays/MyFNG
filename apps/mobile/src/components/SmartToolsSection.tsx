import React, { useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSmartToolsSlot } from '../hooks/useSmartToolsDisplay';
import type { SmartToolScreen } from '../lib/smartToolsPlacements';
import SectionHeading from './SectionHeading';

type Props = {
  screen: SmartToolScreen;
  slot: string;
  navigation: any;
  city?: string;
  compact?: boolean;
};

const GAP = 10;
const COLS = 4;
const H_PAD = 16;

export default function SmartToolsBlock({ screen, slot, navigation, city, compact = false }: Props) {
  const [gridWidth, setGridWidth] = useState(Dimensions.get('window').width - H_PAD * 4);
  const { section, tools, loading, visible, showSectionHeading, openTool } = useSmartToolsSlot({
    screen,
    slot,
    navigation,
    city,
  });

  const tileW = Math.floor((gridWidth - GAP * (COLS - 1)) / COLS);

  if (loading || !visible) return null;

  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null]}>
      {showSectionHeading ? (
        <SectionHeading spacing="inline" title={section.title} subtitle={section.subtitle} />
      ) : null}
      <View
        style={styles.grid}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          if (width > 0) setGridWidth(width);
        }}
      >
        {tools.map((tool) => (
          <TouchableOpacity
            key={tool.id}
            style={[styles.tile, { width: tileW }]}
            onPress={() => openTool(tool)}
            activeOpacity={0.85}
          >
            <View style={[styles.iconWrap, compact ? styles.iconWrapCompact : null, { backgroundColor: tool.bg }]}>
              <Ionicons name={tool.icon} size={compact ? 18 : 20} color={tool.color} />
            </View>
            <Text style={[styles.tileTitle, compact ? styles.tileTitleCompact : null]} numberOfLines={3}>
              {tool.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/** Backward-compatible default home main grid */
export function SmartToolsSection({ navigation, city }: { navigation: any; city?: string }) {
  return <SmartToolsBlock screen="home" slot="main_grid" navigation={navigation} city={city} />;
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: H_PAD,
    marginTop: 8,
    marginBottom: 8,
  },
  wrapCompact: {
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    width: '100%',
  },
  tile: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconWrapCompact: {
    width: 46,
    height: 46,
    borderRadius: 14,
  },
  tileTitle: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 11,
    letterSpacing: 0.1,
  },
  tileTitleCompact: {
    fontSize: 10,
    lineHeight: 13,
  },
});
