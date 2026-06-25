import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { SMART_TOOLS, SMART_TOOL_WEB_URLS, type SmartToolItem } from '../constants/smartTools';
import SectionHeading from './SectionHeading';

type Props = {
  navigation: any;
  city?: string;
};

const GAP = 10;
const COLS = 4;
const H_PAD = 16;

export default function SmartToolsSection({ navigation, city }: Props) {
  const screenW = Dimensions.get('window').width;
  const tileW = (screenW - H_PAD * 2 - GAP * (COLS - 1)) / COLS;

  const openTool = (tool: SmartToolItem) => {
    if (tool.id === 'car_loan') {
      navigation.navigate('SmartToolWeb', {
        title: 'Loan Against Car',
        url: SMART_TOOL_WEB_URLS.car_loan,
      });
      return;
    }
    if (tool.id === 'parking_finder') {
      navigation.navigate('SmartToolWeb', {
        title: 'Nearby Parking',
        url: SMART_TOOL_WEB_URLS.parking_finder,
        useLocation: true,
        city,
      });
      return;
    }
    navigation.navigate(tool.screen);
  };

  return (
    <View style={styles.wrap}>
      <SectionHeading
        spacing="inline"
        title="Smart Tools"
        subtitle="Smart car utilities for health, pricing, fuel & more"
      />
      <View style={styles.grid}>
        {SMART_TOOLS.map((tool) => (
          <TouchableOpacity
            key={tool.id}
            style={[styles.tile, { width: tileW }]}
            onPress={() => openTool(tool)}
            activeOpacity={0.85}
          >
            <View style={[styles.iconWrap, { backgroundColor: tool.bg }]}>
              <Ionicons name={tool.icon} size={20} color={tool.color} />
            </View>
            <Text style={styles.tileTitle} numberOfLines={3}>
              {tool.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: H_PAD,
    marginTop: 8,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
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
  tileTitle: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 11,
    letterSpacing: 0.1,
  },
});
