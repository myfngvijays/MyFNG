import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../../constants/theme';

export default function SupervisorMenuScreen({ navigation }: any) {
  const menuItems = [
    {
      id: 'day-planning',
      title: '📅 Day Planning',
      subtitle: 'Plan jobs & assign mechanics',
      screen: 'DayPlanning',
      color: '#8b5cf6',
    },
    {
      id: 'job-monitoring',
      title: '🔧 Job Monitoring',
      subtitle: 'Track all jobs in progress',
      screen: 'JobMonitoring',
      color: '#3b82f6',
    },
    {
      id: 'qc-queue',
      title: '✅ QC Queue',
      subtitle: 'Quality check approvals',
      screen: 'QCCheck',
      color: '#10b981',
    },
    {
      id: 'extra-work',
      title: '💰 Extra Work',
      subtitle: 'Approve extra charges',
      screen: 'ExtraWorkApproval',
      color: '#f59e0b',
    },
    {
      id: 'team-overview',
      title: '👥 Team Overview',
      subtitle: 'View team status',
      screen: 'TeamOverview',
      color: '#06b6d4',
    },
    {
      id: 'team-performance',
      title: '📊 Team Performance',
      subtitle: 'Performance metrics',
      screen: 'TeamPerformance',
      color: '#8b5cf6',
    },
    {
      id: 'pickup-delivery',
      title: '🚗 Pickup & Delivery',
      subtitle: 'Track pickups',
      screen: 'PickupDeliveryTracking',
      color: '#ec4899',
    },
    {
      id: 'daily-report',
      title: '📋 Daily Report',
      subtitle: 'End of day summary',
      screen: 'DailyReport',
      color: '#6366f1',
    },
    {
      id: 'analytics',
      title: '📈 Analytics',
      subtitle: 'Performance charts',
      screen: 'SupervisorAnalytics',
      color: '#14b8a6',
    },
    {
      id: 'profile',
      title: '👤 Profile',
      subtitle: 'View/Edit profile',
      screen: 'SupervisorProfile',
      color: '#64748b',
    },
  ];

  const handleNavigate = (screen: string) => {
    navigation.navigate(screen);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Supervisor Menu</Text>
        <Text style={styles.subtitle}>Choose a feature to access</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuCard, { borderLeftColor: item.color }]}
            onPress={() => handleNavigate(item.screen)}
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

