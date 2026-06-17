import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BrandGrid from '../../components/smartTools/BrandGrid';
import SmartToolShell, { ChipRow, PrimaryButton, ToolCard } from '../../components/smartTools/SmartToolShell';
import VehiclePickerCard from '../../components/smartTools/VehiclePickerCard';
import type { PublicBrand } from '../../constants/publicAppData';
import { COLORS } from '../../constants/theme';
import { PARTS_CATALOG, formatInrRange, partsBrandMultiplier } from '../../lib/smartToolsLogic';
import {
  fetchCarBrands,
  fetchCustomerVehicles,
  vehicleFuel,
  vehicleLabel,
  type CustomerVehicle,
} from '../../lib/smartToolsVehicle';

type Props = { navigation: any };

type Step = 'vehicle' | 'brand' | 'details' | 'parts';

export default function CarPartsPriceScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('vehicle');
  const [brands, setBrands] = useState<PublicBrand[]>([]);
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<CustomerVehicle | null>(null);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [regYear, setRegYear] = useState('');
  const [fuel, setFuel] = useState('petrol');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    fetchCarBrands().then(setBrands);
    fetchCustomerVehicles().then((list) => {
      setVehicles(list);
      const def = list.find((v) => v.is_default) || list[0];
      if (def) {
        setSelectedVehicle(def);
        prefill(def);
      }
    });
  }, []);

  const prefill = (v: CustomerVehicle) => {
    if (v.make) setBrand(v.make);
    if (v.model || v.model_name) setModel(v.model || v.model_name || '');
    if (v.year) setRegYear(String(v.year));
    if (v.fuel_type) setFuel(vehicleFuel(v));
  };

  const multiplier = useMemo(() => partsBrandMultiplier(brand), [brand]);

  const filteredParts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PARTS_CATALOG.flatMap((cat) =>
      cat.parts
        .filter((p) => {
          const matchCat = activeCategory === 'all' || activeCategory === cat.id;
          const matchQ = !q || p.name.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q);
          return matchCat && matchQ;
        })
        .map((p) => ({ ...p, categoryId: cat.id, categoryName: cat.name, icon: cat.icon })),
    );
  }, [query, activeCategory]);

  if (step === 'parts') {
    return (
      <SmartToolShell title="Check Parts Price" subtitle={`${brand} ${model}`.trim()} navigation={navigation}>
        <ToolCard>
          <Text style={styles.label}>Search part</Text>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search brake pads, battery, filter..."
            placeholderTextColor="#9CA3AF"
          />
        </ToolCard>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          <TouchableOpacity style={[styles.catChip, activeCategory === 'all' ? styles.catChipActive : null]} onPress={() => setActiveCategory('all')}>
            <Text style={[styles.catChipText, activeCategory === 'all' ? styles.catChipTextActive : null]}>All</Text>
          </TouchableOpacity>
          {PARTS_CATALOG.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catChip, activeCategory === cat.id ? styles.catChipActive : null]}
              onPress={() => setActiveCategory(cat.id)}
            >
              <Ionicons name={cat.icon as any} size={14} color={activeCategory === cat.id ? COLORS.primary : '#6B7280'} />
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
              <Text style={styles.partPrice}>{formatInrRange(Math.round(part.low * multiplier), Math.round(part.high * multiplier))}</Text>
              <Text style={styles.partNote}>Indicative range • labour extra</Text>
            </View>
          ))}
        </View>

        <ToolCard>
          <Text style={styles.disclaimerTitle}>Price Disclaimer</Text>
          <Text style={styles.disclaimerBody}>
            Prices are indicative ranges sourced from market references including Boodmo and other OEM/part portals. These are not fixed prices and may vary by model variant, city, availability and workshop.
          </Text>
        </ToolCard>
      </SmartToolShell>
    );
  }

  if (step === 'brand') {
    return (
      <SmartToolShell title="Select Brand" subtitle="Choose car brand" navigation={navigation} footer={<PrimaryButton label="Continue" onPress={() => brand && setStep('details')} />}>
        <BrandGrid brands={brands} selected={brand} onSelect={(b) => setBrand(b.name)} columns={3} />
      </SmartToolShell>
    );
  }

  if (step === 'details') {
    return (
      <SmartToolShell title="Car Details" subtitle={brand} navigation={navigation} footer={<PrimaryButton label="Check Parts Prices" onPress={() => setStep('parts')} />}>
        <ToolCard>
          <Text style={styles.label}>Model</Text>
          <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="Enter model" placeholderTextColor="#9CA3AF" />
          <Text style={[styles.label, { marginTop: 12 }]}>Registration Year</Text>
          <TextInput style={styles.input} value={regYear} onChangeText={setRegYear} keyboardType="numeric" placeholder="2020" placeholderTextColor="#9CA3AF" />
          <Text style={[styles.label, { marginTop: 12 }]}>Fuel Type</Text>
          <ChipRow
            options={[
              { label: 'Petrol', value: 'petrol' },
              { label: 'Diesel', value: 'diesel' },
              { label: 'CNG', value: 'cng' },
              { label: 'EV', value: 'ev' },
            ]}
            value={fuel}
            onChange={setFuel}
          />
        </ToolCard>
      </SmartToolShell>
    );
  }

  return (
    <SmartToolShell title="Check Parts Price" subtitle="Indicative genuine parts range" navigation={navigation}>
      <VehiclePickerCard
        vehicles={vehicles}
        selectedId={selectedVehicle?.id || (selectedVehicle ? vehicleLabel(selectedVehicle) : null)}
        onSelect={(v) => {
          if (!v) return;
          setSelectedVehicle(v);
          prefill(v);
          setStep('parts');
        }}
        onAddOther={() => setStep('brand')}
      />
      <ToolCard>
        <Text style={styles.cardTitle}>Select your car</Text>
        <Text style={styles.cardBody}>We use your car details to estimate part price ranges more accurately.</Text>
        <View style={{ marginTop: 12, gap: 10 }}>
          {selectedVehicle ? <PrimaryButton label={`Continue with ${vehicleLabel(selectedVehicle)}`} onPress={() => setStep('parts')} /> : null}
          <PrimaryButton label="Select Brand Manually" onPress={() => setStep('brand')} />
        </View>
      </ToolCard>
    </SmartToolShell>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '800', color: COLORS.gray[500], textTransform: 'uppercase', marginBottom: 8 },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  cardTitle: { fontSize: 14, fontWeight: '900', color: '#111827', marginBottom: 6 },
  cardBody: { fontSize: 12, fontWeight: '600', color: '#6B7280', lineHeight: 18 },
  catRow: { gap: 8, paddingBottom: 12 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  catChipActive: { backgroundColor: '#EFF6FF', borderColor: COLORS.primary },
  catChipText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  catChipTextActive: { color: COLORS.primary },
  partsList: { gap: 10, marginBottom: 12 },
  partCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  partTop: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  partIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  partMeta: { flex: 1 },
  partName: { fontSize: 14, fontWeight: '900', color: '#111827' },
  partCat: { marginTop: 2, fontSize: 11, fontWeight: '600', color: '#6B7280' },
  partPrice: { fontSize: 18, fontWeight: '900', color: '#2563EB' },
  partNote: { marginTop: 4, fontSize: 10, fontWeight: '600', color: '#9CA3AF' },
  disclaimerTitle: { fontSize: 13, fontWeight: '900', color: '#111827', marginBottom: 6 },
  disclaimerBody: { fontSize: 12, fontWeight: '600', color: '#6B7280', lineHeight: 18 },
});
