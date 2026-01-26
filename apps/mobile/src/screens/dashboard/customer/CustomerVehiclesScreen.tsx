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
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

export default function CustomerVehiclesScreen({ navigation }: any) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    fetchVehicles();
  }, []);

  async function fetchVehicles() {
    try {
      setLoading(true);
      if (!user) return;
      const { data: profile } = await supabase
        .from('users_login')
        .select('email, phone')
        .eq('id', user.id)
        .single();
      if (!profile) return;

      const { data, error } = await supabase
        .from('service_leads')
        .select('vehicle_number, vehicle_make, vehicle_model, vehicle_year')
        .or(`customer_email.eq.${profile.email},customer_phone.eq.${profile.phone}`)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const seen = new Set<string>();
      const unique = (data || []).filter((v: any) => {
        const key = `${v.vehicle_number || ''}-${v.vehicle_make || ''}-${v.vehicle_model || ''}-${v.vehicle_year || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setVehicles(unique);
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
              <View key={`${v.vehicle_number || idx}`} style={styles.card}>
                <Text style={styles.cardTitle}>{v.vehicle_number || 'Vehicle'}</Text>
                <Text style={styles.cardMeta}>{v.vehicle_make || ''} {v.vehicle_model || ''}</Text>
                {v.vehicle_year ? <Text style={styles.cardMeta}>Year: {v.vehicle_year}</Text> : null}
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
