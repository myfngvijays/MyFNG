import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import SmartToolShell, { ChipRow, ToolCard } from '../../components/smartTools/SmartToolShell';
import { COLORS } from '../../constants/theme';
import { formatInr, formatInrRange } from '../../lib/smartToolsLogic';

type Props = { navigation: any };

const FUEL_TYPES = [
  { label: 'Petrol', value: 'petrol' },
  { label: 'Diesel', value: 'diesel' },
  { label: 'CNG', value: 'cng' },
];

export default function FuelCostCalculatorScreen({ navigation }: Props) {
  const [distance, setDistance] = useState('');
  const [mileage, setMileage] = useState('');
  const [fuelPrice, setFuelPrice] = useState('');
  const [fuelType, setFuelType] = useState('petrol');
  const [roundTrip, setRoundTrip] = useState('one');

  const result = useMemo(() => {
    const dist = Math.max(0, Number(distance) || 0);
    const mil = Math.max(0, Number(mileage) || 0);
    const price = Math.max(0, Number(fuelPrice) || 0);
    const totalDist = roundTrip === 'round' ? dist * 2 : dist;
    const unit = fuelType === 'cng' ? 'kg' : 'L';
    if (!dist || !mil || !price) {
      return { ready: false, unit, totalDist: 0, fuelNeeded: 0, totalCost: 0, costPerKm: 0 };
    }
    const fuelNeeded = totalDist / mil;
    const totalCost = fuelNeeded * price;
    const costPerKm = totalDist > 0 ? totalCost / totalDist : 0;
    return { ready: true, unit, totalDist, fuelNeeded, totalCost, costPerKm };
  }, [distance, mileage, fuelPrice, fuelType, roundTrip]);

  return (
    <SmartToolShell title="Fuel Cost Calculator" subtitle="Trip fuel cost estimate" navigation={navigation}>
      <ToolCard>
        <Text style={styles.label}>Fuel Type</Text>
        <ChipRow options={FUEL_TYPES} value={fuelType} onChange={setFuelType} />
      </ToolCard>

      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Distance (km)</Text>
          <TextInput style={styles.input} value={distance} onChangeText={setDistance} keyboardType="numeric" placeholder="Enter km" placeholderTextColor="#9CA3AF" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Mileage (km/{result.unit})</Text>
          <TextInput style={styles.input} value={mileage} onChangeText={setMileage} keyboardType="numeric" placeholder="Enter mileage" placeholderTextColor="#9CA3AF" />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Fuel Price (₹/{result.unit})</Text>
          <TextInput style={styles.input} value={fuelPrice} onChangeText={setFuelPrice} keyboardType="numeric" placeholder="Enter price" placeholderTextColor="#9CA3AF" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Trip Type</Text>
          <ChipRow
            options={[
              { label: 'One Way', value: 'one' },
              { label: 'Round Trip', value: 'round' },
            ]}
            value={roundTrip}
            onChange={setRoundTrip}
          />
        </View>
      </View>

      <View style={styles.resultCard}>
        <Text style={styles.resultTitle}>Trip Cost Summary</Text>
        {!result.ready ? (
          <Text style={styles.placeholder}>Enter distance, mileage and fuel price to calculate your trip cost.</Text>
        ) : (
          <>
            <ResultRow label="Total distance" value={`${result.totalDist.toFixed(0)} km`} />
            <ResultRow label="Fuel required" value={`${result.fuelNeeded.toFixed(1)} ${result.unit}`} />
            <ResultRow label="Estimated trip cost" value={formatInr(result.totalCost)} highlight />
            <ResultRow label="Cost per km" value={formatInr(result.costPerKm)} />
          </>
        )}
      </View>
    </SmartToolShell>
  );
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={[styles.resultValue, highlight ? styles.resultHighlight : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  field: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  label: { fontSize: 11, fontWeight: '800', color: COLORS.gray[500], textTransform: 'uppercase', marginBottom: 8 },
  input: { fontSize: 16, fontWeight: '800', color: '#111827', padding: 0 },
  resultCard: { backgroundColor: '#111827', borderRadius: 18, padding: 18, marginTop: 4 },
  resultTitle: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', marginBottom: 12 },
  placeholder: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', lineHeight: 20 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  resultLabel: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  resultValue: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  resultHighlight: { color: '#34D399', fontSize: 18 },
});
