/**
 * Audit Logger Utility
 * Automatic logging functions for all user actions
 * Enhanced for tech audit compliance
 */

import { createClient } from '@/lib/supabase/server';
import {
  CreateAuditLogInput,
  CreateLeadActivityInput,
  CreateLeadEventInput,
  CreateLeadStatusHistoryInput,
} from '@/shared/types/audit';
import { createHash } from 'crypto';

/**
 * Calculate SHA-256 hash of data for integrity verification
 */
function calculateDataHash(oldData: any, newData: any): string {
  const dataString = JSON.stringify(oldData || {}) + JSON.stringify(newData || {});
  return createHash('sha256').update(dataString).digest('hex');
}

/**
 * Determine action category based on action type
 */
function getActionCategory(action: string, tableName?: string | null): string {
  const actionUpper = action.toUpperCase();
  
  if (actionUpper.includes('LOGIN') || actionUpper.includes('LOGOUT') || actionUpper.includes('AUTH')) {
    return 'SECURITY';
  }
  if (actionUpper.includes('CREATE') || actionUpper.includes('UPDATE') || actionUpper.includes('DELETE')) {
    if (tableName === 'system_settings' || tableName === 'workshops' || actionUpper.includes('CONFIG')) {
      return 'CONFIG';
    }
    return 'DATA';
  }
  if (actionUpper.includes('EXPORT') || actionUpper.includes('IMPORT') || actionUpper.includes('REPORT')) {
    return 'DATA';
  }
  if (actionUpper.includes('ERROR') || actionUpper.includes('FAIL')) {
    return 'ERROR';
  }
  return 'API';
}

/**
 * Determine severity based on action and context
 */
function getSeverity(
  action: string,
  actionCategory: string,
  errorMessage?: string | null
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (errorMessage) {
    return 'HIGH';
  }
  
  const actionUpper = action.toUpperCase();
  
  if (actionCategory === 'SECURITY') {
    if (actionUpper.includes('LOGIN') || actionUpper.includes('AUTH')) {
      return 'MEDIUM';
    }
    return 'HIGH';
  }
  
  if (actionCategory === 'CONFIG') {
    return 'HIGH';
  }
  
  if (actionUpper.includes('DELETE')) {
    return 'HIGH';
  }
  
  if (actionUpper.includes('CREATE') || actionUpper.includes('UPDATE')) {
    return 'MEDIUM';
  }
  
  return 'LOW';
}

/**
 * Sanitize data to remove sensitive information before logging
 */
function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'api_key', 'access_token', 'refresh_token'];
  const sanitized = { ...data };
  
  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }
  
  return sanitized;
}

/**
 * Set compliance flags based on action and context
 */
function getComplianceFlags(
  action: string,
  actionCategory: string,
  tableName?: string | null
): Record<string, any> {
  const flags: Record<string, any> = {};
  
  // GDPR flags
  if (tableName === 'users_login' || tableName === 'user_consents' || tableName === 'data_deletion_requests') {
    flags.gdpr_relevant = true;
  }
  
  // SOC2 flags
  if (actionCategory === 'SECURITY' || actionCategory === 'CONFIG') {
    flags.soc2_relevant = true;
  }
  
  // ISO27001 flags
  if (actionCategory === 'SECURITY' || actionCategory === 'DATA') {
    flags.iso27001_relevant = true;
  }
  
  return flags;
}

/**
 * Log an audit action (system-wide logging)
 * Enhanced with new fields for tech audit compliance
 */
export async function logAudit(input: CreateAuditLogInput) {
  try {
    const supabase = await createClient();

    // Calculate data hash if not provided
    const dataHash = input.data_hash || calculateDataHash(input.old_data, input.new_data);
    
    // Determine action category if not provided
    const actionCategory = input.action_category || getActionCategory(input.action, input.table_name);
    
    // Determine severity if not provided
    const severity = input.severity || getSeverity(input.action, actionCategory, input.error_message);
    
    // Sanitize sensitive data
    const sanitizedOldData = input.old_data ? sanitizeData(input.old_data) : null;
    const sanitizedNewData = input.new_data ? sanitizeData(input.new_data) : null;
    
    // Get compliance flags
    const complianceFlags = input.compliance_flags || getComplianceFlags(input.action, actionCategory, input.table_name);

    const { error } = await supabase.from('audit_logs').insert({
      user_id: input.user_id || null,
      action: input.action,
      table_name: input.table_name || null,
      record_id: input.record_id || null,
      old_data: sanitizedOldData,
      new_data: sanitizedNewData,
      ip_address: input.ip_address || null,
      user_agent: input.user_agent || null,
      // Enhanced fields
      action_category: actionCategory,
      severity: severity,
      session_id: input.session_id || null,
      api_endpoint: input.api_endpoint || null,
      http_method: input.http_method || null,
      response_status: input.response_status || null,
      execution_time_ms: input.execution_time_ms || null,
      error_message: input.error_message || null,
      error_stack: input.error_stack || null,
      request_id: input.request_id || null,
      compliance_flags: complianceFlags,
      data_hash: dataHash,
      is_tamper_proof: input.is_tamper_proof !== undefined ? input.is_tamper_proof : true,
      retention_until: input.retention_until || null,
    });

    if (error) {
      console.error('Failed to log audit:', error);
    }
  } catch (error) {
    console.error('Error in logAudit:', error);
  }
}

