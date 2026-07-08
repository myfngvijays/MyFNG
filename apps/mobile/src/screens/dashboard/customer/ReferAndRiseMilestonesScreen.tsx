import React from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { Ionicons } from '@expo/vector-icons';
import {
  MILESTONES,
  FAMILIES,
  FAMILY_ORDER,
} from '../../../constants/referAndRise';

const BRAND = '#004AAD';
const BRAND_LIGHT = '#E8F1FD';

export default function ReferAndRiseMilestonesScreen({ navigation }: any) {
  return (
    <View style={s.container}>
      <DashboardHeader title="Milestones" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.subtitle}>Refer more. Unlock more.{'\n'}Choose rewards you love.</Text>
        {MILESTONES.map((m) => (
          <View key={m.referralCount} style={s.row}>
            <View style={s.node}>
              <Text style={s.nodeText}>{m.referralCount}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{m.referralCount} Referrals</Text>
              <View style={s.icons}>
                {FAMILY_ORDER.map((key) => (
                  <View key={key} style={[s.miniIcon, { backgroundColor: FAMILIES[key].color + '18' }]}>
                    <Ionicons name={FAMILIES[key].icon} size={10} color={FAMILIES[key].color} />
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 18, paddingBottom: 40 },
  subtitle: { fontSize: 13, color: '#6B7280', marginBottom: 18, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  node: { width: 32, height: 32, borderRadius: 16, backgroundColor: BRAND_LIGHT, borderWidth: 1.5, borderColor: '#D6E8FA', alignItems: 'center', justifyContent: 'center' },
  nodeText: { fontSize: 11, fontWeight: '700', color: BRAND },
  rowTitle: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  icons: { flexDirection: 'row', gap: 4, marginTop: 4 },
  miniIcon: { width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
});
