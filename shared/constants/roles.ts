/**
 * User Roles Configuration
 * Complete list of all 17 user roles with permissions
 */

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SUB_ADMIN = 'SUB_ADMIN',
  LEAD_MANAGER = 'LEAD_MANAGER',
  RSA_MANAGER = 'RSA_MANAGER',
  HOME_SERVICE_MANAGER = 'HOME_SERVICE_MANAGER',
  TELECALLER = 'TELECALLER',
  CUSTOMER_SERVICE_EXECUTIVE = 'CUSTOMER_SERVICE_EXECUTIVE',
  AUDITOR = 'AUDITOR',
  ACCOUNTS_TEAM = 'ACCOUNTS_TEAM',
  WORKSHOP_ADMIN = 'WORKSHOP_ADMIN',
  WORKSHOP_SUPERVISOR = 'WORKSHOP_SUPERVISOR',
  WORKSHOP_MECHANIC = 'WORKSHOP_MECHANIC',
  WORKSHOP_PICKUP_BOY = 'WORKSHOP_PICKUP_BOY',
  COMPANY_MECHANIC_RSA = 'COMPANY_MECHANIC_RSA',
  COMPANY_VAN_TECHNICIAN = 'COMPANY_VAN_TECHNICIAN',
  COMPANY_VAN_DRIVER = 'COMPANY_VAN_DRIVER',
  DIGITAL_MARKETING = 'DIGITAL_MARKETING',
  DIGITAL_AUTHOR = 'DIGITAL_AUTHOR',
  APP_OPERATIONS = 'APP_OPERATIONS',
  CUSTOMER = 'CUSTOMER',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.SUB_ADMIN]: 'Sub Admin',
  [UserRole.LEAD_MANAGER]: 'Lead Manager',
  [UserRole.RSA_MANAGER]: 'RSA Manager',
  [UserRole.HOME_SERVICE_MANAGER]: 'Home Service Manager',
  [UserRole.TELECALLER]: 'Telecaller',
  [UserRole.CUSTOMER_SERVICE_EXECUTIVE]: 'Customer Service Executive',
  [UserRole.AUDITOR]: 'Auditor',
  [UserRole.ACCOUNTS_TEAM]: 'Accounts Team',
  [UserRole.WORKSHOP_ADMIN]: 'Workshop Owner',
  [UserRole.WORKSHOP_SUPERVISOR]: 'Workshop Adviser',
  [UserRole.WORKSHOP_MECHANIC]: 'Workshop Mechanic',
  [UserRole.WORKSHOP_PICKUP_BOY]: 'Pickupboy/Driver',
  [UserRole.COMPANY_MECHANIC_RSA]: 'Company Mechanic (RSA)',
  [UserRole.COMPANY_VAN_TECHNICIAN]: 'Company Van Technician',
  [UserRole.COMPANY_VAN_DRIVER]: 'Company Van Driver',
  [UserRole.DIGITAL_MARKETING]: 'Digital Marketing',
  [UserRole.DIGITAL_AUTHOR]: 'Digital Author',
  [UserRole.APP_OPERATIONS]: 'App Operations',
  [UserRole.CUSTOMER]: 'Customer',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Full system owner with all permissions',
  [UserRole.SUB_ADMIN]: 'Department heads - Customer Service / Telecaller Manager / Auditor Manager',
  [UserRole.LEAD_MANAGER]: 'Advanced CRM + workshop assignment — manages telecaller leads, booking, incomplete OTP, escalations, and team',
  [UserRole.RSA_MANAGER]: 'Handles roadside assistance leads and assigns company mechanics',
  [UserRole.HOME_SERVICE_MANAGER]: 'Handles Service at Home leads and assigns company service vans',
  [UserRole.TELECALLER]: 'Calls, follows up, updates CRM',
  [UserRole.CUSTOMER_SERVICE_EXECUTIVE]: 'Manages customer updates, support, escalations',
  [UserRole.AUDITOR]: 'Workshop verification & audit scoring',
  [UserRole.ACCOUNTS_TEAM]: 'Invoices, payouts, refunds, settlements',
  [UserRole.WORKSHOP_ADMIN]: 'Internal admin at partner workshop - manages staff and accepts/rejects leads',
  [UserRole.WORKSHOP_SUPERVISOR]: 'Assigns jobs inside workshop to mechanics/pickup boys',
  [UserRole.WORKSHOP_MECHANIC]: 'Handles repair jobs inside workshop',
  [UserRole.WORKSHOP_PICKUP_BOY]: 'Handles pickup and delivery',
  [UserRole.COMPANY_MECHANIC_RSA]: 'Company-registered mechanic for RSA jobs',
  [UserRole.COMPANY_VAN_TECHNICIAN]: 'Technician for Service at Home operations',
  [UserRole.COMPANY_VAN_DRIVER]: 'Driver for service vans',
  [UserRole.DIGITAL_MARKETING]: 'Manages marketing campaigns, analytics, lead generation, and promotional activities',
  [UserRole.DIGITAL_AUTHOR]: 'Creates and manages blog content, saves drafts, and writes articles',
  [UserRole.APP_OPERATIONS]: 'Manages service bookings & leads, app customers, and refer & earn',
  [UserRole.CUSTOMER]: 'End user booking services',
};

