import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getDbWithAdmin } from '@/app/api/whatsapp/agents/utils';

function parseDateRange(searchParams: URLSearchParams) {
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : new Date();
  const from = searchParams.get('from')
    ? new Date(searchParams.get('from')!)
    : new Date(to.getTime() - 14 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return null;
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    fromLabel: from.toISOString().slice(0, 10),
    toLabel: to.toISOString().slice(0, 10),
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const range = parseDateRange(new URL(request.url).searchParams);
    if (!range) return NextResponse.json({ error: 'Invalid from/to dates' }, { status: 400 });

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? auth.db) as any;

    const { data: instances, error: instError } = await db
      .from('whatsapp_agent_instances')
      .select('id, agent_type, status, end_reason, follow_up_count, created_at, ended_at, last_customer_reply_at')
      .gte('created_at', range.from)
      .lte('created_at', range.to);

    if (instError) {
      if (instError.code === '42P01') {
        return NextResponse.json({
          success: true,
          period: { from: range.fromLabel, to: range.toLabel },
          note: 'Run migration database/260_whatsapp_agents.sql',
        });
      }
      return NextResponse.json({ error: instError.message }, { status: 500 });
    }

    const rows = instances || [];
    const booking = rows.filter((r: any) => r.agent_type === 'BOOKING');
    const followup = rows.filter((r: any) => r.agent_type === 'FOLLOWUP');
    const chase = rows.filter((r: any) => r.agent_type === 'CHASE');

    const { data: actions } = await db
      .from('whatsapp_agent_actions')
      .select('instance_id, execution_status, validated_action, created_at')
      .gte('created_at', range.from)
      .lte('created_at', range.to);

    const executedSends = (actions || []).filter(
      (a: any) => a.execution_status === 'EXECUTED' && a.validated_action === 'SEND_MESSAGE',
    ).length;
    const failedSends = (actions || []).filter((a: any) => a.execution_status === 'FAILED').length;
    const blockedActions = (actions || []).filter((a: any) => a.execution_status === 'BLOCKED').length;

    const chaseConverted = chase.filter((r: any) => r.end_reason === 'CONVERTED');
    const chaseEscalated = chase.filter((r: any) => r.status === 'ESCALATED' || r.end_reason?.includes('ESCALAT'));
    const chaseEndedMax = chase.filter((r: any) => r.end_reason === 'MAX_ATTEMPTS');
    const chaseActive = chase.filter((r: any) => ['ACTIVE', 'WAITING'].includes(r.status));

    const followupReplied = followup.filter((r: any) => Boolean(r.last_customer_reply_at));
    const followupSent = followup.filter((r: any) => r.end_reason === 'SENT' || r.status === 'ENDED');

    const bookingConverted = booking.filter((r: any) => r.end_reason === 'CONVERTED' || r.status === 'ENDED');

    const avgFollowUpsToConvert =
      chaseConverted.length > 0
        ? chaseConverted.reduce((sum: number, r: any) => sum + Number(r.follow_up_count || 0), 0) /
          chaseConverted.length
        : 0;

    const { data: configs } = await db.from('whatsapp_agent_configs').select('agent_type, enabled');
    const enabledByType = Object.fromEntries(
      (configs || []).map((c: any) => [String(c.agent_type).toLowerCase(), Boolean(c.enabled)]),
    );

    return NextResponse.json({
      success: true,
      period: { from: range.fromLabel, to: range.toLabel },
      totals: {
        instances: rows.length,
        messages_executed: executedSends,
        messages_failed: failedSends,
        actions_blocked: blockedActions,
      },
      agents_enabled: enabledByType,
      booking: {
        conversations: booking.length,
        bookings_created: bookingConverted.length,
        conversion_rate: booking.length ? bookingConverted.length / booking.length : 0,
        active: booking.filter((r: any) => ['ACTIVE', 'WAITING'].includes(r.status)).length,
      },
      followup: {
        sent: followupSent.length,
        replied: followupReplied.length,
        response_rate: followupSent.length ? followupReplied.length / followupSent.length : 0,
        completed: followup.filter((r: any) => r.status === 'ENDED').length,
        active: followup.filter((r: any) => ['ACTIVE', 'WAITING'].includes(r.status)).length,
      },
      chase: {
        active: chaseActive.length,
        converted: chaseConverted.length,
        escalated: chaseEscalated.length,
        ended_max_attempts: chaseEndedMax.length,
        conversion_rate: chase.length ? chaseConverted.length / chase.length : 0,
        avg_follow_ups_to_convert: Number(avgFollowUpsToConvert.toFixed(1)),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
