import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import BrandGrid from '../../components/smartTools/BrandGrid';
import ModelGrid from '../../components/smartTools/ModelGrid';
import ResaleValueResultView from '../../components/smartTools/ResaleValueResultView';
import VehiclePickerCard from '../../components/smartTools/VehiclePickerCard';
import HealthCheckShell, {
  ChipRow,
  FieldInput,
  LinkButton,
  PrimaryButton,
  QuestionBlock,
  StepBlock,
  ToolCard,
  TwoColRow,
  YearPickerField,
} from '../../components/smartTools/HealthCheckShell';
import type { PublicBrand } from '../../constants/publicAppData';
import { SMART_TOOL_WEB_URLS, smartToolWebUrl } from '../../constants/smartTools';
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
  buildValuationText,
  cityLine,
  resolveCityTier,
  type ResaleBodyPaint,
  type ResaleCondition,
  type ResaleEstimate,
  type ResaleFormInput,
  type ResaleLastService,
  type ResaleMonthlyRunning,
  type ResaleServiceRecords,
  type ResaleSession,
  type ResaleTyreCondition,
} from '../../lib/resaleValueHelpers';
import { submitResaleValuationPayload } from '../../lib/resaleValueSubmit';
import { estimateResaleValue } from '../../lib/smartToolsLogic';
import {
  fetchCarBrands,
  fetchCustomerVehicles,
  fetchSmartToolCity,
  vehicleFuel,
  vehicleLabel,
  type CustomerVehicle,
} from '../../lib/smartToolsVehicle';
import { trackEvent } from '../../lib/trackEvent';

type Props = { navigation: any };
type Step = 'home' | 'brand' | 'model' | 'details_car' | 'details_usage' | 'details_fuel' | 'details_condition' | 'details_ownership' | 'result';

type SelectedCar = {
  label: string;
  make: string;
  model: string;
  modelId?: string;
  vehicleClass?: string | null;
  vehicle?: CustomerVehicle;
};

const RESALE_SESSION_KEY = 'resale_value_session_v1';

const FUEL_OPTIONS = [
  { label: 'Petrol', value: 'petrol' },
  { label: 'Diesel', value: 'diesel' },
  { label: 'CNG', value: 'cng' },
  { label: 'EV', value: 'ev' },
];

const TRANSMISSION_OPTIONS = [
  { label: 'Manual', value: 'manual' },
  { label: 'Automatic', value: 'automatic' },
];

const CONDITION_OPTIONS = [
  { label: 'Excellent', value: 'excellent' },
  { label: 'Good', value: 'good' },
  { label: 'Fair', value: 'fair' },
  { label: 'Poor', value: 'poor' },
];

const YES_NO_OPTIONS = [
  { label: 'No', value: 'no' },
  { label: 'Yes', value: 'yes' },
];

const SERVICE_RECORD_OPTIONS = [
  { label: 'Full records', value: 'yes' },
  { label: 'Partial', value: 'partial' },
  { label: 'None', value: 'no' },
];

const TYRE_OPTIONS = [
  { label: 'Good', value: 'good' },
  { label: 'Fair', value: 'fair' },
  { label: 'Replace soon', value: 'replace' },
];

const BODY_PAINT_OPTIONS = [
  { label: 'Original', value: 'original' },
  { label: 'Minor touch-up', value: 'minor' },
  { label: 'Major repaint', value: 'major' },
];

const MONTHLY_RUNNING_OPTIONS = [
  { label: 'Under 500 km', value: '<500' },
  { label: '500 - 1000 km', value: '500-1000' },
  { label: '1000 - 2000 km', value: '1000-2000' },
  { label: '2000+ km', value: '2000+' },
];

const LAST_SERVICE_OPTIONS = [
  { label: 'Under 3 months', value: '<3' },
  { label: '3 - 6 months', value: '3-6' },
  { label: '6 - 12 months', value: '6-12' },
  { label: '12+ months', value: '12+' },
  { label: "Don't remember", value: 'dont_remember' },
];

function defaultFormState() {
  return {
    regYear: undefined as number | undefined,
    fuel: 'petrol',
    transmission: 'manual' as 'manual' | 'automatic',
    km: '',
    owners: '1',
    variant: '',
    condition: 'good' as ResaleCondition,
    hadAccident: 'no',
    insuranceValid: 'yes',
    serviceRecords: 'partial' as ResaleServiceRecords,
    tyreCondition: 'good' as ResaleTyreCondition,
    bodyPaint: 'original' as ResaleBodyPaint,
    hypothecation: 'no',
    duplicateKey: 'yes',
    monthlyRunning: '500-1000' as ResaleMonthlyRunning,
    lastService: '6-12' as ResaleLastService,
  };
}

