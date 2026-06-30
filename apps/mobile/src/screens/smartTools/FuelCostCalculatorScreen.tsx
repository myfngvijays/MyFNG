import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HealthCheckShell, {
  FieldInput,
  FuelChipRow,
  InlineOptionField,
  PrimaryButton,
  QuestionBlock,
  SectionDivider,
  StepBlock,
  ToolCard,
  TwoColRow,
  type HealthFuelType,
} from '../../components/smartTools/HealthCheckShell';
import { COLORS } from '../../constants/theme';
import { formatInr } from '../../lib/smartToolsLogic';
import { trackEvent } from '../../lib/trackEvent';

type Props = { navigation: any };

const FUEL_PRICE_HINT: Record<HealthFuelType, string> = {
  Petrol: '105',
  Diesel: '95',
  CNG: '80',
};

const TRIP_TYPE_OPTIONS = [
  { label: 'One way', value: 'one' },
  { label: 'Round', value: 'round' },
];

const RESULT_NOTES = [
  'Tolls are not included unless you enter them above.',
  'Parking, food and driver allowances are not included.',
  'Actual mileage may vary with traffic, AC and load.',
];

function fuelUnit(type: HealthFuelType): 'L' | 'kg' {
  return type === 'CNG' ? 'kg' : 'L';
}

function tripCtaHint(totalDist: number, isRoundTrip: boolean): string {
  const tripLabel = isRoundTrip ? 'round trip' : 'trip';
  if (totalDist >= 500) {
    return `${totalDist.toFixed(0)} km ${tripLabel} planned — get same-day service with free pickup & drop.`;
  }
  if (totalDist >= 150) {
    return `${totalDist.toFixed(0)} km ${tripLabel}? Book same-day service with free pickup & drop.`;
  }
  return 'Heading out soon? Book same-day service with free pickup & drop.';
}

