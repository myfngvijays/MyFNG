import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SECTIONS = [
  {
    heading: 'Main menu',
    items: [
      { title: 'Dashboard', body: 'Mechanics, active jobs, QC, overdue — aaj ka snapshot.' },
      { title: 'Pending Leads', body: 'Naye leads accept / reject. Accept ke baad mechanic assign karo.' },
      { title: 'Day Planning', body: 'Aaj ke jobs plan karo aur sequence set karo.' },
      { title: 'Jobs', body: 'Saari workshop jobs — status, mechanic, SLA.' },
      { title: 'QC Queue', body: 'Complete jobs ka quality check — approve / reject.' },
      { title: 'Extra Jobs', body: 'Inspection ke baad extra work / charges approve.' },
      { title: 'Pickup & Delivery', body: 'Car pickup / drop tracking, OTP, location.' },
      { title: 'Jobs Master', body: 'Extra-job names aur labour rates.' },
      { title: 'Team', body: 'Kaun free hai, kaun job pe hai.' },
      { title: 'Daily Report', body: 'End-of-day summary.' },
      { title: 'Analytics', body: 'Performance charts.' },
      { title: 'Profile', body: 'Naam, phone, workshop details.' },
    ],
  },
];

export default function AdvisorReadMeScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
    >
      <Text style={styles.title}>ReadMe</Text>
      <Text style={styles.sub}>Har menu kya karta hai — short guide.</Text>
      {SECTIONS.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          {section.items.map((item) => (
            <View key={item.title} style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  title: { fontSize: 24, fontWeight: '800', color: '#023D95' },
  sub: { marginTop: 4, fontSize: 13, color: '#64748b', marginBottom: 16 },
  section: { marginBottom: 16 },
  heading: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#023D95' },
  cardBody: { marginTop: 6, fontSize: 13, lineHeight: 19, color: '#334155' },
});
