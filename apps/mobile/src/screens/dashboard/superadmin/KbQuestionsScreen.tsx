import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

type KbQuestionEvent = {
  id: string;
  user_message: string;
  assistant_message?: string | null;
  status: string;
  created_at: string;
};

export default function KbQuestionsScreen({ navigation }: any) {
  const [items, setItems] = useState<KbQuestionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: KbQuestionEvent[] }>('/api/admin/kb-question-events?status=new&limit=50&offset=0');
      setItems(data.items || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load KB questions');
    } finally {
      setLoading(false);
    }
  }

  const renderItem = ({ item }: { item: KbQuestionEvent }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.user_message}</Text>
      <Text style={styles.cardMeta}>Status: {item.status}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <DashboardHeader title="KB Questions" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : error ? (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={fetchItems}>
              <Text style={styles.primaryText}>Retry</Text>
            </TouchableOpacity>
          </>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
          />
        )}
        <Text style={styles.note}>
          Note: This endpoint currently requires web cookie auth. If you see Unauthorized, use the web dashboard.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, padding: SPACING.md },
  list: { paddingVertical: SPACING.sm },
  card: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 8, marginBottom: SPACING.sm },
  cardTitle: { fontSize: SIZES.sm, fontWeight: '700', color: COLORS.textHeading },
  cardMeta: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
  loading: { alignItems: 'center', marginTop: SPACING.lg },
  loadingText: { marginTop: SPACING.sm, color: COLORS.textSecondary },
  errorText: { color: COLORS.danger, marginBottom: SPACING.sm },
  primaryBtn: { backgroundColor: COLORS.primary, padding: SPACING.sm, borderRadius: 8 },
  primaryText: { color: COLORS.white, textAlign: 'center', fontWeight: '600' },
  note: { marginTop: SPACING.md, fontSize: 12, color: COLORS.textSecondary },
});
