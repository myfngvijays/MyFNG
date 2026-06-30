import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HealthCheckShell, {
  ChipRow,
  ConsentCard,
  FeaturePills,
  FieldInput,
  FieldLabel,
  HeroCard,
  LinkButton,
  PrimaryButton,
  QuestionBlock,
  RegPlate,
  SecondaryButton,
  SelectChipGrid,
  StepBlock,
  ToggleOption,
  ToolCard,
  FuelChipRow,
  YearPickerField,
  DatePickerField,
  SectionDivider,
  type HealthFuelType,
} from '../../components/smartTools/HealthCheckShell';
import CarModelSearchField from '../../components/CarModelSearchField';
import CarHealthReportView from '../../components/smartTools/CarHealthReportView';
import { COLORS } from '../../constants/theme';
import { submitHealthReportPayload } from '../../lib/healthReportSubmit';
import {
  computeHealthReport,
  emptyRc,
  lookupRc,
  cacheRcData,
  buildHealthReportDocument,
  mapHealthCtaToServiceCategory,
  SYMPTOM_GROUPS,
  WARNING_LIGHTS,
  type FuelType,
  type HealthCheckInput,
  type HealthReport,
  type HealthWizardStep,
  type RcData,
  type TransmissionType,
  type Category,
} from '../../lib/vehicleHealthScore';
import { trackEvent } from '../../lib/trackEvent';

type Props = { navigation: any };

const HEALTH_SESSION_KEY = 'health_check_session_v1';

const STEPS: HealthWizardStep[] = [
  'intro',
  'rc',
  'vehicle_confirm',
  'basics',
  'usage',
  'service',
  'symptoms',
  'wear',
  'warning_lights',
  'compliance',
  'generating',
  'report',
];

const SKIPPABLE: HealthWizardStep[] = ['usage', 'service', 'symptoms', 'wear', 'warning_lights', 'compliance'];

function normalizeHealthFuel(raw?: string): HealthFuelType {
  const f = String(raw || '').toLowerCase();
  if (f.includes('diesel')) return 'Diesel';
  if (f.includes('cng')) return 'CNG';
  return 'Petrol';
}

const TRANS_OPTIONS = [
  { label: 'Manual', value: 'Manual' },
  { label: 'AMT', value: 'AMT' },
  { label: 'Automatic', value: 'Automatic' },
  { label: 'DCT', value: 'DCT' },
];

const MAJOR_JOBS = [
  { id: 'clutch', label: 'Clutch' },
  { id: 'timing belt', label: 'Timing Belt' },
  { id: 'AC compressor', label: 'AC Compressor' },
  { id: 'battery', label: 'Battery' },
  { id: 'tyres', label: 'Tyres' },
  { id: 'suspension', label: 'Suspension' },
  { id: 'brakes', label: 'Brakes' },
  { id: 'service', label: 'Service' },
];

const MONTHLY_RUNNING = [
  { label: 'Under 500 km', value: '<500' },
  { label: '500 – 1000 km', value: '500-1000' },
  { label: '1000 – 2000 km', value: '1000-2000' },
  { label: '2000+ km', value: '2000+' },
];

const DRIVING_TYPES = [
  { label: 'City Stop-Go', value: 'city' },
  { label: 'Highway', value: 'highway' },
  { label: 'Mixed', value: 'mixed' },
];

const AREA_CONDITIONS = [
  { label: 'Normal', value: 'normal' },
  { label: 'Coastal', value: 'coastal' },
  { label: 'Flood-Prone', value: 'flood' },
];

const PARKING_OPTIONS = [
  { label: 'Covered', value: 'covered' },
  { label: 'Open', value: 'open' },
];

const LAST_SERVICE = [
  { label: 'Under 3 Months', value: '<3' },
  { label: '3 – 6 Months', value: '3-6' },
  { label: '6 – 12 Months', value: '6-12' },
  { label: '12+ Months', value: '12+' },
  { label: "Don't Remember", value: 'dont_remember' },
];

const SERVICE_PROVIDERS = [
  { label: 'Authorised', value: 'authorized' },
  { label: 'Local Garage', value: 'local' },
  { label: 'MyFNG', value: 'myfng' },
  { label: 'Self Service', value: 'self' },
  { label: 'Not Regular', value: 'not_regular' },
];

function stepIndex(step: HealthWizardStep): number {
  return STEPS.indexOf(step);
}

