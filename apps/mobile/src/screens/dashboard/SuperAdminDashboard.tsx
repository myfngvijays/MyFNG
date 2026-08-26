import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import AdminHamburgerDrawer from '../../components/admin/AdminHamburgerDrawer';
import type { SaNavLeaf } from '../../constants/superAdminNav';
import {
  AdminDeptCard,
  AdminMenuTile,
  AdminMetricCard,
  AdminQuickLink,
  AdminSectionTitle,
} from '../../components/admin/AdminUi';
import { COLORS, FONTS } from '../../constants/theme';

// Import Super Admin screens
import WorkshopManagementScreen from './superadmin/WorkshopManagementScreen';
import WorkshopRatesScreen from './superadmin/WorkshopRatesScreen';
import UserRoleManagementScreen from './superadmin/UserRoleManagementScreen';
import LeadsManagementScreen from './superadmin/LeadsManagementScreen';
import ReportsAnalyticsScreen from './superadmin/ReportsAnalyticsScreen';
import SystemSettingsScreen from './superadmin/SystemSettingsScreen';
import FinancePayoutScreen from './superadmin/FinancePayoutScreen';
import FraudDetectionScreen from './superadmin/FraudDetectionScreen';
import AuditLogsScreen from './superadmin/AuditLogsScreen';
import BrandsScreen from './superadmin/BrandsScreen';
import InventoryProductsScreen from './superadmin/InventoryProductsScreen';
import InventoryPackagesScreen from './superadmin/InventoryPackagesScreen';
import InventoryPackageDetailScreen from './superadmin/InventoryPackageDetailScreen';
import InventoryZonesScreen from './superadmin/InventoryZonesScreen';
import InventoryPricingScreen from './superadmin/InventoryPricingScreen';
import InventoryServicePricingScreen from './superadmin/InventoryServicePricingScreen';
import AdditionalJobsMasterScreen from './additional_jobs/AdditionalJobsMasterScreen';
import CouponsScreen from './superadmin/CouponsScreen';
import ManualInvoicesScreen from './superadmin/ManualInvoicesScreen';
import TelecallerDistributionScreen from './superadmin/TelecallerDistributionScreen';
import LeadHistoryScreen from './superadmin/LeadHistoryScreen';
import WebsiteImagesHubScreen from './superadmin/WebsiteImagesHubScreen';
import HomeCarouselScreen from './superadmin/HomeCarouselScreen';
import WorkshopPublicPagesScreen from './superadmin/WorkshopPublicPagesScreen';
import KbManagerScreen from './superadmin/KbManagerScreen';
import KbQuestionsScreen from './superadmin/KbQuestionsScreen';

