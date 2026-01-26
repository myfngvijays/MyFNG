import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

type LeadHistoryResponse = {
  lead_id: string;
  status_history: any[];
  activities: any[];
  events: any[];
};

export default function LeadHistoryScreen({ navigation }: any) {
  const [leadId, setLeadId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LeadHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchHistory() {
    if (!leadId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<LeadHistoryResponse>(`/api/audit/lead-history/${leadId.trim()}`);
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to load history');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Lead History" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Enter Lead ID"
            placeholderTextColor={COLORS.textSecondary}
            value={leadId}
            onChangeText={setLeadId}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={fetchHistory}>
            <Text style={styles.primaryText}>Fetch</Text>
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : data ? (
          <ScrollView>
            <Text style={styles.sectionTitle}>Status History ({data.status_history.length})</Text>
            {data.status_history.map((item, idx) => (
              <View key={`status-${idx}`} style={styles.card}>
                <Text style={styles.cardTitle}>{item.new_status}</Text>
                {item.old_status ? <Text style={styles.cardMeta}>From: {item.old_status}</Text> : null}
                {item.reason ? <Text style={styles.cardMeta}>Reason: {item.reason}</Text> : null}
                {item.notes ? <Text style={styles.cardMeta}>Notes: {item.notes}</Text> : null}
              </View>
            ))}

            <Text style={styles.sectionTitle}>Activities ({data.activities.length})</Text>
            {data.activities.map((item, idx) => (
              <View key={`act-${idx}`} style={styles.card}>
                <Text style={styles.cardTitle}>{item.activity_type || 'Activity'}</Text>
                {item.notes ? <Text style={styles.cardMeta}>{item.notes}</Text> : null}
              </View>
            ))}

            <Text style={styles.sectionTitle}>Events ({data.events.length})</Text>
            {data.events.map((item, idx) => (
              <View key={`event-${idx}`} style={styles.card}>
                <Text style={styles.cardTitle}>{item.event_type || 'Event'}</Text>
                {item.details ? <Text style={styles.cardMeta}>{item.details}</Text> : null}
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, padding: SPACING.md },
  searchRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    color: COLORS.text,
  },
  primaryBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 8 },
  primaryText: { color: COLORS.white, fontWeight: '600' },
  loading: { alignItems: 'center', marginTop: SPACING.lg },
  loadingText: { marginTop: SPACING.sm, color: COLORS.textSecondary },
  errorText: { color: COLORS.danger, marginTop: SPACING.sm },
  sectionTitle: { marginTop: SPACING.md, fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  card: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 8, marginTop: SPACING.sm },
  cardTitle: { fontSize: SIZES.sm, fontWeight: '700', color: COLORS.textHeading },
  cardMeta: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
});
