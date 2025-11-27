import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

// Import all dashboard screens
import TelecallerDashboard from '../screens/dashboard/TelecallerDashboard';
import LeadManagerDashboard from '../screens/dashboard/LeadManagerDashboard';
import RSAManagerDashboard from '../screens/dashboard/RSAManagerDashboard';
import SuperAdminDashboard from '../screens/dashboard/SuperAdminDashboard';
import CSEDashboardScreen from '../screens/dashboard/cse/CSEDashboardScreen';
import AuditorDashboardScreen from '../screens/dashboard/auditor/AuditorDashboardScreen';
import WorkshopAdminDashboard from '../screens/dashboard/WorkshopAdminDashboard';
import WorkshopSupervisorDashboard from '../screens/dashboard/WorkshopSupervisorDashboard';
import WorkshopMechanicDashboard from '../screens/dashboard/WorkshopMechanicDashboard';
import WorkshopPickupBoyDashboard from '../screens/dashboard/WorkshopPickupBoyDashboard';

// Workshop Supervisor screens
import TeamOverviewScreen from '../screens/dashboard/workshop_supervisor/TeamOverviewScreen';
import TeamPerformanceScreen from '../screens/dashboard/workshop_supervisor/TeamPerformanceScreen';
import DayPlanningScreen from '../screens/dashboard/workshop_supervisor/DayPlanningScreen';
import DailyReportScreen from '../screens/dashboard/workshop_supervisor/DailyReportScreen';
import PickupDeliveryTrackingScreen from '../screens/dashboard/workshop_supervisor/PickupDeliveryTrackingScreen';
import SupervisorProfileScreen from '../screens/dashboard/workshop_supervisor/SupervisorProfileScreen';
import QCCheckScreen from '../screens/dashboard/workshop_supervisor/QCCheckScreen';
import ExtraWorkApprovalScreen from '../screens/dashboard/workshop_supervisor/ExtraWorkApprovalScreen';
import SupervisorAnalyticsScreen from '../screens/dashboard/workshop_supervisor/SupervisorAnalyticsScreen';
import JobMonitoringScreen from '../screens/dashboard/workshop_supervisor/JobMonitoringScreen';
import JobDetailScreen from '../screens/dashboard/workshop_supervisor/JobDetailScreen';
import MechanicAssignmentScreen from '../screens/dashboard/workshop_supervisor/MechanicAssignmentScreen';
import SupervisorMenuScreen from '../screens/dashboard/workshop_supervisor/SupervisorMenuScreen';

// CSE screens
import ComplaintsManagementScreen from '../screens/dashboard/cse/ComplaintsManagementScreen';
import CSELeadDetailScreen from '../screens/dashboard/cse/CSELeadDetailScreen';
import CSEFollowUpsScreen from '../screens/dashboard/cse/CSEFollowUpsScreen';
import CloseComplaintScreen from '../screens/dashboard/cse/CloseComplaintScreen';

// Auditor screens
import AuditQueueScreen from '../screens/dashboard/auditor/AuditQueueScreen';
import FraudDetectionScreenAuditor from '../screens/dashboard/auditor/FraudDetectionScreen';
import LeadAuditDetailScreen from '../screens/dashboard/auditor/LeadAuditDetailScreen';

// Telecaller screens
import TeamManagerViewScreen from '../screens/dashboard/telecaller/TeamManagerViewScreen';
import TelecallerLeadsScreen from '../screens/dashboard/telecaller/TelecallerLeadsScreen';
import TelecallerCreateLeadScreen from '../screens/dashboard/telecaller/TelecallerCreateLeadScreen';
import TelecallerEditLeadScreen from '../screens/dashboard/telecaller/TelecallerEditLeadScreen';
import TelecallerLeadDetailScreen from '../screens/dashboard/telecaller/TelecallerLeadDetailScreen';
import TelecallerFollowUpsScreen from '../screens/dashboard/telecaller/TelecallerFollowUpsScreen';
import TelecallerProfileScreen from '../screens/dashboard/telecaller/TelecallerProfileScreen';
import TelecallerScriptsScreen from '../screens/dashboard/telecaller/TelecallerScriptsScreen';

