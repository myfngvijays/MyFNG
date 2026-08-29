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
  { id: 'planning', label: 'Planning', icon: 'calendar-outline', kind: 'stack', screen: 'DayPlanning' },
  { id: 'qc', label: 'QC', icon: 'checkmark-circle-outline', kind: 'stack', screen: 'QCCheck' },
];

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
  { id: 'profile', label: 'Workshop', icon: 'business-outline', kind: 'tab' },
];

export const MECHANIC_CRM_QUICK: WorkshopCrmNavItem[] = [
  { id: 'jobs', label: 'Jobs', icon: 'construct-outline', kind: 'tab' },
  { id: 'history', label: 'History', icon: 'time-outline', kind: 'tab' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', kind: 'tab' },
];

export const MECHANIC_CRM_NAV: WorkshopCrmNavItem[] = [
  { id: 'dashboard', label: 'Home', icon: 'home-outline', kind: 'tab' },
  { id: 'jobs', label: 'Jobs', icon: 'construct-outline', kind: 'tab' },
  { id: 'history', label: 'History', icon: 'time-outline', kind: 'tab' },
  { id: 'performance', label: 'Performance', icon: 'stats-chart-outline', kind: 'stack', screen: 'Performance' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', kind: 'tab' },
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

export const WORKSHOP_CRM_TAB_TITLES: Record<string, string> = {
  dashboard: 'Home',
  staff: 'Staff',
  leads: 'Leads',
  profile: 'Profile',
  jobs: 'Jobs',
  history: 'History',
  tasks: 'Tasks',
};
