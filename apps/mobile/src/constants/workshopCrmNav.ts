import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type WorkshopCrmNavItem = {
  id: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  kind: 'tab' | 'stack';
  screen?: string;
};

export const ADVISOR_CRM_QUICK: WorkshopCrmNavItem[] = [
  { id: 'pending', label: 'Leads', icon: 'time-outline', kind: 'stack', screen: 'PendingLeads' },
  { id: 'assign', label: 'Assign', icon: 'person-add-outline', kind: 'stack', screen: 'MechanicAssignment' },
  { id: 'qc', label: 'QC', icon: 'checkmark-circle-outline', kind: 'stack', screen: 'QCCheck' },
];

export const ADVISOR_SHELL_BY_SCREEN: Record<string, { title: string; id: string }> = {
  PendingLeads: { title: 'Pending Leads', id: 'pending' },
  DayPlanning: { title: 'Day Planning', id: 'planning' },
  JobMonitoring: { title: 'Job Monitoring', id: 'jobs' },
  SupervisorJobs: { title: 'Jobs', id: 'jobs' },
  JobDetail: { title: 'Job Details', id: 'jobs' },
  QCCheck: { title: 'QC Queue', id: 'qc' },
  QCReview: { title: 'QC Review', id: 'qc' },
  ExtraWorkApproval: { title: 'Additional Jobs', id: 'extra' },
  SupervisorAdditionalJobsMaster: { title: 'Jobs Master', id: 'master' },
  MechanicAssignment: { title: 'Assign Mechanic', id: 'assign' },
  TeamOverview: { title: 'Team Overview', id: 'team' },
  TeamPerformance: { title: 'Team Performance', id: 'perf' },
  SupervisorPerformance: { title: 'Performance', id: 'perf' },
  PickupDeliveryTracking: { title: 'Pickup & Delivery', id: 'pickup' },
  DailyReport: { title: 'Daily Report', id: 'report' },
  SupervisorAnalytics: { title: 'Analytics', id: 'analytics' },
  SupervisorProfile: { title: 'Profile', id: 'profile' },
  AdvisorReadMe: { title: 'ReadMe', id: 'readme' },
  SupervisorMenu: { title: 'All Features', id: 'dashboard' },
  Notifications: { title: 'Notifications', id: 'dashboard' },
};