// Workshop Admin screens
import WorkshopAdminLeadsListScreen from '../screens/dashboard/workshop_admin/LeadsListScreen';
import WorkshopAdminLeadDetailScreen from '../screens/dashboard/workshop_admin/LeadDetailScreen';
import WorkshopAdminStaffManagementScreen from '../screens/dashboard/workshop_admin/StaffManagementScreen';
import WorkshopAdminJobAssignmentScreen from '../screens/dashboard/workshop_admin/JobAssignmentScreen';
import WorkshopAdminPickupTrackingScreen from '../screens/dashboard/workshop_admin/PickupTrackingScreen';
import WorkshopAdminReportsScreen from '../screens/dashboard/workshop_admin/ReportsScreen';
import WorkshopAdminSettingsScreen from '../screens/dashboard/workshop_admin/SettingsScreen';

// Lead Manager screens  
import LeadManagerLeadsScreen from '../screens/dashboard/leadmanager/LeadManagerLeadsScreen';
import LeadManagerLeadDetailScreen from '../screens/dashboard/leadmanager/LeadManagerLeadDetailScreen';
import LeadManagerAssignWorkshopScreen from '../screens/dashboard/leadmanager/LeadManagerAssignWorkshopScreen';
import LeadManagerEscalationsScreen from '../screens/dashboard/leadmanager/LeadManagerEscalationsScreen';
import LeadManagerReportsScreen from '../screens/dashboard/lead_manager/LeadManagerReportsScreen';
import LeadManagerWorkshopsScreen from '../screens/dashboard/lead_manager/LeadManagerWorkshopsScreen';
import LeadManagerWorkshopDetailScreen from '../screens/dashboard/lead_manager/LeadManagerWorkshopDetailScreen';

// Super Admin screens
import WorkshopManagementScreen from '../screens/dashboard/superadmin/WorkshopManagementScreen';
import UserRoleManagementScreen from '../screens/dashboard/superadmin/UserRoleManagementScreen';
import ReportsAnalyticsScreen from '../screens/dashboard/superadmin/ReportsAnalyticsScreen';
import SystemSettingsScreen from '../screens/dashboard/superadmin/SystemSettingsScreen';
import LeadsManagementScreen from '../screens/dashboard/superadmin/LeadsManagementScreen';
import AuditLogsScreen from '../screens/dashboard/superadmin/AuditLogsScreen';
import FinancePayoutScreen from '../screens/dashboard/superadmin/FinancePayoutScreen';
import FraudDetectionScreen from '../screens/dashboard/superadmin/FraudDetectionScreen';

const Stack = createNativeStackNavigator();

interface DashboardNavigatorProps {
  userProfile: any;
  onLogout: () => void;
}