// Role hierarchy and permissions
export const ROLE_HIERARCHY = {
  admin_roles: [UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN],
  manager_roles: [UserRole.LEAD_MANAGER, UserRole.RSA_MANAGER, UserRole.HOME_SERVICE_MANAGER],
  internal_staff: [UserRole.TELECALLER, UserRole.CUSTOMER_SERVICE_EXECUTIVE, UserRole.AUDITOR, UserRole.ACCOUNTS_TEAM, UserRole.DIGITAL_MARKETING, UserRole.DIGITAL_AUTHOR, UserRole.APP_OPERATIONS],
  workshop_staff: [UserRole.WORKSHOP_ADMIN, UserRole.WORKSHOP_SUPERVISOR, UserRole.WORKSHOP_MECHANIC, UserRole.WORKSHOP_PICKUP_BOY],
  company_field_staff: [UserRole.COMPANY_MECHANIC_RSA, UserRole.COMPANY_VAN_TECHNICIAN, UserRole.COMPANY_VAN_DRIVER],
  customers: [UserRole.CUSTOMER],
};

// Permissions mapping
export const ROLE_PERMISSIONS = {
  [UserRole.SUPER_ADMIN]: ['*'], // All permissions
  [UserRole.SUB_ADMIN]: ['manage_users', 'view_reports', 'manage_leads', 'manage_workshops'],
  [UserRole.LEAD_MANAGER]: ['view_leads', 'assign_leads', 'manage_normal_leads'],
  [UserRole.RSA_MANAGER]: ['view_leads', 'assign_leads', 'manage_rsa_leads'],
  [UserRole.HOME_SERVICE_MANAGER]: ['view_leads', 'assign_leads', 'manage_home_service_leads'],
  [UserRole.TELECALLER]: ['view_leads', 'call_customers', 'update_lead_status'],
  [UserRole.CUSTOMER_SERVICE_EXECUTIVE]: ['view_customers', 'handle_support', 'manage_escalations'],
  [UserRole.AUDITOR]: ['view_workshops', 'audit_workshops', 'update_audit_scores'],
  [UserRole.ACCOUNTS_TEAM]: ['view_invoices', 'manage_payments', 'generate_reports'],
  [UserRole.WORKSHOP_ADMIN]: ['view_workshop_leads', 'accept_reject_leads', 'manage_workshop_staff'],
  [UserRole.WORKSHOP_SUPERVISOR]: ['assign_jobs', 'view_workshop_tasks', 'manage_mechanics'],
  [UserRole.WORKSHOP_MECHANIC]: ['view_assigned_jobs', 'update_job_status', 'upload_photos'],
  [UserRole.WORKSHOP_PICKUP_BOY]: ['view_pickup_tasks', 'update_pickup_status', 'upload_photos'],
  [UserRole.COMPANY_MECHANIC_RSA]: ['view_rsa_tasks', 'update_job_status', 'upload_photos'],
  [UserRole.COMPANY_VAN_TECHNICIAN]: ['view_home_service_tasks', 'update_job_status', 'upload_photos'],
  [UserRole.COMPANY_VAN_DRIVER]: ['view_home_service_tasks', 'update_delivery_status'],
  [UserRole.DIGITAL_MARKETING]: ['manage_campaigns', 'view_analytics', 'manage_promotions', 'track_leads', 'manage_content', 'edit_blogs', 'approve_blogs', 'publish_blogs', 'delete_blogs', 'manage_categories', 'manage_tags', 'restore_versions'],
  [UserRole.DIGITAL_AUTHOR]: ['create_blogs', 'save_drafts', 'edit_own_blogs'],
  [UserRole.APP_OPERATIONS]: ['view_leads', 'manage_leads', 'view_customers', 'manage_referrals'],
  [UserRole.CUSTOMER]: ['create_booking', 'view_my_bookings', 'track_service'],
};