function nextStep(step: HealthWizardStep): HealthWizardStep {
  const i = stepIndex(step);
  return STEPS[Math.min(i + 1, STEPS.length - 1)];
}

function prevStep(step: HealthWizardStep): HealthWizardStep {
  const i = stepIndex(step);
  return STEPS[Math.max(i - 1, 0)];
}

function defaultInput(): Partial<HealthCheckInput> {
  return {
    symptoms: [],
    warningLights: [],
    transmission: 'Manual',
  };
}

export default function CarHealthCheckScreen({ navigation }: Props) {
  const [step, setStep] = useState<HealthWizardStep>('intro');
  const [consent, setConsent] = useState(false);
  const [regInput, setRegInput] = useState('');
  const [rc, setRc] = useState<RcData | null>(null);
  const [manualRc, setManualRc] = useState(false);
  const [input, setInput] = useState<Partial<HealthCheckInput>>(defaultInput());
  const [report, setReport] = useState<HealthReport | null>(null);
  const [rcLoading, setRcLoading] = useState(false);
  const [rcError, setRcError] = useState('');
  const [carSearchDisplay, setCarSearchDisplay] = useState('');
  const spin = useRef(new Animated.Value(0)).current;

  const progress = useMemo(() => {
    const idx = stepIndex(step);
    if (step === 'report') return 100;
    return Math.round(((idx + 1) / (STEPS.length - 1)) * 100);
  }, [step]);

  useEffect(() => {
    trackEvent('health_check_started');
    AsyncStorage.getItem(HEALTH_SESSION_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as {
          step?: HealthWizardStep;
          report?: HealthReport;
          rc?: RcData;
          input?: Partial<HealthCheckInput>;
          carSearchDisplay?: string;
        };
        if (saved.step === 'report' && saved.report && saved.rc) {
          setReport(saved.report);
          setRc(saved.rc);
          setInput(saved.input || defaultInput());
          setCarSearchDisplay(saved.carSearchDisplay || `${saved.rc.make} ${saved.rc.model}`.trim());
          setStep('report');
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step !== 'generating') return;
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }),
    ).start();
    const timer = setTimeout(() => {
      if (!rc || input.odometer == null) return;
      const fullInput: HealthCheckInput = {
        ...defaultInput(),
        ...input,
        odometer: input.odometer,
        transmission: (input.transmission || 'Manual') as TransmissionType,
        symptoms: input.symptoms || [],
        warningLights: input.warningLights || [],
        insurance_valid_till: input.insurance_valid_till || rc.insuranceValidTill,
        puc_valid_till: input.puc_valid_till || rc.pucValidTill,
        challans_pending: input.challans_pending || rc.challansPending,
      };
      const result = computeHealthReport(fullInput, rc);
      setReport(result);
      const sessionPayload = {
        step: 'report' as const,
        report: result,
        rc,
        input: fullInput,
        carSearchDisplay,
        savedAt: Date.now(),
      };
      AsyncStorage.setItem(HEALTH_SESSION_KEY, JSON.stringify(sessionPayload)).catch(() => {});
      AsyncStorage.setItem(
        `health_report:${rc.regNumber}`,
        JSON.stringify({ report: result, rc, generatedAt: result.generatedAt }),
      ).catch(() => {});
      trackEvent('health_check_report_generated');
      const reportText = buildHealthReportDocument(result, rc);
      trackEvent('health_check_submitted');
      submitHealthReportPayload({
        reg_number: rc.regNumber,
        make: rc.make,
        model: rc.model,
        fuel: rc.fuel,
        registration_year: rc.registrationYear,
        odometer: result.odometer,
        composite_score: result.composite,
        band_label: result.band.label,
        accuracy: result.accuracy,
        report_json: result,
        report_text: reportText,
      }).catch(() => {});
      setStep('report');
    }, 2200);
    return () => clearTimeout(timer);
  }, [step, rc, input, spin, carSearchDisplay]);

  const goNext = () => setStep((s) => { const next = nextStep(s); trackEvent('health_check_step_completed', { step: stepIndex(s) }); return next; });
  const goBack = () => setStep((s) => prevStep(s));
  const skip = () => goNext();

  const fetchRc = async () => {
    if (!consent) {
      setRcError('Please accept RC lookup consent to continue.');
      return;
    }
    setRcLoading(true);
    setRcError('');
    const result = await lookupRc(regInput);
    setRcLoading(false);
    if (result.ok) {
      setRc({ ...result.data, fuel: normalizeHealthFuel(result.data.fuel) });
      setCarSearchDisplay(`${result.data.make} ${result.data.model}`.trim());
      setManualRc(false);
      setRcError('');
      setStep('vehicle_confirm');
      return;
    }
    setRc({ ...emptyRc(regInput), fuel: 'Petrol' });
    setCarSearchDisplay('');
    setManualRc(true);
    setRcError('');
    setStep('vehicle_confirm');
  };

  const confirmVehicle = async () => {
    if (!rc?.make?.trim() || !rc?.model?.trim()) {
      setRcError('Please search and select your car from the list.');
      return;
    }
    if (!rc?.registrationYear || rc.registrationYear < 1990) {
      setRcError('Please select registration year.');
      return;
    }
    await cacheRcData(rc);
    setRcError('');
    goNext();
  };

  const toggleSymptom = (id: string) => {
    setInput((prev) => {
      const list = prev.symptoms || [];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      return { ...prev, symptoms: next };
    });
  };

  const toggleLight = (id: string) => {
    setInput((prev) => {
      const list = prev.warningLights || [];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      return { ...prev, warningLights: next };
    });
  };

  const toggleTyreCondition = (id: string) => {
    setInput((prev) => {
      const list = prev.tyre_condition || [];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      return { ...prev, tyre_condition: next };
    });
  };

  const toggleMajorJob = (job: string) => {
    setInput((prev) => {
      const list = prev.recent_major_jobs || [];
      const exists = list.find((j) => j.job === job);
      const next = exists ? list.filter((j) => j.job !== job) : [...list, { job, monthsAgo: 6 }];
      return { ...prev, recent_major_jobs: next };
    });
  };

  const handleCta = (ctaType: string, title: string, category?: Category | 'PREDICTIVE') => {
    if (ctaType === 'INSURANCE_HELP') {
      navigation.navigate('SmartToolWeb', { url: 'https://myfng.in/insurance-claim-help', title: 'Insurance Help' });
      return;
    }
    const serviceCategory = mapHealthCtaToServiceCategory(ctaType, title, category);
    navigation.navigate('PublicBookServiceNow', { serviceCategory });
  };

  const restart = async () => {
    await AsyncStorage.removeItem(HEALTH_SESSION_KEY).catch(() => {});
    setStep('intro');
    setConsent(false);
    setRegInput('');
    setRc(null);
    setManualRc(false);
    setInput(defaultInput());
    setReport(null);
    setRcError('');
    setCarSearchDisplay('');
  };

  const isAuto = input.transmission === 'Automatic' || input.transmission === 'AMT' || input.transmission === 'DCT';

  const subtitle =
    step === 'intro'
      ? 'Free AI-powered vehicle health score'
      : step === 'report'
        ? 'Your personalised health report'
        : step === 'generating'
          ? 'Building your report…'
          : `Step ${stepIndex(step) + 1} of ${STEPS.length - 1}`;

  const stepLabel =
    step === 'intro'
      ? 'Getting Started'
      : step === 'rc'
        ? 'Vehicle Lookup'
        : step === 'vehicle_confirm'
          ? 'Confirm Car'
          : step === 'basics'
            ? 'Car Basics'
            : step === 'usage'
              ? 'Usage Pattern'
              : step === 'service'
                ? 'Service History'
                : step === 'symptoms'
                  ? 'Symptoms'
                  : step === 'wear'
                    ? 'Wear Items'
                    : step === 'warning_lights'
                      ? 'Warning Lights'
                      : step === 'compliance'
                        ? 'Compliance'
                        : 'Progress';

  const footer =
    step !== 'report' && step !== 'generating' && step !== 'intro' ? (
      <View style={styles.footerRow}>
        {step !== 'rc' && step !== 'vehicle_confirm' ? (
          <SecondaryButton label="Back" onPress={goBack} />
        ) : null}
        {SKIPPABLE.includes(step) ? (
          <TouchableOpacity style={styles.skipBtn} onPress={skip}>
            <Text style={styles.skipText}>Skip this step</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    ) : null;

  const renderStep = () => {
    switch (step) {
      case 'intro':
        return (
          <>
            <HeroCard>
              <View style={styles.introBadges}>
                <View style={styles.introBadgeFree}>
                  <Text style={styles.introBadgeFreeText}>100% FREE</Text>
                </View>
                <View style={styles.introBadgeTime}>
                  <Ionicons name="time-outline" size={12} color="#BFDBFE" />
                  <Text style={styles.introBadgeTimeText}>~90 seconds</Text>
                </View>
              </View>

              <View style={styles.introIconRing}>
                <View style={styles.introIconInner}>
                  <Ionicons name="pulse" size={32} color="#34D399" />
                </View>
              </View>

              <Text style={styles.introTitle}>Free Car Health Report</Text>
              <Text style={styles.introBody}>Know your car's risk score in under 2 minutes. No login or service history needed.</Text>
              <Text style={styles.tagline}>Your Friendly Neighbourhood Garage.</Text>

              <FeaturePills
                items={[
                  { icon: 'person-outline', label: 'No login' },
                  { icon: 'document-text-outline', label: 'RC auto-fill' },
                  { icon: 'analytics-outline', label: 'Instant score' },
                ]}
              />
            </HeroCard>

            <ConsentCard
              checked={consent}
              onToggle={() => setConsent((v) => !v)}
              title="Registry lookup consent"
              body="We'll fetch your vehicle details from the official registry to auto-fill this report (DPDP consent)."
            />

            <PrimaryButton
              label="Start Health Check"
              icon="arrow-forward"
              disabled={!consent}
              onPress={() => setStep('rc')}
            />
          </>
        );

      case 'rc':
        return (
          <>
            <StepBlock
              icon="car-outline"
              title="Enter Registration Number"
              hint="We'll auto-fill Make, Model & compliance details"
            >
              <FieldLabel>Registration Number</FieldLabel>
              <FieldInput
                value={regInput}
                onChangeText={setRegInput}
                placeholder="e.g. MH12AB1234"
                autoCapitalize="characters"
              />
              {rcError ? <Text style={styles.error}>{rcError}</Text> : null}
            </StepBlock>
            <PrimaryButton
              label={rcLoading ? 'Fetching…' : 'Fetch Vehicle Details'}
              icon="search"
              onPress={fetchRc}
              disabled={rcLoading || !regInput.trim()}
            />
            {rcLoading ? <ActivityIndicator style={{ marginTop: 12 }} color={COLORS.primary} /> : null}
            <LinkButton
              label="Enter details manually"
              onPress={() => {
                setRc({ ...emptyRc(regInput || 'UNKNOWN'), fuel: 'Petrol' });
                setCarSearchDisplay('');
                setManualRc(true);
                setRcError('');
                setStep('vehicle_confirm');
              }}
            />
          </>
        );

      case 'vehicle_confirm':
        return (
          <>
            <StepBlock
              icon="checkmark-circle-outline"
              title="Confirm Vehicle Details"
              hint={manualRc ? 'Search your car — same as booking flow' : 'Review auto-filled details from RC registry'}
              badge={!manualRc ? 'Auto-Filled from RC' : undefined}
            >
              {rc?.regNumber && rc.regNumber !== 'UNKNOWN' ? <RegPlate number={rc.regNumber} /> : null}
              {manualRc ? <Text style={styles.manualHint}>RC lookup unavailable. Search and select your car below.</Text> : null}

              <QuestionBlock label="Select Your Car" hint="Search make or model — no manual typing">
                <CarModelSearchField
                  variant="premium"
                  displayValue={carSearchDisplay}
                  selectedMake={rc?.make}
                  selectedModel={rc?.model}
                  placeholder="Search e.g. Skoda Rapid, Maruti Swift"
                  onSelect={(make, model, display) => {
                    setRc((r) => (r ? { ...r, make, model } : r));
                    setCarSearchDisplay(display);
                    setRcError('');
                  }}
                  onClear={() => {
                    setRc((r) => (r ? { ...r, make: '', model: '' } : r));
                    setCarSearchDisplay('');
                  }}
                />
              </QuestionBlock>

              <SectionDivider />

              <QuestionBlock label="Registration Year">
                <YearPickerField
                  value={rc?.registrationYear || undefined}
                  onChange={(year) => {
                    setRc((r) => (r ? { ...r, registrationYear: year } : r));
                    setRcError('');
                  }}
                  placeholder="Tap to select year"
                />
              </QuestionBlock>

              <SectionDivider />

              <QuestionBlock label="Fuel Type">
                <FuelChipRow
                  value={normalizeHealthFuel(rc?.fuel)}
                  onChange={(v) => setRc((r) => (r ? { ...r, fuel: v as FuelType } : r))}
                />
              </QuestionBlock>

              {rcError ? <Text style={styles.error}>{rcError}</Text> : null}
            </StepBlock>
            <PrimaryButton label="Confirm & Continue" icon="checkmark" onPress={confirmVehicle} />
          </>
        );

      case 'basics':
        return (
          <>
            <StepBlock icon="speedometer-outline" title="Car Basics" hint="Required for an accurate health score">
              <QuestionBlock label="Current Odometer (km)" required hint="Enter your latest odometer reading">
                <FieldInput
                  value={input.odometer != null ? String(input.odometer) : ''}
                  onChangeText={(t) => setInput((p) => ({ ...p, odometer: Number(t.replace(/\D/g, '')) || undefined }))}
                  keyboardType="numeric"
                  placeholder="45000"
                />
              </QuestionBlock>
              <SectionDivider />
              <QuestionBlock label="Transmission">
                <ChipRow
                  options={TRANS_OPTIONS}
                  value={input.transmission || 'Manual'}
                  onChange={(v) => setInput((p) => ({ ...p, transmission: v as TransmissionType }))}
                />
              </QuestionBlock>
            </StepBlock>
            <PrimaryButton
              label="Continue"
              icon="arrow-forward"
              onPress={() => {
                if (!input.odometer || input.odometer <= 0) {
                  setRcError('Odometer is required.');
                  return;
                }
                setRcError('');
                goNext();
              }}
            />
            {rcError ? <Text style={styles.errorCenter}>{rcError}</Text> : null}
          </>
        );

      case 'usage':
        return (
          <>
            <StepBlock icon="navigate-outline" title="Usage Pattern" hint="Optional — helps refine your report">
              <QuestionBlock label="Monthly Running">
                <ChipRow
                  options={MONTHLY_RUNNING}
                  value={input.monthly_running || ''}
                  onChange={(v) => setInput((p) => ({ ...p, monthly_running: v }))}
                />
              </QuestionBlock>
              <SectionDivider />
              <QuestionBlock label="Driving Type">
                <ChipRow
                  options={DRIVING_TYPES}
                  value={input.driving_type || ''}
                  onChange={(v) => setInput((p) => ({ ...p, driving_type: v as HealthCheckInput['driving_type'] }))}
                />
              </QuestionBlock>
              <SectionDivider />
              <QuestionBlock label="Area Condition">
                <ChipRow
                  options={AREA_CONDITIONS}
                  value={input.area_condition || ''}
                  onChange={(v) => setInput((p) => ({ ...p, area_condition: v as HealthCheckInput['area_condition'] }))}
                />
              </QuestionBlock>
              <SectionDivider />
              <QuestionBlock label="Parking">
                <ChipRow
                  options={PARKING_OPTIONS}
                  value={input.parking || ''}
                  onChange={(v) => setInput((p) => ({ ...p, parking: v as HealthCheckInput['parking'] }))}
                />
              </QuestionBlock>
            </StepBlock>
            <PrimaryButton label="Continue" icon="arrow-forward" onPress={goNext} />
          </>
        );

      case 'service':
        return (
          <>
            <StepBlock icon="construct-outline" title="Service History" hint="Optional — improves report accuracy">
              <QuestionBlock label="Last Service">
                <ChipRow
                  options={LAST_SERVICE}
                  value={input.last_service_months || ''}
                  onChange={(v) => setInput((p) => ({ ...p, last_service_months: v as HealthCheckInput['last_service_months'] }))}
                />
              </QuestionBlock>
              <SectionDivider />
              <QuestionBlock label="Km at Last Service" hint="Optional">
                <FieldInput
                  value={input.odometer_last_service != null ? String(input.odometer_last_service) : ''}
                  onChangeText={(t) =>
                    setInput((p) => ({ ...p, odometer_last_service: Number(t.replace(/\D/g, '')) || undefined }))
                  }
                  keyboardType="numeric"
                  placeholder="38000"
                />
              </QuestionBlock>
              <SectionDivider />
              <QuestionBlock label="Service Provider">
                <ChipRow
                  options={SERVICE_PROVIDERS}
                  value={input.service_provider || ''}
                  onChange={(v) => setInput((p) => ({ ...p, service_provider: v as HealthCheckInput['service_provider'] }))}
                />
              </QuestionBlock>
              <SectionDivider />
              <QuestionBlock label="Recent Major Jobs" hint="Tap all that apply">
                <SelectChipGrid
                  options={MAJOR_JOBS}
                  selected={input.recent_major_jobs?.map((j) => j.job) || []}
                  onToggle={toggleMajorJob}
                />
              </QuestionBlock>
            </StepBlock>
            <PrimaryButton label="Continue" icon="arrow-forward" onPress={goNext} />
          </>
        );

      case 'symptoms':
        return (
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <ToolCard variant="soft">
              <Text style={styles.symptomsIntroTitle}>Any Symptoms?</Text>
              <Text style={styles.symptomsIntroBody}>Tap what you notice right now. Optional — skip if none.</Text>
            </ToolCard>
            {SYMPTOM_GROUPS.map((group) => {
              if (group.title === 'Transmission') {
                const items = group.items.filter((it) => {
                  if (isAuto) return it.id.startsWith('trans_');
                  return it.id.startsWith('clutch_') || it.id.startsWith('gear_');
                });
                if (!items.length) return null;
                return (
                  <ToolCard key={group.title} variant="outline">
                    <Text style={styles.groupTitle}>{group.title}</Text>
                    {items.map((it) => (
                      <SymptomRow key={it.id} id={it.id} label={it.label} on={input.symptoms?.includes(it.id)} onToggle={toggleSymptom} />
                    ))}
                  </ToolCard>
                );
              }
              return (
                <ToolCard key={group.title} variant="outline">
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {group.items.map((it) => (
                    <SymptomRow key={it.id} id={it.id} label={it.label} on={input.symptoms?.includes(it.id)} onToggle={toggleSymptom} />
                  ))}
                </ToolCard>
              );
            })}
            <PrimaryButton label="Continue" icon="arrow-forward" onPress={goNext} />
          </ScrollView>
        );

      case 'wear':
        return (
          <>
            <StepBlock icon="ellipse-outline" title="Wear Items" hint="Optional — battery, tyres & wipers">
              <QuestionBlock label="Tyre Condition">
                <SelectChipGrid
                  options={[
                    { id: 'cracks_bulges', label: 'Cracks / Bulges' },
                    { id: 'low_tread', label: 'Low Tread' },
                    { id: 'looks_fine', label: 'Looks Fine' },
                  ]}
                  selected={input.tyre_condition || []}
                  onToggle={toggleTyreCondition}
                />
              </QuestionBlock>
              <QuestionBlock label="Battery Age (Years)" hint="Optional">
                <FieldInput
                  value={input.battery_age != null ? String(input.battery_age) : ''}
                  onChangeText={(t) => setInput((p) => ({ ...p, battery_age: Number(t) || undefined }))}
                  keyboardType="decimal-pad"
                  placeholder="2"
                />
              </QuestionBlock>
              <ToggleOption
                label="Slow Cranking in the Morning"
                checked={!!input.battery_slow_crank}
                onPress={() => setInput((p) => ({ ...p, battery_slow_crank: !p.battery_slow_crank }))}
              />
              <ToggleOption
                label="Wipers Smearing"
                checked={!!input.wiper_smear}
                onPress={() => setInput((p) => ({ ...p, wiper_smear: !p.wiper_smear }))}
              />
            </StepBlock>
            <PrimaryButton label="Continue" icon="arrow-forward" onPress={goNext} />
          </>
        );

      case 'warning_lights':
        return (
          <>
            <StepBlock icon="warning-outline" title="Warning Lights" hint="Tap all that are ON right now — optional">
              <SelectChipGrid
                options={WARNING_LIGHTS.map((l) => ({ id: l.id, label: l.label }))}
                selected={input.warningLights || []}
                onToggle={toggleLight}
              />
            </StepBlock>
            <PrimaryButton label="Continue" icon="arrow-forward" onPress={goNext} />
          </>
        );

      case 'compliance':
        return (
          <>
            <StepBlock icon="document-text-outline" title="Compliance" hint="Insurance, PUC & challan status">
              <QuestionBlock label="Insurance Valid Till">
                <DatePickerField
                  value={input.insurance_valid_till || rc?.insuranceValidTill || ''}
                  onChange={(t) => setInput((p) => ({ ...p, insurance_valid_till: t }))}
                  placeholder="DD-MM-YYYY"
                />
              </QuestionBlock>
              <SectionDivider />
              <QuestionBlock label="PUC Valid Till">
                <DatePickerField
                  value={input.puc_valid_till || rc?.pucValidTill || ''}
                  onChange={(t) => setInput((p) => ({ ...p, puc_valid_till: t }))}
                  placeholder="DD-MM-YYYY"
                />
              </QuestionBlock>
              <SectionDivider />
              <QuestionBlock label="Pending Challans?">
                <ChipRow
                  options={[
                    { label: 'Yes', value: 'yes' },
                    { label: 'No', value: 'no' },
                    { label: 'Unknown', value: 'unknown' },
                  ]}
                  value={input.challans_pending || rc?.challansPending || ''}
                  onChange={(v) => setInput((p) => ({ ...p, challans_pending: v as HealthCheckInput['challans_pending'] }))}
                />
              </QuestionBlock>
            </StepBlock>
            <PrimaryButton label="Generate Report" icon="document-text" onPress={() => setStep('generating')} />
          </>
        );

      case 'generating':
        return (
          <View style={styles.generating}>
            <View style={styles.generatingRing}>
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
                    },
                  ],
                }}
              >
                <Ionicons name="sync" size={40} color={COLORS.primary} />
              </Animated.View>
            </View>
            <Text style={styles.generatingTitle}>Generating your Car Health Report</Text>
            <Text style={styles.generatingSub}>Analysing symptoms, compliance & preventive wear…</Text>
            <View style={styles.generatingDots}>
              <View style={styles.generatingDot} />
              <View style={[styles.generatingDot, styles.generatingDotMid]} />
              <View style={styles.generatingDot} />
            </View>
          </View>
        );

      case 'report':
        return report && rc ? (
          <CarHealthReportView report={report} rc={rc} onCta={handleCta} onRestart={restart} />
        ) : null;

      default:
        return null;
    }
  };

  return (
    <HealthCheckShell
      title="Smart Health Checkup"
      subtitle={subtitle}
      navigation={navigation}
      footer={footer}
      scroll={step !== 'generating'}
      progress={step !== 'report' && step !== 'generating' ? progress : undefined}
      stepLabel={stepLabel}
    >
      {renderStep()}
    </HealthCheckShell>
  );
}

