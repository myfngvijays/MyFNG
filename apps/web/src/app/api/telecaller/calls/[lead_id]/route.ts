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
    const logIds = (callLogs || []).map((row: any) => String(row?.id || '').trim()).filter(Boolean);
    const analysisById: Record<string, any> = {};
    if (logIds.length && supabaseAdmin) {
      const { data: analyses } = await supabaseAdmin
        .from('telecaller_call_analyses')
        .select(
          'call_log_id, quality_score, quality_grade, quality_flags, sentiment, summary, conversation_tags, customer_problem, agent_solution, solution_adequacy, coaching_tips, query_resolutions, overall_resolution, queries_resolved, queries_total, queries_unresolved, unresolved_gaps, engine, sop_audit',
        )
        .in('call_log_id', logIds);
      for (const row of analyses || []) {
        const key = String((row as { call_log_id?: string }).call_log_id || '').trim();
        if (key) analysisById[key] = row;
      }
    }
    const call_logs = (callLogs || []).map((row: any) => {
      const url = String(row?.call_recording_url || '').trim();
      const has = Boolean(url);
      const analysis = analysisById[String(row?.id || '')] || null;
      if (!redactDirectUrl) {
        return { ...row, has_call_recording: has, analysis };
      }
      return {
        ...row,
        has_call_recording: has,
        call_recording_url: null,
        analysis,
      };
    });

    // Sync the call count only when it actually changed.
    // Any update on service_leads bumps updated_at, so opening a lead
    // must not rewrite the row when the count is already correct.
    const total = call_logs.length;
    if (supabaseAdmin) {
      const { data: leadRow } = await supabaseAdmin
        .from('service_leads')
        .select('total_calls')
        .eq('id', leadId)
        .maybeSingle();
      const current = Number(leadRow?.total_calls ?? 0);
      if (leadRow && current !== total) {
        await supabaseAdmin.from('service_leads').update({ total_calls: total }).eq('id', leadId);
      }
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
