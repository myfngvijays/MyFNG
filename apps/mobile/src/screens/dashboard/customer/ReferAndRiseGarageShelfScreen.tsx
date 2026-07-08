import React from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { Ionicons } from '@expo/vector-icons';

export default function ReferAndRiseGarageShelfScreen({ navigation }: any) {
  return (
    <View style={s.container}>
      <DashboardHeader title="My Garage Shelf" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Your earned rewards</Text>
        <Text style={s.subtitle}>Rewards you've claimed will appear here.</Text>
        <View style={s.emptyState}>
          <Ionicons name="trophy-outline" size={40} color="#D1D5DB" />
          <Text style={s.emptyText}>No rewards yet. Invite friends to unlock milestones!</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 18, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6B7280', marginBottom: 28 },
  emptyState: { alignItems: 'center', paddingVertical: 50, gap: 12 },
  emptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
});
