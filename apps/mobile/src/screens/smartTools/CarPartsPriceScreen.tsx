import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BrandGrid from '../../components/smartTools/BrandGrid';
import ModelGrid from '../../components/smartTools/ModelGrid';
import PartsPriceResultView from '../../components/smartTools/PartsPriceResultView';
import VehiclePickerCard from '../../components/smartTools/VehiclePickerCard';
import HealthCheckShell, {
  FeaturePills,
  FieldInput,
  HeroCard,
  LinkButton,
  PrimaryButton,
  QuestionBlock,
  StepBlock,
  ToolCard,
  YearPickerField,
  InlineOptionField,
} from '../../components/smartTools/HealthCheckShell';
import type { PublicBrand } from '../../constants/publicAppData';
import { COMPARE_USPS } from '../../constants/smartTools';
import { COLORS } from '../../constants/theme';
import {
  fetchActiveCities,
  fetchModelsByBrand,
  resolveCityFromLabel,
  resolveSavedVehicleModel,
  type CarModelOption,
  type CityRow,
} from '../../lib/compareServicePricing';
import {
  fetchPartsPriceEstimate,
  type PartsPriceEstimate,
} from '../../lib/partsPriceEstimate';
import {
  fetchCarBrands,
  fetchCustomerVehicles,
  fetchSmartToolCity,
  vehicleFuel,
  vehicleLabel,
  type CustomerVehicle,
} from '../../lib/smartToolsVehicle';

type Props = { navigation: any };
type Step = 'home' | 'brand' | 'model' | 'details' | 'result';

type SelectedCar = {
  label: string;
  make: string;
  model: string;
  modelId?: string;
  vehicleClass?: string | null;
  vehicle?: CustomerVehicle;
};

const FUEL_OPTIONS = [
  { label: 'Petrol', value: 'petrol' },
  { label: 'Diesel', value: 'diesel' },
  { label: 'CNG', value: 'cng' },
  { label: 'EV', value: 'ev' },
];

