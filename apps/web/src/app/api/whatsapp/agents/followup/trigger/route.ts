import { NextRequest, NextResponse } from 'next/server';
import { triggerManualFollowupForPhone } from '@/lib/whatsappAgents/followup/handler';
import { getDbWithAdmin } from '@/app/api/whatsapp/agents/utils';

export async function POST(request: NextRequest) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const phone = String(body?.phone || '').replace(/\D/g, '').slice(-10);
    if (!phone || phone.length !== 10) {
      return NextResponse.json({ error: 'Valid 10-digit phone required' }, { status: 400 });
    }

    const result = await triggerManualFollowupForPhone({
      phone,
      customerName: body?.customer_name ? String(body.customer_name) : undefined,
      vehicleModel: body?.vehicle_model ? String(body.vehicle_model) : undefined,
      reason: body?.reason ? String(body.reason) : undefined,
      force: body?.force === true,
      ignoreAssigned: true,
    });

    if (!result.handled || (result.decision?.action === 'SEND_MESSAGE' && !result.messageSent)) {
      return NextResponse.json(
        {
          success: false,
          error: result.skippedReason || result.sendError || 'Follow-up not sent',
          skipped_reason: result.skippedReason || result.sendError,
          execution_status: result.executionStatus,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      phone,
      instance_id: result.instanceId,
      decision: result.decision,
      latency_ms: result.latencyMs,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Trigger failed' }, { status: 500 });
  }
}
