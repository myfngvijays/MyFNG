import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppFooter } from '../context/AppFooterContext';

export default function TrustStatsGrid() {
  const { footer } = useAppFooter();
  const trustGrid = footer.trust_grid;

  return (
    <View style={s.trustCard}>
      <View style={s.trustGrid}>
        {trustGrid.map((stat, index) => (
          <View
            key={`${stat.label}-${index}`}
            style={[
              s.trustItem,
              index % 2 === 0 ? s.trustItemBorderRight : null,
              index < 2 ? s.trustItemBorderBottom : null,
            ]}
          >
            <Text style={s.trustValue}>{stat.value}</Text>
            <Text style={s.trustLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  trustCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  trustItem: {
    width: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  trustItemBorderRight: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.15)',
  },
  trustItemBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  trustValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  trustLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
    textAlign: 'center',
  },
});