export default function CarPartsPriceScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('home');
  const [brands, setBrands] = useState<PublicBrand[]>([]);
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityRow | null>(null);
  const [locationDetecting, setLocationDetecting] = useState(true);
  const [detectedLabel, setDetectedLabel] = useState('');

  const [selectedCar, setSelectedCar] = useState<SelectedCar | null>(null);
  const [pickBrand, setPickBrand] = useState('');
  const [brandModels, setBrandModels] = useState<CarModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const [regYear, setRegYear] = useState<number | undefined>();
  const [fuel, setFuel] = useState('petrol');
  const [variant, setVariant] = useState('');

  const [estimate, setEstimate] = useState<PartsPriceEstimate | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  useEffect(() => {
    fetchCarBrands().then(setBrands);
    fetchActiveCities().then(async (list) => {
      setLocationDetecting(true);
      try {
        const detected = await fetchSmartToolCity();
        setDetectedLabel(detected);
        const resolved = resolveCityFromLabel(detected, list);
        setSelectedCity(resolved || list.find((c) => c.name.toLowerCase() === 'mumbai') || list[0] || null);
      } finally {
        setLocationDetecting(false);
      }
    });
    fetchCustomerVehicles().then(async (list) => {
      setVehicles(list);
      const def = list.find((v) => v.is_default) || list[0];
      if (def) await applySavedVehicle(def, false);
    });
  }, []);

  const cityName = useMemo(() => {
    if (selectedCity?.name) {
      return `${selectedCity.name}${selectedCity.state ? `, ${selectedCity.state}` : ''}`;
    }
    return detectedLabel || 'India';
  }, [selectedCity, detectedLabel]);

  const applySavedVehicle = async (vehicle: CustomerVehicle, goDetails = false) => {
    const modelRow = await resolveSavedVehicleModel(vehicle);
    setSelectedCar({
      label: vehicleLabel(vehicle),
      make: vehicle.make || '',
      model: vehicle.model || vehicle.model_name || '',
      modelId: modelRow?.id,
      vehicleClass: modelRow?.class || null,
      vehicle,
    });
    setRegYear(vehicle.year ? Number(vehicle.year) : undefined);
    setFuel(vehicle.fuel_type ? vehicleFuel(vehicle) : 'petrol');
    if (goDetails) setStep('details');
  };

  const loadEstimate = useCallback(async (car: SelectedCar) => {
    setLoadingEstimate(true);
    try {
      const result = await fetchPartsPriceEstimate({
        make: car.make,
        model: car.model,
        regYear,
        fuel,
        variant: variant.trim() || undefined,
        vehicleClass: car.vehicleClass,
        city: selectedCity?.name || detectedLabel || null,
      });
      setEstimate(result);
      setStep('result');
    } catch (err: any) {
      Alert.alert('Parts Price', err?.message || 'Could not load parts prices. Please try again.');
    } finally {
      setLoadingEstimate(false);
    }
  }, [regYear, fuel, variant, selectedCity, detectedLabel]);

  const onContinueToDetails = () => {
    if (!selectedCar) return;
    setStep('details');
  };

  const onFetchPrices = () => {
    if (!selectedCar || !regYear) {
      Alert.alert('Car details', 'Please select registration year to estimate parts prices.');
      return;
    }
    loadEstimate(selectedCar);
  };

  const openBrandPicker = () => {
    setPickBrand('');
    setBrandModels([]);
    setStep('brand');
  };

  const onBrandSelect = async (brand: PublicBrand) => {
    setPickBrand(brand.name);
    setModelsLoading(true);
    setStep('model');
    const models = await fetchModelsByBrand(brand.name);
    setBrandModels(models);
    setModelsLoading(false);
  };

  const onModelSelect = (model: CarModelOption) => {
    setSelectedCar({
      label: `${model.make} ${model.model_name}`.trim(),
      make: model.make,
      model: model.model_name,
      modelId: model.id,
      vehicleClass: model.class || null,
    });
    setStep('details');
  };

  const restart = () => {
    setStep('home');
    setEstimate(null);
    setPickBrand('');
    setBrandModels([]);
    setVariant('');
  };

  const bookService = async () => {
    if (!selectedCar) {
      navigation.navigate('PublicBookServiceNow');
      return;
    }

    let modelId = selectedCar.modelId;
    let make = selectedCar.make;
    let modelName = selectedCar.model;

    if (!modelId && selectedCar.vehicle) {
      const row = await resolveSavedVehicleModel(selectedCar.vehicle);
      if (row) {
        modelId = row.id;
        make = row.make;
        modelName = row.model_name;
      }
    }

    const vehicleNumber =
      selectedCar.vehicle?.registration_number ||
      selectedCar.vehicle?.vehicle_number ||
      '';

    if (selectedCity && modelId) {
      navigation.navigate('PublicBookServiceNow', {
        resumeDraft: {
          id: `parts_${Date.now()}`,
          step: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          city: { id: selectedCity.id, name: selectedCity.name },
          carModel: { id: modelId, make, model_name: modelName, variant: variant.trim() || null },
          vehicleNumber,
        },
      });
      return;
    }

    navigation.navigate('PublicBookServiceNow');
  };

  const locationBanner = (
    <ToolCard variant="soft">
      <View style={styles.locationRow}>
        <Ionicons name="location-outline" size={16} color={COLORS.primary} />
        <Text style={styles.locationText}>
          {locationDetecting
            ? 'Detecting your city…'
            : `Estimates for ${cityName}`}
        </Text>
      </View>
      <Text style={styles.locationHint}>
        Live prices are fetched from Boodmo.com and Google for your city.
      </Text>
    </ToolCard>
  );

  const progress =
    step === 'home' ? 20 : step === 'brand' || step === 'model' ? 45 : step === 'details' ? 70 : 100;

  if (step === 'result' && estimate && selectedCar) {
    return (
      <HealthCheckShell
        title="Check Parts Price"
        subtitle={selectedCar.label}
        navigation={navigation}
        headerIcon="construct-outline"
        progress={100}
        stepLabel="Price guide ready"
      >
        <PartsPriceResultView
          estimate={estimate}
          carLabel={selectedCar.label}
          cityName={cityName}
          onBookService={bookService}
          onCheckAgain={restart}
        />
      </HealthCheckShell>
    );
  }

  if (step === 'brand') {
    return (
      <HealthCheckShell
        title="Check Parts Price"
        subtitle="Select car brand"
        navigation={navigation}
        headerIcon="construct-outline"
        progress={45}
        stepLabel="Step 2 of 4"
      >
        {locationBanner}
        <StepBlock icon="car-outline" title="Select Brand" hint="Choose your car manufacturer">
          <BrandGrid brands={brands} selected={pickBrand} onSelect={onBrandSelect} columns={3} />
        </StepBlock>
        <LinkButton label="Back to saved cars" onPress={() => setStep('home')} />
      </HealthCheckShell>
    );
  }

  if (step === 'model') {
    return (
      <HealthCheckShell
        title="Check Parts Price"
        subtitle={pickBrand}
        navigation={navigation}
        headerIcon="construct-outline"
        progress={55}
        stepLabel="Step 3 of 4"
      >
        {locationBanner}
        <StepBlock icon="list-outline" title="Select Model" hint={`Choose your ${pickBrand} model`}>
          {modelsLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : (
            <ModelGrid models={brandModels} onSelect={onModelSelect} columns={3} />
          )}
        </StepBlock>
        <LinkButton label="Change brand" onPress={() => setStep('brand')} />
      </HealthCheckShell>
    );
  }

  if (step === 'details') {
    return (
      <HealthCheckShell
        title="Check Parts Price"
        subtitle={selectedCar?.label || 'Car details'}
        navigation={navigation}
        headerIcon="construct-outline"
        progress={75}
        stepLabel="Step 4 of 4"
        footer={
          <PrimaryButton
            label={loadingEstimate ? 'Fetching prices…' : 'Get Parts Price Guide'}
            icon="search-outline"
            onPress={onFetchPrices}
            disabled={loadingEstimate || !regYear}
          />
        }
      >
        {locationBanner}
        <StepBlock icon="information-circle-outline" title="Vehicle details" hint="Helps fetch accurate parts prices for your car">
          <QuestionBlock label="Registration year" required>
            <YearPickerField value={regYear} onChange={setRegYear} />
          </QuestionBlock>
          <QuestionBlock label="Fuel type">
            <InlineOptionField value={fuel} onChange={setFuel} options={FUEL_OPTIONS} />
          </QuestionBlock>
          <QuestionBlock label="Variant (optional)" hint="e.g. VXi, ZX+, Smart Hybrid">
            <FieldInput value={variant} onChangeText={setVariant} placeholder="Enter variant if known" />
          </QuestionBlock>
        </StepBlock>
        {loadingEstimate ? (
          <ToolCard variant="outline">
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Checking Boodmo & Google for your car's parts prices…</Text>
          </ToolCard>
        ) : null}
        <LinkButton label="Change car" onPress={() => setStep('home')} />
      </HealthCheckShell>
    );
  }

  return (
    <HealthCheckShell
      title="Check Parts Price"
      subtitle="Genuine parts price guide"
      navigation={navigation}
      headerIcon="construct-outline"
      progress={progress}
      stepLabel="Step 1 of 4"
      footer={
        selectedCar ? (
          <PrimaryButton label={`Continue with ${selectedCar.label}`} onPress={onContinueToDetails} />
        ) : undefined
      }
    >
      <HeroCard>
        <Text style={styles.heroEyebrow}>SMART PARTS GUIDE</Text>
        <Text style={styles.heroTitle}>Know genuine parts cost before you visit the workshop</Text>
        <Text style={styles.heroBody}>
          Live parts price ranges from Boodmo.com and Google — tailored to your exact car and city.
        </Text>
        <FeaturePills
          items={[
            { icon: 'shield-checkmark-outline', label: 'OEM / OES ranges' },
            { icon: 'globe-outline', label: 'Boodmo + Google' },
            { icon: 'location-outline', label: 'City adjusted' },
          ]}
        />
      </HeroCard>

      {locationBanner}

      <VehiclePickerCard
        vehicles={vehicles}
        selectedId={selectedCar?.vehicle?.id || (selectedCar ? selectedCar.label : null)}
        onSelect={(v) => {
          if (!v) return;
          applySavedVehicle(v, true);
        }}
        onAddOther={openBrandPicker}
      />

      <ToolCard>
        <Text style={styles.cardTitle}>Don&apos;t see your car?</Text>
        <Text style={styles.cardBody}>Pick brand & model manually for an accurate parts price guide.</Text>
        <View style={{ marginTop: 12 }}>
          <PrimaryButton label="Select Brand & Model" icon="car-outline" onPress={openBrandPicker} />
        </View>
      </ToolCard>

      <ToolCard variant="soft">
        <Text style={styles.cardTitle}>Why MyFNG?</Text>
        <View style={styles.uspGrid}>
          {COMPARE_USPS.map((u) => (
            <View key={u.text} style={styles.uspGridItem}>
              <Ionicons name={u.icon} size={14} color={COLORS.primary} />
              <Text style={styles.uspText}>{u.text}</Text>
            </View>
          ))}
        </View>
      </ToolCard>
    </HealthCheckShell>
  );
}

const styles = StyleSheet.create({
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#93C5FD',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 26,
    marginBottom: 8,
  },
  heroBody: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.85)',
    lineHeight: 18,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationText: { flex: 1, fontSize: 13, fontWeight: '800', color: '#0F172A' },
  locationHint: { marginTop: 6, fontSize: 11, fontWeight: '600', color: '#64748B', lineHeight: 16 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
  cardBody: { fontSize: 12, fontWeight: '600', color: '#64748B', lineHeight: 18 },
  uspGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  uspGridItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '47%' },
  uspText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
});
