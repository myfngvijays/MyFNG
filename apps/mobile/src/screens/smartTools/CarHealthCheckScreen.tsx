import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SmartToolShell, { ChipRow, PrimaryButton, ToolCard } from '../../components/smartTools/SmartToolShell';
import CarHealthReportView from '../../components/smartTools/CarHealthReportView';
import { COLORS } from '../../constants/theme';
import {
  computeHealthReport,
  emptyRc,
  lookupRc,
  cacheRcData,
  SYMPTOM_GROUPS,
  WARNING_LIGHTS,
  type FuelType,
  type HealthCheckInput,
  type HealthReport,
  type HealthWizardStep,
  type RcData,
  type TransmissionType,
} from '../../lib/vehicleHealthScore';

type Props = { navigation: any };

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

const FUEL_OPTIONS = [
  { label: 'Petrol', value: 'Petrol' },
  { label: 'Diesel', value: 'Diesel' },
  { label: 'CNG', value: 'CNG' },
  { label: 'Electric', value: 'Electric' },
  { label: 'Hybrid', value: 'Hybrid' },
];

const TRANS_OPTIONS = [
  { label: 'Manual', value: 'Manual' },
  { label: 'AMT', value: 'AMT' },
  { label: 'Automatic', value: 'Automatic' },
  { label: 'DCT', value: 'DCT' },
];

