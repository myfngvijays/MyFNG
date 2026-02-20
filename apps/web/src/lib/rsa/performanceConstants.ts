/**
 * RSA Employee Boost: KPI formulas, SLA thresholds, and actionable row criteria.
 * Single source of truth for manager reports and telecaller overview.
 *
 * Calibration: Adjust SLA_*, PENDING_AGING_BUCKETS, HIGH_PRIORITY_PENDING_HOURS,
 * and AUDIT_LOW_SCORE_THRESHOLD based on real data (7d / 30d / custom ranges)
 * to match operational targets.
 */

// --- SLA thresholds (milliseconds) ---
export const SLA_MECHANIC_ASSIGNMENT_MS = 30 * 60 * 1000; // 30 minutes from registration
export const SLA_FIRST_ACTION_MS = 15 * 60 * 1000; // 15 minutes for first touch (target)

// --- Pending aging buckets (hours) ---
export const PENDING_AGING_BUCKETS = [
  { key: '0-2h', label: '0–2 hrs', minHours: 0, maxHours: 2 },
  { key: '2-6h', label: '2–6 hrs', minHours: 2, maxHours: 6 },
  { key: '6-24h', label: '6–24 hrs', minHours: 6, maxHours: 24 },
  { key: '24h+', label: '24+ hrs', minHours: 24, maxHours: Infinity },
] as const;

// --- Telecaller: "high priority pending" = older than this (hours) ---
export const HIGH_PRIORITY_PENDING_HOURS = 4;

// --- Repeat contact: multiple calls from same customer within this window (minutes) ---
export const REPEAT_CONTACT_WINDOW_MINUTES = 60;

// --- Audit quality: low score threshold (inclusive) ---
export const AUDIT_LOW_SCORE_THRESHOLD = 2;
export const AUDIT_MAX_SCORE = 5;

// --- Actionable row criteria ---
export const ACTIONABLE_NEEDS_ATTENTION_LIMIT = 20;

// Status keys used for funnel and filters
export const LEAD_STATUS_KEYS = {
  REGISTERED: 'registered',
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  ASSIGNED: 'assigned',
  ASSIGNED_TO_MANAGER: 'assigned_to_manager',
  ASSIGNED_TO_MECHANIC: 'assigned_to_mechanic',
  COMPLETED: 'completed',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const;

// Disposition labels to group as "delay reasons" (subset; others go to "Other")
export const DELAY_REASON_LABELS: Record<string, string> = {
  'Follow-up Required': 'Follow-up Required',
  'Cancelled by Customer': 'Cancelled by Customer',
  'No Service Needed': 'No Service Needed',
  'Out of Service Area': 'Out of Service Area',
  'Wrong Number': 'Wrong Number',
  'Spam/Unwanted': 'Spam/Unwanted',
  'Not Linked (No Complaint)': 'Not Linked',
  'Completed / Service Provided': 'Completed',
  'Test Call': 'Test Call',
  Other: 'Other',
};

// Time-slot buckets for "best window" (IST hour ranges)
export const TALK_TIME_SLOTS = [
  { key: '06-10', label: '6–10 AM', start: 6, end: 10 },
  { key: '10-14', label: '10 AM–2 PM', start: 10, end: 14 },
  { key: '14-18', label: '2–6 PM', start: 14, end: 18 },
  { key: '18-22', label: '6–10 PM', start: 18, end: 22 },
  { key: '22-06', label: '10 PM–6 AM', start: 22, end: 6 },
] as const;