export default function DashboardNavigator({ userProfile, onLogout }: DashboardNavigatorProps) {
  // ✅ FIX: Extract role code from various possible locations
  const roleCode = 
    userProfile?.role?.role_code ||  // From database join (roles!role_id)
    userProfile?.role_code ||         // Direct field (if exists)
    (typeof userProfile?.role === 'string' ? userProfile?.role : null) ||
    'UNKNOWN';
  
  const roleName = 
    userProfile?.role?.role_name || 
    userProfile?.role_name || 
    'User';

  console.log('🔍 DashboardNavigator - User Profile:', JSON.stringify(userProfile, null, 2));
  console.log('🔍 DashboardNavigator - Role Object:', userProfile?.role);
  console.log('🔍 DashboardNavigator - Role Code:', roleCode);
  console.log('🔍 DashboardNavigator - Role Name:', roleName);
  
  // ✅ DEBUG: Show which dashboard will be rendered
  if (roleCode === 'UNKNOWN') {
    console.error('❌ ROLE NOT FOUND! User profile structure:', userProfile);
  }

  // Header right button component
  const LogoutButton = () => (
    <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
      <Text style={styles.logoutText}>🚪 Logout</Text>
    </TouchableOpacity>
  );

  const screenOptions = {
    headerRight: () => <LogoutButton />,
    headerShown: false, // Hide React Navigation header
    headerStyle: {
      backgroundColor: COLORS.primary,
    },
    headerTintColor: '#fff',
    headerTitleStyle: {
      fontWeight: 'bold',
      fontFamily: 'Poppins',
    },
  };

  // Telecaller Navigation
  if (roleCode === 'TELECALLER') {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="TelecallerDashboard" 
          component={TelecallerDashboard}
          options={{ title: 'Telecaller Dashboard' }}
        />
        <Stack.Screen 
          name="TelecallerLeads" 
          component={TelecallerLeadsScreen}
          options={{ title: 'My Leads' }}
        />
        <Stack.Screen 
          name="TelecallerCreateLead" 
          component={TelecallerCreateLeadScreen}
          options={{ title: 'Create New Lead' }}
        />
        <Stack.Screen 
          name="TelecallerEditLead" 
          component={TelecallerEditLeadScreen}
          options={{ title: 'Edit Lead' }}
        />
        <Stack.Screen 
          name="TelecallerLeadDetail" 
          component={TelecallerLeadDetailScreen}
          options={{ title: 'Lead Details' }}
        />
        <Stack.Screen 
          name="TelecallerFollowUps" 
          component={TelecallerFollowUpsScreen}
          options={{ title: 'Follow Ups' }}
        />
        <Stack.Screen 
          name="TelecallerScripts" 
          component={TelecallerScriptsScreen}
          options={{ title: 'Call Scripts' }}
        />
        <Stack.Screen 
          name="TeamManagerView" 
          component={TeamManagerViewScreen}
          options={{ title: 'Team Management' }}
        />
      </Stack.Navigator>
    );
  }

  // Lead Manager Navigation
  if (roleCode === 'LEAD_MANAGER') {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="LeadManagerDashboard" 
          component={LeadManagerDashboard}
          options={{ title: 'Lead Manager Dashboard' }}
        />
        <Stack.Screen 
          name="LeadManagerLeads" 
          component={LeadManagerLeadsScreen}
          options={{ title: 'Manage Leads' }}
        />
        <Stack.Screen 
          name="LeadManagerLeadDetail" 
          component={LeadManagerLeadDetailScreen}
          options={{ title: 'Lead Details' }}
        />
        <Stack.Screen 
          name="LeadManagerAssignWorkshop" 
          component={LeadManagerAssignWorkshopScreen}
          options={{ title: 'Assign Workshop' }}
        />
        <Stack.Screen 
          name="LeadManagerEscalations" 
          component={LeadManagerEscalationsScreen}
          options={{ title: 'Escalations' }}
        />
        <Stack.Screen 
          name="LeadManagerReports" 
          component={LeadManagerReportsScreen}
          options={{ title: 'Reports & Analytics' }}
        />
        <Stack.Screen 
          name="LeadManagerWorkshops" 
          component={LeadManagerWorkshopsScreen}
          options={{ title: 'Workshops' }}
        />
        <Stack.Screen 
          name="LeadManagerWorkshopDetail" 
          component={LeadManagerWorkshopDetailScreen}
          options={{ title: 'Workshop Details' }}
        />
      </Stack.Navigator>
    );
  }

  // CSE Navigation
  if (roleCode === 'CSE') {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="CSEDashboard" 
          component={CSEDashboardScreen}
          options={{ title: 'CSE Dashboard' }}
        />
        <Stack.Screen 
          name="ComplaintsManagement" 
          component={ComplaintsManagementScreen}
          options={{ title: 'Complaints' }}
        />
        <Stack.Screen 
          name="CSELeadDetail" 
          component={CSELeadDetailScreen}
          options={{ title: 'Lead Details' }}
        />
        <Stack.Screen 
          name="CSEFollowUps" 
          component={CSEFollowUpsScreen}
          options={{ title: 'Follow-ups' }}
        />
        <Stack.Screen 
          name="CloseComplaint" 
          component={CloseComplaintScreen}
          options={{ title: 'Close Complaint' }}
        />
      </Stack.Navigator>
    );
  }

  // Auditor Navigation
  if (roleCode === 'AUDITOR') {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="AuditorDashboard" 
          component={AuditorDashboardScreen}
          options={{ title: 'Auditor Dashboard' }}
        />
        <Stack.Screen 
          name="AuditQueue" 
          component={AuditQueueScreen}
          options={{ title: 'Audit Queue' }}
        />
        <Stack.Screen 
          name="FraudDetection" 
          component={FraudDetectionScreenAuditor}
          options={{ title: 'Fraud Detection' }}
        />
        <Stack.Screen 
          name="LeadAuditDetail" 
          component={LeadAuditDetailScreen}
          options={{ title: 'Audit Lead' }}
        />
      </Stack.Navigator>
    );
  }

  // Workshop Admin Navigation
  if (roleCode === 'WORKSHOP_ADMIN') {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="WorkshopAdminDashboard" 
          component={WorkshopAdminDashboard}
          options={{ title: 'Dashboard' }}
        />
        <Stack.Screen 
          name="WorkshopAdminLeadsList" 
          component={WorkshopAdminLeadsListScreen}
          options={{ title: 'Leads' }}
        />
        <Stack.Screen 
          name="WorkshopAdminLeadDetail" 
          component={WorkshopAdminLeadDetailScreen}
          options={{ title: 'Lead Details' }}
        />
        <Stack.Screen 
          name="WorkshopAdminStaffManagement" 
          component={WorkshopAdminStaffManagementScreen}
          options={{ title: 'Staff Management' }}
        />
        <Stack.Screen 
          name="WorkshopAdminJobAssignment" 
          component={WorkshopAdminJobAssignmentScreen}
          options={{ title: 'Job Assignment' }}
        />
        <Stack.Screen 
          name="WorkshopAdminPickupTracking" 
          component={WorkshopAdminPickupTrackingScreen}
          options={{ title: 'Pickup Tracking' }}
        />
        <Stack.Screen 
          name="WorkshopAdminReports" 
          component={WorkshopAdminReportsScreen}
          options={{ title: 'Reports' }}
        />
        <Stack.Screen 
          name="WorkshopAdminSettings" 
          component={WorkshopAdminSettingsScreen}
          options={{ title: 'Settings' }}
        />
      </Stack.Navigator>
    );
  }

  // Workshop Supervisor Navigation
  if (roleCode === 'WORKSHOP_SUPERVISOR') {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="WorkshopSupervisorDashboard" 
          component={WorkshopSupervisorDashboard}
          options={{ title: 'Supervisor Dashboard' }}
        />
        <Stack.Screen 
          name="SupervisorMenu" 
          component={SupervisorMenuScreen}
          options={{ title: 'All Features' }}
        />
        <Stack.Screen 
          name="DayPlanning" 
          component={DayPlanningScreen}
          options={{ title: 'Day Planning' }}
        />
        <Stack.Screen 
          name="JobMonitoring" 
          component={JobMonitoringScreen}
          options={{ title: 'Job Monitoring' }}
        />
        <Stack.Screen 
          name="QCCheck" 
          component={QCCheckScreen}
          options={{ title: 'QC Queue' }}
        />
        <Stack.Screen 
          name="ExtraWorkApproval" 
          component={ExtraWorkApprovalScreen}
          options={{ title: 'Extra Work Approvals' }}
        />
        <Stack.Screen 
          name="TeamOverview" 
          component={TeamOverviewScreen}
          options={{ title: 'Team Overview' }}
        />
        <Stack.Screen 
          name="TeamPerformance" 
          component={TeamPerformanceScreen}
          options={{ title: 'Team Performance' }}
        />
        <Stack.Screen 
          name="DailyReport" 
          component={DailyReportScreen}
          options={{ title: 'Daily Report' }}
        />
        <Stack.Screen 
          name="PickupDeliveryTracking" 
          component={PickupDeliveryTrackingScreen}
          options={{ title: 'Pickup & Delivery' }}
        />
        <Stack.Screen 
          name="SupervisorAnalytics" 
          component={SupervisorAnalyticsScreen}
          options={{ title: 'Analytics' }}
        />
        <Stack.Screen 
          name="SupervisorProfile" 
          component={SupervisorProfileScreen}
          options={{ title: 'My Profile' }}
        />
        <Stack.Screen 
          name="JobDetail" 
          component={JobDetailScreen}
          options={{ title: 'Job Details' }}
        />
        <Stack.Screen 
          name="MechanicAssignment" 
          component={MechanicAssignmentScreen}
          options={{ title: 'Assign Mechanic' }}
        />
      </Stack.Navigator>
    );
  }

  // Workshop Mechanic Navigation
  if (roleCode === 'WORKSHOP_MECHANIC') {
    const MechanicJobHistoryScreen = require('../screens/dashboard/workshop_mechanic/MechanicJobHistoryScreen').default;
    const MechanicProfileScreen = require('../screens/dashboard/workshop_mechanic/MechanicProfileScreen').default;
    const MechanicLeadDetailScreen = require('../screens/dashboard/workshop_mechanic/MechanicLeadDetailScreen').default;
    const MechanicJobDetailScreen = require('../screens/dashboard/workshop_mechanic/MechanicJobDetailScreen').default;
    const BeforeInspectionScreen = require('../screens/dashboard/workshop_mechanic/BeforeInspectionScreen').default;
    
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="MechanicDashboard" 
          component={WorkshopMechanicDashboard}
          options={{ title: 'Mechanic Dashboard' }}
        />
        <Stack.Screen 
          name="LeadDetail" 
          component={MechanicLeadDetailScreen}
          options={{ title: 'Lead Details' }}
        />
        <Stack.Screen 
          name="JobDetail" 
          component={MechanicJobDetailScreen}
          options={{ title: 'Job Details' }}
        />
        <Stack.Screen 
          name="BeforeInspection" 
          component={BeforeInspectionScreen}
          options={{ title: 'Before Inspection' }}
        />
        <Stack.Screen 
          name="AfterServicePhotos" 
          component={require('../screens/dashboard/workshop_mechanic/AfterServicePhotoScreen').default}
          options={{ title: 'After Service Photos' }}
        />
        <Stack.Screen 
          name="JobHistory" 
          component={MechanicJobHistoryScreen}
          options={{ title: 'Job History' }}
        />
        <Stack.Screen 
          name="Profile" 
          component={MechanicProfileScreen}
          options={{ title: 'My Profile' }}
        />
      </Stack.Navigator>
    );
  }

  // Workshop Pickup Boy Navigation
  if (roleCode === 'WORKSHOP_PICKUP_BOY') {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="WorkshopPickupBoyDashboard" 
          component={WorkshopPickupBoyDashboard}
          options={{ title: 'Pickup Dashboard' }}
        />
      </Stack.Navigator>
    );
  }

  // RSA Manager Navigation
  if (roleCode === 'RSA_MANAGER') {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="RSAManagerDashboard" 
          component={RSAManagerDashboard}
          options={{ title: 'RSA Manager Dashboard' }}
        />
      </Stack.Navigator>
    );
  }

  // Super Admin Navigation
  if (roleCode === 'SUPER_ADMIN') {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="SuperAdminDashboard" 
          component={SuperAdminDashboard}
          options={{ title: 'Super Admin Dashboard' }}
        />
        <Stack.Screen 
          name="WorkshopManagement" 
          component={WorkshopManagementScreen}
          options={{ title: 'Workshop Management' }}
        />
        <Stack.Screen 
          name="UserRoleManagement" 
          component={UserRoleManagementScreen}
          options={{ title: 'User & Role Management' }}
        />
        <Stack.Screen 
          name="ReportsAnalytics" 
          component={ReportsAnalyticsScreen}
          options={{ title: 'Reports & Analytics' }}
        />
        <Stack.Screen 
          name="SystemSettings" 
          component={SystemSettingsScreen}
          options={{ title: 'System Settings' }}
        />
      </Stack.Navigator>
    );
  }

  // Default/Unknown role - show detailed debug info
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen 
        name="UnknownRoleDashboard"
        options={{ title: 'Dashboard' }}
      >
        {() => (
          <View style={styles.container}>
            <Text style={styles.errorText}>Role not recognized: {roleCode}</Text>
            <Text style={styles.errorSubtext}>Please contact administrator</Text>
            
            <View style={styles.debugBox}>
              <Text style={styles.debugTitle}>Debug Info:</Text>
              <Text style={styles.debugText}>Role Code: {roleCode}</Text>
              <Text style={styles.debugText}>Role Name: {roleName}</Text>
              <Text style={styles.debugText}>
                Full Role: {JSON.stringify(userProfile?.role, null, 2)}
              </Text>
              <Text style={styles.debugText}>
                Role Code Field: {userProfile?.role_code}
              </Text>
            </View>
            
            <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  logoutButton: {
    marginRight: 15,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  logoutText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  debugBox: {
    backgroundColor: '#F3F4F6',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    width: '100%',
    maxWidth: 400,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#111827',
  },
  debugText: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  logoutBtn: {
    marginTop: 20,
    backgroundColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
