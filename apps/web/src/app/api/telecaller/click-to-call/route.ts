import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { normalizePhone10 } from '@/lib/telecaller/initiateClickToCall';
import { sendPhoneDial } from '@/lib/telecaller/phoneDialPush';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/telecaller/click-to-call
 * Body: { to: string, from?: string, lead_id?: string }
 *
 * Sends the call to the phone where this same account is logged into the app.
 * Body source "device" means that phone already opened the dialer — only log it.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    const roleCode = String((profile?.roles as any)?.role_code || '')
      .trim()
      .toUpperCase();
    const allowed = new Set(['TELECALLER', 'LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const to = normalizePhone10(body?.to);
    const profileId = String((profile as any)?.id || user.id || '').trim();
    const fromDevice = String(body?.source || '').toLowerCase() === 'device';

    if (!to) {
      return NextResponse.json({ error: 'Customer phone (to) required' }, { status: 400 });
    }

    const result = await sendPhoneDial({
      telecallerId: profileId,
      to,
      leadId: body?.lead_id ? String(body.lead_id) : null,
      customerName: body?.customer_name ? String(body.customer_name) : null,
      alreadyDialed: fromDevice,
    });

    if (!result.ok) {
      const status = result.code === 'PHONE_OFFLINE' ? 409 : 502;
      return NextResponse.json(
        { error: result.error || 'Could not send the call to your phone', code: result.code },
        { status },
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      to,
      lead_id: body?.lead_id || null,
      call_log_id: result.callLogId || null,
      via: fromDevice ? 'device' : 'phone_push',
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
