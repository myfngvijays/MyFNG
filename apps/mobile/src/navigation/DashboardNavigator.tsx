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
import CustomerDashboard from '../screens/dashboard/CustomerDashboard';
import DigitalMarketingDashboard from '../screens/dashboard/DigitalMarketingDashboard';
import DigitalAuthorDashboardScreen from '../screens/dashboard/digital_author/DigitalAuthorDashboardScreen';
import AdditionalJobsMasterScreen from '../screens/dashboard/additional_jobs/AdditionalJobsMasterScreen';
import CouponsScreen from '../screens/dashboard/superadmin/CouponsScreen';
import ManualInvoicesScreen from '../screens/dashboard/superadmin/ManualInvoicesScreen';
import TelecallerDistributionScreen from '../screens/dashboard/superadmin/TelecallerDistributionScreen';
import LeadHistoryScreen from '../screens/dashboard/superadmin/LeadHistoryScreen';
import WebsiteImagesHubScreen from '../screens/dashboard/superadmin/WebsiteImagesHubScreen';
import HomeCarouselScreen from '../screens/dashboard/superadmin/HomeCarouselScreen';
import WorkshopPublicPagesScreen from '../screens/dashboard/superadmin/WorkshopPublicPagesScreen';
import KbManagerScreen from '../screens/dashboard/superadmin/KbManagerScreen';
import KbQuestionsScreen from '../screens/dashboard/superadmin/KbQuestionsScreen';
import DigitalAuthorBlogsScreen from '../screens/dashboard/digital_author/DigitalAuthorBlogsScreen';
import DigitalAuthorBlogEditorScreen from '../screens/dashboard/digital_author/DigitalAuthorBlogEditorScreen';
import DigitalAuthorProfileScreen from '../screens/dashboard/digital_author/DigitalAuthorProfileScreen';
import CustomerVehiclesScreen from '../screens/dashboard/customer/CustomerVehiclesScreen';
import ProfileScreen from '../screens/dashboard/ProfileScreen';

// Workshop Supervisor screens
import TeamOverviewScreen from '../screens/dashboard/workshop_supervisor/TeamOverviewScreen';
import TeamPerformanceScreen from '../screens/dashboard/workshop_supervisor/TeamPerformanceScreen';
import DayPlanningScreen from '../screens/dashboard/workshop_supervisor/DayPlanningScreen';
import DailyReportScreen from '../screens/dashboard/workshop_supervisor/DailyReportScreen';
import PickupDeliveryTrackingScreen from '../screens/dashboard/workshop_supervisor/PickupDeliveryTrackingScreen';
import SupervisorProfileScreen from '../screens/dashboard/workshop_supervisor/SupervisorProfileScreen';
import QCCheckScreen from '../screens/dashboard/workshop_supervisor/QCCheckScreen';
import QCReviewScreen from '../screens/dashboard/workshop_supervisor/QCReviewScreen';
import PendingLeadsScreen from '../screens/dashboard/workshop_supervisor/PendingLeadsScreen';
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
import CSECallPanelScreen from '../screens/dashboard/cse/CSECallPanelScreen';
import CSETicketsScreen from '../screens/dashboard/cse/CSETicketsScreen';
import CSECreateTicketScreen from '../screens/dashboard/cse/CSECreateTicketScreen';
import CSETicketDetailScreen from '../screens/dashboard/cse/CSETicketDetailScreen';

