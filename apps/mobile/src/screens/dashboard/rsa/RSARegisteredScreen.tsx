import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';

export default function RSARegisteredScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const managerId = authData?.user?.id;
      if (!managerId) {
        setRows([]);
        return;
      }

      const { data, error } = await supabase.rpc('rsa_manager_get_registered_leads', {
        p_manager_id: managerId,
        p_limit: 200,
        p_offset: 0,
      });

      if (error) throw error;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('rsa registered load failed', e);
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r: any) =>
      String(r?.customer_name || '').toLowerCase().includes(s) ||
      String(r?.contact_number || '').includes(s) ||
      String(r?.vehicle_number || '').toLowerCase().includes(s)
    );
  }, [rows, search]);

  const handleBack = () => {
    if (typeof navigation?.canGoBack === 'function' && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (typeof navigation?.goBack === 'function') {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.('RSAManagerDashboard');
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="Registered Complaints" onBack={handleBack} />
      <View style={styles.searchWrap}>
        <TextInput style={styles.searchInput} placeholder="Search name/phone/vehicle" value={search} onChangeText={setSearch} />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {filtered.map((row: any) => (
            <TouchableOpacity key={row.id} style={styles.card} onPress={() => navigation.navigate('RSALeadDetail', { leadId: row.id })}>
              <Text style={styles.title}>{row.customer_name || 'Customer'}</Text>
              <Text style={styles.subtle}>{row.contact_number || '—'} • {row.vehicle_number || '—'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchWrap: { padding: SPACING.md },
  searchInput: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, borderRadius: 8, padding: SPACING.sm },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.sm },
  card: { backgroundColor: COLORS.white, borderRadius: 10, padding: SPACING.sm },
  title: { fontSize: SIZES.sm, fontWeight: '700', color: COLORS.textHeading },
  subtle: { fontSize: SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
});
