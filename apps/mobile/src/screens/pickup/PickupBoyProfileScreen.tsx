import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import WorkshopStaffProfile from '../../components/workshop/WorkshopStaffProfile';
import { AC } from '../../components/workshop/advisorCrmUi';

export default function PickupBoyProfileScreen() {
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    successRate: 0,
  });

  const fetchStats = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();
      if (!userProfile) return;

      const { data: allTasks } = await supabase
        .from('service_leads')
        .select('pickup_status, status')
        .eq('assigned_pickup_boy_id', userProfile.id)
        .eq('pickup_required', true);

      const totalCount = allTasks?.length || 0;
      const completedCount =
        allTasks?.filter((t) => t.pickup_status === 'PICKED_UP' || t.pickup_status === 'DELIVERED').length || 0;
      setStats({
        totalTasks: totalCount,
        completedTasks: completedCount,
        successRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      });
    } catch {
      // keep last stats
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <WorkshopStaffProfile
      roleFallback="Pickupboy / Driver"
      onRefreshExtra={fetchStats}
      extra={
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Task stats</Text>
          <View style={styles.grid}>
            {[
              { label: 'Total tasks', value: stats.totalTasks, accent: '#004AAD' },
              { label: 'Completed', value: stats.completedTasks, accent: '#059669' },
              { label: 'Success rate', value: `${stats.successRate}%`, accent: '#EA580C' },
            ].map((tile) => (
              <View key={tile.label} style={[AC.kpiWide, styles.tile, { borderLeftColor: tile.accent }]}>
                <Text style={[AC.kpiVal, { color: tile.accent }]}>{tile.value}</Text>
                <Text style={AC.kpiLab}>{tile.label}</Text>
              </View>
            ))}
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 10 },
  blockTitle: { fontSize: 15, fontWeight: '800', color: '#023D95', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  tile: { width: '48.5%', marginHorizontal: 0, borderLeftWidth: 4 },
});