function SymptomRow({
  id,
  label,
  on,
  onToggle,
}: {
  id: string;
  label: string;
  on?: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.symptomRow, on ? styles.symptomRowOn : null]}
      onPress={() => onToggle(id)}
      activeOpacity={0.88}
    >
      <View style={[styles.symptomCheck, on ? styles.symptomCheckOn : null]}>
        {on ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
      </View>
      <Text style={[styles.symptomText, on ? styles.symptomTextOn : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  introBadges: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  introBadgeFree: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  introBadgeFreeText: { fontSize: 10, fontWeight: '900', color: '#6EE7B7', letterSpacing: 0.6 },
  introBadgeTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.25)',
  },
  introBadgeTimeText: { fontSize: 10, fontWeight: '800', color: '#BFDBFE' },
  introIconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  introIconInner: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: { fontSize: 21, fontWeight: '900', color: '#FFFFFF', marginBottom: 6, letterSpacing: 0.2 },
  introBody: { fontSize: 13, fontWeight: '600', color: '#CBD5E1', lineHeight: 20 },
  tagline: { marginTop: 10, fontSize: 11, fontWeight: '700', color: '#93C5FD', fontStyle: 'italic' },
  manualHint: { fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 10, lineHeight: 16 },
  symptomsIntroTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  symptomsIntroBody: { fontSize: 11, fontWeight: '600', color: '#64748B', lineHeight: 16 },
  groupTitle: { fontSize: 13, fontWeight: '900', color: COLORS.primary, marginBottom: 8 },
  symptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginBottom: 6,
  },
  symptomRowOn: { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' },
  symptomCheck: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  symptomCheckOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  symptomText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#334155' },
  symptomTextOn: { color: COLORS.primary, fontWeight: '800' },
  error: { marginTop: 4, fontSize: 11, fontWeight: '700', color: '#DC2626' },
  errorCenter: { textAlign: 'center', marginTop: 8, fontSize: 11, fontWeight: '700', color: '#DC2626' },
  generating: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  generatingRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  generatingTitle: { marginTop: 22, fontSize: 17, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  generatingSub: { marginTop: 6, fontSize: 12, fontWeight: '600', color: '#64748B', textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
  generatingDots: { flexDirection: 'row', gap: 8, marginTop: 18 },
  generatingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#BFDBFE' },
  generatingDotMid: { backgroundColor: COLORS.primary, width: 22 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  skipText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
});
