import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type SaNavLeaf = {
  id: string;
  label: string;
  icon: IoniconName;
  /** Stack route name (or dashboard home) */
  target: string;
  kind: 'home' | 'stack';
  params?: Record<string, unknown>;
};

export type SaNavGroup = {
  id: string;
  label: string;
  icon: IoniconName;
  children: SaNavLeaf[];
};

export type SaNavRow =
  | ({ type: 'item' } & SaNavLeaf)
  | ({ type: 'group' } & SaNavGroup);

/** Web Super Admin sidebar — mapped to mobile screens. */
export const SA_NAV: SaNavRow[] = [
  { type: 'item', id: 'home', label: 'Dashboard', icon: 'home-outline', target: 'dashboard', kind: 'home' },
  {
    type: 'group',
    id: 'operations',
    label: 'Operations',
    icon: 'briefcase-outline',
    children: [
      { id: 'workshops', label: 'Workshops', icon: 'storefront-outline', target: 'WorkshopManagement', kind: 'stack' },
      { id: 'leads', label: 'Bookings & Leads', icon: 'clipboard-outline', target: 'LeadManagerAppBookings', kind: 'stack' },
      { id: 'lead_history', label: 'Lead History', icon: 'time-outline', target: 'LeadHistory', kind: 'stack' },
      { id: 'recordings', label: 'Recordings', icon: 'headset-outline', target: 'LeadManagerRecordings', kind: 'stack' },
      { id: 'telecaller_dist', label: 'Telecaller Distribution', icon: 'git-network-outline', target: 'TelecallerDistribution', kind: 'stack' },
      { id: 'ctc', label: 'Click to Call', icon: 'call-outline', target: 'LeadManagerClickToCall', kind: 'stack' },
      { id: 'manual_invoices', label: 'Manual Invoice', icon: 'receipt-outline', target: 'ManualInvoices', kind: 'stack' },
      { id: 'rsa', label: 'RSA', icon: 'warning-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'RSA Mechanics', path: '/api/rsa/mechanics' } },
      { id: 'link_manager', label: 'Link Manager', icon: 'link-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'Link Manager', path: '/api/super_admin/link-manager' } },
      { id: 'universal_link', label: 'Universal Link', icon: 'phone-portrait-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'Universal Link', path: '/api/super_admin/universal-link/stats' } },
    ],
  },
  {
    type: 'group',
    id: 'ai_suite',
    label: 'AI Suite',
    icon: 'sparkles-outline',
    children: [
      { id: 'ai_hub', label: 'Overview', icon: 'sparkles-outline', target: 'LeadManagerAiSuite', kind: 'stack' },
      { id: 'call_iq', label: 'Call IQ', icon: 'pulse-outline', target: 'LeadManagerCallIntelligence', kind: 'stack' },
      { id: 'lead_iq', label: 'Lead IQ', icon: 'bulb-outline', target: 'LeadManagerLeadIq', kind: 'stack' },
      { id: 'workflow', label: 'Workflow', icon: 'git-branch-outline', target: 'LeadManagerWorkflow', kind: 'stack' },
      { id: 'playbook', label: 'Sales Playbook', icon: 'book-outline', target: 'LeadManagerPlaybook', kind: 'stack' },
    ],
  },
  {
    type: 'group',
    id: 'catalog',
    label: 'Catalog & Pricing',
    icon: 'cube-outline',
    children: [
      { id: 'products', label: 'Products & Inventory', icon: 'cube-outline', target: 'InventoryProducts', kind: 'stack' },
      { id: 'packages', label: 'Service Packages', icon: 'layers-outline', target: 'InventoryPackages', kind: 'stack' },
      { id: 'additional_jobs', label: 'Additional Jobs Master', icon: 'briefcase-outline', target: 'AdditionalJobsMaster', kind: 'stack' },
      { id: 'workshop_pricing', label: 'Workshop Pricing', icon: 'pricetag-outline', target: 'InventoryPricing', kind: 'stack' },
      { id: 'service_pricing', label: 'Service Pricing', icon: 'construct-outline', target: 'InventoryServicePricing', kind: 'stack' },
      { id: 'zones', label: 'Zones', icon: 'map-outline', target: 'InventoryZones', kind: 'stack' },
      { id: 'workshop_rates', label: 'Workshop Rates', icon: 'cash-outline', target: 'WorkshopRates', kind: 'stack' },
    ],
  },
  {
    type: 'group',
    id: 'app_customers',
    label: 'App Customers',
    icon: 'phone-portrait-outline',
    children: [
      { id: 'app_bookings', label: 'Bookings & Leads', icon: 'clipboard-outline', target: 'LeadManagerAppBookings', kind: 'stack' },
      { id: 'app_customers', label: 'Customers', icon: 'people-outline', target: 'LeadManagerAppCustomers', kind: 'stack' },
      { id: 'welcome_bonus', label: 'Special Welcome Bonus', icon: 'gift-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'Welcome Bonus Overrides', path: '/api/super_admin/welcome-bonus-overrides' } },
      { id: 'proximity', label: 'Workshop Proximity', icon: 'navigate-outline', target: 'LeadManagerWorkshopProximity', kind: 'stack' },
      { id: 'membership_cust', label: 'Membership Customers', icon: 'ribbon-outline', target: 'LeadManagerMembershipCustomers', kind: 'stack' },
    ],
  },
  {
    type: 'group',
    id: 'app_content',
    label: 'App Content & Display',
    icon: 'images-outline',
    children: [
      { id: 'website_images', label: 'Website Images', icon: 'image-outline', target: 'WebsiteImages', kind: 'stack' },
      { id: 'home_carousel', label: 'Home Carousel', icon: 'images-outline', target: 'HomeCarousel', kind: 'stack' },
      { id: 'app_popups', label: 'App Popups', icon: 'megaphone-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'App Popups', path: '/api/super_admin/app-popups' } },
      { id: 'public_pages', label: 'Workshop Public Pages', icon: 'globe-outline', target: 'WorkshopPublicPages', kind: 'stack' },
      { id: 'coupons', label: 'Coupons', icon: 'pricetags-outline', target: 'Coupons', kind: 'stack' },
    ],
  },
  {
    type: 'group',
    id: 'membership',
    label: 'Membership',
    icon: 'ribbon-outline',
    children: [
      { id: 'membership_plans', label: 'Membership Plans', icon: 'ribbon-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'Membership Plans', path: '/api/super_admin/membership-plans' } },
      { id: 'membership_terms', label: 'Membership T&C', icon: 'document-text-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'Membership T&C', path: '/api/super_admin/membership-terms' } },
    ],
  },
  {
    type: 'group',
    id: 'wallet',
    label: 'Wallet & Offers',
    icon: 'wallet-outline',
    children: [
      { id: 'wallet_logic', label: 'Wallet Logic', icon: 'wallet-outline', target: 'SuperAdminWalletLogic', kind: 'stack' },
      { id: 'wallet_history', label: 'Wallet Credit History', icon: 'time-outline', target: 'SuperAdminWalletHistory', kind: 'stack' },
      { id: 'refer', label: 'Refer & Rise', icon: 'gift-outline', target: 'LeadManagerReferral', kind: 'stack' },
    ],
  },
  {
    type: 'group',
    id: 'push',
    label: 'Push Notifications',
    icon: 'notifications-outline',
    children: [
      { id: 'push_dash', label: 'Push Dashboard', icon: 'stats-chart-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'Push Dashboard', path: '/api/super_admin/notifications/dashboard' } },
      { id: 'push_templates', label: 'Templates', icon: 'document-text-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'Notification Templates', path: '/api/super_admin/notifications/templates' } },
      { id: 'push_campaigns', label: 'Campaigns', icon: 'timer-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'Push Campaigns', path: '/api/super_admin/notifications/campaigns' } },
      { id: 'push_history', label: 'Notification History', icon: 'time-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'Notification History', path: '/api/super_admin/notifications/history' } },
    ],
  },
  {
    type: 'group',
    id: 'smart_tools',
    label: 'Smart Tools',
    icon: 'construct-outline',
    children: [
      { id: 'smart_tools', label: 'Smart Tools Handler', icon: 'construct-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'Smart Tools', path: '/api/super_admin/smart-tools' } },
    ],
  },
  {
    type: 'group',
    id: 'admin_users',
    label: 'Admin Users',
    icon: 'people-circle-outline',
    children: [
      { id: 'users', label: 'Users & Roles', icon: 'people-outline', target: 'UserRoleManagement', kind: 'stack' },
      { id: 'fraud', label: 'Fraud Cases', icon: 'warning-outline', target: 'FraudDetection', kind: 'stack' },
    ],
  },
  {
    type: 'group',
    id: 'intelligence',
    label: 'Intelligence',
    icon: 'chatbubbles-outline',
    children: [
      { id: 'misa', label: 'MISA Dashboard', icon: 'sparkles-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'MISA AI', path: '/api/super_admin/misa-ai/overview' } },
      { id: 'kb_manager', label: 'KB Manager', icon: 'library-outline', target: 'KBManager', kind: 'stack' },
      { id: 'kb_questions', label: 'AI Learning Inbox', icon: 'help-circle-outline', target: 'KBQuestions', kind: 'stack' },
    ],
  },
  {
    type: 'group',
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: 'logo-whatsapp',
    children: [
      { id: 'wa_team', label: 'Team WhatsApp', icon: 'chatbubbles-outline', target: 'LeadManagerTeamWhatsApp', kind: 'stack' },
      { id: 'wa_dnd', label: 'WhatsApp DND', icon: 'notifications-off-outline', target: 'LeadManagerWhatsAppDnd', kind: 'stack' },
      { id: 'wa_auto', label: 'WhatsApp Automation', icon: 'flash-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'WhatsApp Automation', path: '/api/super_admin/whatsapp-automation' } },
      { id: 'wa_cron', label: 'WhatsApp Cron', icon: 'time-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'WhatsApp Cron', path: '/api/super_admin/whatsapp-cron' } },
    ],
  },
  {
    type: 'group',
    id: 'governance',
    label: 'System & Governance',
    icon: 'shield-checkmark-outline',
    children: [
      { id: 'sysmon', label: 'System Monitor', icon: 'heart-outline', target: 'SuperAdminSystemMonitor', kind: 'stack' },
      { id: 'api_map', label: 'API Services Map', icon: 'layers-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'API Services Map', path: '/api/super_admin/api-services' } },
      { id: 'analytics', label: 'Analytics Hub', icon: 'analytics-outline', target: 'SuperAdminAnalytics', kind: 'stack' },
      { id: 'reports', label: 'Reports', icon: 'bar-chart-outline', target: 'ReportsAnalytics', kind: 'stack' },
      { id: 'audit', label: 'Audit Logs', icon: 'document-text-outline', target: 'AuditLogs', kind: 'stack' },
      { id: 'security', label: 'Security Events', icon: 'alert-circle-outline', target: 'SecurityEvents', kind: 'stack' },
      { id: 'config', label: 'Config Changes', icon: 'time-outline', target: 'ConfigChanges', kind: 'stack' },
      { id: 'compliance', label: 'Compliance Reports', icon: 'checkbox-outline', target: 'ComplianceReports', kind: 'stack' },
      { id: 'finance', label: 'Finance', icon: 'cash-outline', target: 'FinancePayout', kind: 'stack' },
      { id: 'brands', label: 'Car Brand Images', icon: 'car-outline', target: 'Brands', kind: 'stack' },
      { id: 'faqs', label: 'FAQs (App + Web)', icon: 'help-circle-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'Public FAQs', path: '/api/super_admin/public-faqs' } },
      { id: 'seo', label: 'Advanced SEO', icon: 'search-outline', target: 'SuperAdminApiModule', kind: 'stack', params: { title: 'Site SEO', path: '/api/super_admin/site-seo/overview' } },
      { id: 'settings', label: 'System Settings', icon: 'settings-outline', target: 'SystemSettings', kind: 'stack' },
    ],
  },
];

export const SA_QUICK = [
  { id: 'leads', label: 'Leads', icon: 'search-outline' as const, target: 'LeadManagerAppBookings', kind: 'stack' as const },
  { id: 'workshops', label: 'Workshops', icon: 'storefront-outline' as const, target: 'WorkshopManagement', kind: 'stack' as const },
  { id: 'reports', label: 'Reports', icon: 'bar-chart-outline' as const, target: 'ReportsAnalytics', kind: 'stack' as const },
];
