import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export default function WorkshopAdminMenuScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const twoCol = width >= 600;

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

  const menuItems: {
    id: string;
    title: string;
    subtitle: string;
    screen: string;
    icon: IoniconName;
    color: string;
  }[] = [
    { id: 'pending-leads', title: 'Pending leads', subtitle: 'Accept or reject new jobs', screen: 'PendingLeads', icon: 'time-outline', color: '#f59e0b' },
    { id: 'leads', title: 'All leads', subtitle: 'View and manage leads', screen: 'WorkshopAdminLeadsList', icon: 'clipboard-outline', color: '#3b82f6' },
    { id: 'assign-team', title: 'Assign team', subtitle: 'Assign mechanic or pickup', screen: 'WorkshopAdminJobAssignment', icon: 'people-outline', color: '#8b5cf6' },
    { id: 'active-jobs', title: 'Active jobs', subtitle: 'Track jobs in progress', screen: 'ActiveJobs', icon: 'construct-outline', color: '#06b6d4' },
    { id: 'pickup-tracking', title: 'Pickup tracking', subtitle: 'Monitor pickup status', screen: 'WorkshopAdminPickupTracking', icon: 'car-outline', color: '#ec4899' },
    { id: 'staff', title: 'Staff management', subtitle: 'Manage team members', screen: 'WorkshopAdminStaffManagement', icon: 'person-outline', color: '#10b981' },
    { id: 'additional-jobs', title: 'Additional jobs master', subtitle: 'Manage extra job items', screen: 'WorkshopAdminAdditionalJobsMaster', icon: 'briefcase-outline', color: '#f97316' },
    { id: 'public-page', title: 'Public page', subtitle: 'Workshop public profile', screen: 'WorkshopAdminPublicPage', icon: 'globe-outline', color: '#14b8a6' },
    { id: 'reports', title: 'Reports', subtitle: 'Workshop reports', screen: 'WorkshopAdminReports', icon: 'bar-chart-outline', color: '#6366f1' },
    { id: 'settings', title: 'Settings', subtitle: 'Workshop settings', screen: 'WorkshopAdminSettings', icon: 'settings-outline', color: '#64748b' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Workshop Owner</Text>
        <Text style={styles.subtitle}>Choose a feature</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, twoCol && styles.scrollGrid]}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuCard, twoCol && styles.menuCardHalf, { borderLeftColor: item.color }]}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <View style={[styles.menuIcon, { backgroundColor: item.color }]}>
              <Ionicons name={item.icon} size={18} color="#FFFFFF" />
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
    color: '#023D95',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  scrollGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
  menuCardHalf: {
    width: '48.5%',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#023D95',
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
});