export default function FuelCostCalculatorScreen({ navigation }: Props) {
  const [distance, setDistance] = useState('');
  const [mileage, setMileage] = useState('');
  const [fuelPrice, setFuelPrice] = useState('');
  const [tolls, setTolls] = useState('');
  const [fuelType, setFuelType] = useState<HealthFuelType>('Petrol');
  const [roundTrip, setRoundTrip] = useState('one');
  const fuelCalcTracked = useRef(false);

  useEffect(() => {
    trackEvent('fuel_calculator_opened');
  }, []);

  const unit = fuelUnit(fuelType);

  const result = useMemo(() => {
    const dist = Math.max(0, Number(distance) || 0);
    const mil = Math.max(0, Number(mileage) || 0);
    const price = Math.max(0, Number(fuelPrice) || 0);
    const tollAmount = Math.max(0, Number(tolls) || 0);
    const totalDist = roundTrip === 'round' ? dist * 2 : dist;
    if (!dist || !mil || !price) {
      return {
        ready: false,
        totalDist: 0,
        fuelNeeded: 0,
        fuelCost: 0,
        tollAmount: 0,
        totalCost: 0,
        costPerKm: 0,
      };
    }
    const fuelNeeded = totalDist / mil;
    const fuelCost = fuelNeeded * price;
    const totalCost = fuelCost + tollAmount;
    const costPerKm = totalDist > 0 ? fuelCost / totalDist : 0;
    return { ready: true, totalDist, fuelNeeded, fuelCost, tollAmount, totalCost, costPerKm };
  }, [distance, mileage, fuelPrice, tolls, roundTrip]);

  useEffect(() => {
    if (result.ready && !fuelCalcTracked.current) {
      fuelCalcTracked.current = true;
      trackEvent('fuel_calculator_used');
    }
    if (!result.ready) fuelCalcTracked.current = false;
  }, [result.ready]);

  const tripCtaHintText = result.ready ? tripCtaHint(result.totalDist, roundTrip === 'round') : null;

  return (
    <HealthCheckShell
      title="Fuel Cost Calculator"
      subtitle="Estimate trip fuel spend in seconds"
      navigation={navigation}
      headerIcon="speedometer-outline"
    >
      <View style={styles.compactHero}>
        <View style={styles.compactHeroGlow} />
        <View style={styles.compactHeroRow}>
          <View style={styles.compactHeroCopy}>
            <Text style={styles.heroTitle}>Plan Your Trip Fuel Cost</Text>
            <Text style={styles.heroBody}>Distance, mileage and local fuel price. One-way or round trip.</Text>
            <View style={styles.heroPills}>
              <HeroPill icon="flash-outline" label="Instant" />
              <HeroPill icon="swap-horizontal-outline" label="Round trip" />
              <HeroPill icon="leaf-outline" label="P/D/CNG" />
            </View>
          </View>
          <View style={styles.heroIconRight}>
            <Ionicons name="speedometer-outline" size={30} color="#93C5FD" />
          </View>
        </View>
      </View>

      <StepBlock icon="car-outline" title="Trip Details" hint="Distance, mileage and fuel price are required">
        <QuestionBlock label="Fuel Type">
          <FuelChipRow
            value={fuelType}
            onChange={(v) => {
              setFuelType(v);
              if (!fuelPrice) setFuelPrice(FUEL_PRICE_HINT[v]);
            }}
          />
        </QuestionBlock>

        <SectionDivider />

        <TwoColRow
          left={
            <QuestionBlock label="Distance (km)" required dense>
              <FieldInput
                value={distance}
                onChangeText={(t) => setDistance(t.replace(/[^\d.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="320"
              />
            </QuestionBlock>
          }
          right={
            <QuestionBlock label={`Mileage (km/${unit})`} required dense>
              <FieldInput
                value={mileage}
                onChangeText={(t) => setMileage(t.replace(/[^\d.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder={fuelType === 'CNG' ? '28' : '15'}
              />
            </QuestionBlock>
          }
        />

        <SectionDivider />

        <TwoColRow
          left={
            <QuestionBlock label={`Price (₹/${unit})`} required dense>
              <FieldInput
                value={fuelPrice}
                onChangeText={(t) => setFuelPrice(t.replace(/[^\d.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder={FUEL_PRICE_HINT[fuelType]}
              />
            </QuestionBlock>
          }
          right={
            <QuestionBlock label="Trip Type" dense>
              <InlineOptionField value={roundTrip} onChange={setRoundTrip} options={TRIP_TYPE_OPTIONS} />
            </QuestionBlock>
          }
        />

        <SectionDivider />

        <QuestionBlock label="Tolls (optional)" hint="Add only if you know approximate toll charges">
          <FieldInput
            value={tolls}
            onChangeText={(t) => setTolls(t.replace(/[^\d.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        </QuestionBlock>
      </StepBlock>

      {result.ready ? (
        <>
          <View style={styles.resultHero}>
            <View style={styles.resultGlow} />
            <Text style={styles.resultEyebrow}>Estimated Trip Cost</Text>
            <Text style={styles.resultAmount}>{formatInr(result.totalCost)}</Text>
            <Text style={styles.resultSub}>
              {roundTrip === 'round' ? 'Round trip' : 'One way'} · {fuelType} · {result.totalDist.toFixed(0)} km
            </Text>
            <View style={styles.resultGrid}>
              <ResultStat label="Fuel cost" value={formatInr(result.fuelCost)} />
              <ResultStat label="Tolls" value={result.tollAmount > 0 ? formatInr(result.tollAmount) : 'Not added'} />
              <ResultStat label="Fuel needed" value={`${result.fuelNeeded.toFixed(1)} ${unit}`} />
              <ResultStat label="Fuel / km" value={formatInr(result.costPerKm)} />
            </View>
          </View>
          <View style={styles.notesCard}>
            {RESULT_NOTES.map((note) => (
              <View key={note} style={styles.noteRow}>
                <Text style={styles.noteBullet}>•</Text>
                <Text style={styles.noteText}>{note}</Text>
              </View>
            ))}
          </View>
          {tripCtaHintText ? (
            <View style={styles.ctaBlock}>
              <PrimaryButton
                label="Book Same-Day Service"
                icon="car-outline"
                onPress={() => navigation.navigate('PublicBookServiceNow', { serviceCategory: 'PERIODIC' })}
              />
              <Text style={styles.ctaHint}>{tripCtaHintText}</Text>
            </View>
          ) : null}
        </>
      ) : (
        <ToolCard variant="soft">
          <View style={styles.emptyRow}>
            <View style={styles.emptyIcon}>
              <Ionicons name="calculator-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>Your estimate will appear here</Text>
              <Text style={styles.emptyBody}>Fill distance, mileage and fuel price above to see trip cost breakdown.</Text>
            </View>
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
      <Text style={styles.heroPillText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#0B1F44',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
  },
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
  compactHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
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
  resultHero: {
    backgroundColor: '#0B1F44',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563EB',
    overflow: 'hidden',
    marginBottom: 10,
  },
  resultGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },
  resultEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  resultAmount: {
    fontSize: 40,
    fontWeight: '900',
    color: '#34D399',
    marginVertical: 6,
  },
  resultSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#93C5FD',
    textAlign: 'center',
    marginBottom: 16,
  },
  resultGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  statValue: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  notesCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  noteRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  noteBullet: { fontSize: 12, fontWeight: '800', color: '#64748B', lineHeight: 18 },
  noteText: { flex: 1, fontSize: 11, fontWeight: '600', color: '#64748B', lineHeight: 18 },
  ctaBlock: { marginTop: 4, marginBottom: 8, gap: 10 },
  ctaHint: { fontSize: 11, fontWeight: '600', color: '#64748B', textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },
  emptyRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  emptyCopy: { flex: 1 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  emptyBody: { fontSize: 12, fontWeight: '600', color: '#64748B', lineHeight: 18 },
});
