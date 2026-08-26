import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { COLORS } from '../../../constants/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

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

  const menuItems: {
    id: string;
    title: string;
    subtitle: string;
    screen: string;
    icon: IoniconName;
  }[] = [
    { id: 'pending-leads', title: 'Pending leads', subtitle: 'Accept or reject new jobs', screen: 'PendingLeads', icon: 'time-outline' },
    { id: 'leads', title: 'All leads', subtitle: 'View and manage leads', screen: 'WorkshopAdminLeadsList', icon: 'clipboard-outline' },
    { id: 'assign-team', title: 'Assign team', subtitle: 'Assign mechanic or pickup', screen: 'WorkshopAdminJobAssignment', icon: 'people-outline' },
    { id: 'active-jobs', title: 'Active jobs', subtitle: 'Track jobs in progress', screen: 'ActiveJobs', icon: 'construct-outline' },
    { id: 'pickup-tracking', title: 'Pickup tracking', subtitle: 'Monitor pickup status', screen: 'WorkshopAdminPickupTracking', icon: 'car-outline' },
    { id: 'staff', title: 'Staff management', subtitle: 'Manage team members', screen: 'WorkshopAdminStaffManagement', icon: 'person-outline' },
    { id: 'additional-jobs', title: 'Additional jobs master', subtitle: 'Manage extra job items', screen: 'WorkshopAdminAdditionalJobsMaster', icon: 'briefcase-outline' },
    { id: 'public-page', title: 'Public page', subtitle: 'Workshop public profile', screen: 'WorkshopAdminPublicPage', icon: 'globe-outline' },
    { id: 'reports', title: 'Reports', subtitle: 'Workshop reports', screen: 'WorkshopAdminReports', icon: 'bar-chart-outline' },
    { id: 'settings', title: 'Settings', subtitle: 'Workshop settings', screen: 'WorkshopAdminSettings', icon: 'settings-outline' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Workshop Admin</Text>
          <Text style={styles.subtitle}>Workshop Control Panel</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuCard}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.85}
          >
            <View style={styles.menuIcon}>
              <Ionicons name={item.icon} size={18} color={COLORS.primary} />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#FDE68A',
    marginTop: 2,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
