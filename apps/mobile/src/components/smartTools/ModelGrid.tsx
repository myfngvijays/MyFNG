import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatModelLabel, type CarModelOption } from '../../lib/compareServicePricing';
import { COLORS } from '../../constants/theme';
import { GRID_GAP, gridTileWidth } from './gridLayout';

type Props = {
  models: CarModelOption[];
  selectedId?: string | null;
  onSelect: (model: CarModelOption) => void;
  columns?: number;
};

export default function ModelGrid({ models, selectedId, onSelect, columns = 3 }: Props) {
  const tileW = useMemo(() => gridTileWidth(columns), [columns]);
  const sorted = useMemo(
    () => [...models].sort((a, b) => a.model_name.localeCompare(b.model_name)),
    [models],
  );

  if (sorted.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="car-outline" size={22} color="#94A3B8" />
        <Text style={styles.emptyText}>No models found for this brand.</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {sorted.map((model) => {
        const active = selectedId === model.id;
        return (
          <TouchableOpacity
            key={model.id}
            style={[styles.tile, { width: tileW }, active ? styles.tileActive : null]}
            onPress={() => onSelect(model)}
            activeOpacity={0.88}
          >
            <Text style={[styles.name, active ? styles.nameActive : null]} numberOfLines={2}>
              {formatModelLabel(model.model_name)}
            </Text>
            {model.class ? (
              <Text style={[styles.meta, active ? styles.metaActive : null]} numberOfLines={1}>
                {formatModelLabel(model.class)}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    minHeight: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileActive: { backgroundColor: '#EFF6FF', borderColor: COLORS.primary },
  name: { fontSize: 11, fontWeight: '800', color: '#334155', textAlign: 'center', lineHeight: 14 },
  nameActive: { color: COLORS.primary },
  meta: { marginTop: 3, fontSize: 9, fontWeight: '700', color: '#94A3B8', textAlign: 'center' },
  metaActive: { color: '#2563EB' },
  empty: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
});