export const ADVISOR_CRM_NAV: WorkshopCrmNavItem[] = [
  { id: 'dashboard', label: 'Home', icon: 'home-outline', kind: 'tab' },
  { id: 'pending', label: 'Pending Leads', icon: 'time-outline', kind: 'stack', screen: 'PendingLeads' },
  { id: 'planning', label: 'Day Planning', icon: 'calendar-outline', kind: 'stack', screen: 'DayPlanning' },
  { id: 'jobs', label: 'Job Monitoring', icon: 'construct-outline', kind: 'stack', screen: 'JobMonitoring' },
  { id: 'qc', label: 'QC Queue', icon: 'checkmark-circle-outline', kind: 'stack', screen: 'QCCheck' },
  { id: 'extra', label: 'Additional Jobs', icon: 'cash-outline', kind: 'stack', screen: 'ExtraWorkApproval' },
  { id: 'master', label: 'Jobs Master', icon: 'list-outline', kind: 'stack', screen: 'SupervisorAdditionalJobsMaster' },
  { id: 'assign', label: 'Mechanic Assignment', icon: 'person-add-outline', kind: 'stack', screen: 'MechanicAssignment' },
  { id: 'team', label: 'Team Overview', icon: 'people-outline', kind: 'stack', screen: 'TeamOverview' },
  { id: 'perf', label: 'Team Performance', icon: 'stats-chart-outline', kind: 'stack', screen: 'TeamPerformance' },
  { id: 'pickup', label: 'Pickup & Delivery', icon: 'car-outline', kind: 'stack', screen: 'PickupDeliveryTracking' },
  { id: 'report', label: 'Daily Report', icon: 'document-text-outline', kind: 'stack', screen: 'DailyReport' },
  { id: 'analytics', label: 'Analytics', icon: 'bar-chart-outline', kind: 'stack', screen: 'SupervisorAnalytics' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', kind: 'stack', screen: 'SupervisorProfile' },
  { id: 'readme', label: 'ReadMe', icon: 'book-outline', kind: 'stack', screen: 'AdvisorReadMe' },
];

export const OWNER_CRM_QUICK: WorkshopCrmNavItem[] = [
  { id: 'pending', label: 'Leads', icon: 'time-outline', kind: 'stack', screen: 'PendingLeads' },
  { id: 'active', label: 'Jobs', icon: 'construct-outline', kind: 'stack', screen: 'ActiveJobs' },
  { id: 'staff', label: 'Staff', icon: 'people-outline', kind: 'tab' },
];

export const OWNER_CRM_NAV: WorkshopCrmNavItem[] = [
  { id: 'dashboard', label: 'Home', icon: 'home-outline', kind: 'tab' },
  { id: 'pending', label: 'Pending leads', icon: 'time-outline', kind: 'stack', screen: 'PendingLeads' },
  { id: 'leads', label: 'All leads', icon: 'clipboard-outline', kind: 'tab' },
  { id: 'assign', label: 'Assign team', icon: 'people-outline', kind: 'stack', screen: 'WorkshopAdminJobAssignment' },
  { id: 'active', label: 'Active jobs', icon: 'construct-outline', kind: 'stack', screen: 'ActiveJobs' },
  { id: 'pickup', label: 'Pickup tracking', icon: 'car-outline', kind: 'stack', screen: 'WorkshopAdminPickupTracking' },
  { id: 'staff', label: 'Staff', icon: 'person-outline', kind: 'tab' },
  { id: 'master', label: 'Jobs master', icon: 'briefcase-outline', kind: 'stack', screen: 'WorkshopAdminAdditionalJobsMaster' },
  { id: 'public', label: 'Public page', icon: 'globe-outline', kind: 'stack', screen: 'WorkshopAdminPublicPage' },
  { id: 'reports', label: 'Reports', icon: 'bar-chart-outline', kind: 'stack', screen: 'WorkshopAdminReports' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', kind: 'stack', screen: 'WorkshopAdminSettings' },
  { id: 'me', label: 'Profile', icon: 'person-outline', kind: 'stack', screen: 'OwnerProfile' },
  { id: 'profile', label: 'Workshop', icon: 'business-outline', kind: 'tab' },
];

export const OWNER_SHELL_BY_SCREEN: Record<string, { title: string; id: string }> = {
  PendingLeads: { title: 'Pending Leads', id: 'pending' },
  WorkshopAdminLeadsList: { title: 'All Leads', id: 'leads' },
  WorkshopAdminLeadDetail: { title: 'Job Details', id: 'leads' },
  ActiveJobs: { title: 'Active Jobs', id: 'active' },
  WorkshopAdminStaffManagement: { title: 'Staff', id: 'staff' },
  WorkshopAdminJobAssignment: { title: 'Assign Team', id: 'assign' },
  WorkshopAdminPickupTracking: { title: 'Pickup Tracking', id: 'pickup' },
  WorkshopAdminReports: { title: 'Reports', id: 'reports' },
  WorkshopAdminSettings: { title: 'Settings', id: 'settings' },
  WorkshopAdminMenu: { title: 'All Features', id: 'dashboard' },
  WorkshopAdminPublicPage: { title: 'Public Page', id: 'public' },
  WorkshopAdminAdditionalJobsMaster: { title: 'Jobs Master', id: 'master' },
  OwnerProfile: { title: 'Profile', id: 'me' },
  Notifications: { title: 'Notifications', id: 'dashboard' },
};

export const MECHANIC_CRM_QUICK: WorkshopCrmNavItem[] = [
  { id: 'jobs', label: 'Jobs', icon: 'construct-outline', kind: 'stack', screen: 'MechanicJobs' },
  { id: 'history', label: 'History', icon: 'time-outline', kind: 'stack', screen: 'JobHistory' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', kind: 'stack', screen: 'Profile' },
];

export const MECHANIC_CRM_NAV: WorkshopCrmNavItem[] = [
  { id: 'dashboard', label: 'Home', icon: 'home-outline', kind: 'tab' },
  { id: 'jobs', label: 'Jobs', icon: 'construct-outline', kind: 'stack', screen: 'MechanicJobs' },
  { id: 'history', label: 'History', icon: 'time-outline', kind: 'stack', screen: 'JobHistory' },
  { id: 'performance', label: 'Performance', icon: 'stats-chart-outline', kind: 'stack', screen: 'Performance' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', kind: 'stack', screen: 'Profile' },
];

export const PICKUP_CRM_QUICK: WorkshopCrmNavItem[] = [
  { id: 'tasks', label: 'Tasks', icon: 'car-outline', kind: 'tab' },
  { id: 'history', label: 'History', icon: 'time-outline', kind: 'tab' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', kind: 'tab' },
];

export const PICKUP_CRM_NAV: WorkshopCrmNavItem[] = [
  { id: 'dashboard', label: 'Home', icon: 'home-outline', kind: 'tab' },
  { id: 'tasks', label: 'Tasks', icon: 'car-outline', kind: 'tab' },
  { id: 'history', label: 'History', icon: 'time-outline', kind: 'tab' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', kind: 'tab' },
];

export const MECHANIC_SHELL_BY_SCREEN: Record<string, { title: string; id: string }> = {
  MechanicJobs: { title: 'Jobs', id: 'jobs' },
  Performance: { title: 'Performance', id: 'performance' },
  JobHistory: { title: 'History', id: 'history' },
  Profile: { title: 'Profile', id: 'profile' },
  JobDetail: { title: 'Job Details', id: 'jobs' },
  LeadDetail: { title: 'Job Details', id: 'jobs' },
  MechanicJobDetail: { title: 'Job Details', id: 'jobs' },
  BeforeInspection: { title: 'Before Inspection', id: 'jobs' },
  AfterServicePhotos: { title: 'After Photos', id: 'jobs' },
  MechanicExtraWorkRequest: { title: 'Extra Job', id: 'jobs' },
  Notifications: { title: 'Notifications', id: 'dashboard' },
};

export const PICKUP_SHELL_BY_SCREEN: Record<string, { title: string; id: string }> = {
  PickupTasks: { title: 'Tasks', id: 'tasks' },
  PickupJobDetail: { title: 'Task Details', id: 'tasks' },
  PickupOtp: { title: 'Verify OTP', id: 'tasks' },
  PickupPhotoUpload: { title: 'Photos', id: 'tasks' },
  PickupIncident: { title: 'Incident', id: 'tasks' },
  PickupInAppNavigate: { title: 'Directions', id: 'tasks' },
  PickupBoyProfile: { title: 'Profile', id: 'profile' },
  TaskHistory: { title: 'History', id: 'history' },
  Notifications: { title: 'Notifications', id: 'dashboard' },
};

export const WORKSHOP_CRM_TAB_TITLES: Record<string, string> = {
  dashboard: 'Home',
  staff: 'Staff',
  leads: 'Leads',
  profile: 'Profile',
  jobs: 'Jobs',
  history: 'History',
  tasks: 'Tasks',
};
