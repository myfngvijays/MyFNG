/**
 * Security Event Logger Utility
 * Logs security-specific events for audit and compliance
 */

import { createClient } from '@/lib/supabase/server';
import {
  CreateSecurityEventInput,
  SecurityEventType,
} from '@/shared/types/audit';

/**
 * Log a security event
 */
export async function logSecurityEvent(input: CreateSecurityEventInput) {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from('security_events').insert({
      event_type: input.event_type,
      user_id: input.user_id || null,
      ip_address: input.ip_address || null,
      user_agent: input.user_agent || null,
      event_details: input.event_details || {},
      severity: input.severity || 'MEDIUM',
    });

    if (error) {
      console.error('Failed to log security event:', error);
    }
  } catch (error) {
    console.error('Error in logSecurityEvent:', error);
  }
}

/**
 * Log a failed login attempt
 */
export async function logFailedLogin(
  emailOrUserId: string,
  ipAddress?: string,
  userAgent?: string,
  reason?: string
) {
  await logSecurityEvent({
    event_type: 'FAILED_LOGIN',
    user_id: emailOrUserId.includes('@') ? null : emailOrUserId, // If email, user_id is null
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    event_details: {
      email: emailOrUserId.includes('@') ? emailOrUserId : null,
      reason: reason || 'Invalid credentials',
    },
    severity: 'MEDIUM',
  });
}

/**
 * Log a permission denied event (RLS violation or unauthorized access)
 */
export async function logPermissionDenied(
  userId: string | null,
  resource: string,
  action: string,
  ipAddress?: string,
  userAgent?: string,
  details?: Record<string, any>
) {
  await logSecurityEvent({
    event_type: 'PERMISSION_DENIED',
    user_id: userId,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    event_details: {
      resource,
      action,
      ...details,
    },
    severity: 'HIGH',
  });
}

/**
 * Log an RLS violation
 */
export async function logRLSViolation(
  userId: string | null,
  tableName: string,
  attemptedAction: string,
  ipAddress?: string,
  userAgent?: string
) {
  await logSecurityEvent({
    event_type: 'RLS_VIOLATION',
    user_id: userId,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    event_details: {
      table_name: tableName,
      attempted_action: attemptedAction,
    },
    severity: 'HIGH',
  });
}

/**
 * Log suspicious activity
 */
export async function logSuspiciousActivity(
  userId: string | null,
  activityType: string,
  description: string,
  ipAddress?: string,
  userAgent?: string,
  details?: Record<string, any>
) {
  await logSecurityEvent({
    event_type: 'SUSPICIOUS_ACTIVITY',
    user_id: userId,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    event_details: {
      activity_type: activityType,
      description,
      ...details,
    },
    severity: 'HIGH',
  });
}

/**
 * Log unauthorized access attempt
 */
export async function logUnauthorizedAccess(
  userId: string | null,
  resource: string,
  ipAddress?: string,
  userAgent?: string
) {
  await logSecurityEvent({
    event_type: 'UNAUTHORIZED_ACCESS',
    user_id: userId,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    event_details: {
      resource,
    },
    severity: 'CRITICAL',
  });
}

/**
 * Log brute force attempt
 */
export async function logBruteForceAttempt(
  emailOrUserId: string,
  attemptCount: number,
  ipAddress?: string,
  userAgent?: string
) {
  await logSecurityEvent({
    event_type: 'BRUTE_FORCE_ATTEMPT',
    user_id: emailOrUserId.includes('@') ? null : emailOrUserId,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    event_details: {
      email: emailOrUserId.includes('@') ? emailOrUserId : null,
      attempt_count: attemptCount,
    },
    severity: 'CRITICAL',
  });
}

/**
 * Log SQL injection attempt
 */
export async function logSQLInjectionAttempt(
  userId: string | null,
  endpoint: string,
  payload: string,
  ipAddress?: string,
  userAgent?: string
) {
  await logSecurityEvent({
    event_type: 'SQL_INJECTION_ATTEMPT',
    user_id: userId,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    event_details: {
      endpoint,
      payload: payload.substring(0, 500), // Limit payload size
    },
    severity: 'CRITICAL',
  });
}

/**
 * Log XSS attempt
 */
export async function logXSSAttempt(
  userId: string | null,
  endpoint: string,
  payload: string,
  ipAddress?: string,
  userAgent?: string
) {
  await logSecurityEvent({
    event_type: 'XSS_ATTEMPT',
    user_id: userId,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    event_details: {
      endpoint,
      payload: payload.substring(0, 500), // Limit payload size
    },
    severity: 'HIGH',
  });
}

/**
 * Log CSRF attempt
 */
export async function logCSRFAttempt(
  userId: string | null,
  endpoint: string,
  ipAddress?: string,
  userAgent?: string
) {
  await logSecurityEvent({
    event_type: 'CSRF_ATTEMPT',
    user_id: userId,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    event_details: {
      endpoint,
    },
    severity: 'HIGH',
  });
}

/**
 * Log rate limit exceeded
 */
export async function logRateLimitExceeded(
  userId: string | null,
  endpoint: string,
  limit: number,
  ipAddress?: string,
  userAgent?: string
) {
  await logSecurityEvent({
    event_type: 'RATE_LIMIT_EXCEEDED',
    user_id: userId,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    event_details: {
      endpoint,
      limit,
    },
    severity: 'MEDIUM',
  });
}

/**
 * Log invalid token
 */
export async function logInvalidToken(
  userId: string | null,
  tokenType: string,
  ipAddress?: string,
  userAgent?: string
) {
  await logSecurityEvent({
    event_type: 'INVALID_TOKEN',
    user_id: userId,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    event_details: {
      token_type: tokenType,
    },
    severity: 'MEDIUM',
  });
}

/**
 * Log privilege escalation attempt
 */
export async function logPrivilegeEscalation(
  userId: string,
  attemptedRole: string,
  currentRole: string,
  ipAddress?: string,
  userAgent?: string
) {
  await logSecurityEvent({
    event_type: 'PRIVILEGE_ESCALATION',
    user_id: userId,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    event_details: {
      attempted_role: attemptedRole,
      current_role: currentRole,
    },
    severity: 'CRITICAL',
  });
}