export default function ResaleValueScreen({ navigation }: Props) {
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

  const [form, setForm] = useState(defaultFormState);
  const [savedEstimate, setSavedEstimate] = useState<ResaleEstimate | null>(null);
  const [savedFormInput, setSavedFormInput] = useState<ResaleFormInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);
  const [sessionReady, setSessionReady] = useState(false);

  const prevStepRef = useRef<Step>(step);
  useEffect(() => {
    if (step !== prevStepRef.current) {
      const allSteps: Step[] = ['home', 'brand', 'model', 'details_car', 'details_usage', 'details_fuel', 'details_condition', 'details_ownership', 'result'];
      const idx = allSteps.indexOf(step);
      if (idx > allSteps.indexOf(prevStepRef.current)) {
        trackEvent('resale_value_step_completed', { step: allSteps.indexOf(prevStepRef.current) });
      }
      prevStepRef.current = step;
    }
  }, [step]);

  const patchForm = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  const cityName = useMemo(() => cityLine(selectedCity, detectedLabel), [selectedCity, detectedLabel]);
  const cityTier = useMemo(() => resolveCityTier(selectedCity?.name || detectedLabel), [selectedCity, detectedLabel]);

  const formInput = useMemo((): ResaleFormInput | null => {
    if (!selectedCar || !form.regYear) return null;
    const kmNum = Number(form.km);
    if (!kmNum) return null;
    return {
      make: selectedCar.make,
      model: selectedCar.model,
      variant: form.variant.trim() || undefined,
      modelId: selectedCar.modelId,
      vehicleClass: selectedCar.vehicleClass,
      vehicleNumber:
        selectedCar.vehicle?.registration_number ||
        selectedCar.vehicle?.vehicle_number ||
        undefined,
      regYear: form.regYear,
      fuel: form.fuel,
      transmission: form.transmission,
      km: kmNum,
      owners: Math.max(1, Number(form.owners) || 1),
      condition: form.condition,
      hadAccident: form.hadAccident === 'yes',
      insuranceValid: form.insuranceValid === 'yes',
      serviceRecords: form.serviceRecords,
      tyreCondition: form.tyreCondition,
      bodyPaint: form.bodyPaint,
      hypothecation: form.hypothecation === 'yes',
      duplicateKey: form.duplicateKey === 'yes',
      monthlyRunning: form.monthlyRunning,
      lastService: form.lastService,
      cityName,
      cityTier,
    };
  }, [selectedCar, form, cityName, cityTier]);

  const estimate = useMemo(() => {
    if (!formInput) return null;
    return estimateResaleValue({
      brand: formInput.make,
      year: formInput.regYear,
      fuel: formInput.fuel,
      km: formInput.km,
      owners: formInput.owners,
      condition: formInput.condition,
      cityTier: formInput.cityTier,
      hadAccident: formInput.hadAccident,
      transmission: formInput.transmission,
      insuranceValid: formInput.insuranceValid,
      serviceRecords: formInput.serviceRecords,
      tyreCondition: formInput.tyreCondition,
      bodyPaint: formInput.bodyPaint,
      hypothecation: formInput.hypothecation,
      duplicateKey: formInput.duplicateKey,
      monthlyRunning: formInput.monthlyRunning,
      lastService: formInput.lastService,
    });
  }, [formInput]);

  const persistSession = useCallback(
    async (input: ResaleFormInput, result: ResaleEstimate) => {
      if (!selectedCar) return;
      const payload: ResaleSession = {
        step: 'result',
        savedAt: Date.now(),
        selectedCar: {
          label: selectedCar.label,
          make: selectedCar.make,
          model: selectedCar.model,
          modelId: selectedCar.modelId,
          vehicleClass: selectedCar.vehicleClass,
          vehicleId: selectedCar.vehicle?.id,
        },
        form,
        formInput: input,
        estimate: result,
        cityName,
        detectedLabel,
        selectedCity: selectedCity
          ? { id: selectedCity.id, name: selectedCity.name, state: selectedCity.state }
          : null,
      };
      await AsyncStorage.setItem(RESALE_SESSION_KEY, JSON.stringify(payload)).catch(() => {});
    },
    [selectedCar, form, cityName, detectedLabel, selectedCity],
  );

  const restoreSession = useCallback(async (list: CustomerVehicle[]): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(RESALE_SESSION_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw) as ResaleSession;
      if (saved.step !== 'result' || !saved.formInput || !saved.estimate) return false;

      setForm(saved.form);
      setSavedFormInput(saved.formInput);
      setSavedEstimate(saved.estimate);
      setDetectedLabel(saved.detectedLabel || '');
      if (saved.selectedCity?.id) {
        setSelectedCity({
          id: saved.selectedCity.id,
          name: saved.selectedCity.name,
          state: saved.selectedCity.state || undefined,
        });
      }

      const vehicle = saved.selectedCar.vehicleId
        ? list.find((v) => v.id === saved.selectedCar.vehicleId)
        : undefined;

      setSelectedCar({
        label: saved.selectedCar.label,
        make: saved.selectedCar.make,
        model: saved.selectedCar.model,
        modelId: saved.selectedCar.modelId,
        vehicleClass: saved.selectedCar.vehicleClass,
        vehicle,
      });
      submittedRef.current = true;
      setStep('result');
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    trackEvent('resale_value_started');
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
      const restored = await restoreSession(list);
      setSessionReady(true);
      if (!restored) {
        const def = list.find((v) => v.is_default) || list[0];
        if (def) await applySavedVehicle(def, false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    patchForm({
      regYear: vehicle.year ? Number(vehicle.year) : undefined,
      fuel: vehicle.fuel_type ? vehicleFuel(vehicle) : 'petrol',
      km: vehicle.odometer_km ? String(vehicle.odometer_km) : '',
    });
    if (goDetails) setStep('details_car');
  };

  const restartCheck = async () => {
    submittedRef.current = false;
    await AsyncStorage.removeItem(RESALE_SESSION_KEY).catch(() => {});
    setStep('home');
    setPickBrand('');
    setBrandModels([]);
    setForm(defaultFormState());
    setSavedEstimate(null);
    setSavedFormInput(null);
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
    setStep('details_car');
  };

  const submitValuation = async (input: ResaleFormInput, result: ResaleEstimate) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    trackEvent('resale_value_submitted');
    setSubmitting(true);
    setSavedFormInput(input);
    setSavedEstimate(result);
    await persistSession(input, result);
    try {
      const valuationText = buildValuationText(input, result);
      await submitResaleValuationPayload({
        make: input.make,
        model: input.model,
        model_id: input.modelId || null,
        vehicle_class: input.vehicleClass || null,
        vehicle_number: input.vehicleNumber || null,
        registration_year: input.regYear,
        fuel: input.fuel,
        transmission: input.transmission,
        odometer: input.km,
        owners: input.owners,
        condition: input.condition,
        had_accident: input.hadAccident,
        insurance_valid: input.insuranceValid,
        service_records: input.serviceRecords,
        city_name: input.cityName,
        city_tier: input.cityTier,
        estimate_low: result.low,
        estimate_mid: result.mid,
        estimate_high: result.high,
        valuation_text: valuationText,
        valuation_json: {
          input,
          estimate: result,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch {
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  const onGetEstimate = () => {
    if (!formInput || !estimate) return;
    trackEvent('resale_value_estimated');
    setStep('result');
    submitValuation(formInput, estimate);
  };

  const bookInspection = () => {
    const input = savedFormInput || formInput;
    if (!input || !selectedCity) {
      navigation.navigate('PublicBookServiceNow', { serviceCategory: 'DETAILING' });
      return;
    }
    navigation.navigate('PublicBookServiceNow', {
      resumeDraft: {
        id: `resale_${Date.now()}`,
        step: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        city: { id: selectedCity.id, name: selectedCity.name },
        carModel: input.modelId
          ? {
              id: input.modelId,
              make: input.make,
              model_name: input.model,
              variant: input.variant || null,
            }
          : null,
        selectedCategory: 'DETAILING',
        selectedServices: [],
        vehicleNumber: input.vehicleNumber || '',
      },
      serviceCategory: 'DETAILING',
    });
  };

  const openLoanAgainstCar = () => {
    navigation.navigate('SmartToolWeb', {
      title: 'Loan Against Car',
      url: smartToolWebUrl('car_loan', SMART_TOOL_WEB_URLS.car_loan),
    });
  };

  const progress =
    step === 'home' ? 10
    : step === 'brand' || step === 'model' ? 25
    : step === 'details_car' ? 40
    : step === 'details_usage' ? 55
    : step === 'details_fuel' ? 65
    : step === 'details_condition' ? 80
    : step === 'details_ownership' ? 90
    : 100;

  const detailsValid = Boolean(formInput && estimate);
  const resultInput = savedFormInput || formInput;
  const resultEstimate = savedEstimate || estimate;

  const stepLabel =
    step === 'details_car' ? 'Step 1 of 5 • Car Info'
    : step === 'details_usage' ? 'Step 2 of 5 • Usage'
    : step === 'details_fuel' ? 'Step 3 of 5 • Fuel & Transmission'
    : step === 'details_condition' ? 'Step 4 of 5 • Condition'
    : step === 'details_ownership' ? 'Step 5 of 5 • Ownership'
    : undefined;

  const locationBanner = (
    <ToolCard variant="soft">
      <View style={styles.locationRow}>
        <Ionicons name="location-outline" size={16} color={COLORS.primary} />
        <Text style={styles.locationText}>
          {locationDetecting
            ? 'Detecting your city…'
            : selectedCity
              ? `Valuation for ${cityName}`
              : 'Location unavailable'}
        </Text>
      </View>
      <Text style={styles.locationHint}>
        {locationDetecting ? 'City is auto-detected for market pricing.' : `Market tier: ${cityTier}`}
      </Text>
    </ToolCard>
  );

  if (step === 'result' && resultInput && resultEstimate) {
    return (
      <HealthCheckShell title="Car Resale Value" subtitle="Your saved estimate" navigation={navigation} headerIcon="cash-outline">
        {submitting ? (
          <Text style={styles.syncHint}>Saving valuation…</Text>
        ) : (
          <Text style={styles.syncHint}>Your estimate is saved on this device until you check again.</Text>
        )}
        <ResaleValueResultView
          formInput={resultInput}
          estimate={resultEstimate}
          cityName={cityName}
          onBookInspection={bookInspection}
          onLoanAgainstCar={openLoanAgainstCar}
          onRestart={restartCheck}
        />
      </HealthCheckShell>
    );
  }

  if (!sessionReady && step === 'home') {
    return (
      <HealthCheckShell title="Car Resale Value" subtitle="Loading…" navigation={navigation} headerIcon="cash-outline">
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 40 }} />
      </HealthCheckShell>
    );
  }

  if (step === 'brand') {
    return (
      <HealthCheckShell title="Car Resale Value" subtitle="Select car brand" navigation={navigation} headerIcon="cash-outline">
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
      <HealthCheckShell title="Car Resale Value" subtitle={pickBrand} navigation={navigation} headerIcon="cash-outline">
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

  if (step === 'details_car') {
    return (
      <HealthCheckShell
        title="Car Resale Value"
        subtitle={selectedCar?.label || 'Car Info'}
        navigation={navigation}
        headerIcon="cash-outline"
        progress={progress}
        stepLabel={stepLabel}
      >
        {locationBanner}
        <StepBlock icon="car-sport-outline" title="Selected Car" hint="Confirm vehicle before valuation">
          <View style={styles.selectedCarBox}>
            <Ionicons name="car-sport" size={18} color={COLORS.primary} />
            <View style={styles.selectedCarCopy}>
              <Text style={styles.selectedCarName}>{selectedCar?.label}</Text>
              {selectedCar?.vehicleClass ? <Text style={styles.selectedCarMeta}>{selectedCar.vehicleClass} class</Text> : null}
            </View>
            <TouchableOpacity onPress={openBrandPicker}>
              <Text style={styles.changeLink}>Change</Text>
            </TouchableOpacity>
          </View>
          <QuestionBlock label="Variant (optional)" dense>
            <FieldInput value={form.variant} onChangeText={(variant) => patchForm({ variant })} placeholder="e.g. VXi, ZX CVT" />
          </QuestionBlock>
        </StepBlock>
        <PrimaryButton label="Next → Registration & Usage" icon="arrow-forward-outline" onPress={() => setStep('details_usage')} />
      </HealthCheckShell>
    );
  }

  if (step === 'details_usage') {
    return (
      <HealthCheckShell
        title="Car Resale Value"
        subtitle="Registration & Usage"
        navigation={navigation}
        headerIcon="cash-outline"
        progress={progress}
        stepLabel={stepLabel}
      >
        <StepBlock icon="calendar-outline" title="Registration & Usage" hint="Year and odometer are required">
          <QuestionBlock label="Registration Year" required dense>
            <YearPickerField value={form.regYear} onChange={(regYear) => patchForm({ regYear })} placeholder="Select year" />
          </QuestionBlock>
          <TwoColRow
            left={
              <QuestionBlock label="KM Driven" required dense>
                <FieldInput value={form.km} onChangeText={(km) => patchForm({ km })} keyboardType="numeric" placeholder="e.g. 45000" />
              </QuestionBlock>
            }
            right={
              <QuestionBlock label="Number of Owners" dense>
                <FieldInput value={form.owners} onChangeText={(owners) => patchForm({ owners })} keyboardType="numeric" placeholder="1" />
              </QuestionBlock>
            }
          />
          <QuestionBlock label="Average monthly running">
            <ChipRow
              options={MONTHLY_RUNNING_OPTIONS}
              value={form.monthlyRunning}
              onChange={(v) => patchForm({ monthlyRunning: v as ResaleMonthlyRunning })}
            />
          </QuestionBlock>
        </StepBlock>
        <View style={styles.footerRow}>
          <LinkButton label="← Back" onPress={() => setStep('details_car')} />
          <PrimaryButton
            label="Next → Fuel & Transmission"
            icon="arrow-forward-outline"
            onPress={() => setStep('details_fuel')}
            disabled={!form.regYear}
          />
        </View>
        {!form.regYear ? <Text style={styles.validationHint}>Select registration year to continue.</Text> : null}
      </HealthCheckShell>
    );
  }

  if (step === 'details_fuel') {
    return (
      <HealthCheckShell
        title="Car Resale Value"
        subtitle="Fuel & Transmission"
        navigation={navigation}
        headerIcon="cash-outline"
        progress={progress}
        stepLabel={stepLabel}
      >
        <StepBlock icon="water-outline" title="Fuel & Transmission" hint="Select fuel type and gearbox">
          <QuestionBlock label="Fuel Type">
            <ChipRow options={FUEL_OPTIONS} value={form.fuel} onChange={(fuel) => patchForm({ fuel })} />
          </QuestionBlock>
          <QuestionBlock label="Transmission">
            <ChipRow
              options={TRANSMISSION_OPTIONS}
              value={form.transmission}
              onChange={(v) => patchForm({ transmission: v as 'manual' | 'automatic' })}
            />
          </QuestionBlock>
        </StepBlock>
        <View style={styles.footerRow}>
          <LinkButton label="← Back" onPress={() => setStep('details_usage')} />
          <PrimaryButton label="Next → Condition" icon="arrow-forward-outline" onPress={() => setStep('details_condition')} />
        </View>
      </HealthCheckShell>
    );
  }

  if (step === 'details_condition') {
    return (
      <HealthCheckShell
        title="Car Resale Value"
        subtitle="Condition & History"
        navigation={navigation}
        headerIcon="cash-outline"
        progress={progress}
        stepLabel={stepLabel}
      >
        <StepBlock icon="shield-checkmark-outline" title="Condition & History" hint="Honest answers give a better range">
          <QuestionBlock label="Overall Condition">
            <ChipRow
              options={CONDITION_OPTIONS}
              value={form.condition}
              onChange={(v) => patchForm({ condition: v as ResaleCondition })}
            />
          </QuestionBlock>
          <QuestionBlock label="Tyre condition">
            <ChipRow
              options={TYRE_OPTIONS}
              value={form.tyreCondition}
              onChange={(v) => patchForm({ tyreCondition: v as ResaleTyreCondition })}
            />
          </QuestionBlock>
          <QuestionBlock label="Body & paint work">
            <ChipRow
              options={BODY_PAINT_OPTIONS}
              value={form.bodyPaint}
              onChange={(v) => patchForm({ bodyPaint: v as ResaleBodyPaint })}
            />
          </QuestionBlock>
          <QuestionBlock label="Major accident history?">
            <ChipRow options={YES_NO_OPTIONS} value={form.hadAccident} onChange={(hadAccident) => patchForm({ hadAccident })} />
          </QuestionBlock>
          <QuestionBlock label="Insurance valid?">
            <ChipRow options={YES_NO_OPTIONS} value={form.insuranceValid} onChange={(insuranceValid) => patchForm({ insuranceValid })} />
          </QuestionBlock>
          <QuestionBlock label="Service records available?">
            <ChipRow
              options={SERVICE_RECORD_OPTIONS}
              value={form.serviceRecords}
              onChange={(v) => patchForm({ serviceRecords: v as ResaleServiceRecords })}
            />
          </QuestionBlock>
          <QuestionBlock label="Last service done">
            <ChipRow
              options={LAST_SERVICE_OPTIONS}
              value={form.lastService}
              onChange={(v) => patchForm({ lastService: v as ResaleLastService })}
            />
          </QuestionBlock>
        </StepBlock>
        <View style={styles.footerRow}>
          <LinkButton label="← Back" onPress={() => setStep('details_fuel')} />
          <PrimaryButton label="Next → Ownership" icon="arrow-forward-outline" onPress={() => setStep('details_ownership')} />
        </View>
      </HealthCheckShell>
    );
  }

  if (step === 'details_ownership') {
    return (
      <HealthCheckShell
        title="Car Resale Value"
        subtitle="Ownership & Keys"
        navigation={navigation}
        headerIcon="cash-outline"
        progress={progress}
        stepLabel={stepLabel}
      >
        <StepBlock icon="document-text-outline" title="Ownership & Keys" hint="Loan status affects buyer interest">
          <QuestionBlock label="Loan / hypothecation active?">
            <ChipRow options={YES_NO_OPTIONS} value={form.hypothecation} onChange={(hypothecation) => patchForm({ hypothecation })} />
          </QuestionBlock>
          <QuestionBlock label="Duplicate key available?">
            <ChipRow options={YES_NO_OPTIONS} value={form.duplicateKey} onChange={(duplicateKey) => patchForm({ duplicateKey })} />
          </QuestionBlock>
        </StepBlock>
        <PrimaryButton label="Get Resale Estimate" icon="trending-up-outline" onPress={onGetEstimate} disabled={!detailsValid} />
        {!detailsValid ? (
          <Text style={styles.validationHint}>Fill registration year and KM driven to get estimate.</Text>
        ) : null}
        <LinkButton label="← Back" onPress={() => setStep('details_condition')} />
      </HealthCheckShell>
    );
  }

  return (
    <HealthCheckShell title="Car Resale Value" subtitle="Instant market range for your car" navigation={navigation} headerIcon="cash-outline">
      <View style={styles.compactHero}>
        <View style={styles.compactHeroGlow} />
        <View style={styles.compactHeroRow}>
          <View style={styles.compactHeroCopy}>
            <Text style={styles.heroTitle}>Know Your Car&apos;s Worth</Text>
            <Text style={styles.heroBody}>Get an indicative resale range based on your car, usage and city market.</Text>
            <View style={styles.heroPills}>
              <HeroPill icon="flash-outline" label="Instant" />
              <HeroPill icon="location-outline" label="City-based" />
              <HeroPill icon="shield-checkmark-outline" label="Private" />
            </View>
          </View>
          <View style={styles.heroIconRight}>
            <Ionicons name="cash-outline" size={28} color="#93C5FD" />
          </View>
        </View>
      </View>

      {locationBanner}

      <VehiclePickerCard
        vehicles={vehicles}
        selectedId={selectedCar?.vehicle?.id || null}
        onSelect={(v) => {
          if (!v) return;
          applySavedVehicle(v);
        }}
        onAddOther={openBrandPicker}
      />

      {selectedCar ? (
        <StepBlock icon="checkmark-circle-outline" title="Selected Car" hint="Continue to answer a few questions">
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
          <View style={{ marginTop: 12 }}>
            <PrimaryButton label="Continue to Details" icon="arrow-forward-outline" onPress={() => setStep('details_car')} />
          </View>
        </StepBlock>
      ) : (
        <ToolCard variant="soft">
          <Text style={styles.cardTitle}>Start valuation</Text>
          <Text style={styles.cardBody}>Pick a saved car above or tap “Check another car” to choose brand and model.</Text>
          <View style={{ marginTop: 12 }}>
            <PrimaryButton label="Select Brand" icon="car-outline" onPress={openBrandPicker} />
          </View>
        </ToolCard>
      )}
    </HealthCheckShell>
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
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  locationText: { fontSize: 13, fontWeight: '800', color: '#0F172A', flex: 1 },
  locationHint: { fontSize: 11, fontWeight: '600', color: '#64748B', lineHeight: 16 },
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
  cardTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
  cardBody: { fontSize: 12, fontWeight: '600', color: '#64748B', lineHeight: 18 },
  validationHint: { marginTop: 8, fontSize: 11, fontWeight: '600', color: '#64748B', textAlign: 'center' },
  syncHint: { fontSize: 11, fontWeight: '600', color: '#64748B', textAlign: 'center', marginBottom: 10 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
});