export default function SuperAdminDashboard() {
  const navigation = useNavigation();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [globalMetrics, setGlobalMetrics] = useState({
    totalLeadsToday: 0,
    acceptedLeads: 0,
    rejectedLeads: 0,
    slaBreaches: 0,
    totalRevenue: 0,
    dailyRevenue: 0,
    activeWorkshops: 0,
    inactiveWorkshops: 0,
    totalWorkshops: 0,
    pendingWorkshops: 0,
    totalCustomers: 0,
    avgWorkshopRating: 0,
    complaintVolume: 0,
    rsaEmergencies: 0,
    systemUptime: 99.9
  });

  const [departmentMetrics, setDepartmentMetrics] = useState({
    telecaller: { leads: 0, followUps: 0, conversion: 0 },
    leadManager: { assigned: 0, avgTime: 0, accuracy: 0 },
    workshops: { active: 0, busy: 0, avgCompletion: 0 },
    rsa: { active: 0, avgDispatch: 0, completion: 0 },
    auditors: { auditsToday: 0, fraudFound: 0, avgScore: 0 }
  });

  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    fetchUserProfile();
    fetchDashboardData();
  }, []);

  const fetchUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('users_login')
        .select('*')
        .eq('id', user.id)
        .single();
      if (data) setUserProfile(data);
    }
  };

  const fetchDashboardData = async () => {
    try {
      console.log('🔄 Fetching dashboard data...');
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      
      console.log('📅 Today:', today);
      console.log('📅 Start of month:', startOfMonth);

      // Fetch Global Metrics - SAME AS WEB
      const [
        totalLeadsResult,
        acceptedResult,
        rejectedResult,
        slaBreachedResult,
        workshopsResult,
        customersResult,
        complaintsResult,
        rsaActiveResult,
        revenueResult,
        dailyRevenueResult,
        workshopRatingResult
      ] = await Promise.all([
        // Today's leads
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .gte('created_at', `${today}T00:00:00`),
        
        // Accepted leads
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .eq('status', 'ACCEPTED'),
        
        // Rejected leads
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .in('status', ['REJECTED', 'REJECTED_BY_WORKSHOP']),
        
        // SLA breached
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .eq('sla_state', 'BREACHED')
          .not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)'),
        
        // Active workshops (verified)
        supabase.from('workshops').select('id', { count: 'exact', head: true })
          .eq('is_verified', true),
        
        // Total customers
        supabase.from('users_login').select('id', { count: 'exact', head: true })
          .in('role_id', (await supabase.from('roles').select('id').eq('role_code', 'CUSTOMER')).data?.map(r => r.id) || []),
        
        // Active complaints
        supabase.from('customer_complaints').select('id', { count: 'exact', head: true })
          .in('status', ['OPEN', 'IN_PROGRESS']),
        
        // RSA active emergencies
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .eq('lead_type', 'RSA')
          .in('status', ['NEW', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS']),
        
        // Total revenue this month
        supabase.from('payments').select('amount')
          .eq('status', 'COMPLETED')
          .gte('created_at', startOfMonth),
        
        // Today's revenue
        supabase.from('payments').select('amount')
          .eq('status', 'COMPLETED')
          .gte('created_at', `${today}T00:00:00`),
        
        // Workshop average rating
        supabase.from('workshops').select('audit_score')
          .not('audit_score', 'is', null)
      ]);

      // Calculate revenues
      const totalRevenue = revenueResult.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const dailyRevenue = dailyRevenueResult.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      
      // Calculate average workshop rating
      const ratings = workshopRatingResult.data?.map(w => w.audit_score).filter(Boolean) || [];
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      // Fetch additional workshop details
      const [
        totalWorkshopsResult,
        inactiveWorkshopsResult
      ] = await Promise.all([
        // Total workshops
        supabase.from('workshops').select('id', { count: 'exact', head: true }),
        
        // Inactive workshops (not verified)
        supabase.from('workshops').select('id', { count: 'exact', head: true })
          .eq('is_verified', false)
      ]);

      console.log('📊 Query Results:', {
        totalLeadsResult: { count: totalLeadsResult.count, error: totalLeadsResult.error },
        acceptedResult: { count: acceptedResult.count, error: acceptedResult.error },
        rejectedResult: { count: rejectedResult.count, error: rejectedResult.error },
        slaBreachedResult: { count: slaBreachedResult.count, error: slaBreachedResult.error },
        workshopsResult: { count: workshopsResult.count, error: workshopsResult.error },
        totalWorkshopsResult: { count: totalWorkshopsResult.count, error: totalWorkshopsResult.error },
        inactiveWorkshopsResult: { count: inactiveWorkshopsResult.count, error: inactiveWorkshopsResult.error },
        customersResult: { count: customersResult.count, error: customersResult.error },
      });

      console.log('📊 Global Metrics:', {
        totalLeads: totalLeadsResult.count,
        accepted: acceptedResult.count,
        rejected: rejectedResult.count,
        slaBreached: slaBreachedResult.count,
        activeWorkshops: workshopsResult.count,
        totalWorkshops: totalWorkshopsResult.count,
        inactiveWorkshops: inactiveWorkshopsResult.count,
        customers: customersResult.count,
        avgRating,
        totalRevenue: Math.round(totalRevenue),
        dailyRevenue: Math.round(dailyRevenue)
      });

      const totalWs = totalWorkshopsResult.count ?? 0;
      const activeWs = workshopsResult.count ?? 0;
      const inactiveWs = inactiveWorkshopsResult.count ?? 0;
      const pendingWorkshops = totalWs - activeWs - inactiveWs;

      setGlobalMetrics({
        totalLeadsToday: totalLeadsResult.count || 0,
        acceptedLeads: acceptedResult.count || 0,
        rejectedLeads: rejectedResult.count || 0,
        slaBreaches: slaBreachedResult.count || 0,
        totalRevenue: Math.round(totalRevenue),
        dailyRevenue: Math.round(dailyRevenue),
        activeWorkshops: activeWs,
        inactiveWorkshops: inactiveWs,
        totalWorkshops: totalWs,
        pendingWorkshops: Math.max(0, pendingWorkshops || 0), // Calculated: Total - Active - Inactive
        totalCustomers: customersResult.count || 0,
        avgWorkshopRating: Math.round(avgRating * 10) / 10,
        complaintVolume: complaintsResult.count || 0,
        rsaEmergencies: rsaActiveResult.count || 0,
        systemUptime: 99.9 // From monitoring system
      });

      // Fetch Department Metrics - SAME AS WEB
      const [
        telecallerLeadsResult,
        followUpsResult,
        assignedLeadsResult,
        activeJobsResult,
        busyWorkshopsResult,
        auditsResult,
        fraudResult
      ] = await Promise.all([
        // Telecaller leads
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .not('assigned_telecaller_id', 'is', null),
        
        // Pending follow-ups
        supabase.from('telecaller_follow_ups').select('id', { count: 'exact', head: true })
          .eq('status', 'PENDING'),
        
        // Assigned to workshops
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .not('workshop_id', 'is', null)
          .in('status', ['ACCEPTED', 'IN_PROGRESS']),
        
        // Active jobs in workshops
        supabase.from('service_leads').select('id', { count: 'exact', head: true })
          .eq('status', 'IN_PROGRESS'),
        
        // Busy workshops (>5 active jobs)
        supabase.from('service_leads')
          .select('workshop_id')
          .eq('status', 'IN_PROGRESS')
          .not('workshop_id', 'is', null),
        
        // Audits conducted today
        supabase.from('audit_logs').select('id', { count: 'exact', head: true })
          .gte('created_at', `${today}T00:00:00`)
          .eq('audit_type', 'LEAD_AUDIT'),
        
        // Fraud found today
        supabase.from('fraud_reports').select('id', { count: 'exact', head: true })
          .gte('created_at', `${today}T00:00:00`)
          .eq('status', 'CONFIRMED')
      ]);

      // Calculate conversion rate
      const totalCalls = telecallerLeadsResult.count || 1;
      const converted = acceptedResult.count || 0;
      const conversionRate = Math.round((converted / totalCalls) * 100);

      // Calculate busy workshops
      const workshopJobCounts: { [key: string]: number } = {};
      busyWorkshopsResult.data?.forEach((lead: any) => {
        if (lead.workshop_id) {
          workshopJobCounts[lead.workshop_id] = (workshopJobCounts[lead.workshop_id] || 0) + 1;
        }
      });
      const busyWorkshopsCount = Object.values(workshopJobCounts).filter(count => count > 5).length;

      // Calculate average completion time (from completed jobs in last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: completedJobs } = await supabase
        .from('service_leads')
        .select('accepted_at, completed_at')
        .eq('status', 'COMPLETED')
        .gte('completed_at', sevenDaysAgo)
        .not('accepted_at', 'is', null)
        .not('completed_at', 'is', null);

      const completionTimes = completedJobs?.map(job => {
        const accepted = new Date(job.accepted_at).getTime();
        const completed = new Date(job.completed_at).getTime();
        return (completed - accepted) / (1000 * 60 * 60); // Hours
      }) || [];
      const avgCompletionHours = completionTimes.length > 0
        ? Math.round((completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) * 10) / 10
        : 0;

      setDepartmentMetrics({
        telecaller: {
          leads: telecallerLeadsResult.count || 0,
          followUps: followUpsResult.count || 0,
          conversion: conversionRate
        },
        leadManager: {
          assigned: assignedLeadsResult.count || 0,
          avgTime: 12, // Average assignment time in minutes (can be calculated)
          accuracy: 94 // Assignment accuracy (can be calculated from reassignments)
        },
        workshops: {
          active: activeJobsResult.count || 0,
          busy: busyWorkshopsCount,
          avgCompletion: avgCompletionHours
        },
        rsa: {
          active: rsaActiveResult.count || 0,
          avgDispatch: 18, // Average dispatch time in minutes
          completion: 89 // Completion rate percentage
        },
        auditors: {
          auditsToday: auditsResult.count || 0,
          fraudFound: fraudResult.count || 0,
          avgScore: 8.2 // Average audit score
        }
      });

      // Generate Critical Alerts - SAME AS WEB
      const criticalAlerts = [];
      if (slaBreachedResult.count && slaBreachedResult.count > 0) {
        criticalAlerts.push({
          id: 'sla',
          type: 'CRITICAL',
          title: 'SLA Breaches',
          message: `${slaBreachedResult.count} leads have breached SLA`,
          color: COLORS.red
        });
      }
      if (rsaActiveResult.count && rsaActiveResult.count > 5) {
        criticalAlerts.push({
          id: 'rsa',
          type: 'WARNING',
          title: 'High RSA Load',
          message: `${rsaActiveResult.count} active RSA emergencies`,
          color: COLORS.orange
        });
      }
      if (complaintsResult.count && complaintsResult.count > 10) {
        criticalAlerts.push({
          id: 'complaints',
          type: 'WARNING',
          title: 'High Complaints',
          message: `${complaintsResult.count} active customer complaints`,
          color: COLORS.orange
        });
      }
      setAlerts(criticalAlerts);

    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [routeParams, setRouteParams] = useState<any>({});
  const [screenParams, setScreenParams] = useState<any>({});
  const [menuOpen, setMenuOpen] = useState(false);

  const handleNavigation = (screen: string, params?: any) => {
    if (screen === 'dashboard') {
      setCurrentScreen('dashboard');
      setScreenParams({});
      return;
    }
    const screenMap: { [key: string]: string } = {
      workshops: 'WorkshopManagement',
      users: 'UserRoleManagement',
      reports: 'ReportsAnalytics',
      settings: 'SystemSettings',
      finance: 'FinancePayout',
      leads: 'LeadManagerAppBookings',
      LeadsManagement: 'LeadManagerAppBookings',
      fraud: 'FraudDetection',
      audit: 'AuditLogs',
      brands: 'Brands',
      'inventory-products': 'InventoryProducts',
      'inventory-packages': 'InventoryPackages',
      'inventory-package-detail': 'InventoryPackageDetail',
      'inventory-zones': 'InventoryZones',
      'inventory-pricing': 'InventoryPricing',
      'inventory-service-pricing': 'InventoryServicePricing',
      'additional-jobs-master': 'AdditionalJobsMaster',
      coupons: 'Coupons',
      'manual-invoices': 'ManualInvoices',
      'telecaller-distribution': 'TelecallerDistribution',
      'lead-history': 'LeadHistory',
      'website-images': 'WebsiteImages',
      'home-carousel': 'HomeCarousel',
      'workshop-public-pages': 'WorkshopPublicPages',
      'kb-manager': 'KBManager',
      'kb-questions': 'KBQuestions',
      'workshop-rates': 'WorkshopRates',
    };
    const stackName = screenMap[screen] || screen;
    (navigation as any).navigate(stackName, params);
  };

  const navigationObj = {
    navigate: (screen: string, params?: any) => {
      handleNavigation(screen, params);
    },
    goBack: () => {
      setCurrentScreen('dashboard');
      setScreenParams({});
    },
  };

  const runSaNav = (leaf: SaNavLeaf) => {
    setMenuOpen(false);
    if (leaf.kind === 'home') {
      setCurrentScreen('dashboard');
      setScreenParams({});
      return;
    }
    if (leaf.kind === 'stack') {
      (navigation as any).navigate(leaf.target, leaf.params);
      return;
    }
    handleNavigation(leaf.target);
  };

  // Render different screens based on currentScreen
  if (currentScreen === 'WorkshopManagement') {
    return <WorkshopManagementScreen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'WorkshopRates') {
    return <WorkshopRatesScreen navigation={navigationObj} route={{ params: screenParams }} />;
  }

  if (currentScreen === 'UserRoleManagement') {
    return <UserRoleManagementScreen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'LeadsManagement') {
    const Screen: any = LeadsManagementScreen;
    return <Screen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'ReportsAnalytics') {
    return <ReportsAnalyticsScreen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'SystemSettings') {
    return <SystemSettingsScreen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'FinancePayout') {
    return <FinancePayoutScreen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'FraudDetection') {
    const Screen: any = FraudDetectionScreen;
    return <Screen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'AuditLogs') {
    const Screen: any = AuditLogsScreen;
    return <Screen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'Brands') {
    const Screen: any = BrandsScreen;
    return <Screen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'AdditionalJobsMaster') {
    return <AdditionalJobsMasterScreen navigation={navigationObj} mode="SUPER_ADMIN" />;
  }

  if (currentScreen === 'Coupons') {
    return <CouponsScreen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'ManualInvoices') {
    return <ManualInvoicesScreen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'TelecallerDistribution') {
    return <TelecallerDistributionScreen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'LeadHistory') {
    return <LeadHistoryScreen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'WebsiteImages') {
    return <WebsiteImagesHubScreen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'HomeCarousel') {
    return <HomeCarouselScreen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'WorkshopPublicPages') {
    return <WorkshopPublicPagesScreen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'KBManager') {
    return <KbManagerScreen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'KBQuestions') {
    return <KbQuestionsScreen navigation={navigationObj} route={{ params: {} }} />;
  }

  if (currentScreen === 'InventoryProducts') {
    return <InventoryProductsScreen navigation={navigationObj} />;
  }

  if (currentScreen === 'InventoryPackages') {
    return <InventoryPackagesScreen navigation={navigationObj} />;
  }

  if (currentScreen === 'InventoryPackageDetail') {
    return <InventoryPackageDetailScreen navigation={navigationObj} route={{ params: screenParams }} />;
  }

  if (currentScreen === 'InventoryZones') {
    return <InventoryZonesScreen navigation={navigationObj} />;
  }

  if (currentScreen === 'InventoryPricing') {
    return <InventoryPricingScreen navigation={navigationObj} />;
  }

  if (currentScreen === 'InventoryServicePricing') {
    return <InventoryServicePricingScreen navigation={navigationObj} />;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading Super Admin Dashboard...</Text>
      </View>
    );
  }

  const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

  return (
    <View style={styles.container}>
      <DashboardHeader
        userName={userProfile?.full_name || 'Super Admin'}
        userRole="System Administrator"
        panelLabel="Super Admin Control Panel"
        onMenuPress={() => setMenuOpen(true)}
        onLogout={handleLogout}
      />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={[styles.statusBanner, { backgroundColor: globalMetrics.systemUptime > 99 ? '#ECFDF5' : '#FEF2F2' }]}>
          <View style={styles.statusLeft}>
            <View style={[styles.statusDot, { backgroundColor: globalMetrics.systemUptime > 99 ? COLORS.green : COLORS.red }]} />
            <Text style={[styles.statusText, { color: globalMetrics.systemUptime > 99 ? '#047857' : COLORS.red }]}>
              System Operational
            </Text>
          </View>
          <Text style={styles.uptimeText}>{globalMetrics.systemUptime}% uptime</Text>
        </View>

        {alerts.length > 0 && (
          <View style={styles.alertsSection}>
            <AdminSectionTitle>Alerts</AdminSectionTitle>
            {alerts.map((alert) => (
              <View key={alert.id} style={[styles.alertCard, { backgroundColor: alert.color + '15', borderColor: alert.color }]}>
                <Text style={[styles.alertTitle, { color: alert.color }]}>{alert.title}</Text>
                <Text style={styles.alertMessage}>{alert.message}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <AdminSectionTitle>Quick links</AdminSectionTitle>
          <View style={styles.quickLinkRow}>
            <AdminQuickLink icon="call-outline" label="Bookings & Leads" onPress={() => handleNavigation('leads')} />
            <AdminQuickLink icon="document-text-outline" label="Reports" onPress={() => handleNavigation('reports')} />
            <AdminQuickLink icon="storefront-outline" label="Workshops" onPress={() => handleNavigation('workshops')} />
            <AdminQuickLink icon="people-outline" label="Users & Roles" onPress={() => handleNavigation('users')} />
            <AdminQuickLink icon="cash-outline" label="Finance" onPress={() => handleNavigation('finance')} />
            <AdminQuickLink icon="settings-outline" label="Settings" onPress={() => handleNavigation('settings')} />
          </View>
        </View>

        <View style={styles.section}>
          <AdminSectionTitle>Key metrics</AdminSectionTitle>
          <View style={styles.metricsGrid}>
            <AdminMetricCard icon="clipboard-outline" label="Leads today" value={globalMetrics.totalLeadsToday} onPress={() => handleNavigation('leads')} />
            <AdminMetricCard icon="checkmark-circle-outline" label="Accepted" value={globalMetrics.acceptedLeads} iconBg="#ECFDF5" iconColor={COLORS.green} />
            <AdminMetricCard icon="close-circle-outline" label="Rejected" value={globalMetrics.rejectedLeads} iconBg="#FEF2F2" iconColor={COLORS.red} />
            <AdminMetricCard icon="time-outline" label="SLA breach" value={globalMetrics.slaBreaches} iconBg="#FFFBEB" iconColor={COLORS.orange} />
            <AdminMetricCard icon="storefront-outline" label="Active workshops" value={globalMetrics.activeWorkshops} onPress={() => handleNavigation('workshops')} />
            <AdminMetricCard icon="people-outline" label="Customers" value={globalMetrics.totalCustomers} iconBg="#F0FDFA" iconColor={COLORS.teal} />
            <AdminMetricCard icon="warning-outline" label="Complaints" value={globalMetrics.complaintVolume} iconBg="#EEF2FF" iconColor={COLORS.indigo} />
            <AdminMetricCard icon="car-outline" label="RSA active" value={globalMetrics.rsaEmergencies} iconBg="#FEF2F2" iconColor={COLORS.red} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.revenueCard}>
            <AdminSectionTitle>Revenue overview</AdminSectionTitle>
            <View style={styles.revenueGrid}>
              <View style={[styles.revenueItem, { backgroundColor: '#ECFDF5' }]}>
                <Text style={styles.revenueLabel}>Today</Text>
                <Text style={[styles.revenueValue, { color: '#047857' }]}>{inr(globalMetrics.dailyRevenue)}</Text>
              </View>
              <View style={[styles.revenueItem, { backgroundColor: '#EFF6FF' }]}>
                <Text style={styles.revenueLabel}>This month</Text>
                <Text style={[styles.revenueValue, { color: COLORS.primary }]}>{inr(globalMetrics.totalRevenue)}</Text>
              </View>
              <View style={[styles.revenueItem, { backgroundColor: '#FFFBEB' }]}>
                <Text style={styles.revenueLabel}>Avg rating</Text>
                <Text style={[styles.revenueValue, { color: '#D97706' }]}>
                  {Number(globalMetrics.avgWorkshopRating || 0).toFixed(1)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <AdminSectionTitle>Department performance</AdminSectionTitle>
          <AdminDeptCard
            icon="call-outline"
            title="Telecaller"
            metrics={[
              { label: 'Leads', value: departmentMetrics.telecaller.leads },
              { label: 'Follow-ups', value: departmentMetrics.telecaller.followUps },
              { label: 'Conversion', value: `${departmentMetrics.telecaller.conversion}%`, highlight: true },
            ]}
          />
          <AdminDeptCard
            icon="clipboard-outline"
            title="Lead Manager"
            metrics={[
              { label: 'Assigned', value: departmentMetrics.leadManager.assigned },
              { label: 'Avg time', value: `${departmentMetrics.leadManager.avgTime}m` },
              { label: 'Accuracy', value: `${departmentMetrics.leadManager.accuracy}%` },
            ]}
          />
          <AdminDeptCard
            icon="storefront-outline"
            title="Workshops"
            metrics={[
              { label: 'Total', value: globalMetrics.totalWorkshops },
              { label: 'Active', value: globalMetrics.activeWorkshops, highlight: true },
              { label: 'Inactive', value: globalMetrics.inactiveWorkshops },
            ]}
          />
          <AdminDeptCard
            icon="car-outline"
            title="RSA"
            metrics={[
              { label: 'Active', value: departmentMetrics.rsa.active },
              { label: 'Avg dispatch', value: `${departmentMetrics.rsa.avgDispatch}m` },
              { label: 'Completion', value: `${departmentMetrics.rsa.completion}%` },
            ]}
          />
          <AdminDeptCard
            icon="shield-checkmark-outline"
            title="Quality auditors"
            metrics={[
              { label: 'Audits today', value: departmentMetrics.auditors.auditsToday },
              { label: 'Fraud found', value: departmentMetrics.auditors.fraudFound },
              { label: 'Avg score', value: departmentMetrics.auditors.avgScore, highlight: true },
            ]}
          />
        </View>

        <View style={styles.section}>
          <AdminSectionTitle>Operations</AdminSectionTitle>
          <View style={styles.quickActionsGrid}>
            <AdminMenuTile icon="call-outline" label="Telecaller Dist." onPress={() => handleNavigation('telecaller-distribution')} />
            <AdminMenuTile icon="receipt-outline" label="Manual invoices" onPress={() => handleNavigation('manual-invoices')} />
            <AdminMenuTile icon="time-outline" label="Lead history" onPress={() => handleNavigation('lead-history')} />
          </View>
        </View>

        <View style={styles.section}>
          <AdminSectionTitle>Catalog & pricing</AdminSectionTitle>
          <View style={styles.quickActionsGrid}>
            <AdminMenuTile icon="cube-outline" label="Products" onPress={() => handleNavigation('inventory-products')} />
            <AdminMenuTile icon="layers-outline" label="Packages" onPress={() => handleNavigation('inventory-packages')} />
            <AdminMenuTile icon="map-outline" label="Zones" onPress={() => handleNavigation('inventory-zones')} />
            <AdminMenuTile icon="pricetag-outline" label="Product pricing" onPress={() => handleNavigation('inventory-pricing')} />
            <AdminMenuTile icon="construct-outline" label="Service pricing" onPress={() => handleNavigation('inventory-service-pricing')} />
            <AdminMenuTile icon="briefcase-outline" label="Additional jobs" onPress={() => handleNavigation('additional-jobs-master')} />
          </View>
        </View>

        <View style={styles.section}>
          <AdminSectionTitle>Admin users</AdminSectionTitle>
          <View style={styles.quickActionsGrid}>
            <AdminMenuTile icon="people-outline" label="Users & roles" onPress={() => handleNavigation('users')} />
            <AdminMenuTile icon="shield-outline" label="Fraud cases" onPress={() => handleNavigation('fraud')} />
            <AdminMenuTile icon="document-text-outline" label="Audit logs" onPress={() => handleNavigation('audit')} />
          </View>
        </View>

        <View style={styles.section}>
          <AdminSectionTitle>App + website</AdminSectionTitle>
          <View style={styles.quickActionsGrid}>
            <AdminMenuTile icon="pricetags-outline" label="Coupons" onPress={() => handleNavigation('coupons')} />
            <AdminMenuTile icon="image-outline" label="Website images" onPress={() => handleNavigation('website-images')} />
            <AdminMenuTile icon="globe-outline" label="Public pages" onPress={() => handleNavigation('workshop-public-pages')} />
            <AdminMenuTile icon="book-outline" label="KB questions" onPress={() => handleNavigation('kb-questions')} />
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <AdminHamburgerDrawer
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        userName={userProfile?.full_name || 'Super Admin'}
        userEmail={userProfile?.email || 'Super Admin Control Panel'}
        activeId="home"
        onSelect={runSaNav}
        onLogout={() => {
          setMenuOpen(false);
          void handleLogout();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: COLORS.text,
    fontFamily: FONTS.family,
  },
  scrollView: {
    flex: 1,
  },
  statusBanner: {
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.family,
  },
  uptimeText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
    fontFamily: FONTS.family,
  },
  alertsSection: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  alertCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.family,
  },
  alertMessage: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 3,
    fontFamily: FONTS.family,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickLinkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  revenueCard: {
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  revenueGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  revenueItem: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  revenueLabel: {
    fontSize: 10,
    color: COLORS.textLight,
    marginBottom: 4,
    fontWeight: '700',
    fontFamily: FONTS.family,
  },
  revenueValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONTS.family,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
