/**
 * Audit Logger Utility
 * Automatic logging functions for all user actions
 */

import { createClient } from '@/lib/supabase/server';
import {
  CreateAuditLogInput,
  CreateLeadActivityInput,
  CreateLeadEventInput,
  CreateLeadStatusHistoryInput,
} from '@/shared/types/audit';

/**
 * Log an audit action (system-wide logging)
 */
export async function logAudit(input: CreateAuditLogInput) {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from('audit_logs').insert({
      user_id: input.user_id || null,
      action: input.action,
      table_name: input.table_name || null,
      record_id: input.record_id || null,
      old_data: input.old_data || null,
      new_data: input.new_data || null,
      ip_address: input.ip_address || null,
      user_agent: input.user_agent || null,
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

