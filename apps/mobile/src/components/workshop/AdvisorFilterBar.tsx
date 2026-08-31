import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { AC } from './advisorCrmUi';

type Kpi = { label: string; value: number | string; color: string };
type Chip = { key: string; label: string };

type Props = {
  subtitle?: string;
  kpis: Kpi[];
  chips: Chip[];
  activeChip: string;
  onChip: (key: string) => void;
};

/** Shared advisor layout: subtitle → KPI row → filter chips (Job Monitoring pattern). */
export default function AdvisorFilterBar({ subtitle, kpis, chips, activeChip, onChip }: Props) {
  return (
    <>
      {subtitle ? <Text style={AC.sub}>{subtitle}</Text> : null}
      <View style={AC.kpiRow}>
        {kpis.map((kpi) => (
          <View key={kpi.label} style={AC.kpi}>
            <Text style={[AC.kpiVal, { color: kpi.color }]}>{kpi.value}</Text>
            <Text style={AC.kpiLab}>{kpi.label}</Text>
          </View>
        ))}
      </View>
      <View style={AC.chipWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 24 }}>
          {chips.map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={[AC.chip, activeChip === chip.key && AC.chipOn]}
              onPress={() => onChip(chip.key)}
            >
              <Text style={[AC.chipTxt, activeChip === chip.key && AC.chipTxtOn]}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </>
  );
}
