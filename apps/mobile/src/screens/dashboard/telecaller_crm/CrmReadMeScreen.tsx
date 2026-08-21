import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../../../constants/theme';

const TC_SECTIONS = [
  {
    title: 'Home & Leads',
    body: 'Home pe aaj ke KPIs. Leads / Filters se All leads aur Reminders kholo.',
  },
  {
    title: 'WhatsApp Chat',
    body: 'Customer chats — templates se session open / follow-up messages.',
  },
  {
    title: 'Book & Workshops',
    body: 'Naya lead / booking banao. Workshops se nearby workshop dhoondo.',
  },
  {
    title: 'Msg Templates',
    body: 'Call scripts copy karo. WhatsApp templates list dekho aur body copy karo.',
  },
  {
    title: 'Reports',
    body: 'Apni stats, call activity, aur duplicates — period filter se.',
  },
];

const LM_SECTIONS = [
  {
    title: 'Leads & Assignment',
    body: 'All leads, Reminders, Assignment queue, Escalations — team ke liye.',
  },
  {
    title: 'Team tools',
    body: 'Live floor, Team WA, WA DND, Team phones, Click to Call.',
  },
  {
    title: 'Labels',
    body: 'Lead tags aur Lead status manage karo.',
  },
  {
    title: 'Msg Templates',
    body: 'Call scripts + WhatsApp templates — copy and use while calling.',
  },
  {
    title: 'Reports',
    body: 'Leaderboard, Calls, Exports, Duplicates, Pipeline — website jaisi reports.',
  },
];

export default function CrmReadMeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isLeadManager =
    String(route?.params?.role || '').toUpperCase() === 'LEAD_MANAGER' ||
    String(route?.name || '').includes('LeadManager');
  const sections = isLeadManager ? LM_SECTIONS : TC_SECTIONS;

  return (
    <SafeAreaView style={styles.shell} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>ReadMe</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.intro}>
          Har menu kya hai — short guide. Detail pages pe bhi help milti hai.
        </Text>
        {sections.map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardBody}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textHeading,
  },
  body: { padding: SPACING.md, paddingBottom: 40 },
  intro: { fontSize: 14, color: '#64748B', marginBottom: 16, lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#023D95', marginBottom: 6 },
  cardBody: { fontSize: 13, color: '#475569', lineHeight: 19 },
});
