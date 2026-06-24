import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FieldInput, PrimaryButton, SecondaryButton, ToolCard } from './HealthCheckShell';
import { COLORS } from '../../constants/theme';
import type { PartsPriceEstimate } from '../../lib/partsPriceEstimate';
import { formatPartsPriceRange } from '../../lib/partsPriceEstimate';

type Props = {
  estimate: PartsPriceEstimate;
  carLabel: string;
  cityName: string;
  onBookService: () => void;
  onCheckAgain: () => void;
};

export default function PartsPriceResultView({
  estimate,
  carLabel,
  cityName,
  onBookService,
  onCheckAgain,
}: Props) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredParts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return estimate.categories.flatMap((cat) =>
      cat.parts
        .filter((p) => {
          const matchCat = activeCategory === 'all' || activeCategory === cat.id;
          const matchQ = !q || p.name.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q);
          return matchCat && matchQ;
        })
        .map((p) => ({
          ...p,
          categoryId: cat.id,
          categoryName: cat.name,
          icon: cat.icon,
        })),
    );
  }, [estimate.categories, query, activeCategory]);

  return (
    <>
      <View style={styles.hero}>
        <View style={styles.heroGlowA} />
        <View style={styles.heroGlowB} />
        <View style={styles.heroBadgeRow}>
          <View style={styles.sourceBadge}>
            <Ionicons
              name={
                estimate.source === 'catalog_fallback'
                  ? 'library-outline'
                  : estimate.source === 'boodmo'
                    ? 'cart-outline'
                    : 'globe-outline'
              }
              size={12}
              color="#BFDBFE"
            />
            <Text style={styles.sourceBadgeText}>
              {estimate.source === 'boodmo_google'
                ? 'Boodmo + Google'
                : estimate.source === 'boodmo'
                  ? 'Boodmo Prices'
                  : estimate.source === 'google'
                    ? 'Google Prices'
                    : 'Catalog Estimate'}
            </Text>
          </View>
        </View>
        <Text style={styles.heroTitle}>Genuine Parts Guide</Text>
        <Text style={styles.heroCar}>{carLabel}</Text>
        <Text style={styles.heroCity}>{cityName}</Text>
        <Text style={styles.heroHint}>{estimate.vehicle_summary}</Text>
      </View>

      <ToolCard variant="soft">
        <Text style={styles.searchLabel}>Search parts</Text>
        <FieldInput
          value={query}
          onChangeText={setQuery}
          placeholder="Brake pads, battery, AC compressor..."
        />
      </ToolCard>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
        <TouchableOpacity
          style={[styles.catChip, activeCategory === 'all' ? styles.catChipActive : null]}
          onPress={() => setActiveCategory('all')}
        >
          <Text style={[styles.catChipText, activeCategory === 'all' ? styles.catChipTextActive : null]}>All</Text>
        </TouchableOpacity>
        {estimate.categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.catChip, activeCategory === cat.id ? styles.catChipActive : null]}
            onPress={() => setActiveCategory(cat.id)}
          >
            <Ionicons name={cat.icon as any} size={13} color={activeCategory === cat.id ? COLORS.primary : '#64748B'} />
            <Text style={[styles.catChipText, activeCategory === cat.id ? styles.catChipTextActive : null]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.partsList}>
        {filteredParts.map((part) => (
          <View key={`${part.categoryId}-${part.name}`} style={styles.partCard}>
            <View style={styles.partTop}>
              <View style={styles.partIconWrap}>
                <Ionicons name={part.icon as any} size={18} color={COLORS.primary} />
              </View>
              <View style={styles.partMeta}>
                <Text style={styles.partName}>{part.name}</Text>
                <Text style={styles.partCat}>{part.categoryName}</Text>
              </View>
            </View>
            <Text style={styles.partPrice}>{formatPartsPriceRange(part.low, part.high)}</Text>
            <Text style={styles.partNote}>
              {part.note || 'Indicative OEM/OES parts range · labour extra'}
            </Text>
          </View>
        ))}
        {filteredParts.length === 0 ? (
          <ToolCard variant="outline">
            <Text style={styles.emptyText}>No parts matched your search.</Text>
          </ToolCard>
        ) : null}
      </View>

      <ToolCard variant="soft">
        <Text style={styles.disclaimerTitle}>Price disclaimer</Text>
        <Text style={styles.disclaimerBody}>{estimate.disclaimer}</Text>
      </ToolCard>

      <PrimaryButton label="Book Service with MyFNG" icon="calendar-outline" onPress={onBookService} />
      <View style={{ height: 10 }} />
      <SecondaryButton label="Check Another Car" onPress={onCheckAgain} />
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: '#0B1F44',
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
    overflow: 'hidden',
  },
  heroGlowA: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },
  heroGlowB: {
    position: 'absolute',
    bottom: -40,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  heroBadgeRow: { flexDirection: 'row', marginBottom: 10 },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.25)',
  },
  sourceBadgeText: { fontSize: 10, fontWeight: '800', color: '#E2E8F0', letterSpacing: 0.4 },
  heroTitle: { fontSize: 12, fontWeight: '800', color: '#93C5FD', letterSpacing: 1, marginBottom: 4 },
  heroCar: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.3 },
  heroCity: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#CBD5E1' },
  heroHint: { marginTop: 8, fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.65)', lineHeight: 16 },
  searchLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 8, letterSpacing: 0.4 },
  catRow: { gap: 8, paddingBottom: 12 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  catChipActive: { backgroundColor: '#EFF6FF', borderColor: COLORS.primary },
  catChipText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  catChipTextActive: { color: COLORS.primary },
  partsList: { gap: 10, marginBottom: 12 },
  partCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EEF7',
  },
  partTop: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  partIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  partMeta: { flex: 1 },
  partName: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  partCat: { marginTop: 2, fontSize: 11, fontWeight: '600', color: '#64748B' },
  partPrice: { fontSize: 20, fontWeight: '900', color: COLORS.primary },
  partNote: { marginTop: 4, fontSize: 10, fontWeight: '600', color: '#94A3B8', lineHeight: 14 },
  disclaimerTitle: { fontSize: 13, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
  disclaimerBody: { fontSize: 12, fontWeight: '600', color: '#64748B', lineHeight: 18 },
  emptyText: { fontSize: 13, fontWeight: '600', color: '#64748B', textAlign: 'center' },
});
