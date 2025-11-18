#!/bin/bash

echo "📱 Generating all mobile screens..."

cd apps/mobile || exit 1

# Create Super Admin Dashboard
cat > src/screens/dashboard/super_admin/SuperAdminDashboard.tsx << 'EOF'
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../../../lib/supabase';

export default function SuperAdminDashboard({ navigation }: any) {
  const [stats, setStats] = useState({ totalUsers: 0, activeLeads: 0, totalWorkshops: 0, loading: true });

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const { count: usersCount } = await supabase.from('users_login').select('*', { count: 'exact', head: true });
      const { count: leadsCount } = await supabase.from('service_leads').select('*', { count: 'exact', head: true });
      const { count: workshopsCount } = await supabase.from('workshops').select('*', { count: 'exact', head: true });
      
      setStats({ totalUsers: usersCount || 0, activeLeads: leadsCount || 0, totalWorkshops: workshopsCount || 0, loading: false });
    } catch (error) {
      console.error(error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  }

  if (stats.loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#FF6B35" /></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Super Admin Dashboard</Text>
      
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalUsers}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.activeLeads}</Text>
          <Text style={styles.statLabel}>Active Leads</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalWorkshops}</Text>
          <Text style={styles.statLabel}>Workshops</Text>
        </View>
      </View>

      <View style={styles.actionsGrid}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('UserManagement')}>
          <Text style={styles.actionText}>👥 Manage Users</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('WorkshopManagement')}>
          <Text style={styles.actionText}>🏭 Workshops</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionText}>📊 Reports</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionText}>🔐 Audit Logs</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard: { backgroundColor: '#fff', padding: 20, borderRadius: 12, flex: 1, minWidth: '45%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  statValue: { fontSize: 32, fontWeight: 'bold', color: '#FF6B35', marginBottom: 8 },
  statLabel: { fontSize: 14, color: '#666' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionButton: { backgroundColor: '#FF6B35', padding: 16, borderRadius: 12, flex: 1, minWidth: '45%', alignItems: 'center' },
  actionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
EOF

echo "✅ Created SuperAdminDashboard.tsx"

# Continue with the script...
echo "📝 Creating more screens..."

