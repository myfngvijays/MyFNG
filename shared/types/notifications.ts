// Notification Types for MyFNG System

export type NotificationType = 
  // Lead lifecycle
  | 'LEAD_ASSIGNED'
  | 'LEAD_ACCEPTED'
  | 'LEAD_REJECTED'
  | 'TEAM_ASSIGNED'
  | 'LEAD_CLOSED'

  // Mechanic / workshop floor
  | 'JOB_STARTED'
  | 'JOB_COMPLETED'
  | 'JOB_REOPENED'
  | 'EXTRA_WORK_REQUESTED'
  | 'EXTRA_WORK_APPROVED'
  | 'EXTRA_WORK_REJECTED'
  | 'QC_APPROVED'
  | 'QC_REJECTED'

  // Pickup / Delivery (legacy + shared)
  | 'PICKUP_SCHEDULED'
  | 'PICKUP_STARTED'
  | 'PICKUP_COMPLETED'
  | 'OTP_VERIFIED'
  | 'DELIVERY_ASSIGNED'
  | 'DELIVERY_COMPLETED'
  | 'DELIVERY_FAILED'

  // Pickup Boy (role-specific, operational)
  | 'PICKUP_TASK_ASSIGNED'
  | 'PICKUP_ACCEPTANCE_PENDING'
  | 'PICKUP_REASSIGNED'
  | 'PICKUP_NAV_REMINDER'
  | 'PICKUP_ARRIVED'
  | 'PICKUP_OTP_INVALID'
  | 'PICKUP_OBSERVATION_REQUIRED'
  | 'PICKUP_OBSERVATION_PENDING'
  | 'PICKUP_DOCUMENTS_REQUIRED'
  | 'HANDOVER_PENDING'
  | 'ROUTE_DEVIATION'
  | 'ROUTE_DELAY'
  | 'SOS_ACTIVATED'

  // Billing / customer ops
  | 'INVOICE_GENERATED'
  | 'INVOICE_SENT'
  | 'PAYMENT_RECEIVED'
  | 'FOLLOW_UP_SCHEDULED'
  | 'FOLLOW_UP_DUE'

  // Audit
  | 'AUDIT_SCHEDULED'
  | 'AUDIT_REJECTED'
  | 'AUDIT_FLAGGED'
  | 'AUDIT_ESCALATION'
  | 'REAUDIT_REQUESTED'

  // SLA / summaries / system-level
  | 'SLA_WARNING'
  | 'SLA_BREACH'
  | 'SYSTEM_ALERT'
  | 'CUSTOMER_COMPLAINT'
  | 'DAILY_SUMMARY'

  // Telecaller-specific notifications
  | 'LEAD_REJECTED_BY_WORKSHOP'
  | 'LEAD_IN_SERVICE'
  | 'WORKSHOP_SLA_BREACH'
  | 'WORKSHOP_SLA_WARNING'
  | 'PICKUP_OBSERVATION_ADDED'
  | 'SUPERVISOR_OBSERVATION_ADDED';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  lead_id?: string;
  lead_number?: string;
  related_user_id?: string;
  related_user_name?: string;
  action_url?: string;
  metadata?: Record<string, any>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

/** In-app notification list: hide and delete rows older than this. */
export const NOTIFICATION_RETENTION_DAYS = 7;

export function notificationRetentionCutoffIso(now = new Date()): string {
  return new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function isNotificationWithinRetention(createdAt: string | null | undefined, now = new Date()): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return t >= now.getTime() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

export interface NotificationPreferences {
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  notification_types: {
    [key in NotificationType]?: {
      email: boolean;
      sms: boolean;
      push: boolean;
      in_app: boolean;
    };
  };
}

export interface ActivityLog {
  id: string;
  lead_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  activity_type: string;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}