const MAJOR_JOBS = ['clutch', 'timing belt', 'AC compressor', 'battery', 'tyres', 'suspension', 'brakes', 'service'];

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
  const spin = useRef(new Animated.Value(0)).current;

  const progress = useMemo(() => {
    const idx = stepIndex(step);
    if (step === 'report') return 100;
    return Math.round(((idx + 1) / (STEPS.length - 1)) * 100);
  }, [step]);

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
      AsyncStorage.setItem(
        `health_report:${rc.regNumber}`,
        JSON.stringify({ report: result, rc, generatedAt: result.generatedAt }),
      ).catch(() => {});
      setStep('report');
    }, 2200);
    return () => clearTimeout(timer);
  }, [step, rc, input, spin]);

  const goNext = () => setStep((s) => nextStep(s));
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
      setRc(result.data);
      setManualRc(false);
      setStep('vehicle_confirm');
      return;
    }
    setRc(emptyRc(regInput));
    setManualRc(true);
    setRcError(result.error);
    setStep('vehicle_confirm');
  };

  const confirmVehicle = async () => {
    if (!rc?.make?.trim() || !rc?.model?.trim()) {
      setRcError('Please enter make and model.');
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

  const handleCta = (ctaType: string, title: string) => {
    if (ctaType === 'INSURANCE_HELP') {
      navigation.navigate('SmartToolWeb', { url: 'https://myfng.in/insurance-claim-help', title: 'Insurance Help' });
      return;
    }
    if (ctaType === 'BOOK_SERVICE' || ctaType === 'ADD_TO_CART') {
      navigation.navigate('AIBooking', { prefill: `Book ${title} for my ${rc?.make} ${rc?.model} (${rc?.regNumber})` });
      return;
    }
    navigation.navigate('AIBooking', { prefill: `Free inspection for ${title} — ${rc?.make} ${rc?.model} (${rc?.regNumber})` });
  };

  const restart = () => {
    setStep('intro');
    setConsent(false);
    setRegInput('');
    setRc(null);
    setManualRc(false);
    setInput(defaultInput());
    setReport(null);
    setRcError('');
  };

  const isAuto = input.transmission === 'Automatic' || input.transmission === 'AMT' || input.transmission === 'DCT';

  const subtitle =
    step === 'report'
      ? 'Your health report'
      : step === 'generating'
        ? 'Building your report…'
        : `Step ${stepIndex(step) + 1} of ${STEPS.length - 1}`;

  const footer =
    step !== 'report' && step !== 'generating' && step !== 'intro' ? (
      <View style={styles.footerRow}>
        {step !== 'rc' && step !== 'vehicle_confirm' ? (
          <TouchableOpacity style={styles.secondaryBtn} onPress={goBack}>
            <Text style={styles.secondaryText}>Back</Text>
          </TouchableOpacity>
        ) : null}
        {SKIPPABLE.includes(step) ? (
          <TouchableOpacity style={styles.skipBtn} onPress={skip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    ) : null;

  const renderStep = () => {
    switch (step) {
      case 'intro':
        return (
          <>
            <ToolCard>
              <View style={styles.introIcon}>
                <Ionicons name="pulse" size={28} color="#059669" />
              </View>
              <Text style={styles.introTitle}>Free Car Health Report</Text>
              <Text style={styles.introBody}>~90 seconds. No login or service history needed.</Text>
              <Text style={styles.tagline}>Your Friendly Neighbourhood Garage.</Text>
            </ToolCard>
            <ToolCard>
              <TouchableOpacity style={styles.consentRow} onPress={() => setConsent((v) => !v)} activeOpacity={0.85}>
                <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={22} color={COLORS.primary} />
                <Text style={styles.consentText}>
                  We'll fetch your vehicle details from the official registry to auto-fill this report (DPDP consent).
                </Text>
              </TouchableOpacity>
            </ToolCard>
            <PrimaryButton label="Start Health Check" icon="arrow-forward" onPress={() => setStep('rc')} />
          </>
        );

      case 'rc':
        return (
          <>
            <ToolCard>
              <Text style={styles.label}>Vehicle registration number</Text>
              <TextInput
                style={styles.input}
                value={regInput}
                onChangeText={setRegInput}
                placeholder="e.g. MH12AB1234"
                autoCapitalize="characters"
                placeholderTextColor="#9CA3AF"
              />
              {rcError ? <Text style={styles.error}>{rcError}</Text> : null}
            </ToolCard>
            <PrimaryButton
              label={rcLoading ? 'Fetching…' : 'Fetch Vehicle Details'}
              icon="search"
              onPress={fetchRc}
            />
            {rcLoading ? <ActivityIndicator style={{ marginTop: 12 }} color={COLORS.primary} /> : null}
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => {
                setRc(emptyRc(regInput || 'UNKNOWN'));
                setManualRc(true);
                setStep('vehicle_confirm');
              }}
            >
              <Text style={styles.linkText}>Enter details manually</Text>
            </TouchableOpacity>
          </>
        );

      case 'vehicle_confirm':
        return (
          <>
            <ToolCard>
              <Text style={styles.label}>Confirm vehicle details</Text>
              {manualRc ? <Text style={styles.hint}>RC lookup unavailable — please fill manually.</Text> : null}
              <Text style={styles.fieldLabel}>Registration</Text>
              <Text style={styles.readOnly}>{rc?.regNumber}</Text>
              <Text style={styles.fieldLabel}>Make</Text>
              <TextInput
                style={styles.input}
                value={rc?.make || ''}
                onChangeText={(t) => setRc((r) => (r ? { ...r, make: t } : r))}
                placeholder="Maruti, Hyundai…"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.fieldLabel}>Model</Text>
              <TextInput
                style={styles.input}
                value={rc?.model || ''}
                onChangeText={(t) => setRc((r) => (r ? { ...r, model: t } : r))}
                placeholder="Swift, Creta…"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.fieldLabel}>Registration year</Text>
              <TextInput
                style={styles.input}
                value={String(rc?.registrationYear || '')}
                onChangeText={(t) =>
                  setRc((r) => (r ? { ...r, registrationYear: Number(t) || r.registrationYear } : r))
                }
                keyboardType="numeric"
                placeholder="2019"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.fieldLabel}>Fuel type</Text>
              <ChipRow
                options={FUEL_OPTIONS}
                value={rc?.fuel || 'Petrol'}
                onChange={(v) => setRc((r) => (r ? { ...r, fuel: v as FuelType } : r))}
              />
              {rcError ? <Text style={styles.error}>{rcError}</Text> : null}
            </ToolCard>
            <PrimaryButton label="Confirm & Continue" icon="checkmark" onPress={confirmVehicle} />
          </>
        );

      case 'basics':
        return (
          <>
            <ToolCard>
              <Text style={styles.label}>Current odometer (km) *</Text>
              <TextInput
                style={styles.input}
                value={input.odometer != null ? String(input.odometer) : ''}
                onChangeText={(t) => setInput((p) => ({ ...p, odometer: Number(t.replace(/\D/g, '')) || undefined }))}
                keyboardType="numeric"
                placeholder="e.g. 45000"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Transmission</Text>
              <ChipRow
                options={TRANS_OPTIONS}
                value={input.transmission || 'Manual'}
                onChange={(v) => setInput((p) => ({ ...p, transmission: v as TransmissionType }))}
              />
            </ToolCard>
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
            <ToolCard>
              <Text style={styles.label}>Monthly running</Text>
              <ChipRow
                options={[
                  { label: '<500 km', value: '<500' },
                  { label: '500–1000', value: '500-1000' },
                  { label: '1000–2000', value: '1000-2000' },
                  { label: '2000+', value: '2000+' },
                ]}
                value={input.monthly_running || ''}
                onChange={(v) => setInput((p) => ({ ...p, monthly_running: v }))}
              />
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Driving type</Text>
              <ChipRow
                options={[
                  { label: 'City stop-go', value: 'city' },
                  { label: 'Highway', value: 'highway' },
                  { label: 'Mixed', value: 'mixed' },
                ]}
                value={input.driving_type || ''}
                onChange={(v) => setInput((p) => ({ ...p, driving_type: v as HealthCheckInput['driving_type'] }))}
              />
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Area condition</Text>
              <ChipRow
                options={[
                  { label: 'Normal', value: 'normal' },
                  { label: 'Coastal', value: 'coastal' },
                  { label: 'Flood-prone', value: 'flood' },
                ]}
                value={input.area_condition || ''}
                onChange={(v) => setInput((p) => ({ ...p, area_condition: v as HealthCheckInput['area_condition'] }))}
              />
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Parking</Text>
              <ChipRow
                options={[
                  { label: 'Covered', value: 'covered' },
                  { label: 'Open', value: 'open' },
                ]}
                value={input.parking || ''}
                onChange={(v) => setInput((p) => ({ ...p, parking: v as HealthCheckInput['parking'] }))}
              />
            </ToolCard>
            <PrimaryButton label="Continue" icon="arrow-forward" onPress={goNext} />
          </>
        );

      case 'service':
        return (
          <>
            <ToolCard>
              <Text style={styles.label}>Last service</Text>
              <ChipRow
                options={[
                  { label: '<3 mo', value: '<3' },
                  { label: '3–6 mo', value: '3-6' },
                  { label: '6–12 mo', value: '6-12' },
                  { label: '12+ mo', value: '12+' },
                  { label: "Don't remember", value: 'dont_remember' },
                ]}
                value={input.last_service_months || ''}
                onChange={(v) => setInput((p) => ({ ...p, last_service_months: v as HealthCheckInput['last_service_months'] }))}
              />
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Km at last service (optional)</Text>
              <TextInput
                style={styles.input}
                value={input.odometer_last_service != null ? String(input.odometer_last_service) : ''}
                onChangeText={(t) =>
                  setInput((p) => ({ ...p, odometer_last_service: Number(t.replace(/\D/g, '')) || undefined }))
                }
                keyboardType="numeric"
                placeholder="Optional"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Service provider</Text>
              <ChipRow
                options={[
                  { label: 'Authorized', value: 'authorized' },
                  { label: 'Local', value: 'local' },
                  { label: 'MyFNG', value: 'myfng' },
                  { label: 'Self', value: 'self' },
                  { label: 'Not regular', value: 'not_regular' },
                ]}
                value={input.service_provider || ''}
                onChange={(v) => setInput((p) => ({ ...p, service_provider: v as HealthCheckInput['service_provider'] }))}
              />
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Recent major jobs (tap if done)</Text>
              <View style={styles.chipWrap}>
                {MAJOR_JOBS.map((job) => {
                  const on = input.recent_major_jobs?.some((j) => j.job === job);
                  return (
                    <TouchableOpacity
                      key={job}
                      style={[styles.multiChip, on ? styles.multiChipOn : null]}
                      onPress={() => toggleMajorJob(job)}
                    >
                      <Text style={[styles.multiChipText, on ? styles.multiChipTextOn : null]}>{job}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ToolCard>
            <PrimaryButton label="Continue" icon="arrow-forward" onPress={goNext} />
          </>
        );

      case 'symptoms':
        return (
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {SYMPTOM_GROUPS.map((group) => {
              if (group.title === 'Transmission') {
                const items = group.items.filter((it) => {
                  if (isAuto) return it.id.startsWith('trans_');
                  return it.id.startsWith('clutch_') || it.id.startsWith('gear_');
                });
                if (!items.length) return null;
                return (
                  <ToolCard key={group.title}>
                    <Text style={styles.groupTitle}>{group.title}</Text>
                    {items.map((it) => (
                      <SymptomRow key={it.id} id={it.id} label={it.label} on={input.symptoms?.includes(it.id)} onToggle={toggleSymptom} />
                    ))}
                  </ToolCard>
                );
              }
              return (
                <ToolCard key={group.title}>
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
            <ToolCard>
              <Text style={styles.label}>Tyre condition</Text>
              <View style={styles.chipWrap}>
                {[
                  { id: 'cracks_bulges', label: 'Cracks / bulges' },
                  { id: 'low_tread', label: 'Low tread' },
                  { id: 'looks_fine', label: 'Looks fine' },
                ].map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.multiChip, input.tyre_condition?.includes(t.id) ? styles.multiChipOn : null]}
                    onPress={() => toggleTyreCondition(t.id)}
                  >
                    <Text style={[styles.multiChipText, input.tyre_condition?.includes(t.id) ? styles.multiChipTextOn : null]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Battery age (years)</Text>
              <TextInput
                style={styles.input}
                value={input.battery_age != null ? String(input.battery_age) : ''}
                onChangeText={(t) => setInput((p) => ({ ...p, battery_age: Number(t) || undefined }))}
                keyboardType="decimal-pad"
                placeholder="Optional"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setInput((p) => ({ ...p, battery_slow_crank: !p.battery_slow_crank }))}
              >
                <Ionicons name={input.battery_slow_crank ? 'checkbox' : 'square-outline'} size={20} color={COLORS.primary} />
                <Text style={styles.checkLabel}>Slow cranking in the morning</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setInput((p) => ({ ...p, wiper_smear: !p.wiper_smear }))}
              >
                <Ionicons name={input.wiper_smear ? 'checkbox' : 'square-outline'} size={20} color={COLORS.primary} />
                <Text style={styles.checkLabel}>Wipers smearing</Text>
              </TouchableOpacity>
            </ToolCard>
            <PrimaryButton label="Continue" icon="arrow-forward" onPress={goNext} />
          </>
        );

      case 'warning_lights':
        return (
          <>
            <ToolCard>
              <Text style={styles.label}>Warning lights ON right now</Text>
              <Text style={styles.hint}>Tap all that apply — optional</Text>
              <View style={styles.chipWrap}>
                {WARNING_LIGHTS.map((l) => {
                  const on = input.warningLights?.includes(l.id);
                  return (
                    <TouchableOpacity key={l.id} style={[styles.multiChip, on ? styles.multiChipOn : null]} onPress={() => toggleLight(l.id)}>
                      <Text style={[styles.multiChipText, on ? styles.multiChipTextOn : null]}>{l.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ToolCard>
            <PrimaryButton label="Continue" icon="arrow-forward" onPress={goNext} />
          </>
        );

      case 'compliance':
        return (
          <>
            <ToolCard>
              <Text style={styles.label}>Insurance valid till</Text>
              <TextInput
                style={styles.input}
                value={input.insurance_valid_till || rc?.insuranceValidTill || ''}
                onChangeText={(t) => setInput((p) => ({ ...p, insurance_valid_till: t }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>PUC valid till</Text>
              <TextInput
                style={styles.input}
                value={input.puc_valid_till || rc?.pucValidTill || ''}
                onChangeText={(t) => setInput((p) => ({ ...p, puc_valid_till: t }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Pending challans?</Text>
              <ChipRow
                options={[
                  { label: 'Yes', value: 'yes' },
                  { label: 'No', value: 'no' },
                  { label: 'Unknown', value: 'unknown' },
                ]}
                value={input.challans_pending || rc?.challansPending || ''}
                onChange={(v) => setInput((p) => ({ ...p, challans_pending: v as HealthCheckInput['challans_pending'] }))}
              />
            </ToolCard>
            <PrimaryButton label="Generate Report" icon="document-text" onPress={() => setStep('generating')} />
          </>
        );

      case 'generating':
        return (
          <View style={styles.generating}>
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
                  },
                ],
              }}
            >
              <Ionicons name="sync" size={48} color={COLORS.primary} />
            </Animated.View>
            <Text style={styles.generatingTitle}>Generating your Car Health Report</Text>
            <Text style={styles.generatingSub}>Analysing symptoms, compliance & preventive wear…</Text>
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
    <SmartToolShell
      title="Smart Health Checkup"
      subtitle={subtitle}
      navigation={navigation}
      footer={footer}
      scroll={step !== 'generating'}
    >
      {step !== 'report' && step !== 'intro' && step !== 'generating' ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      ) : null}
      {renderStep()}
    </SmartToolShell>
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
    <TouchableOpacity style={styles.symptomRow} onPress={() => onToggle(id)} activeOpacity={0.85}>
      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? COLORS.primary : '#9CA3AF'} />
      <Text style={[styles.symptomText, on ? styles.symptomTextOn : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: '#DBEAFE', marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#023D95', borderRadius: 999 },
  introIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  introTitle: { fontSize: 20, fontWeight: '900', color: '#111827', marginBottom: 8 },
  introBody: { fontSize: 14, fontWeight: '600', color: '#6B7280', lineHeight: 21 },
  tagline: { marginTop: 12, fontSize: 12, fontWeight: '700', color: '#0088E8', fontStyle: 'italic' },
  consentRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  consentText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151', lineHeight: 20 },
  label: { fontSize: 15, fontWeight: '900', color: '#111827', marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  readOnly: { fontSize: 16, fontWeight: '800', color: '#023D95', marginBottom: 8 },
  hint: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 10 },
  error: { marginTop: 8, fontSize: 12, fontWeight: '700', color: '#DC2626' },
  errorCenter: { textAlign: 'center', marginTop: 8, fontSize: 12, fontWeight: '700', color: '#DC2626' },
  linkBtn: { alignItems: 'center', paddingVertical: 14 },
  linkText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  groupTitle: { fontSize: 14, fontWeight: '900', color: '#023D95', marginBottom: 10 },
  symptomRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  symptomText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151' },
  symptomTextOn: { color: COLORS.primary, fontWeight: '800' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  multiChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  multiChipOn: { backgroundColor: '#EFF6FF', borderColor: COLORS.primary },
  multiChipText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  multiChipTextOn: { color: COLORS.primary },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  checkLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  generating: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  generatingTitle: { marginTop: 20, fontSize: 18, fontWeight: '900', color: '#111827' },
  generatingSub: { marginTop: 8, fontSize: 13, fontWeight: '600', color: '#6B7280', textAlign: 'center' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  secondaryText: { fontSize: 14, fontWeight: '800', color: '#374151' },
  skipBtn: { paddingHorizontal: 20, paddingVertical: 12 },
  skipText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
});
