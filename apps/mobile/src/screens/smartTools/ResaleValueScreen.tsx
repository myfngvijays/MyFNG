import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import BrandGrid from '../../components/smartTools/BrandGrid';
import SmartToolShell, { ChipRow, PrimaryButton, ToolCard } from '../../components/smartTools/SmartToolShell';
import VehiclePickerCard from '../../components/smartTools/VehiclePickerCard';
import type { PublicBrand } from '../../constants/publicAppData';
import { COLORS } from '../../constants/theme';
import { estimateResaleValue, formatInrRange } from '../../lib/smartToolsLogic';
import {
  fetchCarBrands,
  fetchCustomerVehicles,
  fetchSmartToolCity,
  vehicleFuel,
  vehicleLabel,
  type CustomerVehicle,
} from '../../lib/smartToolsVehicle';

type Props = { navigation: any };

type Step = 'vehicle' | 'brand' | 'details' | 'result';

export default function ResaleValueScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('vehicle');
  const [brands, setBrands] = useState<PublicBrand[]>([]);
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<CustomerVehicle | null>(null);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [regYear, setRegYear] = useState('');
  const [fuel, setFuel] = useState('petrol');
  const [km, setKm] = useState('');
  const [owners, setOwners] = useState('1');
  const [condition, setCondition] = useState('good');
  const [hadAccident, setHadAccident] = useState('no');
  const [city, setCity] = useState('Your City');
  const [cityTier, setCityTier] = useState('metro');

  useEffect(() => {
    fetchCarBrands().then(setBrands);
    fetchCustomerVehicles().then((list) => {
      setVehicles(list);
      const def = list.find((v) => v.is_default) || list[0];
      if (def) {
        setSelectedVehicle(def);
        prefillVehicle(def);
      }
    });
    fetchSmartToolCity().then(setCity);
  }, []);

  const prefillVehicle = (v: CustomerVehicle) => {
    if (v.make) setBrand(v.make);
    if (v.model || v.model_name) setModel(v.model || v.model_name || '');
    if (v.year) setRegYear(String(v.year));
    if (v.fuel_type) setFuel(vehicleFuel(v));
    if (v.odometer_km) setKm(String(v.odometer_km));
  };

  const estimate = useMemo(() => {
    return estimateResaleValue({
      brand,
      year: Number(regYear) || new Date().getFullYear(),
      fuel,
      km: Number(km) || 0,
      owners: Number(owners) || 1,
      condition: condition as 'excellent' | 'good' | 'fair' | 'poor',
      cityTier: cityTier as 'metro' | 'tier2' | 'other',
      hadAccident: hadAccident === 'yes',
    });
  }, [brand, regYear, fuel, km, owners, condition, cityTier, hadAccident]);

  if (step === 'result') {
    return (
      <SmartToolShell title="Car Resale Value" subtitle="Estimated market range" navigation={navigation}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Estimated Resale Value</Text>
          <Text style={styles.heroRange}>{formatInrRange(estimate.low, estimate.high)}</Text>
          <Text style={styles.heroMeta}>
            {brand} {model} • {regYear} • {Number(km || 0).toLocaleString('en-IN')} km • {owners} owner(s)
          </Text>
          <Text style={styles.heroCity}>City: {city}</Text>
        </View>

        <ToolCard>
          <Text style={styles.cardTitle}>How we calculate</Text>
          <Text style={styles.cardBody}>
            This range is based on depreciation, mileage, brand demand, condition, ownership history, accident history and city factor. Final price may change after physical inspection.
          </Text>
        </ToolCard>

        <PrimaryButton label="Calculate Again" onPress={() => setStep('vehicle')} />
      </SmartToolShell>
    );
  }

  if (step === 'brand') {
    return (
      <SmartToolShell
        title="Select Brand"
        subtitle="Choose your car brand"
        navigation={navigation}
        footer={<PrimaryButton label="Continue" onPress={() => brand && setStep('details')} />}
      >
        <BrandGrid brands={brands} selected={brand} onSelect={(b) => setBrand(b.name)} columns={3} />
      </SmartToolShell>
    );
  }

  if (step === 'details') {
    return (
      <SmartToolShell
        title="Car Details"
        subtitle={`${brand}${model ? ` • ${model}` : ''}`}
        navigation={navigation}
        footer={<PrimaryButton label="Get Estimate" onPress={() => setStep('result')} />}
      >
        <ToolCard>
          <Text style={styles.label}>Model Name</Text>
          <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="e.g. Swift, i20, Nexon" placeholderTextColor="#9CA3AF" />
          <Text style={[styles.label, { marginTop: 12 }]}>Registration Year</Text>
          <TextInput style={styles.input} value={regYear} onChangeText={setRegYear} keyboardType="numeric" placeholder="2021" placeholderTextColor="#9CA3AF" />
        </ToolCard>

        <ToolCard>
          <Text style={styles.label}>Fuel Type</Text>
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
          <Text style={[styles.label, { marginTop: 12 }]}>KM Driven</Text>
          <TextInput style={styles.input} value={km} onChangeText={setKm} keyboardType="numeric" placeholder="Enter odometer reading" placeholderTextColor="#9CA3AF" />
        </ToolCard>

        <ToolCard>
          <Text style={styles.label}>Has the car ever met with a major accident?</Text>
          <ChipRow
            options={[
              { label: 'No', value: 'no' },
              { label: 'Yes', value: 'yes' },
            ]}
            value={hadAccident}
            onChange={setHadAccident}
          />
          <Text style={[styles.label, { marginTop: 12 }]}>Car Condition</Text>
          <ChipRow
            options={[
              { label: 'Excellent', value: 'excellent' },
              { label: 'Good', value: 'good' },
              { label: 'Fair', value: 'fair' },
              { label: 'Poor', value: 'poor' },
            ]}
            value={condition}
            onChange={setCondition}
          />
          <Text style={[styles.label, { marginTop: 12 }]}>Number of Owners</Text>
          <TextInput style={styles.input} value={owners} onChangeText={setOwners} keyboardType="numeric" placeholder="1" placeholderTextColor="#9CA3AF" />
          <Text style={[styles.label, { marginTop: 12 }]}>City ({city})</Text>
          <ChipRow
            options={[
              { label: 'Metro', value: 'metro' },
              { label: 'Tier 2', value: 'tier2' },
              { label: 'Other', value: 'other' },
            ]}
            value={cityTier}
            onChange={setCityTier}
          />
        </ToolCard>
      </SmartToolShell>
    );
  }

  return (
    <SmartToolShell title="Car Resale Value" subtitle="Get an instant market range" navigation={navigation}>
      <VehiclePickerCard
        vehicles={vehicles}
        selectedId={selectedVehicle?.id || (selectedVehicle ? vehicleLabel(selectedVehicle) : null)}
        onSelect={(v) => {
          if (!v) return;
          setSelectedVehicle(v);
          prefillVehicle(v);
          setStep('details');
        }}
        onAddOther={() => setStep('brand')}
      />

      <ToolCard>
        <Text style={styles.cardTitle}>Start valuation</Text>
        <Text style={styles.cardBody}>Use your saved car or pick a brand to enter details manually.</Text>
        <View style={{ marginTop: 12, gap: 10 }}>
          {selectedVehicle ? (
            <PrimaryButton label={`Continue with ${vehicleLabel(selectedVehicle)}`} onPress={() => setStep('details')} />
          ) : null}
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
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  hero: { backgroundColor: '#111827', borderRadius: 20, padding: 22, marginBottom: 14 },
  heroLabel: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroRange: { marginTop: 10, fontSize: 26, fontWeight: '900', color: '#34D399' },
  heroMeta: { marginTop: 10, fontSize: 12, fontWeight: '600', color: '#D1D5DB' },
  heroCity: { marginTop: 6, fontSize: 12, fontWeight: '700', color: '#93C5FD' },
  cardTitle: { fontSize: 14, fontWeight: '900', color: '#111827', marginBottom: 6 },
  cardBody: { fontSize: 12, fontWeight: '600', color: '#6B7280', lineHeight: 18 },
});
