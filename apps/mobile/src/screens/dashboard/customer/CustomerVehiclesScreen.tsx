import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

export default function CustomerVehiclesScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    fetchVehicles();
  }, []);

  async function fetchVehicles() {
    try {
      setLoading(true);
      const { vehicles: data } = await apiFetch<{ vehicles: any[] }>('/api/customer/vehicles');
      setVehicles(data || []);
    } catch (e) {
      console.error('Failed to load vehicles', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="My Vehicles" onBack={() => navigation.goBack()} />
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading vehicles...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchVehicles} />}
        >
          {vehicles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No vehicles found</Text>
            </View>
          ) : (
            vehicles.map((v, idx) => (
              <View key={`${v.id || v.vehicle_number || idx}`} style={styles.card}>
                <Text style={styles.cardTitle}>{v.vehicle_number || 'Vehicle'}</Text>
                <Text style={styles.cardMeta}>{v.make || ''} {v.model || ''}</Text>
                {v.year ? <Text style={styles.cardMeta}>Year: {v.year}</Text> : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, fontSize: SIZES.md, color: COLORS.textSecondary },
  scrollView: { flex: 1 },
  emptyContainer: { padding: SPACING.xl, alignItems: 'center' },
  emptyText: { fontSize: SIZES.md, color: COLORS.textSecondary },
  card: { backgroundColor: COLORS.white, padding: SPACING.md, marginBottom: SPACING.sm, marginHorizontal: SPACING.md, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  cardTitle: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  cardMeta: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
});