/**
 * Log a lead activity
 */
export async function logLeadActivity(input: CreateLeadActivityInput) {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from('lead_activities').insert({
      lead_id: input.lead_id || null,
      user_id: input.user_id || null,
      activity_type: input.activity_type,
      description: input.description || null,
      old_status: input.old_status || null,
      new_status: input.new_status || null,
      metadata: input.metadata || null,
    });

    if (error) {
      console.error('Failed to log lead activity:', error);
    }
  } catch (error) {
    console.error('Error in logLeadActivity:', error);
  }
}

/**
 * Log a lead event
 */
export async function logLeadEvent(input: CreateLeadEventInput) {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from('lead_events').insert({
      lead_id: input.lead_id,
      event_type: input.event_type,
      event_description: input.event_description || null,
      event_data: input.event_data || null,
      old_status: input.old_status || null,
      new_status: input.new_status || null,
      created_by: input.created_by || null,
    });

    if (error) {
      console.error('Failed to log lead event:', error);
    }
  } catch (error) {
    console.error('Error in logLeadEvent:', error);
  }
}

/**
 * Log lead status change (automatically creates history entry)
 */
export async function logLeadStatusChange(input: CreateLeadStatusHistoryInput) {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from('lead_status_history').insert({
      lead_id: input.lead_id,
      old_status: input.old_status || null,
      new_status: input.new_status,
      changed_by: input.changed_by || null,
      reason: input.reason || null,
      notes: input.notes || null,
      ip_address: input.ip_address || null,
      user_agent: input.user_agent || null,
      metadata: input.metadata || {},
    });

    if (error) {
      console.error('Failed to log status change:', error);
    }
  } catch (error) {
    console.error('Error in logLeadStatusChange:', error);
  }
}

/**
 * Comprehensive lead change logger
 * Call this whenever a lead is updated to log everything
 */
export async function logLeadChange(
  leadId: string,
  userId: string,
  changeType: string,
  oldData?: any,
  newData?: any,
  options?: {
    description?: string;
    eventData?: Record<string, any>;
    reason?: string;
    notes?: string;
  }
) {
  // Log audit
  await logAudit({
    user_id: userId,
    action: 'UPDATE',
    table_name: 'service_leads',
    record_id: leadId,
    old_data: oldData,
    new_data: newData,
  });

  // Log activity
  await logLeadActivity({
    lead_id: leadId,
    user_id: userId,
    activity_type: changeType,
    description: options?.description || `Lead ${changeType}`,
    old_status: oldData?.status,
    new_status: newData?.status,
    metadata: options?.eventData,
  });

  // If status changed, log to status history
  if (oldData?.status !== newData?.status && newData?.status) {
    await logLeadStatusChange({
      lead_id: leadId,
      old_status: oldData?.status || null,
      new_status: newData.status,
      changed_by: userId,
      reason: options?.reason || changeType,
      notes: options?.notes,
      metadata: options?.eventData || {},
    });

    // Also log as an event
    await logLeadEvent({
      lead_id: leadId,
      event_type: 'STATUS_CHANGED',
      event_description: `Status changed from ${oldData?.status || 'null'} to ${newData.status}`,
      event_data: {
        old_status: oldData?.status,
        new_status: newData.status,
        reason: options?.reason,
        ...options?.eventData,
      },
      old_status: oldData?.status,
      new_status: newData.status,
      created_by: userId,
    });
  }
}

/**
 * Log user login
 */
export async function logUserLogin(userId: string, ipAddress?: string, userAgent?: string) {
  await logAudit({
    user_id: userId,
    action: 'LOGIN',
    table_name: 'users_login',
    record_id: userId,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
  });
}

/**
 * Log user logout
 */
export async function logUserLogout(userId: string, ipAddress?: string, userAgent?: string) {
  await logAudit({
    user_id: userId,
    action: 'LOGOUT',
    table_name: 'users_login',
    record_id: userId,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
  });
}

/**
 * Helper to get IP address from request headers
 */
export function getIpAddress(headers: Headers): string | null {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    null
  );
}

/**
 * Helper to get User Agent from request headers
 */
export function getUserAgent(headers: Headers): string | null {
  return headers.get('user-agent') || null;
}