// SUB_ADMIN screens
import SubAdminDashboardScreen from '../screens/dashboard/subadmin/SubAdminDashboardScreen';
import SubAdminTeamScreen from '../screens/dashboard/subadmin/SubAdminTeamScreen';
import SubAdminLeadsScreen from '../screens/dashboard/subadmin/SubAdminLeadsScreen';
import SubAdminEscalationsScreen from '../screens/dashboard/subadmin/SubAdminEscalationsScreen';
import SubAdminPerformanceScreen from '../screens/dashboard/subadmin/SubAdminPerformanceScreen';
import SubAdminProfileScreen from '../screens/dashboard/subadmin/SubAdminProfileScreen';
import SubAdminTicketsScreen from '../screens/dashboard/subadmin/SubAdminTicketsScreen';
import SubAdminCallbacksScreen from '../screens/dashboard/subadmin/SubAdminCallbacksScreen';
import SubAdminAuditsScreen from '../screens/dashboard/subadmin/SubAdminAuditsScreen';

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

  const screenOptions: any = {
    headerRight: () => <LogoutButton />,
    headerShown: false, // Hide React Navigation header
    headerStyle: {
      backgroundColor: COLORS.primary,
    },
    headerTintColor: '#fff',
    headerTitleStyle: {
      fontWeight: 'bold' as const,
      fontFamily: 'Poppins',
    },
    gestureEnabled: true, // Enable swipe back gesture
    gestureDirection: 'horizontal', // Swipe from left edge
    animation: 'slide_from_right', // Slide animation
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
          name="TelecallerEnquiryLeads"
          component={require('../screens/dashboard/telecaller/TelecallerEnquiryLeadsScreen').default}
          options={{ title: 'Enquiry Leads' }}
        />
        <Stack.Screen
          name="TelecallerEnquiryLeadDetail"
          component={require('../screens/dashboard/telecaller/TelecallerEnquiryLeadDetailScreen').default}
          options={{ title: 'Enquiry Lead' }}
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
  if (roleCode === 'CSE' || roleCode === 'CUSTOMER_SERVICE_EXECUTIVE') {
    const CSECallbacksScreen = require('../screens/dashboard/cse/CSECallbacksScreen').default;
    const CSERatingsScreen = require('../screens/dashboard/cse/CSERatingsScreen').default;
    const CSEProfileScreen = require('../screens/dashboard/cse/CSEProfileScreen').default;
    
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="CSEDashboard" 
          component={CSEDashboardScreen}
          options={{ title: 'CSE Dashboard' }}
        />
        <Stack.Screen 
          name="CSECallPanel" 
          component={CSECallPanelScreen}
          options={{ title: 'Call Panel' }}
        />
        <Stack.Screen 
          name="CSETickets" 
          component={CSETicketsScreen}
          options={{ title: 'Support Tickets' }}
        />
        <Stack.Screen 
          name="CSECreateTicket" 
          component={CSECreateTicketScreen}
          options={{ title: 'Create Ticket' }}
        />
        <Stack.Screen 
          name="CSETicketDetail" 
          component={CSETicketDetailScreen}
          options={{ title: 'Ticket Details' }}
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
          name="CSECallbacks" 
          component={CSECallbacksScreen}
          options={{ title: 'Callbacks' }}
        />
        <Stack.Screen 
          name="CSERatings" 
          component={CSERatingsScreen}
          options={{ title: 'Customer Ratings' }}
        />
        <Stack.Screen 
          name="CSEProfile" 
          component={CSEProfileScreen}
          options={{ title: 'My Profile' }}
        />
        <Stack.Screen 
          name="CloseComplaint" 
          component={CloseComplaintScreen}
          options={{ title: 'Close Complaint' }}
        />
      </Stack.Navigator>
    );
  }

  // SUB_ADMIN Navigation
  if (roleCode === 'SUB_ADMIN') {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="SubAdminDashboard" 
          component={SubAdminDashboardScreen}
          options={{ title: 'Sub Admin Dashboard' }}
        />
        <Stack.Screen 
          name="SubAdminTeam" 
          component={SubAdminTeamScreen}
          options={{ title: 'Team Management' }}
        />
        <Stack.Screen 
          name="SubAdminLeads" 
          component={SubAdminLeadsScreen}
          options={{ title: 'Leads' }}
        />
        <Stack.Screen 
          name="SubAdminEscalations" 
          component={SubAdminEscalationsScreen}
          options={{ title: 'Escalations' }}
        />
        <Stack.Screen 
          name="SubAdminPerformance" 
          component={SubAdminPerformanceScreen}
          options={{ title: 'Performance' }}
        />
        <Stack.Screen 
          name="SubAdminProfile" 
          component={SubAdminProfileScreen}
          options={{ title: 'Profile' }}
        />
        <Stack.Screen 
          name="SubAdminTickets" 
          component={SubAdminTicketsScreen}
          options={{ title: 'Tickets' }}
        />
        <Stack.Screen 
          name="SubAdminCallbacks" 
          component={SubAdminCallbacksScreen}
          options={{ title: 'Callbacks' }}
        />
        <Stack.Screen 
          name="SubAdminAudits" 
          component={SubAdminAuditsScreen}
          options={{ title: 'Audits' }}
        />
      </Stack.Navigator>
    );
  }

  // Auditor Navigation
  if (roleCode === 'AUDITOR') {
    const AuditorWorkshopsScreen = require('../screens/dashboard/auditor/AuditorWorkshopsScreen').default;
    const AuditorEscalationsScreen = require('../screens/dashboard/auditor/AuditorEscalationsScreen').default;
    const AuditorPerformanceScreen = require('../screens/dashboard/auditor/AuditorPerformanceScreen').default;
    const AuditorProfileScreen = require('../screens/dashboard/auditor/AuditorProfileScreen').default;
    
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
        <Stack.Screen 
          name="AuditorWorkshops" 
          component={AuditorWorkshopsScreen}
          options={{ title: 'Workshops' }}
        />
        <Stack.Screen 
          name="AuditorEscalations" 
          component={AuditorEscalationsScreen}
          options={{ title: 'Escalations' }}
        />
        <Stack.Screen 
          name="AuditorPerformance" 
          component={AuditorPerformanceScreen}
          options={{ title: 'Performance' }}
        />
        <Stack.Screen 
          name="AuditorProfile" 
          component={AuditorProfileScreen}
          options={{ title: 'My Profile' }}
        />
      </Stack.Navigator>
    );
  }

  // Workshop Admin Navigation
  if (roleCode === 'WORKSHOP_ADMIN') {
    const PendingLeadsScreen = require('../screens/dashboard/workshop_admin/PendingLeadsScreen').default;
    const ActiveJobsScreen = require('../screens/dashboard/workshop_admin/ActiveJobsScreen').default;
    
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="WorkshopAdminDashboard" 
          component={WorkshopAdminDashboard}
          options={{ title: 'Dashboard' }}
        />
        <Stack.Screen 
          name="PendingLeads" 
          component={PendingLeadsScreen}
          options={{ title: 'Pending Leads' }}
        />
        <Stack.Screen 
          name="WorkshopAdminLeadsList" 
          component={WorkshopAdminLeadsListScreen}
          options={{ title: 'All Leads' }}
        />
        <Stack.Screen 
          name="WorkshopAdminLeadDetail" 
          component={WorkshopAdminLeadDetailScreen}
          options={{ title: 'Lead Details' }}
        />
        <Stack.Screen 
          name="ActiveJobs" 
          component={ActiveJobsScreen}
          options={{ title: 'Active Jobs' }}
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
        <Stack.Screen
          name="WorkshopAdminAdditionalJobsMaster"
          options={{ title: 'Additional Jobs Master' }}
        >
          {(props) => <AdditionalJobsMasterScreen {...props} mode="WORKSHOP_ADMIN" />}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  // Workshop Supervisor Navigation
  if (roleCode === 'WORKSHOP_SUPERVISOR') {
    const SupervisorPerformanceScreen = require('../screens/dashboard/workshop_supervisor/SupervisorPerformanceScreen').default;
    const SupervisorJobsScreen = require('../screens/dashboard/workshop_supervisor/SupervisorJobsScreen').default;
    
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
          name="SupervisorJobs" 
          component={SupervisorJobsScreen}
          options={{ title: 'Jobs' }}
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
          name="QCReview" 
          component={QCReviewScreen}
          options={{ title: 'QC Review' }}
        />
        <Stack.Screen 
          name="PendingLeads" 
          component={PendingLeadsScreen}
          options={{ title: 'Pending Leads' }}
        />
        <Stack.Screen 
          name="ExtraWorkApproval" 
          component={ExtraWorkApprovalScreen}
          options={{ title: 'Additional Jobs Approval' }}
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
          name="SupervisorPerformance" 
          component={SupervisorPerformanceScreen}
          options={{ title: 'Performance' }}
        />
        <Stack.Screen 
          name="SupervisorProfile" 
          component={SupervisorProfileScreen}
          options={{ title: 'My Profile' }}
        />
        <Stack.Screen
          name="SupervisorAdditionalJobsMaster"
          options={{ title: 'Additional Jobs Master' }}
        >
          {(props) => <AdditionalJobsMasterScreen {...props} mode="WORKSHOP_SUPERVISOR" />}
        </Stack.Screen>
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
    const PerformanceScreen = require('../screens/dashboard/workshop_mechanic/PerformanceScreen').default;
    
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
          name="Performance" 
          component={PerformanceScreen}
          options={{ title: 'Performance' }}
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
        <Stack.Screen 
          name="PickupTasks" 
          component={require('../screens/dashboard/workshop_pickup_boy/TasksListScreen').default}
          options={{ title: 'My Tasks' }}
        />
        <Stack.Screen 
          name="PickupJobDetail" 
          component={require('../screens/dashboard/workshop_pickup_boy/PickupJobDetailScreen').default}
          options={{ title: 'Task Details' }}
        />
        <Stack.Screen
          name="PickupOtp"
          component={require('../screens/dashboard/workshop_pickup_boy/PickupOtpWrapperScreen').default}
          options={{ title: 'Verify OTP' }}
        />
        <Stack.Screen 
          name="PickupPhotoUpload"
          component={require('../screens/dashboard/workshop_pickup_boy/PickupPhotoUploadWrapperScreen').default}
          options={{ title: 'Upload Photos' }}
        />
        <Stack.Screen
          name="PickupIncident"
          component={require('../screens/dashboard/workshop_pickup_boy/PickupIncidentWrapperScreen').default}
          options={{ title: 'Report Incident' }}
        />
        <Stack.Screen 
          name="PickupBoyProfile" 
          component={require('../screens/pickup/PickupBoyProfileScreen').default}
          options={{ title: 'My Profile' }}
        />
        <Stack.Screen 
          name="TaskHistory" 
          component={require('../screens/pickup/TaskHistoryScreen').default}
          options={{ title: 'Task History' }}
        />
      </Stack.Navigator>
    );
  }

  // RSA Manager Navigation
  if (roleCode === 'RSA_MANAGER') {
    const RSALeadsScreen = require('../screens/dashboard/rsa/RSALeadsScreen').default;
    const RSALeadDetailScreen = require('../screens/dashboard/rsa/RSALeadDetailScreen').default;
    const RSAMechanicsScreen = require('../screens/dashboard/rsa/RSAMechanicsScreen').default;
    const RSAMechanicDetailScreen = require('../screens/dashboard/rsa/RSAMechanicDetailScreen').default;
    const AddMechanicScreen = require('../screens/dashboard/rsa/AddMechanicScreen').default;
    
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="RSAManagerDashboard" 
          component={RSAManagerDashboard}
          options={{ title: 'RSA Manager Dashboard' }}
        />
        <Stack.Screen 
          name="RSALeads" 
          component={RSALeadsScreen}
          options={{ title: 'RSA Leads' }}
        />
        <Stack.Screen 
          name="RSALeadDetail" 
          component={RSALeadDetailScreen}
          options={{ title: 'Lead Details' }}
        />
        <Stack.Screen 
          name="RSAMechanics" 
          component={RSAMechanicsScreen}
          options={{ title: 'RSA Mechanics' }}
        />
        <Stack.Screen 
          name="RSAMechanicDetail" 
          component={RSAMechanicDetailScreen}
          options={{ title: 'Mechanic Details' }}
        />
        <Stack.Screen 
          name="AddMechanic" 
          component={AddMechanicScreen}
          options={{ title: 'Add Mechanic' }}
        />
      </Stack.Navigator>
    );
  }

  // Super Admin Navigation
  if (roleCode === 'SUPER_ADMIN') {
    const SuperAdminAnalyticsScreen = require('../screens/dashboard/superadmin/SuperAdminAnalyticsScreen').default;
    const SecurityEventsScreen = require('../screens/dashboard/superadmin/SecurityEventsScreen').default;
    const ConfigChangesScreen = require('../screens/dashboard/superadmin/ConfigChangesScreen').default;
    const ComplianceReportsScreen = require('../screens/dashboard/superadmin/ComplianceReportsScreen').default;
    const BrandsScreen = require('../screens/dashboard/superadmin/BrandsScreen').default;
    const InventoryProductsScreen = require('../screens/dashboard/superadmin/InventoryProductsScreen').default;
    const InventoryPackagesScreen = require('../screens/dashboard/superadmin/InventoryPackagesScreen').default;
    const InventoryPackageDetailScreen = require('../screens/dashboard/superadmin/InventoryPackageDetailScreen').default;
    const InventoryZonesScreen = require('../screens/dashboard/superadmin/InventoryZonesScreen').default;
    const InventoryPricingScreen = require('../screens/dashboard/superadmin/InventoryPricingScreen').default;
    const InventoryServicePricingScreen = require('../screens/dashboard/superadmin/InventoryServicePricingScreen').default;
    const WorkshopRatesScreen = require('../screens/dashboard/superadmin/WorkshopRatesScreen').default;
    
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
          name="SuperAdminAnalytics" 
          component={SuperAdminAnalyticsScreen}
          options={{ title: 'Analytics' }}
        />
        <Stack.Screen 
          name="SystemSettings" 
          component={SystemSettingsScreen}
          options={{ title: 'System Settings' }}
        />
        <Stack.Screen 
          name="LeadsManagement" 
          component={LeadsManagementScreen}
          options={{ title: 'Leads Management' }}
        />
        <Stack.Screen 
          name="FinancePayout" 
          component={FinancePayoutScreen}
          options={{ title: 'Finance & Payouts' }}
        />
        <Stack.Screen 
          name="FraudDetection" 
          component={FraudDetectionScreen}
          options={{ title: 'Fraud Detection' }}
        />
        <Stack.Screen 
          name="AuditLogs" 
          component={AuditLogsScreen}
          options={{ title: 'Audit Logs' }}
        />
        <Stack.Screen 
          name="SecurityEvents" 
          component={SecurityEventsScreen}
          options={{ title: 'Security Events' }}
        />
        <Stack.Screen 
          name="ConfigChanges" 
          component={ConfigChangesScreen}
          options={{ title: 'Config Changes' }}
        />
        <Stack.Screen 
          name="ComplianceReports" 
          component={ComplianceReportsScreen}
          options={{ title: 'Compliance Reports' }}
        />
        <Stack.Screen 
          name="Brands" 
          component={BrandsScreen}
          options={{ title: 'Brands' }}
        />
        <Stack.Screen 
          name="InventoryProducts" 
          component={InventoryProductsScreen}
          options={{ title: 'Inventory Products' }}
        />
        <Stack.Screen 
          name="InventoryPackages" 
          component={InventoryPackagesScreen}
          options={{ title: 'Inventory Packages' }}
        />
        <Stack.Screen 
          name="InventoryPackageDetail" 
          component={InventoryPackageDetailScreen}
          options={{ title: 'Package Details' }}
        />
        <Stack.Screen 
          name="InventoryZones" 
          component={InventoryZonesScreen}
          options={{ title: 'Inventory Zones' }}
        />
        <Stack.Screen 
          name="InventoryPricing" 
          component={InventoryPricingScreen}
          options={{ title: 'Inventory Pricing' }}
        />
        <Stack.Screen 
          name="InventoryServicePricing" 
          component={InventoryServicePricingScreen}
          options={{ title: 'Service Pricing' }}
        />
        <Stack.Screen 
          name="WorkshopRates" 
          component={WorkshopRatesScreen}
          options={{ title: 'Workshop Rates' }}
        />
        <Stack.Screen
          name="AdditionalJobsMaster"
          options={{ title: 'Additional Jobs Master' }}
        >
          {(props) => <AdditionalJobsMasterScreen {...props} mode="SUPER_ADMIN" />}
        </Stack.Screen>
        <Stack.Screen
          name="Coupons"
          component={CouponsScreen}
          options={{ title: 'Coupons' }}
        />
        <Stack.Screen
          name="KBManager"
          component={KbManagerScreen}
          options={{ title: 'KB Manager' }}
        />
        <Stack.Screen
          name="KBQuestions"
          component={KbQuestionsScreen}
          options={{ title: 'KB Questions' }}
        />
        <Stack.Screen
          name="WebsiteImages"
          component={WebsiteImagesHubScreen}
          options={{ title: 'Website Images' }}
        />
        <Stack.Screen
          name="HomeCarousel"
          component={HomeCarouselScreen}
          options={{ title: 'Home Carousel' }}
        />
        <Stack.Screen
          name="ManualInvoices"
          component={ManualInvoicesScreen}
          options={{ title: 'Manual Invoices' }}
        />
        <Stack.Screen
          name="TelecallerDistribution"
          component={TelecallerDistributionScreen}
          options={{ title: 'Telecaller Distribution' }}
        />
        <Stack.Screen
          name="LeadHistory"
          component={LeadHistoryScreen}
          options={{ title: 'Lead History' }}
        />
        <Stack.Screen
          name="WorkshopPublicPages"
          component={WorkshopPublicPagesScreen}
          options={{ title: 'Workshop Public Pages' }}
        />
        <Stack.Screen 
          name="SuperAdminLeads" 
          component={LeadsManagementScreen}
          options={{ title: 'Leads Overview' }}
        />
      </Stack.Navigator>
    );
  }

  // Billing Navigation
  if (roleCode === 'ACCOUNTS_TEAM' || roleCode === 'BILLING') {
    const BillingInvoiceDetailScreen = require('../screens/dashboard/billing/BillingInvoiceDetailScreen').default;
    const BillingDashboardScreen = require('../screens/dashboard/billing/BillingDashboardScreen').default;
    const BillingInvoiceReviewScreen = require('../screens/dashboard/billing/BillingInvoiceReviewScreen').default;
    const BillingGenerateInvoiceScreen = require('../screens/dashboard/billing/BillingGenerateInvoiceScreen').default;
    const BillingPaymentTrackingScreen = require('../screens/dashboard/billing/BillingPaymentTrackingScreen').default;
    
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="BillingDashboard" 
          component={BillingDashboardScreen}
          options={{ title: 'Billing Dashboard' }}
        />
        <Stack.Screen 
          name="InvoiceReview" 
          component={BillingInvoiceReviewScreen}
          options={{ title: 'Invoice Review' }}
        />
        <Stack.Screen 
          name="BillingInvoiceDetail" 
          component={BillingInvoiceDetailScreen}
          options={{ title: 'Invoice Detail' }}
        />
        <Stack.Screen 
          name="GenerateInvoice" 
          component={BillingGenerateInvoiceScreen}
          options={{ title: 'Generate Invoice' }}
        />
        <Stack.Screen 
          name="PaymentTracking" 
          component={BillingPaymentTrackingScreen}
          options={{ title: 'Payment Tracking' }}
        />
      </Stack.Navigator>
    );
  }

  // Finance Navigation
  if (roleCode === 'FINANCE') {
    const FinancePayoutsScreen = require('../screens/dashboard/finance/FinancePayoutsScreen').default;
    const FinanceRefundsScreen = require('../screens/dashboard/finance/FinanceRefundsScreen').default;
    const FinanceReconciliationScreen = require('../screens/dashboard/finance/FinanceReconciliationScreen').default;
    const FinanceChargebacksScreen = require('../screens/dashboard/finance/FinanceChargebacksScreen').default;
    const FinanceAuditTrailScreen = require('../screens/dashboard/finance/FinanceAuditTrailScreen').default;
    
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="FinanceDashboard" 
          component={require('../screens/dashboard/finance/FinanceDashboardScreen').default}
          options={{ title: 'Finance Dashboard' }}
        />
        <Stack.Screen 
          name="FinancePayouts" 
          component={FinancePayoutsScreen}
          options={{ title: 'Payouts' }}
        />
        <Stack.Screen 
          name="FinanceRefunds" 
          component={FinanceRefundsScreen}
          options={{ title: 'Refunds' }}
        />
        <Stack.Screen 
          name="FinanceReconciliation" 
          component={FinanceReconciliationScreen}
          options={{ title: 'Reconciliation' }}
        />
        <Stack.Screen 
          name="FinanceChargebacks" 
          component={FinanceChargebacksScreen}
          options={{ title: 'Chargebacks' }}
        />
        <Stack.Screen 
          name="FinanceAuditTrail" 
          component={FinanceAuditTrailScreen}
          options={{ title: 'Audit Trail' }}
        />
      </Stack.Navigator>
    );
  }

  // Home Service Manager Navigation
  if (roleCode === 'HOME_SERVICE_MANAGER') {
    const HSMDashboardScreen = require('../screens/dashboard/home_service_manager/HSMDashboardScreen').default;
    const HSMLeadsScreen = require('../screens/dashboard/home_service_manager/HSMLeadsScreen').default;
    const HSMLeadDetailScreen = require('../screens/dashboard/home_service_manager/HSMLeadDetailScreen').default;
    const HSMVansScreen = require('../screens/dashboard/home_service_manager/HSMVansScreen').default;
    const HSMTechniciansScreen = require('../screens/dashboard/home_service_manager/HSMTechniciansScreen').default;
    const HSMReportsScreen = require('../screens/dashboard/home_service_manager/HSMReportsScreen').default;
    
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="HSMDashboard" 
          component={HSMDashboardScreen}
          options={{ title: 'Home Service Manager' }}
        />
        <Stack.Screen 
          name="HSMLeads" 
          component={HSMLeadsScreen}
          options={{ title: 'Leads' }}
        />
        <Stack.Screen 
          name="HSMLeadDetail" 
          component={HSMLeadDetailScreen}
          options={{ title: 'Lead Details' }}
        />
        <Stack.Screen 
          name="HSMVans" 
          component={HSMVansScreen}
          options={{ title: 'Service Vans' }}
        />
        <Stack.Screen 
          name="HSMTechnicians" 
          component={HSMTechniciansScreen}
          options={{ title: 'Technicians' }}
        />
        <Stack.Screen 
          name="HSMReports" 
          component={HSMReportsScreen}
          options={{ title: 'Reports' }}
        />
      </Stack.Navigator>
    );
  }

  // Company Mechanic RSA Navigation
  if (roleCode === 'COMPANY_MECHANIC_RSA') {
    const CMRSADashboardScreen = require('../screens/dashboard/company_mechanic_rsa/CMRSADashboardScreen').default;
    const CMRSATasksScreen = require('../screens/dashboard/company_mechanic_rsa/CMRSATasksScreen').default;
    const CMRSATaskDetailScreen = require('../screens/dashboard/company_mechanic_rsa/CMRSATaskDetailScreen').default;
    const CMRSAHistoryScreen = require('../screens/dashboard/company_mechanic_rsa/CMRSAHistoryScreen').default;
    const CMRSAProfileScreen = require('../screens/dashboard/company_mechanic_rsa/CMRSAProfileScreen').default;
    
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="CMRSADashboard" 
          component={CMRSADashboardScreen}
          options={{ title: 'RSA Mechanic Dashboard' }}
        />
        <Stack.Screen 
          name="CMRSATasks" 
          component={CMRSATasksScreen}
          options={{ title: 'My Tasks' }}
        />
        <Stack.Screen 
          name="CMRSATaskDetail" 
          component={CMRSATaskDetailScreen}
          options={{ title: 'Task Details' }}
        />
        <Stack.Screen 
          name="CMRSAHistory" 
          component={CMRSAHistoryScreen}
          options={{ title: 'Job History' }}
        />
        <Stack.Screen 
          name="CMRSAProfile" 
          component={CMRSAProfileScreen}
          options={{ title: 'My Profile' }}
        />
      </Stack.Navigator>
    );
  }

  // Company Van Technician Navigation
  if (roleCode === 'COMPANY_VAN_TECHNICIAN') {
    const CVTDashboardScreen = require('../screens/dashboard/company_van_technician/CVTDashboardScreen').default;
    const CVTTasksScreen = require('../screens/dashboard/company_van_technician/CVTTasksScreen').default;
    const CVTTaskDetailScreen = require('../screens/dashboard/company_van_technician/CVTTaskDetailScreen').default;
    const CVTHistoryScreen = require('../screens/dashboard/company_van_technician/CVTHistoryScreen').default;
    const CVTProfileScreen = require('../screens/dashboard/company_van_technician/CVTProfileScreen').default;
    
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="CVTDashboard" 
          component={CVTDashboardScreen}
          options={{ title: 'Van Technician Dashboard' }}
        />
        <Stack.Screen 
          name="CVTTasks" 
          component={CVTTasksScreen}
          options={{ title: 'My Tasks' }}
        />
        <Stack.Screen 
          name="CVTTaskDetail" 
          component={CVTTaskDetailScreen}
          options={{ title: 'Task Details' }}
        />
        <Stack.Screen 
          name="CVTHistory" 
          component={CVTHistoryScreen}
          options={{ title: 'Job History' }}
        />
        <Stack.Screen 
          name="CVTProfile" 
          component={CVTProfileScreen}
          options={{ title: 'My Profile' }}
        />
      </Stack.Navigator>
    );
  }

  // Company Van Driver Navigation
  if (roleCode === 'COMPANY_VAN_DRIVER') {
    const CVDDashboardScreen = require('../screens/dashboard/company_van_driver/CVDDashboardScreen').default;
    const CVDTasksScreen = require('../screens/dashboard/company_van_driver/CVDTasksScreen').default;
    const CVDTaskDetailScreen = require('../screens/dashboard/company_van_driver/CVDTaskDetailScreen').default;
    const CVDHistoryScreen = require('../screens/dashboard/company_van_driver/CVDHistoryScreen').default;
    const CVDProfileScreen = require('../screens/dashboard/company_van_driver/CVDProfileScreen').default;
    
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="CVDDashboard" 
          component={CVDDashboardScreen}
          options={{ title: 'Van Driver Dashboard' }}
        />
        <Stack.Screen 
          name="CVDTasks" 
          component={CVDTasksScreen}
          options={{ title: 'My Trips' }}
        />
        <Stack.Screen 
          name="CVDTaskDetail" 
          component={CVDTaskDetailScreen}
          options={{ title: 'Trip Details' }}
        />
        <Stack.Screen 
          name="CVDHistory" 
          component={CVDHistoryScreen}
          options={{ title: 'Trip History' }}
        />
        <Stack.Screen 
          name="CVDProfile" 
          component={CVDProfileScreen}
          options={{ title: 'My Profile' }}
        />
      </Stack.Navigator>
    );
  }

  // Customer Navigation
  if (roleCode === 'CUSTOMER') {
    const CustomerServiceHistoryScreen = require('../screens/dashboard/customer/CustomerServiceHistoryScreen').default;
    const CustomerInvoicesScreen = require('../screens/dashboard/customer/CustomerInvoicesScreen').default;
    const CustomerSupportScreen = require('../screens/dashboard/customer/CustomerSupportScreen').default;
    
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="CustomerDashboard" 
          component={CustomerDashboard}
          options={{ title: 'Dashboard' }}
        />
        <Stack.Screen 
          name="BookService" 
          component={require('../screens/dashboard/customer/BookServiceScreen').default}
          options={{ title: 'Book Service' }}
        />
        <Stack.Screen 
          name="TrackBooking" 
          component={require('../screens/dashboard/customer/TrackBookingScreen').default}
          options={{ title: 'Track Booking' }}
        />
        <Stack.Screen 
          name="CustomerServiceHistory" 
          component={CustomerServiceHistoryScreen}
          options={{ title: 'Service History' }}
        />
        <Stack.Screen 
          name="CustomerInvoices" 
          component={CustomerInvoicesScreen}
          options={{ title: 'My Invoices' }}
        />
        <Stack.Screen 
          name="CustomerSupport" 
          component={CustomerSupportScreen}
          options={{ title: 'Support' }}
        />
        <Stack.Screen
          name="CustomerVehicles"
          component={CustomerVehiclesScreen}
          options={{ title: 'My Vehicles' }}
        />
        <Stack.Screen
          name="CustomerProfile"
          component={ProfileScreen}
          options={{ title: 'My Profile' }}
        />
      </Stack.Navigator>
    );
  }

  // Digital Marketing Navigation
  if (roleCode === 'DIGITAL_MARKETING') {
    const DMCampaignsScreen = require('../screens/dashboard/digital_marketing/DMCampaignsScreen').default;
    const DMAnalyticsScreen = require('../screens/dashboard/digital_marketing/DMAnalyticsScreen').default;
    const DMContentScreen = require('../screens/dashboard/digital_marketing/DMContentScreen').default;
    const DMLeadsScreen = require('../screens/dashboard/digital_marketing/DMLeadsScreen').default;
    const DMProfileScreen = require('../screens/dashboard/digital_marketing/DMProfileScreen').default;
    
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen 
          name="DigitalMarketingDashboard" 
          component={DigitalMarketingDashboard}
          options={{ title: 'Digital Marketing Dashboard' }}
        />
        <Stack.Screen 
          name="DMCampaigns" 
          component={DMCampaignsScreen}
          options={{ title: 'Campaigns' }}
        />
        <Stack.Screen 
          name="DMAnalytics" 
          component={DMAnalyticsScreen}
          options={{ title: 'Analytics' }}
        />
        <Stack.Screen 
          name="DMContent" 
          component={DMContentScreen}
          options={{ title: 'Content' }}
        />
        <Stack.Screen 
          name="DMLeads" 
          component={DMLeadsScreen}
          options={{ title: 'Leads' }}
        />
        <Stack.Screen 
          name="DMProfile" 
          component={DMProfileScreen}
          options={{ title: 'My Profile' }}
        />
      </Stack.Navigator>
    );
  }

  // Digital Author Navigation
  if (roleCode === 'DIGITAL_AUTHOR') {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen
          name="DigitalAuthorDashboard"
          component={DigitalAuthorDashboardScreen}
          options={{ title: 'Digital Author Dashboard' }}
        />
        <Stack.Screen
          name="DigitalAuthorBlogs"
          component={DigitalAuthorBlogsScreen}
          options={{ title: 'My Blogs' }}
        />
        <Stack.Screen
          name="DigitalAuthorBlogEditor"
          component={DigitalAuthorBlogEditorScreen}
          options={{ title: 'Blog Editor' }}
        />
        <Stack.Screen
          name="DigitalAuthorProfile"
          component={DigitalAuthorProfileScreen}
          options={{ title: 'My Profile' }}
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
