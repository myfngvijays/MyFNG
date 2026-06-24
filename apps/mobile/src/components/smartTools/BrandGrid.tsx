import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PublicBrand } from '../../constants/publicAppData';
import { COLORS } from '../../constants/theme';
import { GRID_GAP, gridTileWidth } from './gridLayout';

type Props = {
  brands: PublicBrand[];
  selected?: string;
  onSelect: (brand: PublicBrand) => void;
  columns?: number;
};

export default function BrandGrid({ brands, selected, onSelect, columns = 3 }: Props) {
  const tileW = useMemo(() => gridTileWidth(columns), [columns]);

  return (
    <View style={styles.grid}>
      {brands.map((brand) => {
        const active = selected === brand.name;
        return (
          <TouchableOpacity
            key={brand.name}
            style={[styles.tile, { width: tileW }, active ? styles.tileActive : null]}
            onPress={() => onSelect(brand)}
            activeOpacity={0.88}
          >
            <View style={[styles.logoWrap, active ? styles.logoWrapActive : null]}>
              {brand.logo ? (
                <Image source={{ uri: brand.logo }} style={styles.logo} resizeMode="contain" />
              ) : (
                <Ionicons name="car-sport" size={20} color={COLORS.primary} />
              )}
            </View>
            <Text style={[styles.name, active ? styles.nameActive : null]} numberOfLines={2}>
              {brand.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    minHeight: 92,
    justifyContent: 'center',
  },
  tileActive: { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logoWrapActive: { backgroundColor: '#DBEAFE', borderColor: '#93C5FD' },
  logo: { width: 32, height: 32 },
  name: { fontSize: 10, fontWeight: '800', color: '#475569', textAlign: 'center', lineHeight: 13 },
  nameActive: { color: COLORS.primary },
});
