/**
 * Source of truth for Supabase pg_cron → WhatsApp-related jobs.
 * Keep in sync with: database/scripts/supabase_cron_whatsapp_automation.sql
 *
 * Each automation job is scheduled separately (no bundled job=all).
 */

export type WhatsAppCronJobDef = {
  id: string;
  /** Supabase cron.job.jobname */
  jobName: string;
  title: string;
  description: string;
  /** Cron expression (UTC) as scheduled in Supabase */
  scheduleUtc: string;
  /** Human IST label */
  scheduleIst: string;
  /** API path under the app origin */
  endpointPath: string;
  /** Query param for ?job= (omit / empty if endpoint has no job switch) */
  jobParam?: string;
  force?: boolean;
  /** Linked automation trigger_key(s), if any */
  triggerKeys: string[];
  cadence: 'daily' | 'weekly';
  /** automation = WA template cron master; system_health = env numbers only */
  category: 'automation' | 'system_health';
};

export const WHATSAPP_AUTOMATION_CRON_ENDPOINT = '/api/cron/whatsapp-automation';
export const SYSTEM_HEALTH_ALERT_CRON_ENDPOINT = '/api/cron/system-health-alert';

/** @deprecated use WHATSAPP_AUTOMATION_CRON_ENDPOINT */
export const WHATSAPP_CRON_ENDPOINT = WHATSAPP_AUTOMATION_CRON_ENDPOINT;

/** Ordered by typical IST wall-clock (morning → evening). */
export const WHATSAPP_CRON_JOBS: WhatsAppCronJobDef[] = [
  {
    id: 'system-health-morning',
    jobName: 'sys-health-alert-morning',
    title: 'System health alert · Morning',
    description:
      'Checks DB, Auth, Storage, WhatsApp, Razorpay, OpenAI, Firebase, Maps, Deepcall — WhatsApp to alert numbers below.',
    scheduleUtc: '30 3 * * *',
    scheduleIst: 'Daily · 9:00 AM IST',
    endpointPath: SYSTEM_HEALTH_ALERT_CRON_ENDPOINT,
    jobParam: 'morning',
    triggerKeys: [],
    cadence: 'daily',
    category: 'system_health',
  },
  {
    id: 'app-uninstall-probe',
    jobName: 'wa-auto-app-uninstall-probe',
    title: 'App uninstall probe',
    description:
      'Probes stale FCM tokens; sends app_uninstalled WhatsApp when uninstall is detected.',
    scheduleUtc: '0 4 * * *',
    scheduleIst: 'Daily · 9:30 AM IST',
    endpointPath: WHATSAPP_AUTOMATION_CRON_ENDPOINT,
    jobParam: 'app-uninstall-probe',
    triggerKeys: ['app_uninstalled'],
    cadence: 'daily',
    category: 'automation',
  },
  {
    id: 'booking-incomplete',
    jobName: 'wa-auto-booking-incomplete',
    title: 'Incomplete booking reminder',
    description: 'Customers with incomplete / abandoned booking drafts (24h+).',
    scheduleUtc: '30 4 * * *',
    scheduleIst: 'Daily · 10:00 AM IST',
    endpointPath: WHATSAPP_AUTOMATION_CRON_ENDPOINT,
    jobParam: 'booking-incomplete',
    triggerKeys: ['booking_incomplete'],
    cadence: 'daily',
    category: 'automation',
  },
  {
    id: 'admin-daily-summary',
    jobName: 'wa-auto-admin-daily-summary',
    title: 'Admin daily summary',
    description: 'Daily summary WhatsApp to configured admin numbers.',
    scheduleUtc: '45 4 * * *',
    scheduleIst: 'Daily · 10:15 AM IST',
    endpointPath: WHATSAPP_AUTOMATION_CRON_ENDPOINT,
    jobParam: 'admin-daily-summary',
    force: true,
    triggerKeys: ['admin_daily_summary'],
    cadence: 'daily',
    category: 'automation',
  },
  {
    id: 'membership-expiring',
    jobName: 'wa-auto-membership-expiring',
    title: 'Membership expiring',
    description: 'Members whose plan expires within the next 7 days.',
    scheduleUtc: '0 5 * * *',
    scheduleIst: 'Daily · 10:30 AM IST',
    endpointPath: WHATSAPP_AUTOMATION_CRON_ENDPOINT,
    jobParam: 'membership-expiring',
    triggerKeys: ['membership_expiring'],
    cadence: 'daily',
    category: 'automation',
  },
  {
    id: 'service-due',
    jobName: 'wa-auto-service-due',
    title: 'Service due reminder',
    description: 'Customers due for service (~6 months). Job also self-skips on non-Mondays.',
    scheduleUtc: '15 5 * * 1',
    scheduleIst: 'Mondays · 10:45 AM IST',
    endpointPath: WHATSAPP_AUTOMATION_CRON_ENDPOINT,
    jobParam: 'service-due',
    triggerKeys: ['service_due_reminder'],
    cadence: 'weekly',
    category: 'automation',
  },
  {
    id: 'cart-abandoned-reminders',
    jobName: 'wa-auto-cart-abandoned',
    title: 'Cart abandoned reminders',
    description:
      'WhatsApp sequence after cart add / booking draft: 5 min → 3h (personalized offer) → 12h (final).',
    scheduleUtc: '*/5 * * * *',
    scheduleIst: 'Every 5 minutes',
    endpointPath: '/api/cron/cart-abandoned-reminders',
    triggerKeys: ['cart_abandoned_5m', 'cart_abandoned_3h', 'cart_abandoned_12h'],
    cadence: 'daily',
    category: 'automation',
  },
  {
    id: 'telecaller-leads-shift-summary',
    jobName: 'wa-telecaller-leads-shift-summary',
    title: 'Telecaller leads · Shift summary',
    description:
      'WhatsApp to alert numbers: each telecaller’s lead count for the office shift (7:00 PM → next day 7:00 PM IST).',
    scheduleUtc: '30 13 * * *',
    scheduleIst: 'Daily · 7:00 PM IST',
    endpointPath: '/api/cron/telecaller-leads-shift-summary',
    force: true,
    triggerKeys: [],
    cadence: 'daily',
    category: 'system_health',
  },
  {
    id: 'system-health-evening',
    jobName: 'sys-health-alert-evening',
    title: 'System health alert · Evening',
    description:
      'Same health checks as morning — evening status WhatsApp to alert numbers below.',
    scheduleUtc: '30 15 * * *',
    scheduleIst: 'Daily · 9:00 PM IST',
    endpointPath: SYSTEM_HEALTH_ALERT_CRON_ENDPOINT,
    jobParam: 'evening',
    triggerKeys: [],
    cadence: 'daily',
    category: 'system_health',
  },
];

export function buildWhatsAppCronUrl(baseUrl: string, job: WhatsAppCronJobDef): string {
  const base = baseUrl.replace(/\/$/, '');
  const path = job.endpointPath.startsWith('/') ? job.endpointPath : `/${job.endpointPath}`;
  const params = new URLSearchParams();
  if (job.jobParam) {
    if (job.category === 'system_health') params.set('slot', job.jobParam);
    else params.set('job', job.jobParam);
  }
  if (job.force) params.set('force', '1');
  const qs = params.toString();
  return `${base}${path}${qs ? `?${qs}` : ''}`;
}
