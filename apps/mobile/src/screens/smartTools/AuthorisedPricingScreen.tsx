import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BrandGrid from '../../components/smartTools/BrandGrid';
import ModelGrid from '../../components/smartTools/ModelGrid';
import VehiclePickerCard from '../../components/smartTools/VehiclePickerCard';
import HealthCheckShell, {
  LinkButton,
  PrimaryButton,
  SectionDivider,
  StepBlock,
  ToolCard,
} from '../../components/smartTools/HealthCheckShell';
import { COMPARE_USPS } from '../../constants/smartTools';
import type { PublicBrand } from '../../constants/publicAppData';
import { COLORS } from '../../constants/theme';
import {
  fetchActiveCities,
  fetchCategoryCompareQuotes,
  fetchCompareCategories,
  fetchModelsByBrand,
  formatQuoteRange,
  resolveCityFromLabel,
  resolveSavedVehicleModel,
  selectedCarLabel,
  type CityRow,
  type CompareCategory,
  type CompareQuote,
  type SelectedCar,
} from '../../lib/compareServicePricing';
import { formatInrRange } from '../../lib/smartToolsLogic';
import {
  fetchCarBrands,
  fetchCustomerVehicles,
  fetchSmartToolCity,
  vehicleLabel,
  type CustomerVehicle,
} from '../../lib/smartToolsVehicle';

type Props = { navigation: any };
type Step = 'home' | 'brand' | 'model' | 'compare';

const tileW = (Dimensions.get('window').width - 32 - 20) / 3;

