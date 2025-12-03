/**
 * Audit Middleware Utility
 * Wraps API route handlers to automatically log requests/responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from './logger';
import { CreateApiRequestLogInput } from '@/shared/types/audit';
import { randomUUID } from 'crypto';

/**
 * Sanitize request/response body to remove sensitive data
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'api_key', 'access_token', 'refresh_token'];
  const sanitized = { ...body };

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeBody(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Get IP address from request headers
 */
function getIpAddress(headers: Headers): string | null {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    null
  );
}

/**
 * Get user agent from request headers
 */
function getUserAgent(headers: Headers): string | null {
  return headers.get('user-agent') || null;
}

/**
 * Get session ID from cookies or headers
 */
function getSessionId(headers: Headers, cookies: any): string | null {
  // Try to get session from cookie
  const sessionCookie = cookies.get('sb-access-token') || cookies.get('session');
  if (sessionCookie) {
    return sessionCookie.value?.substring(0, 36) || null; // Use first 36 chars as session ID
  }
  return null;
}

/**
 * Wrap an API route handler with audit logging
 */
export function withAuditLogging<T = any>(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>,
  options?: {
    logRequest?: boolean;
    logResponse?: boolean;
    actionCategory?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse<T>> => {
    const startTime = Date.now();
    const requestId = randomUUID();
    const url = new URL(req.url);
    const apiEndpoint = url.pathname;
    const httpMethod = req.method;
    
    let userId: string | null = null;
    let sessionId: string | null = null;
    let ipAddress: string | null = null;
    let userAgent: string | null = null;
    let requestBody: any = null;
    let responseStatus: number = 500;
    let responseBody: any = null;
    let errorMessage: string | null = null;
    let errorStack: string | null = null;

    try {
      // Get user info
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;

      // Get request metadata
      ipAddress = getIpAddress(req.headers);
      userAgent = getUserAgent(req.headers);
      sessionId = getSessionId(req.headers, req.cookies);

      // Get request body if POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
        try {
          const clonedReq = req.clone();
          requestBody = await clonedReq.json();
          requestBody = sanitizeBody(requestBody);
        } catch (e) {
          // Body might not be JSON or already consumed
          requestBody = null;
        }
      }

      // Execute the handler
      const response = await handler(req, context);
      responseStatus = response.status;

      // Get response body
      try {
        const clonedResponse = response.clone();
        responseBody = await clonedResponse.json();
        responseBody = sanitizeBody(responseBody);
      } catch (e) {
        // Response might not be JSON
        responseBody = null;
      }

      const executionTime = Date.now() - startTime;

      // Log API request
      await logApiRequest({
        request_id: requestId,
        user_id: userId,
        api_endpoint: apiEndpoint,
        http_method: httpMethod as any,
        request_body: requestBody,
        response_status: responseStatus,
        response_body: responseBody,
        execution_time_ms: executionTime,
        ip_address: ipAddress,
        user_agent: userAgent,
        session_id: sessionId,
      });

      // Log audit if needed
      if (options?.logRequest !== false) {
        await logAudit({
          user_id: userId,
          action: httpMethod,
          table_name: null,
          record_id: null,
          old_data: requestBody,
          new_data: responseBody,
          ip_address: ipAddress,
          user_agent: userAgent,
          action_category: options?.actionCategory || 'API',
          severity: options?.severity || (responseStatus >= 400 ? 'HIGH' : 'LOW'),
          session_id: sessionId,
          api_endpoint: apiEndpoint,
          http_method: httpMethod as any,
          response_status: responseStatus,
          execution_time_ms: executionTime,
          request_id: requestId,
        });
      }

      return response;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      errorMessage = error?.message || 'Unknown error';
      errorStack = error?.stack || null;
      responseStatus = 500;

      // Log error
      await logAudit({
        user_id: userId,
        action: httpMethod,
        table_name: null,
        record_id: null,
        old_data: requestBody,
        new_data: null,
        ip_address: ipAddress,
        user_agent: userAgent,
        action_category: options?.actionCategory || 'ERROR',
        severity: 'CRITICAL',
        session_id: sessionId,
        api_endpoint: apiEndpoint,
        http_method: httpMethod as any,
        response_status: 500,
        execution_time_ms: executionTime,
        error_message: errorMessage,
        error_stack: errorStack,
        request_id: requestId,
      });

      // Re-throw error
      throw error;
    }
  };
}

/**
 * Log API request to api_request_logs table
 */
async function logApiRequest(input: CreateApiRequestLogInput) {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from('api_request_logs').insert({
      request_id: input.request_id || randomUUID(),
      user_id: input.user_id || null,
      api_endpoint: input.api_endpoint,
      http_method: input.http_method,
      request_body: input.request_body || null,
      response_status: input.response_status || null,
      response_body: input.response_body || null,
      execution_time_ms: input.execution_time_ms || null,
      ip_address: input.ip_address || null,
      user_agent: input.user_agent || null,
      session_id: input.session_id || null,
    });

    if (error) {
      console.error('Failed to log API request:', error);
    }
  } catch (error) {
    console.error('Error in logApiRequest:', error);
  }
}

/**
 * Helper to create a wrapped handler with audit logging
 */
export function createAuditedHandler<T = any>(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>,
  options?: {
    logRequest?: boolean;
    logResponse?: boolean;
    actionCategory?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }
) {
  return withAuditLogging(handler, options);
}

