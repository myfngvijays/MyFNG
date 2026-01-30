import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WorkshopAdminMenuScreen({ navigation }: any) {
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [navigation]);

  const menuItems = [
    {
      id: 'pending-leads',
      title: '⏰ Pending Leads',
      subtitle: 'Accept or reject leads',
      screen: 'PendingLeads',
      color: '#f59e0b',
    },
    {
      id: 'leads',
      title: '📋 All Leads',
      subtitle: 'View and manage leads',
      screen: 'WorkshopAdminLeadsList',
      color: '#3b82f6',
    },
    {
      id: 'assign-team',
      title: '👥 Assign Team',
      subtitle: 'Assign mechanic or pickup',
      screen: 'WorkshopAdminJobAssignment',
      color: '#6366f1',
    },
    {
      id: 'active-jobs',
      title: '🔧 Active Jobs',
      subtitle: 'Track jobs in progress',
      screen: 'ActiveJobs',
      color: '#10b981',
    },
    {
      id: 'pickup-tracking',
      title: '🚗 Pickup Tracking',
      subtitle: 'Monitor pickup status',
      screen: 'WorkshopAdminPickupTracking',
      color: '#ec4899',
    },
    {
      id: 'staff',
      title: '👤 Staff Management',
      subtitle: 'Manage team members',
      screen: 'WorkshopAdminStaffManagement',
      color: '#14b8a6',
    },
    {
      id: 'additional-jobs',
      title: '💰 Additional Jobs Master',
      subtitle: 'Manage additional jobs',
      screen: 'WorkshopAdminAdditionalJobsMaster',
      color: '#f97316',
    },
    {
      id: 'public-page',
      title: '🌐 Public Page',
      subtitle: 'Manage workshop public page',
      screen: 'WorkshopAdminPublicPage',
      color: '#0ea5e9',
    },
    {
      id: 'reports',
      title: '📊 Reports',
      subtitle: 'Workshop reports',
      screen: 'WorkshopAdminReports',
      color: '#8b5cf6',
    },
    {
      id: 'settings',
      title: '⚙️ Settings',
      subtitle: 'Workshop settings',
      screen: 'WorkshopAdminSettings',
      color: '#64748b',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Workshop Admin</Text>
        <Text style={styles.subtitle}>Choose a feature to access</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuCard, { borderLeftColor: item.color }]}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <View style={[styles.menuIcon, { backgroundColor: item.color }]}>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  scrollContent: {
    padding: 16,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