export default function AuthorisedPricingScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('home');
  const [brands, setBrands] = useState<PublicBrand[]>([]);
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityRow | null>(null);
  const [locationDetecting, setLocationDetecting] = useState(true);
  const [compareCategories, setCompareCategories] = useState<CompareCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [selectedCar, setSelectedCar] = useState<SelectedCar | null>(null);
  const [pickBrand, setPickBrand] = useState('');
  const [brandModels, setBrandModels] = useState<Awaited<ReturnType<typeof fetchModelsByBrand>>>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<CompareQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);

  useEffect(() => {
    fetchCarBrands().then(setBrands);
    fetchCompareCategories().then((rows) => {
      setCompareCategories(rows);
      setCategoriesLoading(false);
    });
    fetchActiveCities().then(async (list) => {
      setLocationDetecting(true);
      try {
        const detected = await fetchSmartToolCity();
        const resolved = resolveCityFromLabel(detected, list);
        setSelectedCity(resolved || list.find((c) => c.name.toLowerCase() === 'mumbai') || list[0] || null);
      } finally {
        setLocationDetecting(false);
      }
    });
    fetchCustomerVehicles().then(async (list) => {
      setVehicles(list);
      const def = list.find((v) => v.is_default) || list[0];
      if (def) await applySavedVehicle(def);
    });
  }, []);

  const applySavedVehicle = async (vehicle: CustomerVehicle) => {
    const modelRow = await resolveSavedVehicleModel(vehicle);
    setSelectedCar({
      label: vehicleLabel(vehicle),
      make: vehicle.make || '',
      model: vehicle.model || vehicle.model_name || '',
      modelId: modelRow?.id,
      vehicleClass: modelRow?.class || null,
      source: 'saved',
      vehicle,
    });
  };

  const locationLine = useMemo(() => {
    if (!selectedCity) return 'your city';
    return `${selectedCity.name}${selectedCity.state ? `, ${selectedCity.state}` : ''}`;
  }, [selectedCity]);

  const loadCompareQuotes = useCallback(async () => {
    if (!selectedService || !selectedCity) return;
    setQuotesLoading(true);
    try {
      const rows = await fetchCategoryCompareQuotes(selectedService, selectedCity, selectedCar?.vehicleClass || null);
      setQuotes(rows);
    } finally {
      setQuotesLoading(false);
    }
  }, [selectedService, selectedCity, selectedCar?.vehicleClass]);

  useEffect(() => {
    if (step === 'compare' && selectedService && selectedCar && selectedCity) {
      loadCompareQuotes();
    }
  }, [step, selectedService, selectedCar, selectedCity, loadCompareQuotes]);

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

  const onModelSelect = (model: Awaited<ReturnType<typeof fetchModelsByBrand>>[number]) => {
    setSelectedCar({
      label: `${model.make} ${model.model_name}`.trim(),
      make: model.make,
      model: model.model_name,
      modelId: model.id,
      vehicleClass: model.class || null,
      source: 'manual',
    });
    setSelectedService(null);
    setStep('home');
  };

  const onServiceSelect = (categoryKey: string) => {
    if (!selectedCar) return;
    setSelectedService(categoryKey);
    setStep('compare');
  };

  const goHome = () => {
    setStep('home');
    setSelectedService(null);
    setQuotes([]);
  };

  const bookService = async (quote: CompareQuote) => {
    if (!quote.serviceTypeId) return;

    let modelId = selectedCar?.modelId;
    let make = selectedCar?.make || '';
    let modelName = selectedCar?.model || '';

    if (!modelId && selectedCar?.vehicle) {
      const row = await resolveSavedVehicleModel(selectedCar.vehicle);
      if (row) {
        modelId = row.id;
        make = row.make;
        modelName = row.model_name;
      }
    }

    const vehicleNumber =
      selectedCar?.vehicle?.registration_number ||
      selectedCar?.vehicle?.vehicle_number ||
      '';

    if (selectedCity && modelId) {
      navigation.navigate('PublicBookServiceNow', {
        resumeDraft: {
          id: `compare_${Date.now()}`,
          step: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          city: { id: selectedCity.id, name: selectedCity.name },
          carModel: { id: modelId, make, model_name: modelName, variant: null },
          selectedCategory: selectedService || undefined,
          selectedServices: [quote.serviceTypeId],
          vehicleNumber,
        },
        serviceCategory: selectedService || 'PERIODIC',
        selectedServiceId: quote.serviceTypeId,
      });
      return;
    }

    navigation.navigate('PublicBookServiceNow', {
      serviceCategory: selectedService || 'PERIODIC',
      selectedServiceId: quote.serviceTypeId,
    });
  };

  const locationBanner = (
    <ToolCard variant="soft">
      <View style={styles.locationRow}>
        <Ionicons name="location-outline" size={16} color={COLORS.primary} />
        <Text style={styles.locationText}>
          {locationDetecting
            ? 'Detecting your city…'
            : selectedCity
              ? `Pricing for ${locationLine}`
              : 'Location unavailable'}
        </Text>
      </View>
      <Text style={styles.locationHint}>
        {locationDetecting
          ? 'We use your GPS to show city-specific prices.'
          : 'Prices are auto-detected from your location.'}
      </Text>
    </ToolCard>
  );

  if (step === 'brand') {
    return (
      <HealthCheckShell title="Compare Service Cost" subtitle="Select car brand" navigation={navigation} headerIcon="git-compare-outline">
        {locationBanner}
        <StepBlock icon="car-outline" title="Select Brand" hint="Tap a brand to see its models">
          <BrandGrid brands={brands} selected={pickBrand} onSelect={onBrandSelect} columns={3} />
        </StepBlock>
        <LinkButton label="Back to saved cars" onPress={() => setStep('home')} />
      </HealthCheckShell>
    );
  }

  if (step === 'model') {
    return (
      <HealthCheckShell title="Compare Service Cost" subtitle={pickBrand} navigation={navigation} headerIcon="git-compare-outline">
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

  if (step === 'compare' && selectedService) {
    const svcMeta = compareCategories.find((s) => s.key === selectedService);
    const title = svcMeta?.name || 'Service Compare';

    return (
      <HealthCheckShell title={title} subtitle={selectedCarLabel(selectedCar)} navigation={navigation} headerIcon="git-compare-outline">
        {locationBanner}

        <LinkButton label="← Change service" onPress={goHome} />

        {quotesLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Fetching live pricing…</Text>
          </View>
        ) : null}

        {!quotesLoading && quotes.length === 0 ? (
          <ToolCard variant="soft">
            <Text style={styles.emptyTitle}>No services found in this category</Text>
            <Text style={styles.emptyBody}>Try another category or city.</Text>
          </ToolCard>
        ) : null}

        {!quotesLoading ? quotes.map((pkg) => <PackageCompareCard key={pkg.id} pkg={pkg} onBook={() => bookService(pkg)} />) : null}

        {quotes.length > 0 ? (
          <>
            <View style={styles.uspsCard}>
              {COMPARE_USPS.map((u) => (
                <View key={u.text} style={styles.uspItem}>
                  <Ionicons name={u.icon} size={14} color={COLORS.primary} />
                  <Text style={styles.uspText}>{u.text}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.footerHint}>Tap Book on any service above to continue with that service pre-selected.</Text>
          </>
        ) : null}
      </HealthCheckShell>
    );
  }

  return (
    <HealthCheckShell title="Compare Service Cost" subtitle="Authorised vs MyFNG pricing" navigation={navigation} headerIcon="git-compare-outline">
      <View style={styles.compactHero}>
        <View style={styles.compactHeroGlow} />
        <View style={styles.compactHeroRow}>
          <View style={styles.compactHeroCopy}>
            <Text style={styles.heroTitle}>See What You Save</Text>
            <Text style={styles.heroBody}>Compare authorised workshop rates with MyFNG pricing for your car and city.</Text>
            <View style={styles.heroPills}>
              <HeroPill icon="shield-checkmark-outline" label="Genuine parts" />
              <HeroPill icon="car-outline" label="Free pickup" />
              <HeroPill icon="ribbon-outline" label="Warranty" />
            </View>
          </View>
          <View style={styles.heroIconRight}>
            <Ionicons name="git-compare-outline" size={28} color="#93C5FD" />
          </View>
        </View>
      </View>

      {locationBanner}

      <VehiclePickerCard
        vehicles={vehicles}
        selectedId={selectedCar?.source === 'saved' ? selectedCar.vehicle?.id || selectedCar.label : null}
        onSelect={(v) => {
          if (!v) return;
          applySavedVehicle(v);
        }}
        onAddOther={openBrandPicker}
      />

      {selectedCar ? (
        <>
          <StepBlock icon="checkmark-circle-outline" title="Selected Car" hint="Pricing will be shown for this vehicle">
            <View style={styles.selectedCarBox}>
              <Ionicons name="car-sport" size={18} color={COLORS.primary} />
              <View style={styles.selectedCarCopy}>
                <Text style={styles.selectedCarName}>{selectedCar.label}</Text>
                {selectedCar.vehicleClass ? <Text style={styles.selectedCarMeta}>{selectedCar.vehicleClass} class</Text> : null}
              </View>
              <TouchableOpacity onPress={openBrandPicker}>
                <Text style={styles.changeLink}>Change</Text>
              </TouchableOpacity>
            </View>
          </StepBlock>

          <SectionDivider />

          <Text style={styles.pickTitle}>Choose a service category</Text>
          {categoriesLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
          ) : (
            <View style={styles.serviceGrid}>
              {compareCategories.map((svc) => (
                <TouchableOpacity
                  key={svc.key}
                  style={styles.serviceTile}
                  onPress={() => onServiceSelect(svc.key)}
                  activeOpacity={0.88}
                >
                  <View style={[styles.serviceIcon, { backgroundColor: svc.bg }]}>
                    <Ionicons name={svc.icon} size={20} color={svc.color} />
                  </View>
                  <Text style={styles.serviceName} numberOfLines={2}>
                    {svc.name}
                  </Text>
                  <Text style={styles.serviceCount}>{svc.serviceCount} services</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      ) : (
        <ToolCard variant="soft">
          <Text style={styles.emptyTitle}>Select a car to compare prices</Text>
          <Text style={styles.emptyBody}>Pick a saved car above or tap “Check another car” to choose brand and model.</Text>
          <View style={{ marginTop: 12 }}>
            <PrimaryButton label="Select Brand" icon="car-outline" onPress={openBrandPicker} />
          </View>
        </ToolCard>
      )}
    </HealthCheckShell>
  );
}

function PackageCompareCard({ pkg, onBook }: { pkg: CompareQuote; onBook: () => void }) {
  const savingsLow = Math.max(0, pkg.authorisedLow - pkg.myfngHigh);
  const savingsHigh = Math.max(0, pkg.authorisedHigh - pkg.myfngLow);

  return (
    <View style={styles.packageCard}>
      <View style={styles.packageTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.packageName}>{pkg.name}</Text>
          {pkg.checkpoints > 0 ? <Text style={styles.packageMeta}>{pkg.checkpoints} checkpoints</Text> : null}
          {pkg.priceSource === 'indicative' ? (
            <Text style={styles.indicativeTag}>Indicative range • confirm at booking</Text>
          ) : (
            <Text style={styles.liveTag}>Live MyFNG price for your city</Text>
          )}
        </View>
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{pkg.discountLabel}</Text>
        </View>
      </View>

      <View style={styles.compareRow}>
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>Authorised</Text>
          <Text style={styles.priceOld}>{formatQuoteRange(pkg.authorisedLow, pkg.authorisedHigh)}</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color="#94A3B8" />
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>MyFNG</Text>
          <Text style={styles.priceNew}>{formatQuoteRange(pkg.myfngLow, pkg.myfngHigh)}</Text>
        </View>
      </View>

      {savingsLow > 0 ? (
        <Text style={styles.saveLine}>Estimated savings: {formatInrRange(savingsLow, savingsHigh)}</Text>
      ) : null}

      <View style={styles.pointsGrid}>
        {pkg.highlights.map((h) => (
          <View key={h} style={styles.pointGridItem}>
            <Ionicons name="checkmark-circle" size={13} color="#059669" />
            <Text style={styles.pointGridText}>{h}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.disclaimerText}>
        *Prices may vary based on location, make, model & service requirements
      </Text>

      <PrimaryButton label="Book This Service" icon="calendar-outline" onPress={onBook} />
    </View>
  );
}

function HeroPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.heroPill}>
      <Ionicons name={icon} size={11} color="#93C5FD" />
      <Text style={styles.heroPillText}>{label}</Text>
    </View>
  );
}

const cardShadow = Platform.select({
  ios: { shadowColor: '#0B1F44', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 14 },
  android: { elevation: 4 },
  default: {},
});

const styles = StyleSheet.create({
  compactHero: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#0B1F44',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.35)',
    ...cardShadow,
  },
  compactHeroGlow: {
    position: 'absolute',
    top: -24,
    right: 40,
    width: 90,
    height: 90,
    borderRadius: 999,
    backgroundColor: 'rgba(37, 99, 235, 0.22)',
  },
  compactHeroRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 12 },
  compactHeroCopy: { flex: 1, paddingTop: 2 },
  heroIconRight: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.25)',
    marginTop: 2,
  },
  heroTitle: { fontSize: 17, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
  heroBody: { fontSize: 12, fontWeight: '600', color: '#CBD5E1', lineHeight: 17 },
  heroPills: { flexDirection: 'row', flexWrap: 'nowrap', gap: 6, marginTop: 8 },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.2)',
  },
  heroPillText: { fontSize: 10, fontWeight: '800', color: '#E2E8F0' },
  selectedCarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  selectedCarCopy: { flex: 1 },
  selectedCarName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  selectedCarMeta: { marginTop: 2, fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  changeLink: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  pickTitle: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 10 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  serviceTile: {
    width: tileW,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    minHeight: 118,
  },
  serviceIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  serviceName: { fontSize: 10, fontWeight: '800', color: '#334155', textAlign: 'center', lineHeight: 13 },
  serviceCount: { marginTop: 4, fontSize: 9, fontWeight: '700', color: '#94A3B8', textAlign: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  emptyBody: { fontSize: 12, fontWeight: '600', color: '#64748B', lineHeight: 18 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  locationText: { fontSize: 13, fontWeight: '800', color: '#0F172A', flex: 1 },
  locationHint: { fontSize: 11, fontWeight: '600', color: '#64748B', lineHeight: 16 },
  loadingBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  loadingText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  packageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  packageTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  packageName: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
  packageMeta: { marginTop: 2, fontSize: 11, fontWeight: '700', color: '#64748B' },
  indicativeTag: { marginTop: 4, fontSize: 10, fontWeight: '700', color: '#D97706' },
  liveTag: { marginTop: 4, fontSize: 10, fontWeight: '700', color: '#059669' },
  discountBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: '#A7F3D0' },
  discountText: { fontSize: 10, fontWeight: '900', color: '#059669' },
  compareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  priceCol: { flex: 1, alignItems: 'center' },
  priceLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 4 },
  priceOld: { fontSize: 13, fontWeight: '800', color: '#94A3B8', textDecorationLine: 'line-through', textAlign: 'center' },
  priceNew: { fontSize: 15, fontWeight: '900', color: COLORS.primary, textAlign: 'center' },
  saveLine: { fontSize: 11, fontWeight: '700', color: '#059669', marginBottom: 10, textAlign: 'center' },
  pointsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  pointGridItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingRight: 4 },
  pointGridText: { flex: 1, fontSize: 11, fontWeight: '600', color: '#475569' },
  disclaimerText: { fontSize: 10, fontWeight: '600', color: '#94A3B8', textAlign: 'center', marginBottom: 12, fontStyle: 'italic' },
  uspsCard: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  uspItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  uspText: { fontSize: 10, fontWeight: '800', color: '#475569' },
  footerHint: { fontSize: 11, fontWeight: '600', color: '#64748B', textAlign: 'center', lineHeight: 16, marginTop: 8 },
});
