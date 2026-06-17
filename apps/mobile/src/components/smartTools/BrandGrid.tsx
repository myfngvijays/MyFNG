import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PublicBrand } from '../../constants/publicAppData';
import { COLORS } from '../../constants/theme';

type Props = {
  brands: PublicBrand[];
  selected?: string;
  onSelect: (brand: PublicBrand) => void;
  columns?: number;
};

const H_PAD = 0;
const GAP = 8;

export default function BrandGrid({ brands, selected, onSelect, columns = 3 }: Props) {
  const tileW = (Dimensions.get('window').width - 32 - H_PAD * 2 - GAP * (columns - 1)) / columns;

  return (
    <View style={styles.grid}>
      {brands.map((brand) => {
        const active = selected === brand.name;
        return (
          <TouchableOpacity
            key={brand.name}
            style={[styles.tile, active ? styles.tileActive : null, { width: tileW }]}
            onPress={() => onSelect(brand)}
            activeOpacity={0.85}
          >
            <View style={[styles.logoWrap, active ? styles.logoWrapActive : null]}>
              {brand.logo ? (
                <Image source={{ uri: brand.logo }} style={styles.logo} resizeMode="contain" />
              ) : (
                <Ionicons name="car-sport" size={22} color={COLORS.primary} />
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  tile: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 4,
  },
  tileActive: { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' },
  logoWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logoWrapActive: { backgroundColor: '#DBEAFE' },
  logo: { width: 40, height: 40 },
  name: { fontSize: 10, fontWeight: '700', color: '#4B5563', textAlign: 'center', lineHeight: 13 },
  nameActive: { color: COLORS.primary },
});
