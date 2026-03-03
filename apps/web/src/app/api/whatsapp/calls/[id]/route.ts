import { NextRequest, NextResponse } from 'next/server';
import {
  callErrorResponse,
  isInboundDirection,
  isSuperAdminRole,
  requireOperationalUser,
} from '@/app/api/whatsapp/calls/_shared';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const gate = await requireOperationalUser();
    if (!gate.ok) return gate.response;
    const { db, roleCode } = gate;

    const params = await Promise.resolve(context.params as any);
    const id = String(params?.id || '').trim();
    if (!id) return callErrorResponse('id is required', 400);

    const { data: callLog, error: callError } = await db
      .from('whatsapp_call_logs')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (callError) return callErrorResponse(callError.message || 'Failed to fetch call', 500);
    if (!callLog) return callErrorResponse('Call not found', 404);
    if (isInboundDirection(callLog.direction) && !isSuperAdminRole(roleCode)) {
      return callErrorResponse('Incoming calls are available only for Super Admin', 403);
    }

    const { data: recordings } = await db
      .from('whatsapp_call_recordings')
      .select('*')
      .eq('call_log_id', id)
      .order('created_at', { ascending: false });
    const { data: sessions } = await db
      .from('whatsapp_call_sessions')
      .select('*')
      .eq('call_log_id', id)
      .order('created_at', { ascending: false });
    const sessionIds = (sessions || []).map((s: any) => s.id).filter(Boolean);
    const { data: controlAudit } = await db
      .from('whatsapp_call_control_audit')
      .select('*')
      .eq('call_log_id', id)
      .order('created_at', { ascending: false });
    let iceCandidatesBySession: Record<string, any[]> = {};
    if (sessionIds.length > 0) {
      const { data: candidates } = await db
        .from('whatsapp_call_ice_candidates')
        .select('*')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: true });
      iceCandidatesBySession = (candidates || []).reduce((acc: Record<string, any[]>, row: any) => {
        const key = String(row?.session_id || '');
        if (!key) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
      }, {});
    }

    return NextResponse.json({
      success: true,
      call: {
        ...callLog,
        recordings: recordings || [],
        sessions: (sessions || []).map((session: any) => ({
          ...session,
          ice_candidates: iceCandidatesBySession[String(session.id || '')] || [],
        })),
        control_audit: controlAudit || [],
      },
    });
  } catch (error: any) {
    return callErrorResponse(error?.message || 'Internal server error', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const gate = await requireOperationalUser();
    if (!gate.ok) return gate.response;
    const { db, roleCode } = gate;

    const params = await Promise.resolve(context.params as any);
    const id = String(params?.id || '').trim();
    if (!id) return callErrorResponse('id is required', 400);

    const { data: existing, error: existingError } = await db
      .from('whatsapp_call_logs')
      .select('direction')
      .eq('id', id)
      .maybeSingle();
    if (existingError) return callErrorResponse(existingError.message || 'Failed to fetch call', 500);
    if (!existing) return callErrorResponse('Call not found', 404);
    if (isInboundDirection(existing.direction) && !isSuperAdminRole(roleCode)) {
      return callErrorResponse('Incoming calls are available only for Super Admin', 403);
    }

    const body = await request.json().catch(() => ({}));
    const nextStatus = String(body?.call_status || '').trim().toUpperCase();
    if (!nextStatus) return callErrorResponse('call_status is required', 400);

    const updates: Record<string, unknown> = {
      call_status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    if (body?.ended_at) updates.ended_at = String(body.ended_at);
    if (body?.duration_seconds != null && Number.isFinite(Number(body.duration_seconds))) {
      updates.duration_seconds = Math.max(0, Math.floor(Number(body.duration_seconds)));
    }
    if (body?.error_message != null) updates.error_message = String(body.error_message || '') || null;

    const { data: updated, error: updateError } = await db
      .from('whatsapp_call_logs')
      .update(updates)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (updateError) return callErrorResponse(updateError.message || 'Failed to update call', 500);
    if (!updated) return callErrorResponse('Call not found', 404);

    return NextResponse.json({ success: true, call: updated });
  } catch (error: any) {
    return callErrorResponse(error?.message || 'Internal server error', 500);
  }
}
