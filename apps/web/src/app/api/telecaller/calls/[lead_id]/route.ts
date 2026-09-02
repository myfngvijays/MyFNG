/**
 * Get Call Logs for Lead API
 * Auth: cookie session OR mobile Bearer (createClientFromRequest)
 */

import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { detachForeignDidRecordingsForLead, detachForeignDidRecordingsThrottled, healSmartfloRecordingForLead } from '@/lib/telecaller/smartfloCdr';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lead_id: string }> },
) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lead_id } = await params;
    const leadId = String(lead_id || '').trim();
    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead_id' }, { status: 400 });
    }

    const profile = await resolveUserProfile(supabase, user);
    const roleCode = String((profile?.roles as any)?.role_code || '')
      .trim()
      .toUpperCase();

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin ?? supabase;

    await detachForeignDidRecordingsForLead(leadId);
    await healSmartfloRecordingForLead(leadId);
    void detachForeignDidRecordingsThrottled();

    // TELECALLER must be able to read the lead (assigned / CRM scope)
    if (roleCode === 'TELECALLER') {
      const { data: canReadLead } = await supabase
        .from('service_leads')
        .select('id')
        .eq('id', leadId)
        .maybeSingle();
      if (!canReadLead) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { data: callLogs, error: logsError } = await db
      .from('telecaller_call_logs')
      .select(
        `
        *,
        telecaller:users_login!telecaller_id(id, full_name)
      `,
      )
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (logsError) {
      console.error('Error fetching call logs:', logsError);
      return NextResponse.json({ error: 'Failed to fetch call logs' }, { status: 500 });
    }

    const redactDirectUrl = roleCode === 'TELECALLER';
    const call_logs = (callLogs || []).map((row: any) => {
      const url = String(row?.call_recording_url || '').trim();
      const has = Boolean(url);
      if (!redactDirectUrl) {
        return { ...row, has_call_recording: has };
      }
      return {
        ...row,
        has_call_recording: has,
        call_recording_url: null,
      };
    });

    // Keep service_leads.total_calls in sync for list UIs
    const total = call_logs.length;
    if (supabaseAdmin && total >= 0) {
      void supabaseAdmin
        .from('service_leads')
        .update({ total_calls: total, updated_at: new Date().toISOString() })
        .eq('id', leadId)
        .then(() => undefined)
        .catch(() => undefined);
    }

    return NextResponse.json(
      {
        success: true,
        call_logs,
        total,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error in get call logs API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
